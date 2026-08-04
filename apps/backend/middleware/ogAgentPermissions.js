import { createOGAgentAuditLog, getRequestAuditContext } from "../services/og-agent/ogAgentAuditService.js";

export const OG_AGENT_PERMISSIONS = {
  VIEW: ["SUPER_ADMIN", "ADMIN"],
  CREATE_TASK: ["SUPER_ADMIN", "ADMIN"],
  RUN_TASK: ["SUPER_ADMIN", "ADMIN"],
  REVIEW_APPROVAL: ["SUPER_ADMIN"],
  CHANGE_SETTINGS: ["SUPER_ADMIN"],
  VIEW_AUDIT: ["SUPER_ADMIN", "ADMIN"],
  "telecalling.view_dashboard": ["SUPER_ADMIN", "ADMIN", "SUPPORT_EXECUTIVE", "SALES_EXECUTIVE"],
  "telecalling.view_own_queue": ["SUPER_ADMIN", "ADMIN", "SUPPORT_EXECUTIVE", "SALES_EXECUTIVE"],
  "telecalling.view_all_queue": ["SUPER_ADMIN", "ADMIN"],
  "telecalling.create_campaign": ["SUPER_ADMIN", "ADMIN"],
  "telecalling.manage_campaign": ["SUPER_ADMIN", "ADMIN"],
  "telecalling.assign_queue": ["SUPER_ADMIN", "ADMIN"],
  "telecalling.record_outcome": ["SUPER_ADMIN", "ADMIN", "SUPPORT_EXECUTIVE", "SALES_EXECUTIVE"],
  "telecalling.edit_lead_verified_fields": ["SUPER_ADMIN", "ADMIN"],
  "telecalling.manage_followups": ["SUPER_ADMIN", "ADMIN", "SUPPORT_EXECUTIVE", "SALES_EXECUTIVE"],
  "telecalling.view_reports": ["SUPER_ADMIN", "ADMIN"],
  "telecalling.manage_scripts": ["SUPER_ADMIN", "ADMIN"],
  "telecalling.manage_settings": ["SUPER_ADMIN"],
  "telecalling.view_sensitive_contact": ["SUPER_ADMIN", "ADMIN", "SUPPORT_EXECUTIVE", "SALES_EXECUTIVE"],
  "telecalling.override_lock": ["SUPER_ADMIN"],
  "coding.view": ["SUPER_ADMIN", "ADMIN"],
  "coding.create_task": ["SUPER_ADMIN", "ADMIN"],
  "coding.analyze": ["SUPER_ADMIN", "ADMIN"],
  "coding.read_repository": ["SUPER_ADMIN", "ADMIN"],
  "coding.generate_patch": ["SUPER_ADMIN", "ADMIN"],
  "coding.review_patch": ["SUPER_ADMIN", "ADMIN"],
  "coding.request_apply": ["SUPER_ADMIN", "ADMIN"],
  "coding.approve_apply": ["SUPER_ADMIN"],
  "coding.apply_patch": ["SUPER_ADMIN"],
  "coding.run_validation": ["SUPER_ADMIN", "ADMIN"],
  "coding.revert_patch": ["SUPER_ADMIN"],
  "coding.manage_settings": ["SUPER_ADMIN"],
  "coding.view_audit": ["SUPER_ADMIN", "ADMIN"],
  "coding.create_local_branch": ["SUPER_ADMIN"],
  "improvement.view": ["SUPER_ADMIN", "ADMIN"],
  "improvement.give_feedback": ["SUPER_ADMIN", "ADMIN"],
  "improvement.amend_own_feedback": ["SUPER_ADMIN", "ADMIN"],
  "improvement.manage_examples": ["SUPER_ADMIN", "ADMIN"],
  "improvement.manage_guidance": ["SUPER_ADMIN", "ADMIN"],
  "improvement.generate_proposals": ["SUPER_ADMIN", "ADMIN"],
  "improvement.manage_versions": ["SUPER_ADMIN"],
  "improvement.manage_datasets": ["SUPER_ADMIN", "ADMIN"],
  "improvement.run_evaluations": ["SUPER_ADMIN", "ADMIN"],
  "improvement.activate": ["SUPER_ADMIN"],
  "improvement.rollback": ["SUPER_ADMIN"],
  "improvement.view_metrics": ["SUPER_ADMIN", "ADMIN"],
  "improvement.submit_feedback": ["SUPER_ADMIN", "ADMIN"],
  "improvement.view_all_feedback": ["SUPER_ADMIN", "ADMIN"],
  "improvement.request_revision": ["SUPER_ADMIN", "ADMIN"],
  "improvement.create_example_draft": ["SUPER_ADMIN", "ADMIN"],
  "improvement.approve_example": ["SUPER_ADMIN"],
  "improvement.create_proposal": ["SUPER_ADMIN", "ADMIN"],
  "improvement.run_evaluation": ["SUPER_ADMIN", "ADMIN"],
  "improvement.review_evaluation": ["SUPER_ADMIN", "ADMIN"],
  "improvement.create_prompt_version": ["SUPER_ADMIN"],
  "improvement.activate_prompt": ["SUPER_ADMIN"],
  "improvement.create_rule_version": ["SUPER_ADMIN"],
  "improvement.activate_rule": ["SUPER_ADMIN"],
  "improvement.rollback_version": ["SUPER_ADMIN"],
  "improvement.manage_settings": ["SUPER_ADMIN"],
  "improvement.view_human_impact": ["SUPER_ADMIN", "ADMIN"],
  "improvement.escalate_specialist_review": ["SUPER_ADMIN", "ADMIN"],
  "research.view": ["SUPER_ADMIN", "ADMIN"], "research.create_task": ["SUPER_ADMIN", "ADMIN"], "research.plan": ["SUPER_ADMIN", "ADMIN"], "research.run": ["SUPER_ADMIN", "ADMIN"], "research.cancel": ["SUPER_ADMIN", "ADMIN"], "research.view_records": ["SUPER_ADMIN", "ADMIN"], "research.review_records": ["SUPER_ADMIN", "ADMIN"], "research.create_lead_candidates": ["SUPER_ADMIN", "ADMIN"], "research.request_import": ["SUPER_ADMIN", "ADMIN"], "research.approve_import": ["SUPER_ADMIN"], "research.view_reports": ["SUPER_ADMIN", "ADMIN"], "research.generate_reports": ["SUPER_ADMIN", "ADMIN"], "research.manage_sources": ["SUPER_ADMIN"], "research.review_sources": ["SUPER_ADMIN"], "research.activate_sources": ["SUPER_ADMIN"], "research.view_source_health": ["SUPER_ADMIN", "ADMIN"], "research.view_sensitive_contact": ["SUPER_ADMIN"], "research.export": ["SUPER_ADMIN", "ADMIN"], "research.manage_settings": ["SUPER_ADMIN"], "research.view_audit": ["SUPER_ADMIN", "ADMIN"], "research.submit_feedback": ["SUPER_ADMIN", "ADMIN"],
};

export const hasOGAgentPermission = (admin, permission) => (OG_AGENT_PERMISSIONS[permission] || []).includes(admin?.role);

export const requireOGAgentPermission = (permission) => async (req, res, next) => {
  const allowedRoles = OG_AGENT_PERMISSIONS[permission] || [];
  if (allowedRoles.includes(req.admin?.role)) return next();

  try {
    await createOGAgentAuditLog({
      actorId: req.admin?._id || req.user?.id || null,
      actorType: "ADMIN",
      eventType: "UNAUTHORIZED_ACTION_ATTEMPTED",
      action: `Denied OG Agent permission: ${permission}`,
      details: "The authenticated admin role did not have the required OG Agent permission.",
      metadata: { permission, role: req.admin?.role || req.user?.role || "unknown" },
      requestContext: getRequestAuditContext(req),
    });
  } catch (error) {
    console.error("Could not write OG Agent authorization audit log:", error.message);
  }

  return res.status(403).json({
    success: false,
    code: "OG_AGENT_PERMISSION_DENIED",
    message: "Your admin role does not have permission for this OG Agent action.",
    msg: "Your admin role does not have permission for this OG Agent action.",
  });
};
