import mongoose from "mongoose";
import Admin from "../../../models/Admin.js";
import BusinessLead from "../../../models/BusinessLead.js";
import OGCallingCampaign, { CALLING_ASSIGNMENT_STRATEGIES, CALLING_CAMPAIGN_PURPOSES, CALLING_LANGUAGES, CALLING_PRIORITIES } from "../../../models/OGCallingCampaign.js";
import OGCallQueueItem from "../../../models/OGCallQueueItem.js";
import OGCallActivity from "../../../models/OGCallActivity.js";

const invalidStatuses = ["INVALID", "DUPLICATE", "ARCHIVED"];
export const hasCallablePhone = (lead) => {
  const digits = String(lead.phone || "").replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15 && !/^(\d)\1+$/.test(digits);
};
const cleanArray = (value, limit = 50) => [...new Set((Array.isArray(value) ? value : []).map((item) => String(item).trim()).filter(Boolean))].slice(0, limit);
export const sanitizeCampaignInput = (body = {}, settings = {}) => {
  const name = String(body.name || "").trim().slice(0, 180);
  const purpose = String(body.purpose || "").toUpperCase();
  if (name.length < 3) throw Object.assign(new Error("Campaign name must be at least 3 characters"), { statusCode: 400, code: "VALIDATION_ERROR" });
  if (!CALLING_CAMPAIGN_PURPOSES.includes(purpose)) throw Object.assign(new Error("Campaign purpose is invalid"), { statusCode: 400, code: "VALIDATION_ERROR" });
  const minimumConfidence = Number(body.filters?.minimumConfidence ?? 0);
  const maximumConfidence = Number(body.filters?.maximumConfidence ?? 100);
  if (minimumConfidence < 0 || maximumConfidence > 100 || minimumConfidence > maximumConfidence) throw Object.assign(new Error("Confidence range is invalid"), { statusCode: 400, code: "VALIDATION_ERROR" });
  const targetLeadCount = Number(body.targetLeadCount || settings.maximumLeadsPerCampaign || 250);
  if (!Number.isInteger(targetLeadCount) || targetLeadCount < 1 || targetLeadCount > Number(settings.maximumLeadsPerCampaign || 250)) throw Object.assign(new Error(`Target lead count must be between 1 and ${settings.maximumLeadsPerCampaign || 250}`), { statusCode: 400, code: "VALIDATION_ERROR" });
  const preferredLanguage = String(body.preferredLanguage || "AUTO_SUGGEST").toUpperCase();
  const defaultPriority = String(body.defaultPriority || "NORMAL").toUpperCase();
  const assignmentStrategy = String(body.assignmentStrategy || "UNASSIGNED_QUEUE").toUpperCase();
  if (!CALLING_LANGUAGES.includes(preferredLanguage) || !CALLING_PRIORITIES.includes(defaultPriority) || !CALLING_ASSIGNMENT_STRATEGIES.includes(assignmentStrategy)) throw Object.assign(new Error("Campaign language, priority, or assignment strategy is invalid"), { statusCode: 400, code: "VALIDATION_ERROR" });
  return { name, description: String(body.description || "").trim().slice(0, 3000), purpose, leadTypes: cleanArray(body.leadTypes, 8), filters: { states: cleanArray(body.filters?.states), districts: cleanArray(body.filters?.districts), fruits: cleanArray(body.filters?.fruits), leadStatuses: cleanArray(body.filters?.leadStatuses), sourceTypes: cleanArray(body.filters?.sourceTypes), tags: cleanArray(body.filters?.tags), minimumConfidence, maximumConfidence, importedFrom: body.filters?.importedFrom || null, createdFrom: body.filters?.createdFrom || null, createdTo: body.filters?.createdTo || null }, preferredLanguage, defaultPriority, assignmentStrategy, assignedTelecallers: cleanArray(body.assignedTelecallers, 100), targetLeadCount };
};

