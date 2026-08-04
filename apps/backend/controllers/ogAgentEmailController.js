import mongoose from "mongoose";
import BusinessLead, { BUSINESS_LEAD_STATUSES } from "../models/BusinessLead.js";
import OGAgentApproval from "../models/OGAgentApproval.js";
import OGAgentLeadCandidate, { OG_AGENT_CANDIDATE_TYPES } from "../models/OGAgentLeadCandidate.js";
import OGAgentLeadExtraction, { OG_AGENT_EXTRACTION_TARGETS } from "../models/OGAgentLeadExtraction.js";
import OGAgentTask from "../models/OGAgentTask.js";
import { createOGAgentAuditLog, getRequestAuditContext } from "../services/og-agent/ogAgentAuditService.js";
import { getOGAgentSettings } from "../services/og-agent/ogAgentSettingsService.js";
import { extractLeadCandidateFromMessage } from "../services/og-agent/email/emailLeadExtractionService.js";
import { checkCandidateDuplicates } from "../services/og-agent/email/emailLeadDuplicateService.js";
import { buildNormalizedCandidateData, normalizeExtractedEmail, normalizeExtractedPhone } from "../services/og-agent/email/emailLeadNormalizationService.js";
import { buildLeadImportPreview, importApprovedLeadSnapshot, requestLeadImportApproval } from "../services/og-agent/email/emailLeadImportService.js";
import { getSafeSynchronizedMessage, searchSynchronizedMessages } from "../services/og-agent/email/emailSearchService.js";
import { getEmailSourceAdapter, listAvailableEmailSources } from "../services/og-agent/email/emailSourceRegistry.js";

const error = (statusCode, message, code = "EMAIL_INTELLIGENCE_ERROR") => Object.assign(new Error(message), { statusCode, code });
const validId = (value, label) => {
  if (!mongoose.isValidObjectId(value)) throw error(400, `${label} is invalid`, "VALIDATION_ERROR");
  return value;
};
const parsePagination = (query, fallback = 25) => {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || fallback);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) throw error(400, "Pagination is invalid", "VALIDATION_ERROR");
  return { page, limit };
};
const cleanText = (value, maximum) => String(value || "").replace(/\s+/g, " ").trim().slice(0, maximum);
const parseBoolean = (value, fallback) => value === undefined ? fallback : value === true;
const parseDate = (value, label) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw error(400, `${label} is invalid`, "VALIDATION_ERROR");
  return date;
};
const taskPopulate = { path: "requestedBy", select: "name email role adminClass" };
const extractionPopulate = [{ path: "requestedBy", select: "name email role adminClass" }, { path: "approvalId", select: "status actionTitle reviewedBy reviewedAt reviewerNote consumedAt" }];

