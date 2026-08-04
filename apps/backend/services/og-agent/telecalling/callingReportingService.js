import mongoose from "mongoose";
import BusinessLead from "../../../models/BusinessLead.js";
import OGCallActivity from "../../../models/OGCallActivity.js";
import OGCallingCampaign from "../../../models/OGCallingCampaign.js";
import OGCallQueueItem from "../../../models/OGCallQueueItem.js";
import OGFollowUp from "../../../models/OGFollowUp.js";

const dayBounds = () => { const start = new Date(); start.setHours(0, 0, 0, 0); const end = new Date(start); end.setDate(end.getDate() + 1); return { start, end }; };
export const getCallingDashboard = async (adminId = null) => {
  const { start, end } = dayBounds(); const own = adminId ? { assignedTo: new mongoose.Types.ObjectId(String(adminId)) } : {};
  const [callsPending, callsCompletedToday, followUpsDueToday, interestedLeads, noAnswerLeads, doNotContactLeads, nextCalls, overdueFollowUps, activeCampaigns, recentOutcomes, missingPhone, wrongPhone, duplicateContact, uncertainClassification, correctedRecords] = await Promise.all([
    OGCallQueueItem.countDocuments({ ...own, status: { $in: ["PENDING", "IN_PROGRESS"] } }),
    OGCallActivity.countDocuments({ ...(adminId ? { telecallerId: adminId } : {}), outcome: { $ne: null }, createdAt: { $gte: start, $lt: end } }),
    OGFollowUp.countDocuments({ ...own, status: { $in: ["PENDING", "OVERDUE"] }, dueAt: { $gte: start, $lt: end } }),
    BusinessLead.countDocuments({ status: "INTERESTED" }),
    OGCallActivity.countDocuments({ outcome: { $in: ["NO_ANSWER", "BUSY", "SWITCHED_OFF", "OUT_OF_COVERAGE"] } }),
    BusinessLead.countDocuments({ $or: [{ doNotContact: true }, { consentStatus: "OPTED_OUT" }] }),
    OGCallQueueItem.find({ ...own, status: { $in: ["PENDING", "IN_PROGRESS"] } }).populate("leadId", "name businessName leadType state district fruits status overallConfidence").populate("campaignId", "name purpose").sort({ priority: -1, sequenceNumber: 1 }).limit(8).lean(),
    OGFollowUp.find({ ...own, status: { $in: ["PENDING", "OVERDUE"] }, dueAt: { $lt: start } }).populate("leadId", "name businessName leadType").sort({ dueAt: 1 }).limit(8).lean(),
    OGCallingCampaign.find({ status: "ACTIVE" }).sort({ createdAt: -1 }).limit(8).lean(),
    OGCallActivity.find({ outcome: { $ne: null }, ...(adminId ? { telecallerId: adminId } : {}) }).populate("leadId", "name businessName").populate("telecallerId", "name role").sort({ createdAt: -1 }).limit(10).lean(),
    BusinessLead.countDocuments({ $or: [{ phone: "" }, { phone: null }] }), OGCallActivity.countDocuments({ outcome: "WRONG_NUMBER" }), OGCallActivity.countDocuments({ outcome: "DUPLICATE_CONTACT" }), BusinessLead.countDocuments({ verificationStatus: "MANUAL_REVIEW_REQUIRED" }), OGCallActivity.countDocuments({ correctedFields: { $ne: {} } }),
  ]);
  return { metrics: { callsPending, callsCompletedToday, followUpsDueToday, interestedLeads, noAnswerLeads, doNotContactLeads }, dataQuality: { missingPhone, wrongPhone, duplicateContact, uncertainClassification, correctedRecords }, nextCalls, overdueFollowUps, activeCampaigns, recentOutcomes };
};

export const getCampaignReport = async (campaignId) => {
  const objectId = new mongoose.Types.ObjectId(String(campaignId));
  const [campaign, queue, outcomes, duration, attempts, followUpsDue, overdueFollowUps] = await Promise.all([
    OGCallingCampaign.findById(campaignId).lean(),
    OGCallQueueItem.aggregate([{ $match: { campaignId: objectId } }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    OGCallActivity.aggregate([{ $match: { campaignId: objectId, outcome: { $ne: null } } }, { $group: { _id: "$outcome", count: { $sum: 1 } } }]),
    OGCallActivity.aggregate([{ $match: { campaignId: objectId, outcome: { $ne: null } } }, { $group: { _id: null, averageManuallyEnteredDurationSeconds: { $avg: "$manuallyEnteredDurationSeconds" } } }]),
    OGCallQueueItem.aggregate([{ $match: { campaignId: objectId } }, { $group: { _id: null, averageAttempts: { $avg: "$attemptCount" } } }]),
    OGFollowUp.countDocuments({ campaignId, status: { $in: ["PENDING", "OVERDUE"] } }), OGFollowUp.countDocuments({ campaignId, status: { $in: ["PENDING", "OVERDUE"] }, dueAt: { $lt: new Date() } }),
  ]);
  if (!campaign) throw Object.assign(new Error("Campaign not found"), { statusCode: 404, code: "CAMPAIGN_NOT_FOUND" });
  const queueDistribution = Object.fromEntries(queue.map((x) => [x._id, x.count])); const outcomeDistribution = Object.fromEntries(outcomes.map((x) => [x._id, x.count])); const total = Object.values(queueDistribution).reduce((a, b) => a + b, 0); const completed = queueDistribution.COMPLETED || 0;
  return { campaign, totalQueue: total, queueDistribution, outcomeDistribution, completionPercentage: total ? Math.round((completed / total) * 100) : 0, averageManuallyEnteredDurationSeconds: Math.round(duration[0]?.averageManuallyEnteredDurationSeconds || 0), averageAttempts: Number((attempts[0]?.averageAttempts || 0).toFixed(2)), followUpsDue, overdueFollowUps, durationLabel: "Manually entered duration; not telecom-provider verified" };
};

export const getTelecallerReport = async (telecallerId) => {
  const id = new mongoose.Types.ObjectId(String(telecallerId));
  const [assigned, queue, outcomes, duration, followUpsCreated, followUpsCompleted] = await Promise.all([OGCallQueueItem.countDocuments({ assignedTo: id }), OGCallQueueItem.aggregate([{ $match: { assignedTo: id } }, { $group: { _id: "$status", count: { $sum: 1 } } }]), OGCallActivity.aggregate([{ $match: { telecallerId: id, outcome: { $ne: null } } }, { $group: { _id: "$outcome", count: { $sum: 1 } } }]), OGCallActivity.aggregate([{ $match: { telecallerId: id, outcome: { $ne: null } } }, { $group: { _id: null, average: { $avg: "$manuallyEnteredDurationSeconds" } } }]), OGFollowUp.countDocuments({ createdBy: id }), OGFollowUp.countDocuments({ completedBy: id, status: "COMPLETED" })]);
  return { assigned, queueDistribution: Object.fromEntries(queue.map((x) => [x._id, x.count])), outcomeDistribution: Object.fromEntries(outcomes.map((x) => [x._id, x.count])), followUpsCreated, followUpsCompleted, averageManuallyEnteredDurationSeconds: Math.round(duration[0]?.average || 0), context: "Metrics show volume and outcomes for operational review; they are not a single employee ranking." };
};
