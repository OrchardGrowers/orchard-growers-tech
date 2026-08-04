import mongoose from "mongoose";

const ogCodeCommandRunSchema = new mongoose.Schema({
  codingTaskId: { type: mongoose.Schema.Types.ObjectId, ref: "OGCodingTask", required: true, index: true },
  patchId: { type: mongoose.Schema.Types.ObjectId, ref: "OGCodePatch", default: null, index: true },
  commandId: { type: String, required: true, maxlength: 100 },
  commandLabel: { type: String, required: true, maxlength: 200 },
  executable: { type: String, required: true, maxlength: 200 },
  arguments: { type: [String], default: [] },
  workingDirectory: { type: String, required: true, maxlength: 500 },
  commandCategory: { type: String, enum: ["STATUS", "SEARCH", "LINT", "TYPECHECK", "TEST", "BUILD", "FORMAT_CHECK", "DIFF_CHECK"], required: true },
  status: { type: String, enum: ["QUEUED", "RUNNING", "COMPLETED", "FAILED", "TIMEOUT", "CANCELLED", "BLOCKED"], default: "QUEUED", index: true },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
  approvalId: { type: mongoose.Schema.Types.ObjectId, ref: "OGAgentApproval", default: null },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  exitCode: { type: Number, default: null },
  stdoutPreview: { type: String, default: "" },
  stderrPreview: { type: String, default: "" },
  timedOut: { type: Boolean, default: false },
  blockedReason: { type: String, maxlength: 2000, default: "" },
  resultClassification: { type: String, enum: ["NOT_RUN", "PASSED", "FAILED", "TIMED_OUT", "BLOCKED", "CANCELLED"], default: "NOT_RUN" },
  failureAttribution: { type: String, enum: ["NOT_APPLICABLE", "INTRODUCED", "PRE_EXISTING", "UNRESOLVED", "INSUFFICIENT_EVIDENCE"], default: "NOT_APPLICABLE" },
  cancellationRequestedAt: { type: Date, default: null },
  idempotencyKey: { type: String, maxlength: 200, default: "" },
}, { timestamps: true, collection: "og_code_command_runs" });

ogCodeCommandRunSchema.index({ codingTaskId: 1, createdAt: -1 });
ogCodeCommandRunSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });

export default mongoose.model("OGCodeCommandRun", ogCodeCommandRunSchema);
