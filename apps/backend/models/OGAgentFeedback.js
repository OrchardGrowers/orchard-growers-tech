import mongoose from "mongoose";
import { humanImpactSchema, OG_AGENT_ASSESSMENTS, OG_AGENT_GUIDANCE_SCOPES, OG_AGENT_REVIEW_DECISIONS } from "./ogAgentImprovementSchemas.js";

const schema = new mongoose.Schema({
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: "OGAgentTask", required: true, index: true },
  approvalId: { type: mongoose.Schema.Types.ObjectId, ref: "OGAgentApproval", default: null, index: true },
  reviewerId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true, index: true },
  reviewDecision: { type: String, enum: OG_AGENT_REVIEW_DECISIONS, required: true },
  assessment: { type: String, enum: OG_AGENT_ASSESSMENTS, required: true },
  summary: { type: String, required: true, trim: true, maxlength: 4000 },
  benefits: { type: String, trim: true, maxlength: 4000, default: "" },
  harms: { type: String, trim: true, maxlength: 4000, default: "" },
  missedContext: { type: String, trim: true, maxlength: 4000, default: "" },
  misunderstoodContext: { type: String, trim: true, maxlength: 4000, default: "" },
  correction: { type: String, trim: true, maxlength: 4000, default: "" },
  futureGuidance: { type: String, trim: true, maxlength: 4000, default: "" },
  humanImpact: { type: humanImpactSchema, default: () => ({}) },
  reusable: { type: Boolean, default: false },
  guidanceScope: { type: String, enum: OG_AGENT_GUIDANCE_SCOPES, default: "TASK_TYPE" },
  confidence: { type: Number, min: 0, max: 100, default: 50 },
  specialistReviewRequired: { type: Boolean, default: false },
  proposalVersion: { type: Number, min: 1, required: true },
  proposalHash: { type: String, required: true, trim: true, maxlength: 128 },
  feedbackHash: { type: String, required: true, trim: true, maxlength: 128, unique: true },
  supersedesFeedbackId: { type: mongoose.Schema.Types.ObjectId, ref: "OGAgentFeedback", default: null },
  supersededByFeedbackId: { type: mongoose.Schema.Types.ObjectId, ref: "OGAgentFeedback", default: null },
  redactionApplied: { type: Boolean, default: false },
  withdrawnAt: { type: Date, default: null },
  withdrawnBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
}, { timestamps: true, collection: "og_agent_feedback" });
schema.index({ taskId: 1, proposalVersion: -1, createdAt: -1 });
schema.index({ assessment: 1, createdAt: -1 });
export default mongoose.model("OGAgentFeedback", schema);
