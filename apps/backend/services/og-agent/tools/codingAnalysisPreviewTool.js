export const codingAnalysisPreviewTool = {
  name: "coding_analysis_preview",
  description: "Prepares a code-analysis plan without reading, changing, or executing production code.",
  riskLevel: "LOW",
  approvalRequired: false,
  enabled: true,
  supportedTaskTypes: ["CODING_ANALYSIS"],
  settingsFlag: "allowCodeAnalysis",
  execute: ({ task, provider }) => provider.executeTask({ task }),
};

export default codingAnalysisPreviewTool;
