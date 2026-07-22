import mongoose from "mongoose";
import EmailDeliveryLog from "../../models/EmailDeliveryLog.js";
import {
  BUSINESS_MAIL_ERROR_CODES,
  BusinessMailError,
  isBusinessMailError,
} from "./businessMailErrors.js";
import {
  getBusinessMailSenderProfile,
  listBusinessMailSenderProfiles,
} from "./senderProfiles.js";
import { appendBusinessMailSignature } from "./businessMailSignatures.js";
import BrevoBusinessMailProvider from "./providers/BrevoBusinessMailProvider.js";
import SmtpBusinessMailProvider from "./providers/SmtpBusinessMailProvider.js";

const EMAIL_PATTERN = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;
const HEADER_BREAK_PATTERN = /[\r\n]/;
const ALLOWED_METADATA_KEYS = new Set(["source", "correlationId"]);
const FORBIDDEN_CALLER_KEYS = new Set(["sender", "from", "provider", "credentials", "smtp", "smtpConfig", "apiKey"]);

const providers = Object.freeze({
  brevo_api: new BrevoBusinessMailProvider(),
  smtp: new SmtpBusinessMailProvider(),
});

const getConfiguredProviderName = () => {
  const configured = String(process.env.BUSINESS_MAIL_PROVIDER || "brevo_api").trim().toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(providers, configured)) {
    throw new BusinessMailError(
      BUSINESS_MAIL_ERROR_CODES.PROVIDER_UNSUPPORTED,
      "Configured Business Mail provider is unsupported."
    );
  }
  return configured;
};

const assertNoHeaderBreaks = (value, code, message) => {
  if (HEADER_BREAK_PATTERN.test(String(value || ""))) throw new BusinessMailError(code, message);
};

const normalizeEmail = (value, code = BUSINESS_MAIL_ERROR_CODES.INVALID_RECIPIENT) => {
  if (typeof value !== "string") {
    throw new BusinessMailError(code, "A single valid email address is required.");
  }
  assertNoHeaderBreaks(value, code, "Email addresses cannot contain line breaks.");
  const email = value.trim().toLowerCase();
  if (!email || email.length > 320 || !EMAIL_PATTERN.test(email)) {
    throw new BusinessMailError(code, "A single valid email address is required.");
  }
  return email;
};

const normalizeOptionalContent = (value, field) => {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") {
    throw new BusinessMailError(
      BUSINESS_MAIL_ERROR_CODES.INVALID_CONTENT,
      `${field} content must be a string.`
    );
  }
  return value.trim();
};

const normalizeMetadata = (metadata) => {
  if (metadata === undefined || metadata === null) return {};
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    throw new BusinessMailError(
      BUSINESS_MAIL_ERROR_CODES.INVALID_REQUEST,
      "Business Mail metadata must be a controlled object."
    );
  }
  const unknownKeys = Object.keys(metadata).filter((key) => !ALLOWED_METADATA_KEYS.has(key));
  if (unknownKeys.length) {
    throw new BusinessMailError(
      BUSINESS_MAIL_ERROR_CODES.INVALID_REQUEST,
      "Business Mail metadata contains unsupported fields."
    );
  }
  return {
    source: String(metadata.source || "").trim().slice(0, 80),
    correlationId: String(metadata.correlationId || "").trim().slice(0, 128),
  };
};

const normalizeRequestedByAdmin = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const id = String(value).trim();
  if (!mongoose.isValidObjectId(id)) {
    throw new BusinessMailError(
      BUSINESS_MAIL_ERROR_CODES.INVALID_REQUEST,
      "requestedByAdmin must be a valid admin identifier."
    );
  }
  return id;
};

