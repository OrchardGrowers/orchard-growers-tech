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
  admin: {
    brandName: "Orchard Growers Admin",
    userEnv: "ADMIN_SMTP_USER",
    passEnv: "ADMIN_SMTP_PASS",
    fromEnv: "ADMIN_SMTP_FROM",
    resetFromEnv: "ADMIN_RESET_FROM",
    supportEnv: "ADMIN_SUPPORT_EMAIL",
    fallbackPlatform: "orchardgrowers",
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
const getEmailProvider = () => {
  const configured = String(process.env.EMAIL_PROVIDER || "").trim().toLowerCase();
  return configured === "smtp" ? "smtp" : "brevo_api";
};

const getSafeSmtpErrorDetails = (err = {}) => ({
  code: err.code,
  command: err.command,
  responseCode: err.responseCode,
  message: err.message,
});

const maskSmtpUser = (value = "") => {
  const user = String(value || "").trim();
  if (!user) return "";
  const [name = "", domain = ""] = user.split("@");
  if (!domain) return user.length <= 4 ? "****" : `${user.slice(0, 2)}****${user.slice(-2)}`;
  const visibleName = name.length <= 2 ? `${name.slice(0, 1)}***` : `${name.slice(0, 2)}***${name.slice(-1)}`;
  return `${visibleName}@${domain}`;
};

const maskEmailAddress = (value = "") => {
  const email = String(value || "").trim().toLowerCase();
  const [name = "", domain = ""] = email.split("@");
  if (!domain) return email ? "****" : "";
  return `${name.slice(0, 2)}***@${domain}`;
};

const parseSender = (value = "") => {
  const sender = String(value || "").trim();
  const match = sender.match(/^(.*?)\s*<([^<>@\s]+@[^<>\s]+)>$/);
  if (match) {
    return {
      name: match[1].trim().replace(/^"|"$/g, "") || match[2].trim(),
      email: match[2].trim(),
    };
  }

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sender)) {
    return { name: sender, email: sender };
  }

  return { name: "", email: "" };
};

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

export const normalizeMailPlatform = (platform = "") => {
  const normalized = String(platform || "").trim().toLowerCase();
  if (["admin", "admin-panel", "orchard-admin", "orchardgrowers-admin"].includes(normalized)) return "admin";
  if (["efruitmandi", "efruitmandi.live", "efm"].includes(normalized)) return "efruitmandi";
  return "orchardgrowers";
};

const readEnvValue = (...keys) => {
  for (const key of keys.filter(Boolean)) {
    const value = process.env[key];
    if (String(value || "").trim()) return { value, source: key };
  }
  return { value: "", source: "" };
};

const getPlatformSettings = (platform = "orchardgrowers") => {
  const platformKey = normalizeMailPlatform(platform);
  const config = PLATFORM_CONFIG[platformKey];
  const fallbackConfig = config.fallbackPlatform ? PLATFORM_CONFIG[config.fallbackPlatform] : null;
  const user = readEnvValue(config.userEnv, fallbackConfig?.userEnv, "SMTP_USER");
  const pass = readEnvValue(config.passEnv, fallbackConfig?.passEnv, "SMTP_PASS");
  const from = readEnvValue(config.fromEnv, fallbackConfig?.fromEnv, "SMTP_FROM");
  const resetFrom = readEnvValue(config.resetFromEnv, fallbackConfig?.resetFromEnv);
  const supportEmail = readEnvValue(config.supportEnv, fallbackConfig?.supportEnv);
  const selectedFrom = from.value || "";

  return {
    platform: platformKey,
    brandName: config.brandName,
    user: user.value,
    pass: pass.value,
    from: selectedFrom,
    resetFrom: resetFrom.value || selectedFrom,
    supportEmail: supportEmail.value,
    configSources: {
      user: user.source,
      pass: pass.source,
      from: from.source,
      resetFrom: resetFrom.source || from.source || (user.value ? user.source : ""),
      supportEmail: supportEmail.source,
    },
  };
};

const logSmtpEvent = (level, event, mailConfig, details = {}) => {
  const log = level === "error" ? console.error : console.log;
  log(event, {
    provider: mailConfig.provider,
    platform: mailConfig.platform,
    host: mailConfig.host,
    port: mailConfig.port,
    secure: mailConfig.secure,
    user: maskSmtpUser(mailConfig.user),
    from: mailConfig.from,
    configSources: mailConfig.configSources,
    ...details,
  });
};

export const isSmtpConfigured = (platform = "orchardgrowers") => {
  const settings = getPlatformSettings(platform);
  if (getEmailProvider() === "smtp") {
    return Boolean(process.env.SMTP_HOST && settings.user && settings.pass && settings.from);
  }
  return Boolean(process.env.BREVO_API_KEY && parseSender(settings.from).email);
};

export const getMailTransport = ({ platform = "orchardgrowers", purpose = "general" } = {}) => {
  const settings = getPlatformSettings(platform);
  if (!isSmtpConfigured(settings.platform)) return null;
  const provider = getEmailProvider();
  const from = purpose === "reset" ? settings.resetFrom : settings.from;

  if (provider === "brevo_api") {
    const sender = parseSender(from);
    if (!sender.email) return null;
    const mailConfig = {
      ...settings,
      provider,
      from,
      sender,
      host: "api.brevo.com",
      port: 443,
      secure: true,
    };

    logSmtpEvent("info", "Email provider initialized", mailConfig, {
      smtpConfigName: "BREVO_API_KEY",
      senderEmail: sender.email,
    });

    return mailConfig;
  }

  const host = process.env.SMTP_HOST;
  const configuredPort = Number(process.env.SMTP_PORT || 587);
  const port = Number.isFinite(configuredPort) && configuredPort > 0 ? configuredPort : 587;
  const secure = truthyEnv(process.env.SMTP_SECURE);
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS: true,
    family: 4,
    auth: {
      user: settings.user,
      pass: settings.pass,
    },
    connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 60000,
    tls: {
      rejectUnauthorized: false,
      minVersion: "TLSv1.2",
    },
    logger: false,
    debug: false,
  });

  const mailConfig = {
    ...settings,
    provider,
    from,
    host,
    port,
    secure,
    transporter,
  };

  logSmtpEvent("info", "SMTP transporter initialized", mailConfig, {
    transporterSelected: true,
    smtpConfigName: settings.configSources.user || "SMTP_USER",
  });

  return mailConfig;
};

