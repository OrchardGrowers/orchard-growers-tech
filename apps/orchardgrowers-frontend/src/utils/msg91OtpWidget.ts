const PRIMARY_SCRIPT = "https://verify.msg91.com/otp-provider.js";
const FALLBACK_SCRIPT = "https://verify.phone91.com/otp-provider.js";
const READY_TIMEOUT_MS = 15000;
const READY_POLL_MS = 150;
const LOAD_TIMEOUT_ERROR = "OTP service is still loading. Please refresh and try again.";
const AUTH_CONFIG_ERROR = "OTP authentication configuration failed. Please check MSG91 widget token.";

type Msg91Response = Record<string, unknown>;
type Msg91WidgetMethod = (...args: unknown[]) => void;
type Msg91SuccessCallback = (...data: unknown[]) => void;
type Msg91FailureCallback = (...error: unknown[]) => void;
type Msg91Error = Error & {
  response?: { data?: { msg?: string; safeResponse?: unknown } };
  cause?: unknown;
};

declare global {
  interface Window {
    initSendOTP?: (config: Record<string, unknown>) => void;
    sendOtp?: (...args: unknown[]) => void;
    retryOtp?: (...args: unknown[]) => void;
    verifyOtp?: (...args: unknown[]) => void;
  }
}

let scriptPromise: Promise<void> | null = null;
let activeWidgetKey = "";
let initPromise: Promise<void> | null = null;
let pendingWidgetKey = "";
let scriptLoaded = false;

export const normalizeIndianMobile = (value = "") => {
  const digits = String(value).replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  return "";
};

const getProcessEnv = () =>
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env || {};

const getEnvValue = (viteKey: string, reactKey: string) =>
  import.meta.env[viteKey] || import.meta.env[reactKey] || getProcessEnv()[reactKey] || getProcessEnv()[viteKey] || "";

const isDevelopment = () =>
  Boolean(import.meta.env.DEV || import.meta.env.MODE === "development" || getProcessEnv().NODE_ENV === "development");

const yesNo = (value: boolean) => (value ? "yes" : "no");

const hasMsg91ScriptLoaded = () => Boolean(scriptLoaded || window.initSendOTP || window.sendOtp);

const maskNormalizedPhone = (phone = "") => {
  const normalized = normalizeIndianMobile(phone);
  if (!normalized) return "invalid";
  return `${normalized.slice(0, 2)}******${normalized.slice(-4)}`;
};

const SENSITIVE_KEY_PATTERN = /(token|auth|authorization|secret|password|otp)/i;
const PHONE_KEY_PATTERN = /(phone|mobile|identifier|number)/i;

const sanitizeText = (value: string) =>
  value
    .replace(/(tokenAuth|token|authorization|auth)\s*[:=]\s*["']?[^"',\s}]+/gi, "$1=[redacted]")
    .slice(0, 800);

const maskPlainValue = (value: string) => {
  const digits = value.replace(/\D/g, "");
  if (digits.length >= 10) return maskNormalizedPhone(digits);
  if (value.length <= 4) return "****";
  return `${value.slice(0, 2)}****${value.slice(-2)}`;
};

const toSafeJson = (value: unknown, depth = 0, seen = new WeakSet<object>(), key = ""): unknown => {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return PHONE_KEY_PATTERN.test(key) ? maskPlainValue(value) : sanitizeText(value);
  if (typeof value !== "object") return value;
  if (seen.has(value)) return "[circular]";
  if (depth >= 3) return "[object]";

  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => toSafeJson(item, depth + 1, seen, key));

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>((safe, [key, item]) => {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      safe[key] = "[redacted]";
      return safe;
    }

    safe[key] = toSafeJson(item, depth + 1, seen, key);
    return safe;
  }, {});
};

const debugOtp = (event: string, details: Record<string, unknown> = {}) => {
  if (!isDevelopment()) return;
  console.info(`[MSG91 OTP debug] ${event}`, {
    platform: "orchardgrowers",
    ...(toSafeJson(details) as Record<string, unknown>),
  });
};

