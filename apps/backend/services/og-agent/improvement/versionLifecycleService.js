import { stableHash } from "./feedbackValidationService.js";
import OGAgentEvaluationRun from "../../../models/OGAgentEvaluationRun.js";

const lifecycleError = (message, code = "INVALID_VERSION_TRANSITION") => { const error = new Error(message); error.code = code; error.statusCode = 409; throw error; };

export const createVersion = async ({ Model, key, contentField, content, changeSummary, evidence = [], actorId }) => {
  const latest = await Model.findOne({ key }).sort({ version: -1 });
  return Model.create({ key, version: (latest?.version || 0) + 1, [contentField]: content, [contentField === "content" ? "contentHash" : "ruleHash"]: stableHash({ content }), changeSummary, evidence, previousVersionId: latest?._id || null, status: "DRAFT", createdBy: actorId });
};

export const activateVersion = async ({ Model, versionId, actorId, approval, minimumEvaluationScore = 70 }) => {
  const version = await Model.findById(versionId);
  if (!version) { const error = new Error("Version was not found"); error.statusCode = 404; throw error; }
  if (version.status !== "APPROVED") lifecycleError("Only an approved version can be activated");
  if (!approval || approval.status !== "APPROVED" || !["PROMPT_VERSION_ACTIVATION", "RULE_VERSION_ACTIVATION"].includes(approval.actionType)) lifecycleError("A matching human activation approval is required", "ACTIVATION_APPROVAL_REQUIRED");
  const approvedHash = approval.actionPreview?.contentHash || approval.actionPreview?.ruleHash;
  const currentHash = version.contentHash || version.ruleHash;
  if (approvedHash && approvedHash !== currentHash) lifecycleError("The approved version hash no longer matches", "VERSION_HASH_CHANGED");
  if (!version.evaluationRunIds?.length && minimumEvaluationScore > 0) lifecycleError("A completed evaluation is required before activation", "EVALUATION_REQUIRED");
  if (minimumEvaluationScore > 0) {
    const evaluation = await OGAgentEvaluationRun.findOne({ _id: { $in: version.evaluationRunIds }, status: "COMPLETED", regressionDetected: false }).sort({ completedAt: -1 });
    if (!evaluation || evaluation.aggregateScore < minimumEvaluationScore) lifecycleError(`A completed non-regressing evaluation score of at least ${minimumEvaluationScore} is required`, "EVALUATION_THRESHOLD_NOT_MET");
  }
  await Model.updateMany({ key: version.key, status: "ACTIVE" }, { $set: { status: "SUPERSEDED" } });
  version.status = "ACTIVE"; version.activatedBy = actorId; version.activatedAt = new Date(); version.approvalId = approval._id;
  return version.save();
};

export const rollbackVersion = async ({ Model, activeVersionId, targetVersionId, actorId, approval }) => {
  const [active, target] = await Promise.all([Model.findById(activeVersionId), Model.findById(targetVersionId)]);
  if (!active || !target || active.key !== target.key) lifecycleError("Rollback versions do not belong to the same key");
  if (active.status !== "ACTIVE") lifecycleError("The source version is not active");
  if (!approval || approval.status !== "APPROVED" || !String(approval.actionType).endsWith("_ROLLBACK")) lifecycleError("A matching human rollback approval is required", "ROLLBACK_APPROVAL_REQUIRED");
  active.status = "ROLLED_BACK"; target.status = "ACTIVE"; target.activatedBy = actorId; target.activatedAt = new Date(); target.approvalId = approval._id;
  await active.save(); return target.save();
};
