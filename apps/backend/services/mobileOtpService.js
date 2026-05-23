const truthyEnv = (value = "") => ["1", "true", "yes"].includes(String(value).trim().toLowerCase());
const MAX_MSG91_ATTEMPTS = Number(process.env.MSG91_ATTEMPT_LOG_LIMIT || 200);
const msg91OtpAttempts = new Map();

const getProvider = () => String(process.env.MOBILE_OTP_PROVIDER || "MSG91").trim().toUpperCase();
const PLATFORM_MSG91_CONFIG = {
  orchardgrowers: {
    authKeyEnv: "ORCHARD_MSG91_AUTH_KEY",
    templateIdEnv: "ORCHARD_MSG91_TEMPLATE_ID",
    senderIdEnv: "ORCHARD_MSG91_SENDER_ID",
  },
  efruitmandi: {
    authKeyEnv: "EFRUITMANDI_MSG91_AUTH_KEY",
    templateIdEnv: "EFRUITMANDI_MSG91_TEMPLATE_ID",
    senderIdEnv: "EFRUITMANDI_MSG91_SENDER_ID",
  },
};

const normalizePlatform = (platform = "") => {
  const normalized = String(platform || "").trim().toLowerCase();
  if (["efruitmandi", "efruitmandi.live", "efm"].includes(normalized)) return "efruitmandi";
  return "orchardgrowers";
};

const getMsg91Settings = (platform = "orchardgrowers") => {
  const platformKey = normalizePlatform(platform);
  const config = PLATFORM_MSG91_CONFIG[platformKey];

  return {
    platform: platformKey,
    authKey: process.env[config.authKeyEnv] || (platformKey === "orchardgrowers" ? process.env.MSG91_AUTH_KEY : ""),
    templateId: process.env[config.templateIdEnv] || (platformKey === "orchardgrowers" ? process.env.MSG91_TEMPLATE_ID : ""),
    senderId: process.env[config.senderIdEnv] || (platformKey === "orchardgrowers" ? process.env.MSG91_SENDER_ID : ""),
  };
};

const maskPhone = (phone = "") => {
  const value = String(phone);
  if (value.length <= 4) return "****";
  return `${value.slice(0, 3)}****${value.slice(-2)}`;
};

const getProviderRequestId = (data = {}) =>
  data?.request_id || data?.requestId || data?.RequestId || data?.requestId || data?.message_id || data?.messageId || data?.id;

const getProviderMessage = (data = {}) =>
  data?.message || data?.Message || data?.msg || data?.error || data?.Error || data?.details || data?.Details || "";

const rememberMsg91Attempt = (attempt = {}) => {
  const key = String(attempt.requestId || attempt.attemptId || "").trim();
  if (!key) return;

  msg91OtpAttempts.set(key, {
    ...attempt,
    storedAt: new Date().toISOString(),
  });

  while (msg91OtpAttempts.size > MAX_MSG91_ATTEMPTS) {
    const oldestKey = msg91OtpAttempts.keys().next().value;
    msg91OtpAttempts.delete(oldestKey);
  }
};

const normalizeMobile = (phone = "") => {
  const raw = String(phone).trim();
  const hasPlus = raw.startsWith("+");
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";

  if (digits.length === 10) return `${process.env.MOBILE_OTP_DEFAULT_COUNTRY_CODE || "91"}${digits}`;
  if ((hasPlus || digits.length === 12) && digits.startsWith("91") && digits.length === 12) return digits;
  return "";
};

const parseProviderResponse = async (response) => {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw: text };
  }
};

const sanitizeProviderBody = (data = {}) => {
  if (!data || typeof data !== "object") return data;

  const blocked = new Set(["authkey", "auth_key", "apikey", "api_key", "key", "token", "password"]);
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key,
      blocked.has(String(key).toLowerCase()) ? "[redacted]" : value,
    ])
  );
};

const assertProviderResponse = ({ response, data, provider, action }) => {
  const statusValue = String(data?.type || data?.Status || data?.status || "").toLowerCase();
  const requestId = getProviderRequestId(data);
  const hasSuccessStatus = ["success", "sent", "queued", "submitted"].includes(statusValue);
  const hasFailureStatus = ["error", "failed", "failure"].includes(statusValue);
  const hasInvalidDetails = String(data?.Details || data?.details || data?.message || "").toLowerCase().includes("invalid api key");
  const isSuccess = response.ok && !hasFailureStatus && !hasInvalidDetails && (hasSuccessStatus || Boolean(requestId));

  if (isSuccess) return;

  const error = new Error(`${provider} ${action} failed`);
  error.code = "MOBILE_OTP_PROVIDER_ERROR";
  error.provider = provider;
  error.providerStatus = response.status;
  error.providerBody = sanitizeProviderBody(data);
  error.providerRequestId = requestId;
  throw error;
};