const buildBaseFilter = (input) => {
  const filter = { doNotContact: { $ne: true }, consentStatus: { $ne: "OPTED_OUT" }, status: { $nin: invalidStatuses }, duplicateStatus: { $ne: "CONFIRMED_DUPLICATE" }, overallConfidence: { $gte: input.filters.minimumConfidence, $lte: input.filters.maximumConfidence } };
  if (input.leadTypes.length) filter.leadType = { $in: input.leadTypes };
  if (input.filters.states.length) filter.state = { $in: input.filters.states };
  if (input.filters.districts.length) filter.district = { $in: input.filters.districts };
  if (input.filters.fruits.length) filter.fruits = { $in: input.filters.fruits };
  if (input.filters.leadStatuses.length) filter.status = { $in: input.filters.leadStatuses.filter((item) => !invalidStatuses.includes(item)) };
  if (input.filters.sourceTypes.length) filter.sourceType = { $in: input.filters.sourceTypes };
  if (input.filters.tags.length) filter.tags = { $in: input.filters.tags };
  if (input.filters.importedFrom) filter.importedAt = { ...(filter.importedAt || {}), $gte: new Date(input.filters.importedFrom) };
  if (input.filters.createdFrom || input.filters.createdTo) filter.createdAt = { ...(input.filters.createdFrom ? { $gte: new Date(input.filters.createdFrom) } : {}), ...(input.filters.createdTo ? { $lte: new Date(input.filters.createdTo) } : {}) };
  return filter;
};

export const validateTelecallers = async (ids) => {
  if (!ids.length) return [];
  const admins = await Admin.find({ _id: { $in: ids }, status: "ACTIVE", role: { $in: ["SUPER_ADMIN", "ADMIN", "SUPPORT_EXECUTIVE", "SALES_EXECUTIVE"] } }).select("_id name email role").lean();
  if (admins.length !== ids.length) throw Object.assign(new Error("One or more assigned telecallers are inactive or unauthorized"), { statusCode: 400, code: "INVALID_TELECALLER" });
  return admins;
};

export const previewCampaign = async (input, { campaignId = null } = {}) => {
  const base = buildBaseFilter(input);
  const [eligible, missingPhone, doNotContact, invalid] = await Promise.all([
    BusinessLead.find(base).select("_id name businessName phone leadType state district fruits status overallConfidence assignedTelecaller").sort({ overallConfidence: -1, importedAt: 1, _id: 1 }).limit(input.targetLeadCount * 3).lean(),
    BusinessLead.countDocuments({ ...base, $or: [{ phone: "" }, { phone: null }] }),
    BusinessLead.countDocuments({ $or: [{ doNotContact: true }, { consentStatus: "OPTED_OUT" }] }),
    BusinessLead.countDocuments({ status: { $in: invalidStatuses } }),
  ]);
  const callable = eligible.filter(hasCallablePhone);
  const badPhone = eligible.length - callable.length + missingPhone;
  const activeIds = campaignId ? await OGCallQueueItem.distinct("leadId", { campaignId, status: { $in: ["PENDING", "IN_PROGRESS", "FOLLOW_UP_REQUIRED"] } }) : [];
  const activeSet = new Set(activeIds.map(String));
  const proposed = callable.filter((lead) => !activeSet.has(String(lead._id))).slice(0, input.targetLeadCount);
  const distribution = {};
  input.assignedTelecallers.forEach((id) => { distribution[id] = 0; });
  if (input.assignedTelecallers.length && input.assignmentStrategy !== "UNASSIGNED_QUEUE") proposed.forEach((_lead, index) => { distribution[input.assignedTelecallers[index % input.assignedTelecallers.length]] += 1; });
  return { totalMatchingLeads: eligible.length, excludedMissingOrInvalidPhone: badPhone, excludedDoNotContact: doNotContact, excludedInvalid: invalid, alreadyActiveInCampaign: activeIds.length, finalProposedQueueSize: proposed.length, assignmentDistribution: distribution, proposedLeads: proposed };
};

export const createCampaignDraft = async (input, createdBy) => OGCallingCampaign.create({ ...input, createdBy, status: "DRAFT", addedLeadCount: 0, pendingCount: 0 });

