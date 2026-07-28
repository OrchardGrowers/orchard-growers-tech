import crypto from "crypto";
import mongoose from "mongoose";
import Admin from "../models/Admin.js";
import EmailDeliveryLog from "../models/EmailDeliveryLog.js";
import {
  getBusinessMailProviderStatus,
  sendBusinessMail,
} from "../services/businessMail/BusinessMailService.js";
import {
  BUSINESS_MAIL_ERROR_CODES,
  BusinessMailError,
  isBusinessMailError,
} from "../services/businessMail/businessMailErrors.js";
import {
  getBusinessMailSenderProfile,
} from "../services/businessMail/senderProfiles.js";
import {
  appendBusinessMailSignature,
  hasControlledSignature,
} from "../services/businessMail/businessMailSignatures.js";
import {
  assertBusinessMailSenderAccess,
  getAuthorizedBusinessMailSenderProfiles,
  getBusinessMailSenderAccessSummary,
  getBusinessMailMasterAdminEmail,
  getGloballyEnabledBusinessMailSenderProfiles,
  isBusinessMailMasterAdmin,
  BUSINESS_MAIL_COMMON_SENDER_PROFILE_KEYS,
  normalizeBusinessMailSenderProfileKeys,
} from "../services/businessMail/businessMailSenderAccess.js";
import { validateBusinessMailHtml } from "../utils/businessMailContentValidation.js";

export const BUSINESS_MAIL_CATEGORIES = Object.freeze([
  "GENERAL",
  "CAREER",
  "SUPPORT",
  "ADMIN_NOTICE",
  "USER_COMMUNICATION",
  "INTERNAL_TEST",
]);

const CATEGORY_SET = new Set(BUSINESS_MAIL_CATEGORIES);
const STATUS_SET = new Set(["REQUESTED", "PROCESSING", "SENT", "FAILED"]);
const PROVIDER_SET = new Set(["brevo_api", "smtp"]);
const SEND_FIELDS = new Set([
  "senderProfileKey", "to", "cc", "bcc", "subject", "text", "html", "attachments", "category", "metadata", "idempotencyKey",
]);
const PREVIEW_FIELDS = new Set(["senderProfileKey", "text", "html"]);
const METADATA_FIELDS = new Set(["source", "correlationId"]);
const HEADER_BREAK_PATTERN = /[\r\n]/;
const EMAIL_PATTERN = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;
const SALES_ROLE = "SALES_EXECUTIVE";
const MAX_AUDIT_ENTRIES = 200;
const MAX_COPY_RECIPIENTS = 5;
const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const requestError = (code, message) => new BusinessMailError(code, message);

const boundedString = (value, field, max, { required = false, headerSafe = false } = {}) => {
  if (value === undefined || value === null) {
    if (required) throw requestError(BUSINESS_MAIL_ERROR_CODES.INVALID_REQUEST, `${field} is required.`);
    return "";
  }
  if (typeof value !== "string") {
    throw requestError(BUSINESS_MAIL_ERROR_CODES.INVALID_REQUEST, `${field} must be a string.`);
  }
  if (value.length > max) {
    throw requestError(BUSINESS_MAIL_ERROR_CODES.INVALID_REQUEST, `${field} exceeds the maximum length.`);
  }
  const normalized = value.trim();
  if (required && !normalized) throw requestError(BUSINESS_MAIL_ERROR_CODES.INVALID_REQUEST, `${field} is required.`);
  if (headerSafe && HEADER_BREAK_PATTERN.test(value)) {
    throw requestError(BUSINESS_MAIL_ERROR_CODES.INVALID_REQUEST, `${field} cannot contain line breaks.`);
  }
  return normalized;
};

