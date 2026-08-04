import OGAgentTask from "../../models/OGAgentTask.js";
import { createApprovalForTask } from "./ogAgentApprovalService.js";
import { createOGAgentAuditLog } from "./ogAgentAuditService.js";
import executeOGAgentTask from "./ogAgentExecutionService.js";
import planOGAgentTask from "./ogAgentPlanner.js";
import { getOGAgentSettings } from "./ogAgentSettingsService.js";

export const OG_AGENT_TASK_TRANSITIONS = {
  DRAFT: ["PLANNING", "CANCELLED"],
  PLANNING: ["QUEUED", "WAITING_APPROVAL", "FAILED"],
  QUEUED: ["RUNNING", "CANCELLED"],
  WAITING_APPROVAL: ["QUEUED", "CANCELLED"],
  RUNNING: ["COMPLETED", "FAILED"],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
};

export const assertOGAgentTaskTransition = (from, to) => {
  if (!OG_AGENT_TASK_TRANSITIONS[from]?.includes(to)) {
    const error = new Error(`Task cannot transition from ${from} to ${to}`);
    error.statusCode = 409;
    error.code = "INVALID_TASK_TRANSITION";
    throw error;
  }
};

const transitionTask = (task, nextStatus) => {
  assertOGAgentTaskTransition(task.status, nextStatus);
  task.status = nextStatus;
};

export const planTask = async ({ task, actorId, requestContext }) => {
  transitionTask(task, "PLANNING");
  task.failureReason = "";
  await task.save();

  const planned = await planOGAgentTask(task);
  if (planned.blockedAction) {
    transitionTask(task, "FAILED");
    task.riskLevel = "HIGH";
    task.failureReason = `Prohibited Phase 1 action blocked: ${planned.blockedAction}`;
    task.result = {
      summary: "The request was blocked by OG Agent Phase 1 safety policy.",
      data: { blockedAction: planned.blockedAction, performed: false },
      recommendations: ["Reframe the task as analysis, preparation, or a read-only recommendation."],
    };
    task.completedAt = new Date();
    await task.save();
    await createOGAgentAuditLog({
      taskId: task._id,
      actorId,
      actorType: "SYSTEM",
      eventType: "PROHIBITED_ACTION_BLOCKED",
      action: "Blocked prohibited OG Agent action",
      details: task.failureReason,
      metadata: { blockedAction: planned.blockedAction },
      requestContext,
    });
    return { task, approval: null };
  }

  const settings = await getOGAgentSettings();
  task.plan = planned.plan;
  task.riskLevel = planned.riskLevel;
  const settingsRequireApproval =
    (planned.riskLevel === "MEDIUM" && settings.requireApprovalForMediumRisk) ||
    (planned.riskLevel === "HIGH" && settings.requireApprovalForHighRisk);
  const approvalRequired = planned.approvalRequired || settingsRequireApproval;
  transitionTask(task, approvalRequired ? "WAITING_APPROVAL" : "QUEUED");
  await task.save();

  await createOGAgentAuditLog({
    taskId: task._id,
    actorId,
    actorType: "OG_AGENT",
    eventType: "TASK_PLAN_GENERATED",
    action: "Generated safe task plan",
    details: `Generated ${task.plan.length} plan steps using ${planned.tool.name}.`,
    metadata: { tool: planned.tool.name, riskLevel: task.riskLevel, approvalRequired },
    requestContext,
  });

  let approval = null;
  if (approvalRequired) {
    approval = await createApprovalForTask({ task, tool: planned.tool });
    await createOGAgentAuditLog({
      taskId: task._id,
      actorId,
      actorType: "SYSTEM",
      eventType: "APPROVAL_REQUESTED",
      action: "Requested human approval",
      details: "Task remains blocked until a permitted reviewer decides the request.",
      metadata: { approvalId: approval._id, tool: planned.tool.name },
      requestContext,
    });
  }

  return { task, approval };
};

export const runTask = async ({ task, actorId, requestContext }) => {
  const settings = await getOGAgentSettings();
  if (!settings.agentEnabled) {
    const error = new Error("OG Agent is paused in safety settings");
    error.statusCode = 409;
    error.code = "AGENT_PAUSED";
    throw error;
  }

  transitionTask(task, "RUNNING");
  task.startedAt = new Date();
  task.plan = task.plan.map((step) => ({ ...step.toObject?.() || step, status: "RUNNING" }));
  await task.save();
  await createOGAgentAuditLog({
    taskId: task._id,
    actorId,
    actorType: "ADMIN",
    eventType: "TASK_RUN_STARTED",
    action: "Started approved safe task",
    details: "Execution is restricted to the Phase 1 mock provider and registered safe tool.",
    requestContext,
  });

  try {
    task.result = await executeOGAgentTask(task, settings);
    transitionTask(task, "COMPLETED");
    task.completedAt = new Date();
    task.plan = task.plan.map((step) => ({ ...step.toObject?.() || step, status: "COMPLETED" }));
    await task.save();
    await createOGAgentAuditLog({
      taskId: task._id,
      actorId,
      actorType: "OG_AGENT",
      eventType: "TASK_COMPLETED",
      action: "Completed safe task",
      details: task.result.summary,
      metadata: { performedExternalAction: false },
      requestContext,
    });
    return task;
  } catch (error) {
    transitionTask(task, "FAILED");
    task.failureReason = String(error.message || "Task failed").slice(0, 4000);
    task.completedAt = new Date();
    task.plan = task.plan.map((step) => ({ ...step.toObject?.() || step, status: "FAILED" }));
    await task.save();
    await createOGAgentAuditLog({
      taskId: task._id,
      actorId,
      actorType: "SYSTEM",
      eventType: "TASK_FAILED",
      action: "Task failed safely",
      details: task.failureReason,
      metadata: { code: error.code || "TASK_FAILED" },
      requestContext,
    });
    throw error;
  }
};

export const cancelTask = async ({ task, actorId, requestContext }) => {
  transitionTask(task, "CANCELLED");
  task.cancelledAt = new Date();
  await task.save();
  await createOGAgentAuditLog({
    taskId: task._id,
    actorId,
    actorType: "ADMIN",
    eventType: "TASK_CANCELLED",
    action: "Cancelled OG Agent task",
    requestContext,
  });
  return task;
};

export const queueApprovedTask = async (task) => {
  transitionTask(task, "QUEUED");
  await task.save();
  return task;
};

export const cancelRejectedTask = async (task) => {
  transitionTask(task, "CANCELLED");
  task.cancelledAt = new Date();
  await task.save();
  return task;
};

export const findTaskById = (taskId) => OGAgentTask.findById(taskId);
