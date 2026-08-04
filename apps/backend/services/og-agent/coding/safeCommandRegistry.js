const npmExecutable = process.platform === "win32" ? "npm.cmd" : "npm";

export const SAFE_COMMAND_DEFINITIONS = Object.freeze([
  { commandId: "git_status", label: "Git status", executable: "git", arguments: ["status", "--short", "--untracked-files=all"], workingDirectory: ".", category: "STATUS", riskLevel: "LOW", approvalRequired: false, timeoutSeconds: 15 },
  { commandId: "git_diff_stat", label: "Git diff statistics", executable: "git", arguments: ["diff", "--stat"], workingDirectory: ".", category: "DIFF_CHECK", riskLevel: "LOW", approvalRequired: false, timeoutSeconds: 15 },
  { commandId: "git_diff_names", label: "Changed file names", executable: "git", arguments: ["diff", "--name-only"], workingDirectory: ".", category: "DIFF_CHECK", riskLevel: "LOW", approvalRequired: false, timeoutSeconds: 15 },
  { commandId: "git_diff_check", label: "Git whitespace check", executable: "git", arguments: ["diff", "--check"], workingDirectory: ".", category: "FORMAT_CHECK", riskLevel: "LOW", approvalRequired: false, timeoutSeconds: 30 },
  { commandId: "backend_tests", label: "Backend tests", executable: npmExecutable, arguments: ["test", "--workspace", "@efruitmandi/backend", "--", "--run"], workingDirectory: ".", category: "TEST", riskLevel: "MEDIUM", approvalRequired: true, timeoutSeconds: 300 },
  { commandId: "admin_typecheck_build", label: "Admin TypeScript and build", executable: npmExecutable, arguments: ["run", "build", "--workspace", "@efruitmandi/admin-panel"], workingDirectory: ".", category: "BUILD", riskLevel: "MEDIUM", approvalRequired: true, timeoutSeconds: 300 },
  { commandId: "admin_lint", label: "Admin lint", executable: npmExecutable, arguments: ["run", "lint", "--workspace", "@efruitmandi/admin-panel"], workingDirectory: ".", category: "LINT", riskLevel: "MEDIUM", approvalRequired: true, timeoutSeconds: 180 },
]);

const registry = new Map(SAFE_COMMAND_DEFINITIONS.map((command) => [command.commandId, command]));

export const listSafeCommands = () => SAFE_COMMAND_DEFINITIONS.map((command) => ({ ...command }));

export const getSafeCommand = (commandId) => {
  const command = registry.get(String(commandId || ""));
  if (!command) {
    const error = new Error("Command is not in the Coding Agent allowlist");
    error.statusCode = 400;
    error.code = "COMMAND_NOT_ALLOWED";
    throw error;
  }
  return command;
};

export const assertNoArbitraryCommandInput = (body = {}) => {
  const prohibited = ["executable", "arguments", "args", "command", "shell", "workingDirectory", "cwd"];
  const supplied = prohibited.filter((key) => Object.hasOwn(body, key));
  if (supplied.length) {
    const error = new Error("Executable text, arguments, and working directories cannot be supplied");
    error.statusCode = 400;
    error.code = "ARBITRARY_COMMAND_DENIED";
    throw error;
  }
};