const validateMetadata = (metadata) => {
  if (metadata === undefined || metadata === null) return {};
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    throw requestError(BUSINESS_MAIL_ERROR_CODES.INVALID_REQUEST, "metadata must be an object.");
  }
  if (Object.keys(metadata).some((key) => !METADATA_FIELDS.has(key))) {
    throw requestError(BUSINESS_MAIL_ERROR_CODES.INVALID_REQUEST, "metadata contains unsupported fields.");
  }
  for (const value of Object.values(metadata)) {
    if (value !== undefined && value !== null && typeof value !== "string") {
      throw requestError(BUSINESS_MAIL_ERROR_CODES.INVALID_REQUEST, "metadata values must be strings.");
    }
  }
  return {
    source: boundedString(metadata.source, "metadata.source", 50),
    correlationId: boundedString(metadata.correlationId, "metadata.correlationId", 128, { headerSafe: true }),
  };
};

const validateEmailList = (value, field) => {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > MAX_COPY_RECIPIENTS) {
    throw requestError(BUSINESS_MAIL_ERROR_CODES.INVALID_RECIPIENT, `${field} must contain at most ${MAX_COPY_RECIPIENTS} email addresses.`);
  }
  const emails = value.map((entry, index) => {
    const email = boundedString(entry, `${field}[${index}]`, 320, { required: true, headerSafe: true }).toLowerCase();
    if (!EMAIL_PATTERN.test(email)) {
      throw requestError(BUSINESS_MAIL_ERROR_CODES.INVALID_RECIPIENT, `${field} contains an invalid email address.`);
    }
    return email;
  });
  if (new Set(emails).size !== emails.length) {
    throw requestError(BUSINESS_MAIL_ERROR_CODES.INVALID_RECIPIENT, `${field} cannot contain duplicate addresses.`);
  }
  return emails;
};

const validateAttachments = (value) => {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > MAX_ATTACHMENTS) {
    throw requestError(BUSINESS_MAIL_ERROR_CODES.UNSUPPORTED_ATTACHMENTS, `Attach at most ${MAX_ATTACHMENTS} files.`);
  }
  let totalBytes = 0;
  return value.map((attachment, index) => {
    if (!attachment || typeof attachment !== "object" || Array.isArray(attachment)) {
      throw requestError(BUSINESS_MAIL_ERROR_CODES.UNSUPPORTED_ATTACHMENTS, `attachments[${index}] is invalid.`);
    }
    if (Object.keys(attachment).some((key) => !["filename", "contentType", "content"].includes(key))) {
      throw requestError(BUSINESS_MAIL_ERROR_CODES.UNSUPPORTED_ATTACHMENTS, `attachments[${index}] contains unsupported fields.`);
    }
    const filename = boundedString(attachment.filename, `attachments[${index}].filename`, 120, { required: true, headerSafe: true });
    if (filename !== filename.split(/[\\/]/).pop() || /[\u0000-\u001f\u007f]/.test(filename)) {
      throw requestError(BUSINESS_MAIL_ERROR_CODES.UNSUPPORTED_ATTACHMENTS, "Attachment filenames cannot contain paths or control characters.");
    }
    const contentType = boundedString(attachment.contentType, `attachments[${index}].contentType`, 120, { required: true, headerSafe: true }).toLowerCase();
    if (!ALLOWED_ATTACHMENT_TYPES.has(contentType)) {
      throw requestError(BUSINESS_MAIL_ERROR_CODES.UNSUPPORTED_ATTACHMENTS, `Attachment type ${contentType} is not allowed.`);
    }
    const content = boundedString(attachment.content, `attachments[${index}].content`, 3_000_000, { required: true });
    if (!/^[a-z0-9+/]+={0,2}$/i.test(content) || content.length % 4 !== 0) {
      throw requestError(BUSINESS_MAIL_ERROR_CODES.UNSUPPORTED_ATTACHMENTS, "Attachment content must be valid base64.");
    }
    const size = Buffer.from(content, "base64").length;
    if (!size || size > MAX_ATTACHMENT_BYTES) {
      throw requestError(BUSINESS_MAIL_ERROR_CODES.UNSUPPORTED_ATTACHMENTS, "Each attachment must be 2 MB or smaller.");
    }
    totalBytes += size;
    if (totalBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
      throw requestError(BUSINESS_MAIL_ERROR_CODES.UNSUPPORTED_ATTACHMENTS, "Combined attachments must be 5 MB or smaller.");
    }
    return { filename, contentType, content, size };
  });
};

