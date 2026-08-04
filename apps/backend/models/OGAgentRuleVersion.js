import mongoose from "mongoose";
import { evidenceReferenceSchema, OG_AGENT_LIFECYCLE_STATUSES } from "./ogAgentImprovementSchemas.js";
const schema = new mongoose.Schema({
  key: { type: String, required: true, trim: true, maxlength: 120, index: true },
  version: { type: Number, required: true, min: 1 },
  rule: { type: mongoose.Schema.Types.Mixed, required: true },
  ruleHash: { type: String, required: true, maxlength: 128 },
  changeSummary: { type: String, required: true, trim: true, maxlength: 4000 },
  status: { type: String, enum: OG_AGENT_LIFECYCLE_STATUSES, default: "DRAFT", index: true },
  evidence: { type: [evidenceReferenceSchema], default: [] },
  evaluationRunIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "OGAgentEvaluationRun" }],
  approvalId: { type: mongoose.Schema.Types.ObjectId, ref: "OGAgentApproval", default: null },
  previousVersionId: { type: mongoose.Schema.Types.ObjectId, ref: "OGAgentRuleVersion", default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
  activatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
  activatedAt: { type: Date, default: null },
}, { timestamps: true, collection: "og_agent_rule_versions" });
schema.index({ key: 1, version: 1 }, { unique: true });
schema.index({ key: 1, status: 1 }, { unique: true, partialFilterExpression: { status: "ACTIVE" } });
export default mongoose.model("OGAgentRuleVersion", schema);
