import crypto from "node:crypto";
import BusinessLead from "../../../models/BusinessLead.js";
import OGAgentApproval from "../../../models/OGAgentApproval.js";
import OGAgentLeadCandidate from "../../../models/OGAgentLeadCandidate.js";
import OGAgentLeadExtraction from "../../../models/OGAgentLeadExtraction.js";
import { checkCandidateDuplicates } from "./emailLeadDuplicateService.js";

const approvalLifetimeMs = 7 * 24 * 60 * 60 * 1000;

export const buildCandidateFingerprint = (candidate) => crypto
  .createHash("sha256")
  .update(JSON.stringify({
    suggestedLeadType: candidate.suggestedLeadType,
    extractedData: candidate.extractedData,
    normalizedData: candidate.normalizedData,
    overallConfidence: candidate.overallConfidence,
    duplicateStatus: candidate.duplicateStatus,
    selectedForImport: candidate.selectedForImport,
  }))
  .digest("hex");

const importableTypes = new Set(["GROWER", "BUYER", "BOTH", "CANDIDATE", "INVESTOR", "LOGISTICS", "OTHER"]);

export const buildLeadImportPreview = async (extractionId) => {
  const candidates = await OGAgentLeadCandidate.find({ extractionId }).sort({ createdAt: 1 }).lean();
  const selected = candidates.filter((candidate) => candidate.selectedForImport && ["SELECTED", "WAITING_APPROVAL"].includes(candidate.importStatus));
  return {
    totalCandidates: candidates.length,
    selectedCandidates: selected.length,
    uniqueCandidates: candidates.filter((candidate) => candidate.duplicateStatus === "UNIQUE").length,
    possibleDuplicates: candidates.filter((candidate) => candidate.duplicateStatus === "POSSIBLE_DUPLICATE").length,
    confirmedDuplicates: candidates.filter((candidate) => candidate.duplicateStatus === "CONFIRMED_DUPLICATE").length,
    invalidCandidates: candidates.filter((candidate) => candidate.validationErrors?.length).length,
    uncertainClassifications: candidates.filter((candidate) => candidate.suggestedLeadType === "UNCERTAIN").length,
    recordsToSkip: candidates.length - selected.length,
    selected: selected.map((candidate) => ({
      candidateId: candidate._id,
      leadType: candidate.suggestedLeadType,
      name: candidate.extractedData?.name,
      businessName: candidate.extractedData?.businessName,
      email: candidate.extractedData?.email,
      phone: candidate.extractedData?.phone,
      sourceMessageId: candidate.source?.messageId,
      confidence: candidate.overallConfidence,
    })),
  };
};

