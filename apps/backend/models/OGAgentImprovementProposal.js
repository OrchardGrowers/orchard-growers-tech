import mongoose from "mongoose";
import { evidenceReferenceSchema, humanImpactSchema, OG_AGENT_LIFECYCLE_STATUSES } from "./ogAgentImprovementSchemas.js";
const schema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 240 },
  proposalType: { type: String, enum: ["PROMPT", "RULE", "WORKFLOW", "GUIDANCE", "RETRIEVAL"], required: true, index: true },
  targetKey: { type: String, required: true, trim: true, maxlength: 160 },
  problemStatement: { type: String, required: true, trim: true, maxlength: 8000 },
  proposedChange: { type: mongoose.Schema.Types.Mixed, required: true },
  evidence: { type: [evidenceReferenceSchema], default: [] },
  relatedFeedbackCount: { type: Number, min: 0, default: 0 },
  distinctReviewerCount: { type: Number, min: 0, default: 0 },
  distinctTaskCount: { type: Number, min: 0, default: 0 },
  severity: { type: String, enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"], default: "LOW" },
  humanImpact: { type: humanImpactSchema, default: () => ({}) },
  conflicts: { type: [mongoose.Schema.Types.Mixed], default: [] },
  status: { type: String, enum: OG_AGENT_LIFECYCLE_STATUSES, default: "DRAFT", index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
  approvalId: { type: mongoose.Schema.Types.ObjectId, ref: "OGAgentApproval", default: null },
}, { timestamps: true, collection: "og_agent_improvement_proposals" });
schema.index({ status: 1, severity: -1, createdAt: -1 });
export default mongoose.model("OGAgentImprovementProposal", schema);
