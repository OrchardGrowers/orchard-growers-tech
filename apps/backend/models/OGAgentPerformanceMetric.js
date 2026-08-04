import mongoose from "mongoose";
const schema = new mongoose.Schema({
  metricKey: { type: String, required: true, trim: true, maxlength: 160, index: true },
  taskType: { type: String, trim: true, maxlength: 120, default: "ALL", index: true },
  periodStart: { type: Date, required: true },
  periodEnd: { type: Date, required: true },
  sampleSize: { type: Number, min: 0, default: 0 },
  value: { type: Number, required: true },
  previousValue: { type: Number, default: null },
  trend: { type: String, enum: ["IMPROVING", "STABLE", "DECLINING", "UNKNOWN"], default: "UNKNOWN" },
  dimensions: { type: mongoose.Schema.Types.Mixed, default: {} },
  humanImpact: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true, collection: "og_agent_performance_metrics" });
schema.index({ metricKey: 1, taskType: 1, periodEnd: -1 });
export default mongoose.model("OGAgentPerformanceMetric", schema);