const verifySmtpForDebug = (mailConfig) => {
  if (mailConfig.provider !== "smtp" || !mailConfig.transporter) return;
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
        secure: mailConfig.secure,
        user: maskSmtpUser(mailConfig.user),
      });
    })
    .catch((err) => {
      console.error("SMTP debug verify failed", {
        platform: mailConfig.platform,
        host: mailConfig.host,
        port: mailConfig.port,
        secure: mailConfig.secure,
        user: maskSmtpUser(mailConfig.user),
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

const wrapBrevoApiError = (err) => {
  const error = new Error("Brevo API send failed");
  error.code = "BREVO_API_SEND_FAILED";
  error.smtpCode = err?.status || err?.responseCode;
  error.smtpDetails = {
    status: err?.status,
    message: err?.message,
    body: err?.body,
  };
  return error;
};

const sendBrevoApiEmail = async ({ mailConfig, to, subject, text, html }) => {
  const sender = mailConfig.sender || parseSender(mailConfig.from);
  const payload = {
    sender,
    to: [{ email: to }],
    subject,
    htmlContent: html || `<p>${escapeHtml(text || "")}</p>`,
    textContent: text || "",
  };

  logSmtpEvent("info", "Brevo API email send start", mailConfig, {
    provider: "brevo_api",
    senderEmail: sender.email,
    to: maskEmailAddress(to),
  });

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": process.env.BREVO_API_KEY,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    logSmtpEvent("error", "Brevo API email send failed", mailConfig, {
      provider: "brevo_api",
      senderEmail: sender.email,
      to: maskEmailAddress(to),
      statusCode: response.status,
      code: body?.code || "BREVO_API_SEND_FAILED",
      message: body?.message || response.statusText,
    });
    throw wrapBrevoApiError({
      status: response.status,
      message: body?.message || response.statusText,
      body: body?.code ? { code: body.code, message: body.message } : {},
    });
  }

  logSmtpEvent("info", "Brevo API email send success", mailConfig, {
    provider: "brevo_api",
    senderEmail: sender.email,
    to: maskEmailAddress(to),
    statusCode: response.status,
    messageId: body?.messageId || body?.messageIds?.[0] || "",
  });
};

const sendSmtpEmail = async ({ mailConfig, to, subject, text, html, kind = "email" }) => {
  verifySmtpForDebug(mailConfig);

  try {
    logSmtpEvent("info", `SMTP ${kind} send start`, mailConfig, {
      to: maskEmailAddress(to),
      smtpConfigName: mailConfig.configSources.user || "SMTP_USER",
    });
    const info = await mailConfig.transporter.sendMail({
      from: mailConfig.from,
      to,
      subject,
      text,
      html,
    });
    logSmtpEvent("info", `SMTP ${kind} send success`, mailConfig, {
      to: maskEmailAddress(to),
      code: info?.responseCode || info?.response || "SMTP_SEND_OK",
    });
  } catch (err) {
    logSmtpEvent("error", `SMTP ${kind} send failed`, mailConfig, {
      to: maskEmailAddress(to),
      code: err?.code || err?.responseCode || "SMTP_SEND_FAILED",
      command: err?.command,
      responseCode: err?.responseCode,
      message: err?.message,
    });
    throw wrapSmtpError(err);
  }
};

export const sendOtpEmail = async ({ to, otp, purpose = "verification", platform = "orchardgrowers" }) => {
  const mailConfig = getMailTransport({ platform, purpose: purpose === "password reset" ? "reset" : "otp" });
  if (!mailConfig) {
    const error = new Error("Email provider is not configured");
    error.code = getEmailProvider() === "smtp" ? "SMTP_NOT_CONFIGURED" : "BREVO_API_NOT_CONFIGURED";
    throw error;
  }

  const subject = `Your ${mailConfig.brandName} OTP`;
  const text = `Your ${mailConfig.brandName} OTP is ${otp}. It expires in ${process.env.OTP_EXPIRY_MINUTES || 5} minutes. If you did not request this code, ignore this email.`;
  const html = buildOtpEmailHtml({
    brandName: mailConfig.brandName,
    otp,
    purpose,
    supportEmail: mailConfig.supportEmail,
  });

  if (mailConfig.provider === "brevo_api") {
    await sendBrevoApiEmail({ mailConfig, to, subject, text, html });
    return;
  }

  await sendSmtpEmail({ mailConfig, to, subject, text, html, kind: "OTP" });
};

export const sendEmail = async ({ to, subject, text, html, platform = "orchardgrowers", purpose = "general" }) => {
  const mailConfig = getMailTransport({ platform, purpose });
  if (!mailConfig) {
    const error = new Error("Email provider is not configured");
    error.code = getEmailProvider() === "smtp" ? "SMTP_NOT_CONFIGURED" : "BREVO_API_NOT_CONFIGURED";
    throw error;
  }

  if (mailConfig.provider === "brevo_api") {
    await sendBrevoApiEmail({ mailConfig, to, subject, text, html });
    return;
  }

  await sendSmtpEmail({ mailConfig, to, subject, text, html, kind: "email" });
};
