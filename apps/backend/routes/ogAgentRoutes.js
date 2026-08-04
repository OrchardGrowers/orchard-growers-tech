import express from "express";
import Admin from "../models/Admin.js";
import protect, { authorize } from "../middleware/authMiddleware.js";
import { requireOGAgentPermission } from "../middleware/ogAgentPermissions.js";
import {
  approveOGAgentApproval,
  cancelOGAgentTaskController,
  createOGAgentTask,
  getOGAgentApproval,
  getOGAgentSettingsController,
  getOGAgentTask,
  listOGAgentApprovals,
  listOGAgentAuditLogsController,
  listOGAgentTasks,
  listOGAgentToolsController,
  ogAgentErrorHandler,
  planOGAgentTaskController,
  rejectOGAgentApproval,
  runOGAgentTaskController,
  updateOGAgentSettingsController,
} from "../controllers/ogAgentController.js";
import {
  bulkSelectLeadCandidates,
  cancelEmailExtraction,
  checkExtractionDuplicates,
  createEmailExtraction,
  getBusinessLead,
  getEmailExtraction,
  getLeadCandidate,
  importApprovedCandidates,
  listBusinessLeads,
  listEmailExtractions,
  listEmailSources,
  listLeadCandidates,
  previewLeadImport,
  requestImportApproval,
  runEmailExtraction,
  searchEmailMetadata,
  updateBusinessLeadStatus,
  updateLeadCandidate,
} from "../controllers/ogAgentEmailController.js";
import * as calling from "../controllers/ogAgentTelecallingController.js";
import * as coding from "../controllers/ogAgentCodingController.js";
import * as improvement from "../controllers/ogAgentImprovementController.js";
import * as research from "../controllers/ogAgentResearchController.js";

const router = express.Router();
const ALL_ADMIN_ROLES = [
  "SUPER_ADMIN", "ADMIN", "UNIT_MANAGER", "INVENTORY_MANAGER", "SALES_EXECUTIVE",
  "PURCHASE_MANAGER", "FINANCE_MANAGER", "VERIFICATION_OFFICER", "SUPPORT_EXECUTIVE", "VIEWER", "EMPLOYEE",
];
const wrapAsync = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

const ensureActiveAdmin = async (req, res, next) => {
  const admin = await Admin.findById(req.user.id).select("_id name email status role adminClass");
  if (!admin || admin.status !== "ACTIVE" || !ALL_ADMIN_ROLES.includes(admin.role)) {
    return res.status(403).json({ success: false, message: "Admin account is not active", msg: "Admin account is not active" });
  }
  req.admin = admin;
  return next();
};

router.use(protect, authorize(...ALL_ADMIN_ROLES), wrapAsync(ensureActiveAdmin));

