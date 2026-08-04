import { extractEmailAddresses, extractPhoneNumbers } from "../../../utils/careerApplicationExtraction.js";
import { classifyEmailLead } from "./emailLeadClassificationService.js";
import { createEvidenceSnippet } from "./emailContentSanitizer.js";
import {
  buildNormalizedCandidateData,
  normalizeExtractedEmail,
  normalizeExtractedPhone,
  normalizeFruits,
  normalizeState,
} from "./emailLeadNormalizationService.js";

const fruitPattern = /\b(apple|apples|mango|mangoes|kinnow|kinnows|orange|oranges|pear|pears|grape|grapes|pomegranate|pomegranates|banana|bananas|guava|guavas|cherry|cherries)\b/gi;
const volumePattern = /\b(\d+(?:\.\d+)?)\s*(kg|kilograms?|quintals?|tons?|tonnes?|boxes|crates)\b/i;

const inferBusinessName = (message, text) => {
  if (message.synchronizedFields?.businessName) return message.synchronizedFields.businessName;
  const line = text.split(/\n/).find((item) => /\b(?:orchard|farm|traders?|exports?|enterprises?|foods?|company|pvt|ltd|llp)\b/i.test(item) && item.length < 180);
  return String(line || "").trim();
};

export const extractLeadCandidateFromMessage = ({ message, targetTypes = [], minimumConfidence = 70 }) => {
  const safeText = String(message.safeText || "");
  const classification = classifyEmailLead({ text: safeText, subject: message.subject, targetTypes });
  const synchronized = message.synchronizedFields || {};
  const emails = extractEmailAddresses(safeText, synchronized.email, message.replyTo?.email, message.sender?.email)
    .map(normalizeExtractedEmail).filter(Boolean);
  const senderEmail = normalizeExtractedEmail(message.replyTo?.email || message.sender?.email);
  const primaryEmail = normalizeExtractedEmail(synchronized.email) || emails.find((email) => email !== senderEmail) || senderEmail || emails[0] || "";
  const phones = [synchronized.phone, synchronized.alternatePhone, ...(synchronized.extractedPhones || []), ...extractPhoneNumbers(safeText)]
    .map((phone) => normalizeExtractedPhone(phone, { countryHint: synchronized.state ? "IN" : "" }))
    .filter((phone) => phone.normalized);
  const uniquePhones = [...new Map(phones.map((phone) => [phone.normalized, phone])).values()];
  const fruitMatches = safeText.match(fruitPattern) || [];
  const fruits = normalizeFruits(fruitMatches);
  const volume = safeText.match(volumePattern);
  const businessName = inferBusinessName(message, safeText);
  const name = synchronized.candidateName || message.sender?.name || message.replyTo?.name || "";
  const data = {
    name,
    businessName,
    contactPerson: name,
    email: primaryEmail,
    alternateEmails: [...new Set(emails.filter((email) => email !== primaryEmail))].slice(0, 10),
    phone: uniquePhones[0]?.original || "",
    alternatePhones: uniquePhones.slice(1, 6).map((phone) => phone.original),
    countryCode: uniquePhones[0]?.countryCode || "",
    address: synchronized.address || "",
    village: "",
    tehsil: "",
    district: synchronized.district || "",
    state: normalizeState(synchronized.state),
    postalCode: synchronized.postalCode || "",
    country: synchronized.state ? "India" : "",
    fruits,
    businessCategories: synchronized.category && synchronized.category !== "UNKNOWN" ? [synchronized.category] : [],
    estimatedVolume: volume?.[1] || "",
    volumeUnit: volume?.[2] || "",
    preferredMarkets: [],
    followUpRequest: /\b(call back|follow up|contact me|reply|interested)\b/i.test(safeText) ? "Contact or follow-up requested in source email" : "",
    preferredCallbackTime: "",
  };
  const validationErrors = [];
  if (!data.email && !data.phone) validationErrors.push("At least one valid email address or phone number is required.");
  if (!data.name && !data.businessName) validationErrors.push("A contact name or business name is required.");
  const contactConfidence = data.email || data.phone ? 90 : 20;
  const identityConfidence = data.name || data.businessName ? 80 : 25;
  const overallConfidence = Math.round((classification.confidence * 0.5) + (contactConfidence * 0.3) + (identityConfidence * 0.2));
  const warnings = [];
  if (classification.leadType === "UNCERTAIN" || overallConfidence < minimumConfidence) warnings.push("Manual verification required.");
  if (targetTypes.length && !targetTypes.includes(classification.leadType) && !targetTypes.includes("BOTH")) warnings.push("Suggested classification is outside the selected target types.");

  return {
    suggestedLeadType: classification.leadType,
    extractedData: data,
    normalizedData: buildNormalizedCandidateData(data),
    fieldConfidence: {
      name: data.name ? 80 : 0,
      businessName: data.businessName ? 75 : 0,
      email: data.email ? 95 : 0,
      phone: data.phone ? 90 : 0,
      location: data.state || data.district ? 75 : 0,
      fruits: data.fruits.length ? 80 : 0,
      leadType: classification.confidence,
    },
    overallConfidence,
    classificationExplanation: classification.explanation,
    source: {
      mailbox: message.sourceId,
      sourceReference: message.sourceReference,
      messageId: message.messageId || "",
      threadId: message.threadId || "",
      subject: message.subject || "",
      sender: [message.sender?.name, message.sender?.email].filter(Boolean).join(" <").replace(/$/, message.sender?.name && message.sender?.email ? ">" : ""),
      recipients: message.recipients || [],
      receivedAt: message.receivedAt || null,
      evidenceSnippet: createEvidenceSnippet(safeText, classification.indicators),
    },
    warnings,
    validationErrors,
    selectedForImport: false,
    importStatus: "NOT_SELECTED",
  };
};
