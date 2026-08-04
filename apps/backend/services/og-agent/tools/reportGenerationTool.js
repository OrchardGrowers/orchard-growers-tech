export const reportGenerationTool = {
  name: "report_generation",
  description: "Creates a read-only report from information included in the task prompt.",
  riskLevel: "LOW",
  approvalRequired: false,
  enabled: true,
  supportedTaskTypes: ["REPORT_GENERATION"],
  settingsFlag: "allowReportGeneration",
  execute: ({ task, provider }) => provider.executeTask({ task }),
};

export default reportGenerationTool;
