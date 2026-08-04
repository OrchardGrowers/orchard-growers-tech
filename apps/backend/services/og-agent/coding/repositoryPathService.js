import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { classifyRepositoryPath, isPathInsideAllowedScopes, normalizeRepositoryPath } from "./repositoryPolicyService.js";

const configuredRoot = path.resolve(fileURLToPath(new URL("../../../../../", import.meta.url)));
let canonicalRootPromise;

export const getRepositoryRoot = async () => {
  canonicalRootPromise ||= fs.realpath(configuredRoot);
  return canonicalRootPromise;
};

const pathError = (message, code = "REPOSITORY_PATH_DENIED") => {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = code;
  return error;
};

export const assertCanonicalPathInsideRoot = (root, candidate) => {
  const relative = path.relative(root, candidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw pathError("Symbolic-link escape is prohibited", "SYMLINK_ESCAPE_DENIED");
  return true;
};

export const validateRepositoryRelativePath = (input) => {
  if (typeof input !== "string" || !input.trim() || input.length > 500) throw pathError("Repository path is invalid");
  if (input.includes("\0") || /%00/i.test(input)) throw pathError("Repository path contains a null byte");
  let decoded = input;
  try { decoded = decodeURIComponent(input); } catch { throw pathError("Repository path encoding is malformed"); }
  if (/^(?:[a-z]:[\\/]|\\\\|\/)/i.test(decoded) || decoded.includes(":")) throw pathError("Absolute, UNC, and drive-qualified paths are prohibited");
  const normalized = normalizeRepositoryPath(path.posix.normalize(decoded.replace(/\\/g, "/")));
  if (!normalized || normalized === "." || normalized === ".." || normalized.startsWith("../") || normalized.includes("/../")) {
    throw pathError("Path traversal is prohibited");
  }
  return normalized;
};

const findExistingAncestor = async (absolutePath) => {
  let candidate = absolutePath;
  while (candidate !== path.dirname(candidate)) {
    try { return { path: candidate, real: await fs.realpath(candidate) }; }
    catch (error) { if (error.code !== "ENOENT") throw error; }
    candidate = path.dirname(candidate);
  }
  throw pathError("Repository path has no valid ancestor");
};

export const resolveRepositoryPath = async (input, { allowedPaths, mustExist = true } = {}) => {
  const relativePath = validateRepositoryRelativePath(input);
  const policy = classifyRepositoryPath(relativePath);
  if (!policy.allowed) throw pathError("Repository path is denied by security policy", policy.reason);
  if (!isPathInsideAllowedScopes(relativePath, allowedPaths || [])) throw pathError("Repository path is outside the approved task scope", "PATH_OUTSIDE_TASK_SCOPE");

  const root = await getRepositoryRoot();
  const absolutePath = path.resolve(root, ...relativePath.split("/"));
  const relativeToRoot = path.relative(root, absolutePath);
  if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) throw pathError("Repository path escapes the project root");

  if (mustExist) {
    let real;
    try { real = await fs.realpath(absolutePath); }
    catch (error) {
      if (error.code === "ENOENT") throw pathError("Repository path was not found", "REPOSITORY_PATH_NOT_FOUND");
      throw error;
    }
    assertCanonicalPathInsideRoot(root, real);
    return { root, relativePath, absolutePath: real };
  }

  const ancestor = await findExistingAncestor(absolutePath);
  assertCanonicalPathInsideRoot(root, ancestor.real);
  return { root, relativePath, absolutePath };
};

export const repositoryRootLabel = "Orchard_Growers_Tech";
