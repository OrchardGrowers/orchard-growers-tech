import mockAIProvider from "./providers/mockAIProvider.js";
import { getOGAgentTool } from "./ogAgentToolRegistry.js";

export const executeOGAgentTask = async (task, settings, { provider = mockAIProvider } = {}) => {
  const toolName = task.plan?.[0]?.tool;
  const tool = getOGAgentTool(toolName);
  if (!tool || !tool.enabled) {
    const error = new Error("The planned tool is unavailable or disabled");
    error.statusCode = 422;
    error.code = "TOOL_UNAVAILABLE";
    throw error;
  }
  if (tool.settingsFlag && settings[tool.settingsFlag] !== true) {
    const error = new Error(`${tool.description} is disabled in OG Agent safety settings`);
    error.statusCode = 403;
    error.code = "TOOL_DISABLED_BY_SETTINGS";
    throw error;
  }

  const result = await tool.execute({ task, settings, provider });
  return {
    summary: await provider.generateSummary({ task, result }),
    data: result.data || {},
    recommendations: Array.isArray(result.recommendations) ? result.recommendations.slice(0, 50) : [],
  };
};

export default executeOGAgentTask;
