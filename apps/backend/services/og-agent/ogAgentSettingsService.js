import OGAgentSettings from "../../models/OGAgentSettings.js";

export const LOCKED_OG_AGENT_SETTINGS = [
  "allowEmailDraftCreation",
  "allowEmailSending",
  "allowMailboxModification",
  "allowAutomaticAccountCreation",
  "allowAutomaticExistingRecordUpdate",
  "allowAICalling",
  "allowCallRecording",
  "allowSMS",
  "allowWhatsAppSending",
  "allowAutomaticEmailSending",
  "allowCodeExecution",
  "allowProductionDeployment",
  "allowFileDeletion",
  "allowFileRename",
  "allowLockfileModification",
  "allowDependencyInstallation",
  "allowArbitraryTerminal",
  "allowSecretFileRead",
  "allowGitCommit",
  "allowGitPush",
  "allowGitMerge",
  "allowDatabaseWrite",
  "requireApprovalForPatchGeneration",
  "requireApprovalForPatchApplication",
  "requireAdditionalApprovalForHighRiskFiles",
  "allowLocalBranchCreation",
  "requireApprovalForLeadImport",
  "allowAutomaticPromptActivation", "allowAutomaticRuleActivation", "allowAutomaticPermissionChange",
  "allowAutomaticToolEnablement", "allowAutomaticSecurityPolicyChange", "allowAutomaticApprovalBypass",
  "allowAutomaticCodeModification", "allowAutomaticDeployment", "allowFeedbackDeletion", "allowHistoricalRewrite",
  "allowPersonalContactExtraction", "allowPdfCollection", "allowPrivateProfileCollection", "allowCaptchaBypass", "allowLoginBypass", "allowProxyEvasion", "allowArbitraryUrlFetch", "allowExternalFormSubmission", "allowAutomaticOutreach", "allowUnapprovedApiCall", "allowSourcePolicyOverrideByAgent",
];

const LOCKED_SETTING_VALUES = {
  allowEmailDraftCreation: false,
  allowEmailSending: false,
  allowMailboxModification: false,
  allowAutomaticAccountCreation: false,
  allowAutomaticExistingRecordUpdate: false,
  allowAICalling: false,
  allowCallRecording: false,
  allowSMS: false,
  allowWhatsAppSending: false,
  allowAutomaticEmailSending: false,
  allowCodeExecution: false,
  allowProductionDeployment: false,
  allowFileDeletion: false,
  allowFileRename: false,
  allowLockfileModification: false,
  allowDependencyInstallation: false,
  allowArbitraryTerminal: false,
  allowSecretFileRead: false,
  allowGitCommit: false,
  allowGitPush: false,
  allowGitMerge: false,
  allowDatabaseWrite: false,
  requireApprovalForPatchGeneration: true,
  requireApprovalForPatchApplication: true,
  requireAdditionalApprovalForHighRiskFiles: true,
  allowLocalBranchCreation: false,
  requireApprovalForLeadImport: true,
  allowAutomaticPromptActivation: false,
  allowAutomaticRuleActivation: false,
  allowAutomaticPermissionChange: false,
  allowAutomaticToolEnablement: false,
  allowAutomaticSecurityPolicyChange: false,
  allowAutomaticApprovalBypass: false,
  allowAutomaticCodeModification: false,
  allowAutomaticDeployment: false,
  allowFeedbackDeletion: false,
  allowHistoricalRewrite: false,
  allowPersonalContactExtraction: false, allowPdfCollection: false, allowPrivateProfileCollection: false, allowCaptchaBypass: false, allowLoginBypass: false, allowProxyEvasion: false, allowArbitraryUrlFetch: false, allowExternalFormSubmission: false, allowAutomaticOutreach: false, allowUnapprovedApiCall: false, allowSourcePolicyOverrideByAgent: false,
};