router.post("/research/sources", wrapAsync(requireOGAgentPermission("research.manage_sources")), wrapAsync(research.createSource));
router.get("/research/sources", wrapAsync(requireOGAgentPermission("research.view")), wrapAsync(research.listSources));
router.get("/research/sources/:sourceId", wrapAsync(requireOGAgentPermission("research.view")), wrapAsync(research.getSource));
router.patch("/research/sources/:sourceId", wrapAsync(requireOGAgentPermission("research.manage_sources")), wrapAsync(research.updateSource));
router.post("/research/sources/:sourceId/request-approval", wrapAsync(requireOGAgentPermission("research.review_sources")), wrapAsync(research.requestSourceApproval));
router.post("/research/sources/:sourceId/activate", wrapAsync(requireOGAgentPermission("research.activate_sources")), wrapAsync(research.activateSource));
router.post("/research/sources/:sourceId/pause", wrapAsync(requireOGAgentPermission("research.activate_sources")), wrapAsync(research.pauseSource));
router.post("/research/sources/:sourceId/block", wrapAsync(requireOGAgentPermission("research.activate_sources")), wrapAsync(research.blockSource));
router.post("/research/sources/:sourceId/health-check", wrapAsync(requireOGAgentPermission("research.view_source_health")), wrapAsync(research.sourceHealth));
router.get("/research/sources/:sourceId/reviews", wrapAsync(requireOGAgentPermission("research.review_sources")), wrapAsync(research.listSourceReviews));
router.post("/research/sources/:sourceId/reviews", wrapAsync(requireOGAgentPermission("research.review_sources")), wrapAsync(research.createSourceReview));
router.post("/research/tasks", wrapAsync(requireOGAgentPermission("research.create_task")), wrapAsync(research.createTask));
router.get("/research/tasks", wrapAsync(requireOGAgentPermission("research.view")), wrapAsync(research.listTasks));
router.get("/research/tasks/:researchTaskId", wrapAsync(requireOGAgentPermission("research.view")), wrapAsync(research.getTask));
router.patch("/research/tasks/:researchTaskId", wrapAsync(requireOGAgentPermission("research.create_task")), wrapAsync(research.updateTask));
router.post("/research/tasks/:researchTaskId/plan", wrapAsync(requireOGAgentPermission("research.plan")), wrapAsync(research.planTask));
router.post("/research/tasks/:researchTaskId/request-approval", wrapAsync(requireOGAgentPermission("research.plan")), wrapAsync(research.requestTaskApproval));
router.post("/research/tasks/:researchTaskId/run", wrapAsync(requireOGAgentPermission("research.run")), wrapAsync(research.runTask));
router.post("/research/tasks/:researchTaskId/cancel", wrapAsync(requireOGAgentPermission("research.cancel")), wrapAsync(research.cancelTask));
router.get("/research/tasks/:researchTaskId/fetches", wrapAsync(requireOGAgentPermission("research.view")), wrapAsync(research.listFetches));
router.get("/research/fetches/:fetchRecordId", wrapAsync(requireOGAgentPermission("research.view")), wrapAsync(research.getFetch));
router.get("/research/tasks/:researchTaskId/records", wrapAsync(requireOGAgentPermission("research.view_records")), wrapAsync(research.listRecords));
router.get("/research/records/:recordId", wrapAsync(requireOGAgentPermission("research.view_records")), wrapAsync(research.getRecord));
router.patch("/research/records/:recordId", wrapAsync(requireOGAgentPermission("research.review_records")), wrapAsync(research.updateRecord));
router.post("/research/tasks/:researchTaskId/check-duplicates", wrapAsync(requireOGAgentPermission("research.review_records")), wrapAsync(research.checkDuplicates));
router.post("/research/records/bulk-review", wrapAsync(requireOGAgentPermission("research.review_records")), wrapAsync(research.bulkReview));
router.post("/research/records/bulk-selection", wrapAsync(requireOGAgentPermission("research.review_records")), wrapAsync(research.bulkSelection));
router.post("/research/tasks/:researchTaskId/create-lead-candidates", wrapAsync(requireOGAgentPermission("research.create_lead_candidates")), wrapAsync(research.createLeadCandidates));
router.get("/research/tasks/:researchTaskId/lead-candidates", wrapAsync(requireOGAgentPermission("research.view_records")), wrapAsync(research.listLeadCandidates));
router.post("/research/tasks/:researchTaskId/request-import-approval", wrapAsync(requireOGAgentPermission("research.request_import")), wrapAsync(research.requestImport));
router.post("/research/tasks/:researchTaskId/import-approved", wrapAsync(requireOGAgentPermission("research.approve_import")), wrapAsync(research.importApproved));
router.post("/research/tasks/:researchTaskId/generate-report", wrapAsync(requireOGAgentPermission("research.generate_reports")), wrapAsync(research.generateReport));
router.get("/research/reports", wrapAsync(requireOGAgentPermission("research.view_reports")), wrapAsync(research.listReports));
router.get("/research/reports/:reportId", wrapAsync(requireOGAgentPermission("research.view_reports")), wrapAsync(research.getReport));
router.post("/research/reports/:reportId/approve", wrapAsync(requireOGAgentPermission("research.generate_reports")), wrapAsync(research.approveReport));
router.post("/research/reports/:reportId/archive", wrapAsync(requireOGAgentPermission("research.generate_reports")), wrapAsync(research.archiveReport));

