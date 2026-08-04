import mongoose from "mongoose";
import { afterEach, describe, expect, it, vi } from "vitest";
import BusinessLead from "../../../models/BusinessLead.js";
import CareerApplication from "../../../models/CareerApplication.js";
import Lead from "../../../models/Lead.js";
import OGAgentApproval from "../../../models/OGAgentApproval.js";
import OGAgentLeadCandidate from "../../../models/OGAgentLeadCandidate.js";
import User from "../../../models/User.js";
import { enforcePhase1Settings } from "../ogAgentSettingsService.js";
import { detectProhibitedAction, getOGAgentTool, listOGAgentTools } from "../ogAgentToolRegistry.js";
import { classifyEmailLead } from "./emailLeadClassificationService.js";
import { createEvidenceSnippet, sanitizeEmailContent } from "./emailContentSanitizer.js";
import { checkCandidateDuplicates } from "./emailLeadDuplicateService.js";
import { buildCandidateFingerprint, buildLeadImportPreview, importApprovedLeadSnapshot, requestLeadImportApproval } from "./emailLeadImportService.js";
import { normalizeBusinessNameForMatch, normalizeExtractedEmail, normalizeExtractedPhone, normalizeFruits, normalizeState } from "./emailLeadNormalizationService.js";
import EmailSourceAdapter from "./emailSourceAdapter.js";

afterEach(() => vi.restoreAllMocks());

const id = () => new mongoose.Types.ObjectId();
const leanQuery = (value) => ({ select: vi.fn().mockReturnThis(), sort: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue(value) });
const candidateObject = (overrides = {}) => ({
  _id: id(), extractionId: id(), taskId: id(), selectedForImport: true,
  suggestedLeadType: "GROWER", extractedData: { name: "Asha", businessName: "Asha Orchards", email: "asha@example.com", phone: "+91 98765 43210", state: "HP", district: "Shimla", fruits: ["Apple"] },
  normalizedData: { email: "asha@example.com", phone: "919876543210", alternateEmails: [], alternatePhones: [], businessName: "asha orchards", contactName: "asha" },
  fieldConfidence: { leadType: 85 }, overallConfidence: 85, duplicateStatus: "UNIQUE", duplicateMatches: [], validationErrors: [], warnings: [], importStatus: "SELECTED",
  source: { mailbox: "INBOX", sourceReference: String(id()), messageId: "message-1", threadId: "", subject: "Apple orchard", sender: "asha@example.com", recipients: [], evidenceSnippet: "We operate an apple orchard." },
  updatedAt: new Date("2026-08-04T00:00:00.000Z"),
  ...overrides,
});

const mockDuplicateCollections = (businessLeads = [], users = [], leads = [], careers = []) => {
  vi.spyOn(BusinessLead, "find").mockReturnValue(leanQuery(businessLeads));
  vi.spyOn(User, "find").mockReturnValue(leanQuery(users));
  vi.spyOn(Lead, "find").mockReturnValue(leanQuery(leads));
  vi.spyOn(CareerApplication, "find").mockReturnValue(leanQuery(careers));
};

