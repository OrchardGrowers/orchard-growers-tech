import OGAgentApproval from "../../../models/OGAgentApproval.js";
import OGAgentApprovedExample from "../../../models/OGAgentApprovedExample.js";
import OGAgentFeedback from "../../../models/OGAgentFeedback.js";
import OGAgentOrganizationalGuidance from "../../../models/OGAgentOrganizationalGuidance.js";
import OGAgentTask from "../../../models/OGAgentTask.js";
import { redactFeedbackText, sanitizeFeedbackPayload } from "./feedbackRedactionService.js";
import { mapReviewDecisionToApprovalStatus, stableHash, validateStructuredFeedback } from "./feedbackValidationService.js";
import { ensureInitialProposalVersion } from "./feedbackVersionService.js";
import { createTaskProposalRevision } from "./feedbackVersionService.js";
import { cancelRejectedTask, queueApprovedTask } from "../ogAgentOrchestrator.js";
import { getOGAgentSettings } from "../ogAgentSettingsService.js";

const feedbackFields = ["summary", "benefits", "harms", "missedContext", "misunderstoodContext", "correction", "futureGuidance", "humanImpact", "reusable", "guidanceScope", "confidence", "specialistReviewRequired"];

export const createStructuredFeedback = async ({ taskId, approvalId = null, input, reviewerId }) => {
  const task = await OGAgentTask.findById(taskId);
  if (!task) { const error = new Error("Task was not found"); error.statusCode = 404; throw error; }
  await ensureInitialProposalVersion(task);
  const proposalVersion = Number(input.proposalVersion || task.activeProposalVersion || 1);
  const proposal = task.proposalVersions.find((item) => item.version === proposalVersion);
  if (!proposal) { const error = new Error("Proposal version was not found"); error.code = "PROPOSAL_VERSION_MISMATCH"; error.statusCode = 409; throw error; }
  const validated = validateStructuredFeedback(input, { riskLevel: task.riskLevel });
  const sanitized = sanitizeFeedbackPayload(validated);
  const proposalHash = String(input.proposalHash || proposal.contentHash);
  if (proposalHash !== proposal.contentHash) { const error = new Error("The reviewed proposal changed; reload before deciding"); error.code = "PROPOSAL_HASH_MISMATCH"; error.statusCode = 409; throw error; }
  let approval = null;
  if (approvalId) {
    approval = await OGAgentApproval.findOne({ _id: approvalId, taskId });
    if (!approval) { const error = new Error("Approval was not found for this task"); error.statusCode = 404; throw error; }
    if (approval.status !== "PENDING") { const error = new Error("Approval has already been decided"); error.code = "APPROVAL_ALREADY_DECIDED"; error.statusCode = 409; throw error; }
  }
  const feedbackHash = stableHash({ taskId: String(taskId), approvalId: String(approvalId || ""), reviewerId: String(reviewerId), proposalVersion, proposalHash, reviewDecision: sanitized.reviewDecision, assessment: sanitized.assessment, summary: sanitized.summary, correction: sanitized.correction, futureGuidance: sanitized.futureGuidance });
  const feedback = await OGAgentFeedback.create({ taskId, approvalId, reviewerId, ...sanitized, proposalVersion, proposalHash, feedbackHash });
  if (approval) {
    const humanFeedback = Object.fromEntries(feedbackFields.map((key) => [key, sanitized[key]]));
    const decided = await OGAgentApproval.findOneAndUpdate({ _id: approval._id, status: "PENDING" }, { $set: { status: mapReviewDecisionToApprovalStatus(sanitized.reviewDecision), reviewedBy: reviewerId, reviewedAt: new Date(), reviewerNote: sanitized.summary, reviewDecision: sanitized.reviewDecision, assessment: sanitized.assessment, humanFeedback, conditions: sanitized.conditions, proposalVersion, reviewedProposalVersion: proposalVersion, proposalHash, feedbackHash } }, { new: true, runValidators: true });
    if (!decided) { await OGAgentFeedback.deleteOne({ _id: feedback._id }); const error = new Error("Approval was decided concurrently"); error.code = "APPROVAL_ALREADY_DECIDED"; error.statusCode = 409; throw error; }
  }
  const drafts = [];
  if (sanitized.reusable && (sanitized.futureGuidance || sanitized.correction)) {
    drafts.push(await OGAgentOrganizationalGuidance.create({ title: `Feedback guidance: ${task.title}`.slice(0, 200), guidance: sanitized.futureGuidance || sanitized.correction, scope: sanitized.guidanceScope, scopeValue: sanitized.guidanceScope === "TASK_TYPE" ? task.taskType : "", status: "DRAFT", evidence: [{ feedbackId: feedback._id, taskId: task._id, reviewerId, excerpt: sanitized.summary }], humanImpact: sanitized.humanImpact, createdBy: reviewerId }));
  }
  if (sanitized.reusable && sanitized.reviewDecision === "APPROVE") {
    const safeInput = redactFeedbackText(task.prompt, 6000).text;
    const safeOutput = typeof proposal.content === "string" ? redactFeedbackText(proposal.content, 12000).text : proposal.content;
    drafts.push(await OGAgentApprovedExample.create({ title: `Approved example: ${task.title}`.slice(0, 200), taskType: task.taskType, scope: sanitized.guidanceScope, sourceTaskId: task._id, sourceFeedbackId: feedback._id, inputSummary: safeInput, approvedOutput: safeOutput, rationale: sanitized.summary, humanImpact: sanitized.humanImpact, status: "DRAFT", createdBy: reviewerId }));
  }
  const specialized = approval && (["LEAD_IMPORT", "RESEARCH_LEAD_IMPORT", "RESEARCH_PLAN_EXECUTION", "CODE_ANALYSIS_SCOPE", "CODE_PATCH_GENERATION", "CODE_PATCH_APPLICATION", "HIGH_RISK_CODE_PATCH_APPLICATION", "SAFE_COMMAND_EXECUTION", "CODE_PATCH_REVERT"].includes(approval.actionType) || approval.subjectType !== "TASK");
  if (approval && !specialized && task.status === "WAITING_APPROVAL") {
    if (["APPROVE", "APPROVE_WITH_CONDITIONS"].includes(sanitized.reviewDecision)) await queueApprovedTask(task);
    else if (sanitized.reviewDecision === "REQUEST_REVISION") {
      const settings = await getOGAgentSettings();
      await createTaskProposalRevision({ taskId: task._id, feedback, actorId: reviewerId, maximumRevisions: settings.maximumRevisionAttempts });
    } else if (sanitized.reviewDecision !== "ESCALATE_FOR_REVIEW") await cancelRejectedTask(task);
  }
  return { feedback, approval: approval ? await OGAgentApproval.findById(approval._id) : null, drafts };
};

export const supersedeFeedback = async ({ feedbackId, input, reviewerId }) => {
  const prior = await OGAgentFeedback.findById(feedbackId);
  if (!prior) { const error = new Error("Feedback was not found"); error.statusCode = 404; throw error; }
  if (prior.supersededByFeedbackId) { const error = new Error("Feedback has already been superseded"); error.statusCode = 409; throw error; }
  const result = await createStructuredFeedback({ taskId: prior.taskId, approvalId: null, input: { ...prior.toObject(), ...input, proposalVersion: prior.proposalVersion, proposalHash: prior.proposalHash }, reviewerId });
  result.feedback.supersedesFeedbackId = prior._id; await result.feedback.save();
  prior.supersededByFeedbackId = result.feedback._id; await prior.save();
  return result;
};
