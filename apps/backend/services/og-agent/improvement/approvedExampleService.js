import OGAgentApprovedExample from "../../../models/OGAgentApprovedExample.js";
export const reviewApprovedExample = async ({ exampleId, actorId, approve }) => {
  const item = await OGAgentApprovedExample.findById(exampleId);
  if (!item) { const error = new Error("Approved example was not found"); error.statusCode = 404; throw error; }
  item.status = approve ? "ACTIVE" : "REJECTED"; item.reviewedBy = actorId; item.reviewedAt = new Date(); return item.save();
};
