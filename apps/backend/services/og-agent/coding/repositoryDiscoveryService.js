import fs from "node:fs/promises";
import path from "node:path";
import { auditFileAccess } from "./codingAuditService.js";
import { classifyRepositoryPath, normalizeRepositoryPath } from "./repositoryPolicyService.js";
import { resolveRepositoryPath } from "./repositoryPathService.js";

const walk = async (absolute, relative, depth, maxDepth, entries, maxEntries) => {
  if (depth > maxDepth || entries.length >= maxEntries) return;
  const children = await fs.readdir(absolute, { withFileTypes: true });
  for (const child of children) {
    if (entries.length >= maxEntries) break;
    const childRelative = normalizeRepositoryPath(path.posix.join(relative, child.name));
    if (!classifyRepositoryPath(childRelative).allowed || child.isSymbolicLink()) continue;
    entries.push({ path: childRelative, type: child.isDirectory() ? "DIRECTORY" : "FILE" });
    if (child.isDirectory()) await walk(path.join(absolute, child.name), childRelative, depth + 1, maxDepth, entries, maxEntries);
  }
};

export const getRepositoryStructure = async ({ codingTask, paths, depth = 2, actorId, requestContext, settings }) => {
  const entries = [];
  const selected = Array.isArray(paths) && paths.length ? paths : codingTask.allowedPaths;
  const maxEntries = Math.min(Number(settings.maximumFilesPerTask || 100) * 2, 500);
  for (const scope of selected.slice(0, 12)) {
    const resolved = await resolveRepositoryPath(scope, { allowedPaths: codingTask.allowedPaths });
    const stat = await fs.stat(resolved.absolutePath);
    entries.push({ path: resolved.relativePath, type: stat.isDirectory() ? "DIRECTORY" : "FILE" });
    if (stat.isDirectory()) await walk(resolved.absolutePath, resolved.relativePath, 1, Math.min(Math.max(Number(depth) || 2, 1), 4), entries, maxEntries);
  }
  await auditFileAccess({ codingTask, actorId, operation: "LIST", path: selected.join(", "), allowed: true, reason: "APPROVED_SCOPE", requestContext });
  return { entries, truncated: entries.length >= maxEntries };
};
