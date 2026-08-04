import mockAIProvider from "./providers/mockAIProvider.js";
import { detectProhibitedAction, selectToolForTask } from "./ogAgentToolRegistry.js";

export const planOGAgentTask = async (task, { provider = mockAIProvider } = {}) => {
  const prohibitedAction = detectProhibitedAction(`${task.title}\n${task.prompt}`);
  if (prohibitedAction) {
    return {
      blockedAction: prohibitedAction,
      tool: null,
      plan: [],
      riskLevel: "HIGH",
      approvalRequired: false,
    };
  }

  const tool = selectToolForTask(task);
  if (!tool || !tool.enabled) {
    const error = new Error("No enabled Phase 1 tool supports this task");
    error.statusCode = 422;
    error.code = "TOOL_UNAVAILABLE";
    throw error;
  }

  const plan = await provider.generateTaskPlan({ task, tool });
  return {
    blockedAction: null,
    tool,
    plan,
    riskLevel: tool.riskLevel,
    approvalRequired: tool.approvalRequired,
  };
};

export default planOGAgentTask;
