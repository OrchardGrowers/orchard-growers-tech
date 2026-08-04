import mongoose from "mongoose";
import { evidenceReferenceSchema, humanImpactSchema, OG_AGENT_GUIDANCE_SCOPES, OG_AGENT_LIFECYCLE_STATUSES } from "./ogAgentImprovementSchemas.js";
const schema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 200 },
  guidance: { type: String, required: true, trim: true, maxlength: 12000 },
  scope: { type: String, enum: OG_AGENT_GUIDANCE_SCOPES, required: true, index: true },
  scopeValue: { type: String, trim: true, maxlength: 200, default: "" },
  priority: { type: Number, min: 0, max: 100, default: 50 },
  status: { type: String, enum: OG_AGENT_LIFECYCLE_STATUSES, default: "DRAFT", index: true },
  evidence: { type: [evidenceReferenceSchema], default: [] },
  conflictsWith: [{ type: mongoose.Schema.Types.ObjectId, ref: "OGAgentOrganizationalGuidance" }],
  humanImpact: { type: humanImpactSchema, default: () => ({}) },
  securityApproved: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
  activatedAt: { type: Date, default: null },
}, { timestamps: true, collection: "og_agent_organizational_guidance" });
schema.index({ status: 1, scope: 1, scopeValue: 1, priority: -1 });
export default mongoose.model("OGAgentOrganizationalGuidance", schema);