export const requestLeadImportApproval = async ({ extraction, requestedBy }) => {
  const existing = await OGAgentApproval.findOne({ taskId: extraction.taskId, actionType: "LEAD_IMPORT", status: "PENDING" });
  if (existing) {
    const error = new Error("A lead import approval is already pending for this extraction");
    error.statusCode = 409;
    error.code = "APPROVAL_ALREADY_PENDING";
    throw error;
  }
  const selected = await OGAgentLeadCandidate.find({ extractionId: extraction._id, selectedForImport: true, importStatus: "SELECTED" });
  if (!selected.length) {
    const error = new Error("Select at least one valid unique candidate before requesting approval");
    error.statusCode = 400;
    error.code = "NO_SELECTED_CANDIDATES";
    throw error;
  }
  if (selected.some((candidate) => candidate.duplicateStatus === "CONFIRMED_DUPLICATE" || candidate.suggestedLeadType === "UNCERTAIN" || candidate.validationErrors.length)) {
    const error = new Error("Selected candidates include a duplicate, uncertain classification, or invalid record");
    error.statusCode = 409;
    error.code = "CANDIDATE_REVIEW_REQUIRED";
    throw error;
  }

  await OGAgentLeadCandidate.updateMany(
    { _id: { $in: selected.map((candidate) => candidate._id) }, importStatus: "SELECTED" },
    { $set: { importStatus: "WAITING_APPROVAL", reviewedBy: requestedBy, reviewedAt: new Date() } }
  );
  const snapshotCandidates = await OGAgentLeadCandidate.find({ _id: { $in: selected.map((candidate) => candidate._id) } }).lean();
  const candidateSnapshots = snapshotCandidates.map((candidate) => ({
    candidateId: String(candidate._id),
    updatedAt: new Date(candidate.updatedAt).toISOString(),
    fingerprint: buildCandidateFingerprint(candidate),
  }));
  const preview = await buildLeadImportPreview(extraction._id);
  preview.selectedCandidates = snapshotCandidates.length;
  preview.selected = snapshotCandidates.map((candidate) => ({
    candidateId: candidate._id,
    leadType: candidate.suggestedLeadType,
    name: candidate.extractedData?.name,
    businessName: candidate.extractedData?.businessName,
    email: candidate.extractedData?.email,
    phone: candidate.extractedData?.phone,
    sourceMessageId: candidate.source?.messageId,
    confidence: candidate.overallConfidence,
  }));

  const approval = await OGAgentApproval.create({
    taskId: extraction.taskId,
    subjectType: "LEAD_EXTRACTION",
    subjectId: extraction._id,
    subjectKey: `LEAD_EXTRACTION:${extraction._id}:LEAD_IMPORT`,
    requestedBy,
    actionType: "LEAD_IMPORT",
    actionTitle: `Import ${snapshotCandidates.length} reviewed Business Lead${snapshotCandidates.length === 1 ? "" : "s"}`,
    actionDescription: "Approval permits only the immutable selected candidate snapshot to be inserted as new BusinessLead records. It cannot update users or existing leads.",
    actionPreview: {
      extractionId: String(extraction._id),
      sourceMailbox: extraction.mailboxSource,
      requestedBy: String(requestedBy),
      candidateSnapshots,
      preview,
      existingRecordsWillBeUpdated: false,
      userAccountsWillBeCreated: false,
    },
    riskLevel: "MEDIUM",
    status: "PENDING",
  });
  extraction.status = "WAITING_APPROVAL";
  extraction.approvalId = approval._id;
  await extraction.save();
  return { approval, preview };
};

const candidateToBusinessLead = (candidate, extraction, adminId) => ({
  leadType: candidate.suggestedLeadType,
  status: "UNVERIFIED",
  ...candidate.extractedData,
  sourceType: "EMAIL",
  sourceReference: candidate.source.sourceReference,
  sourceMessageId: candidate.source.messageId,
  sourceThreadId: candidate.source.threadId,
  sourceMailbox: candidate.source.mailbox,
  sourceSubject: candidate.source.subject,
  sourceReceivedAt: candidate.source.receivedAt,
  sourceEvidence: candidate.source.evidenceSnippet,
  extractionTaskId: extraction._id,
  sourceCandidateId: candidate._id,
  classificationConfidence: candidate.fieldConfidence?.leadType || candidate.overallConfidence,
  overallConfidence: candidate.overallConfidence,
  verificationStatus: candidate.overallConfidence < 90 ? "MANUAL_REVIEW_REQUIRED" : "ADMIN_REVIEWED",
  consentStatus: "UNKNOWN",
  duplicateStatus: "UNIQUE",
  importedBy: adminId,
  importedAt: new Date(),
  createdByType: "OG_AGENT",
});

