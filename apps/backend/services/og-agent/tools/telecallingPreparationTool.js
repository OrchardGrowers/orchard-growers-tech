export const telecallingPreparationTool = {
  name: "telecalling_preparation",
  description: "Creates a call script and questions without initiating a real call.",
  riskLevel: "LOW",
  approvalRequired: false,
  enabled: true,
  supportedTaskTypes: ["TELECALLING_PREPARATION"],
  settingsFlag: "allowTelecallingPreparation",
  execute: ({ task, provider }) => provider.executeTask({ task }),
};

export default telecallingPreparationTool;
