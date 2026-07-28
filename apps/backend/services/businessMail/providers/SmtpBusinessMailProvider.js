import nodemailer from "nodemailer";
import {
  BUSINESS_MAIL_ERROR_CODES,
  BusinessMailError,
  isBusinessMailError,
} from "../businessMailErrors.js";

const truthyEnv = (value = "") => ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
const DEFAULT_TIMEOUT_MS = 15000;

const readSmtpSettings = () => {
  const businessUser = String(process.env.BUSINESS_SMTP_USER || "").trim();
  const businessPass = String(process.env.BUSINESS_SMTP_PASS || "");
  const fallbackUser = String(process.env.SMTP_USER || "").trim();
  const fallbackPass = String(process.env.SMTP_PASS || "");
  const hasBusinessCredentials = Boolean(businessUser && businessPass);
  const hasFallbackCredentials = Boolean(fallbackUser && fallbackPass);
  const portValue = Number(process.env.BUSINESS_SMTP_PORT || process.env.SMTP_PORT || 587);
  const port = Number.isFinite(portValue) && portValue > 0 ? portValue : 587;
  const secureValue = process.env.BUSINESS_SMTP_SECURE ?? process.env.SMTP_SECURE;
  const timeoutValue = Number(process.env.BUSINESS_MAIL_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  const timeout = Number.isFinite(timeoutValue) && timeoutValue >= 1000
    ? Math.min(timeoutValue, 60000)
    : DEFAULT_TIMEOUT_MS;

  return {
    host: String(process.env.BUSINESS_SMTP_HOST || process.env.SMTP_HOST || "").trim(),
    port,
    secure: secureValue === undefined || secureValue === "" ? port === 465 : truthyEnv(secureValue),
    user: hasBusinessCredentials ? businessUser : hasFallbackCredentials ? fallbackUser : "",
    pass: hasBusinessCredentials ? businessPass : hasFallbackCredentials ? fallbackPass : "",
    timeout,
  };
};

const normalizeAddressList = (value) =>
  (Array.isArray(value) ? value : value ? [value] : [])
    .map((entry) => String(entry?.address || entry || "").trim().toLowerCase())
    .filter(Boolean);

export default class SmtpBusinessMailProvider {
  name = "smtp";

  isConfigured() {
    const settings = readSmtpSettings();
    return Boolean(settings.host && settings.user && settings.pass);
  }

  async send({ sender, replyTo, to, cc = [], bcc = [], subject, text, html, attachments = [] }) {
    const settings = readSmtpSettings();
    if (!settings.host || !settings.user || !settings.pass) {
      throw new BusinessMailError(
        BUSINESS_MAIL_ERROR_CODES.PROVIDER_NOT_CONFIGURED,
        "SMTP Business Mail provider is not configured."
      );
    }

    const transporter = nodemailer.createTransport({
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      requireTLS: settings.port === 587,
      auth: { user: settings.user, pass: settings.pass },
      connectionTimeout: settings.timeout,
      greetingTimeout: settings.timeout,
      socketTimeout: Math.max(settings.timeout, 30000),
      logger: false,
      debug: false,
    });

    try {
      const info = await transporter.sendMail({
        from: { name: sender.name, address: sender.email },
        ...(replyTo?.email ? { replyTo: { name: replyTo.name || "", address: replyTo.email } } : {}),
        to,
        ...(cc.length ? { cc } : {}),
        ...(bcc.length ? { bcc } : {}),
        subject,
        ...(text ? { text } : {}),
        ...(html ? { html } : {}),
        ...(attachments.length ? {
          attachments: attachments.map((item) => ({
            filename: item.filename,
            content: Buffer.from(item.content, "base64"),
            contentType: item.contentType,
          })),
        } : {}),
      });
      const accepted = normalizeAddressList(info?.accepted);
      const rejected = normalizeAddressList(info?.rejected);

      const expectedRecipients = [to, ...cc, ...bcc];
      if (!accepted.includes(to) || expectedRecipients.some((email) => rejected.includes(email))) {
        throw new BusinessMailError(
          BUSINESS_MAIL_ERROR_CODES.PROVIDER_REJECTED,
          "SMTP provider rejected the Business Mail recipient."
        );
      }

      return {
        success: true,
        provider: this.name,
        providerMessageId: String(info?.messageId || ""),
        accepted,
        rejected,
        status: "SENT",
        sentAt: new Date().toISOString(),
      };
    } catch (error) {
      if (isBusinessMailError(error)) throw error;
      const timeoutCodes = new Set(["ETIMEDOUT", "ESOCKETTIMEDOUT"]);
      if (timeoutCodes.has(error?.code)) {
        throw new BusinessMailError(
          BUSINESS_MAIL_ERROR_CODES.PROVIDER_TIMEOUT,
          "SMTP Business Mail request timed out."
        );
      }
      throw new BusinessMailError(
        BUSINESS_MAIL_ERROR_CODES.SEND_FAILED,
        "SMTP Business Mail send failed.",
        { cause: error }
      );
    } finally {
      transporter.close();
    }
  }
}