const logMsg91Event = ({ message, platform, mobile, templateId, senderId, status, body }) => {
  const sanitizedBody = sanitizeProviderBody(body);
  const requestId = getProviderRequestId(sanitizedBody) || "";
  const providerMessage = getProviderMessage(sanitizedBody);
  console.log(message, {
    provider: "MSG91",
    platform,
    phone: maskPhone(mobile),
    mobileFormat: String(mobile).startsWith("91") && String(mobile).length === 12 ? "91XXXXXXXXXX" : "invalid",
    templateId,
    senderId: senderId || "",
    status,
    requestId,
    type: sanitizedBody?.type || sanitizedBody?.status || sanitizedBody?.Status || "",
    message: providerMessage,
    error: sanitizedBody?.error || sanitizedBody?.Error || "",
    body: sanitizedBody,
  });
};

const sendMsg91Otp = async ({ mobile, otp, platform }) => {
  const { authKey, templateId, senderId, platform: platformKey } = getMsg91Settings(platform);
  const expiryMinutes = process.env.MSG91_OTP_EXPIRY_MINUTES || process.env.OTP_EXPIRY_MINUTES || "5";

  if (!authKey || !templateId) {
    const error = new Error(`MSG91 mobile OTP is not configured for ${platformKey}`);
    error.code = "MOBILE_OTP_NOT_CONFIGURED";
    error.provider = "MSG91";
    error.platform = platformKey;
    throw error;
  }

  const url = new URL("https://control.msg91.com/api/v5/otp");
  url.searchParams.set("template_id", templateId);
  url.searchParams.set("mobile", mobile);
  url.searchParams.set("otp", otp);
  url.searchParams.set("otp_expiry", expiryMinutes);
  if (senderId) url.searchParams.set("sender", senderId);

  logMsg91Event({
    message: "MSG91 OTP request",
    platform: platformKey,
    mobile,
    templateId,
    senderId,
  });

  let response;
  const attemptId = `${platformKey}:${Date.now()}:${String(mobile).slice(-4)}`;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        authkey: authKey,
        "Content-Type": "application/json",
      },
    });
  } catch (err) {
    rememberMsg91Attempt({
      attemptId,
      requestId: "",
      provider: "MSG91",
      platform: platformKey,
      phone: maskPhone(mobile),
      mobileFormat: "91XXXXXXXXXX",
      templateId,
      senderId: senderId || "",
      status: "",
      type: "network_error",
      message: err?.message || "Network request failed",
      error: err?.code || "",
    });
    console.error("MSG91 OTP request failed", {
      provider: "MSG91",
      platform: platformKey,
      phone: maskPhone(mobile),
      templateId,
      senderId: senderId || "",
      message: err?.message || "Network request failed",
    });
    throw err;
  }
  const data = await parseProviderResponse(response);
  const requestId = getProviderRequestId(data) || "";
  const providerMessage = getProviderMessage(data);
  rememberMsg91Attempt({
    attemptId,
    requestId,
    provider: "MSG91",
    platform: platformKey,
    phone: maskPhone(mobile),
    mobileFormat: "91XXXXXXXXXX",
    templateId,
    senderId: senderId || "",
    status: response.status,
    type: data?.type || data?.status || data?.Status || "",
    message: providerMessage,
    error: data?.error || data?.Error || "",
    body: sanitizeProviderBody(data),
  });
  logMsg91Event({
    message: "MSG91 OTP response",
    platform: platformKey,
    mobile,
    templateId,
    senderId,
    status: response.status,
    body: data,
  });
  assertProviderResponse({ response, data, provider: "MSG91", action: `send ${platformKey} OTP` });

  return data;
};

const sendTwoFactorOtp = async ({ mobile, otp }) => {
  const apiKey = process.env.TWO_FACTOR_API_KEY || process.env.TWOFACTOR_API_KEY;
  const templateName = process.env.TWO_FACTOR_TEMPLATE_NAME;
  if (!apiKey) {
    const error = new Error("2Factor mobile OTP is not configured");
    error.code = "MOBILE_OTP_NOT_CONFIGURED";
    throw error;
  }

  const url = new URL(`https://2factor.in/API/V1/${encodeURIComponent(apiKey)}/SMS/${encodeURIComponent(mobile)}/${encodeURIComponent(otp)}`);
  if (templateName) url.searchParams.set("TemplateName", templateName);
  const response = await fetch(url, { method: "POST" });
  const data = await parseProviderResponse(response);
  assertProviderResponse({ response, data, provider: "2Factor", action: "send OTP" });

  return data;
};

