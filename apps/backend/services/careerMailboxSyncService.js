import crypto from "node:crypto";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import CareerApplication from "../models/CareerApplication.js";
import {
  createBodyPreview,
  createFallbackMessageKey,
  deriveApplicantName,
  extractCandidateProfile,
  extractEmailAddresses,
  extractPhoneNumbers,
  normalizeEmailAddress,
} from "../utils/careerApplicationExtraction.js";

let syncInProgress = false;

const parseBoolean = (value, fallback) => {
  if (value === undefined || value === "") return fallback;
  return String(value).toLowerCase() === "true";
};

const getMailboxConfig = () => {
  const config = {
    host: String(process.env.CAREER_IMAP_HOST || "").trim(),
    port: Number(process.env.CAREER_IMAP_PORT || 993),
    secure: parseBoolean(process.env.CAREER_IMAP_SECURE, true),
    user: String(process.env.CAREER_IMAP_USER || "").trim(),
    pass: String(process.env.CAREER_IMAP_PASSWORD || ""),
    mailbox: String(process.env.CAREER_IMAP_MAILBOX || "INBOX").trim() || "INBOX",
    rejectUnauthorized: parseBoolean(process.env.CAREER_IMAP_REJECT_UNAUTHORIZED, true),
    syncLimit: Math.min(Math.max(Number(process.env.CAREER_IMAP_SYNC_LIMIT) || 100, 1), 500),
  };

  if (!config.host || !config.user || !config.pass) {
    const error = new Error("Career mailbox IMAP configuration is incomplete.");
    error.statusCode = 503;
    throw error;
  }
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
    const error = new Error("Career mailbox IMAP port is invalid.");
    error.statusCode = 503;
    throw error;
  }
  return config;
};

const firstAddress = (addressCollection) => {
  const address = addressCollection?.value?.[0];
  return {
    name: String(address?.name || "").trim().slice(0, 200),
    email: normalizeEmailAddress(address?.address),
  };
};

const attachmentMetadata = (attachments = []) =>
  attachments.map((attachment) => ({
    filename: String(attachment.filename || "").slice(0, 500),
    contentType: String(attachment.contentType || "").slice(0, 200),
    size: Number(attachment.size) || 0,
    contentId: String(attachment.contentId || "").slice(0, 500),
    disposition: String(attachment.contentDisposition || "").slice(0, 100),
  }));

const backfillEmptyCandidateFields = async (externalMessageKey, values) => {
  const set = {};
  Object.entries(values).forEach(([field, value]) => {
    const hasValue = Array.isArray(value) ? value.length > 0 : value !== "" && value !== null && value !== undefined;
    if (!hasValue) return;
    const emptyCondition = Array.isArray(value)
      ? { $eq: [{ $size: { $ifNull: [`$${field}`, []] } }, 0] }
      : field === "fieldOfWork" || field === "experienceRange"
        ? { $in: [{ $ifNull: [`$${field}`, "UNKNOWN"] }, ["", null, "UNKNOWN"]] }
        : { $in: [{ $ifNull: [`$${field}`, ""] }, ["", null]] };
    set[field] = { $cond: [emptyCondition, { $literal: value }, `$${field}`] };
  });
  if (Object.keys(set).length) {
    await CareerApplication.updateOne({ externalMessageKey }, [{ $set: set }]);
  }
};

