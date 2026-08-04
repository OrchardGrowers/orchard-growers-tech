import mongoose from "mongoose";
import { afterEach, describe, expect, it, vi } from "vitest";
import BusinessLead from "../../../models/BusinessLead.js";
import OGCallActivity from "../../../models/OGCallActivity.js";
import OGCallingCampaign from "../../../models/OGCallingCampaign.js";
import OGCallQueueItem from "../../../models/OGCallQueueItem.js";
import OGFollowUp from "../../../models/OGFollowUp.js";
import { hasOGAgentPermission } from "../../../middleware/ogAgentPermissions.js";
import { enforcePhase1Settings } from "../ogAgentSettingsService.js";
import { detectProhibitedAction, getOGAgentTool } from "../ogAgentToolRegistry.js";
import { hasCallablePhone, previewCampaign, sanitizeCampaignInput } from "./callingCampaignService.js";
import { claimQueueItem, startManualCall } from "./callingQueueService.js";
import { validateOutcomeInput } from "./callActivityService.js";
import { generateSafeCallScript } from "./callScriptService.js";
import { completeFollowUp, createFollowUp } from "./followUpService.js";

afterEach(() => vi.restoreAllMocks());
const id = () => new mongoose.Types.ObjectId();
const settings = { maximumLeadsPerCampaign: 250, minimumCallNoteLength: 10 };
const input = (overrides = {}) => sanitizeCampaignInput({ name: "Apple grower qualification", purpose: "LEAD_QUALIFICATION", leadTypes: ["GROWER"], filters: { minimumConfidence: 70, maximumConfidence: 100 }, targetLeadCount: 25, assignedTelecallers: [], ...overrides }, settings);
const chain = (result) => ({ select: vi.fn().mockReturnThis(), sort: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue(result) });

