import OGAgentTask from "../../../models/OGAgentTask.js";
import { stableHash } from "./feedbackValidationService.js";

export const ensureInitialProposalVersion = async (task) => {
  if (task.proposalVersions?.length) return task;
  const content = task.result?.summary || task.prompt;
  task.proposalVersions = [{ version: 1, content, contentHash: stableHash({ content }), status: "REVIEW_READY", createdBy: task.requestedBy }];
  task.activeProposalVersion = 1;
  await task.save();
  return task;
};

export const createTaskProposalRevision = async ({ taskId, feedback, content, actorId, maximumRevisions = 3 }) => {
  const task = await OGAgentTask.findById(taskId);
  if (!task) { const error = new Error("Task was not found"); error.statusCode = 404; throw error; }
  await ensureInitialProposalVersion(task);
  const nextVersion = Math.max(...task.proposalVersions.map((item) => item.version)) + 1;
  if (nextVersion > maximumRevisions + 1) { const error = new Error("Maximum proposal revisions reached"); error.code = "REVISION_LIMIT_REACHED"; error.statusCode = 409; throw error; }
  task.proposalVersions.forEach((item) => { if (item.status === "REVIEW_READY") item.status = "SUPERSEDED"; });
  const proposedContent = content ?? task.result?.summary ?? task.prompt;
  task.proposalVersions.push({ version: nextVersion, content: proposedContent, contentHash: stableHash({ proposedContent }), sourceFeedbackId: feedback?._id, status: "REVIEW_READY", diffSummary: feedback?.correction || feedback?.futureGuidance || "Revision requested", addressedFeedback: [feedback?.summary].filter(Boolean), unaddressedFeedback: [], remainingRisks: [feedback?.harms].filter(Boolean), createdBy: actorId });
  task.activeProposalVersion = nextVersion;
  task.status = "WAITING_APPROVAL";
  await task.save();
  return task.proposalVersions.at(-1);
};
