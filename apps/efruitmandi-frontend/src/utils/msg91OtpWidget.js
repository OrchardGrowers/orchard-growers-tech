const PRIMARY_SCRIPT = "https://verify.msg91.com/otp-provider.js";
const FALLBACK_SCRIPT = "https://verify.phone91.com/otp-provider.js";
const READY_TIMEOUT_MS = 15000;
const READY_POLL_MS = 150;
const LOAD_TIMEOUT_ERROR = "OTP service is still loading. Please refresh and try again.";
const AUTH_CONFIG_ERROR = "OTP authentication configuration failed. Please check MSG91 widget token.";

let scriptPromise = null;
let activeWidgetKey = "";
let initPromise = null;
let pendingWidgetKey = "";
let scriptLoaded = false;

export const normalizeIndianMobile = (value = "") => {
  const digits = String(value).replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  return "";
};

const getProcessEnv = () => {
  try {
    return process.env || {};
  } catch (err) {
    return {};
  }
};

const getEnvValue = (viteKey, compatKey = "") => getProcessEnv()[viteKey] || (compatKey ? getProcessEnv()[compatKey] : "") || "";
const normalizeBaseUrl = (value = "") => String(value || "").trim().replace(/\/+$/, "");
const normalizeApiUrl = (value = "") => {
  const normalized = normalizeBaseUrl(value);
  if (!normalized) return "";
  return /\/api$/i.test(normalized) ? normalized : `${normalized}/api`;
};
const API_BASE_URL = normalizeApiUrl(getEnvValue("VITE_API_BASE_URL") || "https://api.efruitmandi.live");
const efruitOtpPhonesByReqId = new Map();
const efruitOtpModesByReqId = new Map();
const efruitOtpFlowsByReqId = new Map();

const isDevelopment = () => getProcessEnv().NODE_ENV === "development";

const yesNo = (value) => (value ? "yes" : "no");

const hasMsg91ScriptLoaded = () => Boolean(scriptLoaded || window.initSendOTP || window.sendOtp);

const maskNormalizedPhone = (phone = "") => {
  const normalized = normalizeIndianMobile(phone);
  if (!normalized) return "invalid";
  return `${normalized.slice(0, 2)}******${normalized.slice(-4)}`;
};

const SENSITIVE_KEY_PATTERN = /(token|auth|authorization|secret|password|otp)/i;
const PHONE_KEY_PATTERN = /(phone|mobile|identifier|number)/i;

const sanitizeText = (value) =>
  value
    .replace(/(tokenAuth|token|authorization|auth)\s*[:=]\s*["']?[^"',\s}]+/gi, "$1=[redacted]")
    .slice(0, 800);

const maskPlainValue = (value) => {
  const digits = value.replace(/\D/g, "");
  if (digits.length >= 10) return maskNormalizedPhone(digits);
  if (value.length <= 4) return "****";
  return `${value.slice(0, 2)}****${value.slice(-2)}`;
};

const toSafeJson = (value, depth = 0, seen = new WeakSet(), key = "") => {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return PHONE_KEY_PATTERN.test(key) ? maskPlainValue(value) : sanitizeText(value);
  if (typeof value !== "object") return value;
  if (seen.has(value)) return "[circular]";
  if (depth >= 3) return "[object]";

  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => toSafeJson(item, depth + 1, seen, key));

  return Object.entries(value).reduce((safe, [key, item]) => {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      safe[key] = "[redacted]";
      return safe;
    }

    safe[key] = toSafeJson(item, depth + 1, seen, key);
    return safe;
  }, {});
};

const debugOtp = (event, details = {}) => {
  if (!isDevelopment()) return;
  console.info(`[MSG91 OTP debug] ${event}`, {
    platform: "efruitmandi",
    ...toSafeJson(details),
  });
};

const hasAuthenticationFailure = (value) => {
  const searchable = typeof value === "string" ? value : JSON.stringify(toSafeJson(value) || {});
  return /authentication\s*failure|authenticationfailure/i.test(searchable);
};

