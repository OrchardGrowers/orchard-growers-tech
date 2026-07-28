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
    replyToName: { type: String, default: "" },
    replyToEmail: { type: String, default: "" },
    subject: { type: String, default: "", index: true },
    emailDate: { type: Date, default: null, index: true },
    receivedAt: { type: Date, default: Date.now, index: true },
    textBody: { type: String, default: "" },
    bodyPreview: { type: String, default: "" },
    contactNumber: { type: String, default: "", index: true },
    extractedPhoneNumbers: { type: [String], default: [] },
    extractedEmails: { type: [String], default: [] },
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

export default mongoose.model("CareerApplication", careerApplicationSchema);