export const validateBusinessMailRequestPayload = (body) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw requestError(BUSINESS_MAIL_ERROR_CODES.INVALID_REQUEST, "Request body must be an object.");
  }
  const unsupportedFields = Object.keys(body).filter((key) => !SEND_FIELDS.has(key));
  if (unsupportedFields.length) {
    throw requestError(BUSINESS_MAIL_ERROR_CODES.INVALID_REQUEST, "Request contains unsupported fields.");
  }

  const senderProfileKey = boundedString(body.senderProfileKey, "senderProfileKey", 80, { required: true, headerSafe: true }).toUpperCase();
  if (Array.isArray(body.to)) {
    throw requestError(BUSINESS_MAIL_ERROR_CODES.INVALID_RECIPIENT, "Exactly one recipient email is required.");
  }
  const to = boundedString(body.to, "to", 320, { required: true, headerSafe: true }).toLowerCase();
  if (/[,;]/.test(to) || !EMAIL_PATTERN.test(to)) {
    throw requestError(BUSINESS_MAIL_ERROR_CODES.INVALID_RECIPIENT, "Exactly one valid recipient email is required.");
  }
  const cc = validateEmailList(body.cc, "cc");
  const bcc = validateEmailList(body.bcc, "bcc");
  const allRecipients = [to, ...cc, ...bcc];
  if (new Set(allRecipients).size !== allRecipients.length) {
    throw requestError(BUSINESS_MAIL_ERROR_CODES.INVALID_RECIPIENT, "To, CC, and BCC addresses must be unique.");
  }
  const subject = boundedString(body.subject, "subject", 200, { required: true, headerSafe: true });
  const text = boundedString(body.text, "text", 100000);
  const html = boundedString(body.html, "html", 150000);
  if (!text && !html) {
    throw requestError(BUSINESS_MAIL_ERROR_CODES.INVALID_CONTENT, "Plain-text or HTML content is required.");
  }
  if (html) validateBusinessMailHtml(html);
  if (hasControlledSignature(text) || hasControlledSignature(html)) {
    throw requestError(
      BUSINESS_MAIL_ERROR_CODES.INVALID_CONTENT,
      "The controlled Business Mail signature cannot be supplied by the client."
    );
  }

  const category = boundedString(body.category || "GENERAL", "category", 50, { required: true, headerSafe: true }).toUpperCase();
  if (!CATEGORY_SET.has(category)) {
    throw requestError(BUSINESS_MAIL_ERROR_CODES.INVALID_REQUEST, "Unsupported Business Mail category.");
  }
  const idempotencyKey = boundedString(body.idempotencyKey, "idempotencyKey", 128, { headerSafe: true });
  const attachments = validateAttachments(body.attachments);

  return {
    senderProfileKey,
    to,
    cc,
    bcc,
    subject,
    text,
    html,
    attachments,
    category,
    metadata: validateMetadata(body.metadata),
    idempotencyKey,
  };
};

export const validateBusinessMailPreviewPayload = (body) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw requestError(BUSINESS_MAIL_ERROR_CODES.INVALID_REQUEST, "Request body must be an object.");
  }
  if (Object.keys(body).some((key) => !PREVIEW_FIELDS.has(key))) {
    throw requestError(BUSINESS_MAIL_ERROR_CODES.INVALID_REQUEST, "Preview contains unsupported fields.");
  }
  const senderProfileKey = boundedString(
    body.senderProfileKey,
    "senderProfileKey",
    80,
    { required: true, headerSafe: true }
  ).toUpperCase();
  const text = boundedString(body.text, "text", 100000);
  const html = boundedString(body.html, "html", 150000);
  if (!text && !html) {
    throw requestError(BUSINESS_MAIL_ERROR_CODES.INVALID_CONTENT, "Plain-text or HTML content is required.");
  }
  if (html) validateBusinessMailHtml(html);
  if (hasControlledSignature(text) || hasControlledSignature(html)) {
    throw requestError(
      BUSINESS_MAIL_ERROR_CODES.INVALID_CONTENT,
      "The controlled Business Mail signature cannot be supplied by the client."
    );
  }
  return { senderProfileKey, text, html };
};

