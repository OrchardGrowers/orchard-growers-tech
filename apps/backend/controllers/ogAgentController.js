import mongoose from "mongoose";
import OGAgentApproval from "../models/OGAgentApproval.js";
import OGAgentAuditLog from "../models/OGAgentAuditLog.js";
import OGAgentTask, { OG_AGENT_TASK_STATUSES, OG_AGENT_TASK_TYPES } from "../models/OGAgentTask.js";
import OGAgentLeadCandidate from "../models/OGAgentLeadCandidate.js";
import OGAgentLeadExtraction from "../models/OGAgentLeadExtraction.js";
import OGCodingTask from "../models/OGCodingTask.js";
import OGCodePatch from "../models/OGCodePatch.js";
import {
  cancelRejectedTask,
  cancelTask,
  planTask,
  queueApprovedTask,
  runTask,
} from "../services/og-agent/ogAgentOrchestrator.js";
import { decideOGAgentApproval } from "../services/og-agent/ogAgentApprovalService.js";
import {
  createOGAgentAuditLog,
  getRequestAuditContext,
  listOGAgentAuditLogs,
} from "../services/og-agent/ogAgentAuditService.js";
import {
  getOGAgentSettings,
  updateOGAgentSettings,
} from "../services/og-agent/ogAgentSettingsService.js";
import { listOGAgentTools } from "../services/og-agent/ogAgentToolRegistry.js";

const createHttpError = (statusCode, message, code = "INVALID_REQUEST") => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
};

const cleanString = (value, field, { min = 0, max }) => {
  if (typeof value !== "string") throw createHttpError(400, `${field} must be a string`, "VALIDATION_ERROR");
  const cleaned = value.trim();
  if (cleaned.length < min || cleaned.length > max) {
    throw createHttpError(400, `${field} must be between ${min} and ${max} characters`, "VALIDATION_ERROR");
  }
  return cleaned;
};

export const sanitizeOGAgentTaskPayload = (body = {}) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw createHttpError(400, "Request body must be an object", "VALIDATION_ERROR");
  }
  const unsupported = Object.keys(body).filter((key) => !["title", "taskType", "prompt"].includes(key));
  if (unsupported.length) throw createHttpError(400, `Unsupported fields: ${unsupported.join(", ")}`, "VALIDATION_ERROR");

  const title = cleanString(body.title, "title", { min: 3, max: 160 });
  const prompt = cleanString(body.prompt, "prompt", { min: 10, max: 12000 });
  const taskType = String(body.taskType || "").trim().toUpperCase();
  if (!OG_AGENT_TASK_TYPES.includes(taskType)) {
    throw createHttpError(400, `taskType must be one of: ${OG_AGENT_TASK_TYPES.join(", ")}`, "VALIDATION_ERROR");
  }
  return { title, taskType, prompt };
};

const validateObjectId = (value, label) => {
  if (!mongoose.isValidObjectId(value)) throw createHttpError(400, `${label} is invalid`, "VALIDATION_ERROR");
  return value;
};

const parsePagination = (query = {}, defaultLimit = 25) => {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || defaultLimit);
  if (!Number.isSafeInteger(page) || page < 1 || page > 1000000) throw createHttpError(400, "page is invalid", "VALIDATION_ERROR");
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw createHttpError(400, "limit must be between 1 and 100", "VALIDATION_ERROR");
  return { page, limit };
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const taskPopulate = { path: "requestedBy", select: "name email role adminClass" };
const approvalPopulate = [
  { path: "taskId", select: "title taskType status riskLevel" },
  { path: "requestedBy", select: "name email role adminClass" },
  { path: "reviewedBy", select: "name email role adminClass" },
];

const loadTask = async (taskId) => {
  validateObjectId(taskId, "Task ID");
  const task = await OGAgentTask.findById(taskId);
  if (!task) throw createHttpError(404, "OG Agent task was not found", "TASK_NOT_FOUND");
  return task;
};

const loadApproval = async (approvalId) => {
  validateObjectId(approvalId, "Approval ID");
  const approval = await OGAgentApproval.findById(approvalId);
  if (!approval) throw createHttpError(404, "OG Agent approval was not found", "APPROVAL_NOT_FOUND");
  return approval;
};

export const createOGAgentTask = async (req, res) => {
  const payload = sanitizeOGAgentTaskPayload(req.body);
  const task = await OGAgentTask.create({ ...payload, requestedBy: req.admin._id });
  await createOGAgentAuditLog({
    taskId: task._id,
    actorId: req.admin._id,
    actorType: "ADMIN",
    eventType: "TASK_CREATED",
    action: "Created OG Agent task",
    details: task.title,
    metadata: { taskType: task.taskType, status: task.status },
    requestContext: getRequestAuditContext(req),
  });
  await task.populate(taskPopulate);
  res.status(201).json({ success: true, data: task });
};

