import OGCodeCommandRun from "../../../models/OGCodeCommandRun.js";
import { auditCodingEvent } from "./codingAuditService.js";
import { requireApprovedCodingApproval } from "./codingApprovalService.js";
import { executeBoundedProcess } from "./processExecutionService.js";
import { getRepositoryRoot } from "./repositoryPathService.js";
import { getSafeCommand } from "./safeCommandRegistry.js";
import { captureRepositorySnapshot } from "./repositorySnapshotService.js";

let activeCommandCount = 0;
const activeRuns = new Map();

export const buildCommandPreview = (codingTask, command, patchId = null) => ({ codingTaskId: String(codingTask._id), patchId: patchId ? String(patchId) : null, commandId: command.commandId, executable: command.executable, arguments: command.arguments, workingDirectory: command.workingDirectory, timeoutSeconds: command.timeoutSeconds });

export const executeSafeCommand = async ({ codingTask, patchId = null, commandId, approvalId = null, idempotencyKey = "", actorId, requestContext, settings }) => {
  if (!codingTask.allowSafeCommands || !settings.allowSafeCommandExecution) throw Object.assign(new Error("Safe command execution is disabled"), { statusCode: 403, code: "SAFE_COMMANDS_DISABLED" });
  const command = getSafeCommand(commandId);
  const approvalRequired = command.approvalRequired || (command.category === "BUILD" && settings.requireApprovalForBuild) || (command.category === "TEST" && settings.requireApprovalForTests) || (command.category === "LINT" && settings.requireApprovalForLint);
  const preview = buildCommandPreview(codingTask, command, patchId);
  if (idempotencyKey) {
    const existing = await OGCodeCommandRun.findOne({ idempotencyKey });
    if (existing) return existing;
  }
  if (activeCommandCount >= Number(settings.maximumConcurrentCommandRuns || 1)) throw Object.assign(new Error("The safe command concurrency limit has been reached"), { statusCode: 429, code: "COMMAND_CONCURRENCY_LIMIT" });
  if (approvalRequired) await requireApprovedCodingApproval({ approvalId, codingTask, actionType: "SAFE_COMMAND_EXECUTION", expectedPreview: preview, consume: true, actorId });
  const root = await getRepositoryRoot();
  const run = await OGCodeCommandRun.create({ codingTaskId: codingTask._id, patchId, commandId: command.commandId, commandLabel: command.label, executable: command.executable, arguments: command.arguments, workingDirectory: command.workingDirectory, commandCategory: command.category, status: "QUEUED", requestedBy: actorId, approvalId, idempotencyKey: idempotencyKey || undefined });
  const controller = new AbortController();
  activeRuns.set(String(run._id), controller);
  activeCommandCount += 1;
  try {
    run.status = "RUNNING";
    run.startedAt = new Date();
    await run.save();
    await auditCodingEvent({ codingTask, actorId, eventType: "CODE_COMMAND_STARTED", action: `Started allowlisted command ${command.commandId}`, metadata: { commandRunId: run._id, commandId: command.commandId }, requestContext });
    const result = await executeBoundedProcess({ executable: command.executable, args: command.arguments, cwd: root, timeoutMs: Math.min(command.timeoutSeconds, settings.commandTimeoutSeconds) * 1000, maximumOutputBytes: settings.maximumCommandOutputBytes, signal: controller.signal });
    const cancelled = controller.signal.aborted && !result.timedOut;
    run.status = result.timedOut ? "TIMEOUT" : cancelled ? "CANCELLED" : result.exitCode === 0 ? "COMPLETED" : "FAILED";
    run.resultClassification = result.timedOut ? "TIMED_OUT" : cancelled ? "CANCELLED" : result.exitCode === 0 ? "PASSED" : "FAILED";
    run.failureAttribution = result.exitCode === 0 ? "NOT_APPLICABLE" : "INSUFFICIENT_EVIDENCE";
    run.exitCode = result.exitCode;
    run.stdoutPreview = result.stdout;
    run.stderrPreview = result.stderr;
    run.timedOut = result.timedOut;
    run.completedAt = new Date();
    await run.save();
    if (patchId) await captureRepositorySnapshot({ codingTask, patchId, snapshotType: "AFTER_VALIDATION" });
    await auditCodingEvent({ codingTask, actorId, eventType: result.exitCode === 0 ? "CODE_COMMAND_COMPLETED" : result.timedOut ? "CODE_COMMAND_TIMED_OUT" : "CODE_COMMAND_FAILED", action: `Allowlisted command ${command.commandId} finished`, metadata: { commandRunId: run._id, commandId: command.commandId, exitCode: result.exitCode, timedOut: result.timedOut, outputTruncated: result.outputTruncated }, requestContext });
    return run;
  } catch (error) {
    run.status = "FAILED";
    run.resultClassification = "FAILED";
    run.failureAttribution = "INSUFFICIENT_EVIDENCE";
    run.stderrPreview = "The registered process could not be started or recorded safely.";
    run.completedAt = new Date();
    await run.save().catch(() => {});
    await auditCodingEvent({ codingTask, actorId, eventType: "CODE_COMMAND_FAILED", action: `Allowlisted command ${command.commandId} failed safely`, details: error.message, metadata: { commandRunId: run._id, commandId: command.commandId, code: error.code }, requestContext }).catch(() => {});
    throw error;
  } finally {
    activeCommandCount -= 1;
    activeRuns.delete(String(run._id));
  }
};

export const cancelSafeCommand = async ({ commandRunId, actorId, codingTask, requestContext }) => {
  const controller = activeRuns.get(String(commandRunId));
  const run = await OGCodeCommandRun.findOne({ _id: commandRunId, codingTaskId: codingTask._id });
  if (!run) throw Object.assign(new Error("Command run was not found"), { statusCode: 404, code: "COMMAND_RUN_NOT_FOUND" });
  if (!controller || run.status !== "RUNNING") throw Object.assign(new Error("Command run is no longer cancellable"), { statusCode: 409, code: "COMMAND_NOT_RUNNING" });
  run.cancellationRequestedAt = new Date();
  await run.save();
  controller.abort();
  await auditCodingEvent({ codingTask, actorId, eventType: "CODE_COMMAND_CANCELLATION_REQUESTED", action: "Requested safe command cancellation", metadata: { commandRunId }, requestContext });
  return run;
};
