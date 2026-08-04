import mongoose from "mongoose";
import OGAgentApproval from "../models/OGAgentApproval.js";
import OGAgentTask from "../models/OGAgentTask.js";
import OGCodeCommandRun from "../models/OGCodeCommandRun.js";
import OGCodePatch from "../models/OGCodePatch.js";
import OGCodingTask, { OG_CODING_TARGET_APPLICATIONS, OG_CODING_TASK_CATEGORIES } from "../models/OGCodingTask.js";
import { createOGAgentAuditLog, getRequestAuditContext } from "../services/og-agent/ogAgentAuditService.js";
import { getOGAgentSettings } from "../services/og-agent/ogAgentSettingsService.js";
import { analyzeCodingTask } from "../services/og-agent/coding/codingAnalysisService.js";
import { auditCodingEvent } from "../services/og-agent/coding/codingAuditService.js";
import { createCodingApproval, requireApprovedCodingApproval } from "../services/og-agent/coding/codingApprovalService.js";
import { applyApprovedCodePatch, buildPatchApplicationPreview } from "../services/og-agent/coding/codePatchApplicationService.js";
import { buildPatchGenerationPreview, generateCodePatch } from "../services/og-agent/coding/codePatchGenerationService.js";
import { buildPatchRevertPreview, revertApprovedCodePatch } from "../services/og-agent/coding/codePatchRevertService.js";
import { getRepositoryState } from "../services/og-agent/coding/gitReadOnlyService.js";
import { DEFAULT_ALLOWED_SCOPES, ROOT_CONFIGURATION_FILES, classifyRisk, validateAllowedScopes } from "../services/og-agent/coding/repositoryPolicyService.js";
import { repositoryRootLabel, validateRepositoryRelativePath } from "../services/og-agent/coding/repositoryPathService.js";
import { getRepositoryStructure } from "../services/og-agent/coding/repositoryDiscoveryService.js";
import { readRepositoryFile } from "../services/og-agent/coding/repositoryReadService.js";
import { searchRepository } from "../services/og-agent/coding/repositorySearchService.js";
import { listRepositorySnapshots } from "../services/og-agent/coding/repositorySnapshotService.js";
import { buildCommandPreview, cancelSafeCommand, executeSafeCommand } from "../services/og-agent/coding/safeCommandExecutionService.js";
import { assertNoArbitraryCommandInput, getSafeCommand, listSafeCommands } from "../services/og-agent/coding/safeCommandRegistry.js";

const httpError = (statusCode, message, code = "INVALID_REQUEST") => Object.assign(new Error(message), { statusCode, code });
const objectId = (value, label) => {
  if (!mongoose.isValidObjectId(value)) throw httpError(400, `${label} is invalid`, "VALIDATION_ERROR");
  return value;
};
const clean = (value, label, min, max) => {
  if (typeof value !== "string") throw httpError(400, `${label} must be a string`, "VALIDATION_ERROR");
  const result = value.trim();
  if (result.length < min || result.length > max) throw httpError(400, `${label} must be between ${min} and ${max} characters`, "VALIDATION_ERROR");
  return result;
};
const cleanArray = (value, label, { maxItems = 50, itemMax = 500 } = {}) => {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > maxItems || value.some((item) => typeof item !== "string")) throw httpError(400, `${label} must be an array of strings`, "VALIDATION_ERROR");
  return [...new Set(value.map((item) => item.trim()).filter(Boolean))].map((item) => item.slice(0, itemMax));
};
const boolean = (value, fallback = false) => value === undefined ? fallback : value === true;
const parsePagination = (query, defaultLimit = 25) => {
  const page = Number(query.page || 1); const limit = Number(query.limit || defaultLimit);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) throw httpError(400, "Pagination is invalid", "VALIDATION_ERROR");
  return { page, limit };
};
const codingPopulate = [
  { path: "taskId", select: "title prompt taskType status requestedBy createdAt" },
  { path: "createdBy", select: "name email role adminClass" },
  { path: "approvedPatchId", select: "version title status patchHash files" },
];
const patchPopulate = [
  { path: "generatedBy", select: "name email role adminClass" }, { path: "reviewedBy", select: "name email role adminClass" }, { path: "appliedBy", select: "name email role adminClass" },
];

