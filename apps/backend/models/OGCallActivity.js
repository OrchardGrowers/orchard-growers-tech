import mongoose from "mongoose";
import { CALLING_LANGUAGES } from "./OGCallingCampaign.js";

export const CALL_OUTCOMES = ["CONNECTED_INTERESTED", "CONNECTED_NEEDS_INFORMATION", "CONNECTED_CALL_LATER", "CONNECTED_NOT_INTERESTED", "NO_ANSWER", "BUSY", "SWITCHED_OFF", "OUT_OF_COVERAGE", "WRONG_NUMBER", "LANGUAGE_BARRIER", "ALREADY_REGISTERED", "DUPLICATE_CONTACT", "DO_NOT_CONTACT", "OTHER"];
export const CALL_ACTIVITY_TYPES = ["CALL_STARTED_MANUALLY", "CALL_OUTCOME_RECORDED", "NOTE_ADDED", "FOLLOW_UP_SCHEDULED", "FOLLOW_UP_UPDATED", "FOLLOW_UP_COMPLETED", "LEAD_INFORMATION_VERIFIED", "WRONG_NUMBER_REPORTED", "DO_NOT_CONTACT_RECORDED", "QUEUE_ITEM_SKIPPED", "ASSIGNMENT_CHANGED"];
const schema = new mongoose.Schema({
  campaignId: { type: mongoose.Schema.Types.ObjectId, ref: "OGCallingCampaign", default: null, index: true }, queueItemId: { type: mongoose.Schema.Types.ObjectId, ref: "OGCallQueueItem", default: null, index: true },
  leadId: { type: mongoose.Schema.Types.ObjectId, ref: "BusinessLead", required: true, index: true }, telecallerId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true, index: true },
  activityType: { type: String, enum: CALL_ACTIVITY_TYPES, required: true, index: true }, outcome: { type: String, enum: CALL_OUTCOMES, default: null, index: true },
  idempotencyKey: { type: String, trim: true, maxlength: 200, default: undefined }, manuallyEnteredDurationSeconds: { type: Number, min: 0, max: 43200, default: 0 },
  notes: { type: String, trim: true, maxlength: 5000, default: "" }, summary: { type: String, trim: true, maxlength: 1500, default: "" }, interestLevel: { type: String, enum: ["UNKNOWN", "LOW", "MEDIUM", "HIGH"], default: "UNKNOWN" },
  verifiedFields: { name: Boolean, businessName: Boolean, leadType: Boolean, phone: Boolean, email: Boolean, state: Boolean, district: Boolean, fruits: Boolean, businessVolume: Boolean },
  correctedFields: { type: mongoose.Schema.Types.Mixed, default: {} }, leadStatusChange: { previous: String, next: String, reason: String },
  nextAction: { type: String, enum: ["NONE", "CALL_BACK", "SEND_INFORMATION_MANUALLY", "MANAGER_REVIEW", "PROFILE_REGISTRATION_GUIDANCE", "VERIFY_DATA", "MARK_INVALID", "DO_NOT_CONTACT", "OTHER"], default: "NONE" },
  followUpAt: { type: Date, default: null }, preferredCallbackWindow: { type: String, trim: true, maxlength: 200, default: "" }, preferredLanguage: { type: String, enum: CALLING_LANGUAGES, default: "AUTO_SUGGEST" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
}, { timestamps: true, collection: "og_call_activities" });
schema.index({ leadId: 1, createdAt: -1 });
schema.index({ campaignId: 1, outcome: 1, createdAt: -1 });
schema.index({ queueItemId: 1, idempotencyKey: 1 }, { unique: true, sparse: true });
export default mongoose.model("OGCallActivity", schema);