describe("OG Agent Phase 2 email intelligence", () => {
  it("sanitizes active HTML, tracking pixels, and quoted history", () => {
    const safe = sanitizeEmailContent('<script>steal()</script><p>Grower contact</p><img src="track"><p>On Monday wrote:</p><p>old secret</p>');
    expect(safe).toContain("Grower contact");
    expect(safe).not.toMatch(/steal|track|old secret/i);
  });

  it("stores bounded evidence rather than an unbounded body", () => {
    expect(createEvidenceSnippet(`prefix ${"fruit ".repeat(500)}`, ["fruit"], 120)).toHaveLength(120);
  });

  it("normalizes and validates emails without accepting no-reply senders", () => {
    expect(normalizeExtractedEmail(" MAILTO:Grower@Example.COM ")).toBe("grower@example.com");
    expect(normalizeExtractedEmail("no-reply@example.com")).toBe("");
  });

  it("normalizes Indian phones only when the country hint is known", () => {
    expect(normalizeExtractedPhone("98765-43210", { countryHint: "IN" })).toMatchObject({ normalized: "919876543210", countryCode: "91" });
    expect(normalizeExtractedPhone("98765-43210")).toMatchObject({ normalized: "9876543210", countryCode: "" });
    expect(normalizeExtractedPhone("1111111111").normalized).toBe("");
  });

  it("normalizes business, state, and fruit comparison values", () => {
    expect(normalizeBusinessNameForMatch("Asha Fruits Pvt. Ltd.")).toBe("asha fruits");
    expect(normalizeState("HP")).toBe("Himachal Pradesh");
    expect(normalizeFruits(["apples", "apple", "mangoes"])).toEqual(["Apple", "Mango"]);
  });

  it("classifies contextual grower and buyer evidence with explanations", () => {
    const result = classifyEmailLead({ subject: "Weekly fruit requirement", text: "We are an orchard producer and also purchase bulk fruit for distribution." });
    expect(result.leadType).toBe("BOTH");
    expect(result.confidence).toBeGreaterThanOrEqual(70);
    expect(result.explanation).toMatch(/because/i);
  });

  it("keeps uncertain low-confidence contacts reviewable", () => {
    const result = classifyEmailLead({ text: "Please call me tomorrow." });
    expect(result).toMatchObject({ leadType: "UNCERTAIN", confidence: 35 });
    expect(result.explanation).toMatch(/manual verification required/i);
  });

  it("has a read-only adapter contract with no write operations", () => {
    const adapter = new EmailSourceAdapter({ id: "test", label: "Test" });
    expect(["send", "reply", "forward", "delete", "archive", "move", "markRead"].every((method) => typeof adapter[method] === "undefined")).toBe(true);
  });

  it("registers extraction/import tools while email writes remain disabled", () => {
    expect(getOGAgentTool("email_search")).toMatchObject({ riskLevel: "LOW", enabled: true });
    expect(getOGAgentTool("lead_import_commit")).toMatchObject({ riskLevel: "MEDIUM", approvalRequired: true });
    expect(getOGAgentTool("email_send")).toMatchObject({ riskLevel: "HIGH", enabled: false });
    expect(listOGAgentTools().find((tool) => tool.name === "mailbox_modify")?.enabled).toBe(false);
    expect(detectProhibitedAction("Send an email to this contact")).toBe("send_email");
    expect(detectProhibitedAction("Archive the email")).toBe("mailbox_modify");
  });

  it("locks approval, email writes, account creation, and record updates", () => {
    expect(enforcePhase1Settings({ requireApprovalForLeadImport: false, allowEmailSending: true, allowMailboxModification: true, allowAutomaticAccountCreation: true, allowAutomaticExistingRecordUpdate: true })).toMatchObject({
      requireApprovalForLeadImport: true, allowEmailSending: false, allowMailboxModification: false, allowAutomaticAccountCreation: false, allowAutomaticExistingRecordUpdate: false,
    });
    expect(() => enforcePhase1Settings({ maximumMessagesPerExtraction: 251 })).toThrow(/between 1 and 250/i);
  });

  it("applies safe temporary-candidate and permanent-lead model rules", async () => {
    const candidate = new OGAgentLeadCandidate({ ...candidateObject(), selectedForImport: undefined, importStatus: undefined });
    await expect(candidate.validate()).resolves.toBeUndefined();
    expect(candidate.selectedForImport).toBe(false);
    expect(candidate.importStatus).toBe("NOT_SELECTED");
    const lead = new BusinessLead({ leadType: "GROWER", extractionTaskId: id(), sourceCandidateId: id(), importedBy: id(), email: "Grower@Example.com", phone: "+91 98765 43210", businessName: "Asha Pvt Ltd" });
    await expect(lead.validate()).resolves.toBeUndefined();
    expect(lead.normalizedEmail).toBe("grower@example.com");
    expect(lead.normalizedPhone).toBe("919876543210");
    expect(lead.normalizedBusinessName).toBe("asha");
  });

  it("detects exact email and phone duplicates within the current extraction", async () => {
    mockDuplicateCollections();
    const first = candidateObject();
    const second = candidateObject({ _id: id(), source: { ...candidateObject().source, sourceReference: String(id()), messageId: "message-2" } });
    const results = await checkCandidateDuplicates([first, second], { persist: false });
    expect(results[0].duplicateStatus).toBe("UNIQUE");
    expect(results[1].duplicateStatus).toBe("CONFIRMED_DUPLICATE");
    expect(results[1].duplicateMatches.map((match) => match.matchedField)).toEqual(expect.arrayContaining(["email", "phone"]));
    expect(results[1].selectedForImport).toBe(false);
  });

  it("builds import previews from selected records only, including waiting snapshots", async () => {
    const candidates = [candidateObject(), candidateObject({ _id: id(), selectedForImport: false, importStatus: "NOT_SELECTED" }), candidateObject({ _id: id(), importStatus: "WAITING_APPROVAL" })];
    vi.spyOn(OGAgentLeadCandidate, "find").mockReturnValue(leanQuery(candidates));
    const preview = await buildLeadImportPreview(candidates[0].extractionId);
    expect(preview.totalCandidates).toBe(3);
    expect(preview.selectedCandidates).toBe(2);
    expect(preview.selected).toHaveLength(2);
  });

  it("creates an immutable approval snapshot without creating a BusinessLead", async () => {
    const plain = candidateObject();
    const document = { ...plain, toObject: () => plain };
    const extraction = { _id: plain.extractionId, taskId: plain.taskId, mailboxSource: "career-applications", status: "REVIEW_READY", save: vi.fn() };
    vi.spyOn(OGAgentApproval, "findOne").mockResolvedValue(null);
    vi.spyOn(OGAgentLeadCandidate, "find").mockReturnValueOnce(Promise.resolve([document])).mockReturnValueOnce({ lean: vi.fn().mockResolvedValue([{ ...plain, importStatus: "WAITING_APPROVAL" }]) }).mockReturnValueOnce(leanQuery([{ ...plain, importStatus: "WAITING_APPROVAL" }]));
    vi.spyOn(OGAgentLeadCandidate, "updateMany").mockResolvedValue({ modifiedCount: 1 });
    vi.spyOn(OGAgentApproval, "create").mockImplementation(async (payload) => ({ _id: id(), ...payload }));
    const createLead = vi.spyOn(BusinessLead, "create");
    const result = await requestLeadImportApproval({ extraction, requestedBy: id() });
    expect(result.approval.actionPreview.candidateSnapshots).toHaveLength(1);
    expect(result.approval.actionPreview.candidateSnapshots[0].fingerprint).toHaveLength(64);
    expect(createLead).not.toHaveBeenCalled();
  });

  it("changes the fingerprint when an approved candidate snapshot changes", () => {
    const candidate = candidateObject();
    expect(buildCandidateFingerprint(candidate)).not.toBe(buildCandidateFingerprint({ ...candidate, overallConfidence: 84 }));
  });

  it("imports an eligible approved snapshot once and links the candidate", async () => {
    const plain = candidateObject({ importStatus: "WAITING_APPROVAL" });
    const document = { ...plain, importedLeadId: null, save: vi.fn(), toObject: () => ({ ...plain, importedLeadId: null }) };
    const snapshot = { candidateId: String(plain._id), updatedAt: plain.updatedAt.toISOString(), fingerprint: buildCandidateFingerprint(plain) };
    const approval = { _id: id(), actionType: "LEAD_IMPORT", status: "APPROVED", consumedAt: null, createdAt: new Date(), actionPreview: { candidateSnapshots: [snapshot] } };
    const extraction = { _id: plain.extractionId, status: "WAITING_APPROVAL", save: vi.fn() };
    vi.spyOn(OGAgentLeadCandidate, "find").mockResolvedValue([document]);
    vi.spyOn(OGAgentApproval, "findOneAndUpdate").mockResolvedValue({ ...approval, consumedAt: new Date() });
    mockDuplicateCollections();
    vi.spyOn(BusinessLead, "create").mockResolvedValue({ _id: id() });
    const result = await importApprovedLeadSnapshot({ extraction, approval, adminId: id() });
    expect(result).toMatchObject({ approved: 1, imported: 1, skipped: 0, failed: 0 });
    expect(document.importStatus).toBe("IMPORTED");
    expect(document.save).toHaveBeenCalled();
  });

  it("rejects reused or rejected approvals before any import", async () => {
    const extraction = { _id: id() };
    await expect(importApprovedLeadSnapshot({ extraction, approval: { actionType: "LEAD_IMPORT", status: "REJECTED" }, adminId: id() })).rejects.toMatchObject({ code: "IMPORT_NOT_APPROVED" });
    await expect(importApprovedLeadSnapshot({ extraction, approval: { actionType: "LEAD_IMPORT", status: "APPROVED", consumedAt: new Date() }, adminId: id() })).rejects.toMatchObject({ code: "APPROVAL_ALREADY_CONSUMED" });
  });
});
