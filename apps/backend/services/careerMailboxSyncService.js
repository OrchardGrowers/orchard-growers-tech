import crypto from "node:crypto";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import CareerApplication from "../models/CareerApplication.js";
import {
  createBodyPreview,
  createFallbackMessageKey,
  deriveApplicantName,
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

export const syncCareerMailbox = async ({ importedBy } = {}) => {
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
    if (!mailbox.exists) {
      summary.completedAt = new Date();
      return summary;
    }

    const startSequence = Math.max(1, mailbox.exists - config.syncLimit + 1);
    for await (const message of client.fetch(
      `${startSequence}:*`,
      { uid: true, source: true, internalDate: true },
      { uid: false }
    )) {
      summary.scanned += 1;
      try {
        const parsed = await simpleParser(message.source);
        const sender = firstAddress(parsed.from);
        const replyTo = firstAddress(parsed.replyTo);
        const textBody = String(parsed.text || "").replace(/\u0000/g, "").trim().slice(0, 100000);
        const emailDate = parsed.date || message.internalDate || null;
        const extractedPhoneNumbers = extractPhoneNumbers(textBody);
        const normalizedMessageId = String(parsed.messageId || "").trim().toLowerCase().slice(0, 1000);
        const externalMessageKey = normalizedMessageId
          ? `message-id:${normalizedMessageId}`
          : createFallbackMessageKey({
              senderEmail: sender.email,
              replyToEmail: replyTo.email,
              subject: parsed.subject,
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
          replyToName: replyTo.name,
          replyToEmail: replyTo.email,
          subject: String(parsed.subject || "").trim().slice(0, 1000),
          emailDate,
          receivedAt: message.internalDate || emailDate || new Date(),
          textBody,
          bodyPreview: createBodyPreview(textBody),
          contactNumber: extractedPhoneNumbers[0] || "",
          extractedPhoneNumbers,
          extractedEmails: extractEmailAddresses(textBody, sender.email, replyTo.email),
          attachments: attachmentMetadata(parsed.attachments),
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
        else summary.duplicates += 1;
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
    summary.completedAt = new Date();
    return summary;
  } finally {
    if (client.usable) await client.logout().catch(() => undefined);
    syncInProgress = false;
  }
};
