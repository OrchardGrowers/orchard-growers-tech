import mongoose from "mongoose";

export const OG_AGENT_CANDIDATE_TYPES = ["GROWER", "BUYER", "BOTH", "CANDIDATE", "INVESTOR", "LOGISTICS", "OTHER", "UNCERTAIN"];
export const OG_AGENT_CANDIDATE_IMPORT_STATUSES = ["NOT_SELECTED", "SELECTED", "WAITING_APPROVAL", "IMPORTED", "SKIPPED", "FAILED"];

const extractedDataSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, maxlength: 200, default: "" },
    businessName: { type: String, trim: true, maxlength: 240, default: "" },
    contactPerson: { type: String, trim: true, maxlength: 200, default: "" },
    email: { type: String, trim: true, lowercase: true, maxlength: 320, default: "" },
    alternateEmails: { type: [{ type: String, trim: true, lowercase: true, maxlength: 320 }], default: [] },
    phone: { type: String, trim: true, maxlength: 40, default: "" },
    alternatePhones: { type: [{ type: String, trim: true, maxlength: 40 }], default: [] },
    countryCode: { type: String, trim: true, maxlength: 8, default: "" },
    address: { type: String, trim: true, maxlength: 1500, default: "" },
    village: { type: String, trim: true, maxlength: 160, default: "" },
    tehsil: { type: String, trim: true, maxlength: 160, default: "" },
    district: { type: String, trim: true, maxlength: 160, default: "" },
    state: { type: String, trim: true, maxlength: 160, default: "" },
    postalCode: { type: String, trim: true, maxlength: 20, default: "" },
    country: { type: String, trim: true, maxlength: 120, default: "India" },
    fruits: { type: [{ type: String, trim: true, maxlength: 100 }], default: [] },
    businessCategories: { type: [{ type: String, trim: true, maxlength: 120 }], default: [] },
    estimatedVolume: { type: String, trim: true, maxlength: 120, default: "" },
    volumeUnit: { type: String, trim: true, maxlength: 40, default: "" },
    preferredMarkets: { type: [{ type: String, trim: true, maxlength: 160 }], default: [] },
    followUpRequest: { type: String, trim: true, maxlength: 500, default: "" },
    preferredCallbackTime: { type: String, trim: true, maxlength: 160, default: "" },
  },
  { _id: false }
);

const duplicateMatchSchema = new mongoose.Schema(
  {
    collection: { type: String, trim: true, maxlength: 100, required: true },
    recordId: { type: mongoose.Schema.Types.ObjectId, required: true },
    matchType: { type: String, enum: ["EXACT", "POSSIBLE"], required: true },
    matchedField: { type: String, trim: true, maxlength: 100, required: true },
    score: { type: Number, min: 0, max: 100, required: true },
    summary: { type: String, trim: true, maxlength: 500, required: true },
    suggestedAction: { type: String, enum: ["SKIP", "REVIEW", "IMPORT_NEW", "UPDATE_EXISTING", "MERGE_LATER"], required: true },
  },
  { _id: false }
);

