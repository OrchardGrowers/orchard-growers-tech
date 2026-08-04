import { hasOGAgentPermission } from "../../../middleware/ogAgentPermissions.js";
export const canViewAllCallingQueues = (admin) => hasOGAgentPermission(admin, "telecalling.view_all_queue");
export const canEditVerifiedLeadFields = (admin) => hasOGAgentPermission(admin, "telecalling.edit_lead_verified_fields");
export const canOverrideCallingLock = (admin) => hasOGAgentPermission(admin, "telecalling.override_lock");
