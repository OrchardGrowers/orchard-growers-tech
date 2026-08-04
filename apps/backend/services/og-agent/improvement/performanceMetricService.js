import OGAgentFeedback from "../../../models/OGAgentFeedback.js";
import OGAgentPerformanceMetric from "../../../models/OGAgentPerformanceMetric.js";

export const calculateFeedbackMetrics = async ({ periodStart, periodEnd, taskType = "ALL" }) => {
  const match = { createdAt: { $gte: periodStart, $lt: periodEnd }, supersededByFeedbackId: null };
  const rows = await OGAgentFeedback.find(match).populate("taskId", "taskType").lean();
  const filtered = taskType === "ALL" ? rows : rows.filter((item) => item.taskId?.taskType === taskType);
  const approved = filtered.filter((item) => ["APPROVE", "APPROVE_WITH_CONDITIONS"].includes(item.reviewDecision)).length;
  const risky = filtered.filter((item) => item.assessment === "RISKY").length;
  const metrics = [
    ["human_approval_rate", filtered.length ? approved / filtered.length : 0],
    ["risky_assessment_rate", filtered.length ? risky / filtered.length : 0],
    ["revision_request_rate", filtered.length ? filtered.filter((item) => item.reviewDecision === "REQUEST_REVISION").length / filtered.length : 0],
  ];
  return Promise.all(metrics.map(([metricKey, value]) => OGAgentPerformanceMetric.create({ metricKey, taskType, periodStart, periodEnd, sampleSize: filtered.length, value, trend: "UNKNOWN" })));
};
