import generalAnalysisTool from "./tools/generalAnalysisTool.js";
import reportGenerationTool from "./tools/reportGenerationTool.js";
import codingAnalysisPreviewTool from "./tools/codingAnalysisPreviewTool.js";
import telecallingPreparationTool from "./tools/telecallingPreparationTool.js";

export const PROHIBITED_OG_AGENT_ACTIONS = [
  "send_email",
  "email_reply",
  "mailbox_modify",
  "initiate_ai_call",
  "telecalling_recording",
  "telecalling_sms_send",
  "telecalling_whatsapp_send",
  "write_code",
  "execute_terminal_command",
  "modify_production_database",
  "delete_record",
  "process_payment",
  "deploy_production",
  "merge_branch",
  "push_git",
  "coding_commit",
  "coding_push",
  "coding_merge",
  "coding_deploy",
  "arbitrary_terminal",
  "secret_file_read",
  "permission_expand", "security_rule_disable", "approval_requirement_disable", "tool_self_enable", "self_code_modify",
  "arbitrary_url_fetch", "login_bypass", "captcha_bypass", "private_profile_scrape", "unrestricted_contact_harvest", "external_form_submit", "automatic_outreach", "unapproved_api_call", "proxy_evasion", "source_policy_disable",
];

const prohibitedPatterns = [
  ["send_email", /\b(send|dispatch)\s+(an?\s+)?emails?\b/i],
  ["email_reply", /\b(reply|respond)\s+(to\s+)?(an?\s+)?emails?\b/i],
  ["mailbox_modify", /\b(delete|archive|move|label|mark)\s+(an?\s+|the\s+)?(emails?|messages?|mailbox)\b/i],
  ["initiate_ai_call", /\b(initiate|make|place|start)\s+(an?\s+)?(ai\s+)?calls?\b/i],
  ["telecalling_recording", /\b(record|transcribe)\s+(the\s+|a\s+)?calls?\b/i],
  ["telecalling_sms_send", /\b(send|dispatch)\s+(an?\s+)?(sms|text messages?)\b/i],
  ["telecalling_whatsapp_send", /\b(send|dispatch)\s+(an?\s+)?whatsapp\b/i],
  ["write_code", /\b(write|modify|change|patch|implement)\s+(the\s+|a\s+)?(production\s+)?(code|codebase|feature)\b/i],
  ["execute_terminal_command", /\b(run|execute)\s+(a\s+)?(terminal|shell|powershell|bash)\s+commands?\b/i],
  ["modify_production_database", /\b(modify|update|write\s+to)\s+(the\s+)?production\s+(database|db)\b/i],
  ["delete_record", /\b(delete|remove|destroy)\s+(the\s+|a\s+|all\s+)?(record|records|data|user|users|lead|leads|task|tasks|buyer|buyers|grower|growers)\b/i],
  ["process_payment", /\b(process|capture|refund|send)\s+(a\s+)?payments?\b/i],
  ["deploy_production", /\b(deploy|release)\s+(to\s+)?production\b/i],
  ["merge_branch", /\bmerge\s+(the\s+)?(branch|pull request|pr)\b/i],
  ["push_git", /\b(git\s+push|push\s+(to\s+)?(git|github|remote))\b/i],
];

const externalActionDemoTool = {
  name: "external_action_demo",
  description: "Demonstrates approval flow; it never performs an external action, even after approval.",
  riskLevel: "MEDIUM",
  approvalRequired: true,
  enabled: true,
  supportedTaskTypes: ["GENERAL"],
  settingsFlag: null,
  execute: async ({ task }) => ({
    summary: "Approval workflow demo completed without performing an external action.",
    data: {
      requestedPreview: String(task.prompt || "").slice(0, 500),
      performedExternalAction: false,
      safetyStatement: "Approval acknowledged the demonstration only. No external system was contacted or changed.",
    },
    recommendations: ["Use a future separately reviewed integration for any real consequential action."],
  }),
};

