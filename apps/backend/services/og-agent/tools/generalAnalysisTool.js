export const generalAnalysisTool = {
  name: "general_analysis",
  description: "Produces a structured analysis using only the task prompt.",
  riskLevel: "LOW",
  approvalRequired: false,
  enabled: true,
  supportedTaskTypes: ["GENERAL", "EMAIL_ANALYSIS", "GROWER_RESEARCH", "BUYER_RESEARCH", "SEO_ANALYSIS"],
  settingsFlag: "allowReadOnlyDatabaseSearch",
  execute: ({ task, provider }) => provider.executeTask({ task }),
};

export default generalAnalysisTool;
