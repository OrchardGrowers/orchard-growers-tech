import mongoose from "mongoose";
import { OG_AGENT_RISK_LEVELS } from "./OGAgentTask.js";
import { approvalConditionSchema, humanImpactSchema, OG_AGENT_ASSESSMENTS, OG_AGENT_REVIEW_DECISIONS } from "./ogAgentImprovementSchemas.js";

export const OG_AGENT_APPROVAL_STATUSES = ["PENDING", "APPROVED", "REJECTED", "ESCALATED", "EXPIRED"];

const ogAgentApprovalSchema = new mongoose.Schema(
  {
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: "OGAgentTask", default: null, index: true },
    subjectType: { type: String, trim: true, maxlength: 100, default: "TASK" },
    subjectId: { type: mongoose.Schema.Types.ObjectId, default: null },
    subjectKey: { type: String, trim: true, maxlength: 240, default: "" },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
    actionType: { type: String, required: true, trim: true, maxlength: 100 },
    actionTitle: { type: String, required: true, trim: true, maxlength: 200 },
    actionDescription: { type: String, required: true, trim: true, maxlength: 2000 },
    actionPreview: { type: mongoose.Schema.Types.Mixed, default: {} },
    riskLevel: { type: String, enum: OG_AGENT_RISK_LEVELS, required: true },
    status: { type: String, enum: OG_AGENT_APPROVAL_STATUSES, default: "PENDING", index: true },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
    reviewedAt: { type: Date, default: null },
    reviewerNote: { type: String, trim: true, maxlength: 2000, default: "" },
    reviewDecision: { type: String, enum: OG_AGENT_REVIEW_DECISIONS, default: undefined },
    assessment: { type: String, enum: OG_AGENT_ASSESSMENTS, default: undefined },
    humanFeedback: {
      summary: { type: String, trim: true, maxlength: 4000, default: "" },
      benefits: { type: String, trim: true, maxlength: 4000, default: "" },
      harms: { type: String, trim: true, maxlength: 4000, default: "" },
      missedContext: { type: String, trim: true, maxlength: 4000, default: "" },
      misunderstoodContext: { type: String, trim: true, maxlength: 4000, default: "" },
      correction: { type: String, trim: true, maxlength: 4000, default: "" },
      futureGuidance: { type: String, trim: true, maxlength: 4000, default: "" },
      reusable: { type: Boolean, default: false },
      guidanceScope: { type: String, default: "TASK_TYPE" },
      confidence: { type: Number, min: 0, max: 100, default: 50 },
      specialistReviewRequired: { type: Boolean, default: false },
      humanImpact: { type: humanImpactSchema, default: () => ({}) },
    },
    conditions: { type: [approvalConditionSchema], default: [] },
    proposalVersion: { type: Number, min: 1, default: 1 },
    reviewedProposalVersion: { type: Number, min: 1, default: null },
    proposalHash: { type: String, trim: true, maxlength: 128, default: "" },
    feedbackHash: { type: String, trim: true, maxlength: 128, default: "" },
    supersededByApprovalId: { type: mongoose.Schema.Types.ObjectId, ref: "OGAgentApproval", default: null },
    consumedAt: { type: Date, default: null },
    consumedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
  },
  { timestamps: true, collection: "og_agent_approvals" }
);

ogAgentApprovalSchema.index({ status: 1, createdAt: -1 });
ogAgentApprovalSchema.index({ taskId: 1, proposalVersion: -1 });
ogAgentApprovalSchema.index({ subjectKey: 1, actionType: 1, status: 1 }, { unique: true, partialFilterExpression: { status: "PENDING", subjectKey: { $type: "string" } }, name: "one_pending_og_agent_subject_approval" });

export default mongoose.model("OGAgentApproval", ogAgentApprovalSchema);
