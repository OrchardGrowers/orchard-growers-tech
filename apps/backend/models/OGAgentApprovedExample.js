import mongoose from "mongoose";
import { humanImpactSchema, OG_AGENT_GUIDANCE_SCOPES, OG_AGENT_LIFECYCLE_STATUSES } from "./ogAgentImprovementSchemas.js";
const schema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 200 },
  taskType: { type: String, required: true, trim: true, index: true },
  scope: { type: String, enum: OG_AGENT_GUIDANCE_SCOPES, default: "TASK_TYPE" },
  sourceTaskId: { type: mongoose.Schema.Types.ObjectId, ref: "OGAgentTask", required: true },
  sourceFeedbackId: { type: mongoose.Schema.Types.ObjectId, ref: "OGAgentFeedback", required: true },
  inputSummary: { type: String, required: true, trim: true, maxlength: 6000 },
  approvedOutput: { type: mongoose.Schema.Types.Mixed, required: true },
  rationale: { type: String, trim: true, maxlength: 4000, default: "" },
  humanImpact: { type: humanImpactSchema, default: () => ({}) },
  priority: { type: Number, min: 0, max: 100, default: 50 },
  status: { type: String, enum: OG_AGENT_LIFECYCLE_STATUSES, default: "DRAFT", index: true },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
  reviewedAt: { type: Date, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
}, { timestamps: true, collection: "og_agent_approved_examples" });
schema.index({ status: 1, taskType: 1, priority: -1 });
export default mongoose.model("OGAgentApprovedExample", schema);
