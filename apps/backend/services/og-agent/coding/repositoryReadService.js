import crypto from "node:crypto";
import fs from "node:fs/promises";
import OGCodingTask from "../../../models/OGCodingTask.js";
import { auditFileAccess } from "./codingAuditService.js";
import { isLikelyBinary } from "./repositoryPolicyService.js";
import { resolveRepositoryPath } from "./repositoryPathService.js";

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

export const readRepositoryFile = async ({ codingTask, path, startLine = 1, endLine = 250, actorId, requestContext, settings }) => {
  let resolved;
  try {
    resolved = await resolveRepositoryPath(path, { allowedPaths: codingTask.allowedPaths });
    const statBefore = await fs.stat(resolved.absolutePath);
    if (!statBefore.isFile()) throw Object.assign(new Error("Repository path is not a file"), { statusCode: 400, code: "NOT_A_FILE" });
    const maximumBytes = Math.min(Number(settings.maximumBytesPerFile || 200000), 1000000);
    if (statBefore.size > maximumBytes) throw Object.assign(new Error("Repository file exceeds the configured read limit"), { statusCode: 413, code: "FILE_TOO_LARGE" });
    const totalLimit = Number(settings.maximumTotalReadBytesPerTask || 2000000);
    if (codingTask.totalReadBytes + statBefore.size > totalLimit) throw Object.assign(new Error("Coding task has reached its repository read budget"), { statusCode: 413, code: "TASK_READ_LIMIT_REACHED" });

    const buffer = await fs.readFile(resolved.absolutePath);
    const statAfter = await fs.stat(resolved.absolutePath);
    if (statAfter.mtimeMs !== statBefore.mtimeMs || statAfter.size !== statBefore.size) throw Object.assign(new Error("Repository file changed during read"), { statusCode: 409, code: "FILE_CHANGED_DURING_READ" });
    if (isLikelyBinary(buffer)) throw Object.assign(new Error("Binary repository files cannot be read"), { statusCode: 415, code: "BINARY_FILE_DENIED" });

    const hash = sha256(buffer);
    const lines = buffer.toString("utf8").replace(/\r\n/g, "\n").split("\n");
    const from = Math.max(1, Number(startLine) || 1);
    const to = Math.min(lines.length, Math.max(from, Number(endLine) || from + 249), from + 499);
    const content = lines.slice(from - 1, to).join("\n");
    await OGCodingTask.updateOne({ _id: codingTask._id }, { $inc: { totalReadBytes: buffer.length } });
    codingTask.totalReadBytes += buffer.length;
    await auditFileAccess({ codingTask, actorId, operation: "READ", path: resolved.relativePath, allowed: true, reason: "APPROVED_SCOPE", bytesRead: buffer.length, contentHash: hash, requestContext });
    return { path: resolved.relativePath, startLine: from, endLine: to, totalLines: lines.length, content, bytesRead: buffer.length, contentHash: hash, truncated: to < lines.length };
  } catch (error) {
    await auditFileAccess({ codingTask, actorId, operation: "READ", path: String(path || ""), allowed: false, reason: error.code || "READ_BLOCKED", requestContext }).catch(() => {});
    throw error;
  }
};