export const getMsg91SafeErrorMessage = (error, fallback = "MSG91 OTP request failed.") => {
  const candidates = [
    error?.response?.data?.msg,
    error?.response?.data?.message,
    error?.data?.msg,
    error?.data?.message,
    error?.msg,
    error?.message,
    error?.error,
    error?.description,
    error?.type,
    typeof error === "string" ? error : "",
  ];

  if (hasAuthenticationFailure(error) || candidates.some((candidate) => typeof candidate === "string" && hasAuthenticationFailure(candidate))) {
    return AUTH_CONFIG_ERROR;
  }

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return sanitizeText(candidate.trim());
  }

  try {
    const safeJson = JSON.stringify(toSafeJson(error));
    if (safeJson && safeJson !== "{}") return sanitizeText(safeJson);
  } catch (err) {
    // Keep the user-facing fallback if the callback payload cannot be serialized.
  }

  return fallback;
};

const createMsg91Error = (error, fallback, safeResponse) => {
  const message = getMsg91SafeErrorMessage(error, fallback);
  const existingSafeResponse = error?.response?.data?.safeResponse;
  const wrapped = new Error(message);
  wrapped.response = { data: { msg: message, ...(safeResponse || existingSafeResponse ? { safeResponse: safeResponse || existingSafeResponse } : {}) } };
  wrapped.cause = error;
  return wrapped;
};

