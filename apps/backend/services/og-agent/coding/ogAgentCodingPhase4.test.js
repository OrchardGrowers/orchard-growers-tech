import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import OGAgentSettings from "../../../models/OGAgentSettings.js";
import { enforcePhase1Settings } from "../ogAgentSettingsService.js";
import { hashPatch, validateCodePatch } from "./codePatchValidationService.js";
import { assertPatchApplicationState } from "./codePatchApplicationService.js";
import { getRepositoryState } from "./gitReadOnlyService.js";
import { classifyRepositoryPath, containsObviousSecret, redactSensitiveOutput, validateAllowedScopes } from "./repositoryPolicyService.js";
import { assertCanonicalPathInsideRoot, getRepositoryRoot, resolveRepositoryPath, validateRepositoryRelativePath } from "./repositoryPathService.js";
import { assertNoArbitraryCommandInput, getSafeCommand, listSafeCommands } from "./safeCommandRegistry.js";
import { executeBoundedProcess } from "./processExecutionService.js";

const settings = {
  maximumPatchBytes: 500000,
  maximumPatchFiles: 25,
  allowLockfileModification: false,
  allowFileDeletion: false,
  allowFileRename: false,
  allowFileCreation: true,
};
const codingTask = { allowedPaths: ["docs", "apps/backend"] };

const patchFor = (repositoryPath, line = "Controlled documentation clarification.") => `diff --git a/${repositoryPath} b/${repositoryPath}\nindex 1111111..2222222 100644\n--- a/${repositoryPath}\n+++ b/${repositoryPath}\n@@ -1,1 +1,2 @@\n # eFruitMandi Project Constitution\n+${line}\n`;

describe("OG Agent Phase 4 repository safety", () => {
  it("rejects traversal, absolute paths, UNC paths, drive switching, null bytes, and malformed encoding", () => {
    for (const unsafe of ["../outside.txt", "docs/../../outside.txt", "/etc/passwd", "C:\\Windows\\win.ini", "\\\\server\\share\\file", "docs/a\0b", "%E0%A4%A"]) {
      expect(() => validateRepositoryRelativePath(unsafe)).toThrow();
    }
    expect(validateRepositoryRelativePath("apps/backend/server.js")).toBe("apps/backend/server.js");
  });

  it("rejects canonical paths that simulate a symbolic-link escape", async () => {
    const root = await getRepositoryRoot();
    expect(assertCanonicalPathInsideRoot(root, path.join(root, "docs", "README.md"))).toBe(true);
    expect(() => assertCanonicalPathInsideRoot(root, path.resolve(root, "..", "outside.txt"))).toThrowError(expect.objectContaining({ code: "SYMLINK_ESCAPE_DENIED" }));
  });

  it("denies environment, private key, token, dependency, Git, build, dump, and database paths", () => {
    for (const denied of [".env", ".env.production", "private.pem", "id_rsa", "credentials.json", "service-account-prod.json", "node_modules/pkg/index.js", ".git/config", "dist/app.js", "coverage/out.json", "backup/data.dump", "local.sqlite3"]) {
      expect(classifyRepositoryPath(denied).allowed, denied).toBe(false);
    }
  });

  it("resolves approved safe paths only inside their selected task scope", async () => {
    await expect(resolveRepositoryPath("docs/PROJECT_CONSTITUTION.md", { allowedPaths: ["docs"] })).resolves.toMatchObject({ relativePath: "docs/PROJECT_CONSTITUTION.md" });
    await expect(resolveRepositoryPath("apps/backend/server.js", { allowedPaths: ["docs"] })).rejects.toMatchObject({ code: "PATH_OUTSIDE_TASK_SCOPE" });
    await expect(resolveRepositoryPath("apps/backend/.env", { allowedPaths: ["apps/backend"] })).rejects.toMatchObject({ code: "SENSITIVE_FILE" });
  });

  it("accepts only configured repository scopes", () => {
    expect(validateAllowedScopes(["apps/backend", "docs"])).toEqual(["apps/backend", "docs"]);
    expect(() => validateAllowedScopes(["apps/backend/controllers/payments"])).toThrowError(expect.objectContaining({ code: "INVALID_REPOSITORY_SCOPE" }));
  });
});