export const importApprovedLeadSnapshot = async ({ extraction, approval, adminId, minimumConfidence = 70 }) => {
  if (approval.actionType !== "LEAD_IMPORT" || approval.status !== "APPROVED") {
    const error = new Error("An approved lead import request is required");
    error.statusCode = 409;
    error.code = "IMPORT_NOT_APPROVED";
    throw error;
  }
  if (approval.consumedAt) {
    const error = new Error("This approval has already been used");
    error.statusCode = 409;
    error.code = "APPROVAL_ALREADY_CONSUMED";
    throw error;
  }
  if ((approval.conditions || []).some((condition) => !condition.satisfied)) {
    const error = new Error("Lead import approval conditions must be satisfied before execution");
    error.statusCode = 409;
    error.code = "APPROVAL_CONDITIONS_UNMET";
    throw error;
  }
  if (Date.now() - new Date(approval.createdAt).getTime() > approvalLifetimeMs) {
    approval.status = "EXPIRED";
    await approval.save();
    const error = new Error("The lead import approval has expired");
    error.statusCode = 409;
    error.code = "APPROVAL_EXPIRED";
    throw error;
  }
  const snapshots = approval.actionPreview?.candidateSnapshots || [];
  const snapshotIds = snapshots.map((snapshot) => snapshot.candidateId);
  const candidates = await OGAgentLeadCandidate.find({ _id: { $in: snapshotIds }, extractionId: extraction._id });
  if (candidates.length !== snapshots.length) {
    const error = new Error("The approved candidate snapshot is incomplete");
    error.statusCode = 409;
    error.code = "APPROVAL_SNAPSHOT_CHANGED";
    throw error;
  }
  for (const candidate of candidates) {
    const snapshot = snapshots.find((item) => item.candidateId === String(candidate._id));
    if (!snapshot || new Date(candidate.updatedAt).toISOString() !== snapshot.updatedAt || buildCandidateFingerprint(candidate.toObject()) !== snapshot.fingerprint) {
      const error = new Error("A candidate changed after approval; request a new approval");
      error.statusCode = 409;
      error.code = "APPROVAL_SNAPSHOT_CHANGED";
      throw error;
    }
  }

  const duplicateResults = await checkCandidateDuplicates(candidates, { minimumConfidence, persist: false });
  const duplicateByCandidate = new Map(duplicateResults.map((result) => [String(result.candidateId), result]));

  const claimed = await OGAgentApproval.findOneAndUpdate(
    { _id: approval._id, status: "APPROVED", consumedAt: null },
    { $set: { consumedAt: new Date(), consumedBy: adminId } },
    { new: true }
  );
  if (!claimed) {
    const error = new Error("This approval has already been used");
    error.statusCode = 409;
    error.code = "APPROVAL_ALREADY_CONSUMED";
    throw error;
  }

  extraction.status = "IMPORTING";
  await extraction.save();
  const summary = { approved: candidates.length, imported: 0, skipped: 0, failed: 0, records: [], errors: [] };

  for (const candidate of candidates) {
    const duplicate = duplicateByCandidate.get(String(candidate._id));
    const eligible = importableTypes.has(candidate.suggestedLeadType)
      && candidate.overallConfidence >= minimumConfidence
      && !candidate.validationErrors.length
      && duplicate?.duplicateStatus !== "CONFIRMED_DUPLICATE"
      && !candidate.importedLeadId;
    if (!eligible) {
      candidate.importStatus = "SKIPPED";
      candidate.selectedForImport = false;
      candidate.duplicateStatus = duplicate?.duplicateStatus || candidate.duplicateStatus;
      candidate.duplicateMatches = duplicate?.duplicateMatches || candidate.duplicateMatches;
      await candidate.save();
      summary.skipped += 1;
      summary.records.push({ candidateId: candidate._id, status: "SKIPPED", reason: candidate.importedLeadId ? "Already imported" : "Candidate requires review or became a duplicate" });
      continue;
    }
    try {
      const lead = await BusinessLead.create(candidateToBusinessLead(candidate.toObject(), extraction, adminId));
      candidate.importedLeadId = lead._id;
      candidate.importStatus = "IMPORTED";
      candidate.selectedForImport = false;
      await candidate.save();
      summary.imported += 1;
      summary.records.push({ candidateId: candidate._id, leadId: lead._id, status: "IMPORTED" });
    } catch (error) {
      candidate.importStatus = error?.code === 11000 ? "SKIPPED" : "FAILED";
      candidate.selectedForImport = false;
      await candidate.save();
      if (error?.code === 11000) summary.skipped += 1;
      else summary.failed += 1;
      summary.errors.push({ candidateId: candidate._id, message: error?.code === 11000 ? "Candidate was already imported" : "Business Lead import failed safely" });
    }
  }
  extraction.status = "COMPLETED";
  extraction.completedAt = new Date();
  extraction.importSummary = summary;
  await extraction.save();
  return summary;
};