const mapBusinessMailError = (error) => {
  if (isBusinessMailError(error)) {
    return {
      status: error.statusCode || 500,
      body: { success: false, code: error.code, msg: error.message },
    };
  }
  return {
    status: 500,
    body: { success: false, code: "BUSINESS_MAIL_INTERNAL_ERROR", msg: "Business Mail request failed." },
  };
};

const sendMappedError = (res, error) => {
  const mapped = mapBusinessMailError(error);
  return res.status(mapped.status).json(mapped.body);
};

const getAdminContext = (req) => ({
  id: String(req.admin?._id || req.admin?.id || req.user?.id || ""),
  name: String(req.admin?.name || "").trim().slice(0, 100),
  email: String(req.admin?.email || "").trim().toLowerCase(),
  role: String(req.admin?.role || req.user?.role || "").trim().toUpperCase(),
});

const maskEmail = (value = "") => {
  const [name = "", domain = ""] = String(value || "").split("@");
  return domain ? `${name.slice(0, 2)}***@${domain}` : "***";
};

const appendBusinessMailAudit = async (admin, action, log, status) => {
  if (!admin.id || !mongoose.isValidObjectId(admin.id) || !log?._id) return;
  const entry = {
    action,
    by: admin.id,
    at: new Date(),
    from: {},
    to: {
      emailDeliveryLogId: String(log._id),
      senderProfileKey: log.senderProfileKey,
      recipient: maskEmail(log.recipient),
      status,
    },
    note: "Business Mail activity",
  };
  try {
    await Admin.updateOne(
      { _id: admin.id },
      { $push: { auditLogs: { $each: [entry], $slice: -MAX_AUDIT_ENTRIES } } }
    );
  } catch (error) {
    console.error("Business Mail admin audit write failed", { message: String(error?.message || "").slice(0, 160) });
  }
};

const safeLog = (log) => {
  const record = log?.toObject ? log.toObject() : log || {};
  return {
    id: String(record._id || record.id || ""),
    category: record.category || "",
    senderProfileKey: record.senderProfileKey || "",
    senderName: record.senderName || "",
    senderEmail: record.senderEmail || "",
    replyTo: record.replyTo || "",
    recipient: record.recipient || "",
    ccRecipients: Array.isArray(record.ccRecipients) ? record.ccRecipients : [],
    bccRecipientCount: Array.isArray(record.bccRecipients) ? record.bccRecipients.length : 0,
    attachments: Array.isArray(record.attachments) ? record.attachments : [],
    subject: record.subject || "",
    provider: record.provider || "",
    providerMessageId: record.providerMessageId || "",
    status: record.status || "",
    requestedByAdmin: {
      id: String(record.requestedByAdmin?._id || record.requestedByAdmin || ""),
      name: record.requestedByAdminName || record.requestedByAdmin?.name || "",
      email: record.requestedByAdminEmail || "",
      role: record.requestedByAdminRole || "",
    },
    failureCode: record.failureCode || "",
    failureMessage: String(record.failureMessage || "").slice(0, 500),
    metadata: {
      source: record.metadata?.source || "",
      correlationId: record.metadata?.correlationId || "",
    },
    createdAt: record.createdAt || null,
    sentAt: record.sentAt || null,
    failedAt: record.failedAt || null,
  };
};

const hashIdempotencyKey = (value) => crypto.createHash("sha256").update(value).digest("hex");

const findIdempotencyLog = (adminId, hash) =>
  EmailDeliveryLog.findOne({ requestedByAdmin: adminId, idempotencyKeyHash: hash })
    .select("+idempotencyKeyHash")
    .lean();

