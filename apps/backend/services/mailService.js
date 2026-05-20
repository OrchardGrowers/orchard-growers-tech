import nodemailer from "nodemailer";

const truthyEnv = (value = "") => ["1", "true", "yes"].includes(String(value).trim().toLowerCase());
const verifiedTransports = new Set();

const PLATFORM_CONFIG = {
  orchardgrowers: {
    brandName: "Orchard Growers",
    userEnv: "ORCHARD_SMTP_USER",
    passEnv: "ORCHARD_SMTP_PASS",
    fromEnv: "ORCHARD_SMTP_FROM",
    resetFromEnv: "ORCHARD_RESET_FROM",
    supportEnv: "ORCHARD_SUPPORT_EMAIL",
  },
  efruitmandi: {
    brandName: "eFruitMandi",
    userEnv: "EFRUITMANDI_SMTP_USER",
    passEnv: "EFRUITMANDI_SMTP_PASS",
    fromEnv: "EFRUITMANDI_SMTP_FROM",
    resetFromEnv: "EFRUITMANDI_RESET_FROM",
    supportEnv: "EFRUITMANDI_SUPPORT_EMAIL",
  },
};

const isProductionLike = () => {
  const runtime = String(process.env.APP_ENV || process.env.NODE_ENV || "").trim().toLowerCase();
  return runtime === "production" || runtime === "staging";
};

const getSafeSmtpErrorDetails = (err = {}) => ({
  code: err.code,
  command: err.command,
  responseCode: err.responseCode,
  response: err.response,
  message: err.message,
});

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

export const normalizeMailPlatform = (platform = "") => {
  const normalized = String(platform || "").trim().toLowerCase();
  if (["efruitmandi", "efruitmandi.live", "efm"].includes(normalized)) return "efruitmandi";
  return "orchardgrowers";
};

const getPlatformSettings = (platform = "orchardgrowers") => {
  const platformKey = normalizeMailPlatform(platform);
  const config = PLATFORM_CONFIG[platformKey];
  const user = process.env[config.userEnv] || (platformKey === "orchardgrowers" ? process.env.SMTP_USER : "");
  const pass = process.env[config.passEnv] || (platformKey === "orchardgrowers" ? process.env.SMTP_PASS : "");
  const from = process.env[config.fromEnv] || (platformKey === "orchardgrowers" ? process.env.SMTP_FROM : "") || user;
  const resetFrom = process.env[config.resetFromEnv] || from;
  const supportEmail = process.env[config.supportEnv] || "";

  return {
    platform: platformKey,
    brandName: config.brandName,
    user,
    pass,
    from,
    resetFrom,
    supportEmail,
  };
};

export const isSmtpConfigured = (platform = "orchardgrowers") => {
  const settings = getPlatformSettings(platform);
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && settings.user && settings.pass && settings.from);
};

export const getMailTransport = ({ platform = "orchardgrowers", purpose = "general" } = {}) => {
  const settings = getPlatformSettings(platform);
  if (!isSmtpConfigured(settings.platform)) return null;

  const port = Number(process.env.SMTP_PORT || 587);
  const from = purpose === "reset" ? settings.resetFrom : settings.from;

  return {
    ...settings,
    from,
    host: process.env.SMTP_HOST,
    port,
    transporter: nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: truthyEnv(process.env.SMTP_SECURE) || port === 465,
      auth: {
        user: settings.user,
        pass: settings.pass,
      },
    }),
  };
};

const verifySmtpForDebug = (mailConfig) => {
  if (!truthyEnv(process.env.SMTP_DEBUG) || isProductionLike()) return;

  const verifyKey = `${mailConfig.platform}:${mailConfig.user}:${mailConfig.host}:${mailConfig.port}`;
  if (verifiedTransports.has(verifyKey)) return;
  verifiedTransports.add(verifyKey);

  mailConfig.transporter
    .verify()
    .then(() => {
      console.log("SMTP debug verify succeeded", {
        platform: mailConfig.platform,
        host: mailConfig.host,
        port: mailConfig.port,
        user: mailConfig.user,
        from: mailConfig.from,
      });
    })
    .catch((err) => {
      console.error("SMTP debug verify failed", {
        platform: mailConfig.platform,
        host: mailConfig.host,
        port: mailConfig.port,
        user: mailConfig.user,
        from: mailConfig.from,
        error: getSafeSmtpErrorDetails(err),
      });
    });
};