export const sanitizeExtractionInput = (body = {}, settings = {}) => {
  const sourceId = cleanText(body.sourceId, 120);
  if (!sourceId) throw error(400, "Email source is required", "VALIDATION_ERROR");
  const targetInput = Array.isArray(body.targetTypes) ? body.targetTypes : [body.targetType || "BOTH"];
  const targetTypes = [...new Set(targetInput.map((item) => String(item || "").trim().toUpperCase()))];
  if (!targetTypes.length || targetTypes.some((type) => !OG_AGENT_EXTRACTION_TARGETS.includes(type))) throw error(400, "Target contact type is invalid", "VALIDATION_ERROR");
  const dateFrom = parseDate(body.dateFrom, "dateFrom");
  const dateTo = parseDate(body.dateTo, "dateTo");
  if (dateFrom && dateTo && dateFrom > dateTo) throw error(400, "dateFrom cannot be later than dateTo", "VALIDATION_ERROR");
  const searchTermsInput = Array.isArray(body.searchTerms) ? body.searchTerms : String(body.searchTerms || "").split(/[,;\n]+/);
  const searchTerms = [...new Set(searchTermsInput.map((item) => cleanText(item, 100)).filter(Boolean))].slice(0, 10);
  const maximumAllowed = Math.min(Number(settings.maximumMessagesPerExtraction || 50), 250);
  const maximumMessages = body.maximumMessages === undefined ? Math.min(50, maximumAllowed) : Number(body.maximumMessages);
  if (!Number.isInteger(maximumMessages) || maximumMessages < 1 || maximumMessages > maximumAllowed) throw error(400, `maximumMessages must be between 1 and ${maximumAllowed}`, "MESSAGE_LIMIT_EXCEEDED");
  if (body.includeSentMessages === true) throw error(400, "Sent-message analysis is not supported by this read-only source", "UNSUPPORTED_EMAIL_FILTER");
  const folderFilter = cleanText(body.folderFilter || "INBOX", 120);
  if (folderFilter && folderFilter.toUpperCase() !== "INBOX") throw error(400, "Only the synchronized INBOX source is available", "UNSUPPORTED_EMAIL_FILTER");
  return {
    sourceId,
    filters: {
      targetTypes, dateFrom, dateTo, searchTerms,
      senderFilter: cleanText(body.senderFilter, 320),
      subjectFilter: cleanText(body.subjectFilter, 300),
      folderFilter: "INBOX",
      maximumMessages,
      includeSentMessages: false,
      includeArchivedMessages: parseBoolean(body.includeArchivedMessages, false),
      ignorePreviouslyProcessed: parseBoolean(body.ignorePreviouslyProcessed, true),
    },
  };
};

const requireEmailSettings = async ({ extraction = false } = {}) => {
  const settings = await getOGAgentSettings();
  if (!settings.agentEnabled) throw error(409, "OG Agent is paused", "AGENT_PAUSED");
  if (!settings.allowEmailSearch) throw error(403, "Email search is disabled in OG Agent settings", "EMAIL_SEARCH_DISABLED");
  if (extraction && !settings.allowEmailLeadExtraction) throw error(403, "Email lead extraction is disabled in OG Agent settings", "EMAIL_EXTRACTION_DISABLED");
  return settings;
};

const loadExtraction = async (id) => {
  validId(id, "Extraction ID");
  const extraction = await OGAgentLeadExtraction.findById(id);
  if (!extraction) throw error(404, "Email extraction was not found", "EXTRACTION_NOT_FOUND");
  return extraction;
};
const loadCandidate = async (id) => {
  validId(id, "Candidate ID");
  const candidate = await OGAgentLeadCandidate.findById(id);
  if (!candidate) throw error(404, "Lead candidate was not found", "CANDIDATE_NOT_FOUND");
  return candidate;
};

export const listEmailSources = async (_req, res) => {
  await requireEmailSettings();
  const sources = await listAvailableEmailSources();
  res.json({ success: true, data: sources, message: sources.length ? "Authorized synchronized sources loaded." : "No synchronized business mailbox configured" });
};

export const searchEmailMetadata = async (req, res) => {
  const settings = await requireEmailSettings();
  const input = sanitizeExtractionInput(req.body, settings);
  await getEmailSourceAdapter(input.sourceId);
  const messages = await searchSynchronizedMessages({ sourceId: input.sourceId, filters: input.filters, maximumMessages: input.filters.maximumMessages });
  await createOGAgentAuditLog({ actorId: req.admin._id, actorType: "ADMIN", eventType: "EMAIL_METADATA_SEARCHED", action: "Searched synchronized email metadata", details: `${messages.length} metadata records returned from an authorized read-only source.`, metadata: { sourceId: input.sourceId, count: messages.length }, requestContext: getRequestAuditContext(req) });
  res.json({ success: true, data: messages, count: messages.length });
};

