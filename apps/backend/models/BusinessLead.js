import mongoose from "mongoose";

export const BUSINESS_LEAD_TYPES = ["GROWER", "BUYER", "BOTH", "CANDIDATE", "INVESTOR", "LOGISTICS", "SERVICE_PROVIDER", "OTHER"];
export const BUSINESS_LEAD_STATUSES = ["NEW", "UNVERIFIED", "VERIFIED", "CONTACTED", "INTERESTED", "NOT_INTERESTED", "FOLLOW_UP", "CONVERTED", "INVALID", "DUPLICATE", "ARCHIVED"];
export const BUSINESS_LEAD_CONSENT_STATUSES = ["UNKNOWN", "BUSINESS_CONTACT", "OPTED_IN", "OPTED_OUT", "NOT_REQUIRED"];
export const BUSINESS_LEAD_DUPLICATE_STATUSES = ["UNIQUE", "POSSIBLE_DUPLICATE", "CONFIRMED_DUPLICATE", "MERGED"];

const normalizeEmail = (value = "") => String(value || "").trim().toLowerCase();
const normalizePhone = (value = "") => String(value || "").replace(/\D/g, "");
const normalizeBusinessKey = (value = "") => String(value || "")
  .toLowerCase()
  .replace(/\b(?:private|pvt|limited|ltd|llp|incorporated|inc|company|co)\b\.?/g, " ")
  .replace(/[^a-z0-9\p{L}]+/gu, " ")
  .replace(/\s+/g, " ")
  .trim();