router.post("/feedback", wrapAsync(requireOGAgentPermission("improvement.give_feedback")), wrapAsync(improvement.createFeedback));
router.get("/feedback", wrapAsync(requireOGAgentPermission("improvement.view")), wrapAsync(improvement.listFeedback));
router.get("/feedback/:feedbackId", wrapAsync(requireOGAgentPermission("improvement.view")), wrapAsync(improvement.getFeedback));
router.post("/feedback/:feedbackId/amend", wrapAsync(requireOGAgentPermission("improvement.amend_own_feedback")), wrapAsync(improvement.amendFeedback));
router.post("/feedback/:feedbackId/withdraw", wrapAsync(requireOGAgentPermission("improvement.amend_own_feedback")), wrapAsync(improvement.withdrawFeedback));
router.get("/tasks/:taskId/proposals", wrapAsync(requireOGAgentPermission("improvement.view")), wrapAsync(improvement.listTaskProposals));
router.get("/tasks/:taskId/proposals/:proposalId", wrapAsync(requireOGAgentPermission("improvement.view")), wrapAsync(improvement.getTaskProposal));
router.post("/tasks/:taskId/proposals/:proposalId/request-revision", wrapAsync(requireOGAgentPermission("improvement.give_feedback")), wrapAsync(improvement.requestTaskRevision));