export const WRITABLE_OG_AGENT_SETTINGS = [
  "agentEnabled",
  "allowReadOnlyDatabaseSearch",
  "allowReportGeneration",
  "allowEmailSearch",
  "allowEmailLeadExtraction",
  "maximumMessagesPerExtraction",
  "minimumDefaultConfidence",
  "allowCandidateEditing",
  "allowBusinessLeadStatusUpdates",
  "allowTelecallingPreparation",
  "allowCallingCampaigns",
  "allowCallQueueAssignment",
  "allowCallOutcomeRecording",
  "allowFollowUpManagement",
  "allowCallScriptGeneration",
  "allowBusinessLeadFieldVerification",
  "allowLeadStatusUpdateFromCall",
  "allowTelephoneLinks",
  "requireManagerApprovalForBulkCampaign",
  "maximumLeadsPerCampaign",
  "maximumActiveQueueItemsPerTelecaller",
  "queueLockMinutes",
  "defaultRetryDays",
  "minimumCallNoteLength",
  "allowCodeAnalysis",
  "allowCodePatchGeneration",
  "codingAgentEnabled",
  "allowRepositoryRead",
  "allowRepositorySearch",
  "allowCodingAnalysis",
  "allowPatchGeneration",
  "allowPatchApplication",
  "allowSafeCommandExecution",
  "requireApprovalForBuild",
  "requireApprovalForTests",
  "requireApprovalForLint",
  "maximumFilesPerTask",
  "maximumBytesPerFile",
  "maximumTotalReadBytesPerTask",
  "maximumPatchBytes",
  "maximumPatchFiles",
  "maximumCommandOutputBytes",
  "commandTimeoutSeconds",
  "maximumConcurrentCommandRuns",
  "allowFileCreation",
  "requireApprovalForMediumRisk",
  "requireApprovalForHighRisk",
  "improvementEngineEnabled", "allowFeedbackCollection", "allowProposalRevision",
  "allowApprovedExampleRetrieval", "allowOrganizationalGuidanceRetrieval", "allowImprovementPatternAnalysis",
  "allowImprovementProposalGeneration", "allowEvaluationRuns", "allowPromptVersionCreation", "allowRuleVersionCreation",
  "requireApprovalForApprovedExampleActivation", "requireApprovalForGuidanceActivation", "requireApprovalForPromptActivation",
  "requireApprovalForRuleActivation", "requireApprovalForRollback", "minimumFeedbackForImprovementProposal",
  "minimumReviewersForOrganizationGuidance", "maximumRetrievedExamples", "maximumRetrievedGuidance", "maximumRevisionAttempts",
  "regressionAlertThreshold", "harmfulRecommendationAlertThreshold", "humanImpactReviewRequiredForMediumRisk", "humanImpactReviewRequiredForHighRisk",
  "researchAgentEnabled", "allowPublicWebsiteResearch", "allowApprovedApiResearch", "allowWebsitePageFetch", "allowApiFetch", "allowPublicBusinessContactExtraction", "allowLeadCandidateCreation", "requireApprovalForContactExtraction", "requireApprovalAbovePageLimit", "maximumSourcesPerTask", "maximumPagesPerTask", "maximumRecordsPerTask", "maximumDepth", "maximumResponseBytes", "maximumTotalBytesPerTask", "requestTimeoutSeconds", "minimumDelayMilliseconds", "maximumConcurrentRequests", "maximumRequestsPerMinute", "maximumRequestsPerDay", "stopAfterRepeated403", "stopAfterRepeated429", "requireActiveSourceReview", "sourceReviewValidityDays", "staleDataWarningDays",
];

