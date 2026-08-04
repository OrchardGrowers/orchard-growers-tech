import OGCodePatch from "../../../models/OGCodePatch.js";
import OGCodingTask from "../../../models/OGCodingTask.js";
import { auditCodingEvent } from "./codingAuditService.js";
import { requireApprovedCodingApproval } from "./codingApprovalService.js";
import { getCodingProvider } from "./codingProvider.js";
import { validateCodePatch } from "./codePatchValidationService.js";
import { getRepositoryState } from "./gitReadOnlyService.js";

export const buildPatchGenerationPreview = (codingTask, repositoryState) => ({
  codingTaskId: String(codingTask._id),
  analysisStatus: codingTask.analysisStatus,
  relevantFiles: codingTask.relevantFiles.map((file) => ({ path: file.path, contentHash: file.contentHash || "" })),
  baseGitCommit: repositoryState.commit,
  baseWorkingTreeHash: repositoryState.workingTreeHash,
  allowedPaths: codingTask.allowedPaths,
});

export const generateCodePatch = async ({ codingTask, generationApprovalId, proposedPatch, actorId, requestContext, settings }) => {
  if (codingTask.analysisStatus !== "REVIEW_READY") throw Object.assign(new Error("Coding analysis must be review-ready before patch generation"), { statusCode: 409, code: "ANALYSIS_NOT_READY" });
  if (!codingTask.allowPatchGeneration || !settings.allowPatchGeneration) throw Object.assign(new Error("Patch generation is disabled for this task or globally"), { statusCode: 403, code: "PATCH_GENERATION_DISABLED" });
  const repositoryState = await getRepositoryState();
  const approvalPreview = buildPatchGenerationPreview(codingTask, repositoryState);
  await requireApprovedCodingApproval({ approvalId: generationApprovalId, codingTask, actionType: "CODE_PATCH_GENERATION", expectedPreview: approvalPreview });
  const locked = await OGCodingTask.findOneAndUpdate({ _id: codingTask._id, analysisStatus: "REVIEW_READY", $or: [{ operationLock: "NONE" }, { lockExpiresAt: { $lte: new Date() } }] }, { $set: { operationLock: "PATCH_GENERATION", lockExpiresAt: new Date(Date.now() + 5 * 60 * 1000), patchStatus: "GENERATING" } }, { new: true });
  if (!locked) throw Object.assign(new Error("A patch generation operation is already running"), { statusCode: 409, code: "PATCH_GENERATION_BUSY" });
  try {
    const providerResult = await getCodingProvider().generatePatch({ task: codingTask, proposedPatch });
    const validation = await validateCodePatch({ patchContent: providerResult.patchContent, codingTask, settings, repositoryState });
    const latest = await OGCodePatch.findOne({ codingTaskId: codingTask._id }).sort({ version: -1 }).select("version").lean();
    if (latest) await OGCodePatch.updateMany({ codingTaskId: codingTask._id, status: { $in: ["DRAFT", "REVIEW_READY", "WAITING_APPROVAL", "APPROVED"] } }, { $set: { status: "SUPERSEDED" } });
    const rollbackInstructions = await getCodingProvider().generateRollbackPlan({ files: validation.files });
    const patch = await OGCodePatch.create({
      codingTaskId: codingTask._id, version: (latest?.version || 0) + 1, title: `Patch proposal for ${codingTask.taskId?.title || "coding task"}`,
      description: "Validated unified diff proposal. Repository content remains untrusted and human review is required.", status: "REVIEW_READY",
      patchContent: validation.patchContent, patchHash: validation.patchHash, baseGitCommit: repositoryState.commit, baseWorkingTreeHash: repositoryState.workingTreeHash,
      files: validation.files, summary: `Proposes ${validation.files.length} controlled file change(s).`, risks: validation.risks,
      validationCommands: ["git_diff_check"], rollbackInstructions, generationApprovalId, generatedBy: actorId,
    });
    await requireApprovedCodingApproval({ approvalId: generationApprovalId, codingTask, actionType: "CODE_PATCH_GENERATION", expectedPreview: approvalPreview, consume: true, actorId });
    await OGCodingTask.updateOne({ _id: codingTask._id }, { $set: { patchStatus: "REVIEW_READY", status: "PATCH_REVIEW", operationLock: "NONE", lockExpiresAt: null } });
    await auditCodingEvent({ codingTask, actorId, eventType: "CODE_PATCH_GENERATED", action: "Generated and validated a code patch proposal", metadata: { patchId: patch._id, version: patch.version, patchHash: patch.patchHash, files: patch.files.map((file) => file.path), riskLevel: validation.riskLevel }, requestContext });
    return patch;
  } catch (error) {
    await OGCodingTask.updateOne({ _id: codingTask._id }, { $set: { patchStatus: "FAILED", operationLock: "NONE", lockExpiresAt: null } });
    await auditCodingEvent({ codingTask, actorId, eventType: "CODE_PATCH_VALIDATION_FAILED", action: "Patch generation or validation failed safely", details: error.message, metadata: { code: error.code }, requestContext }).catch(() => {});
    throw error;
  }
};
