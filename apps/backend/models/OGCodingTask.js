import mongoose from "mongoose";

export const OG_CODING_TASK_CATEGORIES = [
  "BUG_FIX", "FEATURE", "REFACTOR", "PERFORMANCE", "SECURITY_REVIEW", "SEO", "UI_UX",
  "API", "DATABASE_ANALYSIS", "TESTING", "DOCUMENTATION", "BUILD_ERROR", "OTHER",
];
export const OG_CODING_TARGET_APPLICATIONS = [
  "BACKEND", "EFRUITMANDI_FRONTEND", "ADMIN_PANEL", "SHARED_PACKAGE", "DOCUMENTATION", "MULTIPLE",
];
export const OG_CODING_ANALYSIS_STATUSES = ["NOT_STARTED", "DISCOVERING", "ANALYZING", "REVIEW_READY", "FAILED"];
export const OG_CODING_PATCH_STATUSES = [
  "NOT_REQUESTED", "WAITING_APPROVAL", "GENERATING", "REVIEW_READY", "APPROVED", "REJECTED",
  "APPLYING", "APPLIED", "FAILED", "REVERTED",
];
export const OG_CODING_VALIDATION_STATUSES = ["NOT_RUN", "WAITING_APPROVAL", "RUNNING", "PASSED", "FAILED", "PARTIAL"];

const relevantFileSchema = new mongoose.Schema({
  path: { type: String, required: true, maxlength: 500 },
  reason: { type: String, required: true, maxlength: 2000 },
  readStatus: { type: String, enum: ["NOT_READ", "READ", "BLOCKED", "CHANGED"], default: "NOT_READ" },
  riskLevel: { type: String, enum: ["LOW", "MEDIUM", "HIGH"], default: "LOW" },
  contentHash: { type: String, maxlength: 128, default: "" },
}, { _id: false });

const analysisSchema = new mongoose.Schema({
  problemRestatement: { type: String, maxlength: 12000, default: "" },
  summary: { type: String, maxlength: 12000, default: "" },
  currentBehavior: { type: String, maxlength: 12000, default: "" },
  rootCause: { type: String, maxlength: 12000, default: "" },
  confidence: { type: String, enum: ["CONFIRMED", "HIGHLY_LIKELY", "POSSIBLE", "NOT_VERIFIED"], default: "NOT_VERIFIED" },
  supportingEvidence: { type: [String], default: [] },
  assumptions: { type: [String], default: [] },
  affectedFlows: { type: [String], default: [] },
  implementationPlan: { type: [String], default: [] },
  filesExpectedToChange: { type: [String], default: [] },
  filesNotToChange: { type: [String], default: [] },
  risks: { type: [String], default: [] },
  testPlan: { type: [String], default: [] },
  rollbackPlan: { type: [String], default: [] },
  impacts: {
    apiCompatibility: { type: String, maxlength: 4000, default: "Not verified" },
    database: { type: String, maxlength: 4000, default: "Not verified" },
    uiUx: { type: String, maxlength: 4000, default: "Not verified" },
    security: { type: String, maxlength: 4000, default: "Not verified" },
    performance: { type: String, maxlength: 4000, default: "Not verified" },
  },
  unresolvedQuestions: { type: [String], default: [] },
}, { _id: false });

const ogCodingTaskSchema = new mongoose.Schema({
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: "OGAgentTask", required: true, unique: true, index: true },
  taskCategory: { type: String, enum: OG_CODING_TASK_CATEGORIES, required: true, index: true },
  targetApplications: { type: [String], enum: OG_CODING_TARGET_APPLICATIONS, required: true },
  repositoryRoot: { type: String, required: true, maxlength: 500 },
  allowedPaths: { type: [String], required: true },
  deniedPaths: { type: [String], default: [] },
  fileHints: { type: [String], default: [] },
  currentBehavior: { type: String, maxlength: 12000, default: "" },
  expectedBehavior: { type: String, required: true, maxlength: 12000 },
  reproductionSteps: { type: String, maxlength: 12000, default: "" },
  constraints: { type: [String], default: [] },
  allowRepositoryAnalysis: { type: Boolean, default: true },
  allowPatchGeneration: { type: Boolean, default: false },
  allowPatchApplication: { type: Boolean, default: false },
  allowSafeCommands: { type: Boolean, default: false },
  highRiskAcknowledged: { type: Boolean, default: false },
  riskLevel: { type: String, enum: ["LOW", "MEDIUM", "HIGH"], default: "LOW", index: true },
  status: { type: String, enum: ["OPEN", "ANALYZING", "REVIEW_READY", "PATCH_REVIEW", "APPLIED", "COMPLETED", "FAILED", "CANCELLED"], default: "OPEN", index: true },
  analysisStatus: { type: String, enum: OG_CODING_ANALYSIS_STATUSES, default: "NOT_STARTED" },
  patchStatus: { type: String, enum: OG_CODING_PATCH_STATUSES, default: "NOT_REQUESTED" },
  validationStatus: { type: String, enum: OG_CODING_VALIDATION_STATUSES, default: "NOT_RUN" },
  relevantFiles: { type: [relevantFileSchema], default: [] },
  repositoryFindings: { type: mongoose.Schema.Types.Mixed, default: {} },
  analysis: { type: analysisSchema, default: () => ({}) },
  approvedPatchId: { type: mongoose.Schema.Types.ObjectId, ref: "OGCodePatch", default: null },
  workingTreeStateBefore: { type: mongoose.Schema.Types.Mixed, default: {} },
  workingTreeStateAfter: { type: mongoose.Schema.Types.Mixed, default: {} },
  totalReadBytes: { type: Number, min: 0, default: 0 },
  operationLock: { type: String, enum: ["NONE", "ANALYSIS", "PATCH_GENERATION", "PATCH_APPLY", "PATCH_REVERT", "VALIDATION"], default: "NONE" },
  lockExpiresAt: { type: Date, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true, immutable: true },
  cancelledAt: { type: Date, default: null },
}, { timestamps: true, collection: "og_coding_tasks" });

ogCodingTaskSchema.index({ status: 1, createdAt: -1 });
ogCodingTaskSchema.index({ createdBy: 1, createdAt: -1 });

export default mongoose.model("OGCodingTask", ogCodingTaskSchema);