router.post("/improvement/examples", wrapAsync(requireOGAgentPermission("improvement.manage_examples")), wrapAsync(improvement.createExample));
router.get("/improvement/examples", wrapAsync(requireOGAgentPermission("improvement.view")), wrapAsync(improvement.listExamples));
router.get("/improvement/examples/:exampleId", wrapAsync(requireOGAgentPermission("improvement.view")), wrapAsync(improvement.getExample));
router.patch("/improvement/examples/:exampleId", wrapAsync(requireOGAgentPermission("improvement.manage_examples")), wrapAsync(improvement.updateExample));
router.post("/improvement/examples/:exampleId/request-approval", wrapAsync(requireOGAgentPermission("improvement.manage_examples")), wrapAsync(improvement.requestExampleApproval));
router.post("/improvement/examples/:exampleId/activate", wrapAsync(requireOGAgentPermission("improvement.activate")), wrapAsync(improvement.activateExample));
router.post("/improvement/examples/:exampleId/deactivate", wrapAsync(requireOGAgentPermission("improvement.activate")), wrapAsync(improvement.deactivateExample));
router.post("/improvement/guidance", wrapAsync(requireOGAgentPermission("improvement.manage_guidance")), wrapAsync(improvement.createGuidance));
router.get("/improvement/guidance", wrapAsync(requireOGAgentPermission("improvement.view")), wrapAsync(improvement.listGuidance));
router.get("/improvement/guidance/:guidanceId", wrapAsync(requireOGAgentPermission("improvement.view")), wrapAsync(improvement.getGuidance));
router.patch("/improvement/guidance/:guidanceId", wrapAsync(requireOGAgentPermission("improvement.manage_guidance")), wrapAsync(improvement.updateGuidance));
router.post("/improvement/guidance/:guidanceId/request-approval", wrapAsync(requireOGAgentPermission("improvement.manage_guidance")), wrapAsync(improvement.requestGuidanceApproval));
router.post("/improvement/guidance/:guidanceId/activate", wrapAsync(requireOGAgentPermission("improvement.activate")), wrapAsync(improvement.activateGuidanceController));
router.post("/improvement/guidance/:guidanceId/deactivate", wrapAsync(requireOGAgentPermission("improvement.activate")), wrapAsync(improvement.deactivateGuidance));
router.post("/improvement/proposals/generate", wrapAsync(requireOGAgentPermission("improvement.generate_proposals")), wrapAsync(improvement.generateProposal));
router.get("/improvement/proposals", wrapAsync(requireOGAgentPermission("improvement.view")), wrapAsync(improvement.listProposals));
router.get("/improvement/proposals/:proposalId", wrapAsync(requireOGAgentPermission("improvement.view")), wrapAsync(improvement.getProposal));
router.post("/improvement/proposals/:proposalId/evaluate", wrapAsync(requireOGAgentPermission("improvement.run_evaluations")), wrapAsync(improvement.evaluateProposal));
router.post("/improvement/proposals/:proposalId/request-approval", wrapAsync(requireOGAgentPermission("improvement.generate_proposals")), wrapAsync(improvement.requestProposalApproval));
router.post("/improvement/proposals/:proposalId/activate", wrapAsync(requireOGAgentPermission("improvement.activate")), wrapAsync(improvement.activateProposal));
router.post("/improvement/proposals/:proposalId/reject", wrapAsync(requireOGAgentPermission("improvement.activate")), wrapAsync(improvement.rejectProposal));
router.post("/improvement/proposals/:proposalId/rollback", wrapAsync(requireOGAgentPermission("improvement.rollback")), wrapAsync(improvement.rollbackProposal));
router.get("/improvement/prompts", wrapAsync(requireOGAgentPermission("improvement.view")), wrapAsync(improvement.listPrompts));
router.get("/improvement/prompts/:promptKey/versions", wrapAsync(requireOGAgentPermission("improvement.view")), wrapAsync(improvement.listPromptVersions));
router.get("/improvement/prompts/versions/:versionId", wrapAsync(requireOGAgentPermission("improvement.view")), wrapAsync(improvement.getPromptVersion));
router.post("/improvement/prompts/versions", wrapAsync(requireOGAgentPermission("improvement.manage_versions")), wrapAsync(improvement.createPromptVersionController));
router.post("/improvement/prompts/versions/:versionId/evaluate", wrapAsync(requireOGAgentPermission("improvement.run_evaluations")), wrapAsync(improvement.evaluatePromptVersion));
router.post("/improvement/prompts/versions/:versionId/activate", wrapAsync(requireOGAgentPermission("improvement.activate")), wrapAsync(improvement.activatePromptVersionController));
router.post("/improvement/prompts/versions/:versionId/rollback", wrapAsync(requireOGAgentPermission("improvement.rollback")), wrapAsync(improvement.rollbackPromptVersionController));
router.get("/improvement/rules", wrapAsync(requireOGAgentPermission("improvement.view")), wrapAsync(improvement.listRules));
router.get("/improvement/rules/:ruleKey/versions", wrapAsync(requireOGAgentPermission("improvement.view")), wrapAsync(improvement.listRuleVersions));
router.post("/improvement/rules/versions", wrapAsync(requireOGAgentPermission("improvement.manage_versions")), wrapAsync(improvement.createRuleVersionController));
router.post("/improvement/rules/versions/:versionId/evaluate", wrapAsync(requireOGAgentPermission("improvement.run_evaluations")), wrapAsync(improvement.evaluateRuleVersion));
router.post("/improvement/rules/versions/:versionId/activate", wrapAsync(requireOGAgentPermission("improvement.activate")), wrapAsync(improvement.activateRuleVersionController));
router.post("/improvement/rules/versions/:versionId/rollback", wrapAsync(requireOGAgentPermission("improvement.rollback")), wrapAsync(improvement.rollbackRuleVersionController));
router.post("/improvement/datasets", wrapAsync(requireOGAgentPermission("improvement.manage_datasets")), wrapAsync(improvement.createDataset));
router.get("/improvement/datasets", wrapAsync(requireOGAgentPermission("improvement.view")), wrapAsync(improvement.listDatasets));
router.get("/improvement/datasets/:datasetId", wrapAsync(requireOGAgentPermission("improvement.view")), wrapAsync(improvement.getDataset));
router.patch("/improvement/datasets/:datasetId", wrapAsync(requireOGAgentPermission("improvement.manage_datasets")), wrapAsync(improvement.updateDataset));
router.post("/improvement/datasets/:datasetId/lock", wrapAsync(requireOGAgentPermission("improvement.manage_datasets")), wrapAsync(improvement.lockDataset));
router.post("/improvement/evaluations", wrapAsync(requireOGAgentPermission("improvement.run_evaluations")), wrapAsync(improvement.createEvaluation));
router.get("/improvement/evaluations", wrapAsync(requireOGAgentPermission("improvement.view")), wrapAsync(improvement.listEvaluations));
router.get("/improvement/evaluations/:evaluationId", wrapAsync(requireOGAgentPermission("improvement.view")), wrapAsync(improvement.getEvaluation));
router.get("/improvement/metrics/summary", wrapAsync(requireOGAgentPermission("improvement.view_metrics")), wrapAsync(improvement.metricsSummary));
router.get("/improvement/metrics/by-task-type", wrapAsync(requireOGAgentPermission("improvement.view_metrics")), wrapAsync(improvement.metricsByTaskType));
router.get("/improvement/metrics/by-version", wrapAsync(requireOGAgentPermission("improvement.view_metrics")), wrapAsync(improvement.metricsByVersion));
router.get("/improvement/metrics/human-impact", wrapAsync(requireOGAgentPermission("improvement.view_metrics")), wrapAsync(improvement.metricsHumanImpact));

