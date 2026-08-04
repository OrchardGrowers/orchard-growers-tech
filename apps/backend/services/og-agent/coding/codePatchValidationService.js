import crypto from "node:crypto";
import path from "node:path";
import { classifyRisk, containsObviousSecret, normalizeRepositoryPath } from "./repositoryPolicyService.js";
import { resolveRepositoryPath, validateRepositoryRelativePath } from "./repositoryPathService.js";

export const hashPatch = (content) => crypto.createHash("sha256").update(String(content || ""), "utf8").digest("hex");

const parseDiffPath = (value) => {
  const raw = String(value || "").trim().split(/\s+/)[0];
  if (raw === "/dev/null") return null;
  return normalizeRepositoryPath(raw.replace(/^(?:a|b)\//, ""));
};

export const parseUnifiedDiff = (patchContent) => {
  const content = String(patchContent || "").replace(/\r\n/g, "\n");
  if (!content.startsWith("diff --git ") || !content.endsWith("\n")) {
    const error = new Error("Patch must be a complete Git-style unified diff ending with a newline");
    error.statusCode = 400;
    error.code = "INVALID_UNIFIED_DIFF";
    throw error;
  }
  if (/^(?:GIT binary patch|Binary files )/m.test(content)) throw Object.assign(new Error("Binary patches are prohibited"), { statusCode: 400, code: "BINARY_PATCH_DENIED" });

  const chunks = content.split(/(?=^diff --git )/m).filter(Boolean);
  const files = chunks.map((chunk) => {
    const header = chunk.match(/^diff --git a\/(.+?) b\/(.+?)\n/);
    if (!header) throw Object.assign(new Error("Patch contains a malformed file header"), { statusCode: 400, code: "PATCH_PARSE_FAILED" });
    const oldMarker = chunk.match(/^---\s+(.+)$/m);
    const newMarker = chunk.match(/^\+\+\+\s+(.+)$/m);
    if (!oldMarker || !newMarker || !/^@@/m.test(chunk)) throw Object.assign(new Error("Every patch file must include unified diff markers and at least one hunk"), { statusCode: 400, code: "PATCH_PARSE_FAILED" });
    const oldPath = parseDiffPath(oldMarker[1]);
    const newPath = parseDiffPath(newMarker[1]);
    const headerOld = validateRepositoryRelativePath(header[1]);
    const headerNew = validateRepositoryRelativePath(header[2]);
    let operation = "MODIFY";
    if (!oldPath || /^new file mode /m.test(chunk)) operation = "CREATE";
    if (!newPath || /^deleted file mode /m.test(chunk)) operation = "DELETE";
    if (/^rename (?:from|to) /m.test(chunk)) operation = "RENAME";
    const repositoryPath = operation === "DELETE" ? oldPath || headerOld : newPath || headerNew;
    if (operation === "MODIFY" && (oldPath !== headerOld || newPath !== headerNew || headerOld !== headerNew)) throw Object.assign(new Error("Patch path headers do not match"), { statusCode: 400, code: "PATCH_PATH_MISMATCH" });
    const additions = chunk.split("\n").filter((line) => line.startsWith("+") && !line.startsWith("+++")).length;
    const deletions = chunk.split("\n").filter((line) => line.startsWith("-") && !line.startsWith("---")).length;
    return { path: repositoryPath, oldPath, newPath, operation, additions, deletions, chunk };
  });
  return { content, files };
};

export const validateCodePatch = async ({ patchContent, codingTask, settings, repositoryState }) => {
  const maximumBytes = Math.min(Number(settings.maximumPatchBytes || 500000), 2000000);
  if (Buffer.byteLength(String(patchContent || ""), "utf8") > maximumBytes) throw Object.assign(new Error("Patch exceeds the configured byte limit"), { statusCode: 413, code: "PATCH_TOO_LARGE" });
  if (containsObviousSecret(patchContent)) throw Object.assign(new Error("Patch appears to contain secret material"), { statusCode: 400, code: "PATCH_SECRET_DETECTED" });
  const parsed = parseUnifiedDiff(patchContent);
  if (parsed.files.length > Number(settings.maximumPatchFiles || 25)) throw Object.assign(new Error("Patch changes too many files"), { statusCode: 413, code: "PATCH_FILE_LIMIT" });
  const uniquePaths = new Set();
  const risks = [];
  const files = [];
  for (const file of parsed.files) {
    const repositoryPath = validateRepositoryRelativePath(file.path);
    if (uniquePaths.has(repositoryPath)) throw Object.assign(new Error("Patch contains duplicate file entries"), { statusCode: 400, code: "DUPLICATE_PATCH_FILE" });
    uniquePaths.add(repositoryPath);
    if (path.posix.basename(repositoryPath) === "package-lock.json" && !settings.allowLockfileModification) throw Object.assign(new Error("Lockfile modification is disabled"), { statusCode: 400, code: "LOCKFILE_MODIFICATION_DENIED" });
    if (file.operation === "DELETE" && !settings.allowFileDeletion) throw Object.assign(new Error("File deletion is disabled"), { statusCode: 400, code: "FILE_DELETION_DENIED" });
    if (file.operation === "RENAME" && !settings.allowFileRename) throw Object.assign(new Error("File rename is disabled"), { statusCode: 400, code: "FILE_RENAME_DENIED" });
    if (file.operation === "CREATE" && !settings.allowFileCreation) throw Object.assign(new Error("File creation is disabled"), { statusCode: 400, code: "FILE_CREATION_DENIED" });
    await resolveRepositoryPath(repositoryPath, { allowedPaths: codingTask.allowedPaths, mustExist: file.operation !== "CREATE" });
    const riskLevel = classifyRisk(repositoryPath);
    if (riskLevel === "HIGH") risks.push(`${repositoryPath} is classified as a high-risk path.`);
    files.push({ path: repositoryPath, operation: file.operation, additions: file.additions, deletions: file.deletions, riskLevel, requiresAdditionalApproval: riskLevel === "HIGH", summary: `${file.operation} with ${file.additions} addition(s) and ${file.deletions} deletion(s).` });
  }
  if (files.some((file) => file.riskLevel === "HIGH") && repositoryState.dirty) risks.push("High-risk patches cannot be automatically applied while the working tree is dirty.");
  return { patchContent: parsed.content, patchHash: hashPatch(parsed.content), files, risks, riskLevel: files.some((file) => file.riskLevel === "HIGH") ? "HIGH" : "MEDIUM" };
};
