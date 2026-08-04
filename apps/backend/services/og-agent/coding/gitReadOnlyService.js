import crypto from "node:crypto";
import { getRepositoryRoot } from "./repositoryPathService.js";
import { executeBoundedProcess } from "./processExecutionService.js";

const git = async (args, options = {}) => {
  const root = await getRepositoryRoot();
  const result = await executeBoundedProcess({ executable: "git", args, cwd: root, timeoutMs: options.timeoutMs || 15000, maximumOutputBytes: options.maximumOutputBytes || 200000 });
  if (result.exitCode !== 0) {
    const error = new Error("Repository Git metadata could not be read");
    error.statusCode = 503;
    error.code = "GIT_READ_FAILED";
    error.safeResult = result;
    throw error;
  }
  return result.stdout.trim();
};

export const getGitStatusPorcelain = () => git(["status", "--short", "--untracked-files=all"]);
export const getCurrentBranch = () => git(["branch", "--show-current"]);
export const getCurrentCommit = () => git(["rev-parse", "HEAD"]);
export const getGitDiffNameOnly = () => git(["diff", "--name-only"]);
export const getGitDiffStat = () => git(["diff", "--stat"]);

export const parseGitStatus = (status = "") => {
  const records = String(status).split(/\r?\n/).filter(Boolean).map((line) => ({ code: line.slice(0, 2), path: line.slice(3).replace(/\\/g, "/") }));
  return {
    records,
    modifiedFiles: records.filter((record) => record.code !== "??").map((record) => record.path),
    stagedFiles: records.filter((record) => record.code[0] !== " " && record.code[0] !== "?").map((record) => record.path),
    untrackedFiles: records.filter((record) => record.code === "??").map((record) => record.path),
    dirty: records.length > 0,
  };
};

export const getRepositoryState = async () => {
  const [branch, commit, status, diffStat] = await Promise.all([getCurrentBranch(), getCurrentCommit(), getGitStatusPorcelain(), getGitDiffStat()]);
  const parsed = parseGitStatus(status);
  const workingTreeHash = crypto.createHash("sha256").update(`${branch}\n${commit}\n${status}`).digest("hex");
  return { branch, commit, status, diffStat, workingTreeHash, ...parsed };
};

export const assertValidBranchName = (value) => {
  const branch = String(value || "").trim();
  if (!/^og-agent\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(branch) || branch.length > 120) {
    const error = new Error("Local branch name must match og-agent/<safe-slug>");
    error.statusCode = 400;
    error.code = "INVALID_BRANCH_NAME";
    throw error;
  }
  return branch;
};
