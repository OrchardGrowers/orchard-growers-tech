import mongoose from "mongoose";

export const OG_AGENT_TASK_TYPES = [
  "GENERAL",
  "EMAIL_ANALYSIS",
  "GROWER_RESEARCH",
  "BUYER_RESEARCH",
  "TELECALLING_PREPARATION",
  "CODING_ANALYSIS",
  "SEO_ANALYSIS",
  "REPORT_GENERATION",
  "PUBLIC_RESEARCH",
];

export const OG_AGENT_TASK_STATUSES = [
  "DRAFT",
  "QUEUED",
  "PLANNING",
  "WAITING_APPROVAL",
  "RUNNING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
];

export const OG_AGENT_RISK_LEVELS = ["LOW", "MEDIUM", "HIGH"];
export const OG_AGENT_PLAN_STEP_STATUSES = ["PENDING", "RUNNING", "COMPLETED", "BLOCKED", "FAILED"];

const planStepSchema = new mongoose.Schema(
  {
    stepNumber: { type: Number, required: true, min: 1 },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    tool: { type: String, required: true, trim: true, maxlength: 100 },
    riskLevel: { type: String, enum: OG_AGENT_RISK_LEVELS, required: true },
    approvalRequired: { type: Boolean, default: false },
    status: { type: String, enum: OG_AGENT_PLAN_STEP_STATUSES, default: "PENDING" },
  },
  { _id: false }
);

const proposalVersionSchema = new mongoose.Schema({
  version: { type: Number, required: true, min: 1 },
  content: { type: mongoose.Schema.Types.Mixed, required: true },
  contentHash: { type: String, required: true, trim: true, maxlength: 128 },
  sourceFeedbackId: { type: mongoose.Schema.Types.ObjectId, ref: "OGAgentFeedback", default: null },
  status: { type: String, enum: ["LOCKED", "REVISION_IN_PROGRESS", "REVIEW_READY", "SUPERSEDED"], default: "LOCKED" },
  diffSummary: { type: String, trim: true, maxlength: 4000, default: "" },
  addressedFeedback: { type: [String], default: [] },
  unaddressedFeedback: { type: [String], default: [] },
  remainingRisks: { type: [String], default: [] },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
  createdAt: { type: Date, default: Date.now },
}, { _id: false });

const ogAgentTaskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 160 },
    taskType: { type: String, enum: OG_AGENT_TASK_TYPES, required: true, index: true },
    prompt: { type: String, required: true, trim: true, minlength: 10, maxlength: 12000 },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true, immutable: true, index: true },
    status: { type: String, enum: OG_AGENT_TASK_STATUSES, default: "DRAFT", index: true },
    riskLevel: { type: String, enum: OG_AGENT_RISK_LEVELS, default: "LOW", index: true },
    plan: { type: [planStepSchema], default: [] },
    result: {
      summary: { type: String, trim: true, maxlength: 12000, default: "" },
      data: { type: mongoose.Schema.Types.Mixed, default: {} },
      recommendations: { type: [String], default: [] },
    },
    failureReason: { type: String, trim: true, maxlength: 4000, default: "" },
    activeProposalVersion: { type: Number, min: 1, default: 1 },
    proposalVersions: { type: [proposalVersionSchema], default: [] },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "og_agent_tasks" }
);

ogAgentTaskSchema.index({ createdAt: -1 });
ogAgentTaskSchema.index({ requestedBy: 1, createdAt: -1 });
ogAgentTaskSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model("OGAgentTask", ogAgentTaskSchema);
