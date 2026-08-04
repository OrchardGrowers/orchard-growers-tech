import mongoose from "mongoose";
import CareerApplication from "../../../models/CareerApplication.js";
import EmailSourceAdapter from "./emailSourceAdapter.js";
import { sanitizeEmailContent } from "./emailContentSanitizer.js";

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const boundedRegex = (value, maximum = 300) => {
  const cleaned = String(value || "").trim().slice(0, maximum);
  return cleaned ? new RegExp(escapeRegex(cleaned), "i") : null;
};

export class BusinessMailboxAdapter extends EmailSourceAdapter {
  constructor() {
    super({ id: "career-applications", label: "Synchronized Career / Business Inbox" });
  }

  async isAvailable() {
    const configured = Boolean(process.env.CAREER_IMAP_HOST && process.env.CAREER_IMAP_USER && process.env.CAREER_IMAP_PASSWORD);
    if (configured) return true;
    return (await CareerApplication.estimatedDocumentCount()) > 0;
  }

  async describe() {
    const available = await this.isAvailable();
    if (!available) return null;
    return {
      id: this.id,
      label: this.label,
      provider: "SYNCHRONIZED_IMAP",
      readOnly: true,
      folders: ["INBOX"],
      supports: { metadataSearch: true, safeContent: true, sentMessages: false, archivedMessages: false, attachments: false },
    };
  }

  buildFilter(filters = {}) {
    const query = {};
    if (filters.dateFrom || filters.dateTo) {
      query.receivedAt = {};
      if (filters.dateFrom) query.receivedAt.$gte = new Date(filters.dateFrom);
      if (filters.dateTo) query.receivedAt.$lte = new Date(filters.dateTo);
    }
    const sender = boundedRegex(filters.senderFilter, 320);
    const subject = boundedRegex(filters.subjectFilter, 300);
    if (sender) query.$or = [{ senderEmail: sender }, { replyToEmail: sender }, { senderName: sender }];
    if (subject) query.subject = subject;
    const terms = (filters.searchTerms || []).map((term) => boundedRegex(term, 100)).filter(Boolean).slice(0, 10);
    if (terms.length) {
      query.$and = terms.map((term) => ({ $or: [{ subject: term }, { bodyPreview: term }, { senderName: term }, { senderEmail: term }] }));
    }
    return query;
  }

  async searchMessages(filters = {}, { limit = 50, excludedSourceReferences = [] } = {}) {
    const query = this.buildFilter(filters);
    if (excludedSourceReferences.length) query._id = { $nin: excludedSourceReferences.filter(mongoose.isValidObjectId) };
    const messages = await CareerApplication.find(query)
      .select("_id messageId externalMessageKey mailbox senderName senderEmail replyToName replyToEmail subject receivedAt emailDate bodyPreview candidateName applicantName email contactNumber alternateContactNumber extractedEmails extractedPhoneNumbers address city district state postalCode currentCompany fieldOfWork")
      .sort({ receivedAt: -1, _id: -1 })
      .limit(Math.min(Math.max(Number(limit) || 50, 1), 250))
      .lean();
    return messages.map((message) => this.serializeMetadata(message));
  }

  serializeMetadata(message) {
    return {
      sourceId: this.id,
      sourceReference: String(message._id),
      messageId: message.messageId || message.externalMessageKey || "",
      threadId: "",
      mailbox: message.mailbox || "INBOX",
      sender: { name: message.senderName || "", email: message.senderEmail || "" },
      replyTo: { name: message.replyToName || "", email: message.replyToEmail || "" },
      recipients: [],
      subject: message.subject || "",
      receivedAt: message.receivedAt || message.emailDate || null,
      preview: sanitizeEmailContent(message.bodyPreview || "", { maximumLength: 500 }),
      synchronizedFields: {
        candidateName: message.candidateName || message.applicantName || "",
        email: message.email || "",
        phone: message.contactNumber || "",
        alternatePhone: message.alternateContactNumber || "",
        extractedEmails: message.extractedEmails || [],
        extractedPhones: message.extractedPhoneNumbers || [],
        address: message.address || "",
        city: message.city || "",
        district: message.district || "",
        state: message.state || "",
        postalCode: message.postalCode || "",
        businessName: message.currentCompany || "",
        category: message.fieldOfWork || "",
      },
    };
  }

  async getMessage(messageId) {
    if (!mongoose.isValidObjectId(messageId)) return null;
    const message = await CareerApplication.findById(messageId).select("-textBody -attachments").lean();
    return message ? this.serializeMetadata(message) : null;
  }

  async getSafeMessageContent(messageId) {
    if (!mongoose.isValidObjectId(messageId)) return null;
    const message = await CareerApplication.findById(messageId)
      .select("_id messageId externalMessageKey mailbox senderName senderEmail replyToName replyToEmail subject receivedAt emailDate bodyPreview textBody candidateName applicantName email contactNumber alternateContactNumber extractedEmails extractedPhoneNumbers address city district state postalCode currentCompany fieldOfWork")
      .lean();
    if (!message) return null;
    return {
      ...this.serializeMetadata(message),
      safeText: sanitizeEmailContent(message.textBody || message.bodyPreview || ""),
    };
  }

  async getAttachmentMetadata() { return []; }
}

export default BusinessMailboxAdapter;
