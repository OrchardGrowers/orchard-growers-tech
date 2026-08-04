import mongoose from "mongoose";
const resultSchema = new mongoose.Schema({
  caseId: { type: mongoose.Schema.Types.ObjectId, required: true },
  passed: { type: Boolean, required: true },
  score: { type: Number, min: 0, max: 100, required: true },
  explanation: { type: String, trim: true, maxlength: 4000, default: "" },
  humanImpactFlags: { type: [String], default: [] },
}, { _id: false });
const schema = new mongoose.Schema({
  datasetId: { type: mongoose.Schema.Types.ObjectId, ref: "OGAgentEvaluationDataset", required: true, index: true },
  targetType: { type: String, enum: ["PROMPT", "RULE", "WORKFLOW"], required: true },
  targetVersionId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  baselineVersionId: { type: mongoose.Schema.Types.ObjectId, default: null },
  status: { type: String, enum: ["QUEUED", "RUNNING", "COMPLETED", "FAILED", "CANCELLED"], default: "QUEUED", index: true },
  results: { type: [resultSchema], default: [] },
  aggregateScore: { type: Number, min: 0, max: 100, default: 0 },
  baselineScore: { type: Number, min: 0, max: 100, default: null },
  regressionDetected: { type: Boolean, default: false },
  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  failureReason: { type: String, trim: true, maxlength: 4000, default: "" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
}, { timestamps: true, collection: "og_agent_evaluation_runs" });
schema.index({ status: 1, createdAt: -1 });
export default mongoose.model("OGAgentEvaluationRun", schema);