const phase2Tools = [
  {
    name: "email_source_list",
    description: "Lists authorized synchronized mailbox sources without exposing credentials.",
    riskLevel: "LOW",
    approvalRequired: false,
    enabled: true,
    supportedTaskTypes: [],
    settingsFlag: "allowEmailSearch",
  },
  {
    name: "email_search",
    description: "Searches synchronized email metadata in read-only mode.",
    riskLevel: "LOW",
    approvalRequired: false,
    enabled: true,
    supportedTaskTypes: [],
    settingsFlag: "allowEmailSearch",
  },
  {
    name: "email_lead_extraction",
    description: "Creates temporary review candidates from sanitized synchronized messages.",
    riskLevel: "LOW",
    approvalRequired: false,
    enabled: true,
    supportedTaskTypes: [],
    settingsFlag: "allowEmailLeadExtraction",
  },
  {
    name: "lead_duplicate_check",
    description: "Performs deterministic read-only duplicate checks.",
    riskLevel: "LOW",
    approvalRequired: false,
    enabled: true,
    supportedTaskTypes: [],
    settingsFlag: "allowEmailLeadExtraction",
  },
  {
    name: "lead_import_preview",
    description: "Creates a reviewable snapshot of selected candidates without importing them.",
    riskLevel: "LOW",
    approvalRequired: false,
    enabled: true,
    supportedTaskTypes: [],
    settingsFlag: "allowEmailLeadExtraction",
  },
  {
    name: "lead_import_commit",
    description: "Imports only an approved immutable candidate snapshot as new BusinessLead records.",
    riskLevel: "MEDIUM",
    approvalRequired: true,
    enabled: true,
    supportedTaskTypes: [],
    settingsFlag: "requireApprovalForLeadImport",
  },
  {
    name: "email_send",
    description: "Prohibited in Phase 2.",
    riskLevel: "HIGH",
    approvalRequired: true,
    enabled: false,
    supportedTaskTypes: [],
    settingsFlag: "allowEmailSending",
  },
  {
    name: "email_reply",
    description: "Prohibited in Phase 2.",
    riskLevel: "HIGH",
    approvalRequired: true,
    enabled: false,
    supportedTaskTypes: [],
    settingsFlag: null,
  },
  {
    name: "mailbox_modify",
    description: "Prohibited in Phase 2.",
    riskLevel: "HIGH",
    approvalRequired: true,
    enabled: false,
    supportedTaskTypes: [],
    settingsFlag: "allowMailboxModification",
  },
];

