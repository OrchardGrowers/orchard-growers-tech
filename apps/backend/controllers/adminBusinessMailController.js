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
  listBusinessMailSenderProfiles,
} from "../services/businessMail/senderProfiles.js";
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
  "senderProfileKey", "to", "subject", "text", "html", "category", "metadata", "idempotencyKey",
]);
const METADATA_FIELDS = new Set(["source", "correlationId"]);
const HEADER_BREAK_PATTERN = /[\r\n]/;
const EMAIL_PATTERN = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;
const SALES_ROLE = "SALES_EXECUTIVE";
const MAX_AUDIT_ENTRIES = 200;

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
  const subject = boundedString(body.subject, "subject", 200, { required: true, headerSafe: true });
  const text = boundedString(body.text, "text", 100000);
  const html = boundedString(body.html, "html", 150000);
  if (!text && !html) {
    throw requestError(BUSINESS_MAIL_ERROR_CODES.INVALID_CONTENT, "Plain-text or HTML content is required.");
  }
  if (html) validateBusinessMailHtml(html);

  const category = boundedString(body.category || "GENERAL", "category", 50, { required: true, headerSafe: true }).toUpperCase();
  if (!CATEGORY_SET.has(category)) {
    throw requestError(BUSINESS_MAIL_ERROR_CODES.INVALID_REQUEST, "Unsupported Business Mail category.");
  }
  const idempotencyKey = boundedString(body.idempotencyKey, "idempotencyKey", 128, { headerSafe: true });

  return {
    senderProfileKey,
    to,
    subject,
    text,
    html,
    category,
    metadata: validateMetadata(body.metadata),
    idempotencyKey,
  };
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
    subject: record.subject || "",
    provider: record.provider || "",
    providerMessageId: record.providerMessageId || "",
    status: record.status || "",
    requestedByAdmin: {
      id: String(record.requestedByAdmin?._id || record.requestedByAdmin || ""),
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
      subject: mail.subject,
      provider,
      status: "PROCESSING",
      requestedByAdmin: admin.id,
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

export const getBusinessMailStatus = async (_req, res) => {
  try {
    return res.json({
      ...getBusinessMailProviderStatus(),
      capabilities: {
        singleRecipient: true,
        plainText: true,
        html: true,
        cc: false,
        bcc: false,
        attachments: false,
        bulk: false,
        scheduling: false,
      },
    });
  } catch (error) {
    return sendMappedError(res, error);
  }
};

export const getBusinessMailSenderProfiles = async (req, res) => {
  const admin = getAdminContext(req);
  const profiles = listBusinessMailSenderProfiles()
    .filter((profile) => admin.role === "SUPER_ADMIN" || profile.enabled)
    .map((profile) => ({
      key: profile.key,
      name: profile.sender.name,
      email: profile.sender.email,
      replyTo: profile.replyTo?.email || "",
      enabled: profile.enabled,
      replyCapable: profile.replyCapable,
    }));
  return res.json({ profiles });
};

export const sendBusinessMailMessage = async (req, res) => {
  let deliveryLog = null;
  const admin = getAdminContext(req);
  try {
    const mail = validateBusinessMailRequestPayload(req.body);
    const profile = getBusinessMailSenderProfile(mail.senderProfileKey);
    if (!profile) {
      throw requestError(BUSINESS_MAIL_ERROR_CODES.UNKNOWN_SENDER_PROFILE, "Unknown Business Mail sender profile.");
    }
    if (!profile.enabled) {
      throw requestError(BUSINESS_MAIL_ERROR_CODES.SENDER_DISABLED, "Business Mail sender profile is disabled.");
    }
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
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
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
  if (status && !STATUS_SET.has(status)) throw requestError(BUSINESS_MAIL_ERROR_CODES.INVALID_REQUEST, "Invalid status filter.");
  if (provider && !PROVIDER_SET.has(provider)) throw requestError(BUSINESS_MAIL_ERROR_CODES.INVALID_REQUEST, "Invalid provider filter.");
  if (senderProfileKey && !getBusinessMailSenderProfile(senderProfileKey)) {
    throw requestError(BUSINESS_MAIL_ERROR_CODES.INVALID_REQUEST, "Invalid sender profile filter.");
  }
  if (category && !CATEGORY_SET.has(category)) throw requestError(BUSINESS_MAIL_ERROR_CODES.INVALID_REQUEST, "Invalid category filter.");
  if (status) query.status = status;
  if (provider) query.provider = provider;
  if (senderProfileKey) query.senderProfileKey = senderProfileKey;
  if (category) query.category = category;

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
    return res.json({
      logs: logs.map(safeLog),
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
