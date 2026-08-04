import mongoose from "mongoose";

export const OG_CODE_PATCH_STATUSES = ["DRAFT", "REVIEW_READY", "WAITING_APPROVAL", "APPROVED", "REJECTED", "APPLYING", "APPLIED", "FAILED", "REVERTED", "SUPERSEDED"];

const patchFileSchema = new mongoose.Schema({
  path: { type: String, required: true, maxlength: 500 },
  operation: { type: String, enum: ["MODIFY", "CREATE", "RENAME", "DELETE"], required: true },
  additions: { type: Number, min: 0, default: 0 },
  deletions: { type: Number, min: 0, default: 0 },
  riskLevel: { type: String, enum: ["LOW", "MEDIUM", "HIGH"], default: "LOW" },
  requiresAdditionalApproval: { type: Boolean, default: false },
  beforeHash: { type: String, maxlength: 128, default: "" },
  proposedAfterHash: { type: String, maxlength: 128, default: "" },
  summary: { type: String, maxlength: 2000, default: "" },
}, { _id: false });

const ogCodePatchSchema = new mongoose.Schema({
  codingTaskId: { type: mongoose.Schema.Types.ObjectId, ref: "OGCodingTask", required: true, index: true },
  version: { type: Number, required: true, min: 1 },
  title: { type: String, required: true, maxlength: 200 },
  description: { type: String, maxlength: 4000, default: "" },
  status: { type: String, enum: OG_CODE_PATCH_STATUSES, default: "DRAFT", index: true },
  format: { type: String, enum: ["UNIFIED_DIFF"], default: "UNIFIED_DIFF", immutable: true },
  patchContent: { type: String, required: true },
  patchHash: { type: String, required: true, maxlength: 128, index: true },
  baseGitCommit: { type: String, required: true, maxlength: 64 },
  baseWorkingTreeHash: { type: String, required: true, maxlength: 128 },
  files: { type: [patchFileSchema], required: true },
  summary: { type: String, maxlength: 12000, default: "" },
  risks: { type: [String], default: [] },
  validationCommands: { type: [String], default: [] },
  rollbackInstructions: { type: [String], default: [] },
  generationApprovalId: { type: mongoose.Schema.Types.ObjectId, ref: "OGAgentApproval", required: true },
  applicationApprovalId: { type: mongoose.Schema.Types.ObjectId, ref: "OGAgentApproval", default: null },
  highRiskApprovalId: { type: mongoose.Schema.Types.ObjectId, ref: "OGAgentApproval", default: null },
  revertApprovalId: { type: mongoose.Schema.Types.ObjectId, ref: "OGAgentApproval", default: null },
  approvedSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },
  generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
  generatedAt: { type: Date, default: Date.now },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
  reviewedAt: { type: Date, default: null },
  appliedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
  appliedAt: { type: Date, default: null },
  applicationResult: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true, collection: "og_code_patches" });

ogCodePatchSchema.index({ codingTaskId: 1, version: 1 }, { unique: true });
ogCodePatchSchema.index({ codingTaskId: 1, createdAt: -1 });

export default mongoose.model("OGCodePatch", ogCodePatchSchema);