router.get("/coding/config", wrapAsync(requireOGAgentPermission("coding.view")), wrapAsync(coding.getCodingConfig));
router.post("/coding/tasks", wrapAsync(requireOGAgentPermission("coding.create_task")), wrapAsync(coding.createCodingTask));
router.get("/coding/tasks", wrapAsync(requireOGAgentPermission("coding.view")), wrapAsync(coding.listCodingTasks));
router.get("/coding/tasks/:codingTaskId", wrapAsync(requireOGAgentPermission("coding.view")), wrapAsync(coding.getCodingTask));
router.patch("/coding/tasks/:codingTaskId", wrapAsync(requireOGAgentPermission("coding.create_task")), wrapAsync(coding.updateCodingTask));
router.post("/coding/tasks/:codingTaskId/analyze", wrapAsync(requireOGAgentPermission("coding.analyze")), wrapAsync(coding.analyzeTask));
router.post("/coding/tasks/:codingTaskId/cancel", wrapAsync(requireOGAgentPermission("coding.create_task")), wrapAsync(coding.cancelCodingTask));
router.get("/coding/repository/status", wrapAsync(requireOGAgentPermission("coding.read_repository")), wrapAsync(coding.repositoryStatus));
router.post("/coding/repository/structure", wrapAsync(requireOGAgentPermission("coding.read_repository")), wrapAsync(coding.repositoryStructure));
router.post("/coding/repository/search", wrapAsync(requireOGAgentPermission("coding.read_repository")), wrapAsync(coding.repositorySearch));
router.post("/coding/repository/read", wrapAsync(requireOGAgentPermission("coding.read_repository")), wrapAsync(coding.repositoryRead));
router.post("/coding/tasks/:codingTaskId/request-patch", wrapAsync(requireOGAgentPermission("coding.generate_patch")), wrapAsync(coding.requestPatchGeneration));
router.post("/coding/tasks/:codingTaskId/generate-patch", wrapAsync(requireOGAgentPermission("coding.generate_patch")), wrapAsync(coding.generatePatch));
router.get("/coding/patches/:patchId", wrapAsync(requireOGAgentPermission("coding.review_patch")), wrapAsync(coding.getPatch));
router.get("/coding/patches/:patchId/diff", wrapAsync(requireOGAgentPermission("coding.review_patch")), wrapAsync(coding.getPatchDiff));
router.post("/coding/patches/:patchId/request-apply-approval", wrapAsync(requireOGAgentPermission("coding.request_apply")), wrapAsync(coding.requestApplyApproval));
router.post("/coding/patches/:patchId/apply", wrapAsync(requireOGAgentPermission("coding.apply_patch")), wrapAsync(coding.applyPatch));
router.post("/coding/patches/:patchId/request-revert-approval", wrapAsync(requireOGAgentPermission("coding.revert_patch")), wrapAsync(coding.requestRevertApproval));
router.post("/coding/patches/:patchId/revert", wrapAsync(requireOGAgentPermission("coding.revert_patch")), wrapAsync(coding.revertPatch));
router.get("/coding/commands", wrapAsync(requireOGAgentPermission("coding.view")), wrapAsync(coding.getCommands));
router.post("/coding/tasks/:codingTaskId/commands/preview", wrapAsync(requireOGAgentPermission("coding.run_validation")), wrapAsync(coding.previewCommand));
router.post("/coding/tasks/:codingTaskId/commands/run", wrapAsync(requireOGAgentPermission("coding.run_validation")), wrapAsync(coding.runCommand));
router.get("/coding/command-runs/:commandRunId", wrapAsync(requireOGAgentPermission("coding.view")), wrapAsync(coding.getCommandRun));
router.post("/coding/command-runs/:commandRunId/cancel", wrapAsync(requireOGAgentPermission("coding.run_validation")), wrapAsync(coding.cancelCommandRun));
router.get("/coding/tasks/:codingTaskId/snapshots", wrapAsync(requireOGAgentPermission("coding.view_audit")), wrapAsync(coding.getSnapshots));