const respondForExistingIdempotency = (res, existing) => {
  if (["REQUESTED", "PROCESSING"].includes(existing.status)) {
    return res.status(409).json({
      success: false,
      code: BUSINESS_MAIL_ERROR_CODES.IDEMPOTENCY_CONFLICT,
      msg: "A Business Mail send with this idempotency key is already processing.",
    });
  }
  if (existing.status === "SENT") {
    return res.status(200).json({
      success: true,
      message: "Business email was already sent for this idempotency key.",
      idempotentReplay: true,
      delivery: safeLog(existing),
    });
  }
  return res.status(409).json({
    success: false,
    code: BUSINESS_MAIL_ERROR_CODES.IDEMPOTENCY_CONFLICT,
    msg: "The previous Business Mail attempt failed. Use a new idempotency key for another attempt.",
    delivery: {
      id: String(existing._id || ""),
      status: "FAILED",
      failureCode: existing.failureCode || "BUSINESS_MAIL_SEND_FAILED",
    },
  });
};

const createProcessingLog = async ({ mail, profile, provider, admin, idempotencyKeyHash }) => {
  try {
    const log = await EmailDeliveryLog.create({
      category: mail.category,
      senderProfileKey: profile.key,
      senderName: profile.sender.name,
      senderEmail: profile.sender.email,
      replyTo: profile.replyTo?.email || "",
      recipient: mail.to,
      ccRecipients: mail.cc,
      bccRecipients: mail.bcc,
      attachments: mail.attachments.map(({ filename, contentType, size }) => ({ filename, contentType, size })),
      subject: mail.subject,
      provider,
      status: "PROCESSING",
      requestedByAdmin: admin.id,
      requestedByAdminName: admin.name,
      requestedByAdminEmail: admin.email,
      requestedByAdminRole: admin.role,
      metadata: mail.metadata,
      ...(idempotencyKeyHash ? { idempotencyKeyHash } : {}),
    });
    return { log, existing: null };
  } catch (error) {
    if (error?.code === 11000 && idempotencyKeyHash) {
      const existing = await findIdempotencyLog(admin.id, idempotencyKeyHash);
      if (existing) return { log: null, existing };
    }
    throw error;
  }
};

export const previewBusinessMailMessage = async (req, res) => {
  try {
    const mail = validateBusinessMailPreviewPayload(req.body);
    if (!getBusinessMailSenderProfile(mail.senderProfileKey)) {
      throw requestError(BUSINESS_MAIL_ERROR_CODES.UNKNOWN_SENDER_PROFILE, "Unknown Business Mail sender profile.");
    }
    await assertBusinessMailSenderAccess(getAdminContext(req), mail.senderProfileKey);
    const finalContent = appendBusinessMailSignature(mail);
    return res.json({
      preview: {
        senderProfileKey: mail.senderProfileKey,
        text: finalContent.text,
        html: finalContent.html,
        signatureGroup: finalContent.signature?.group || "",
      },
    });
  } catch (error) {
    return sendMappedError(res, error);
  }
};

export const getBusinessMailStatus = async (req, res) => {
  try {
    const admin = getAdminContext(req);
    const providerStatus = getBusinessMailProviderStatus();
    const authorizedProfiles = await getAuthorizedBusinessMailSenderProfiles(admin);
    return res.json({
      ...providerStatus,
      enabledSenderProfileKeys: authorizedProfiles.map((profile) => profile.key),
      canManageSenderAccess: isBusinessMailMasterAdmin(admin),
      capabilities: {
        singleRecipient: true,
        plainText: true,
        html: true,
        cc: true,
        bcc: true,
        attachments: true,
        bulk: false,
        scheduling: false,
      },
    });
  } catch (error) {
    return sendMappedError(res, error);
  }
};

export const getBusinessMailSenderProfiles = async (req, res) => {
  try {
    const profiles = (await getAuthorizedBusinessMailSenderProfiles(getAdminContext(req)))
      .map((profile) => ({
        key: profile.key,
        name: profile.sender.name,
        email: profile.sender.email,
        replyTo: profile.replyTo?.email || "",
        enabled: true,
        replyCapable: profile.replyCapable,
      }));
    return res.json({ profiles });
  } catch (error) {
    return sendMappedError(res, error);
  }
};

