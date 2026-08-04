import OGAgentPromptVersion from "../../../models/OGAgentPromptVersion.js";
import { activateVersion, createVersion, rollbackVersion } from "./versionLifecycleService.js";
export const createPromptVersion = (args) => createVersion({ ...args, Model: OGAgentPromptVersion, contentField: "content" });
export const activatePromptVersion = (args) => activateVersion({ ...args, Model: OGAgentPromptVersion });
export const rollbackPromptVersion = (args) => rollbackVersion({ ...args, Model: OGAgentPromptVersion });
