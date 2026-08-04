import OGAgentFeedback from "../../../models/OGAgentFeedback.js";
import OGAgentImprovementProposal from "../../../models/OGAgentImprovementProposal.js";

export const collectProposalEvidence = async ({ assessment, taskType, minimumFeedback = 5, minimumReviewers = 2, minimumTasks = 2, severity = "LOW" }) => {
  const query = { supersededByFeedbackId: null, withdrawnAt: null };
  if (assessment) query.assessment = assessment;
  const feedback = await OGAgentFeedback.find(query).populate("taskId", "taskType").sort({ createdAt: -1 }).limit(100).lean();
  const related = feedback.filter((item) => !taskType || item.taskId?.taskType === taskType);
  const reviewers = new Set(related.map((item) => String(item.reviewerId)));
  const tasks = new Set(related.map((item) => String(item.taskId?._id || item.taskId)));
  const urgent = ["HIGH", "CRITICAL"].includes(severity);
  return { evidence: related.map((item) => ({ feedbackId: item._id, taskId: item.taskId?._id || item.taskId, reviewerId: item.reviewerId, excerpt: item.summary })), relatedFeedbackCount: related.length, distinctReviewerCount: reviewers.size, distinctTaskCount: tasks.size, eligible: urgent ? related.length >= 1 : related.length >= minimumFeedback && reviewers.size >= minimumReviewers && tasks.size >= minimumTasks };
};

export const createEvidenceBackedProposal = async ({ input, actorId, thresholds = {} }) => {
  const evidence = await collectProposalEvidence({ assessment: input.assessment, taskType: input.taskType, severity: input.severity, ...thresholds });
  if (!evidence.eligible) { const error = new Error("The evidence threshold for an improvement proposal has not been met"); error.code = "INSUFFICIENT_IMPROVEMENT_EVIDENCE"; error.statusCode = 409; error.evidence = evidence; throw error; }
  return OGAgentImprovementProposal.create({ ...input, ...evidence, status: "DRAFT", createdBy: actorId });
};
