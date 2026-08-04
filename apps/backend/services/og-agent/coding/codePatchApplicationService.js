import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import OGCodePatch from "../../../models/OGCodePatch.js";
import OGCodingTask from "../../../models/OGCodingTask.js";
import { auditCodingEvent } from "./codingAuditService.js";
import { requireApprovedCodingApproval } from "./codingApprovalService.js";
import { hashPatch } from "./codePatchValidationService.js";
import { getRepositoryState } from "./gitReadOnlyService.js";
import { executeBoundedProcess } from "./processExecutionService.js";
import { getRepositoryRoot, resolveRepositoryPath } from "./repositoryPathService.js";
import { captureRepositorySnapshot } from "./repositorySnapshotService.js";
import { acquireRepositoryWriteLock } from "./repositoryWriteLockService.js";

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

const applicationPreview = (codingTask, patch, state) => ({
  codingTaskId: String(codingTask._id), patchId: String(patch._id), patchHash: patch.patchHash,
  baseGitCommit: patch.baseGitCommit, currentBranch: state.branch, approvedFiles: patch.files.map((file) => ({ path: file.path, operation: file.operation })),
  approvedCommands: patch.validationCommands, additions: patch.files.reduce((sum, file) => sum + file.additions, 0), deletions: patch.files.reduce((sum, file) => sum + file.deletions, 0),
});

const fileHashes = async (codingTask, files) => {
  const output = {};
  for (const file of files) {
    try {
      const resolved = await resolveRepositoryPath(file.path, { allowedPaths: codingTask.allowedPaths });
      output[file.path] = sha256(await fs.readFile(resolved.absolutePath));
    } catch (error) {
      if (error.code === "REPOSITORY_PATH_NOT_FOUND") output[file.path] = "[MISSING]";
      else throw error;
    }
  }
  return output;
};

export const assertPatchApplicationState = ({ patch, state }) => {
  if (patch.status === "APPLIED") throw Object.assign(new Error("Patch has already been applied"), { statusCode: 409, code: "PATCH_ALREADY_APPLIED" });
  if (hashPatch(patch.patchContent) !== patch.patchHash) throw Object.assign(new Error("Approved patch content hash has changed"), { statusCode: 409, code: "PATCH_HASH_CHANGED" });
  if (state.commit !== patch.baseGitCommit || state.workingTreeHash !== patch.baseWorkingTreeHash) throw Object.assign(new Error("Repository state changed after patch generation; create a new patch version"), { statusCode: 409, code: "STALE_PATCH" });
  const approvedPaths = new Set(patch.files.map((file) => file.path));
  const overlaps = state.records.filter((record) => approvedPaths.has(record.path)).map((record) => record.path);
  if (overlaps.length) throw Object.assign(new Error(`Existing working-tree changes overlap the patch: ${overlaps.join(", ")}`), { statusCode: 409, code: "DIRTY_WORKING_TREE_OVERLAP" });
  if (state.dirty && patch.files.some((file) => file.riskLevel === "HIGH")) throw Object.assign(new Error("High-risk patch application is blocked while the working tree is dirty"), { statusCode: 409, code: "HIGH_RISK_DIRTY_TREE" });
  return approvedPaths;
};

