import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import OGCodePatch from "../../../models/OGCodePatch.js";
import OGCodingTask from "../../../models/OGCodingTask.js";
import { auditCodingEvent } from "./codingAuditService.js";
import { requireApprovedCodingApproval } from "./codingApprovalService.js";
import { getRepositoryState } from "./gitReadOnlyService.js";
import { executeBoundedProcess } from "./processExecutionService.js";
import { getRepositoryRoot, resolveRepositoryPath } from "./repositoryPathService.js";
import { captureRepositorySnapshot } from "./repositorySnapshotService.js";
import { acquireRepositoryWriteLock } from "./repositoryWriteLockService.js";

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

export const buildPatchRevertPreview = (codingTask, patch, state) => ({ codingTaskId: String(codingTask._id), patchId: String(patch._id), patchHash: patch.patchHash, currentCommit: state.commit, currentWorkingTreeHash: state.workingTreeHash, files: patch.files.map((file) => file.path) });

export const revertApprovedCodePatch = async ({ codingTask, patch, actorId, requestContext }) => {
  if (patch.status !== "APPLIED") throw Object.assign(new Error("Only an applied OG Coding Agent patch can be reverted"), { statusCode: 409, code: "PATCH_NOT_APPLIED" });
  const state = await getRepositoryState();
  const preview = buildPatchRevertPreview(codingTask, patch, state);
  await requireApprovedCodingApproval({ approvalId: patch.revertApprovalId, codingTask, actionType: "CODE_PATCH_REVERT", expectedPreview: preview });
  const expectedHashes = patch.applicationResult?.afterHashes || {};
  for (const file of patch.files) {
    try {
      const resolved = await resolveRepositoryPath(file.path, { allowedPaths: codingTask.allowedPaths });
      const currentHash = sha256(await fs.readFile(resolved.absolutePath));
      if (expectedHashes[file.path] && currentHash !== expectedHashes[file.path]) {
        await auditCodingEvent({ codingTask, actorId, eventType: "CODE_PATCH_REVERT_CONFLICT", action: "Blocked automatic patch revert after overlapping edits", details: file.path, metadata: { patchId: patch._id, path: file.path }, requestContext }).catch(() => {});
        throw Object.assign(new Error(`Later edits overlap ${file.path}; automatic revert is blocked`), { statusCode: 409, code: "REVERT_CONFLICT" });
      }
    } catch (error) {
      if (file.operation === "DELETE" && error.code === "REPOSITORY_PATH_NOT_FOUND") continue;
      throw error;
    }
  }
  const releaseRepositoryLock = acquireRepositoryWriteLock();
  const lockedState = await getRepositoryState().catch((error) => { releaseRepositoryLock(); throw error; });
  if (lockedState.workingTreeHash !== state.workingTreeHash) {
    releaseRepositoryLock();
    throw Object.assign(new Error("Repository changed while revert was being prepared"), { statusCode: 409, code: "REVERT_CONFLICT" });
  }
  const locked = await OGCodingTask.findOneAndUpdate({ _id: codingTask._id, operationLock: "NONE" }, { $set: { operationLock: "PATCH_REVERT", lockExpiresAt: new Date(Date.now() + 10 * 60 * 1000) } }, { new: true });
  if (!locked) { releaseRepositoryLock(); throw Object.assign(new Error("Repository write is already in progress"), { statusCode: 409, code: "REPOSITORY_WRITE_LOCKED" }); }
  let temporaryDirectory;
  try {
    const before = await captureRepositorySnapshot({ codingTask, patchId: patch._id, snapshotType: "BEFORE_REVERT", paths: patch.files.map((file) => file.path) });
    temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "og-code-revert-"));
    const patchFile = path.join(temporaryDirectory, "approved.patch");
    await fs.writeFile(patchFile, patch.patchContent, { encoding: "utf8", flag: "wx" });
    const root = await getRepositoryRoot();
    const check = await executeBoundedProcess({ executable: "git", args: ["apply", "--reverse", "--check", "--", patchFile], cwd: root, timeoutMs: 30000, maximumOutputBytes: 100000 });
    if (check.exitCode !== 0 || check.timedOut) throw Object.assign(new Error("Reverse patch dry-run failed; manual review is required"), { statusCode: 409, code: "REVERT_DRY_RUN_FAILED" });
    const result = await executeBoundedProcess({ executable: "git", args: ["apply", "--reverse", "--whitespace=nowarn", "--", patchFile], cwd: root, timeoutMs: 30000, maximumOutputBytes: 100000 });
    if (result.exitCode !== 0 || result.timedOut) throw Object.assign(new Error("Reverse patch failed; inspect the current working tree"), { statusCode: 409, code: "REVERT_FAILED" });
    const after = await captureRepositorySnapshot({ codingTask, patchId: patch._id, snapshotType: "AFTER_REVERT", paths: patch.files.map((file) => file.path) });
    await requireApprovedCodingApproval({ approvalId: patch.revertApprovalId, codingTask, actionType: "CODE_PATCH_REVERT", expectedPreview: preview, consume: true, actorId });
    await Promise.all([
      OGCodePatch.updateOne({ _id: patch._id }, { $set: { status: "REVERTED", applicationResult: { ...patch.applicationResult, revertBeforeSnapshotId: before._id, revertAfterSnapshotId: after._id, revertedAt: new Date(), revertedBy: actorId } } }),
      OGCodingTask.updateOne({ _id: codingTask._id }, { $set: { patchStatus: "REVERTED", status: "REVIEW_READY", operationLock: "NONE", lockExpiresAt: null } }),
    ]);
    await auditCodingEvent({ codingTask, actorId, eventType: "CODE_PATCH_REVERTED", action: "Reverted the exact OG Coding Agent patch with a reverse patch", metadata: { patchId: patch._id, files: patch.files.map((file) => file.path) }, requestContext });
    return { patchId: patch._id, filesReverted: patch.files.map((file) => file.path), beforeSnapshotId: before._id, afterSnapshotId: after._id };
  } catch (error) {
    await OGCodingTask.updateOne({ _id: codingTask._id }, { $set: { operationLock: "NONE", lockExpiresAt: null } });
    await auditCodingEvent({ codingTask, actorId, eventType: "CODE_PATCH_REVERT_FAILED", action: "Patch revert stopped safely", details: error.message, metadata: { patchId: patch._id, code: error.code }, requestContext }).catch(() => {});
    throw error;
  } finally {
    releaseRepositoryLock();
    if (temporaryDirectory) await fs.rm(temporaryDirectory, { recursive: true, force: true }).catch(() => {});
  }
};
