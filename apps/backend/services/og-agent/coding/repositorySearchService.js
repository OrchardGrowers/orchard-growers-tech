import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import OGCodingTask from "../../../models/OGCodingTask.js";
import { auditFileAccess } from "./codingAuditService.js";
import { classifyRepositoryPath, isLikelyBinary, normalizeRepositoryPath } from "./repositoryPolicyService.js";
import { resolveRepositoryPath } from "./repositoryPathService.js";

const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");

const listFiles = async (absoluteDirectory, relativeDirectory, output, maximumFiles) => {
  if (output.length >= maximumFiles) return;
  const entries = await fs.readdir(absoluteDirectory, { withFileTypes: true });
  for (const entry of entries) {
    if (output.length >= maximumFiles) break;
    const relative = normalizeRepositoryPath(path.posix.join(relativeDirectory, entry.name));
    if (!classifyRepositoryPath(relative).allowed || entry.isSymbolicLink()) continue;
    const absolute = path.join(absoluteDirectory, entry.name);
    if (entry.isDirectory()) await listFiles(absolute, relative, output, maximumFiles);
    else if (entry.isFile()) output.push({ relative, absolute });
  }
};

export const searchRepository = async ({ codingTask, query, paths, actorId, requestContext, settings }) => {
  const needle = String(query || "").trim();
  if (needle.length < 2 || needle.length > 120 || /[\0\r\n]/.test(needle)) throw Object.assign(new Error("Search query must be 2 to 120 single-line characters"), { statusCode: 400, code: "INVALID_SEARCH_QUERY" });
  const selectedPaths = Array.isArray(paths) && paths.length ? paths : codingTask.allowedPaths;
  const maximumFiles = Math.min(Number(settings.maximumFilesPerTask || 100), 500);
  const maximumResults = 100;
  const candidates = [];
  for (const scope of selectedPaths.slice(0, 12)) {
    const resolved = await resolveRepositoryPath(scope, { allowedPaths: codingTask.allowedPaths });
    const stat = await fs.stat(resolved.absolutePath);
    if (stat.isDirectory()) await listFiles(resolved.absolutePath, resolved.relativePath, candidates, maximumFiles);
    else candidates.push({ relative: resolved.relativePath, absolute: resolved.absolutePath });
    if (candidates.length >= maximumFiles) break;
  }

  const results = [];
  let totalBytesRead = 0;
  const remainingReadBudget = Math.max(0, Number(settings.maximumTotalReadBytesPerTask || 2000000) - Number(codingTask.totalReadBytes || 0));
  for (const candidate of candidates) {
    if (results.length >= maximumResults) break;
    const stat = await fs.stat(candidate.absolute);
    if (stat.size > Number(settings.maximumBytesPerFile || 200000)) continue;
    if (totalBytesRead + stat.size > remainingReadBudget) break;
    const buffer = await fs.readFile(candidate.absolute);
    totalBytesRead += buffer.length;
    if (isLikelyBinary(buffer)) continue;
    const lines = buffer.toString("utf8").replace(/\r\n/g, "\n").split("\n");
    const matches = [];
    lines.forEach((line, index) => {
      if (matches.length < 10 && line.toLowerCase().includes(needle.toLowerCase())) {
        matches.push({ lineNumber: index + 1, snippet: line.trim().slice(0, 300) });
      }
    });
    if (matches.length) results.push({ path: candidate.relative, matches, relevanceReason: `Contains ${matches.length} bounded text match(es)`, contentHash: hash(buffer) });
  }
  if (totalBytesRead) {
    await OGCodingTask.updateOne({ _id: codingTask._id }, { $inc: { totalReadBytes: totalBytesRead } });
    codingTask.totalReadBytes = Number(codingTask.totalReadBytes || 0) + totalBytesRead;
  }
  await auditFileAccess({ codingTask, actorId, operation: "SEARCH", path: selectedPaths.join(", "), allowed: true, reason: "APPROVED_SCOPE", bytesRead: 0, requestContext });
  return { query: needle, searchedFiles: candidates.length, bytesRead: totalBytesRead, results, truncated: candidates.length >= maximumFiles || results.length >= maximumResults || totalBytesRead >= remainingReadBudget };
};