export const syncCareerMailbox = async ({ importedBy, syncAll = false } = {}) => {
  if (syncInProgress) {
    const error = new Error("A career mailbox sync is already in progress.");
    error.statusCode = 409;
    throw error;
  }

  const config = getMailboxConfig();
  const batchId = crypto.randomUUID();
  const summary = {
    batchId,
    scanned: 0,
    imported: 0,
    duplicates: 0,
    failed: 0,
    errors: [],
    startedAt: new Date(),
    completedAt: null,
    syncMode: syncAll ? "ALL" : "RECENT",
    mailboxMessages: 0,
  };
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
    tls: { rejectUnauthorized: config.rejectUnauthorized },
    logger: false,
  });
  syncInProgress = true;

  try {
    await client.connect();
    const mailbox = await client.mailboxOpen(config.mailbox, { readOnly: true });
    summary.mailboxMessages = mailbox.exists || 0;
    if (!mailbox.exists) {
      summary.completedAt = new Date();
      return summary;
    }

    const firstSequence = syncAll ? 1 : Math.max(1, mailbox.exists - config.syncLimit + 1);
    const batchSize = config.syncLimit;
    for (let batchStart = firstSequence; batchStart <= mailbox.exists; batchStart += batchSize) {
      const batchEnd = Math.min(batchStart + batchSize - 1, mailbox.exists);
      for await (const message of client.fetch(
        `${batchStart}:${batchEnd}`,
        { uid: true, source: true, internalDate: true },
        { uid: false }
      )) {
      summary.scanned += 1;
      try {
        const parsed = await simpleParser(message.source);
        const sender = firstAddress(parsed.from);
        const replyTo = firstAddress(parsed.replyTo);
        const textBody = String(parsed.text || "").replace(/\u0000/g, "").trim().slice(0, 100000);
        const subject = String(parsed.subject || "").trim().slice(0, 1000);
        const emailDate = parsed.date || message.internalDate || null;
        const extractedPhoneNumbers = extractPhoneNumbers(textBody);
        const profile = extractCandidateProfile({
          textBody,
          subject,
          senderName: sender.name,
          senderEmail: sender.email,
          replyToName: replyTo.name,
          replyToEmail: replyTo.email,
        });
        const storedAttachments = attachmentMetadata(parsed.attachments);
        const resumeAttachment = storedAttachments.find((attachment) =>
          /(?:pdf|msword|officedocument\.wordprocessingml|rtf|text\/plain)/i.test(attachment.contentType) ||
          /\.(?:pdf|doc|docx|rtf|txt)$/i.test(attachment.filename)
        );
        const normalizedMessageId = String(parsed.messageId || "").trim().toLowerCase().slice(0, 1000);
        const externalMessageKey = normalizedMessageId
          ? `message-id:${normalizedMessageId}`
          : createFallbackMessageKey({
              senderEmail: sender.email,
              replyToEmail: replyTo.email,
              subject,
              emailDate,
              textBody,
            });
        const document = {
          externalMessageKey,
          messageId: normalizedMessageId,
          imapUid: message.uid,
          mailbox: config.mailbox,
          senderName: sender.name,
          senderEmail: sender.email,
          applicantName: deriveApplicantName({
            senderName: sender.name,
            replyToName: replyTo.name,
            senderEmail: sender.email,
            textBody,
          }),
          candidateName: profile.candidateName,
          email: profile.email,
          replyToName: replyTo.name,
          replyToEmail: replyTo.email,
          subject,
          emailSubject: subject,
          emailFrom: sender.email,
          emailDate,
          receivedAt: message.internalDate || emailDate || new Date(),
          textBody,
          bodyPreview: createBodyPreview(textBody),
          contactNumber: profile.contactNumber,
          normalizedContactNumber: profile.normalizedContactNumber,
          alternateContactNumber: profile.alternateContactNumber,
          normalizedAlternateContactNumber: profile.normalizedAlternateContactNumber,
          extractedPhoneNumbers,
          extractedEmails: extractEmailAddresses(textBody, sender.email, replyTo.email),
          address: profile.address,
          city: profile.city,
          district: profile.district,
          state: profile.state,
          postalCode: profile.postalCode,
          qualification: profile.qualification,
          workExperienceText: profile.workExperienceText,
          experienceYears: profile.experienceYears,
          experienceRange: profile.experienceRange,
          currentCompany: profile.currentCompany,
          currentDesignation: profile.currentDesignation,
          skills: profile.skills,
          fieldOfWork: profile.fieldOfWork,
          resumeFileName: resumeAttachment?.filename || "",
          resumeContentType: resumeAttachment?.contentType || "",
          resumeSize: resumeAttachment?.size || 0,
          attachments: storedAttachments,
          syncBatchId: batchId,
          source: "IMAP",
          importedBy: importedBy || null,
        };

        const result = await CareerApplication.updateOne(
          { externalMessageKey },
          { $setOnInsert: document, $set: { lastSyncedAt: new Date() } },
          { upsert: true }
        );
        if (result.upsertedCount) summary.imported += 1;
        else {
          await backfillEmptyCandidateFields(externalMessageKey, {
            candidateName: profile.candidateName,
            email: profile.email,
            contactNumber: profile.contactNumber,
            normalizedContactNumber: profile.normalizedContactNumber,
            alternateContactNumber: profile.alternateContactNumber,
            normalizedAlternateContactNumber: profile.normalizedAlternateContactNumber,
            address: profile.address,
            city: profile.city,
            district: profile.district,
            state: profile.state,
            postalCode: profile.postalCode,
            qualification: profile.qualification,
            workExperienceText: profile.workExperienceText,
            experienceYears: profile.experienceYears,
            experienceRange: profile.experienceRange,
            currentCompany: profile.currentCompany,
            currentDesignation: profile.currentDesignation,
            skills: profile.skills,
            fieldOfWork: profile.fieldOfWork,
            resumeFileName: resumeAttachment?.filename || "",
            resumeContentType: resumeAttachment?.contentType || "",
            resumeSize: resumeAttachment?.size || 0,
            emailSubject: subject,
            emailFrom: sender.email,
          });
          summary.duplicates += 1;
        }
      } catch (error) {
        if (error?.code === 11000) summary.duplicates += 1;
        else {
          summary.failed += 1;
          if (summary.errors.length < 20) {
            summary.errors.push({
              uid: message.uid,
              message: "Message parsing or import failed.",
            });
          }
        }
      }
      }
    }
    summary.completedAt = new Date();
    return summary;
  } finally {
    if (client.usable) await client.logout().catch(() => undefined);
    syncInProgress = false;
  }
};
