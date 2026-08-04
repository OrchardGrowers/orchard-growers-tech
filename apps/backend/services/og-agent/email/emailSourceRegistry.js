import BusinessMailboxAdapter from "./businessMailboxAdapter.js";

const adapters = new Map([["career-applications", new BusinessMailboxAdapter()]]);

export const listAvailableEmailSources = async () => {
  const sources = await Promise.all([...adapters.values()].map((adapter) => adapter.describe()));
  return sources.filter(Boolean);
};

export const getEmailSourceAdapter = async (sourceId) => {
  const adapter = adapters.get(String(sourceId || ""));
  if (!adapter || !(await adapter.isAvailable())) {
    const error = new Error("No synchronized business mailbox configured");
    error.statusCode = 503;
    error.code = "EMAIL_SOURCE_UNAVAILABLE";
    throw error;
  }
  return adapter;
};