const safeBusinessMailAccess = (admin = {}) => {
  const allowedRestrictedSenderProfiles = normalizeBusinessMailSenderProfileKeys(
    admin.businessMailAccess?.allowedRestrictedSenderProfiles
      || admin.businessMailAccess?.allowedSenderProfiles
      || [],
    { rejectUnknown: false }
  ).filter((key) => !BUSINESS_MAIL_COMMON_SENDER_PROFILE_KEYS.includes(key));
  return {
    enabled: admin.businessMailAccess?.enabled === true,
    allowedRestrictedSenderProfiles,
    allowedSenderProfiles: allowedRestrictedSenderProfiles,
    approvedBy: String(admin.businessMailAccess?.approvedBy?._id || admin.businessMailAccess?.approvedBy || ""),
    approvedAt: admin.businessMailAccess?.approvedAt || null,
  };
};

export const getBusinessMailSenderAccessManagement = async (req, res) => {
  try {
    const masterEmail = getBusinessMailMasterAdminEmail();
    const adminFilter = masterEmail ? { email: { $ne: masterEmail } } : {};
    const admins = await Admin.find(adminFilter)
      .select("_id name email role status businessMailAccess")
      .sort({ name: 1, email: 1 })
      .lean();
    const globallyEnabledProfiles = getGloballyEnabledBusinessMailSenderProfiles();
    const commonSenderProfiles = globallyEnabledProfiles
      .filter((profile) => BUSINESS_MAIL_COMMON_SENDER_PROFILE_KEYS.includes(profile.key))
      .map((profile) => ({
        key: profile.key,
        name: profile.sender.name,
        email: profile.sender.email,
      }));
    const safeProfile = (profile) => ({
      key: profile.key,
      name: profile.sender.name,
      email: profile.sender.email,
      enabled: profile.enabled === true,
    });
    const masterSenderProfiles = globallyEnabledProfiles.map(safeProfile);
    return res.json({
      commonSenderProfiles,
      masterSenderProfiles,
      restrictedSenderProfiles: [],
      senderProfiles: [],
      assignmentPolicy: "LOGIN_EMAIL_MATCH",
      admins: admins.map((admin) => {
        const summary = getBusinessMailSenderAccessSummary(admin);
        return {
          id: String(admin._id),
          name: admin.name || "",
          email: admin.email || "",
          role: admin.role || "",
          status: admin.status || "",
          businessMailAccess: {
            ...safeBusinessMailAccess(admin),
            authoritative: false,
          },
          businessMailEligible: summary.businessMailEligible,
          matchingPersonalSenderProfile: summary.matchingPersonalSenderProfile
            ? safeProfile(summary.matchingPersonalSenderProfile)
            : null,
          personalSenderAvailable: summary.personalSenderAvailable,
          personalSenderReason: summary.personalSenderReason,
          effectiveSenderProfiles: summary.effectiveSenderProfiles.map(safeProfile),
          effectiveSenderCount: summary.effectiveSenderCount,
        };
      }),
    });
  } catch (error) {
    return sendMappedError(res, error);
  }
};

export const updateBusinessMailSenderAccess = (req, res) => {
  return res.status(409).json({
    success: false,
    code: BUSINESS_MAIL_ERROR_CODES.INVALID_REQUEST,
    msg: "Per-admin sender assignments are deprecated. Sender access is derived from the controlled profile registry and authenticated login email.",
  });
};