const businessLeadSchema = new mongoose.Schema(
  {
    leadType: { type: String, enum: BUSINESS_LEAD_TYPES, required: true, index: true },
    status: { type: String, enum: BUSINESS_LEAD_STATUSES, default: "UNVERIFIED", index: true },
    name: { type: String, trim: true, maxlength: 200, default: "" },
    businessName: { type: String, trim: true, maxlength: 240, default: "", index: true },
    contactPerson: { type: String, trim: true, maxlength: 200, default: "" },
    email: { type: String, trim: true, lowercase: true, maxlength: 320, default: "" },
    alternateEmails: { type: [{ type: String, trim: true, lowercase: true, maxlength: 320 }], default: [] },
    phone: { type: String, trim: true, maxlength: 40, default: "" },
    alternatePhones: { type: [{ type: String, trim: true, maxlength: 40 }], default: [] },
    countryCode: { type: String, trim: true, maxlength: 8, default: "" },
    address: { type: String, trim: true, maxlength: 1500, default: "" },
    village: { type: String, trim: true, maxlength: 160, default: "" },
    tehsil: { type: String, trim: true, maxlength: 160, default: "" },
    district: { type: String, trim: true, maxlength: 160, default: "", index: true },
    state: { type: String, trim: true, maxlength: 160, default: "", index: true },
    postalCode: { type: String, trim: true, maxlength: 20, default: "" },
    country: { type: String, trim: true, maxlength: 120, default: "India" },
    fruits: { type: [{ type: String, trim: true, maxlength: 100 }], default: [] },
    businessCategories: { type: [{ type: String, trim: true, maxlength: 120 }], default: [] },
    estimatedVolume: { type: String, trim: true, maxlength: 120, default: "" },
    volumeUnit: { type: String, trim: true, maxlength: 40, default: "" },
    preferredMarkets: { type: [{ type: String, trim: true, maxlength: 160 }], default: [] },
    sourceType: { type: String, enum: ["EMAIL", "WEBSITE", "API", "MANUAL", "REFERRAL", "IMPORT", "OTHER"], default: "EMAIL", index: true },
    sourceReference: { type: String, trim: true, maxlength: 500, default: "" },
    sourceMessageId: { type: String, trim: true, maxlength: 1000, default: "", index: true },
    sourceThreadId: { type: String, trim: true, maxlength: 1000, default: "" },
    sourceMailbox: { type: String, trim: true, maxlength: 160, default: "" },
    sourceSubject: { type: String, trim: true, maxlength: 1000, default: "" },
    sourceReceivedAt: { type: Date, default: null },
    sourceEvidence: { type: String, trim: true, maxlength: 1200, default: "" },
    extractionTaskId: { type: mongoose.Schema.Types.ObjectId, ref: "OGAgentLeadExtraction", required: true, index: true },
    sourceCandidateId: { type: mongoose.Schema.Types.ObjectId, ref: "OGAgentLeadCandidate", required: true, index: true },
    classificationConfidence: { type: Number, min: 0, max: 100, default: 0 },
    overallConfidence: { type: Number, min: 0, max: 100, default: 0 },
    verificationStatus: { type: String, enum: ["UNVERIFIED", "MANUAL_REVIEW_REQUIRED", "ADMIN_REVIEWED", "VERIFIED"], default: "UNVERIFIED" },
    consentStatus: { type: String, enum: BUSINESS_LEAD_CONSENT_STATUSES, default: "UNKNOWN", index: true },
    duplicateStatus: { type: String, enum: BUSINESS_LEAD_DUPLICATE_STATUSES, default: "UNIQUE" },
    duplicateOf: { type: mongoose.Schema.Types.ObjectId, ref: "BusinessLead", default: null },
    tags: { type: [{ type: String, trim: true, maxlength: 80 }], default: [] },
    notes: { type: String, trim: true, maxlength: 5000, default: "" },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
    lastContactedAt: { type: Date, default: null, index: true },
    lastCallOutcome: { type: String, trim: true, maxlength: 80, default: "" },
    nextFollowUpAt: { type: Date, default: null, index: true },
    contactAttemptCount: { type: Number, min: 0, default: 0 },
    assignedTelecaller: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null, index: true },
    preferredLanguage: { type: String, enum: ["HINDI", "ENGLISH", "HINGLISH", "LOCAL_LANGUAGE", "AUTO_SUGGEST"], default: "AUTO_SUGGEST" },
    preferredCallbackWindow: { type: String, trim: true, maxlength: 200, default: "" },
    doNotContact: { type: Boolean, default: false, index: true },
    doNotContactAt: { type: Date, default: null },
    doNotContactReason: { type: String, trim: true, maxlength: 1000, default: "" },
    lastCallActivityId: { type: mongoose.Schema.Types.ObjectId, ref: "OGCallActivity", default: null },
    importedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
    importedAt: { type: Date, default: Date.now },
    createdByType: { type: String, enum: ["ADMIN", "OG_AGENT", "SYSTEM"], default: "OG_AGENT" },
    normalizedEmail: { type: String, select: false, default: "" },
    normalizedPhone: { type: String, select: false, default: "" },
    normalizedAlternateEmails: { type: [String], select: false, default: [] },
    normalizedAlternatePhones: { type: [String], select: false, default: [] },
    normalizedBusinessName: { type: String, select: false, default: "" },
  },
  { timestamps: true, collection: "business_leads" }
);

businessLeadSchema.pre("validate", function normalizeDuplicateFields(next) {
  this.normalizedEmail = normalizeEmail(this.email);
  this.normalizedPhone = normalizePhone(this.phone);
  this.normalizedAlternateEmails = [...new Set((this.alternateEmails || []).map(normalizeEmail).filter(Boolean))];
  this.normalizedAlternatePhones = [...new Set((this.alternatePhones || []).map(normalizePhone).filter(Boolean))];
  this.normalizedBusinessName = normalizeBusinessKey(this.businessName);
  next();
});

businessLeadSchema.index({ normalizedEmail: 1 });
businessLeadSchema.index({ normalizedPhone: 1 });
businessLeadSchema.index({ normalizedBusinessName: 1, state: 1, district: 1 });
businessLeadSchema.index({ status: 1, createdAt: -1 });
businessLeadSchema.index({ extractionTaskId: 1, createdAt: -1 });
businessLeadSchema.index({ doNotContact: 1, status: 1, assignedTelecaller: 1 });
businessLeadSchema.index({ sourceCandidateId: 1 }, { unique: true, name: "one_business_lead_per_candidate" });

export default mongoose.model("BusinessLead", businessLeadSchema);