export const listOGAgentTasks = async (req, res) => {
  const { page, limit } = parsePagination(req.query);
  const filter = {};
  const status = String(req.query.status || "").trim().toUpperCase();
  const taskType = String(req.query.taskType || "").trim().toUpperCase();
  const search = String(req.query.search || "").trim().slice(0, 100);
  if (status) {
    if (!OG_AGENT_TASK_STATUSES.includes(status)) throw createHttpError(400, "status filter is invalid", "VALIDATION_ERROR");
    filter.status = status;
  }
  if (taskType) {
    if (!OG_AGENT_TASK_TYPES.includes(taskType)) throw createHttpError(400, "taskType filter is invalid", "VALIDATION_ERROR");
    filter.taskType = taskType;
  }
  if (search) {
    const pattern = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ title: pattern }, { prompt: pattern }];
  }

  const [tasks, total] = await Promise.all([
    OGAgentTask.find(filter).populate(taskPopulate).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    OGAgentTask.countDocuments(filter),
  ]);
  res.json({
    success: true,
    data: tasks,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
};

export const getOGAgentTask = async (req, res) => {
  const taskId = validateObjectId(req.params.taskId, "Task ID");
  const task = await OGAgentTask.findById(taskId).populate(taskPopulate).lean();
  if (!task) throw createHttpError(404, "OG Agent task was not found", "TASK_NOT_FOUND");
  const [approvals, auditLogs] = await Promise.all([
    OGAgentApproval.find({ taskId }).populate(approvalPopulate).sort({ createdAt: -1 }).lean(),
    OGAgentAuditLog.find({ taskId }).populate("actorId", "name email role adminClass").sort({ createdAt: 1 }).lean(),
  ]);
  res.json({ success: true, data: { task, approvals, auditLogs } });
};

export const planOGAgentTaskController = async (req, res) => {
  const task = await loadTask(req.params.taskId);
  const result = await planTask({ task, actorId: req.admin._id, requestContext: getRequestAuditContext(req) });
  await result.task.populate(taskPopulate);
  res.json({ success: true, data: result });
};

export const runOGAgentTaskController = async (req, res) => {
  const task = await loadTask(req.params.taskId);
  const completed = await runTask({ task, actorId: req.admin._id, requestContext: getRequestAuditContext(req) });
  await completed.populate(taskPopulate);
  res.json({ success: true, data: completed });
};

export const cancelOGAgentTaskController = async (req, res) => {
  const task = await loadTask(req.params.taskId);
  const cancelled = await cancelTask({ task, actorId: req.admin._id, requestContext: getRequestAuditContext(req) });
  await cancelled.populate(taskPopulate);
  res.json({ success: true, data: cancelled });
};

export const listOGAgentApprovals = async (req, res) => {
  const { page, limit } = parsePagination(req.query);
  const status = String(req.query.status || "PENDING").trim().toUpperCase();
  if (!["PENDING", "APPROVED", "REJECTED", "ESCALATED", "EXPIRED", "ALL"].includes(status)) {
    throw createHttpError(400, "status filter is invalid", "VALIDATION_ERROR");
  }
  const filter = status === "ALL" ? {} : { status };
  const [approvals, total] = await Promise.all([
    OGAgentApproval.find(filter).populate(approvalPopulate).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    OGAgentApproval.countDocuments(filter),
  ]);
  res.json({ success: true, data: approvals, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
};

export const getOGAgentApproval = async (req, res) => {
  const approvalId = validateObjectId(req.params.approvalId, "Approval ID");
  const approval = await OGAgentApproval.findById(approvalId).populate(approvalPopulate).lean();
  if (!approval) throw createHttpError(404, "OG Agent approval was not found", "APPROVAL_NOT_FOUND");
  res.json({ success: true, data: approval });
};

const decideApproval = (decision) => async (req, res) => {
  const approval = await loadApproval(req.params.approvalId);
  const task = approval.taskId ? await loadTask(approval.taskId) : null;
  const isSystemApproval = !task && approval.subjectType !== "TASK";
  const isLeadImport = approval.actionType === "LEAD_IMPORT";
  const isCodingApproval = ["CODE_ANALYSIS_SCOPE", "CODE_PATCH_GENERATION", "CODE_PATCH_APPLICATION", "HIGH_RISK_CODE_PATCH_APPLICATION", "SAFE_COMMAND_EXECUTION", "CODE_PATCH_REVERT"].includes(approval.actionType);
  if (!isSystemApproval && !isLeadImport && !isCodingApproval && task.status !== "WAITING_APPROVAL") {
    throw createHttpError(409, "Task is no longer waiting for this approval", "INVALID_TASK_TRANSITION");
  }
  let leadExtraction = null;
  if (isLeadImport) {
    const extractionId = approval.actionPreview?.extractionId;
    if (!mongoose.isValidObjectId(extractionId)) {
      throw createHttpError(409, "Lead import approval snapshot is invalid", "APPROVAL_SNAPSHOT_CHANGED");
    }
    leadExtraction = await OGAgentLeadExtraction.findById(extractionId);
    if (!leadExtraction || String(leadExtraction.approvalId || "") !== String(approval._id)) {
      throw createHttpError(409, "Lead import approval no longer matches its extraction", "APPROVAL_SNAPSHOT_CHANGED");
    }
  }
  const decided = await decideOGAgentApproval({
    approval,
    decision,
    reviewerId: req.admin._id,
    reviewerNote: req.body?.reviewerNote,
  });

  if (isLeadImport) {
    if (decision === "REJECTED") {
      leadExtraction.status = "REVIEW_READY";
      leadExtraction.approvalId = null;
      await Promise.all([
        leadExtraction.save(),
        OGAgentLeadCandidate.updateMany(
          { extractionId: leadExtraction._id, importStatus: "WAITING_APPROVAL" },
          { $set: { importStatus: "SELECTED", selectedForImport: true } }
        ),
      ]);
    }
  } else if (isCodingApproval && decision === "REJECTED") {
    const codingTaskId = approval.actionPreview?.codingTaskId;
    const patchId = approval.actionPreview?.patchId;
    if (mongoose.isValidObjectId(codingTaskId) && approval.actionType === "CODE_PATCH_GENERATION") {
      await OGCodingTask.updateOne({ _id: codingTaskId }, { $set: { patchStatus: "REJECTED" } });
    }
    if (mongoose.isValidObjectId(codingTaskId) && mongoose.isValidObjectId(patchId) && ["CODE_PATCH_APPLICATION", "HIGH_RISK_CODE_PATCH_APPLICATION"].includes(approval.actionType)) {
      await Promise.all([
        OGCodePatch.updateOne({ _id: patchId, codingTaskId, status: "WAITING_APPROVAL" }, { $set: { status: "REJECTED" } }),
        OGCodingTask.updateOne({ _id: codingTaskId }, { $set: { patchStatus: "REJECTED" } }),
      ]);
    }
  } else if (!isSystemApproval && !isCodingApproval && decision === "APPROVED") await queueApprovedTask(task);
  else if (!isSystemApproval && !isCodingApproval) await cancelRejectedTask(task);

  await createOGAgentAuditLog({
    taskId: task?._id || null,
    actorId: req.admin._id,
    actorType: "ADMIN",
    eventType: `APPROVAL_${decision}`,
    action: `${decision === "APPROVED" ? "Approved" : "Rejected"} OG Agent approval request`,
    details: decided.reviewerNote,
    metadata: { approvalId: decided._id, actionType: decided.actionType, externalActionPerformed: false },
    requestContext: getRequestAuditContext(req),
  });
  await decided.populate(approvalPopulate);
  res.json({ success: true, data: { approval: decided, task } });
};

export const approveOGAgentApproval = decideApproval("APPROVED");
export const rejectOGAgentApproval = decideApproval("REJECTED");

export const listOGAgentAuditLogsController = async (req, res) => {
  const { page, limit } = parsePagination(req.query, 50);
  const filter = {};
  if (req.query.taskId) filter.taskId = validateObjectId(req.query.taskId, "Task ID");
  const [logs, total] = await listOGAgentAuditLogs({ filter, page, limit });
  res.json({ success: true, data: logs, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
};

export const getOGAgentSettingsController = async (_req, res) => {
  const settings = await getOGAgentSettings();
  res.json({ success: true, data: settings });
};

export const updateOGAgentSettingsController = async (req, res) => {
  const settings = await updateOGAgentSettings(req.body, req.admin._id);
  await createOGAgentAuditLog({
    actorId: req.admin._id,
    actorType: "ADMIN",
    eventType: "SETTINGS_UPDATED",
    action: "Updated OG Agent safety settings",
    metadata: req.body,
    requestContext: getRequestAuditContext(req),
  });
  res.json({ success: true, data: settings });
};

export const listOGAgentToolsController = async (_req, res) => {
  res.json({ success: true, data: listOGAgentTools() });
};

export const ogAgentErrorHandler = (error, _req, res, next) => {
  if (!error) return next();
  if (error.name === "ValidationError") {
    return res.status(400).json({ success: false, code: "VALIDATION_ERROR", message: error.message, msg: error.message });
  }
  if (error.code === 11000) {
    return res.status(409).json({ success: false, code: "DUPLICATE_RECORD", message: "A matching pending approval already exists", msg: "A matching pending approval already exists" });
  }
  const status = error.statusCode || 500;
  const message = status >= 500 ? "OG Agent request failed safely" : error.message;
  if (status >= 500) console.error("OG Agent error:", error);
  return res.status(status).json({ success: false, code: error.code || "OG_AGENT_ERROR", message, msg: message });
};