export const createEmailExtraction = async (req, res) => {
  const settings = await requireEmailSettings({ extraction: true });
  const input = sanitizeExtractionInput(req.body, settings);
  await getEmailSourceAdapter(input.sourceId);
  const task = await OGAgentTask.create({
    title: cleanText(req.body.title || `Email lead extraction - ${input.filters.targetTypes.join(", ")}`, 160),
    taskType: "EMAIL_ANALYSIS",
    prompt: `Analyze up to ${input.filters.maximumMessages} synchronized messages from ${input.sourceId} for ${input.filters.targetTypes.join(", ")} contacts. Read-only extraction only.`,
    requestedBy: req.admin._id,
    status: "DRAFT",
    riskLevel: "LOW",
  });
  const extraction = await OGAgentLeadExtraction.create({
    taskId: task._id,
    mailboxSource: input.sourceId,
    searchQuery: input.filters.searchTerms.join(" "),
    filters: input.filters,
    requestedBy: req.admin._id,
  });
  await createOGAgentAuditLog({ taskId: task._id, actorId: req.admin._id, actorType: "ADMIN", eventType: "EMAIL_EXTRACTION_CREATED", action: "Created email lead extraction", details: "The extraction is a temporary read-only review workflow.", metadata: { extractionId: extraction._id, sourceId: input.sourceId, maximumMessages: input.filters.maximumMessages }, requestContext: getRequestAuditContext(req) });
  await extraction.populate(extractionPopulate);
  res.status(201).json({ success: true, data: extraction });
};