const loadCodingTask = async (id, populateTask = false) => {
  objectId(id, "Coding task ID");
  const query = OGCodingTask.findById(id);
  if (populateTask) query.populate(codingPopulate);
  const task = await query;
  if (!task) throw httpError(404, "Coding task was not found", "CODING_TASK_NOT_FOUND");
  return task;
};
const loadPatch = async (id) => {
  objectId(id, "Patch ID");
  const patch = await OGCodePatch.findById(id);
  if (!patch) throw httpError(404, "Code patch was not found", "CODE_PATCH_NOT_FOUND");
  return patch;
};
const assertCodingEnabled = async () => {
  const settings = await getOGAgentSettings();
  if (!settings.agentEnabled || !settings.codingAgentEnabled) throw httpError(403, "Coding Agent is disabled", "CODING_AGENT_DISABLED");
  return settings;
};

const sanitizeTaskPayload = (body) => {
  const supported = new Set(["title", "taskCategory", "targetApplications", "problemDescription", "currentBehavior", "expectedBehavior", "reproductionSteps", "allowedPaths", "fileHints", "constraints", "allowRepositoryAnalysis", "allowSafeCommands", "allowPatchGeneration", "allowPatchApplication", "highRiskAcknowledged"]);
  const unsupported = Object.keys(body || {}).filter((key) => !supported.has(key));
  if (unsupported.length) throw httpError(400, `Unsupported fields: ${unsupported.join(", ")}`, "VALIDATION_ERROR");
  const taskCategory = String(body.taskCategory || "").toUpperCase();
  if (!OG_CODING_TASK_CATEGORIES.includes(taskCategory)) throw httpError(400, "Task category is invalid", "VALIDATION_ERROR");
  const targetApplications = cleanArray(body.targetApplications, "targetApplications", { maxItems: 6, itemMax: 50 }).map((item) => item.toUpperCase());
  if (!targetApplications.length || targetApplications.some((item) => !OG_CODING_TARGET_APPLICATIONS.includes(item))) throw httpError(400, "Target application is invalid", "VALIDATION_ERROR");
  const allowedPaths = validateAllowedScopes(body.allowedPaths);
  const fileHints = cleanArray(body.fileHints, "fileHints", { maxItems: 50 }).map(validateRepositoryRelativePath);
  if (fileHints.some((hint) => !allowedPaths.some((scope) => hint === scope || hint.startsWith(`${scope}/`)))) throw httpError(400, "Every file hint must be inside the selected repository scope", "PATH_OUTSIDE_TASK_SCOPE");
  const highRisk = fileHints.some((hint) => classifyRisk(hint) === "HIGH");
  if (highRisk && body.highRiskAcknowledged !== true) throw httpError(400, "High-risk file hints require explicit acknowledgment", "HIGH_RISK_ACKNOWLEDGMENT_REQUIRED");
  return {
    title: clean(body.title, "Task title", 3, 160), taskCategory, targetApplications,
    problemDescription: clean(body.problemDescription, "Problem description", 10, 12000),
    currentBehavior: clean(String(body.currentBehavior || ""), "Current behavior", 0, 12000), expectedBehavior: clean(body.expectedBehavior, "Expected behavior", 3, 12000),
    reproductionSteps: clean(String(body.reproductionSteps || ""), "Reproduction steps", 0, 12000), allowedPaths, fileHints,
    constraints: cleanArray(body.constraints, "constraints", { maxItems: 50, itemMax: 1000 }),
    allowRepositoryAnalysis: boolean(body.allowRepositoryAnalysis, true), allowSafeCommands: boolean(body.allowSafeCommands), allowPatchGeneration: boolean(body.allowPatchGeneration), allowPatchApplication: boolean(body.allowPatchApplication), highRiskAcknowledged: boolean(body.highRiskAcknowledged), highRisk,
  };
};

export const getCodingConfig = async (_req, res) => {
  const settings = await assertCodingEnabled();
  res.json({ success: true, data: { allowedScopes: DEFAULT_ALLOWED_SCOPES, rootConfigurationFiles: ROOT_CONFIGURATION_FILES, lockedCapabilities: ["secret_file_read", "arbitrary_terminal", "dependency_installation", "git_commit", "git_push", "git_merge", "local_branch_creation", "production_deployment", "database_write", "file_delete", "file_rename", "lockfile_modify"], settings } });
};

