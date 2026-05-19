const truthyEnv = (value = "") => ["1", "true", "yes"].includes(String(value).trim().toLowerCase());

const getProvider = () => String(process.env.MOBILE_OTP_PROVIDER || "MSG91").trim().toUpperCase();

const maskPhone = (phone = "") => {
  const value = String(phone);
  if (value.length <= 4) return "****";
  return `${value.slice(0, 3)}****${value.slice(-2)}`;
};

const normalizeMobile = (phone = "") => {
  const raw = String(phone).trim();
  const hasPlus = raw.startsWith("+");
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";

  if (hasPlus) return digits;
  if (digits.length === 10) return `${process.env.MOBILE_OTP_DEFAULT_COUNTRY_CODE || "91"}${digits}`;
  return digits;
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
  const isSuccess =
    response.ok &&
    !["error", "failed", "failure"].includes(statusValue) &&
    data?.Details !== "Invalid API Key";

  if (isSuccess) return;

  const error = new Error(`${provider} ${action} failed`);
  error.code = "MOBILE_OTP_PROVIDER_ERROR";
  error.providerStatus = response.status;
  error.providerBody = sanitizeProviderBody(data);
  throw error;
};

const sendMsg91Otp = async ({ mobile, otp }) => {
  const authKey = process.env.MSG91_AUTH_KEY;
  const templateId = process.env.MSG91_TEMPLATE_ID;
  const senderId = process.env.MSG91_SENDER_ID;

  if (!authKey || !templateId) {
    const error = new Error("MSG91 mobile OTP is not configured");
    error.code = "MOBILE_OTP_NOT_CONFIGURED";
    throw error;
  }

  const url = new URL("https://control.msg91.com/api/v5/otp");
  url.searchParams.set("template_id", templateId);
  url.searchParams.set("mobile", mobile);
  url.searchParams.set("otp", otp);
  if (senderId) url.searchParams.set("sender", senderId);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      authkey: authKey,
      "Content-Type": "application/json",
    },
  });
  const data = await parseProviderResponse(response);
  assertProviderResponse({ response, data, provider: "MSG91", action: "send OTP" });

  return data;
};

const sendTwoFactorOtp = async ({ mobile, otp }) => {
  const apiKey = process.env.TWO_FACTOR_API_KEY || process.env.TWOFACTOR_API_KEY;
  if (!apiKey) {
    const error = new Error("2Factor mobile OTP is not configured");
    error.code = "MOBILE_OTP_NOT_CONFIGURED";
    throw error;
  }

  const url = `https://2factor.in/API/V1/${encodeURIComponent(apiKey)}/SMS/${encodeURIComponent(mobile)}/${encodeURIComponent(otp)}`;
  const response = await fetch(url, { method: "POST" });
  const data = await parseProviderResponse(response);
  assertProviderResponse({ response, data, provider: "2Factor", action: "send OTP" });

  return data;
};

export const isMobileOtpConfigured = () => {
  const provider = getProvider();
  if (provider === "MSG91") return Boolean(process.env.MSG91_AUTH_KEY && process.env.MSG91_TEMPLATE_ID);
  if (provider === "2FACTOR" || provider === "TWO_FACTOR") return Boolean(process.env.TWO_FACTOR_API_KEY || process.env.TWOFACTOR_API_KEY);
  return false;
};

export const sendMobileOtp = async ({ phone, otp }) => {
  const mobile = normalizeMobile(phone);
  if (!mobile) {
    const error = new Error("Valid mobile number is required");
    error.code = "INVALID_MOBILE";
    throw error;
  }

  const provider = getProvider();
  if (provider === "MSG91") {
    await sendMsg91Otp({ mobile, otp });
  } else if (provider === "2FACTOR" || provider === "TWO_FACTOR") {
    await sendTwoFactorOtp({ mobile, otp });
  } else {
    const error = new Error(`Unsupported mobile OTP provider: ${provider}`);
    error.code = "MOBILE_OTP_PROVIDER_UNSUPPORTED";
    throw error;
  }

  if (truthyEnv(process.env.MOBILE_OTP_LOG_SUCCESS)) {
    console.log(`Mobile OTP sent via ${provider} to ${maskPhone(mobile)}`);
  }

  return { provider, mobile };
};
