import OGCodingTask from "../../../models/OGCodingTask.js";
import { auditCodingEvent } from "./codingAuditService.js";
import { getCodingProvider } from "./codingProvider.js";
import { getRepositoryState } from "./gitReadOnlyService.js";
import { classifyRisk } from "./repositoryPolicyService.js";
import { readRepositoryFile } from "./repositoryReadService.js";
import { searchRepository } from "./repositorySearchService.js";
import { captureRepositorySnapshot } from "./repositorySnapshotService.js";

const acquireAnalysisLock = async (codingTaskId) => {
  const now = new Date();
  const lockExpiresAt = new Date(now.getTime() + 5 * 60 * 1000);
  const task = await OGCodingTask.findOneAndUpdate(
    { _id: codingTaskId, status: { $nin: ["CANCELLED", "COMPLETED"] }, $or: [{ operationLock: "NONE" }, { lockExpiresAt: { $lte: now } }] },
    { $set: { operationLock: "ANALYSIS", lockExpiresAt, analysisStatus: "DISCOVERING", status: "ANALYZING" } },
    { new: true }
  ).populate("taskId");
  if (!task) throw Object.assign(new Error("Coding task is busy or cannot be analyzed in its current state"), { statusCode: 409, code: "CODING_TASK_BUSY" });
  return task;
};

export const analyzeCodingTask = async ({ codingTaskId, actorId, requestContext, settings }) => {
  const codingTask = await acquireAnalysisLock(codingTaskId);
  try {
    const repositoryState = await getRepositoryState();
    await captureRepositorySnapshot({ codingTask, snapshotType: "BEFORE_ANALYSIS", paths: codingTask.fileHints });
    codingTask.analysisStatus = "ANALYZING";
    await codingTask.save();
    const inspectedFiles = [];
    for (const fileHint of codingTask.fileHints.slice(0, Math.min(settings.maximumFilesPerTask, 20))) {
      try {
        inspectedFiles.push(await readRepositoryFile({ codingTask, path: fileHint, startLine: 1, endLine: 500, actorId, requestContext, settings }));
      } catch (error) {
        if (!["REPOSITORY_PATH_NOT_FOUND", "BINARY_FILE_DENIED", "FILE_TOO_LARGE"].includes(error.code)) throw error;
      }
    }
    const promptTerms = String(codingTask.taskId?.prompt || "").match(/[A-Za-z_$][A-Za-z0-9_$-]{3,}/g) || [];
    const searchTerm = [...new Set(promptTerms)].find((term) => !/^(this|that|with|from|when|should|must|have|into|current|expected)$/i.test(term));
    const search = searchTerm ? await searchRepository({ codingTask, query: searchTerm, paths: codingTask.allowedPaths, actorId, requestContext, settings }) : { results: [] };
    const provider = getCodingProvider();
    const relevantPaths = await provider.selectRelevantFiles({ task: codingTask, inspectedFiles, searchResults: search.results });
    const analysis = await provider.analyzeCodingTask({ task: codingTask, inspectedFiles, searchResults: search.results, repositoryState });
    codingTask.relevantFiles = relevantPaths.map((path) => {
      const inspected = inspectedFiles.find((file) => file.path === path);
      return { path, reason: inspected ? "Explicit file hint inspected during bounded analysis." : "Deterministic provider selected this path from bounded search or task hints.", readStatus: inspected ? "READ" : "NOT_READ", riskLevel: classifyRisk(path), contentHash: inspected?.contentHash || "" };
    });
    codingTask.repositoryFindings = { branch: repositoryState.branch, commit: repositoryState.commit, dirty: repositoryState.dirty, searchedTerm: searchTerm || "", searchResultCount: search.results.length, filesInspected: inspectedFiles.map((file) => file.path) };
    codingTask.analysis = analysis;
    codingTask.riskLevel = codingTask.relevantFiles.some((file) => file.riskLevel === "HIGH") ? "HIGH" : "LOW";
    codingTask.analysisStatus = "REVIEW_READY";
    codingTask.status = "REVIEW_READY";
    codingTask.operationLock = "NONE";
    codingTask.lockExpiresAt = null;
    await codingTask.save();
    await auditCodingEvent({ codingTask, actorId, eventType: "CODE_ANALYSIS_GENERATED", action: "Generated bounded Coding Agent analysis", metadata: { relevantFiles: codingTask.relevantFiles.map((file) => file.path), confidence: analysis.confidence, repositoryCommit: repositoryState.commit }, requestContext });
    return codingTask;
  } catch (error) {
    await OGCodingTask.updateOne({ _id: codingTaskId }, { $set: { analysisStatus: "FAILED", status: "FAILED", operationLock: "NONE", lockExpiresAt: null } });
    await auditCodingEvent({ codingTask, actorId, eventType: "CODE_ANALYSIS_FAILED", action: "Coding Agent analysis failed safely", details: error.message, metadata: { code: error.code }, requestContext }).catch(() => {});
    throw error;
  }
};
