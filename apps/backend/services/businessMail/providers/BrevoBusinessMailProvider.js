import {
  BUSINESS_MAIL_ERROR_CODES,
  BusinessMailError,
  isBusinessMailError,
} from "../businessMailErrors.js";

const DEFAULT_TIMEOUT_MS = 15000;
const MIN_TIMEOUT_MS = 1000;
const MAX_TIMEOUT_MS = 60000;

const getTimeoutMs = () => {
  const configured = Number(process.env.BUSINESS_MAIL_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  if (!Number.isFinite(configured)) return DEFAULT_TIMEOUT_MS;
  return Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, configured));
};

const safeProviderCode = (value = "") =>
  String(value || "")
    .replace(/[^a-z0-9_.-]/gi, "")
    .slice(0, 80);

export default class BrevoBusinessMailProvider {
  name = "brevo_api";

  isConfigured() {
    return Boolean(String(process.env.BREVO_API_KEY || "").trim());
  }

  async send({ sender, replyTo, to, subject, text, html }) {
    if (!this.isConfigured()) {
      throw new BusinessMailError(
        BUSINESS_MAIL_ERROR_CODES.PROVIDER_NOT_CONFIGURED,
        "Brevo Business Mail provider is not configured."
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), getTimeoutMs());

    try {
      const payload = {
        sender,
        to: [{ email: to }],
        subject,
        ...(text ? { textContent: text } : {}),
        ...(html ? { htmlContent: html } : {}),
        ...(replyTo?.email ? { replyTo } : {}),
      };
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": process.env.BREVO_API_KEY,
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        const providerCode = safeProviderCode(body?.code);
        const suffix = providerCode ? ` (${providerCode})` : "";
        throw new BusinessMailError(
          BUSINESS_MAIL_ERROR_CODES.PROVIDER_REJECTED,
          `Brevo rejected the Business Mail request with HTTP ${response.status}${suffix}.`
        );
      }

      return {
        success: true,
        provider: this.name,
        providerMessageId: String(body?.messageId || body?.messageIds?.[0] || ""),
        accepted: [to],
        rejected: [],
        status: "SENT",
        sentAt: new Date().toISOString(),
      };
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new BusinessMailError(
          BUSINESS_MAIL_ERROR_CODES.PROVIDER_TIMEOUT,
          "Brevo Business Mail request timed out."
        );
      }
      if (isBusinessMailError(error)) throw error;
      throw new BusinessMailError(
        BUSINESS_MAIL_ERROR_CODES.SEND_FAILED,
        "Brevo Business Mail send failed.",
        { cause: error }
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}