const hasAuthenticationFailure = (value: unknown) => {
  const searchable = typeof value === "string" ? value : JSON.stringify(toSafeJson(value) || {});
  return /authentication\s*failure|authenticationfailure/i.test(searchable);
};

export const getMsg91SafeErrorMessage = (error: unknown, fallback = "MSG91 OTP request failed.") => {
  const source = error as {
    response?: { data?: Record<string, unknown> };
    data?: Record<string, unknown>;
    msg?: unknown;
    message?: unknown;
    error?: unknown;
    description?: unknown;
    type?: unknown;
  };
  const candidates = [
    source?.response?.data?.msg,
    source?.response?.data?.message,
    source?.data?.msg,
    source?.data?.message,
    source?.msg,
    source?.message,
    source?.error,
    source?.description,
    source?.type,
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
  } catch {
    // Keep the user-facing fallback if the callback payload cannot be serialized.
  }

  return fallback;
};

const createMsg91Error = (error: unknown, fallback?: string, safeResponse?: unknown): Msg91Error => {
  const message = getMsg91SafeErrorMessage(error, fallback);
  const existingSafeResponse = (error as { response?: { data?: { safeResponse?: unknown } } })?.response?.data?.safeResponse;
  const wrapped = new Error(message) as Msg91Error;
  wrapped.response = { data: { msg: message, ...(safeResponse || existingSafeResponse ? { safeResponse: safeResponse || existingSafeResponse } : {}) } };
  wrapped.cause = error;
  return wrapped;
};

