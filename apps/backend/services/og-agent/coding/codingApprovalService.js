import crypto from "node:crypto";
import OGAgentApproval from "../../../models/OGAgentApproval.js";
import { assertApprovalConditionsSatisfied } from "../improvement/feedbackValidationService.js";

const snapshotHash = (value) => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");

export const createCodingApproval = async ({ codingTask, actorId, actionType, actionTitle, actionDescription, riskLevel, preview }) => {
  const actionPreview = { ...preview, codingTaskId: String(codingTask._id), snapshotHash: snapshotHash(preview) };
  return OGAgentApproval.findOneAndUpdate(
    { taskId: codingTask.taskId, actionType, status: "PENDING" },
    { $setOnInsert: { taskId: codingTask.taskId, subjectType: "CODING_TASK", subjectId: codingTask._id, subjectKey: `CODING_TASK:${codingTask._id}:${actionType}`, requestedBy: actorId, actionType, actionTitle, actionDescription, actionPreview, riskLevel, status: "PENDING" } },
    { upsert: true, new: true, runValidators: true }
  );
};

export const requireApprovedCodingApproval = async ({ approvalId, codingTask, actionType, expectedPreview = null, consume = false, actorId }) => {
  const approval = await OGAgentApproval.findOne({ _id: approvalId, taskId: codingTask.taskId, actionType });
  if (!approval || approval.status !== "APPROVED") throw Object.assign(new Error("The exact Coding Agent approval is missing or not approved"), { statusCode: 409, code: "CODING_APPROVAL_REQUIRED" });
  if (approval.consumedAt) throw Object.assign(new Error("This Coding Agent approval has already been consumed"), { statusCode: 409, code: "APPROVAL_ALREADY_CONSUMED" });
  assertApprovalConditionsSatisfied(approval, expectedPreview || {});
  if (expectedPreview && approval.actionPreview?.snapshotHash !== snapshotHash(expectedPreview)) throw Object.assign(new Error("Approval snapshot no longer matches the requested action"), { statusCode: 409, code: "APPROVAL_SNAPSHOT_CHANGED" });
  if (consume) {
    const consumed = await OGAgentApproval.findOneAndUpdate({ _id: approval._id, status: "APPROVED", consumedAt: null }, { $set: { consumedAt: new Date(), consumedBy: actorId } }, { new: true });
    if (!consumed) throw Object.assign(new Error("Approval was consumed concurrently"), { statusCode: 409, code: "APPROVAL_ALREADY_CONSUMED" });
    return consumed;
  }
  return approval;
};