const validateRequest = (request) => {
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    throw new BusinessMailError(
      BUSINESS_MAIL_ERROR_CODES.INVALID_REQUEST,
      "Business Mail request must be an object."
    );
  }
  for (const key of FORBIDDEN_CALLER_KEYS) {
    if (Object.prototype.hasOwnProperty.call(request, key)) {
      throw new BusinessMailError(
        BUSINESS_MAIL_ERROR_CODES.INVALID_REQUEST,
        "Sender and provider configuration cannot be supplied by callers."
      );
    }
  }
  if (Object.prototype.hasOwnProperty.call(request, "cc")) {
    throw new BusinessMailError(BUSINESS_MAIL_ERROR_CODES.UNSUPPORTED_CC, "CC is not supported in Phase 4A.");
  }
  if (Object.prototype.hasOwnProperty.call(request, "bcc")) {
    throw new BusinessMailError(BUSINESS_MAIL_ERROR_CODES.UNSUPPORTED_BCC, "BCC is not supported in Phase 4A.");
  }
  if (Object.prototype.hasOwnProperty.call(request, "attachments")) {
    throw new BusinessMailError(
      BUSINESS_MAIL_ERROR_CODES.UNSUPPORTED_ATTACHMENTS,
      "Attachments are not supported in Phase 4A."
    );
  }
  if (Array.isArray(request.to)) {
    throw new BusinessMailError(
      BUSINESS_MAIL_ERROR_CODES.INVALID_RECIPIENT,
      "Business Mail supports exactly one recipient in Phase 4A."
    );
  }

  const senderProfileKey = String(request.senderProfileKey || "").trim().toUpperCase();
  const profile = getBusinessMailSenderProfile(senderProfileKey);
  if (!profile) {
    throw new BusinessMailError(
      BUSINESS_MAIL_ERROR_CODES.UNKNOWN_SENDER_PROFILE,
      "Unknown Business Mail sender profile."
    );
  }
  if (!profile.enabled) {
    throw new BusinessMailError(
      BUSINESS_MAIL_ERROR_CODES.SENDER_DISABLED,
      "Business Mail sender profile is disabled."
    );
  }

  const to = normalizeEmail(request.to);
  const senderEmail = normalizeEmail(profile.sender.email, BUSINESS_MAIL_ERROR_CODES.INVALID_REQUEST);
  const senderName = String(profile.sender.name || "").trim();
  assertNoHeaderBreaks(
    senderName,
    BUSINESS_MAIL_ERROR_CODES.INVALID_REQUEST,
    "Sender display name cannot contain line breaks."
  );
  if (!senderName || senderName.length > 100) {
    throw new BusinessMailError(
      BUSINESS_MAIL_ERROR_CODES.INVALID_REQUEST,
      "Sender display name must contain 1 to 100 characters."
    );
  }
  const replyToEmail = profile.replyTo?.email
    ? normalizeEmail(profile.replyTo.email, BUSINESS_MAIL_ERROR_CODES.INVALID_REQUEST)
    : "";
  const subject = typeof request.subject === "string" ? request.subject.trim() : "";
  assertNoHeaderBreaks(subject, BUSINESS_MAIL_ERROR_CODES.INVALID_SUBJECT, "Subject cannot contain line breaks.");
  if (!subject || subject.length > 200) {
    throw new BusinessMailError(
      BUSINESS_MAIL_ERROR_CODES.INVALID_SUBJECT,
      "Business Mail subject must contain 1 to 200 characters."
    );
  }
  const text = normalizeOptionalContent(request.text, "Plain-text");
  const html = normalizeOptionalContent(request.html, "HTML");
  if (!text && !html) {
    throw new BusinessMailError(
      BUSINESS_MAIL_ERROR_CODES.INVALID_CONTENT,
      "Business Mail requires plain-text or HTML content."
    );
  }
  if (request.idempotencyKey !== undefined) {
    const key = String(request.idempotencyKey || "").trim();
    assertNoHeaderBreaks(key, BUSINESS_MAIL_ERROR_CODES.INVALID_REQUEST, "Idempotency key cannot contain line breaks.");
    if (!key || key.length > 128) {
      throw new BusinessMailError(
        BUSINESS_MAIL_ERROR_CODES.INVALID_REQUEST,
        "Idempotency key must contain 1 to 128 characters."
      );
    }
  }

  return {
    senderProfileKey,
    sender: { name: senderName, email: senderEmail },
    replyTo: replyToEmail ? { email: replyToEmail } : null,
    to,
    subject,
    text,
    html,
    idempotencyKey: request.idempotencyKey ? String(request.idempotencyKey).trim() : "",
    metadata: normalizeMetadata(request.metadata),
    category: String(request.category || "BUSINESS_MAIL").trim().slice(0, 80) || "BUSINESS_MAIL",
    requestedByAdmin: normalizeRequestedByAdmin(request.requestedByAdmin),
  };
};