const loadScript = (src: string) =>
  new Promise<void>((resolve, reject) => {
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
  new Promise<void>((resolve, reject) => {
    const startedAt = Date.now();

    const check = () => {
      if (window.sendOtp && window.verifyOtp && window.retryOtp) {
        resolve();
        return;
      }

      if (Date.now() - startedAt >= READY_TIMEOUT_MS) {
        console.warn("MSG91 widget script load timeout.");
        reject(new Error(LOAD_TIMEOUT_ERROR));
        return;
      }

      window.setTimeout(check, READY_POLL_MS);
    };

    check();
  });

export const getOrchardWidgetId = () =>
  getEnvValue("VITE_MSG91_ORCHARD_WIDGET_ID", "REACT_APP_MSG91_ORCHARD_WIDGET_ID");

export const getOrchardTokenAuth = () =>
  import.meta.env.VITE_MSG91_ORCHARD_TOKEN_AUTH || "";

export const initMsg91Widget = async ({ widgetId, tokenAuth }: { widgetId: string; tokenAuth: string }) => {
  debugOtp("init", {
    widgetIdPresent: yesNo(Boolean(widgetId)),
    tokenAuthPresent: yesNo(Boolean(tokenAuth)),
    scriptLoaded: yesNo(hasMsg91ScriptLoaded()),
  });

  if (!widgetId) {
    console.warn("Missing MSG91 Orchard widget ID.");
    throw new Error("Mobile OTP is not configured.");
  }
  if (!tokenAuth) {
    console.warn("Missing MSG91 Orchard tokenAuth.");
    throw new Error("Mobile OTP is not configured.");
  }
  if (!scriptPromise) scriptPromise = loadScript(PRIMARY_SCRIPT).catch(() => loadScript(FALLBACK_SCRIPT));
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
      if (typeof window.initSendOTP !== "function") throw new Error(LOAD_TIMEOUT_ERROR);
      window.initSendOTP({
        widgetId,
        tokenAuth,
        exposeMethods: true,
        success: (...callbackArgs: unknown[]) => {
          debugOtp("init callback success", {
            widgetIdPresent: yesNo(Boolean(widgetId)),
            tokenAuthPresent: yesNo(Boolean(tokenAuth)),
            response: toSafeJson(normalizeCallbackData(callbackArgs)),
            responseShape: getResponseShape(normalizeCallbackData(callbackArgs)),
          });
        },
        failure: (...callbackErrors: unknown[]) => {
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

const readPath = (data: Msg91Response, path: string[]) =>
  path.reduce<unknown>((current, key) => (isRecord(current) ? current[key] : undefined), data);

const normalizeReqIdValue = (value: unknown) => {
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  return "";
};

const extractReqId = (data: Msg91Response = {}): string => {
  for (const path of REQUEST_ID_PATHS) {
    const reqId = normalizeReqIdValue(readPath(data, path));
    if (reqId) return reqId;
  }

  return "";
};

const isRecord = (value: unknown): value is Msg91Response =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const getResponseShape = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map((item) => getResponseShape(item));
  if (!isRecord(value)) return typeof value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, getResponseShape(item)]));
};

const normalizeCallbackData = (callbackArgs: unknown[]): Msg91Response => {
  const [first, ...rest] = callbackArgs;
  if (isRecord(first)) return rest.length ? { ...first, callbackArgs: rest } : first;
  if (first === undefined) return {};
  return rest.length ? { value: first, callbackArgs: rest } : { value: first };
};

const extractReqIdFromCallbackArgs = (callbackArgs: unknown[]) => {
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

const ensureWidgetMethod = (method: "sendOtp" | "retryOtp" | "verifyOtp") => {
  if (typeof window[method] !== "function") throw new Error(LOAD_TIMEOUT_ERROR);
  return window[method] as Msg91WidgetMethod;
};

const callWidget = async (
  method: "sendOtp" | "retryOtp" | "verifyOtp",
  invoke: (widgetMethod: Msg91WidgetMethod, success: Msg91SuccessCallback, failure: Msg91FailureCallback) => void
) =>
  new Promise<{ data: Msg91Response; reqId: string }>((resolve, reject) => {
    let widgetMethod: Msg91WidgetMethod;
    try {
      widgetMethod = ensureWidgetMethod(method);
    } catch {
      reject(createMsg91Error(new Error(LOAD_TIMEOUT_ERROR), LOAD_TIMEOUT_ERROR));
      return;
    }

    try {
      invoke(
        widgetMethod,
        (...callbackArgs: unknown[]) => {
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
        (...callbackErrors: unknown[]) => {
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

export const sendMsg91WidgetOtp = async ({ widgetId, tokenAuth, phone }: { widgetId: string; tokenAuth: string; phone: string }) => {
  debugOtp("sendOtp start", {
    normalizedPhoneMasked: maskNormalizedPhone(phone),
    widgetIdPresent: yesNo(Boolean(widgetId)),
    tokenAuthPresent: yesNo(Boolean(tokenAuth)),
    scriptLoaded: yesNo(hasMsg91ScriptLoaded()),
  });

  try {
    await initMsg91Widget({ widgetId, tokenAuth });
    const result = await callWidget("sendOtp", (sendOtp, success, failure) => sendOtp(phone, success, failure));
    return result;
  } catch (error) {
    throw createMsg91Error(error, "MSG91 OTP request failed.");
  }
};

export const retryMsg91WidgetOtp = async ({ widgetId, tokenAuth, reqId }: { widgetId: string; tokenAuth: string; reqId?: string }) => {
  try {
    await initMsg91Widget({ widgetId, tokenAuth });
    const result = await callWidget("retryOtp", (retryOtp, success, failure) => {
      if (reqId) retryOtp("11", success, failure, reqId);
      else retryOtp(null, success, failure);
    });
    return { ...result, reqId: result.reqId || reqId || "" };
  } catch (error) {
    throw createMsg91Error(error, "MSG91 OTP retry failed.");
  }
};

export const verifyMsg91WidgetOtp = async ({ widgetId, tokenAuth, otp, reqId }: { widgetId: string; tokenAuth: string; otp: string; reqId?: string }) => {
  try {
    await initMsg91Widget({ widgetId, tokenAuth });
    return await callWidget("verifyOtp", (verifyOtp, success, failure) => {
      if (reqId) verifyOtp(otp, success, failure, reqId);
      else verifyOtp(otp, success, failure);
    });
  } catch (error) {
    throw createMsg91Error(error, "MSG91 OTP verification failed.");
  }
};
