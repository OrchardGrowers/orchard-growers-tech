import mongoose from "mongoose";
import BusinessLead from "../../../models/BusinessLead.js";
import CareerApplication from "../../../models/CareerApplication.js";
import Lead from "../../../models/Lead.js";
import OGAgentLeadCandidate from "../../../models/OGAgentLeadCandidate.js";
import User from "../../../models/User.js";

const addMatch = (matches, { collection, recordId, matchType, matchedField, score, summary, suggestedAction }) => {
  if (!recordId || matches.some((match) => match.collection === collection && String(match.recordId) === String(recordId) && match.matchedField === matchedField)) return;
  matches.push({ collection, recordId, matchType, matchedField, score, summary, suggestedAction });
};

const phoneVariants = (phone) => {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return [];
  const local = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
  return [...new Set([digits, local, `+${digits}`, local.length === 10 ? `+91${local}` : ""].filter(Boolean))];
};

export const checkCandidateDuplicates = async (candidates, { minimumConfidence = 70, persist = true } = {}) => {
  const candidateList = candidates.map((candidate) => candidate.toObject?.() || candidate);
  const emails = [...new Set(candidateList.flatMap((candidate) => [candidate.normalizedData?.email, ...(candidate.normalizedData?.alternateEmails || [])]).filter(Boolean))];
  const phones = [...new Set(candidateList.flatMap((candidate) => [candidate.normalizedData?.phone, ...(candidate.normalizedData?.alternatePhones || [])]).filter(Boolean))];
  const phoneQueryValues = [...new Set(phones.flatMap(phoneVariants))];
  const businessNames = [...new Set(candidateList.map((candidate) => candidate.normalizedData?.businessName).filter(Boolean))];
  const sourceIds = candidateList.map((candidate) => candidate.source?.sourceReference).filter(mongoose.isValidObjectId);

  const [businessLeads, users, legacyLeads, careerRecords] = await Promise.all([
    emails.length || phones.length || businessNames.length ? BusinessLead.find({ $or: [
      ...(emails.length ? [{ normalizedEmail: { $in: emails } }, { normalizedAlternateEmails: { $in: emails } }] : []),
      ...(phones.length ? [{ normalizedPhone: { $in: phones } }, { normalizedAlternatePhones: { $in: phones } }] : []),
      ...(businessNames.length ? [{ normalizedBusinessName: { $in: businessNames } }] : []),
    ] }).select("+normalizedEmail +normalizedPhone +normalizedAlternateEmails +normalizedAlternatePhones +normalizedBusinessName businessName contactPerson email phone state district consentStatus status").lean() : [],
    emails.length || phoneQueryValues.length ? User.find({ $or: [
      ...(emails.length ? [{ email: { $in: emails } }] : []),
      ...(phoneQueryValues.length ? [{ phone: { $in: phoneQueryValues } }] : []),
    ] }).select("name email phone role profileTypes orchardName businessName buyerContactPerson location buyerLocation").lean() : [],
    emails.length || phones.length ? Lead.find({ $or: [
      ...(emails.length ? [{ normalizedEmail: { $in: emails } }] : []),
      ...(phones.length ? [{ normalizedPhone: { $in: phones } }] : []),
    ] }).select("+normalizedEmail +normalizedPhone companyName contactPerson email phone leadType status").lean() : [],
    emails.length || phoneQueryValues.length ? CareerApplication.find({
      _id: { $nin: sourceIds },
      $or: [
        ...(emails.length ? [{ email: { $in: emails } }, { senderEmail: { $in: emails } }, { replyToEmail: { $in: emails } }, { extractedEmails: { $in: emails } }] : []),
        ...(phoneQueryValues.length ? [{ normalizedContactNumber: { $in: phoneQueryValues } }, { contactNumber: { $in: phoneQueryValues } }, { extractedPhoneNumbers: { $in: phoneQueryValues } }] : []),
      ],
    }).select("candidateName email senderEmail replyToEmail contactNumber normalizedContactNumber state district currentCompany").lean() : [],
  ]);

  const seenEmails = new Map();
  const seenPhones = new Map();
  const results = candidateList.map((candidate) => {
    const matches = [];
    const candidateEmails = [candidate.normalizedData?.email, ...(candidate.normalizedData?.alternateEmails || [])].filter(Boolean);
    const candidatePhones = [candidate.normalizedData?.phone, ...(candidate.normalizedData?.alternatePhones || [])].filter(Boolean);
    const businessName = candidate.normalizedData?.businessName || "";
    const state = String(candidate.extractedData?.state || "").toLowerCase();
    const district = String(candidate.extractedData?.district || "").toLowerCase();

    candidateEmails.forEach((email) => {
      if (seenEmails.has(email)) addMatch(matches, { collection: "OGAgentLeadCandidate", recordId: seenEmails.get(email), matchType: "EXACT", matchedField: "email", score: 100, summary: "Exact email match within this extraction.", suggestedAction: "SKIP" });
      else seenEmails.set(email, candidate._id);
    });
    candidatePhones.forEach((phone) => {
      if (seenPhones.has(phone)) addMatch(matches, { collection: "OGAgentLeadCandidate", recordId: seenPhones.get(phone), matchType: "EXACT", matchedField: "phone", score: 100, summary: "Exact phone match within this extraction.", suggestedAction: "SKIP" });
      else seenPhones.set(phone, candidate._id);
    });

    businessLeads.forEach((lead) => {
      const emailMatch = candidateEmails.some((email) => email === lead.normalizedEmail || lead.normalizedAlternateEmails?.includes(email));
      const phoneMatch = candidatePhones.some((phone) => phone === lead.normalizedPhone || lead.normalizedAlternatePhones?.includes(phone));
      if (emailMatch) addMatch(matches, { collection: "BusinessLead", recordId: lead._id, matchType: "EXACT", matchedField: "email", score: 100, summary: lead.consentStatus === "OPTED_OUT" ? "Exact email match to an opted-out Business Lead." : "Exact email match to an existing Business Lead.", suggestedAction: "SKIP" });
      if (phoneMatch) addMatch(matches, { collection: "BusinessLead", recordId: lead._id, matchType: "EXACT", matchedField: "phone", score: 100, summary: lead.consentStatus === "OPTED_OUT" ? "Exact phone match to an opted-out Business Lead." : "Exact phone match to an existing Business Lead.", suggestedAction: "SKIP" });
      if (!emailMatch && !phoneMatch && businessName && businessName === lead.normalizedBusinessName) {
        const locationMatch = (district && district === String(lead.district || "").toLowerCase()) || (state && state === String(lead.state || "").toLowerCase());
        addMatch(matches, { collection: "BusinessLead", recordId: lead._id, matchType: "POSSIBLE", matchedField: locationMatch ? "businessName+location" : "businessName", score: locationMatch ? 85 : 70, summary: `Similar business name${locationMatch ? " and location" : ""} match.`, suggestedAction: "REVIEW" });
      }
    });

    users.forEach((user) => {
      if (candidateEmails.includes(String(user.email || "").toLowerCase())) addMatch(matches, { collection: "User", recordId: user._id, matchType: "EXACT", matchedField: "email", score: 100, summary: "Exact email match to an existing platform user.", suggestedAction: "SKIP" });
      if (candidatePhones.some((phone) => phoneVariants(phone).includes(String(user.phone || "")))) addMatch(matches, { collection: "User", recordId: user._id, matchType: "EXACT", matchedField: "phone", score: 100, summary: "Exact phone match to an existing platform user.", suggestedAction: "SKIP" });
    });
    legacyLeads.forEach((lead) => {
      if (candidateEmails.includes(lead.normalizedEmail)) addMatch(matches, { collection: "Lead", recordId: lead._id, matchType: "EXACT", matchedField: "email", score: 100, summary: "Exact email match to the existing Orchard AI Lead Database.", suggestedAction: "SKIP" });
      if (candidatePhones.includes(lead.normalizedPhone)) addMatch(matches, { collection: "Lead", recordId: lead._id, matchType: "EXACT", matchedField: "phone", score: 100, summary: "Exact phone match to the existing Orchard AI Lead Database.", suggestedAction: "SKIP" });
    });
    careerRecords.forEach((record) => {
      const recordEmails = [record.email, record.senderEmail, record.replyToEmail].map((email) => String(email || "").toLowerCase());
      if (candidateEmails.some((email) => recordEmails.includes(email))) addMatch(matches, { collection: "CareerApplication", recordId: record._id, matchType: "POSSIBLE", matchedField: "email", score: 90, summary: "The same email appears in another synchronized message.", suggestedAction: "REVIEW" });
      const recordPhones = [record.normalizedContactNumber, record.contactNumber].flatMap(phoneVariants);
      if (candidatePhones.some((phone) => recordPhones.includes(phone) || recordPhones.includes(phoneVariants(phone)[0]))) addMatch(matches, { collection: "CareerApplication", recordId: record._id, matchType: "POSSIBLE", matchedField: "phone", score: 90, summary: "The same phone appears in another synchronized message.", suggestedAction: "REVIEW" });
    });

    const duplicateStatus = matches.some((match) => match.score === 100) ? "CONFIRMED_DUPLICATE" : matches.length ? "POSSIBLE_DUPLICATE" : "UNIQUE";
    const shouldSelect = duplicateStatus === "UNIQUE" && candidate.overallConfidence >= minimumConfidence && candidate.suggestedLeadType !== "UNCERTAIN" && !(candidate.validationErrors || []).length;
    return { candidateId: candidate._id, duplicateMatches: matches, duplicateStatus, selectedForImport: shouldSelect, importStatus: shouldSelect ? "SELECTED" : "NOT_SELECTED" };
  });

  if (persist && results.length) {
    await OGAgentLeadCandidate.bulkWrite(results.map((result) => ({
      updateOne: {
        filter: { _id: result.candidateId, importStatus: { $nin: ["IMPORTED", "WAITING_APPROVAL"] } },
        update: { $set: { duplicateMatches: result.duplicateMatches, duplicateStatus: result.duplicateStatus, selectedForImport: result.selectedForImport, importStatus: result.importStatus } },
      },
    })), { ordered: false });
  }
  return results;
};

export default checkCandidateDuplicates;
