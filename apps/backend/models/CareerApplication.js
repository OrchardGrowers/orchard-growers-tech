import mongoose from "mongoose";

export const CAREER_APPLICATION_STATUSES = [
  "NEW",
  "REVIEWED",
  "CONTACTED",
  "INTERVIEW_SCHEDULED",
  "SHORTLISTED",
  "SELECTED",
  "REJECTED",
  "DUPLICATE",
];

export const CAREER_FIELDS_OF_WORK = [
  "TECHNOLOGY",
  "AGRICULTURE",
  "FINANCE",
  "SALES",
  "MARKETING",
  "LOGISTICS",
  "HR",
  "OPERATIONS",
  "CUSTOMER_SUPPORT",
  "PHARMA",
  "BIOTECH",
  "OTHER",
  "UNKNOWN",
];

export const CAREER_EXPERIENCE_RANGES = [
  "FRESHER",
  "UNDER_2_YEARS",
  "TWO_TO_FIVE_YEARS",
  "ABOVE_5_YEARS",
  "UNKNOWN",
];

const attachmentSchema = new mongoose.Schema(
  {
    filename: { type: String, default: "" },
    contentType: { type: String, default: "" },
    size: { type: Number, default: 0 },
    contentId: { type: String, default: "" },
    disposition: { type: String, default: "" },
  },
  { _id: false }
);

const careerApplicationSchema = new mongoose.Schema(
  {
    externalMessageKey: { type: String, required: true, unique: true, index: true },
    messageId: { type: String, default: "", index: true },
    imapUid: { type: Number, default: null },
    mailbox: { type: String, default: "" },
    senderName: { type: String, default: "" },
    senderEmail: { type: String, default: "", index: true },
    applicantName: { type: String, default: "", index: true },
    candidateName: { type: String, default: "", index: true },
    email: { type: String, default: "", lowercase: true, trim: true, index: true },
    replyToName: { type: String, default: "" },
    replyToEmail: { type: String, default: "" },
    subject: { type: String, default: "", index: true },
    emailDate: { type: Date, default: null, index: true },
    receivedAt: { type: Date, default: Date.now, index: true },
    textBody: { type: String, default: "" },
    bodyPreview: { type: String, default: "" },
    contactNumber: { type: String, default: "", index: true },
    normalizedContactNumber: { type: String, default: "", index: true },
    alternateContactNumber: { type: String, default: "" },
    normalizedAlternateContactNumber: { type: String, default: "" },
    extractedPhoneNumbers: { type: [String], default: [] },
    extractedEmails: { type: [String], default: [] },
    address: { type: String, default: "" },
    city: { type: String, default: "", index: true },
    district: { type: String, default: "" },
    state: { type: String, default: "", index: true },
    postalCode: { type: String, default: "" },
    qualification: { type: String, default: "", index: true },
    workExperienceText: { type: String, default: "" },
    experienceYears: { type: Number, default: null },
    experienceRange: { type: String, enum: CAREER_EXPERIENCE_RANGES, default: "UNKNOWN", index: true },
    currentCompany: { type: String, default: "" },
    currentDesignation: { type: String, default: "" },
    skills: { type: [String], default: [] },
    fieldOfWork: { type: String, enum: CAREER_FIELDS_OF_WORK, default: "UNKNOWN", index: true },
    resumeFileName: { type: String, default: "" },
    resumeContentType: { type: String, default: "" },
    resumeSize: { type: Number, default: 0 },
    emailSubject: { type: String, default: "" },
    emailFrom: { type: String, default: "" },
    notes: { type: String, default: "" },
    tags: { type: [String], default: [] },
    attachments: { type: [attachmentSchema], default: [] },
    status: { type: String, enum: CAREER_APPLICATION_STATUSES, default: "NEW", index: true },
    source: { type: String, default: "IMAP" },
    syncBatchId: { type: String, required: true, index: true },
    importedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
    lastSyncedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

careerApplicationSchema.index({ status: 1, receivedAt: -1 });
careerApplicationSchema.index({ fieldOfWork: 1, experienceRange: 1, receivedAt: -1 });

export default mongoose.model("CareerApplication", careerApplicationSchema);
