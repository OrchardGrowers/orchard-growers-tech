import BusinessLead, { BUSINESS_LEAD_STATUSES } from "../../../models/BusinessLead.js";
import OGCallActivity, { CALL_OUTCOMES } from "../../../models/OGCallActivity.js";
import OGCallQueueItem from "../../../models/OGCallQueueItem.js";
import OGFollowUp from "../../../models/OGFollowUp.js";
import { createFollowUp } from "./followUpService.js";
import { refreshCampaignCounters } from "./callingCampaignService.js";

const followUpRequired = new Set(["CONNECTED_CALL_LATER"]);
const noteRequired = new Set(["CONNECTED_INTERESTED", "CONNECTED_NEEDS_INFORMATION", "CONNECTED_CALL_LATER", "CONNECTED_NOT_INTERESTED", "WRONG_NUMBER", "DO_NOT_CONTACT", "OTHER"]);
const statusMap = { CONNECTED_INTERESTED: "INTERESTED", CONNECTED_CALL_LATER: "FOLLOW_UP", CONNECTED_NOT_INTERESTED: "NOT_INTERESTED" };
const correctable = new Set(["name", "businessName", "phone", "email", "state", "district", "fruits", "leadType", "estimatedVolume", "volumeUnit"]);

export const validateOutcomeInput = (body, settings) => {
  const outcome = String(body.outcome || "").toUpperCase();
  if (!CALL_OUTCOMES.includes(outcome)) throw Object.assign(new Error("Call outcome is invalid"), { statusCode: 400, code: "VALIDATION_ERROR" });
  const notes = String(body.notes || "").trim();
  if (noteRequired.has(outcome) && notes.length < Number(settings.minimumCallNoteLength || 10)) throw Object.assign(new Error(`This outcome requires at least ${settings.minimumCallNoteLength || 10} characters of notes`), { statusCode: 400, code: "CALL_NOTE_REQUIRED" });
  const followUpAt = body.followUpAt ? new Date(body.followUpAt) : null;
  if (followUpRequired.has(outcome) && (!followUpAt || Number.isNaN(followUpAt.getTime()) || followUpAt <= new Date())) throw Object.assign(new Error("Call-later outcome requires a future follow-up date"), { statusCode: 400, code: "FOLLOW_UP_REQUIRED" });
  const duration = Number(body.manuallyEnteredDurationSeconds || 0);
  if (!Number.isInteger(duration) || duration < 0 || duration > 43200) throw Object.assign(new Error("Manually entered duration is invalid"), { statusCode: 400, code: "VALIDATION_ERROR" });
  const idempotencyKey = String(body.idempotencyKey || "").trim().slice(0, 200);
  if (!idempotencyKey) throw Object.assign(new Error("Idempotency key is required"), { statusCode: 400, code: "IDEMPOTENCY_KEY_REQUIRED" });
  return { outcome, notes, followUpAt, duration, idempotencyKey };
};