describe("OG Agent Phase 4 patch and command controls", () => {
  it("validates a bounded in-scope unified diff and classifies route registration as high risk", async () => {
    const state = await getRepositoryState();
    await expect(validateCodePatch({ patchContent: patchFor("docs/PROJECT_CONSTITUTION.md"), codingTask, settings, repositoryState: state })).resolves.toMatchObject({ files: [{ path: "docs/PROJECT_CONSTITUTION.md", operation: "MODIFY" }] });
    const serverPatch = patchFor("apps/backend/server.js", "// controlled route note");
    await expect(validateCodePatch({ patchContent: serverPatch, codingTask, settings, repositoryState: state })).resolves.toMatchObject({ riskLevel: "HIGH", files: [{ requiresAdditionalApproval: true }] });
  });

  it("rejects denied files, unapproved deletion, lockfiles, binary patches, scope escapes, and secrets", async () => {
    const state = await getRepositoryState();
    const deletion = `diff --git a/docs/PROJECT_CONSTITUTION.md b/docs/PROJECT_CONSTITUTION.md\ndeleted file mode 100644\n--- a/docs/PROJECT_CONSTITUTION.md\n+++ /dev/null\n@@ -1 +0,0 @@\n-# eFruitMandi Project Constitution\n`;
    const binary = `diff --git a/docs/a.png b/docs/a.png\nnew file mode 100644\nindex 0000000..1111111\nGIT binary patch\nliteral 1\nA\n`;
    await expect(validateCodePatch({ patchContent: deletion, codingTask, settings, repositoryState: state })).rejects.toMatchObject({ code: "FILE_DELETION_DENIED" });
    await expect(validateCodePatch({ patchContent: patchFor("package-lock.json"), codingTask: { allowedPaths: ["package-lock.json"] }, settings, repositoryState: state })).rejects.toMatchObject({ code: "LOCKFILE_MODIFICATION_DENIED" });
    await expect(validateCodePatch({ patchContent: binary, codingTask, settings, repositoryState: state })).rejects.toMatchObject({ code: "BINARY_PATCH_DENIED" });
    await expect(validateCodePatch({ patchContent: patchFor("apps/admin-panel/src/App.tsx"), codingTask, settings, repositoryState: state })).rejects.toMatchObject({ code: "PATH_OUTSIDE_TASK_SCOPE" });
    expect(containsObviousSecret("api_key = 'ABCDEFGHIJKLMNOPQRST'")).toBe(true);
    await expect(validateCodePatch({ patchContent: patchFor("docs/PROJECT_CONSTITUTION.md", "api_key = 'ABCDEFGHIJKLMNOPQRST'"), codingTask, settings, repositoryState: state })).rejects.toMatchObject({ code: "PATCH_SECRET_DETECTED" });
  });

  it("exposes fixed command IDs and rejects executable text, arguments, cwd, and unknown IDs", () => {
    expect(listSafeCommands().map((command) => command.commandId)).toContain("git_diff_check");
    expect(getSafeCommand("git_status")).toMatchObject({ executable: "git", arguments: ["status", "--short", "--untracked-files=all"] });
    expect(() => getSafeCommand("git_push")).toThrowError(expect.objectContaining({ code: "COMMAND_NOT_ALLOWED" }));
    for (const body of [{ command: "git push" }, { executable: "powershell" }, { arguments: ["--danger"] }, { cwd: ".." }]) expect(() => assertNoArbitraryCommandInput(body)).toThrowError(expect.objectContaining({ code: "ARBITRARY_COMMAND_DENIED" }));
  });

  it("rejects patch mutation, stale state, duplicate apply, overlap, and dirty high-risk application", () => {
    const patchContent = patchFor("docs/PROJECT_CONSTITUTION.md");
    const patch = { status: "APPROVED", patchContent, patchHash: "wrong", baseGitCommit: "a", baseWorkingTreeHash: "tree", files: [{ path: "docs/PROJECT_CONSTITUTION.md", riskLevel: "LOW" }] };
    const state = { commit: "a", workingTreeHash: "tree", records: [], dirty: false };
    expect(() => assertPatchApplicationState({ patch, state })).toThrowError(expect.objectContaining({ code: "PATCH_HASH_CHANGED" }));
    const validPatch = { ...patch, patchHash: hashPatch(patchContent) };
    expect(() => assertPatchApplicationState({ patch: validPatch, state: { ...state, commit: "b" } })).toThrowError(expect.objectContaining({ code: "STALE_PATCH" }));
    expect(() => assertPatchApplicationState({ patch: { ...validPatch, status: "APPLIED" }, state })).toThrowError(expect.objectContaining({ code: "PATCH_ALREADY_APPLIED" }));
    expect(() => assertPatchApplicationState({ patch: validPatch, state: { ...state, dirty: true, records: [{ path: "docs/PROJECT_CONSTITUTION.md" }] } })).toThrowError(expect.objectContaining({ code: "DIRTY_WORKING_TREE_OVERLAP" }));
    expect(() => assertPatchApplicationState({ patch: { ...validPatch, files: [{ path: "apps/backend/server.js", riskLevel: "HIGH" }] }, state: { ...state, dirty: true, records: [{ path: "unrelated.txt" }] } })).toThrowError(expect.objectContaining({ code: "HIGH_RISK_DIRTY_TREE" }));
  });

  it("redacts secret-shaped process output", () => {
    const redacted = redactSensitiveOutput("Authorization: Bearer abc.def.ghi\npassword=supersecret\napi_key=ABCDEFGHIJKLMNOP");
    expect(redacted).not.toContain("abc.def.ghi");
    expect(redacted).not.toContain("supersecret");
    expect(redacted).not.toContain("ABCDEFGHIJKLMNOP");
  });

  it("bounds process output and reports a real timeout", async () => {
    const fixture = fileURLToPath(new URL("./test-fixtures/boundedProcessFixture.js", import.meta.url));
    const root = await getRepositoryRoot();
    const bounded = await executeBoundedProcess({ executable: process.execPath, args: [fixture, "fast"], cwd: root, timeoutMs: 3000, maximumOutputBytes: 100 });
    expect(bounded.outputTruncated).toBe(true);
    expect(Buffer.byteLength(bounded.stdout)).toBeLessThanOrEqual(100);
    expect(bounded.stdout).not.toContain("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789");
    const timed = await executeBoundedProcess({ executable: process.execPath, args: [fixture], cwd: root, timeoutMs: 100, maximumOutputBytes: 100 });
    expect(timed.timedOut).toBe(true);
  });

  it("forces every irreversible Coding Agent setting to its locked value", async () => {
    const result = enforcePhase1Settings({ allowFileDeletion: true, allowFileRename: true, allowLockfileModification: true, allowDependencyInstallation: true, allowArbitraryTerminal: true, allowSecretFileRead: true, allowGitCommit: true, allowGitPush: true, allowGitMerge: true, allowLocalBranchCreation: true, allowProductionDeployment: true, allowDatabaseWrite: true, requireApprovalForPatchGeneration: false, requireApprovalForPatchApplication: false, requireAdditionalApprovalForHighRiskFiles: false });
    expect(result).toMatchObject({ allowFileDeletion: false, allowFileRename: false, allowLockfileModification: false, allowDependencyInstallation: false, allowArbitraryTerminal: false, allowSecretFileRead: false, allowGitCommit: false, allowGitPush: false, allowGitMerge: false, allowLocalBranchCreation: false, allowProductionDeployment: false, allowDatabaseWrite: false, requireApprovalForPatchGeneration: true, requireApprovalForPatchApplication: true, requireAdditionalApprovalForHighRiskFiles: true });
    const model = new OGAgentSettings({ ...result, allowFileDeletion: true });
    await expect(model.validate()).rejects.toMatchObject({ name: "ValidationError" });
  });
});
