import { createOGAgentAuditLog } from "../ogAgentAuditService.js";
export const auditResearchEvent = ({ taskId = null, actorId, eventType, action, details = "", metadata = {}, requestContext = {} }) => createOGAgentAuditLog({ taskId, actorId, actorType: "ADMIN", eventType, action, details: String(details).slice(0, 1000), metadata, requestContext });