export const createCodingTask = async (req, res) => {
  const settings = await assertCodingEnabled();
  const payload = sanitizeTaskPayload(req.body || {});
  if (payload.allowPatchGeneration && !settings.allowPatchGeneration) throw httpError(403, "Patch generation is disabled globally", "PATCH_GENERATION_DISABLED");
  if (payload.allowPatchApplication && (!settings.allowPatchApplication || !payload.allowPatchGeneration)) throw httpError(400, "Patch application requires enabled patch generation and global application permission", "PATCH_APPLICATION_DISABLED");
  const generalTask = await OGAgentTask.create({ title: payload.title, taskType: "CODING_ANALYSIS", prompt: payload.problemDescription, requestedBy: req.admin._id, status: "DRAFT", riskLevel: payload.highRisk ? "HIGH" : "LOW" });
  try {
    const codingTask = await OGCodingTask.create({ taskId: generalTask._id, taskCategory: payload.taskCategory, targetApplications: payload.targetApplications, repositoryRoot: repositoryRootLabel, allowedPaths: payload.allowedPaths, fileHints: payload.fileHints, currentBehavior: payload.currentBehavior, expectedBehavior: payload.expectedBehavior, reproductionSteps: payload.reproductionSteps, constraints: payload.constraints, allowRepositoryAnalysis: payload.allowRepositoryAnalysis, allowPatchGeneration: payload.allowPatchGeneration, allowPatchApplication: payload.allowPatchApplication, allowSafeCommands: payload.allowSafeCommands, highRiskAcknowledged: payload.highRiskAcknowledged, riskLevel: payload.highRisk ? "HIGH" : "LOW", createdBy: req.admin._id });
    await auditCodingEvent({ codingTask, actorId: req.admin._id, eventType: "CODE_TASK_CREATED", action: "Created controlled coding task", metadata: { allowedPaths: payload.allowedPaths, targetApplications: payload.targetApplications, allowPatchGeneration: payload.allowPatchGeneration, allowPatchApplication: payload.allowPatchApplication }, requestContext: getRequestAuditContext(req) });
    await codingTask.populate(codingPopulate);
    res.status(201).json({ success: true, data: codingTask });
  } catch (error) {
    await OGAgentTask.deleteOne({ _id: generalTask._id }).catch(() => {});
    throw error;
  }
};

