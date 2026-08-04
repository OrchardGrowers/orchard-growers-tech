import OGCallActivity from "../../../models/OGCallActivity.js";
import OGFollowUp from "../../../models/OGFollowUp.js";

export const createFollowUp = async ({ leadId, campaignId = null, queueItemId = null, callActivityId = null, assignedTo, followUpType = "CALL", title, note = "", dueAt, priority = "NORMAL", createdBy }) => {
  const due = new Date(dueAt);
  if (!dueAt || Number.isNaN(due.getTime()) || due <= new Date()) throw Object.assign(new Error("Follow-up date must be in the future"), { statusCode: 400, code: "INVALID_FOLLOW_UP_DATE" });
  if (queueItemId) {
    const existing = await OGFollowUp.findOne({ queueItemId, status: { $in: ["PENDING", "OVERDUE"] } });
    if (existing) throw Object.assign(new Error("An active follow-up already exists for this queue item"), { statusCode: 409, code: "FOLLOW_UP_ALREADY_EXISTS" });
  }
  return OGFollowUp.create({ leadId, campaignId, queueItemId, callActivityId, assignedTo, followUpType, title: String(title || "Call follow-up").trim().slice(0, 300), note: String(note).trim().slice(0, 3000), dueAt: due, priority, createdBy });
};

export const completeFollowUp = async ({ followUpId, adminId, completionNote, outcome = "OTHER" }) => {
  if (!String(completionNote || "").trim()) throw Object.assign(new Error("Completion note is required"), { statusCode: 400, code: "VALIDATION_ERROR" });
  const followUp = await OGFollowUp.findOneAndUpdate({ _id: followUpId, status: { $in: ["PENDING", "OVERDUE"] } }, { $set: { status: "COMPLETED", completedAt: new Date(), completedBy: adminId, completionNote: String(completionNote).trim().slice(0, 3000) } }, { new: true });
  if (!followUp) throw Object.assign(new Error("Follow-up is already completed, cancelled, or unavailable"), { statusCode: 409, code: "FOLLOW_UP_ALREADY_COMPLETED" });
  await OGCallActivity.create({ campaignId: followUp.campaignId, queueItemId: followUp.queueItemId, leadId: followUp.leadId, telecallerId: adminId, activityType: "FOLLOW_UP_COMPLETED", outcome, notes: followUp.completionNote, createdBy: adminId });
  return followUp;
};

export const markOverdueFollowUps = () => OGFollowUp.updateMany({ status: "PENDING", dueAt: { $lt: new Date() } }, { $set: { status: "OVERDUE" } });