describe("OG Agent Phase 3 human telecalling", () => {
  it("maps existing roles without inventing a new role enum", () => {
    expect(hasOGAgentPermission({ role: "SUPPORT_EXECUTIVE" }, "telecalling.record_outcome")).toBe(true);
    expect(hasOGAgentPermission({ role: "SALES_EXECUTIVE" }, "telecalling.view_own_queue")).toBe(true);
    expect(hasOGAgentPermission({ role: "VIEWER" }, "telecalling.view_own_queue")).toBe(false);
    expect(hasOGAgentPermission({ role: "ADMIN" }, "telecalling.manage_campaign")).toBe(true);
  });

  it("creates campaign records as drafts with safe counters", async () => {
    const campaign = new OGCallingCampaign({ ...input(), createdBy: id() });
    await expect(campaign.validate()).resolves.toBeUndefined();
    expect(campaign.status).toBe("DRAFT");
    expect(campaign.addedLeadCount).toBe(0);
  });

  it("creates queue records without claiming or completing a call", async () => {
    const item = new OGCallQueueItem({ campaignId: id(), leadId: id(), sequenceNumber: 1 });
    await expect(item.validate()).resolves.toBeUndefined();
    expect(item.status).toBe("PENDING"); expect(item.lockedBy).toBeNull(); expect(item.attemptCount).toBe(0);
  });

  it("uses campaign-scoped active queue uniqueness", () => {
    const unique = OGCallQueueItem.schema.indexes().find(([, options]) => options.name === "one_active_campaign_queue_item_per_lead");
    expect(unique?.[0]).toEqual({ campaignId: 1, leadId: 1 });
    expect(unique?.[1]).toMatchObject({ unique: true, partialFilterExpression: { status: { $in: expect.any(Array) } } });
  });

  it("stores manually entered duration and never automatic call timestamps", async () => {
    const activity = new OGCallActivity({ leadId: id(), telecallerId: id(), activityType: "CALL_OUTCOME_RECORDED", outcome: "NO_ANSWER", manuallyEnteredDurationSeconds: 12, createdBy: id() });
    await expect(activity.validate()).resolves.toBeUndefined();
    expect(activity.manuallyEnteredDurationSeconds).toBe(12);
    expect(OGCallActivity.schema.path("callConnectedAt")).toBeUndefined();
  });

  it("extends BusinessLead with do-not-contact defaults without changing identity", async () => {
    const lead = new BusinessLead({ leadType: "GROWER", extractionTaskId: id(), sourceCandidateId: id(), importedBy: id(), name: "Grower" });
    await expect(lead.validate()).resolves.toBeUndefined();
    expect(lead.doNotContact).toBe(false); expect(lead.contactAttemptCount).toBe(0); expect(lead.leadType).toBe("GROWER");
  });

  it("forces calling, recording, SMS, WhatsApp, and email automation off", () => {
    expect(enforcePhase1Settings({ allowAICalling: true, allowCallRecording: true, allowSMS: true, allowWhatsAppSending: true, allowAutomaticEmailSending: true, allowAutomaticAccountCreation: true })).toMatchObject({ allowAICalling: false, allowCallRecording: false, allowSMS: false, allowWhatsAppSending: false, allowAutomaticEmailSending: false, allowAutomaticAccountCreation: false });
  });

  it("bounds campaign, lock, retry, and note settings", () => {
    expect(enforcePhase1Settings({ maximumLeadsPerCampaign: 1000, queueLockMinutes: 60, defaultRetryDays: 90, minimumCallNoteLength: 0 })).toMatchObject({ maximumLeadsPerCampaign: 1000, queueLockMinutes: 60, defaultRetryDays: 90, minimumCallNoteLength: 0 });
    expect(() => enforcePhase1Settings({ maximumLeadsPerCampaign: 1001 })).toThrow(/between 1 and 1000/i);
  });

  it("registers preparation tools and blocks external call/messaging tools", () => {
    expect(getOGAgentTool("telecalling_script_generation")).toMatchObject({ riskLevel: "LOW", enabled: true });
    expect(getOGAgentTool("telecalling_campaign_create")).toMatchObject({ riskLevel: "MEDIUM", enabled: true });
    ["telecalling_call_initiate", "telecalling_recording", "telecalling_sms_send", "telecalling_whatsapp_send", "telecalling_email_send"].forEach((name) => expect(getOGAgentTool(name)).toMatchObject({ riskLevel: "HIGH", enabled: false }));
    expect(detectProhibitedAction("record the call")).toBe("telecalling_recording");
    expect(detectProhibitedAction("send an SMS")).toBe("telecalling_sms_send");
  });

  it("generates a safe deterministic human script without external action", () => {
    const script = generateSafeCallScript({ purpose: "GROWER_ONBOARDING", leadType: "GROWER", language: "HINDI", lead: { name: "Asha" } });
    expect(script.introduction).toContain("Orchard Growers Private Limited");
    expect(script.identityDisclosure).toMatch(/human staff member/i);
    expect(script.complianceWarning).toMatch(/do not promise guaranteed/i);
    expect(script.prohibitedCommitments.join(" ")).toMatch(/OTP|payment/i);
    expect(script.externalActionPerformed).toBe(false);
  });

  it("validates callable phones and rejects repeated/missing values", () => {
    expect(hasCallablePhone({ phone: "+91 98765 43210" })).toBe(true);
    expect(hasCallablePhone({ phone: "1111111111" })).toBe(false);
    expect(hasCallablePhone({ phone: "" })).toBe(false);
  });

  it("validates campaign limits and confidence", () => {
    expect(() => input({ targetLeadCount: 251 })).toThrow(/between 1 and 250/i);
    expect(() => input({ filters: { minimumConfidence: 90, maximumConfidence: 70 } })).toThrow(/confidence range/i);
  });

  it("excludes do-not-contact, opted-out, invalid, and invalid-phone leads from previews", async () => {
    const leads = [{ _id: id(), phone: "+91 98765 43210", overallConfidence: 90 }, { _id: id(), phone: "1111111111", overallConfidence: 90 }];
    vi.spyOn(BusinessLead, "find").mockReturnValue(chain(leads));
    vi.spyOn(BusinessLead, "countDocuments").mockResolvedValueOnce(1).mockResolvedValueOnce(2).mockResolvedValueOnce(3);
    const preview = await previewCampaign(input());
    expect(preview.finalProposedQueueSize).toBe(1);
    expect(preview.excludedMissingOrInvalidPhone).toBe(2);
    expect(preview.excludedDoNotContact).toBe(2);
    expect(preview.excludedInvalid).toBe(3);
  });

  it("claims a queue item atomically with an expiring lock", async () => {
    const item = { _id: id(), lockedBy: id(), lockExpiresAt: new Date(Date.now() + 60000) };
    const spy = vi.spyOn(OGCallQueueItem, "findOneAndUpdate").mockResolvedValue(item);
    const adminId = id(); await expect(claimQueueItem({ queueItemId: item._id, adminId, lockMinutes: 5 })).resolves.toBe(item);
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ $or: expect.arrayContaining([expect.objectContaining({ lockExpiresAt: expect.any(Object) })]) }), expect.objectContaining({ $set: expect.objectContaining({ lockedBy: adminId, status: "IN_PROGRESS" }) }), { new: true });
  });

  it("rejects a second claimant when the atomic claim fails", async () => {
    vi.spyOn(OGCallQueueItem, "findOneAndUpdate").mockResolvedValue(null);
    await expect(claimQueueItem({ queueItemId: id(), adminId: id() })).rejects.toMatchObject({ code: "QUEUE_ALREADY_CLAIMED" });
  });

  it("manual start records preparation activity without marking connected", async () => {
    const adminId = id(); const item = { _id: id(), campaignId: id(), leadId: id(), lockedBy: adminId, lockExpiresAt: new Date(Date.now() + 60000) };
    vi.spyOn(OGCallingCampaign, "findById").mockReturnValue({ select: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue({ status: "ACTIVE" }) });
    const create = vi.spyOn(OGCallActivity, "create").mockImplementation(async (value) => value);
    const activity = await startManualCall({ item, adminId });
    expect(activity.activityType).toBe("CALL_STARTED_MANUALLY"); expect(activity.outcome).toBeUndefined(); expect(activity.summary).toMatch(/no call connection/i); expect(create).toHaveBeenCalledTimes(1);
  });

  it("validates outcomes and requires idempotency keys", () => {
    expect(() => validateOutcomeInput({ outcome: "NO_ANSWER" }, settings)).toThrow(/idempotency key/i);
    expect(validateOutcomeInput({ outcome: "NO_ANSWER", idempotencyKey: "once" }, settings)).toMatchObject({ outcome: "NO_ANSWER" });
  });

  it("requires a future follow-up for call-later", () => {
    expect(() => validateOutcomeInput({ outcome: "CONNECTED_CALL_LATER", notes: "Call again later please", idempotencyKey: "one" }, settings)).toThrow(/future follow-up/i);
    expect(validateOutcomeInput({ outcome: "CONNECTED_CALL_LATER", notes: "Call again later please", followUpAt: new Date(Date.now() + 86400000), idempotencyKey: "two" }, settings).followUpAt).toBeInstanceOf(Date);
  });

  it("requires clear reasons for do-not-contact and wrong-number outcomes", () => {
    expect(() => validateOutcomeInput({ outcome: "DO_NOT_CONTACT", notes: "no", idempotencyKey: "one" }, settings)).toThrow(/requires at least/i);
    expect(() => validateOutcomeInput({ outcome: "WRONG_NUMBER", notes: "bad", idempotencyKey: "two" }, settings)).toThrow(/requires at least/i);
  });

  it("creates follow-ups only for future dates and prevents active duplicates", async () => {
    vi.spyOn(OGFollowUp, "findOne").mockResolvedValue(null); vi.spyOn(OGFollowUp, "create").mockImplementation(async (value) => value);
    await expect(createFollowUp({ leadId: id(), queueItemId: id(), assignedTo: id(), dueAt: new Date(Date.now() + 86400000), createdBy: id() })).resolves.toMatchObject({ followUpType: "CALL", priority: "NORMAL" });
    await expect(createFollowUp({ leadId: id(), assignedTo: id(), dueAt: new Date(Date.now() - 1000), createdBy: id() })).rejects.toMatchObject({ code: "INVALID_FOLLOW_UP_DATE" });
  });

  it("completes a follow-up once using a conditional update", async () => {
    const follow = { _id: id(), leadId: id(), assignedTo: id(), completionNote: "Done" };
    vi.spyOn(OGFollowUp, "findOneAndUpdate").mockResolvedValueOnce(follow).mockResolvedValueOnce(null); vi.spyOn(OGCallActivity, "create").mockResolvedValue({ _id: id() });
    await expect(completeFollowUp({ followUpId: follow._id, adminId: id(), completionNote: "Called and completed" })).resolves.toBe(follow);
    await expect(completeFollowUp({ followUpId: follow._id, adminId: id(), completionNote: "Again" })).rejects.toMatchObject({ code: "FOLLOW_UP_ALREADY_COMPLETED" });
  });
});
