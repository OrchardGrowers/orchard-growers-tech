import mongoose from "mongoose";
import { CALLING_PRIORITIES } from "./OGCallingCampaign.js";

export const CALL_QUEUE_STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED", "FOLLOW_UP_REQUIRED", "SKIPPED", "INVALID", "DO_NOT_CONTACT", "CANCELLED"];
const schema = new mongoose.Schema({
  campaignId: { type: mongoose.Schema.Types.ObjectId, ref: "OGCallingCampaign", required: true, index: true },
  leadId: { type: mongoose.Schema.Types.ObjectId, ref: "BusinessLead", required: true, index: true },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null, index: true }, assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
  status: { type: String, enum: CALL_QUEUE_STATUSES, default: "PENDING", index: true }, priority: { type: String, enum: CALLING_PRIORITIES, default: "NORMAL", index: true },
  sequenceNumber: { type: Number, min: 1, required: true }, attemptCount: { type: Number, min: 0, default: 0 }, lastAttemptAt: { type: Date, default: null }, nextFollowUpAt: { type: Date, default: null, index: true },
  lockedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null }, lockedAt: { type: Date, default: null }, lockExpiresAt: { type: Date, default: null, index: true },
  completionReason: { type: String, trim: true, maxlength: 1000, default: "" }, createdFrom: { type: String, enum: ["CAMPAIGN", "MANUAL", "FOLLOW_UP", "OG_AGENT"], default: "CAMPAIGN" },
}, { timestamps: true, collection: "og_call_queue_items", optimisticConcurrency: true });
schema.index({ campaignId: 1, status: 1, sequenceNumber: 1 });
schema.index({ assignedTo: 1, status: 1, priority: -1 });
schema.index({ campaignId: 1, leadId: 1 }, { unique: true, partialFilterExpression: { status: { $in: ["PENDING", "IN_PROGRESS", "FOLLOW_UP_REQUIRED"] } }, name: "one_active_campaign_queue_item_per_lead" });
export default mongoose.model("OGCallQueueItem", schema);