export const listEmailExtractions = async (req, res) => {
  const { page, limit } = parsePagination(req.query);
  const filter = {};
  if (req.query.status) filter.status = String(req.query.status).toUpperCase();
  const [records, total] = await Promise.all([
    OGAgentLeadExtraction.find(filter).populate(extractionPopulate).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    OGAgentLeadExtraction.countDocuments(filter),
  ]);
  res.json({ success: true, data: records, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
};

export const getEmailExtraction = async (req, res) => {
  const id = validId(req.params.extractionId, "Extraction ID");
  const extraction = await OGAgentLeadExtraction.findById(id).populate(extractionPopulate).lean();
  if (!extraction) throw error(404, "Email extraction was not found", "EXTRACTION_NOT_FOUND");
  res.json({ success: true, data: extraction });
};

export const runEmailExtraction = async (req, res) => {
  const settings = await requireEmailSettings({ extraction: true });
  const extraction = await loadExtraction(req.params.extractionId);
  if (extraction.status !== "DRAFT") throw error(409, `Extraction cannot run from ${extraction.status}`, "INVALID_EXTRACTION_TRANSITION");
  const task = await OGAgentTask.findById(extraction.taskId);
  if (!task || task.status !== "DRAFT") throw error(409, "Parent OG Agent task is not available for extraction", "INVALID_TASK_TRANSITION");
  extraction.status = "SEARCHING";
  extraction.startedAt = new Date();
  task.status = "PLANNING";
  task.plan = [
    { stepNumber: 1, title: "Search synchronized metadata", description: "Search only the authorized synchronized mailbox records.", tool: "email_search", riskLevel: "LOW", approvalRequired: false, status: "RUNNING" },
    { stepNumber: 2, title: "Extract temporary candidates", description: "Sanitize message text and create review-stage candidates only.", tool: "email_lead_extraction", riskLevel: "LOW", approvalRequired: false, status: "PENDING" },
    { stepNumber: 3, title: "Check duplicates", description: "Compare normalized contact fields without changing existing records.", tool: "lead_duplicate_check", riskLevel: "LOW", approvalRequired: false, status: "PENDING" },
  ];
  await Promise.all([extraction.save(), task.save()]);
  try {
    task.status = "QUEUED"; await task.save();
    task.status = "RUNNING"; task.startedAt = new Date(); await task.save();
    const messages = await searchSynchronizedMessages({ sourceId: extraction.mailboxSource, filters: extraction.filters.toObject?.() || extraction.filters, maximumMessages: extraction.filters.maximumMessages });
    extraction.messageCount = messages.length;
    extraction.status = "ANALYZING";
    await extraction.save();
    const batchSize = 25;
    for (let start = 0; start < messages.length; start += batchSize) {
      const current = await OGAgentLeadExtraction.findById(extraction._id).select("status").lean();
      if (current?.status === "CANCELLED") throw error(409, "Extraction was cancelled", "EXTRACTION_CANCELLED");
      const batch = messages.slice(start, start + batchSize);
      for (const metadata of batch) {
        try {
          const message = await getSafeSynchronizedMessage({ sourceId: extraction.mailboxSource, sourceReference: metadata.sourceReference });
          const candidateData = extractLeadCandidateFromMessage({ message, targetTypes: extraction.filters.targetTypes, minimumConfidence: settings.minimumDefaultConfidence });
          await OGAgentLeadCandidate.create({ ...candidateData, extractionId: extraction._id, taskId: task._id });
          extraction.extractedLeadCount += 1;
        } catch {
          extraction.failedMessageCount += 1;
        }
        extraction.analyzedMessageCount += 1;
      }
      await extraction.save();
    }
    const candidates = await OGAgentLeadCandidate.find({ extractionId: extraction._id });
    await checkCandidateDuplicates(candidates, { minimumConfidence: settings.minimumDefaultConfidence });
    const refreshed = await OGAgentLeadCandidate.find({ extractionId: extraction._id }).lean();
    extraction.uniqueLeadCount = refreshed.filter((candidate) => candidate.duplicateStatus === "UNIQUE").length;
    extraction.duplicateLeadCount = refreshed.filter((candidate) => candidate.duplicateStatus !== "UNIQUE").length;
    extraction.status = "REVIEW_READY";
    extraction.completedAt = new Date();
    task.status = "COMPLETED";
    task.completedAt = new Date();
    task.plan = task.plan.map((step) => ({ ...(step.toObject?.() || step), status: "COMPLETED" }));
    task.result = { summary: `${refreshed.length} temporary lead candidates are ready for human review.`, data: { extractionId: extraction._id, messagesAnalyzed: extraction.analyzedMessageCount, candidates: refreshed.length, permanentLeadsCreated: 0 }, recommendations: ["Review confidence, evidence, and duplicate matches before selecting candidates."] };
    await Promise.all([extraction.save(), task.save()]);
    await createOGAgentAuditLog({ taskId: task._id, actorId: req.admin._id, actorType: "OG_AGENT", eventType: "EMAIL_EXTRACTION_REVIEW_READY", action: "Completed read-only email lead extraction", details: `${refreshed.length} temporary candidates created; no Business Leads were imported.`, metadata: { extractionId: extraction._id, analyzed: extraction.analyzedMessageCount, candidates: refreshed.length, permanentImports: 0 }, requestContext: getRequestAuditContext(req) });
    res.json({ success: true, data: extraction, candidateCount: refreshed.length });
  } catch (caught) {
    if (caught.code !== "EXTRACTION_CANCELLED") {
      extraction.status = "FAILED";
      extraction.failureReason = caught.statusCode ? caught.message : "Email extraction failed safely";
      task.status = "FAILED";
      task.failureReason = extraction.failureReason;
      task.completedAt = new Date();
      await Promise.all([extraction.save(), task.save()]);
      await createOGAgentAuditLog({ taskId: task._id, actorId: req.admin._id, actorType: "SYSTEM", eventType: "EMAIL_EXTRACTION_FAILED", action: "Email extraction failed safely", details: extraction.failureReason, metadata: { extractionId: extraction._id }, requestContext: getRequestAuditContext(req) });
    }
    throw caught;
  }
};

export const cancelEmailExtraction = async (req, res) => {
  const extraction = await loadExtraction(req.params.extractionId);
  if (!["DRAFT", "SEARCHING", "ANALYZING", "REVIEW_READY"].includes(extraction.status)) throw error(409, `Extraction cannot be cancelled from ${extraction.status}`, "INVALID_EXTRACTION_TRANSITION");
  extraction.status = "CANCELLED";
  extraction.completedAt = new Date();
  await extraction.save();
  const task = await OGAgentTask.findById(extraction.taskId);
  if (task && !["COMPLETED", "FAILED", "CANCELLED"].includes(task.status)) { task.status = "CANCELLED"; task.cancelledAt = new Date(); await task.save(); }
  await createOGAgentAuditLog({ taskId: extraction.taskId, actorId: req.admin._id, actorType: "ADMIN", eventType: "EMAIL_EXTRACTION_CANCELLED", action: "Cancelled email extraction", metadata: { extractionId: extraction._id }, requestContext: getRequestAuditContext(req) });
  res.json({ success: true, data: extraction });
};

const maskEmail = (email = "") => email ? email.replace(/^(.)([^@]*)(@.*)$/, (_all, first, middle, domain) => `${first}${"*".repeat(Math.min(middle.length, 5))}${domain}`) : "";
const maskPhone = (phone = "") => { const value = String(phone); return value.length > 4 ? `${"*".repeat(Math.min(value.length - 4, 8))}${value.slice(-4)}` : value; };
const candidateListView = (candidate) => ({ ...candidate, extractedData: { ...candidate.extractedData, email: maskEmail(candidate.extractedData?.email), alternateEmails: [], phone: maskPhone(candidate.extractedData?.phone), alternatePhones: [] }, source: { ...candidate.source, evidenceSnippet: "" } });

export const listLeadCandidates = async (req, res) => {
  const extractionId = validId(req.params.extractionId, "Extraction ID");
  const { page, limit } = parsePagination(req.query);
  const filter = { extractionId };
  if (req.query.leadType) filter.suggestedLeadType = String(req.query.leadType).toUpperCase();
  if (req.query.duplicateStatus) filter.duplicateStatus = String(req.query.duplicateStatus).toUpperCase();
  if (req.query.selected === "true") filter.selectedForImport = true;
  if (req.query.selected === "false") filter.selectedForImport = false;
  if (req.query.minimumConfidence) filter.overallConfidence = { $gte: Math.max(0, Math.min(100, Number(req.query.minimumConfidence))) };
  const [candidates, total] = await Promise.all([
    OGAgentLeadCandidate.find(filter).sort({ overallConfidence: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    OGAgentLeadCandidate.countDocuments(filter),
  ]);
  res.json({ success: true, data: candidates.map(candidateListView), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
};

export const getLeadCandidate = async (req, res) => {
  const candidate = await loadCandidate(req.params.candidateId);
  await createOGAgentAuditLog({ taskId: candidate.taskId, actorId: req.admin._id, actorType: "ADMIN", eventType: "SOURCE_EVIDENCE_VIEWED", action: "Viewed lead candidate source evidence", metadata: { candidateId: candidate._id, extractionId: candidate.extractionId, sourceReference: candidate.source.sourceReference }, requestContext: getRequestAuditContext(req) });
  res.json({ success: true, data: candidate });
};

const editableCandidateFields = ["name", "businessName", "contactPerson", "email", "alternateEmails", "phone", "alternatePhones", "countryCode", "address", "village", "tehsil", "district", "state", "postalCode", "country", "fruits", "businessCategories", "estimatedVolume", "volumeUnit", "preferredMarkets", "followUpRequest", "preferredCallbackTime"];
export const updateLeadCandidate = async (req, res) => {
  const settings = await getOGAgentSettings();
  if (!settings.allowCandidateEditing) throw error(403, "Candidate editing is disabled", "CANDIDATE_EDITING_DISABLED");
  const candidate = await loadCandidate(req.params.candidateId);
  const extraction = await loadExtraction(candidate.extractionId);
  if (["WAITING_APPROVAL", "IMPORTING", "COMPLETED", "CANCELLED"].includes(extraction.status)) throw error(409, "Candidates cannot change after import approval is requested", "CANDIDATE_LOCKED");
  if (req.body.extractedData) {
    const unsupported = Object.keys(req.body.extractedData).filter((field) => !editableCandidateFields.includes(field));
    if (unsupported.length) throw error(400, `Unsupported candidate fields: ${unsupported.join(", ")}`, "VALIDATION_ERROR");
    editableCandidateFields.forEach((field) => { if (field in req.body.extractedData) candidate.extractedData[field] = req.body.extractedData[field]; });
    const email = normalizeExtractedEmail(candidate.extractedData.email);
    const phone = normalizeExtractedPhone(candidate.extractedData.phone, { countryHint: candidate.extractedData.country === "India" ? "IN" : "" }).normalized;
    candidate.validationErrors = [];
    if (!email && !phone) candidate.validationErrors.push("At least one valid email address or phone number is required.");
    if (!candidate.extractedData.name && !candidate.extractedData.businessName) candidate.validationErrors.push("A contact name or business name is required.");
    candidate.normalizedData = buildNormalizedCandidateData(candidate.extractedData.toObject?.() || candidate.extractedData);
  }
  if (req.body.suggestedLeadType !== undefined) {
    const type = String(req.body.suggestedLeadType).toUpperCase();
    if (!OG_AGENT_CANDIDATE_TYPES.includes(type)) throw error(400, "Suggested lead type is invalid", "VALIDATION_ERROR");
    candidate.suggestedLeadType = type;
  }
  if (req.body.selectedForImport !== undefined) {
    const selected = req.body.selectedForImport === true;
    if (selected && (candidate.duplicateStatus === "CONFIRMED_DUPLICATE" || candidate.suggestedLeadType === "UNCERTAIN" || candidate.overallConfidence < settings.minimumDefaultConfidence || candidate.validationErrors.length)) throw error(409, "This candidate requires manual correction or duplicate review before selection", "CANDIDATE_REVIEW_REQUIRED");
    candidate.selectedForImport = selected;
    candidate.importStatus = selected ? "SELECTED" : "NOT_SELECTED";
  }
  candidate.editedByAdmin = req.admin._id;
  candidate.reviewedBy = req.admin._id;
  candidate.reviewedAt = new Date();
  await candidate.save();
  await createOGAgentAuditLog({ taskId: candidate.taskId, actorId: req.admin._id, actorType: "ADMIN", eventType: "LEAD_CANDIDATE_UPDATED", action: "Reviewed email lead candidate", metadata: { candidateId: candidate._id, selectedForImport: candidate.selectedForImport }, requestContext: getRequestAuditContext(req) });
  res.json({ success: true, data: candidate });
};

export const bulkSelectLeadCandidates = async (req, res) => {
  const settings = await getOGAgentSettings();
  const extractionId = validId(req.body.extractionId, "Extraction ID");
  const extraction = await loadExtraction(extractionId);
  if (extraction.status !== "REVIEW_READY") throw error(409, "Extraction is not open for lead review", "CANDIDATE_LOCKED");
  const mode = String(req.body.mode || "IDS").toUpperCase();
  if (mode === "CLEAR") {
    await OGAgentLeadCandidate.updateMany({ extractionId, importStatus: { $in: ["SELECTED", "NOT_SELECTED"] } }, { $set: { selectedForImport: false, importStatus: "NOT_SELECTED" } });
  } else if (mode === "VALID_UNIQUE") {
    await OGAgentLeadCandidate.updateMany({ extractionId, duplicateStatus: "UNIQUE", suggestedLeadType: { $ne: "UNCERTAIN" }, overallConfidence: { $gte: settings.minimumDefaultConfidence }, validationErrors: { $size: 0 }, importStatus: { $in: ["SELECTED", "NOT_SELECTED"] } }, { $set: { selectedForImport: true, importStatus: "SELECTED", reviewedBy: req.admin._id, reviewedAt: new Date() } });
  } else {
    const ids = [...new Set((req.body.candidateIds || []).map(String))];
    if (!ids.length || ids.length > 250 || ids.some((id) => !mongoose.isValidObjectId(id))) throw error(400, "A bounded valid candidate selection is required", "VALIDATION_ERROR");
    await OGAgentLeadCandidate.updateMany({ extractionId, _id: { $in: ids }, duplicateStatus: "UNIQUE", suggestedLeadType: { $ne: "UNCERTAIN" }, overallConfidence: { $gte: settings.minimumDefaultConfidence }, validationErrors: { $size: 0 }, importStatus: { $in: ["SELECTED", "NOT_SELECTED"] } }, { $set: { selectedForImport: true, importStatus: "SELECTED", reviewedBy: req.admin._id, reviewedAt: new Date() } });
  }
  const selected = await OGAgentLeadCandidate.countDocuments({ extractionId, selectedForImport: true });
  res.json({ success: true, selected });
};

export const checkExtractionDuplicates = async (req, res) => {
  const extraction = await loadExtraction(req.params.extractionId);
  if (extraction.status !== "REVIEW_READY") throw error(409, "Duplicate checks require a review-ready extraction", "INVALID_EXTRACTION_TRANSITION");
  const settings = await getOGAgentSettings();
  const candidates = await OGAgentLeadCandidate.find({ extractionId: extraction._id });
  const results = await checkCandidateDuplicates(candidates, { minimumConfidence: settings.minimumDefaultConfidence });
  extraction.uniqueLeadCount = results.filter((item) => item.duplicateStatus === "UNIQUE").length;
  extraction.duplicateLeadCount = results.length - extraction.uniqueLeadCount;
  await extraction.save();
  await createOGAgentAuditLog({ taskId: extraction.taskId, actorId: req.admin._id, actorType: "OG_AGENT", eventType: "LEAD_DUPLICATES_CHECKED", action: "Checked lead candidates for duplicates", metadata: { extractionId: extraction._id, candidates: results.length, duplicates: extraction.duplicateLeadCount }, requestContext: getRequestAuditContext(req) });
  res.json({ success: true, data: { checked: results.length, unique: extraction.uniqueLeadCount, duplicates: extraction.duplicateLeadCount } });
};

export const previewLeadImport = async (req, res) => {
  const extraction = await loadExtraction(req.params.extractionId);
  const preview = await buildLeadImportPreview(extraction._id);
  res.json({ success: true, data: { extraction: { _id: extraction._id, taskId: extraction.taskId, sourceMailbox: extraction.mailboxSource }, preview } });
};

export const requestImportApproval = async (req, res) => {
  const extraction = await loadExtraction(req.params.extractionId);
  if (extraction.status !== "REVIEW_READY") throw error(409, "Extraction is not ready for import approval", "INVALID_EXTRACTION_TRANSITION");
  const result = await requestLeadImportApproval({ extraction, requestedBy: req.admin._id });
  await createOGAgentAuditLog({ taskId: extraction.taskId, actorId: req.admin._id, actorType: "ADMIN", eventType: "LEAD_IMPORT_APPROVAL_REQUESTED", action: "Requested Business Lead import approval", details: `${result.preview.selectedCandidates} selected candidates included in the immutable approval snapshot.`, metadata: { extractionId: extraction._id, approvalId: result.approval._id, candidateCount: result.preview.selectedCandidates }, requestContext: getRequestAuditContext(req) });
  res.status(201).json({ success: true, data: result });
};

export const importApprovedCandidates = async (req, res) => {
  const settings = await getOGAgentSettings();
  const extraction = await loadExtraction(req.params.extractionId);
  if (extraction.status !== "WAITING_APPROVAL" || !extraction.approvalId) throw error(409, "Extraction does not have an approved import request", "IMPORT_NOT_APPROVED");
  const approval = await OGAgentApproval.findById(extraction.approvalId);
  if (!approval) throw error(404, "Lead import approval was not found", "APPROVAL_NOT_FOUND");
  const summary = await importApprovedLeadSnapshot({ extraction, approval, adminId: req.admin._id, minimumConfidence: settings.minimumDefaultConfidence });
  await createOGAgentAuditLog({ taskId: extraction.taskId, actorId: req.admin._id, actorType: "ADMIN", eventType: "LEAD_IMPORT_COMPLETED", action: "Imported approved Business Lead snapshot", details: `${summary.imported} imported, ${summary.skipped} skipped, ${summary.failed} failed.`, metadata: { extractionId: extraction._id, approvalId: approval._id, imported: summary.imported, skipped: summary.skipped, failed: summary.failed }, requestContext: getRequestAuditContext(req) });
  res.json({ success: true, data: summary });
};

const businessLeadListView = (lead) => ({ ...lead, email: maskEmail(lead.email), alternateEmails: [], phone: maskPhone(lead.phone), alternatePhones: [], sourceEvidence: "" });
export const listBusinessLeads = async (req, res) => {
  const { page, limit } = parsePagination(req.query);
  const filter = {};
  if (req.query.status) filter.status = String(req.query.status).toUpperCase();
  if (req.query.leadType) filter.leadType = String(req.query.leadType).toUpperCase();
  if (req.query.state) filter.state = cleanText(req.query.state, 160);
  const [leads, total] = await Promise.all([
    BusinessLead.find(filter).populate("importedBy", "name email role").sort({ importedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    BusinessLead.countDocuments(filter),
  ]);
  res.json({ success: true, data: leads.map(businessLeadListView), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
};

export const getBusinessLead = async (req, res) => {
  const id = validId(req.params.leadId, "Business Lead ID");
  const lead = await BusinessLead.findById(id).populate("importedBy assignedTo", "name email role adminClass").lean();
  if (!lead) throw error(404, "Business Lead was not found", "BUSINESS_LEAD_NOT_FOUND");
  res.json({ success: true, data: lead });
};

export const updateBusinessLeadStatus = async (req, res) => {
  const settings = await getOGAgentSettings();
  if (!settings.allowBusinessLeadStatusUpdates) throw error(403, "Business Lead status updates are disabled", "LEAD_STATUS_UPDATES_DISABLED");
  const id = validId(req.params.leadId, "Business Lead ID");
  const status = String(req.body.status || "").toUpperCase();
  if (!BUSINESS_LEAD_STATUSES.includes(status)) throw error(400, "Business Lead status is invalid", "VALIDATION_ERROR");
  const update = { status };
  if (req.body.note !== undefined) {
    const note = cleanText(req.body.note, 2000);
    if (!note) throw error(400, "Internal note cannot be empty", "VALIDATION_ERROR");
    const existing = await BusinessLead.findById(id).select("notes").lean();
    if (!existing) throw error(404, "Business Lead was not found", "BUSINESS_LEAD_NOT_FOUND");
    update.notes = [existing.notes, `[${new Date().toISOString()}] ${note}`].filter(Boolean).join("\n").slice(-5000);
  }
  if (status === "INVALID" && req.body.consentStatus === "OPTED_OUT") update.consentStatus = "OPTED_OUT";
  const lead = await BusinessLead.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true });
  if (!lead) throw error(404, "Business Lead was not found", "BUSINESS_LEAD_NOT_FOUND");
  await createOGAgentAuditLog({ actorId: req.admin._id, actorType: "ADMIN", eventType: "BUSINESS_LEAD_STATUS_UPDATED", action: "Updated Business Lead internal status", metadata: { leadId: lead._id, status }, requestContext: getRequestAuditContext(req) });
  res.json({ success: true, data: lead });
};