export const applyApprovedCodePatch = async ({ codingTask, patch, actorId, requestContext }) => {
  if (patch.status === "APPLIED") throw Object.assign(new Error("Patch has already been applied"), { statusCode: 409, code: "PATCH_ALREADY_APPLIED" });
  if (!codingTask.allowPatchApplication) throw Object.assign(new Error("Patch application is disabled for this coding task"), { statusCode: 403, code: "PATCH_APPLICATION_DISABLED" });
  const state = await getRepositoryState();
  const preview = applicationPreview(codingTask, patch, state);
  const applicationApproval = await requireApprovedCodingApproval({ approvalId: patch.applicationApprovalId, codingTask, actionType: "CODE_PATCH_APPLICATION", expectedPreview: preview });
  if (patch.files.some((file) => file.requiresAdditionalApproval)) await requireApprovedCodingApproval({ approvalId: patch.highRiskApprovalId, codingTask, actionType: "HIGH_RISK_CODE_PATCH_APPLICATION", expectedPreview: preview });
  const releaseRepositoryLock = acquireRepositoryWriteLock();
  const lockedState = await getRepositoryState().catch((error) => { releaseRepositoryLock(); throw error; });
  let approvedPaths;
  try { approvedPaths = assertPatchApplicationState({ patch, state: lockedState }); }
  catch (error) {
    releaseRepositoryLock();
    await auditCodingEvent({ codingTask, actorId, eventType: error.code === "STALE_PATCH" ? "CODE_PATCH_STALE_DETECTED" : "CODE_PATCH_APPLICATION_BLOCKED", action: "Blocked code patch before application", details: error.message, metadata: { patchId: patch._id, patchHash: patch.patchHash, code: error.code }, requestContext }).catch(() => {});
    throw error;
  }

  const locked = await OGCodePatch.findOneAndUpdate({ _id: patch._id, status: { $in: ["WAITING_APPROVAL", "APPROVED"] } }, { $set: { status: "APPLYING" } }, { new: true });
  if (!locked) { releaseRepositoryLock(); throw Object.assign(new Error("Patch is not approved or another application is already running"), { statusCode: 409, code: "PATCH_APPLY_BUSY" }); }
  const taskLocked = await OGCodingTask.findOneAndUpdate({ _id: codingTask._id, operationLock: "NONE", status: { $ne: "CANCELLED" } }, { $set: { operationLock: "PATCH_APPLY", lockExpiresAt: new Date(Date.now() + 10 * 60 * 1000), patchStatus: "APPLYING" } }, { new: true });
  if (!taskLocked) {
    await OGCodePatch.updateOne({ _id: patch._id }, { $set: { status: "APPROVED" } });
    releaseRepositoryLock();
    throw Object.assign(new Error("Coding task is busy or cancelled"), { statusCode: 409, code: "CODING_TASK_BUSY" });
  }
  let temporaryDirectory;
  try {
    const beforeHashes = await fileHashes(codingTask, patch.files);
    const beforeSnapshot = await captureRepositorySnapshot({ codingTask, patchId: patch._id, snapshotType: "BEFORE_PATCH_APPLY", paths: patch.files.map((file) => file.path) });
    temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "og-code-patch-"));
    const patchFile = path.join(temporaryDirectory, "approved.patch");
    await fs.writeFile(patchFile, patch.patchContent, { encoding: "utf8", flag: "wx" });
    const root = await getRepositoryRoot();
    const dryRun = await executeBoundedProcess({ executable: "git", args: ["apply", "--check", "--", patchFile], cwd: root, timeoutMs: 30000, maximumOutputBytes: 100000 });
    await auditCodingEvent({ codingTask, actorId, eventType: "CODE_PATCH_DRY_RUN", action: "Ran exact approved patch dry-run", metadata: { patchId: patch._id, exitCode: dryRun.exitCode, timedOut: dryRun.timedOut }, requestContext });
    if (dryRun.exitCode !== 0 || dryRun.timedOut) throw Object.assign(new Error("Approved patch did not pass the Git apply dry-run"), { statusCode: 409, code: "PATCH_DRY_RUN_FAILED", safeResult: dryRun });
    const applied = await executeBoundedProcess({ executable: "git", args: ["apply", "--whitespace=nowarn", "--", patchFile], cwd: root, timeoutMs: 30000, maximumOutputBytes: 100000 });
    if (applied.exitCode !== 0 || applied.timedOut) throw Object.assign(new Error("Approved patch application failed; inspect the working tree before retrying"), { statusCode: 409, code: "PATCH_APPLY_FAILED", safeResult: applied });
    const afterState = await getRepositoryState();
    const newlyChanged = afterState.records.map((record) => record.path).filter((repositoryPath) => !lockedState.records.some((before) => before.path === repositoryPath));
    const unexpected = newlyChanged.filter((repositoryPath) => !approvedPaths.has(repositoryPath));
    if (unexpected.length) throw Object.assign(new Error("Unexpected files changed during patch application"), { statusCode: 409, code: "UNEXPECTED_PATCH_FILE", unexpected });
    const afterHashes = await fileHashes(codingTask, patch.files);
    const unchanged = patch.files.filter((file) => beforeHashes[file.path] === afterHashes[file.path]).map((file) => file.path);
    if (unchanged.length) throw Object.assign(new Error(`Approved patch did not change expected files: ${unchanged.join(", ")}`), { statusCode: 409, code: "PATCH_FILE_HASH_UNCHANGED" });
    const afterSnapshot = await captureRepositorySnapshot({ codingTask, patchId: patch._id, snapshotType: "AFTER_PATCH_APPLY", paths: patch.files.map((file) => file.path) });
    await requireApprovedCodingApproval({ approvalId: patch.applicationApprovalId, codingTask, actionType: "CODE_PATCH_APPLICATION", expectedPreview: preview, consume: true, actorId });
    if (patch.highRiskApprovalId) await requireApprovedCodingApproval({ approvalId: patch.highRiskApprovalId, codingTask, actionType: "HIGH_RISK_CODE_PATCH_APPLICATION", expectedPreview: preview, consume: true, actorId });
    await OGCodePatch.updateOne({ _id: patch._id }, { $set: { status: "APPLIED", reviewedBy: applicationApproval.reviewedBy || null, reviewedAt: applicationApproval.reviewedAt || null, appliedBy: actorId, appliedAt: new Date(), applicationResult: { beforeSnapshotId: beforeSnapshot._id, afterSnapshotId: afterSnapshot._id, beforeHashes, afterHashes, exitCode: applied.exitCode } } });
    await OGCodingTask.updateOne({ _id: codingTask._id }, { $set: { approvedPatchId: patch._id, patchStatus: "APPLIED", status: "APPLIED", operationLock: "NONE", lockExpiresAt: null, workingTreeStateBefore: { snapshotId: beforeSnapshot._id }, workingTreeStateAfter: { snapshotId: afterSnapshot._id } } });
    await auditCodingEvent({ codingTask, actorId, eventType: "CODE_PATCH_APPLIED", action: "Applied the exact approved code patch", metadata: { patchId: patch._id, patchHash: patch.patchHash, files: [...approvedPaths], exitCode: applied.exitCode }, requestContext });
    return { patchId: patch._id, filesChanged: [...approvedPaths], beforeSnapshotId: beforeSnapshot._id, afterSnapshotId: afterSnapshot._id, gitStatus: afterState.status };
  } catch (error) {
    await Promise.all([OGCodePatch.updateOne({ _id: patch._id, status: "APPLYING" }, { $set: { status: "FAILED", applicationResult: { errorCode: error.code, message: error.message } } }), OGCodingTask.updateOne({ _id: codingTask._id }, { $set: { patchStatus: "FAILED", operationLock: "NONE", lockExpiresAt: null } })]);
    await auditCodingEvent({ codingTask, actorId, eventType: "CODE_PATCH_APPLY_FAILED", action: "Patch application stopped safely", details: error.message, metadata: { patchId: patch._id, code: error.code, unexpected: error.unexpected }, requestContext }).catch(() => {});
    throw error;
  } finally {
    releaseRepositoryLock();
    if (temporaryDirectory) await fs.rm(temporaryDirectory, { recursive: true, force: true }).catch(() => {});
  }
};

export const buildPatchApplicationPreview = applicationPreview;