router.get("/telecalling/telecallers", wrapAsync(requireOGAgentPermission("telecalling.create_campaign")), wrapAsync(calling.listTelecallers));
router.get("/telecalling/config", wrapAsync(requireOGAgentPermission("telecalling.view_dashboard")), wrapAsync(calling.getTelecallingConfig));
router.get("/telecalling/dashboard", wrapAsync(requireOGAgentPermission("telecalling.view_dashboard")), wrapAsync(calling.callingDashboard));
router.post("/telecalling/campaigns/preview", wrapAsync(requireOGAgentPermission("telecalling.create_campaign")), wrapAsync(calling.previewCallingCampaign));
router.post("/telecalling/campaigns", wrapAsync(requireOGAgentPermission("telecalling.create_campaign")), wrapAsync(calling.createCallingCampaign));
router.get("/telecalling/campaigns", wrapAsync(requireOGAgentPermission("telecalling.view_dashboard")), wrapAsync(calling.listCallingCampaigns));
router.get("/telecalling/campaigns/:campaignId", wrapAsync(requireOGAgentPermission("telecalling.view_dashboard")), wrapAsync(calling.getCallingCampaign));
router.patch("/telecalling/campaigns/:campaignId", wrapAsync(requireOGAgentPermission("telecalling.manage_campaign")), wrapAsync(calling.updateCallingCampaign));
router.post("/telecalling/campaigns/:campaignId/activate", wrapAsync(requireOGAgentPermission("telecalling.manage_campaign")), wrapAsync(calling.activateCallingCampaign));
router.post("/telecalling/campaigns/:campaignId/pause", wrapAsync(requireOGAgentPermission("telecalling.manage_campaign")), wrapAsync(calling.pauseCallingCampaign));
router.post("/telecalling/campaigns/:campaignId/resume", wrapAsync(requireOGAgentPermission("telecalling.manage_campaign")), wrapAsync(calling.resumeCallingCampaign));
router.post("/telecalling/campaigns/:campaignId/complete", wrapAsync(requireOGAgentPermission("telecalling.manage_campaign")), wrapAsync(calling.completeCallingCampaign));
router.post("/telecalling/campaigns/:campaignId/cancel", wrapAsync(requireOGAgentPermission("telecalling.manage_campaign")), wrapAsync(calling.cancelCallingCampaign));
router.post("/telecalling/campaigns/:campaignId/archive", wrapAsync(requireOGAgentPermission("telecalling.manage_campaign")), wrapAsync(calling.archiveCallingCampaign));
router.get("/telecalling/queue", wrapAsync(requireOGAgentPermission("telecalling.view_own_queue")), wrapAsync(calling.listCallQueue));
router.get("/telecalling/queue/:queueItemId", wrapAsync(requireOGAgentPermission("telecalling.view_own_queue")), wrapAsync(calling.getCallQueueItem));
router.post("/telecalling/queue/:queueItemId/claim", wrapAsync(requireOGAgentPermission("telecalling.view_own_queue")), wrapAsync(calling.claimCallQueueItem));
router.post("/telecalling/queue/:queueItemId/release", wrapAsync(requireOGAgentPermission("telecalling.view_own_queue")), wrapAsync(calling.releaseCallQueueItem));
router.post("/telecalling/queue/:queueItemId/skip", wrapAsync(requireOGAgentPermission("telecalling.record_outcome")), wrapAsync(calling.skipCallQueueItem));
router.post("/telecalling/queue/:queueItemId/reassign", wrapAsync(requireOGAgentPermission("telecalling.assign_queue")), wrapAsync(calling.reassignCallQueueItemController));
router.post("/telecalling/queue/:queueItemId/start-manual", wrapAsync(requireOGAgentPermission("telecalling.record_outcome")), wrapAsync(calling.startManualCallController));
router.post("/telecalling/queue/:queueItemId/outcome", wrapAsync(requireOGAgentPermission("telecalling.record_outcome")), wrapAsync(calling.recordCallOutcomeController));
router.get("/telecalling/leads/:leadId/history", wrapAsync(requireOGAgentPermission("telecalling.view_own_queue")), wrapAsync(calling.getLeadCallHistory));
router.post("/telecalling/leads/:leadId/notes", wrapAsync(requireOGAgentPermission("telecalling.record_outcome")), wrapAsync(calling.addLeadCallNote));
router.post("/telecalling/script/generate", wrapAsync(requireOGAgentPermission("telecalling.view_own_queue")), wrapAsync(calling.generateCallScript));
router.get("/telecalling/script-templates", wrapAsync(requireOGAgentPermission("telecalling.view_own_queue")), wrapAsync(calling.listScriptTemplates));
router.post("/telecalling/script-templates", wrapAsync(requireOGAgentPermission("telecalling.manage_scripts")), wrapAsync(calling.createScriptTemplate));
router.patch("/telecalling/script-templates/:templateId", wrapAsync(requireOGAgentPermission("telecalling.manage_scripts")), wrapAsync(calling.updateScriptTemplate));
router.post("/telecalling/script-templates/:templateId/activate", wrapAsync(requireOGAgentPermission("telecalling.manage_scripts")), wrapAsync(calling.activateScriptTemplate));
router.post("/telecalling/script-templates/:templateId/archive", wrapAsync(requireOGAgentPermission("telecalling.manage_scripts")), wrapAsync(calling.archiveScriptTemplate));
router.get("/telecalling/follow-ups", wrapAsync(requireOGAgentPermission("telecalling.manage_followups")), wrapAsync(calling.listFollowUps));
router.post("/telecalling/follow-ups", wrapAsync(requireOGAgentPermission("telecalling.manage_followups")), wrapAsync(calling.createFollowUpController));
router.patch("/telecalling/follow-ups/:followUpId", wrapAsync(requireOGAgentPermission("telecalling.manage_followups")), wrapAsync(calling.updateFollowUp));
router.post("/telecalling/follow-ups/:followUpId/complete", wrapAsync(requireOGAgentPermission("telecalling.manage_followups")), wrapAsync(calling.completeFollowUpController));
router.post("/telecalling/follow-ups/:followUpId/cancel", wrapAsync(requireOGAgentPermission("telecalling.manage_followups")), wrapAsync(calling.cancelFollowUp));
router.get("/telecalling/reports/summary", wrapAsync(requireOGAgentPermission("telecalling.view_reports")), wrapAsync(calling.callingSummaryReport));
router.get("/telecalling/reports/campaign/:campaignId", wrapAsync(requireOGAgentPermission("telecalling.view_reports")), wrapAsync(calling.callingCampaignReport));
router.get("/telecalling/reports/telecaller/:telecallerId", wrapAsync(requireOGAgentPermission("telecalling.view_reports")), wrapAsync(calling.callingTelecallerReport));