const buildOtpEmailHtml = ({ brandName, otp, purpose, supportEmail }) => {
  const safeBrand = escapeHtml(brandName);
  const safePurpose = escapeHtml(purpose || "verification");
  const safeOtp = escapeHtml(otp);
  const safeExpiry = escapeHtml(process.env.OTP_EXPIRY_MINUTES || "5");
  const safeSupport = escapeHtml(supportEmail);

  return `
    <div style="margin:0;padding:0;background:#f6f8f5;font-family:Arial,Helvetica,sans-serif;color:#172118;">
      <div style="max-width:520px;margin:0 auto;padding:24px 16px;">
        <div style="background:#ffffff;border:1px solid #dfe8dc;border-radius:12px;padding:24px;">
          <h1 style="margin:0 0 12px;font-size:22px;line-height:1.25;color:#17351f;">${safeBrand} OTP</h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.5;color:#3d4f3f;">Use this code to complete ${safePurpose}. It expires in ${safeExpiry} minutes.</p>
          <div style="letter-spacing:8px;font-size:30px;font-weight:700;text-align:center;background:#eef7ed;border-radius:10px;padding:16px 12px;color:#163d24;">${safeOtp}</div>
          <p style="margin:18px 0 0;font-size:13px;line-height:1.5;color:#6b776c;">If you did not request this code, you can safely ignore this email.</p>
          ${safeSupport ? `<p style="margin:8px 0 0;font-size:12px;line-height:1.5;color:#879087;">Support: ${safeSupport}</p>` : ""}
        </div>
      </div>
    </div>
  `;
};

const wrapSmtpError = (err) => {
  const error = new Error("SMTP send failed");
  error.code = "SMTP_SEND_FAILED";
  error.smtpCode = err?.code || err?.responseCode;
  error.smtpDetails = getSafeSmtpErrorDetails(err);
  return error;
};

export const sendOtpEmail = async ({ to, otp, purpose = "verification", platform = "orchardgrowers" }) => {
  const mailConfig = getMailTransport({ platform, purpose: purpose === "password reset" ? "reset" : "otp" });
  if (!mailConfig) {
    const error = new Error("SMTP is not configured");
    error.code = "SMTP_NOT_CONFIGURED";
    throw error;
  }

  verifySmtpForDebug(mailConfig);

  try {
    await mailConfig.transporter.sendMail({
      from: mailConfig.from,
      to,
      subject: `Your ${mailConfig.brandName} OTP`,
      text: `Your ${mailConfig.brandName} OTP is ${otp}. It expires in ${process.env.OTP_EXPIRY_MINUTES || 5} minutes. If you did not request this code, ignore this email.`,
      html: buildOtpEmailHtml({
        brandName: mailConfig.brandName,
        otp,
        purpose,
        supportEmail: mailConfig.supportEmail,
      }),
    });
  } catch (err) {
    throw wrapSmtpError(err);
  }
};

export const sendEmail = async ({ to, subject, text, html, platform = "orchardgrowers", purpose = "general" }) => {
  const mailConfig = getMailTransport({ platform, purpose });
  if (!mailConfig) {
    const error = new Error("SMTP is not configured");
    error.code = "SMTP_NOT_CONFIGURED";
    throw error;
  }

  verifySmtpForDebug(mailConfig);

  try {
    await mailConfig.transporter.sendMail({
      from: mailConfig.from,
      to,
      subject,
      text,
      html,
    });
  } catch (err) {
    throw wrapSmtpError(err);
  }
};
