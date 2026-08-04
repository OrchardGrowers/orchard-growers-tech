import { createOGAgentAuditLog, sanitizeAuditValue } from "../ogAgentAuditService.js";

export const auditCodingEvent = ({ codingTask, actorId = null, actorType = "ADMIN", eventType, action, details = "", metadata = {}, requestContext = {} }) =>
  createOGAgentAuditLog({
    taskId: codingTask?.taskId || null,
    actorId,
    actorType,
    eventType,
    action,
    details,
    metadata: sanitizeAuditValue({ codingTaskId: codingTask?._id, ...metadata }),
    requestContext,
  });

export const auditFileAccess = ({ codingTask, actorId, operation, path, allowed, reason, bytesRead = 0, contentHash = "", requestContext }) =>
  auditCodingEvent({
    codingTask, actorId, eventType: allowed ? `CODE_FILE_${operation}` : "CODE_FILE_ACCESS_DENIED",
    action: `${allowed ? "Allowed" : "Blocked"} repository ${operation.toLowerCase()}`,
    details: allowed ? path : "A repository path was blocked by policy.",
    metadata: { operation, path: allowed ? path : "[DENIED_PATH]", allowed, reason, bytesRead, contentHash },
    requestContext,
  });
