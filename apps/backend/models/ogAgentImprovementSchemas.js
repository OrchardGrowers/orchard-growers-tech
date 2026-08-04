import mongoose from "mongoose";

export const OG_AGENT_REVIEW_DECISIONS = [
  "APPROVE", "APPROVE_WITH_CONDITIONS", "REJECT", "REJECT_AND_TEACH",
  "REQUEST_REVISION", "ESCALATE_FOR_REVIEW",
];
export const OG_AGENT_ASSESSMENTS = ["CORRECT", "PARTIALLY_CORRECT", "INCORRECT", "RISKY", "NEEDS_MORE_INFORMATION"];
export const OG_AGENT_GUIDANCE_SCOPES = ["GLOBAL", "TASK_TYPE", "TOOL", "TEAM", "WORKFLOW"];
export const OG_AGENT_LIFECYCLE_STATUSES = ["DRAFT", "UNDER_REVIEW", "APPROVED", "ACTIVE", "SUPERSEDED", "ROLLED_BACK", "REJECTED", "ARCHIVED"];

export const humanImpactSchema = new mongoose.Schema({
  employees: { type: String, trim: true, maxlength: 3000, default: "" },
  growers: { type: String, trim: true, maxlength: 3000, default: "" },
  buyers: { type: String, trim: true, maxlength: 3000, default: "" },
  callers: { type: String, trim: true, maxlength: 3000, default: "" },
  administrators: { type: String, trim: true, maxlength: 3000, default: "" },
  affectedGroups: { type: [String], default: [] },
  severity: { type: String, enum: ["NONE", "LOW", "MEDIUM", "HIGH", "CRITICAL"], default: "NONE" },
}, { _id: false });

export const approvalConditionSchema = new mongoose.Schema({
  condition: { type: String, required: true, trim: true, maxlength: 1000 },
  verificationType: { type: String, enum: ["MANUAL_CONFIRMATION", "FIELD_EQUALS", "FIELD_PRESENT", "CUSTOM_REVIEW"], default: "MANUAL_CONFIRMATION" },
  field: { type: String, trim: true, maxlength: 200, default: "" },
  expectedValue: { type: mongoose.Schema.Types.Mixed, default: null },
  satisfied: { type: Boolean, default: false },
  satisfiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
  satisfiedAt: { type: Date, default: null },
}, { _id: false });

export const evidenceReferenceSchema = new mongoose.Schema({
  feedbackId: { type: mongoose.Schema.Types.ObjectId, ref: "OGAgentFeedback", default: null },
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: "OGAgentTask", default: null },
  reviewerId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
  excerpt: { type: String, trim: true, maxlength: 1000, default: "" },
}, { _id: false });
