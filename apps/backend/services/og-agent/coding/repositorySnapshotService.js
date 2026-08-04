import crypto from "node:crypto";
import fs from "node:fs/promises";
import OGRepositorySnapshot from "../../../models/OGRepositorySnapshot.js";
import { getRepositoryState } from "./gitReadOnlyService.js";
import { resolveRepositoryPath } from "./repositoryPathService.js";

const sha256 = (buffer) => crypto.createHash("sha256").update(buffer).digest("hex");

export const captureRepositorySnapshot = async ({ codingTask, patchId = null, snapshotType, paths = [] }) => {
  const state = await getRepositoryState();
  const trackedFileHashes = {};
  for (const repositoryPath of [...new Set(paths)].slice(0, 100)) {
    try {
      const resolved = await resolveRepositoryPath(repositoryPath, { allowedPaths: codingTask.allowedPaths });
      const stat = await fs.stat(resolved.absolutePath);
      if (stat.isFile() && stat.size <= 1000000) trackedFileHashes[resolved.relativePath] = sha256(await fs.readFile(resolved.absolutePath));
    } catch (error) {
      if (error.code === "REPOSITORY_PATH_NOT_FOUND") trackedFileHashes[repositoryPath] = "[MISSING]";
      else throw error;
    }
  }
  return OGRepositorySnapshot.create({
    codingTaskId: codingTask._id,
    patchId,
    snapshotType,
    gitCommit: state.commit,
    branchName: state.branch,
    gitStatusSummary: state.status.slice(0, 12000),
    workingTreeHash: state.workingTreeHash,
    trackedFileHashes,
    untrackedFilesSummary: state.untrackedFiles.slice(0, 500),
    modifiedFiles: state.modifiedFiles.slice(0, 500),
    stagedFiles: state.stagedFiles.slice(0, 500),
  });
};

export const listRepositorySnapshots = (codingTaskId) => OGRepositorySnapshot.find({ codingTaskId }).sort({ createdAt: -1 }).lean();
