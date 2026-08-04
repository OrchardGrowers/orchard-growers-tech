import Admin from "../../../models/Admin.js";
import OGCallActivity from "../../../models/OGCallActivity.js";
import OGCallingCampaign from "../../../models/OGCallingCampaign.js";
import OGCallQueueItem from "../../../models/OGCallQueueItem.js";

const conflict = (message, code) => Object.assign(new Error(message), { statusCode: 409, code });
export const claimQueueItem = async ({ queueItemId, adminId, lockMinutes = 15, assignIfUnassigned = false }) => {
  const now = new Date(); const expires = new Date(now.getTime() + lockMinutes * 60000);
  const item = await OGCallQueueItem.findOneAndUpdate({ _id: queueItemId, status: { $in: ["PENDING", "IN_PROGRESS", "FOLLOW_UP_REQUIRED"] }, $or: [{ lockedBy: null }, { lockedBy: adminId }, { lockExpiresAt: { $lte: now } }] }, { $set: { lockedBy: adminId, lockedAt: now, lockExpiresAt: expires, status: "IN_PROGRESS", ...(assignIfUnassigned ? { assignedTo: adminId, assignedBy: adminId } : {}) } }, { new: true });
  if (!item) throw conflict("Queue item is already claimed, unavailable, or completed", "QUEUE_ALREADY_CLAIMED");
  return item;
};

export const releaseQueueItem = async ({ queueItemId, adminId, override = false }) => {
  const filter = { _id: queueItemId, ...(override ? {} : { lockedBy: adminId }) };
  const item = await OGCallQueueItem.findOneAndUpdate(filter, { $set: { lockedBy: null, lockedAt: null, lockExpiresAt: null } }, { new: true });
  if (!item) throw conflict("Queue lock is not owned by this telecaller", "QUEUE_LOCK_NOT_OWNED");
  if (item.status === "IN_PROGRESS") { item.status = "PENDING"; await item.save(); }
  return item;
};

export const startManualCall = async ({ item, adminId }) => {
  if (String(item.lockedBy || "") !== String(adminId) || !item.lockExpiresAt || item.lockExpiresAt <= new Date()) throw conflict("Claim this queue item before opening the manual call workspace", "QUEUE_LOCK_REQUIRED");
  const campaign = await OGCallingCampaign.findById(item.campaignId).select("status").lean();
  if (!campaign || campaign.status !== "ACTIVE") throw conflict("Campaign is not active", "CAMPAIGN_NOT_ACTIVE");
  return OGCallActivity.create({ campaignId: item.campaignId, queueItemId: item._id, leadId: item.leadId, telecallerId: adminId, activityType: "CALL_STARTED_MANUALLY", summary: "Telecaller confirmed opening the manual calling workspace. No call connection was detected or claimed.", createdBy: adminId });
};

export const skipQueueItem = async ({ item, adminId, reason }) => {
  if (!String(reason || "").trim()) throw Object.assign(new Error("Skip reason is required"), { statusCode: 400, code: "VALIDATION_ERROR" });
  item.status = "SKIPPED"; item.completionReason = String(reason).trim().slice(0, 1000); item.lockedBy = null; item.lockedAt = null; item.lockExpiresAt = null; await item.save();
  await OGCallActivity.create({ campaignId: item.campaignId, queueItemId: item._id, leadId: item.leadId, telecallerId: adminId, activityType: "QUEUE_ITEM_SKIPPED", notes: item.completionReason, createdBy: adminId });
  return item;
};

export const reassignQueueItem = async ({ item, assignedTo, actorId }) => {
  const admin = await Admin.findOne({ _id: assignedTo, status: "ACTIVE", role: { $in: ["SUPER_ADMIN", "ADMIN", "SUPPORT_EXECUTIVE", "SALES_EXECUTIVE"] } }).select("_id").lean();
  if (!admin) throw Object.assign(new Error("Assigned telecaller is inactive or unauthorized"), { statusCode: 400, code: "INVALID_TELECALLER" });
  if (item.lockedBy && item.lockExpiresAt > new Date()) throw conflict("Release the active queue lock before reassignment", "QUEUE_ALREADY_CLAIMED");
  const previous = item.assignedTo; item.assignedTo = assignedTo; item.assignedBy = actorId; await item.save();
  await OGCallActivity.create({ campaignId: item.campaignId, queueItemId: item._id, leadId: item.leadId, telecallerId: actorId, activityType: "ASSIGNMENT_CHANGED", notes: `Assignment changed from ${previous || "unassigned"} to ${assignedTo}.`, createdBy: actorId });
  return item;
};

export const canAccessQueueItem = (item, admin, canViewAll = false) => canViewAll || !item.assignedTo || String(item.assignedTo) === String(admin._id);