export const sendBusinessMailMessage = async (req, res) => {
  let deliveryLog = null;
  const admin = getAdminContext(req);
  try {
    const mail = validateBusinessMailRequestPayload(req.body);
    const configuredProfile = getBusinessMailSenderProfile(mail.senderProfileKey);
    if (!configuredProfile) {
      throw requestError(BUSINESS_MAIL_ERROR_CODES.UNKNOWN_SENDER_PROFILE, "Unknown Business Mail sender profile.");
    }
    const profile = await assertBusinessMailSenderAccess(admin, mail.senderProfileKey);
    const finalContent = appendBusinessMailSignature(mail);
    const providerStatus = getBusinessMailProviderStatus();
    const idempotencyKeyHash = mail.idempotencyKey ? hashIdempotencyKey(mail.idempotencyKey) : "";
    if (idempotencyKeyHash) {
      const existing = await findIdempotencyLog(admin.id, idempotencyKeyHash);
      if (existing) return respondForExistingIdempotency(res, existing);
    }

    const created = await createProcessingLog({
      mail,
      profile,
      provider: providerStatus.provider,
      admin,
      idempotencyKeyHash,
    });
    if (created.existing) return respondForExistingIdempotency(res, created.existing);
    deliveryLog = created.log;
    await appendBusinessMailAudit(admin, "BUSINESS_MAIL_SEND_REQUESTED", deliveryLog, "PROCESSING");

    const result = await sendBusinessMail(
      {
        senderProfileKey: mail.senderProfileKey,
        to: mail.to,
        cc: mail.cc,
        bcc: mail.bcc,
        subject: mail.subject,
        text: finalContent.text,
        html: finalContent.html,
        attachments: mail.attachments,
        category: mail.category,
        metadata: mail.metadata,
        ...(mail.idempotencyKey ? { idempotencyKey: mail.idempotencyKey } : {}),
        requestedByAdmin: admin.id,
      },
      { skipDeliveryLog: true }
    );

    const sentAt = new Date(result.sentAt || Date.now());
    try {
      await EmailDeliveryLog.findByIdAndUpdate(deliveryLog._id, {
        $set: {
          status: "SENT",
          providerMessageId: String(result.providerMessageId || ""),
          sentAt,
          failedAt: null,
          failureCode: "",
          failureMessage: "",
        },
      });
    } catch (error) {
      console.error("Business Mail SENT log update failed after provider acceptance", {
        deliveryLogId: String(deliveryLog._id),
        message: String(error?.message || "").slice(0, 160),
      });
    }
    deliveryLog.status = "SENT";
    deliveryLog.providerMessageId = String(result.providerMessageId || "");
    deliveryLog.sentAt = sentAt;
    await appendBusinessMailAudit(admin, "BUSINESS_MAIL_SENT", deliveryLog, "SENT");

    return res.status(200).json({
      success: true,
      message: "Business email sent successfully.",
      delivery: {
        id: String(deliveryLog._id),
        status: "SENT",
        provider: result.provider,
        providerMessageId: String(result.providerMessageId || ""),
        senderProfileKey: mail.senderProfileKey,
        recipient: mail.to,
        sentAt: sentAt.toISOString(),
      },
    });
  } catch (error) {
    if (deliveryLog?._id) {
      const safeFailure = isBusinessMailError(error)
        ? error
        : requestError(BUSINESS_MAIL_ERROR_CODES.SEND_FAILED, "Business Mail send failed.");
      const failedAt = new Date();
      try {
        await EmailDeliveryLog.findByIdAndUpdate(deliveryLog._id, {
          $set: {
            status: "FAILED",
            failureCode: safeFailure.code,
            failureMessage: String(safeFailure.message || "Business Mail send failed.").slice(0, 500),
            failedAt,
          },
        });
      } catch (logError) {
        console.error("Business Mail FAILED log update failed", {
          deliveryLogId: String(deliveryLog._id),
          message: String(logError?.message || "").slice(0, 160),
        });
      }
      deliveryLog.status = "FAILED";
      await appendBusinessMailAudit(admin, "BUSINESS_MAIL_FAILED", deliveryLog, "FAILED");
    }
    return sendMappedError(res, error);
  }
};

const queryString = (value, field) => {
  if (value === undefined) return "";
  if (typeof value !== "string") throw requestError(BUSINESS_MAIL_ERROR_CODES.INVALID_REQUEST, `${field} is invalid.`);
  return value.trim();
};

const parsePageNumber = (value, fallback, max = Number.MAX_SAFE_INTEGER) => {
  if (value === undefined || value === "") return fallback;
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    throw requestError(BUSINESS_MAIL_ERROR_CODES.INVALID_REQUEST, "Pagination values must be positive integers.");
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw requestError(BUSINESS_MAIL_ERROR_CODES.INVALID_REQUEST, "Pagination values must be positive integers.");
  }
  return Math.min(parsed, max);
};