router.get("/email/sources", wrapAsync(requireOGAgentPermission("VIEW")), wrapAsync(listEmailSources));
router.post("/email/search", wrapAsync(requireOGAgentPermission("CREATE_TASK")), wrapAsync(searchEmailMetadata));
router.post("/email/extractions", wrapAsync(requireOGAgentPermission("CREATE_TASK")), wrapAsync(createEmailExtraction));
router.get("/email/extractions", wrapAsync(requireOGAgentPermission("VIEW")), wrapAsync(listEmailExtractions));
router.get("/email/extractions/:extractionId", wrapAsync(requireOGAgentPermission("VIEW")), wrapAsync(getEmailExtraction));
router.post("/email/extractions/:extractionId/run", wrapAsync(requireOGAgentPermission("RUN_TASK")), wrapAsync(runEmailExtraction));
router.post("/email/extractions/:extractionId/cancel", wrapAsync(requireOGAgentPermission("CREATE_TASK")), wrapAsync(cancelEmailExtraction));
router.get("/email/extractions/:extractionId/candidates", wrapAsync(requireOGAgentPermission("VIEW")), wrapAsync(listLeadCandidates));
router.post("/email/extractions/:extractionId/check-duplicates", wrapAsync(requireOGAgentPermission("CREATE_TASK")), wrapAsync(checkExtractionDuplicates));
router.post("/email/extractions/:extractionId/import-preview", wrapAsync(requireOGAgentPermission("CREATE_TASK")), wrapAsync(previewLeadImport));
router.post("/email/extractions/:extractionId/request-import-approval", wrapAsync(requireOGAgentPermission("CREATE_TASK")), wrapAsync(requestImportApproval));
router.post("/email/extractions/:extractionId/import-approved", wrapAsync(requireOGAgentPermission("REVIEW_APPROVAL")), wrapAsync(importApprovedCandidates));
router.get("/email/candidates/:candidateId", wrapAsync(requireOGAgentPermission("VIEW")), wrapAsync(getLeadCandidate));
router.patch("/email/candidates/:candidateId", wrapAsync(requireOGAgentPermission("CREATE_TASK")), wrapAsync(updateLeadCandidate));
router.post("/email/candidates/bulk-selection", wrapAsync(requireOGAgentPermission("CREATE_TASK")), wrapAsync(bulkSelectLeadCandidates));
router.get("/business-leads", wrapAsync(requireOGAgentPermission("VIEW")), wrapAsync(listBusinessLeads));
router.get("/business-leads/:leadId", wrapAsync(requireOGAgentPermission("VIEW")), wrapAsync(getBusinessLead));
router.patch("/business-leads/:leadId/status", wrapAsync(requireOGAgentPermission("CREATE_TASK")), wrapAsync(updateBusinessLeadStatus));