const safeDefaults = {
  key: "company",
  agentEnabled: true,
  allowReadOnlyDatabaseSearch: true,
  allowReportGeneration: true,
  allowEmailSearch: false,
  allowEmailLeadExtraction: true,
  maximumMessagesPerExtraction: 50,
  minimumDefaultConfidence: 70,
  requireApprovalForLeadImport: true,
  allowCandidateEditing: true,
  allowBusinessLeadStatusUpdates: true,
  allowEmailDraftCreation: false,
  allowEmailSending: false,
  allowMailboxModification: false,
  allowAutomaticAccountCreation: false,
  allowAutomaticExistingRecordUpdate: false,
  allowTelecallingPreparation: true,
  allowCallingCampaigns: true,
  allowCallQueueAssignment: true,
  allowCallOutcomeRecording: true,
  allowFollowUpManagement: true,
  allowCallScriptGeneration: true,
  allowBusinessLeadFieldVerification: true,
  allowLeadStatusUpdateFromCall: true,
  allowTelephoneLinks: true,
  requireManagerApprovalForBulkCampaign: false,
  maximumLeadsPerCampaign: 250,
  maximumActiveQueueItemsPerTelecaller: 100,
  queueLockMinutes: 15,
  defaultRetryDays: 3,
  minimumCallNoteLength: 10,
  allowAICalling: false,
  allowCallRecording: false,
  allowSMS: false,
  allowWhatsAppSending: false,
  allowAutomaticEmailSending: false,
  allowCodeAnalysis: true,
  allowCodePatchGeneration: false,
  codingAgentEnabled: true,
  allowRepositoryRead: true,
  allowRepositorySearch: true,
  allowCodingAnalysis: true,
  allowPatchGeneration: true,
  allowPatchApplication: true,
  requireApprovalForPatchGeneration: true,
  requireApprovalForPatchApplication: true,
  requireAdditionalApprovalForHighRiskFiles: true,
  allowSafeCommandExecution: true,
  requireApprovalForBuild: true,
  requireApprovalForTests: true,
  requireApprovalForLint: true,
  maximumFilesPerTask: 100,
  maximumBytesPerFile: 200000,
  maximumTotalReadBytesPerTask: 2000000,
  maximumPatchBytes: 500000,
  maximumPatchFiles: 25,
  maximumCommandOutputBytes: 100000,
  commandTimeoutSeconds: 300,
  maximumConcurrentCommandRuns: 1,
  allowLocalBranchCreation: false,
  allowFileCreation: true,
  allowFileDeletion: false,
  allowFileRename: false,
  allowLockfileModification: false,
  allowDependencyInstallation: false,
  allowArbitraryTerminal: false,
  allowSecretFileRead: false,
  allowGitCommit: false,
  allowGitPush: false,
  allowGitMerge: false,
  allowDatabaseWrite: false,
  allowCodeExecution: false,
  allowProductionDeployment: false,
  requireApprovalForMediumRisk: true,
  requireApprovalForHighRisk: true,
  improvementEngineEnabled: true, allowFeedbackCollection: true, allowProposalRevision: true,
  allowApprovedExampleRetrieval: true, allowOrganizationalGuidanceRetrieval: true, allowImprovementPatternAnalysis: true,
  allowImprovementProposalGeneration: true, allowEvaluationRuns: true, allowPromptVersionCreation: true, allowRuleVersionCreation: true,
  requireApprovalForApprovedExampleActivation: true, requireApprovalForGuidanceActivation: true, requireApprovalForPromptActivation: true,
  requireApprovalForRuleActivation: true, requireApprovalForRollback: true, minimumFeedbackForImprovementProposal: 5,
  minimumReviewersForOrganizationGuidance: 2, maximumRetrievedExamples: 5, maximumRetrievedGuidance: 5, maximumRevisionAttempts: 3,
  regressionAlertThreshold: 10, harmfulRecommendationAlertThreshold: 5, humanImpactReviewRequiredForMediumRisk: true,
  humanImpactReviewRequiredForHighRisk: true, allowAutomaticPromptActivation: false, allowAutomaticRuleActivation: false,
  allowAutomaticPermissionChange: false, allowAutomaticToolEnablement: false, allowAutomaticSecurityPolicyChange: false,
  allowAutomaticApprovalBypass: false, allowAutomaticCodeModification: false, allowAutomaticDeployment: false,
  allowFeedbackDeletion: false, allowHistoricalRewrite: false,
  researchAgentEnabled: true, allowPublicWebsiteResearch: true, allowApprovedApiResearch: true, allowWebsitePageFetch: true, allowApiFetch: true, allowPublicBusinessContactExtraction: true, allowPersonalContactExtraction: false, allowLeadCandidateCreation: true, requireApprovalForContactExtraction: true, requireApprovalAbovePageLimit: 10, maximumSourcesPerTask: 5, maximumPagesPerTask: 25, maximumRecordsPerTask: 500, maximumDepth: 1, maximumResponseBytes: 500000, maximumTotalBytesPerTask: 5000000, requestTimeoutSeconds: 15, minimumDelayMilliseconds: 1000, maximumConcurrentRequests: 1, maximumRequestsPerMinute: 30, maximumRequestsPerDay: 2000, stopAfterRepeated403: 2, stopAfterRepeated429: 2, requireActiveSourceReview: true, sourceReviewValidityDays: 365, staleDataWarningDays: 365, allowPdfCollection: false, allowPrivateProfileCollection: false, allowCaptchaBypass: false, allowLoginBypass: false, allowProxyEvasion: false, allowArbitraryUrlFetch: false, allowExternalFormSubmission: false, allowAutomaticOutreach: false, allowUnapprovedApiCall: false, allowSourcePolicyOverrideByAgent: false,
};

const omitSettings = (settings, keys) => {
  const omitted = new Set(keys);
  return Object.fromEntries(Object.entries(settings).filter(([key]) => !omitted.has(key)));
};