const ogAgentLeadCandidateSchema = new mongoose.Schema(
  {
    extractionId: { type: mongoose.Schema.Types.ObjectId, ref: "OGAgentLeadExtraction", default: null, index: true },
    researchTaskId: { type: mongoose.Schema.Types.ObjectId, ref: "OGResearchTask", default: null, index: true },
    researchRecordId: { type: mongoose.Schema.Types.ObjectId, ref: "OGResearchRecord", default: null, index: true },
    researchSourceId: { type: mongoose.Schema.Types.ObjectId, ref: "OGResearchSource", default: null },
    sourceType: { type: String, enum: ["EMAIL", "WEBSITE", "API", "RESEARCH"], default: "EMAIL" },
    businessContactContext: { type: String, enum: ["BUSINESS_CONTACT", "ORGANIZATION_CONTACT", "PUBLIC_OFFICE_CONTACT", "PERSONAL_CONTACT", "UNCERTAIN"], default: "UNCERTAIN" },
    publicContactBasis: { type: String, trim: true, maxlength: 1000, default: "" },
    sourceReliability: { type: String, enum: ["OFFICIAL", "HIGH", "MEDIUM", "LOW", "UNKNOWN"], default: "UNKNOWN" },
    importEligibility: { type: String, enum: ["ELIGIBLE", "REVIEW_REQUIRED", "INELIGIBLE"], default: "REVIEW_REQUIRED" },
    privacyWarnings: { type: [String], default: [] },
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: "OGAgentTask", required: true, index: true },
    selectedForImport: { type: Boolean, default: false, index: true },
    suggestedLeadType: { type: String, enum: OG_AGENT_CANDIDATE_TYPES, required: true, index: true },
    extractedData: { type: extractedDataSchema, required: true },
    normalizedData: {
      email: { type: String, default: "", index: true },
      phone: { type: String, default: "", index: true },
      alternateEmails: { type: [String], default: [] },
      alternatePhones: { type: [String], default: [] },
      businessName: { type: String, default: "", index: true },
      contactName: { type: String, default: "" },
    },
    fieldConfidence: {
      name: { type: Number, min: 0, max: 100, default: 0 },
      businessName: { type: Number, min: 0, max: 100, default: 0 },
      email: { type: Number, min: 0, max: 100, default: 0 },
      phone: { type: Number, min: 0, max: 100, default: 0 },
      location: { type: Number, min: 0, max: 100, default: 0 },
      fruits: { type: Number, min: 0, max: 100, default: 0 },
      leadType: { type: Number, min: 0, max: 100, default: 0 },
    },
    overallConfidence: { type: Number, min: 0, max: 100, required: true, index: true },
    classificationExplanation: { type: String, trim: true, maxlength: 1000, default: "" },
    source: {
      mailbox: { type: String, trim: true, maxlength: 160, required: true },
      sourceReference: { type: String, trim: true, maxlength: 500, required: true },
      messageId: { type: String, trim: true, maxlength: 1000, default: "", index: true },
      threadId: { type: String, trim: true, maxlength: 1000, default: "" },
      subject: { type: String, trim: true, maxlength: 1000, default: "" },
      sender: { type: String, trim: true, maxlength: 500, default: "" },
      recipients: { type: [{ type: String, trim: true, maxlength: 320 }], default: [] },
      receivedAt: { type: Date, default: null },
      evidenceSnippet: { type: String, trim: true, maxlength: 1200, default: "" },
    },
    duplicateMatches: { type: [duplicateMatchSchema], default: [] },
    duplicateStatus: { type: String, enum: ["UNIQUE", "POSSIBLE_DUPLICATE", "CONFIRMED_DUPLICATE"], default: "UNIQUE", index: true },
    warnings: { type: [{ type: String, trim: true, maxlength: 500 }], default: [] },
    validationErrors: { type: [{ type: String, trim: true, maxlength: 500 }], default: [] },
    editedByAdmin: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
    reviewedAt: { type: Date, default: null },
    importStatus: { type: String, enum: OG_AGENT_CANDIDATE_IMPORT_STATUSES, default: "NOT_SELECTED", index: true },
    importedLeadId: { type: mongoose.Schema.Types.ObjectId, ref: "BusinessLead", default: null },
  },
  { timestamps: true, collection: "og_agent_lead_candidates" }
);

ogAgentLeadCandidateSchema.index({ extractionId: 1, createdAt: -1 });
ogAgentLeadCandidateSchema.index({ extractionId: 1, selectedForImport: 1, importStatus: 1 });
ogAgentLeadCandidateSchema.index({ "source.sourceReference": 1, extractionId: 1 });

export default mongoose.model("OGAgentLeadCandidate", ogAgentLeadCandidateSchema);