const loadScript = (src) =>
  new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-msg91-otp-provider="${src}"]`);
    if (existing) {
      if (window.initSendOTP) {
        scriptLoaded = true;
        resolve();
      }
      existing.addEventListener(
        "load",
        () => {
          scriptLoaded = true;
          resolve();
        },
        { once: true }
      );
      existing.addEventListener("error", reject, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.msg91OtpProvider = src;
    script.onload = () => {
      scriptLoaded = true;
      resolve();
    };
    script.onerror = reject;
    document.body.appendChild(script);
  });

const waitForMsg91Methods = () =>
  new Promise((resolve, reject) => {
    const startedAt = Date.now();

    const check = () => {
      if (window.sendOtp && window.verifyOtp && window.retryOtp) {
        resolve();
        return;
      }

      if (Date.now() - startedAt >= READY_TIMEOUT_MS) {
        if (isDevelopment()) {
          console.warn("MSG91 widget script load timeout.");
        }
        reject(new Error(LOAD_TIMEOUT_ERROR));
        return;
      }

      window.setTimeout(check, READY_POLL_MS);
    };

    check();
  });

export const getEfruitMandiWidgetId = () =>
  getEnvValue("VITE_MSG91_EFRUITMANDI_WIDGET_ID", "REACT_APP_MSG91_EFRUITMANDI_WIDGET_ID");

export const getEfruitMandiTokenAuth = () =>
  getEnvValue("VITE_MSG91_EFRUITMANDI_TOKEN_AUTH", "REACT_APP_MSG91_EFRUITMANDI_TOKEN_AUTH") || "backend";

export const initMsg91Widget = async ({ widgetId, tokenAuth }) => {
  debugOtp("init", {
    widgetIdPresent: yesNo(Boolean(widgetId)),
    tokenAuthPresent: yesNo(Boolean(tokenAuth)),
    scriptLoaded: yesNo(hasMsg91ScriptLoaded()),
  });

  if (!widgetId) {
    if (isDevelopment()) {
      console.warn("Missing MSG91 eFruitMandi widget ID/tokenAuth is not configured.");
    }
    throw new Error("Mobile OTP is not configured.");
  }
  if (!tokenAuth) {
    if (isDevelopment()) {
      console.warn("Missing MSG91 eFruitMandi tokenAuth.");
    }
    throw new Error("Mobile OTP is not configured.");
  }

  if (!scriptPromise) {
    scriptPromise = loadScript(PRIMARY_SCRIPT).catch(() => loadScript(FALLBACK_SCRIPT));
  }

  try {
    await scriptPromise;
    scriptLoaded = true;
    debugOtp("script loaded", {
      scriptLoaded: yesNo(hasMsg91ScriptLoaded()),
    });
  } catch (error) {
    scriptLoaded = false;
    debugOtp("script loaded", {
      scriptLoaded: "no",
      error: getMsg91SafeErrorMessage(error, LOAD_TIMEOUT_ERROR),
    });
    throw error;
  }

  const widgetKey = `${widgetId}:${tokenAuth}`;
  if (activeWidgetKey === widgetKey && window.sendOtp && window.verifyOtp && window.retryOtp) return;

  if (!initPromise || pendingWidgetKey !== widgetKey) {
    pendingWidgetKey = widgetKey;
    initPromise = (async () => {
      if (typeof window.initSendOTP !== "function") {
        throw new Error(LOAD_TIMEOUT_ERROR);
      }

      window.initSendOTP({
        widgetId,
        tokenAuth,
        exposeMethods: true,
        success: (...callbackArgs) => {
          debugOtp("init callback success", {
            widgetIdPresent: yesNo(Boolean(widgetId)),
            tokenAuthPresent: yesNo(Boolean(tokenAuth)),
            response: toSafeJson(normalizeCallbackData(callbackArgs)),
            responseShape: getResponseShape(normalizeCallbackData(callbackArgs)),
          });
        },
        failure: (...callbackErrors) => {
          const error = callbackErrors.length > 1 ? callbackErrors : callbackErrors[0];
          debugOtp("init callback failure", {
            widgetIdPresent: yesNo(Boolean(widgetId)),
            tokenAuthPresent: yesNo(Boolean(tokenAuth)),
            error: getMsg91SafeErrorMessage(error, "MSG91 OTP initialization failed."),
          });
        },
      });
      activeWidgetKey = widgetKey;
      await waitForMsg91Methods();
    })().catch((error) => {
      activeWidgetKey = "";
      pendingWidgetKey = "";
      initPromise = null;
      throw error;
    });
  }

  await initPromise;
};

const REQUEST_ID_PATHS = [
  ["reqId"],
  ["requestId"],
  ["request_id"],
  ["message"],
  ["data", "reqId"],
  ["data", "requestId"],
  ["data", "request_id"],
  ["response", "reqId"],
  ["response", "requestId"],
  ["response", "request_id"],
  ["RequestId"],
  ["RequestID"],
  ["id"],
];

const readPath = (data, path) =>
  path.reduce((current, key) => (isRecord(current) ? current[key] : undefined), data);

const normalizeReqIdValue = (value) => {
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  return "";
};

const extractReqId = (data = {}) => {
  for (const path of REQUEST_ID_PATHS) {
    const reqId = normalizeReqIdValue(readPath(data, path));
    if (reqId) return reqId;
  }

  return "";
};

const isRecord = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));

const getResponseShape = (value) => {
  if (Array.isArray(value)) return value.map((item) => getResponseShape(item));
  if (!isRecord(value)) return typeof value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, getResponseShape(item)]));
};

const normalizeCallbackData = (callbackArgs) => {
  const [first, ...rest] = callbackArgs;
  if (isRecord(first)) return rest.length ? { ...first, callbackArgs: rest } : first;
  if (first === undefined) return {};
  return rest.length ? { value: first, callbackArgs: rest } : { value: first };
};

const extractReqIdFromCallbackArgs = (callbackArgs) => {
  for (const item of callbackArgs) {
    if (isRecord(item)) {
      const reqId = extractReqId(item);
      if (reqId) return reqId;
    }
  }

  for (const item of callbackArgs.slice(1)) {
    if (typeof item === "string" || typeof item === "number") return String(item);
  }

  return "";
};

const ensureWidgetMethod = (method) => {
  if (typeof window[method] !== "function") {
    throw new Error(LOAD_TIMEOUT_ERROR);
  }
  return window[method];
};

const callWidget = (method, invoke) =>
  new Promise((resolve, reject) => {
    let widgetMethod;
    try {
      widgetMethod = ensureWidgetMethod(method);
    } catch (err) {
      reject(createMsg91Error(new Error(LOAD_TIMEOUT_ERROR), LOAD_TIMEOUT_ERROR));
      return;
    }

    try {
      invoke(
        widgetMethod,
        (...callbackArgs) => {
          const responseData = normalizeCallbackData(callbackArgs);
          const resultData =
            method === "verifyOtp"
              ? { ...responseData, type: String(responseData.type || responseData.status || "").trim() || "success", widgetVerified: true }
              : responseData;
          const reqId = extractReqIdFromCallbackArgs(callbackArgs);
          debugOtp(`${method} callback success`, {
            scriptLoaded: yesNo(hasMsg91ScriptLoaded()),
            reqId: reqId ? "returned" : "missing",
            response: toSafeJson(resultData),
            responseShape: getResponseShape(resultData),
          });
          resolve({ data: resultData, reqId });
        },
        (...callbackErrors) => {
          const error = callbackErrors.length > 1 ? callbackErrors : callbackErrors[0];
          const safeError = getMsg91SafeErrorMessage(error, "MSG91 OTP request failed.");
          debugOtp(`${method} callback failure`, {
            scriptLoaded: yesNo(hasMsg91ScriptLoaded()),
            reqId: "missing",
            error: safeError,
          });
          reject(createMsg91Error(error || new Error("MSG91 OTP request failed."), "MSG91 OTP request failed."));
        }
      );
    } catch (error) {
      const safeError = getMsg91SafeErrorMessage(error, "MSG91 OTP request failed.");
      debugOtp(`${method} callback failure`, {
        scriptLoaded: yesNo(hasMsg91ScriptLoaded()),
        reqId: "missing",
        error: safeError,
      });
      reject(createMsg91Error(error, "MSG91 OTP request failed."));
    }
  });

export const sendMsg91WidgetOtp = async ({ widgetId, tokenAuth, phone, mode = "signup" }) => {
  debugOtp("sendOtp start", {
    normalizedPhoneMasked: maskNormalizedPhone(phone),
    widgetIdPresent: yesNo(Boolean(widgetId)),
    tokenAuthPresent: "backend",
    scriptLoaded: "backend",
  });

  try {
    const response = await fetch(`${API_BASE_URL}/auth/send-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: phone,
        platform: "efruitmandi",
        mode,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw { response: { data } };
    const reqId = data.reqId || data.requestId || "";
    if (reqId) {
      efruitOtpPhonesByReqId.set(reqId, phone);
      efruitOtpModesByReqId.set(reqId, mode);
      efruitOtpFlowsByReqId.set(reqId, data.otpFlow || "");
    }
    return { data, reqId };
  } catch (error) {
    throw createMsg91Error(error, "MSG91 OTP request failed.");
  }
};

