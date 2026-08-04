import mongoose from "mongoose";
import { CALLING_PRIORITIES } from "./OGCallingCampaign.js";
const schema = new mongoose.Schema({
  leadId: { type: mongoose.Schema.Types.ObjectId, ref: "BusinessLead", required: true, index: true }, campaignId: { type: mongoose.Schema.Types.ObjectId, ref: "OGCallingCampaign", default: null, index: true }, queueItemId: { type: mongoose.Schema.Types.ObjectId, ref: "OGCallQueueItem", default: null }, callActivityId: { type: mongoose.Schema.Types.ObjectId, ref: "OGCallActivity", default: null },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true, index: true }, followUpType: { type: String, enum: ["CALL", "MANUAL_MESSAGE", "DOCUMENT_REVIEW", "MANAGER_REVIEW", "PROFILE_GUIDANCE", "OTHER"], default: "CALL" },
  title: { type: String, required: true, trim: true, maxlength: 300 }, note: { type: String, trim: true, maxlength: 3000, default: "" }, dueAt: { type: Date, required: true, index: true }, status: { type: String, enum: ["PENDING", "COMPLETED", "CANCELLED", "OVERDUE"], default: "PENDING", index: true }, priority: { type: String, enum: CALLING_PRIORITIES, default: "NORMAL" },
  completedAt: { type: Date, default: null }, completedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null }, createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true }, completionNote: { type: String, maxlength: 3000, default: "" },
}, { timestamps: true, collection: "og_follow_ups", optimisticConcurrency: true });
schema.index({ assignedTo: 1, status: 1, dueAt: 1 });
schema.index({ campaignId: 1, status: 1, dueAt: 1 });
schema.index({ queueItemId: 1, status: 1 });
schema.index({ queueItemId: 1 }, { unique: true, partialFilterExpression: { status: { $in: ["PENDING", "OVERDUE"] } }, name: "one_active_follow_up_per_queue_item" });
export default mongoose.model("OGFollowUp", schema);