const createDeliveryLog = async (mail, provider) => {
  if (mongoose.connection.readyState !== 1) return null;
  try {
    return await EmailDeliveryLog.create({
      category: mail.category,
      senderProfileKey: mail.senderProfileKey,
      senderName: mail.sender.name,
      senderEmail: mail.sender.email,
      replyTo: mail.replyTo?.email || "",
      recipient: mail.to,
      subject: mail.subject,
      provider,
      status: "REQUESTED",
      requestedByAdmin: mail.requestedByAdmin,
      metadata: mail.metadata,
    });
  } catch (error) {
    console.error("Business Mail delivery log create failed", { message: String(error?.message || "").slice(0, 200) });
    return null;
  }
};

const updateDeliveryLog = async (log, update) => {
  if (!log) return;
  try {
    Object.assign(log, update);
    await log.save();
  } catch (error) {
    console.error("Business Mail delivery log update failed", { message: String(error?.message || "").slice(0, 200) });
  }
};

export const sendBusinessMail = async (request, options = {}) => {
  const validatedMail = validateRequest(request);
  const signedContent = appendBusinessMailSignature(validatedMail);
  const mail = { ...validatedMail, text: signedContent.text, html: signedContent.html };
  const providerName = getConfiguredProviderName();
  const provider = providers[providerName];
  if (!provider.isConfigured()) {
    throw new BusinessMailError(
      BUSINESS_MAIL_ERROR_CODES.PROVIDER_NOT_CONFIGURED,
      "Configured Business Mail provider is not ready."
    );
  }
  const deliveryLog = options.skipDeliveryLog === true ? null : await createDeliveryLog(mail, providerName);

  try {
    const result = await provider.send(mail);
    const normalizedResult = {
      success: Boolean(result.success),
      provider: providerName,
      providerMessageId: String(result.providerMessageId || ""),
      accepted: Array.isArray(result.accepted) ? result.accepted : [],
      rejected: Array.isArray(result.rejected) ? result.rejected : [],
      status: String(result.status || "SENT"),
      sentAt: String(result.sentAt || new Date().toISOString()),
    };
    await updateDeliveryLog(deliveryLog, {
      providerMessageId: normalizedResult.providerMessageId,
      status: "SENT",
      sentAt: new Date(normalizedResult.sentAt),
    });
    return normalizedResult;
  } catch (error) {
    const safeError = isBusinessMailError(error)
      ? error
      : new BusinessMailError(BUSINESS_MAIL_ERROR_CODES.SEND_FAILED, "Business Mail send failed.");
    await updateDeliveryLog(deliveryLog, {
      status: "FAILED",
      failureCode: safeError.code,
      failureMessage: String(safeError.message || "Business Mail send failed.").slice(0, 500),
    });
    throw safeError;
  }
};

export const listEnabledSenderProfiles = () =>
  listBusinessMailSenderProfiles()
    .filter((profile) => profile.enabled)
    .map((profile) => ({
      key: profile.key,
      name: profile.sender.name,
      email: profile.sender.email,
      replyTo: profile.replyTo?.email || "",
      replyCapable: profile.replyCapable,
    }));

export const getBusinessMailProviderStatus = () => {
  const providerName = getConfiguredProviderName();
  return {
    provider: providerName,
    configured: providers[providerName].isConfigured(),
    enabledSenderProfileKeys: listEnabledSenderProfiles().map((profile) => profile.key),
  };
};
