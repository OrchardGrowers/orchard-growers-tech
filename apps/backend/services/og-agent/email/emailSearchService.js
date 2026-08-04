import OGAgentLeadCandidate from "../../../models/OGAgentLeadCandidate.js";
import { getEmailSourceAdapter } from "./emailSourceRegistry.js";

export const searchSynchronizedMessages = async ({ sourceId, filters, maximumMessages }) => {
  const adapter = await getEmailSourceAdapter(sourceId);
  let excludedSourceReferences = [];
  if (filters.ignorePreviouslyProcessed) {
    excludedSourceReferences = await OGAgentLeadCandidate.distinct("source.sourceReference", { "source.mailbox": sourceId });
  }
  return adapter.searchMessages(filters, { limit: maximumMessages, excludedSourceReferences });
};

export const getSafeSynchronizedMessage = async ({ sourceId, sourceReference }) => {
  const adapter = await getEmailSourceAdapter(sourceId);
  const message = await adapter.getSafeMessageContent(sourceReference);
  if (!message) {
    const error = new Error("The synchronized source message is unavailable");
    error.statusCode = 404;
    error.code = "EMAIL_MESSAGE_UNAVAILABLE";
    throw error;
  }
  return message;
};