export const activateCampaign = async (campaign, settings, actorId) => {
  if (!["DRAFT", "PAUSED"].includes(campaign.status)) throw Object.assign(new Error(`Campaign cannot activate from ${campaign.status}`), { statusCode: 409, code: "INVALID_CAMPAIGN_TRANSITION" });
  await validateTelecallers(campaign.assignedTelecallers.map(String));
  const input = { ...campaign.toObject(), assignedTelecallers: campaign.assignedTelecallers.map(String) };
  const preview = await previewCampaign(input, { campaignId: campaign._id });
  if (campaign.status === "DRAFT" && preview.proposedLeads.length) {
    const team = input.assignedTelecallers;
    const cap = Number(settings.maximumActiveQueueItemsPerTelecaller || 100);
    const counts = new Map(await Promise.all(team.map(async (telecallerId) => [String(telecallerId), await OGCallQueueItem.countDocuments({ assignedTo: telecallerId, status: { $in: ["PENDING", "IN_PROGRESS", "FOLLOW_UP_REQUIRED"] } })])));
    const chooseAssignee = (lead, index) => {
      if (!team.length || campaign.assignmentStrategy === "UNASSIGNED_QUEUE") return null;
      const existing = String(lead.assignedTelecaller || "");
      if (team.includes(existing) && (counts.get(existing) || 0) < cap) { counts.set(existing, (counts.get(existing) || 0) + 1); return existing; }
      if (campaign.assignmentStrategy === "MANUAL") return null;
      for (let offset = 0; offset < team.length; offset += 1) { const candidate = String(team[(index + offset) % team.length]); if ((counts.get(candidate) || 0) < cap) { counts.set(candidate, (counts.get(candidate) || 0) + 1); return candidate; } }
      return null;
    };
    const items = preview.proposedLeads.map((lead, index) => ({ campaignId: campaign._id, leadId: lead._id, assignedTo: chooseAssignee(lead, index), assignedBy: actorId, status: "PENDING", priority: campaign.defaultPriority, sequenceNumber: index + 1, createdFrom: "CAMPAIGN" }));
    try { await OGCallQueueItem.insertMany(items, { ordered: false }); } catch (error) { if (error?.code !== 11000) throw error; }
  }
  const counts = await OGCallQueueItem.countDocuments({ campaignId: campaign._id, status: { $in: ["PENDING", "IN_PROGRESS", "FOLLOW_UP_REQUIRED"] } });
  campaign.status = "ACTIVE"; campaign.startedAt ||= new Date(); campaign.addedLeadCount = await OGCallQueueItem.countDocuments({ campaignId: campaign._id }); campaign.pendingCount = counts;
  await campaign.save(); return { campaign, preview };
};

export const refreshCampaignCounters = async (campaignId) => {
  const objectId = new mongoose.Types.ObjectId(String(campaignId));
  const [queue, outcomes] = await Promise.all([OGCallQueueItem.aggregate([{ $match: { campaignId: objectId } }, { $group: { _id: "$status", count: { $sum: 1 } } }]), OGCallActivity.aggregate([{ $match: { campaignId: objectId, outcome: { $ne: null } } }, { $group: { _id: "$outcome", count: { $sum: 1 } } }])]);
  const q = Object.fromEntries(queue.map((x) => [x._id, x.count])); const o = Object.fromEntries(outcomes.map((x) => [x._id, x.count]));
  return OGCallingCampaign.findByIdAndUpdate(campaignId, { $set: { addedLeadCount: Object.values(q).reduce((a, b) => a + b, 0), pendingCount: (q.PENDING || 0) + (q.IN_PROGRESS || 0), completedCount: q.COMPLETED || 0, followUpCount: q.FOLLOW_UP_REQUIRED || 0, interestedCount: o.CONNECTED_INTERESTED || 0, notInterestedCount: o.CONNECTED_NOT_INTERESTED || 0, invalidCount: (o.WRONG_NUMBER || 0) + (o.DUPLICATE_CONTACT || 0), noAnswerCount: (o.NO_ANSWER || 0) + (o.BUSY || 0) + (o.SWITCHED_OFF || 0) + (o.OUT_OF_COVERAGE || 0) } }, { new: true });
};