export const isMobileOtpConfigured = (platform = "orchardgrowers") => {
  const provider = getProvider();
  if (provider === "MSG91") {
    const settings = getMsg91Settings(platform);
    return Boolean(settings.authKey && settings.templateId);
  }
  if (provider === "2FACTOR" || provider === "TWO_FACTOR") return Boolean(process.env.TWO_FACTOR_API_KEY || process.env.TWOFACTOR_API_KEY);
  return false;
};

export const getMsg91OtpAttempt = (requestId = "") => {
  const key = String(requestId || "").trim();
  return msg91OtpAttempts.get(key) || null;
};

export const checkMsg91DeliveryStatus = async ({ requestId, platform = "orchardgrowers" } = {}) => {
  const cleanRequestId = String(requestId || "").trim();
  if (!cleanRequestId) {
    const error = new Error("MSG91 request_id is required");
    error.code = "MSG91_REQUEST_ID_REQUIRED";
    throw error;
  }

  const statusUrlTemplate = process.env.MSG91_STATUS_URL || process.env.MSG91_DELIVERY_STATUS_URL || "";
  if (!statusUrlTemplate) {
    return {
      ok: false,
      requestId: cleanRequestId,
      message: "MSG91 delivery status endpoint is not configured",
    };
  }

  const { authKey, platform: platformKey } = getMsg91Settings(platform);
  if (!authKey) {
    const error = new Error(`MSG91 auth key is not configured for ${platformKey}`);
    error.code = "MOBILE_OTP_NOT_CONFIGURED";
    throw error;
  }

  const usesPlaceholder = statusUrlTemplate.includes("{requestId}");
  const statusUrl = new URL(
    usesPlaceholder ? statusUrlTemplate.replace("{requestId}", encodeURIComponent(cleanRequestId)) : statusUrlTemplate
  );
  if (!usesPlaceholder) statusUrl.searchParams.set("request_id", cleanRequestId);

  const response = await fetch(statusUrl, {
    method: "GET",
    headers: {
      authkey: authKey,
      "Content-Type": "application/json",
    },
  });
  const data = await parseProviderResponse(response);
  const sanitizedBody = sanitizeProviderBody(data);

  return {
    ok: response.ok,
    status: response.status,
    requestId: getProviderRequestId(sanitizedBody) || cleanRequestId,
    type: sanitizedBody?.type || sanitizedBody?.status || sanitizedBody?.Status || "",
    message: getProviderMessage(sanitizedBody),
    error: sanitizedBody?.error || sanitizedBody?.Error || "",
    body: sanitizedBody,
  };
};

export const sendMobileOtp = async ({ phone, otp, platform = "orchardgrowers" }) => {
  const mobile = normalizeMobile(phone);
  if (!mobile) {
    const error = new Error("Valid mobile number is required");
    error.code = "INVALID_MOBILE";
    throw error;
  }

  const provider = getProvider();
  const platformKey = normalizePlatform(platform);
  let providerData = {};
  try {
    if (provider === "MSG91") {
      providerData = await sendMsg91Otp({ mobile, otp, platform: platformKey });
    } else if (provider === "2FACTOR" || provider === "TWO_FACTOR") {
      await sendTwoFactorOtp({ mobile, otp });
    } else {
      const error = new Error(`Unsupported mobile OTP provider: ${provider}`);
      error.code = "MOBILE_OTP_PROVIDER_UNSUPPORTED";
      throw error;
    }
  } catch (err) {
    if (err?.code) throw err;
    const error = new Error(`${provider} OTP provider request failed`);
    error.code = "MOBILE_OTP_PROVIDER_ERROR";
    error.provider = provider;
    error.platform = platformKey;
    error.providerBody = sanitizeProviderBody({ message: err?.message || "Provider request failed" });
    throw error;
  }

  if (truthyEnv(process.env.MOBILE_OTP_LOG_SUCCESS)) {
    console.log(`Mobile OTP sent via ${provider} for ${platformKey} to ${maskPhone(mobile)}`);
  }

  return { provider, platform: platformKey, mobile, requestId: getProviderRequestId(providerData) || "" };
};
