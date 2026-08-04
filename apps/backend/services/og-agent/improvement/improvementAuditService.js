import { createOGAgentAuditLog } from "../ogAgentAuditService.js";
export const auditImprovementEvent = ({ eventType, action, actorId, taskId = null, details = "", metadata = {}, requestContext = {} }) => createOGAgentAuditLog({ actorType: "ADMIN", eventType, action, actorId, taskId, details, metadata, requestContext });