export const listCodingTasks = async (req, res) => {
  await assertCodingEnabled();
  const { page, limit } = parsePagination(req.query);
  const filter = {};
  if (req.query.status) filter.status = String(req.query.status).toUpperCase();
  const [tasks, total] = await Promise.all([OGCodingTask.find(filter).populate(codingPopulate).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), OGCodingTask.countDocuments(filter)]);
  res.json({ success: true, data: tasks, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
};

export const getCodingTask = async (req, res) => {
  await assertCodingEnabled();
  const task = await loadCodingTask(req.params.codingTaskId, true);
  const [patches, commands, approvals, snapshots] = await Promise.all([
    OGCodePatch.find({ codingTaskId: task._id }).select("-patchContent").populate(patchPopulate).sort({ version: -1 }).lean(),
    OGCodeCommandRun.find({ codingTaskId: task._id }).sort({ createdAt: -1 }).limit(100).lean(),
    OGAgentApproval.find({ taskId: task.taskId._id || task.taskId, actionType: { $in: ["CODE_ANALYSIS_SCOPE", "CODE_PATCH_GENERATION", "CODE_PATCH_APPLICATION", "HIGH_RISK_CODE_PATCH_APPLICATION", "SAFE_COMMAND_EXECUTION", "CODE_PATCH_REVERT"] } }).populate("requestedBy reviewedBy", "name email role adminClass").sort({ createdAt: -1 }).lean(),
    listRepositorySnapshots(task._id),
  ]);
  res.json({ success: true, data: { task, patches, commands, approvals, snapshots } });
};

export const updateCodingTask = async (req, res) => {
  await assertCodingEnabled();
  const task = await loadCodingTask(req.params.codingTaskId);
  if (task.analysisStatus !== "NOT_STARTED" || task.status !== "OPEN") throw httpError(409, "Only an unanalyzed open coding task can be edited", "CODING_TASK_NOT_EDITABLE");
  const generic = await OGAgentTask.findById(task.taskId);
  const current = { title: generic.title, taskCategory: task.taskCategory, targetApplications: task.targetApplications, problemDescription: generic.prompt, currentBehavior: task.currentBehavior, expectedBehavior: task.expectedBehavior, reproductionSteps: task.reproductionSteps, allowedPaths: task.allowedPaths, fileHints: task.fileHints, constraints: task.constraints, allowRepositoryAnalysis: task.allowRepositoryAnalysis, allowSafeCommands: task.allowSafeCommands, allowPatchGeneration: task.allowPatchGeneration, allowPatchApplication: task.allowPatchApplication, highRiskAcknowledged: task.highRiskAcknowledged };
  const payload = sanitizeTaskPayload({ ...current, ...req.body });
  generic.title = payload.title; generic.prompt = payload.problemDescription; generic.riskLevel = payload.highRisk ? "HIGH" : "LOW";
  Object.assign(task, { taskCategory: payload.taskCategory, targetApplications: payload.targetApplications, allowedPaths: payload.allowedPaths, fileHints: payload.fileHints, currentBehavior: payload.currentBehavior, expectedBehavior: payload.expectedBehavior, reproductionSteps: payload.reproductionSteps, constraints: payload.constraints, allowRepositoryAnalysis: payload.allowRepositoryAnalysis, allowSafeCommands: payload.allowSafeCommands, allowPatchGeneration: payload.allowPatchGeneration, allowPatchApplication: payload.allowPatchApplication, highRiskAcknowledged: payload.highRiskAcknowledged, riskLevel: payload.highRisk ? "HIGH" : "LOW" });
  await Promise.all([generic.save(), task.save()]);
  await auditCodingEvent({ codingTask: task, actorId: req.admin._id, eventType: "CODE_TASK_UPDATED", action: "Updated open coding task", requestContext: getRequestAuditContext(req) });
  await task.populate(codingPopulate); res.json({ success: true, data: task });
};

export const analyzeTask = async (req, res) => {
  const settings = await assertCodingEnabled(); const task = await loadCodingTask(req.params.codingTaskId);
  if (!settings.allowCodingAnalysis || !task.allowRepositoryAnalysis) throw httpError(403, "Repository analysis is disabled", "CODING_ANALYSIS_DISABLED");
  const analyzed = await analyzeCodingTask({ codingTaskId: task._id, actorId: req.admin._id, requestContext: getRequestAuditContext(req), settings });
  await analyzed.populate(codingPopulate); res.json({ success: true, data: analyzed });
};

export const cancelCodingTask = async (req, res) => {
  await assertCodingEnabled(); const task = await loadCodingTask(req.params.codingTaskId);
  if (["APPLIED", "COMPLETED", "CANCELLED"].includes(task.status) || task.operationLock !== "NONE") throw httpError(409, "Coding task cannot be cancelled in its current state", "INVALID_CODING_TASK_TRANSITION");
  task.status = "CANCELLED"; task.cancelledAt = new Date(); await task.save();
  await OGAgentTask.updateOne({ _id: task.taskId }, { $set: { status: "CANCELLED", cancelledAt: new Date() } });
  await auditCodingEvent({ codingTask: task, actorId: req.admin._id, eventType: "CODE_TASK_CANCELLED", action: "Cancelled coding task", requestContext: getRequestAuditContext(req) });
  res.json({ success: true, data: task });
};

export const repositoryStatus = async (req, res) => {
  await assertCodingEnabled(); const state = await getRepositoryState();
  await createOGAgentAuditLog({ actorId: req.admin._id, actorType: "ADMIN", eventType: "CODE_REPOSITORY_STATUS_READ", action: "Read bounded repository status metadata", metadata: { branch: state.branch, commit: state.commit, dirty: state.dirty }, requestContext: getRequestAuditContext(req) });
  res.json({ success: true, data: { repositoryRoot: repositoryRootLabel, branch: state.branch, commit: state.commit, dirty: state.dirty, modifiedFiles: state.modifiedFiles, stagedFiles: state.stagedFiles, untrackedFiles: state.untrackedFiles, diffStat: state.diffStat, workingTreeHash: state.workingTreeHash, deniedCapabilities: ["commit", "push", "pull", "merge", "rebase", "reset", "clean", "deploy", "install", "arbitrary terminal", "secret read"] } });
};
export const repositoryStructure = async (req, res) => { const settings = await assertCodingEnabled(); if (!settings.allowRepositoryRead) throw httpError(403, "Repository reading is disabled", "REPOSITORY_READ_DISABLED"); const task = await loadCodingTask(req.body?.codingTaskId); const data = await getRepositoryStructure({ codingTask: task, paths: req.body?.paths, depth: req.body?.depth, actorId: req.admin._id, requestContext: getRequestAuditContext(req), settings }); res.json({ success: true, data }); };
export const repositorySearch = async (req, res) => { const settings = await assertCodingEnabled(); if (!settings.allowRepositorySearch) throw httpError(403, "Repository search is disabled", "REPOSITORY_SEARCH_DISABLED"); const task = await loadCodingTask(req.body?.codingTaskId); const data = await searchRepository({ codingTask: task, query: req.body?.query, paths: req.body?.paths, actorId: req.admin._id, requestContext: getRequestAuditContext(req), settings }); res.json({ success: true, data }); };
export const repositoryRead = async (req, res) => { const settings = await assertCodingEnabled(); if (!settings.allowRepositoryRead) throw httpError(403, "Repository reading is disabled", "REPOSITORY_READ_DISABLED"); const task = await loadCodingTask(req.body?.codingTaskId); const data = await readRepositoryFile({ codingTask: task, path: req.body?.path, startLine: req.body?.startLine, endLine: req.body?.endLine, actorId: req.admin._id, requestContext: getRequestAuditContext(req), settings }); res.json({ success: true, data }); };

export const requestPatchGeneration = async (req, res) => {
  const settings = await assertCodingEnabled(); const task = await loadCodingTask(req.params.codingTaskId);
  if (!task.allowPatchGeneration || !settings.allowPatchGeneration || task.analysisStatus !== "REVIEW_READY") throw httpError(409, "Patch generation is not available for this task", "PATCH_GENERATION_DISABLED");
  const state = await getRepositoryState(); const preview = buildPatchGenerationPreview(task, state);
  const approval = await createCodingApproval({ codingTask: task, actorId: req.admin._id, actionType: "CODE_PATCH_GENERATION", actionTitle: "Approve code patch generation", actionDescription: "Approve one patch proposal against this exact analysis and repository state.", riskLevel: "MEDIUM", preview });
  task.patchStatus = "WAITING_APPROVAL"; await task.save();
  await auditCodingEvent({ codingTask: task, actorId: req.admin._id, eventType: "CODE_PATCH_GENERATION_REQUESTED", action: "Requested patch generation approval", metadata: { approvalId: approval._id, baseGitCommit: state.commit }, requestContext: getRequestAuditContext(req) });
  res.status(201).json({ success: true, data: approval });
};

export const generatePatch = async (req, res) => {
  const settings = await assertCodingEnabled(); const task = await loadCodingTask(req.params.codingTaskId); await task.populate("taskId");
  objectId(req.body?.approvalId, "Generation approval ID");
  const proposedPatch = clean(req.body?.patchContent, "Unified diff", 20, Math.min(settings.maximumPatchBytes, 2000000));
  const patch = await generateCodePatch({ codingTask: task, generationApprovalId: req.body.approvalId, proposedPatch, actorId: req.admin._id, requestContext: getRequestAuditContext(req), settings });
  await patch.populate(patchPopulate); res.status(201).json({ success: true, data: patch });
};

export const getPatch = async (req, res) => { await assertCodingEnabled(); const patch = await OGCodePatch.findById(objectId(req.params.patchId, "Patch ID")).select("-patchContent").populate(patchPopulate).lean(); if (!patch) throw httpError(404, "Code patch was not found", "CODE_PATCH_NOT_FOUND"); res.json({ success: true, data: patch }); };
export const getPatchDiff = async (req, res) => { await assertCodingEnabled(); const patch = await loadPatch(req.params.patchId); const offset = Math.max(0, Number(req.query.offset) || 0); const limit = Math.min(100000, Math.max(1000, Number(req.query.limit) || 50000)); const content = patch.patchContent.slice(offset, offset + limit); res.json({ success: true, data: { patchId: patch._id, patchHash: patch.patchHash, offset, content, totalBytes: patch.patchContent.length, truncated: offset + content.length < patch.patchContent.length } }); };

export const requestApplyApproval = async (req, res) => {
  const settings = await assertCodingEnabled(); if (!settings.allowPatchApplication) throw httpError(403, "Patch application is disabled", "PATCH_APPLICATION_DISABLED");
  const patch = await loadPatch(req.params.patchId); const task = await loadCodingTask(patch.codingTaskId);
  if (patch.status !== "REVIEW_READY") throw httpError(409, "Patch is not ready for apply approval", "PATCH_NOT_REVIEW_READY");
  const state = await getRepositoryState(); const preview = buildPatchApplicationPreview(task, patch, state);
  const approval = await createCodingApproval({ codingTask: task, actorId: req.admin._id, actionType: "CODE_PATCH_APPLICATION", actionTitle: "Approve exact code patch application", actionDescription: "Apply only the displayed patch hash and approved files after state validation and dry-run.", riskLevel: "HIGH", preview });
  let highRiskApproval = null;
  if (patch.files.some((file) => file.requiresAdditionalApproval) && settings.requireAdditionalApprovalForHighRiskFiles) highRiskApproval = await createCodingApproval({ codingTask: task, actorId: req.admin._id, actionType: "HIGH_RISK_CODE_PATCH_APPLICATION", actionTitle: "Additional high-risk code patch approval", actionDescription: "Additional review for exact high-risk files, validation plan, and rollback plan.", riskLevel: "HIGH", preview });
  patch.applicationApprovalId = approval._id; patch.highRiskApprovalId = highRiskApproval?._id || null; patch.approvedSnapshot = preview; patch.status = "WAITING_APPROVAL"; await patch.save();
  task.patchStatus = "WAITING_APPROVAL"; await task.save();
  await auditCodingEvent({ codingTask: task, actorId: req.admin._id, eventType: "CODE_PATCH_APPROVAL_REQUESTED", action: "Requested exact patch application approval", metadata: { patchId: patch._id, patchHash: patch.patchHash, approvalId: approval._id, highRiskApprovalId: highRiskApproval?._id }, requestContext: getRequestAuditContext(req) });
  res.status(201).json({ success: true, data: { approval, highRiskApproval } });
};

export const applyPatch = async (req, res) => {
  const settings = await assertCodingEnabled(); if (!settings.allowPatchApplication) throw httpError(403, "Patch application is disabled", "PATCH_APPLICATION_DISABLED");
  const patch = await loadPatch(req.params.patchId); const task = await loadCodingTask(patch.codingTaskId);
  const state = await getRepositoryState(); const preview = buildPatchApplicationPreview(task, patch, state);
  await requireApprovedCodingApproval({ approvalId: patch.applicationApprovalId, codingTask: task, actionType: "CODE_PATCH_APPLICATION", expectedPreview: preview });
  if (patch.highRiskApprovalId) await requireApprovedCodingApproval({ approvalId: patch.highRiskApprovalId, codingTask: task, actionType: "HIGH_RISK_CODE_PATCH_APPLICATION", expectedPreview: preview });
  const result = await applyApprovedCodePatch({ codingTask: task, patch, actorId: req.admin._id, requestContext: getRequestAuditContext(req) }); res.json({ success: true, data: result });
};

export const requestRevertApproval = async (req, res) => {
  await assertCodingEnabled(); const patch = await loadPatch(req.params.patchId); const task = await loadCodingTask(patch.codingTaskId);
  if (patch.status !== "APPLIED") throw httpError(409, "Only an applied patch can request revert", "PATCH_NOT_APPLIED");
  const state = await getRepositoryState(); const preview = buildPatchRevertPreview(task, patch, state);
  const approval = await createCodingApproval({ codingTask: task, actorId: req.admin._id, actionType: "CODE_PATCH_REVERT", actionTitle: "Approve exact reverse patch", actionDescription: "Revert only this OG Coding Agent patch if no later edits overlap.", riskLevel: "HIGH", preview });
  patch.revertApprovalId = approval._id; await patch.save();
  await auditCodingEvent({ codingTask: task, actorId: req.admin._id, eventType: "CODE_PATCH_REVERT_REQUESTED", action: "Requested patch revert approval", metadata: { patchId: patch._id, approvalId: approval._id }, requestContext: getRequestAuditContext(req) });
  res.status(201).json({ success: true, data: approval });
};
export const revertPatch = async (req, res) => { await assertCodingEnabled(); const patch = await loadPatch(req.params.patchId); const task = await loadCodingTask(patch.codingTaskId); const result = await revertApprovedCodePatch({ codingTask: task, patch, actorId: req.admin._id, requestContext: getRequestAuditContext(req) }); res.json({ success: true, data: result }); };

export const getCommands = async (_req, res) => { await assertCodingEnabled(); res.json({ success: true, data: listSafeCommands() }); };
export const previewCommand = async (req, res) => {
  const settings = await assertCodingEnabled(); const task = await loadCodingTask(req.params.codingTaskId);
  let command;
  try { assertNoArbitraryCommandInput(req.body || {}); command = getSafeCommand(req.body?.commandId); }
  catch (error) { await auditCodingEvent({ codingTask: task, actorId: req.admin._id, eventType: "CODE_COMMAND_BLOCKED", action: "Blocked arbitrary or unavailable Coding Agent command", metadata: { code: error.code, suppliedCommandId: String(req.body?.commandId || "").slice(0, 100) }, requestContext: getRequestAuditContext(req) }); throw error; }
  const patchId = req.body?.patchId ? objectId(req.body.patchId, "Patch ID") : null; const preview = buildCommandPreview(task, command, patchId);
  const approvalRequired = command.approvalRequired || (command.category === "BUILD" && settings.requireApprovalForBuild) || (command.category === "TEST" && settings.requireApprovalForTests) || (command.category === "LINT" && settings.requireApprovalForLint);
  const approval = approvalRequired ? await createCodingApproval({ codingTask: task, actorId: req.admin._id, actionType: "SAFE_COMMAND_EXECUTION", actionTitle: `Approve ${command.label}`, actionDescription: "Run this exact backend-registered executable and fixed argument array.", riskLevel: command.riskLevel, preview }) : null;
  await auditCodingEvent({ codingTask: task, actorId: req.admin._id, eventType: "CODE_COMMAND_REQUESTED", action: `Previewed allowlisted command ${command.commandId}`, metadata: { commandId: command.commandId, approvalRequired, approvalId: approval?._id }, requestContext: getRequestAuditContext(req) });
  res.json({ success: true, data: { command, preview, approvalRequired, approval } });
};
export const runCommand = async (req, res) => {
  const settings = await assertCodingEnabled(); const task = await loadCodingTask(req.params.codingTaskId);
  try { assertNoArbitraryCommandInput(req.body || {}); getSafeCommand(req.body?.commandId); }
  catch (error) { await auditCodingEvent({ codingTask: task, actorId: req.admin._id, eventType: "CODE_COMMAND_BLOCKED", action: "Blocked arbitrary or unavailable Coding Agent command", metadata: { code: error.code, suppliedCommandId: String(req.body?.commandId || "").slice(0, 100) }, requestContext: getRequestAuditContext(req) }); throw error; }
  const patchId = req.body?.patchId ? objectId(req.body.patchId, "Patch ID") : null;
  if (patchId && !(await OGCodePatch.exists({ _id: patchId, codingTaskId: task._id }))) throw httpError(400, "Patch does not belong to this coding task", "PATCH_TASK_MISMATCH");
  const run = await executeSafeCommand({ codingTask: task, patchId, commandId: req.body?.commandId, approvalId: req.body?.approvalId || null, idempotencyKey: String(req.body?.idempotencyKey || "").slice(0, 200), actorId: req.admin._id, requestContext: getRequestAuditContext(req), settings });
  res.status(201).json({ success: true, data: run });
};
export const getCommandRun = async (req, res) => { await assertCodingEnabled(); const run = await OGCodeCommandRun.findById(objectId(req.params.commandRunId, "Command run ID")).populate("requestedBy approvedBy", "name email role adminClass").lean(); if (!run) throw httpError(404, "Command run was not found", "COMMAND_RUN_NOT_FOUND"); res.json({ success: true, data: run }); };
export const cancelCommandRun = async (req, res) => { await assertCodingEnabled(); const run = await OGCodeCommandRun.findById(objectId(req.params.commandRunId, "Command run ID")); if (!run) throw httpError(404, "Command run was not found", "COMMAND_RUN_NOT_FOUND"); const task = await loadCodingTask(run.codingTaskId); const result = await cancelSafeCommand({ commandRunId: run._id, actorId: req.admin._id, codingTask: task, requestContext: getRequestAuditContext(req) }); res.json({ success: true, data: result }); };
export const getSnapshots = async (req, res) => { await assertCodingEnabled(); const task = await loadCodingTask(req.params.codingTaskId); res.json({ success: true, data: await listRepositorySnapshots(task._id) }); };