export const enforcePhase1Settings = (input = {}) => {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    const error = new Error("Settings payload must be an object");
    error.statusCode = 400;
    throw error;
  }

  const unknown = Object.keys(input).filter(
    (key) => !WRITABLE_OG_AGENT_SETTINGS.includes(key) && !LOCKED_OG_AGENT_SETTINGS.includes(key)
  );
  if (unknown.length) {
    const error = new Error(`Unsupported settings: ${unknown.join(", ")}`);
    error.statusCode = 400;
    throw error;
  }

  const updates = {};
  const numericSettings = new Map([
    ["maximumMessagesPerExtraction", { min: 1, max: 250 }],
    ["minimumDefaultConfidence", { min: 0, max: 100 }],
    ["maximumLeadsPerCampaign", { min: 1, max: 1000 }],
    ["maximumActiveQueueItemsPerTelecaller", { min: 1, max: 500 }],
    ["queueLockMinutes", { min: 1, max: 60 }],
    ["defaultRetryDays", { min: 1, max: 90 }],
    ["minimumCallNoteLength", { min: 0, max: 500 }],
    ["maximumFilesPerTask", { min: 1, max: 500 }],
    ["maximumBytesPerFile", { min: 1024, max: 1000000 }],
    ["maximumTotalReadBytesPerTask", { min: 1024, max: 10000000 }],
    ["maximumPatchBytes", { min: 1024, max: 2000000 }],
    ["maximumPatchFiles", { min: 1, max: 100 }],
    ["maximumCommandOutputBytes", { min: 1024, max: 500000 }],
    ["commandTimeoutSeconds", { min: 5, max: 600 }],
    ["maximumConcurrentCommandRuns", { min: 1, max: 4 }],
    ["minimumFeedbackForImprovementProposal", { min: 1, max: 100 }],
    ["minimumReviewersForOrganizationGuidance", { min: 1, max: 20 }],
    ["maximumRetrievedExamples", { min: 1, max: 20 }],
    ["maximumRetrievedGuidance", { min: 1, max: 20 }],
    ["maximumRevisionAttempts", { min: 1, max: 10 }],
    ["regressionAlertThreshold", { min: 0, max: 100 }],
    ["harmfulRecommendationAlertThreshold", { min: 0, max: 100 }],
    ["requireApprovalAbovePageLimit", { min: 1, max: 100 }], ["maximumSourcesPerTask", { min: 1, max: 20 }], ["maximumPagesPerTask", { min: 1, max: 1000 }], ["maximumRecordsPerTask", { min: 1, max: 10000 }], ["maximumDepth", { min: 0, max: 5 }], ["maximumResponseBytes", { min: 1024, max: 2000000 }], ["maximumTotalBytesPerTask", { min: 1024, max: 20000000 }], ["requestTimeoutSeconds", { min: 5, max: 60 }], ["minimumDelayMilliseconds", { min: 0, max: 60000 }], ["maximumConcurrentRequests", { min: 1, max: 4 }], ["maximumRequestsPerMinute", { min: 1, max: 600 }], ["maximumRequestsPerDay", { min: 1, max: 100000 }], ["stopAfterRepeated403", { min: 1, max: 10 }], ["stopAfterRepeated429", { min: 1, max: 10 }], ["sourceReviewValidityDays", { min: 1, max: 1095 }], ["staleDataWarningDays", { min: 1, max: 3650 }],
  ]);
  WRITABLE_OG_AGENT_SETTINGS.forEach((key) => {
    if (!(key in input)) return;
    if (numericSettings.has(key)) {
      const value = Number(input[key]);
      const bounds = numericSettings.get(key);
      if (!Number.isInteger(value) || value < bounds.min || value > bounds.max) {
        const error = new Error(`${key} must be an integer between ${bounds.min} and ${bounds.max}`);
        error.statusCode = 400;
        throw error;
      }
      updates[key] = value;
      return;
    }
    if (typeof input[key] !== "boolean") {
      const error = new Error(`${key} must be a boolean`);
      error.statusCode = 400;
      throw error;
    }
    updates[key] = input[key];
  });
  LOCKED_OG_AGENT_SETTINGS.forEach((key) => {
    updates[key] = LOCKED_SETTING_VALUES[key];
  });
  return updates;
};

export const getOGAgentSettings = async () => {
  const settings = await OGAgentSettings.findOne({ key: "company" });
  if (!settings) return new OGAgentSettings(safeDefaults);
  LOCKED_OG_AGENT_SETTINGS.forEach((key) => {
    settings[key] = LOCKED_SETTING_VALUES[key];
  });
  return settings;
};

export const updateOGAgentSettings = async (input, adminId) => {
  const updates = enforcePhase1Settings(input);
  return OGAgentSettings.findOneAndUpdate(
    { key: "company" },
    {
      $setOnInsert: omitSettings(safeDefaults, Object.keys(updates)),
      $set: { ...updates, updatedBy: adminId },
    },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: false }
  );
};