export const recordCallOutcome = async ({ item, body, admin, settings, canEditVerifiedFields = false }) => {
  const input = validateOutcomeInput(body, settings);
  const existing = await OGCallActivity.findOne({ queueItemId: item._id, idempotencyKey: input.idempotencyKey });
  if (existing && item.status !== "IN_PROGRESS") return { activity: existing, queueItem: item, idempotent: true };
  if (String(item.lockedBy || "") !== String(admin._id) || !item.lockExpiresAt || item.lockExpiresAt <= new Date()) throw Object.assign(new Error("A valid queue lock is required to submit an outcome"), { statusCode: 409, code: "QUEUE_LOCK_REQUIRED" });
  const lead = await BusinessLead.findById(item.leadId);
  if (!lead) throw Object.assign(new Error("Business Lead is unavailable"), { statusCode: 404, code: "BUSINESS_LEAD_NOT_FOUND" });
  if ((lead.doNotContact || lead.consentStatus === "OPTED_OUT") && input.outcome !== "DO_NOT_CONTACT") throw Object.assign(new Error("This lead is do-not-contact and cannot receive another call outcome"), { statusCode: 409, code: "DO_NOT_CONTACT" });
  const requestedStatus = String(body.requestedLeadStatus || statusMap[input.outcome] || "").toUpperCase();
  let leadStatusChange = {};
  if (body.updateLeadStatus === true) {
    if (!settings.allowLeadStatusUpdateFromCall) throw Object.assign(new Error("Lead status updates from calls are disabled"), { statusCode: 403, code: "SETTING_DISABLED" });
    const safeExpected = statusMap[input.outcome];
    if (!safeExpected || requestedStatus !== safeExpected || !BUSINESS_LEAD_STATUSES.includes(requestedStatus)) throw Object.assign(new Error("Requested lead status is not allowed for this outcome"), { statusCode: 400, code: "INVALID_LEAD_STATUS_MAPPING" });
    leadStatusChange = { previous: lead.status, next: requestedStatus, reason: input.outcome }; lead.status = requestedStatus;
  }
  const correctedFields = {};
  if (body.updateVerifiedLeadFields === true) {
    if (!settings.allowBusinessLeadFieldVerification || !canEditVerifiedFields) throw Object.assign(new Error("Verified lead field updates require manager permission"), { statusCode: 403, code: "PERMISSION_DENIED" });
    Object.entries(body.correctedFields || {}).forEach(([key, value]) => { if (!correctable.has(key)) throw Object.assign(new Error(`Unsupported verified field: ${key}`), { statusCode: 400, code: "VALIDATION_ERROR" }); correctedFields[key] = { previous: lead[key], next: value }; lead[key] = value; });
  }
  const activity = existing || await OGCallActivity.create({ campaignId: item.campaignId, queueItemId: item._id, leadId: lead._id, telecallerId: admin._id, activityType: input.outcome === "DO_NOT_CONTACT" ? "DO_NOT_CONTACT_RECORDED" : input.outcome === "WRONG_NUMBER" ? "WRONG_NUMBER_REPORTED" : "CALL_OUTCOME_RECORDED", outcome: input.outcome, idempotencyKey: input.idempotencyKey, manuallyEnteredDurationSeconds: input.duration, notes: input.notes, summary: String(body.summary || input.notes).slice(0, 1500), interestLevel: body.interestLevel || "UNKNOWN", verifiedFields: body.verifiedFields || {}, correctedFields, leadStatusChange, nextAction: body.nextAction || "NONE", followUpAt: input.followUpAt, preferredCallbackWindow: String(body.preferredCallbackWindow || "").slice(0, 200), preferredLanguage: body.preferredLanguage || lead.preferredLanguage || "AUTO_SUGGEST", createdBy: admin._id });
  item.attemptCount += 1; item.lastAttemptAt = new Date(); item.lockedBy = null; item.lockedAt = null; item.lockExpiresAt = null;
  lead.lastContactedAt = item.lastAttemptAt; lead.lastCallOutcome = input.outcome; lead.contactAttemptCount += 1; lead.lastCallActivityId = activity._id;
  if (body.preferredLanguage) lead.preferredLanguage = body.preferredLanguage;
  if (body.preferredCallbackWindow) lead.preferredCallbackWindow = String(body.preferredCallbackWindow).slice(0, 200);
  if (input.outcome === "DO_NOT_CONTACT") {
    lead.doNotContact = true; lead.doNotContactAt = new Date(); lead.doNotContactReason = input.notes; lead.consentStatus = "OPTED_OUT";
    item.status = "DO_NOT_CONTACT";
    await Promise.all([OGCallQueueItem.updateMany({ leadId: lead._id, _id: { $ne: item._id }, status: { $in: ["PENDING", "IN_PROGRESS", "FOLLOW_UP_REQUIRED"] } }, { $set: { status: "DO_NOT_CONTACT", completionReason: "Do-not-contact request recorded", lockedBy: null, lockedAt: null, lockExpiresAt: null } }), OGFollowUp.updateMany({ leadId: lead._id, status: { $in: ["PENDING", "OVERDUE"] } }, { $set: { status: "CANCELLED" } })]);
  } else if (input.outcome === "WRONG_NUMBER") item.status = "INVALID";
  else if (input.followUpAt) item.status = "FOLLOW_UP_REQUIRED";
  else item.status = "COMPLETED";
  if (input.followUpAt) {
    lead.nextFollowUpAt = input.followUpAt; item.nextFollowUpAt = input.followUpAt;
    const existingFollowUp = await OGFollowUp.findOne({ queueItemId: item._id, status: { $in: ["PENDING", "OVERDUE"] } });
    if (!existingFollowUp) await createFollowUp({ leadId: lead._id, campaignId: item.campaignId, queueItemId: item._id, callActivityId: activity._id, assignedTo: item.assignedTo || admin._id, title: `Call follow-up: ${lead.businessName || lead.name}`, note: input.notes, dueAt: input.followUpAt, priority: item.priority, createdBy: admin._id });
  }
  await Promise.all([item.save(), lead.save()]);
  await refreshCampaignCounters(item.campaignId);
  return { activity, queueItem: item, leadStatusChange, correctedFields, idempotent: Boolean(existing) };
};