const parseIsoDate = (value, field) => {
  const raw = queryString(value, field);
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/.test(raw)) {
    throw requestError(BUSINESS_MAIL_ERROR_CODES.INVALID_REQUEST, `${field} must be an ISO date.`);
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) throw requestError(BUSINESS_MAIL_ERROR_CODES.INVALID_REQUEST, `${field} must be an ISO date.`);
  return date;
};

const buildLogQuery = (req) => {
  const query = {};
  const status = queryString(req.query.status, "status").toUpperCase();
  const provider = queryString(req.query.provider, "provider").toLowerCase();
  const senderProfileKey = queryString(req.query.senderProfileKey, "senderProfileKey").toUpperCase();
  const category = queryString(req.query.category, "category").toUpperCase();
  const recipient = queryString(req.query.recipient, "recipient").toLowerCase();
  if (status && !STATUS_SET.has(status)) throw requestError(BUSINESS_MAIL_ERROR_CODES.INVALID_REQUEST, "Invalid status filter.");
  if (provider && !PROVIDER_SET.has(provider)) throw requestError(BUSINESS_MAIL_ERROR_CODES.INVALID_REQUEST, "Invalid provider filter.");
  if (senderProfileKey && !getBusinessMailSenderProfile(senderProfileKey)) {
    throw requestError(BUSINESS_MAIL_ERROR_CODES.INVALID_REQUEST, "Invalid sender profile filter.");
  }
  if (category && !CATEGORY_SET.has(category)) throw requestError(BUSINESS_MAIL_ERROR_CODES.INVALID_REQUEST, "Invalid category filter.");
  if (recipient.length > 320 || HEADER_BREAK_PATTERN.test(recipient)) {
    throw requestError(BUSINESS_MAIL_ERROR_CODES.INVALID_REQUEST, "Invalid recipient filter.");
  }
  if (status) query.status = status;
  if (provider) query.provider = provider;
  if (senderProfileKey) query.senderProfileKey = senderProfileKey;
  if (category) query.category = category;
  if (recipient) query.recipient = { $regex: recipient.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };

  const fromDate = parseIsoDate(req.query.fromDate, "fromDate");
  const toDate = parseIsoDate(req.query.toDate, "toDate");
  if (fromDate && toDate && fromDate > toDate) {
    throw requestError(BUSINESS_MAIL_ERROR_CODES.INVALID_REQUEST, "fromDate must not be after toDate.");
  }
  if (fromDate || toDate) query.createdAt = { ...(fromDate ? { $gte: fromDate } : {}), ...(toDate ? { $lte: toDate } : {}) };

  const admin = getAdminContext(req);
  if (admin.role === SALES_ROLE) query.requestedByAdmin = admin.id;
  return query;
};

export const listBusinessMailLogs = async (req, res) => {
  try {
    const page = parsePageNumber(req.query.page, 1);
    const limit = parsePageNumber(req.query.limit, 20, 100);
    const query = buildLogQuery(req);
    const [logs, total] = await Promise.all([
      EmailDeliveryLog.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      EmailDeliveryLog.countDocuments(query),
    ]);
    const items = logs.map(safeLog);
    return res.json({
      logs: items,
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return sendMappedError(res, error);
  }
};

export const getBusinessMailLogById = async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ msg: "Business Mail delivery log not found." });
    }
    const admin = getAdminContext(req);
    const query = { _id: id, ...(admin.role === SALES_ROLE ? { requestedByAdmin: admin.id } : {}) };
    const log = await EmailDeliveryLog.findOne(query).lean();
    if (!log) return res.status(404).json({ msg: "Business Mail delivery log not found." });
    await appendBusinessMailAudit(admin, "BUSINESS_MAIL_LOG_VIEWED", log, log.status);
    return res.json({ log: safeLog(log) });
  } catch (error) {
    return sendMappedError(res, error);
  }
};
