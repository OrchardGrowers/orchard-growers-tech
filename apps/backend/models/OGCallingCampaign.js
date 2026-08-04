import mongoose from "mongoose";
import { BUSINESS_LEAD_STATUSES, BUSINESS_LEAD_TYPES } from "./BusinessLead.js";

export const CALLING_CAMPAIGN_PURPOSES = ["GROWER_ONBOARDING", "BUYER_ONBOARDING", "LEAD_QUALIFICATION", "PROFILE_VERIFICATION", "PLATFORM_INTRODUCTION", "FOLLOW_UP", "CANDIDATE_SCREENING", "INVESTOR_OUTREACH_PREPARATION", "LOGISTICS_PARTNER_ONBOARDING", "FEEDBACK_COLLECTION", "OTHER"];
export const CALLING_CAMPAIGN_STATUSES = ["DRAFT", "ACTIVE", "PAUSED", "COMPLETED", "CANCELLED", "ARCHIVED"];
export const CALLING_LANGUAGES = ["HINDI", "ENGLISH", "HINGLISH", "LOCAL_LANGUAGE", "AUTO_SUGGEST"];
export const CALLING_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"];
export const CALLING_ASSIGNMENT_STRATEGIES = ["MANUAL", "ROUND_ROBIN", "EQUAL_DISTRIBUTION", "UNASSIGNED_QUEUE"];

const campaignSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 180 },
  description: { type: String, trim: true, maxlength: 3000, default: "" },
  purpose: { type: String, enum: CALLING_CAMPAIGN_PURPOSES, required: true, index: true },
  leadTypes: { type: [{ type: String, enum: BUSINESS_LEAD_TYPES }], default: [] },
  filters: {
    states: { type: [String], default: [] }, districts: { type: [String], default: [] }, fruits: { type: [String], default: [] },
    leadStatuses: { type: [{ type: String, enum: BUSINESS_LEAD_STATUSES }], default: [] }, sourceTypes: { type: [String], default: [] },
    minimumConfidence: { type: Number, min: 0, max: 100, default: 0 }, maximumConfidence: { type: Number, min: 0, max: 100, default: 100 },
    tags: { type: [String], default: [] }, importedFrom: { type: Date, default: null }, createdFrom: { type: Date, default: null }, createdTo: { type: Date, default: null },
  },
  preferredLanguage: { type: String, enum: CALLING_LANGUAGES, default: "AUTO_SUGGEST" },
  defaultPriority: { type: String, enum: CALLING_PRIORITIES, default: "NORMAL" },
  assignmentStrategy: { type: String, enum: CALLING_ASSIGNMENT_STRATEGIES, default: "UNASSIGNED_QUEUE" },
  status: { type: String, enum: CALLING_CAMPAIGN_STATUSES, default: "DRAFT", index: true },
  assignedTelecallers: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Admin" }], default: [] },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
  targetLeadCount: { type: Number, min: 0, default: 0 }, addedLeadCount: { type: Number, min: 0, default: 0 },
  pendingCount: { type: Number, min: 0, default: 0 }, completedCount: { type: Number, min: 0, default: 0 }, followUpCount: { type: Number, min: 0, default: 0 },
  interestedCount: { type: Number, min: 0, default: 0 }, notInterestedCount: { type: Number, min: 0, default: 0 }, invalidCount: { type: Number, min: 0, default: 0 }, noAnswerCount: { type: Number, min: 0, default: 0 },
  startedAt: { type: Date, default: null }, completedAt: { type: Date, default: null }, archivedAt: { type: Date, default: null },
}, { timestamps: true, collection: "og_calling_campaigns", optimisticConcurrency: true });

campaignSchema.index({ status: 1, createdAt: -1 });
campaignSchema.index({ assignedTelecallers: 1, status: 1 });
export default mongoose.model("OGCallingCampaign", campaignSchema);
