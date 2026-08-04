import path from "node:path";

export const DEFAULT_ALLOWED_SCOPES = Object.freeze([
  "apps/backend", "apps/efruitmandi-frontend", "apps/admin-panel", "packages/shared-ui",
  "packages/shared-types", "packages/shared-config", "docs",
]);

export const ROOT_CONFIGURATION_FILES = Object.freeze([
  "package.json", "turbo.json", "tsconfig.json", ".gitignore", "README.md",
]);

const deniedDirectoryNames = new Set([
  "node_modules", ".git", "dist", "build", "coverage", "backups", "backup", "dumps", "dump",
  "uploads", ".next", "out", ".cache", ".turbo", "logs", "tmp", "temp",
]);

const deniedExactNames = new Set([
  ".env", "id_rsa", "id_ed25519", "credentials", "secrets", "token",
]);

const deniedSuffixes = [".pem", ".key", ".p12", ".pfx", ".crt", ".dump", ".db", ".sqlite", ".sqlite3"];
const credentialJsonPattern = /^(auth|credentials?|secrets?|tokens?|service-account).*\.json$/i;
const environmentPattern = /^\.env(?:\..+)?$/i;
const sensitiveNamePattern = /(?:credential|secret|private[-_]?key|access[-_]?token|refresh[-_]?token|service[-_]?account)/i;
const obviousSecretContent = /(?:-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:api[_-]?key|client[_-]?secret|access[_-]?token|password)\s*[:=]\s*["']?[A-Za-z0-9_+\-/=]{12,})/i;

const highRiskPatterns = [
  /(?:^|\/)(?:auth|authentication|authorization|permissions?|roles?)(?:\/|\.|$)/i,
  /(?:payment|razorpay|escrow|webhook|kyc|migration|cors|security|middleware|upload|encryption|backup|deploy)/i,
  /(?:^|\/)(?:server|app)\.(?:js|ts)$/i,
  /(?:production|\.github\/workflows|dockerfile|docker-compose|kubernetes|helm)/i,
];

export const normalizeRepositoryPath = (value) => String(value || "").replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/{2,}/g, "/");

export const classifyRepositoryPath = (repositoryPath) => {
  const normalized = normalizeRepositoryPath(repositoryPath);
  const segments = normalized.toLowerCase().split("/").filter(Boolean);
  const basename = path.posix.basename(normalized).toLowerCase();
  if (segments.some((segment) => deniedDirectoryNames.has(segment))) return { allowed: false, reason: "DENIED_DIRECTORY" };
  if (deniedExactNames.has(basename) || environmentPattern.test(basename)) return { allowed: false, reason: "SENSITIVE_FILE" };
  if (deniedSuffixes.some((suffix) => basename.endsWith(suffix)) || /\.bak(?:\.|$)/i.test(basename)) return { allowed: false, reason: "SENSITIVE_SUFFIX" };
  if (credentialJsonPattern.test(basename) || sensitiveNamePattern.test(basename)) return { allowed: false, reason: "SENSITIVE_FILENAME" };
  if (/\.(?:png|jpe?g|gif|webp|ico|pdf|zip|gz|tar|7z|exe|dll|so|woff2?|ttf|mp[34]|mov|avi)$/i.test(basename)) {
    return { allowed: false, reason: "BINARY_OR_ARCHIVE_FILE" };
  }
  return { allowed: true, reason: "SAFE_PATH" };
};

export const isPathInsideAllowedScopes = (repositoryPath, allowedPaths = []) => {
  const normalized = normalizeRepositoryPath(repositoryPath);
  return allowedPaths.some((allowed) => {
    const scope = normalizeRepositoryPath(allowed).replace(/\/$/, "");
    return normalized === scope || normalized.startsWith(`${scope}/`);
  });
};

export const validateAllowedScopes = (allowedPaths) => {
  if (!Array.isArray(allowedPaths) || allowedPaths.length < 1 || allowedPaths.length > 12) {
    const error = new Error("Select between 1 and 12 repository scopes");
    error.statusCode = 400;
    error.code = "INVALID_REPOSITORY_SCOPE";
    throw error;
  }
  const normalized = [...new Set(allowedPaths.map(normalizeRepositoryPath))];
  for (const scope of normalized) {
    const approved = DEFAULT_ALLOWED_SCOPES.includes(scope) || ROOT_CONFIGURATION_FILES.includes(scope);
    if (!approved) {
      const error = new Error(`Repository scope is not approved: ${scope}`);
      error.statusCode = 400;
      error.code = "INVALID_REPOSITORY_SCOPE";
      throw error;
    }
  }
  return normalized;
};

export const classifyRisk = (repositoryPath) => highRiskPatterns.some((pattern) => pattern.test(normalizeRepositoryPath(repositoryPath))) ? "HIGH" : "LOW";

export const containsObviousSecret = (content) => obviousSecretContent.test(String(content || ""));

export const redactSensitiveOutput = (value = "") => String(value)
  .replace(/-----BEGIN[\s\S]{0,200}?PRIVATE KEY-----/gi, "[REDACTED_PRIVATE_KEY]")
  .replace(/(Bearer\s+)[A-Za-z0-9._~+\-/=]+/gi, "$1[REDACTED]")
  .replace(/((?:password|token|secret|api[_-]?key|authorization)\s*[:=]\s*)[^\s,;]+/gi, "$1[REDACTED]");

export const isLikelyBinary = (buffer) => {
  const sample = buffer.subarray(0, Math.min(buffer.length, 8000));
  if (sample.includes(0)) return true;
  let suspicious = 0;
  for (const byte of sample) if (byte < 7 || (byte > 13 && byte < 32)) suspicious += 1;
  return sample.length > 0 && suspicious / sample.length > 0.1;
};
