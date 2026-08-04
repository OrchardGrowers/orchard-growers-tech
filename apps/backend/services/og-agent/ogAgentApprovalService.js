import OGAgentApproval from "../../models/OGAgentApproval.js";

export const createApprovalForTask = async ({ task, tool }) => OGAgentApproval.findOneAndUpdate(
  { taskId: task._id, actionType: tool.name, status: "PENDING" },
  {
    $setOnInsert: {
      taskId: task._id,
      subjectType: "TASK",
      subjectId: task._id,
      subjectKey: `TASK:${task._id}:${tool.name}`,
      requestedBy: task.requestedBy,
      actionType: tool.name,
      actionTitle: `Approve ${tool.description}`,
      actionDescription: "Phase 1 approval demonstrates human review only. Approval cannot enable a real external action.",
      actionPreview: {
        taskTitle: task.title,
        taskType: task.taskType,
        tool: tool.name,
        externalActionWillRun: false,
      },
      riskLevel: tool.riskLevel,
      status: "PENDING",
    },
  },
  { new: true, upsert: true, runValidators: true }
);

export const decideOGAgentApproval = async ({ approval, decision, reviewerId, reviewerNote = "" }) => {
  if (!['APPROVED', 'REJECTED'].includes(decision)) {
    const error = new Error("Approval decision is invalid");
    error.statusCode = 400;
    throw error;
  }

  const decided = await OGAgentApproval.findOneAndUpdate(
    { _id: approval._id, status: "PENDING" },
    {
      $set: {
        status: decision,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        reviewerNote: String(reviewerNote || "").trim().slice(0, 2000),
      },
    },
    { new: true, runValidators: true }
  );
  if (!decided) {
    const error = new Error("Approval has already been decided");
    error.statusCode = 409;
    error.code = "APPROVAL_ALREADY_DECIDED";
    throw error;
  }
  return decided;
};
