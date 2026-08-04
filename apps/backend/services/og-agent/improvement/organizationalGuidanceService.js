import OGAgentOrganizationalGuidance from "../../../models/OGAgentOrganizationalGuidance.js";
export const reviewGuidance = async ({ guidanceId, actorId, approve, securityApproved = false }) => {
  const item = await OGAgentOrganizationalGuidance.findById(guidanceId);
  if (!item) { const error = new Error("Guidance was not found"); error.statusCode = 404; throw error; }
  item.status = approve ? "APPROVED" : "REJECTED"; item.securityApproved = approve && securityApproved; item.reviewedBy = actorId; return item.save();
};
export const activateGuidance = async ({ guidanceId, actorId }) => {
  const item = await OGAgentOrganizationalGuidance.findById(guidanceId);
  if (!item || item.status !== "APPROVED" || !item.securityApproved) { const error = new Error("Reviewed security-approved guidance is required"); error.statusCode = 409; throw error; }
  item.status = "ACTIVE"; item.activatedAt = new Date(); item.reviewedBy ||= actorId; return item.save();
};