router.get("/tasks", wrapAsync(requireOGAgentPermission("VIEW")), wrapAsync(listOGAgentTasks));
router.post("/tasks", wrapAsync(requireOGAgentPermission("CREATE_TASK")), wrapAsync(createOGAgentTask));
router.get("/tasks/:taskId", wrapAsync(requireOGAgentPermission("VIEW")), wrapAsync(getOGAgentTask));
router.post("/tasks/:taskId/plan", wrapAsync(requireOGAgentPermission("CREATE_TASK")), wrapAsync(planOGAgentTaskController));
router.post("/tasks/:taskId/run", wrapAsync(requireOGAgentPermission("RUN_TASK")), wrapAsync(runOGAgentTaskController));
router.post("/tasks/:taskId/cancel", wrapAsync(requireOGAgentPermission("CREATE_TASK")), wrapAsync(cancelOGAgentTaskController));

router.get("/approvals", wrapAsync(requireOGAgentPermission("VIEW")), wrapAsync(listOGAgentApprovals));
router.get("/approvals/:approvalId", wrapAsync(requireOGAgentPermission("VIEW")), wrapAsync(getOGAgentApproval));
router.post("/approvals/:approvalId/approve", wrapAsync(requireOGAgentPermission("REVIEW_APPROVAL")), wrapAsync(approveOGAgentApproval));
router.post("/approvals/:approvalId/reject", wrapAsync(requireOGAgentPermission("REVIEW_APPROVAL")), wrapAsync(rejectOGAgentApproval));

router.get("/audit-logs", wrapAsync(requireOGAgentPermission("VIEW_AUDIT")), wrapAsync(listOGAgentAuditLogsController));
router.get("/settings", wrapAsync(requireOGAgentPermission("VIEW")), wrapAsync(getOGAgentSettingsController));
router.patch("/settings", wrapAsync(requireOGAgentPermission("CHANGE_SETTINGS")), wrapAsync(updateOGAgentSettingsController));
router.get("/tools", wrapAsync(requireOGAgentPermission("VIEW")), wrapAsync(listOGAgentToolsController));

router.use(ogAgentErrorHandler);

export default router;
