import OGAgentAuditLog from "../../models/OGAgentAuditLog.js";

const sensitiveKeyPattern = /(password|token|secret|authorization|cookie|api.?key|private.?key)/i;

export const sanitizeAuditValue = (value, depth = 0) => {
  if (depth > 5) return "[TRUNCATED]";
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => sanitizeAuditValue(item, depth + 1));
  if (!value || typeof value !== "object") {
    return typeof value === "string" && value.length > 2000 ? `${value.slice(0, 2000)}…` : value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      sensitiveKeyPattern.test(key) ? "[REDACTED]" : sanitizeAuditValue(item, depth + 1),
    ])
  );
};

export const getRequestAuditContext = (req = {}) => ({
  ipAddress: String(req.ip || req.socket?.remoteAddress || "").slice(0, 100),
  userAgent: String(req.get?.("user-agent") || req.headers?.["user-agent"] || "").slice(0, 1000),
});

export const createOGAgentAuditLog = async ({
  taskId = null,
  actorId = null,
  actorType,
  eventType,
  action,
  details = "",
  metadata = {},
  requestContext = {},
}) => OGAgentAuditLog.create({
  taskId,
  actorId,
  actorType,
  eventType,
  action,
  details: String(details || "").slice(0, 4000),
  metadata: sanitizeAuditValue(metadata),
  ipAddress: String(requestContext.ipAddress || "").slice(0, 100),
  userAgent: String(requestContext.userAgent || "").slice(0, 1000),
});

export const listOGAgentAuditLogs = ({ filter = {}, page = 1, limit = 50 }) =>
  Promise.all([
    OGAgentAuditLog.find(filter)
      .populate("actorId", "name email role adminClass")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    OGAgentAuditLog.countDocuments(filter),
  ]);