const tools = [
  generalAnalysisTool,
  reportGenerationTool,
  codingAnalysisPreviewTool,
  telecallingPreparationTool,
  externalActionDemoTool,
  ...phase2Tools,
  ...[
    ["research_source_list", "Lists reviewed active research sources.", "LOW", false, true, null], ["research_source_health", "Performs a bounded source health check.", "LOW", false, true, null], ["research_plan_generate", "Generates a source-policy-bound plan without network access.", "LOW", false, true, "researchAgentEnabled"], ["research_website_fetch", "Fetches only approved public website paths with robots and SSRF enforcement.", "MEDIUM", true, true, "allowWebsitePageFetch"], ["research_api_fetch", "Calls only configured approved API endpoints.", "MEDIUM", true, true, "allowApiFetch"], ["research_extract_records", "Creates temporary evidence-backed research records.", "LOW", false, true, null], ["research_duplicate_check", "Checks temporary research data against internal records.", "LOW", false, true, null], ["research_report_generate", "Creates a traceable research report.", "LOW", false, true, null], ["research_lead_candidate_create", "Creates temporary review candidates only.", "MEDIUM", false, true, "allowLeadCandidateCreation"], ["research_business_lead_import", "Imports only an approved immutable candidate snapshot.", "HIGH", true, true, "requireApprovalForLeadImport"],
    ["arbitrary_url_fetch", "Prohibited: all URLs require an active source allowlist.", "HIGH", true, false, "allowArbitraryUrlFetch"], ["login_bypass", "Prohibited: login and access controls are never bypassed.", "HIGH", true, false, "allowLoginBypass"], ["captcha_bypass", "Prohibited: CAPTCHA stops collection.", "HIGH", true, false, "allowCaptchaBypass"], ["private_profile_scrape", "Prohibited: private profiles are out of scope.", "HIGH", true, false, "allowPrivateProfileCollection"], ["unrestricted_contact_harvest", "Prohibited: contact collection is minimized and source-specific.", "HIGH", true, false, "allowPersonalContactExtraction"], ["external_form_submit", "Prohibited: external forms are never submitted.", "HIGH", true, false, "allowExternalFormSubmission"], ["automatic_outreach", "Prohibited: no automatic contact or messaging.", "HIGH", true, false, "allowAutomaticOutreach"], ["unapproved_api_call", "Prohibited: only configured endpoint adapters may call APIs.", "HIGH", true, false, "allowUnapprovedApiCall"], ["proxy_evasion", "Prohibited: no proxy rotation or rate-limit evasion.", "HIGH", true, false, "allowProxyEvasion"], ["source_policy_disable", "Prohibited: learned guidance cannot override source policy.", "HIGH", true, false, "allowSourcePolicyOverrideByAgent"],
  ].map(([name, description, riskLevel, approvalRequired, enabled, settingsFlag]) => ({ name, description, riskLevel, approvalRequired, enabled, supportedTaskTypes: [], settingsFlag })),
  ...[
    ["feedback_record", "Records immutable structured reviewer feedback.", "LOW", false, true, "allowFeedbackCollection"],
    ["feedback_revision_request", "Creates a new review-only proposal version; it executes no action.", "LOW", false, true, "allowProposalRevision"],
    ["approved_example_create_draft", "Creates an inactive approved-example draft.", "MEDIUM", false, true, null],
    ["approved_example_activate", "Activates a reviewed example after explicit approval.", "HIGH", true, true, null],
    ["organizational_guidance_create_draft", "Creates inactive organizational guidance.", "MEDIUM", false, true, null],
    ["organizational_guidance_activate", "Activates security-reviewed guidance after explicit approval.", "HIGH", true, true, null],
    ["improvement_pattern_analysis", "Performs bounded read-only feedback pattern analysis.", "LOW", false, true, "allowImprovementPatternAnalysis"],
    ["improvement_proposal_generate", "Creates an evidence-backed improvement proposal only.", "MEDIUM", false, true, "allowImprovementProposalGeneration"],
    ["evaluation_run", "Runs a bounded internal evaluation dataset.", "MEDIUM", false, true, "allowEvaluationRuns"],
    ["prompt_version_activate", "Activates an approved evaluated prompt version.", "HIGH", true, true, null],
    ["rule_version_activate", "Activates an approved evaluated rule version.", "HIGH", true, true, null],
    ["version_rollback", "Rolls back to a prior approved version after approval.", "HIGH", true, true, null],
    ["permission_expand", "Prohibited: the agent cannot expand its permissions.", "HIGH", true, false, "allowAutomaticPermissionChange"],
    ["security_rule_disable", "Prohibited: security rules cannot be disabled by feedback.", "HIGH", true, false, "allowAutomaticSecurityPolicyChange"],
    ["approval_requirement_disable", "Prohibited: approval requirements cannot be bypassed.", "HIGH", true, false, "allowAutomaticApprovalBypass"],
    ["tool_self_enable", "Prohibited: tools cannot self-enable.", "HIGH", true, false, "allowAutomaticToolEnablement"],
    ["self_code_modify", "Prohibited: the agent cannot modify its own production code.", "HIGH", true, false, "allowAutomaticCodeModification"],
    ["production_deploy", "Prohibited: production deployment remains manual and out of scope.", "HIGH", true, false, "allowAutomaticDeployment"],
  ].map(([name, description, riskLevel, approvalRequired, enabled, settingsFlag]) => ({ name, description, riskLevel, approvalRequired, enabled, supportedTaskTypes: [], settingsFlag })),
  ...[
    ["telecalling_queue_preview", "Returns eligible Business Lead counts without creating a queue.", "LOW", false, true, "allowCallingCampaigns"],
    ["telecalling_script_generation", "Creates a safe human call script without initiating a call.", "LOW", false, true, "allowCallScriptGeneration"],
    ["telecalling_lead_summary", "Summarizes approved internal Business Lead context.", "LOW", false, true, "allowTelecallingPreparation"],
    ["telecalling_followup_recommendation", "Recommends a follow-up for explicit human confirmation.", "LOW", false, true, "allowFollowUpManagement"],
    ["telecalling_campaign_create", "Creates an internal calling queue only; no call is placed.", "MEDIUM", false, true, "allowCallingCampaigns"],
    ["telecalling_bulk_assignment", "Assigns internal queue items under manager permission.", "MEDIUM", false, true, "allowCallQueueAssignment"],
    ["telecalling_call_initiate", "Prohibited: OG Agent does not place calls.", "HIGH", true, false, "allowAICalling"],
    ["telecalling_recording", "Prohibited: call recording and transcription are unavailable.", "HIGH", true, false, "allowCallRecording"],
    ["telecalling_sms_send", "Prohibited: SMS sending is unavailable.", "HIGH", true, false, "allowSMS"],
    ["telecalling_whatsapp_send", "Prohibited: WhatsApp sending is unavailable.", "HIGH", true, false, "allowWhatsAppSending"],
    ["telecalling_email_send", "Prohibited: automatic email sending is unavailable.", "HIGH", true, false, "allowAutomaticEmailSending"],
  ].map(([name, description, riskLevel, approvalRequired, enabled, settingsFlag]) => ({ name, description, riskLevel, approvalRequired, enabled, supportedTaskTypes: [], settingsFlag })),
  ...[
    ["repository_status", "Reads bounded repository branch, commit, and working-tree metadata.", "LOW", false, true, "allowRepositoryRead"],
    ["repository_structure", "Lists a bounded approved repository structure without following symlinks.", "LOW", false, true, "allowRepositoryRead"],
    ["repository_search", "Searches bounded safe text files inside approved scopes.", "LOW", false, true, "allowRepositorySearch"],
    ["repository_file_read", "Reads bounded sections of approved non-sensitive text files.", "LOW", false, true, "allowRepositoryRead"],
    ["coding_task_analysis", "Produces structured coding analysis from sanitized repository evidence.", "LOW", false, true, "allowCodingAnalysis"],
    ["coding_patch_generate", "Generates and validates a reviewable unified diff after approval.", "MEDIUM", true, true, "allowPatchGeneration"],
    ["coding_patch_review", "Displays an immutable validated patch proposal.", "LOW", false, true, null],
    ["coding_patch_apply", "Applies only the exact approved patch after dry-run and state checks.", "HIGH", true, true, "allowPatchApplication"],
    ["coding_validation_run", "Runs a backend-registered safe validation command ID.", "MEDIUM", true, true, "allowSafeCommandExecution"],
    ["coding_patch_revert", "Applies a validated reverse patch after exact approval.", "HIGH", true, true, "allowPatchApplication"],
    ["coding_branch_create", "Optional local-only branch creation; disabled by default.", "HIGH", true, false, "allowLocalBranchCreation"],
    ["coding_commit", "Prohibited: commits remain manual.", "HIGH", true, false, "allowGitCommit"],
    ["coding_push", "Prohibited: remote pushes remain manual.", "HIGH", true, false, "allowGitPush"],
    ["coding_merge", "Prohibited: merges remain manual.", "HIGH", true, false, "allowGitMerge"],
    ["coding_deploy", "Prohibited: deployment remains manual.", "HIGH", true, false, "allowProductionDeployment"],
    ["arbitrary_terminal", "Prohibited: only registered command IDs are accepted.", "HIGH", true, false, "allowArbitraryTerminal"],
    ["secret_file_read", "Prohibited: secret and environment files are never readable.", "HIGH", true, false, "allowSecretFileRead"],
  ].map(([name, description, riskLevel, approvalRequired, enabled, settingsFlag]) => ({ name, description, riskLevel, approvalRequired, enabled, supportedTaskTypes: [], settingsFlag })),
];

const registry = new Map(tools.map((tool) => [tool.name, Object.freeze(tool)]));

export const listOGAgentTools = () => tools.map(({ execute, ...tool }) => ({ ...tool }));
export const getOGAgentTool = (name) => registry.get(name) || null;

export const detectProhibitedAction = (text = "") => {
  const input = String(text || "");
  const match = prohibitedPatterns.find(([, pattern]) => pattern.test(input));
  return match?.[0] || null;
};

export const selectToolForTask = (task) => {
  if (/\bexternal[ _-]?action[ _-]?demo\b/i.test(String(task.prompt || ""))) {
    return externalActionDemoTool;
  }
  return tools.find((tool) => tool.name !== "external_action_demo" && tool.supportedTaskTypes.includes(task.taskType)) || null;
};
