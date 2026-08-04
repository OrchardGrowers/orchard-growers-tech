import mongoose from "mongoose";
const caseSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 200 },
  input: { type: mongoose.Schema.Types.Mixed, required: true },
  expected: { type: mongoose.Schema.Types.Mixed, required: true },
  rubric: { type: [String], default: [] },
  weight: { type: Number, min: 0.1, max: 100, default: 1 },
  humanImpactTags: { type: [String], default: [] },
}, { timestamps: true });
const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, trim: true, maxlength: 4000, default: "" },
  taskType: { type: String, trim: true, maxlength: 120, default: "GENERAL", index: true },
  status: { type: String, enum: ["DRAFT", "ACTIVE", "ARCHIVED"], default: "DRAFT", index: true },
  cases: { type: [caseSchema], default: [] },
  version: { type: Number, min: 1, default: 1 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
}, { timestamps: true, collection: "og_agent_evaluation_datasets" });
export default mongoose.model("OGAgentEvaluationDataset", schema);
