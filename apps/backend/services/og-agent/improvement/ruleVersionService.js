import OGAgentRuleVersion from "../../../models/OGAgentRuleVersion.js";
import { activateVersion, createVersion, rollbackVersion } from "./versionLifecycleService.js";
export const createRuleVersion = ({ rule, ...args }) => createVersion({ ...args, content: rule, Model: OGAgentRuleVersion, contentField: "rule" });
export const activateRuleVersion = (args) => activateVersion({ ...args, Model: OGAgentRuleVersion });
export const rollbackRuleVersion = (args) => rollbackVersion({ ...args, Model: OGAgentRuleVersion });