export const retryMsg91WidgetOtp = async ({ widgetId, tokenAuth, reqId }) => {
  try {
    const phone = efruitOtpPhonesByReqId.get(reqId);
    const mode = efruitOtpModesByReqId.get(reqId) || "signup";
    if (!phone) throw new Error("Request phone OTP again.");
    const result = await sendMsg91WidgetOtp({ widgetId, tokenAuth, phone, mode });
    return { ...result, reqId: result.reqId || reqId || "" };
  } catch (error) {
    throw createMsg91Error(error, "MSG91 OTP retry failed.");
  }
};

export const verifyMsg91WidgetOtp = async ({ widgetId, tokenAuth, otp, reqId, phone, mode = "signup" }) => {
  try {
    const verifiedPhone = efruitOtpPhonesByReqId.get(reqId) || phone;
    if (!verifiedPhone) throw new Error("Request phone OTP first.");
    const purpose = mode === "forgot" || mode === "forgot-password" || mode === "reset" ? "forgot-password" : "auth";
    const otpFlow = efruitOtpFlowsByReqId.get(reqId) || "";
    const endpoint = reqId && otpFlow !== "template" ? "verify-mobile-widget-otp" : "verify-otp";
    const response = await fetch(`${API_BASE_URL}/auth/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: verifiedPhone,
        otp,
        reqId,
        platform: "efruitmandi",
        purpose,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw { response: { data } };
    return { data: { ...data, widgetVerified: true, type: "success" }, reqId };
  } catch (error) {
    throw createMsg91Error(error, "MSG91 OTP verification failed.");
  }
};
