import User from "../models/User.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import axios from "axios";
import { google } from "googleapis";
import { isSmtpConfigured, normalizeMailPlatform, sendOtpEmail } from "../services/mailService.js";
import { isMobileOtpConfigured, sendMobileOtp, verifyMsg91WidgetOtp } from "../services/mobileOtpService.js";

const otpStore = new Map();
const otpVerificationTokens = new Map();
const otpSendThrottleStore = new Map();
const otpVerifyLockStore = new Map();
const ACCOUNT_EXISTS_SIGNIN_MESSAGE = "Account already exists. Please sign in.";
const OTP_THROTTLED_MESSAGE = "Too many OTP requests. Please try again later.";
const OTP_RESEND_INTERVAL_MS = Math.max(0, Number(process.env.OTP_RESEND_INTERVAL_MS || 0));
const OTP_SEND_WINDOW_MS = 10 * 60 * 1000;
const OTP_MAX_SENDS_PER_WINDOW = Math.max(0, Number(process.env.OTP_MAX_SENDS_PER_WINDOW || 0));
const OTP_LOCK_MS = 15 * 60 * 1000;
const truthyEnv = (value = "") => ["1", "true", "yes"].includes(String(value).trim().toLowerCase());
const useLegacyMsg91Api = () => truthyEnv(process.env.USE_LEGACY_MSG91_API);
const shouldUseServerMobileOtp = () => true;
const getOtpTtlMs = () => {
  const minutes = Number(process.env.OTP_EXPIRY_MINUTES || 5);
  return (Number.isFinite(minutes) && minutes > 0 ? minutes : 5) * 60 * 1000;
};
const getOtpLength = () => {
  const configuredLength = Number(process.env.MSG91_OTP_LENGTH || 6);
  return Number.isFinite(configuredLength) && configuredLength >= 4 && configuredLength <= 8 ? configuredLength : 6;
};
const getOtpMaxAttempts = () => {
  const attempts = Number(process.env.OTP_MAX_ATTEMPTS || 5);
  return Number.isFinite(attempts) && attempts > 0 ? Math.min(attempts, 5) : 5;
};
const createOtp = () => {
  const length = getOtpLength();
  const max = 10 ** length;
  return String(Math.floor(Math.random() * max)).padStart(length, "0");
};
const OTP_PURPOSES = new Set(["auth", "forgot-password"]);

const normalizeIdentifier = (identifier = "") => identifier.trim().toLowerCase();
const isEmail = (identifier) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
const isPhone = (identifier) => /^[0-9+\-\s()]{7,20}$/.test(identifier);
const normalizePhone = (identifier) => identifier.replace(/[^\d+]/g, "");

export const parseIdentifier = (identifier) => {
  const normalized = normalizeIdentifier(identifier);

  if (isEmail(normalized)) {
    return { type: "email", value: normalized };
  }

  if (isPhone(normalized)) {
    return { type: "phone", value: normalizePhone(normalized) };
  }

  return null;
};

const safeUserPayload = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  avatarUrl: user.avatarUrl,
  bannerUrl: user.bannerUrl,
  companyLogoUrl: user.companyLogoUrl,
  role: user.role,
  activeRole: user.activeRole,
  profileTypes: user.profileTypes || [],
  orchardName: user.orchardName,
  businessName: user.businessName,
  buyerContactPerson: user.buyerContactPerson,
  buyerLocation: user.buyerLocation,
  buyerPinCode: user.buyerPinCode,
  buyerAvatarUrl: user.buyerAvatarUrl,
  buyerBannerUrl: user.buyerBannerUrl,
  buyerCompanyLogoUrl: user.buyerCompanyLogoUrl,
  designation: user.designation,
  lockedAmount: user.lockedAmount,
  buyerVerified: user.buyerVerified,
  growerVerified: user.growerVerified,
  driverVerified: user.driverVerified,
  gstNumber: user.gstNumber,
  tradeLicenseNumber: user.tradeLicenseNumber,
  logisticsName: user.logisticsName,
  vehicleNumber: user.vehicleNumber,
  licenseNumber: user.licenseNumber,
  location: user.location,
  businessAddressLine1: user.businessAddressLine1,
  businessAddressLine2: user.businessAddressLine2,
  businessAddressLine3: user.businessAddressLine3,
  businessPinCode: user.businessPinCode,
  addressLine1: user.addressLine1,
  addressLine2: user.addressLine2,
  addressLine3: user.addressLine3,
  pinCode: user.pinCode,
  mapLatitude: user.mapLatitude,
  mapLongitude: user.mapLongitude,
  googleMapUrl: user.googleMapUrl,
  contact: user.contact,
  socialLinks: user.socialLinks,
  kyc: user.kyc,
  kycByRole: user.kycByRole,
  isVerified: user.isVerified,
  accountStatus: user.accountStatus,
  createdAt: user.createdAt,
});

const findByParsedIdentifier = (parsed) =>
  User.findOne({ [parsed.type]: parsed.value });

const createTokenPair = (user) => ({
  accessToken: jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "15m" }
  ),
  refreshToken: jwt.sign(
    { id: user._id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: "7d" }
  ),
});

const getOtpPurpose = (purpose = "auth") => {
  const normalized = String(purpose || "auth").trim().toLowerCase();
  return OTP_PURPOSES.has(normalized) ? normalized : "auth";
};

const getRequestPlatform = (req) => {
  const sourceApp = String(req.body.sourceApp || req.get("x-source-app") || "").trim().toLowerCase();
  if (sourceApp === "admin-panel") return "orchardgrowers";
  return normalizeMailPlatform(req.body.platform || req.get("x-platform") || req.get("x-app-platform") || "orchardgrowers");
};
const getOtpKey = (platform, parsed, purpose = "auth") => `${normalizeMailPlatform(platform)}:${getOtpPurpose(purpose)}:${parsed.type}:${parsed.value}`;
const getOtpThrottleKey = (platform, parsed) => `${normalizeMailPlatform(platform)}:${parsed.type}:${parsed.value}`;
const hashToken = (token = "") => crypto.createHash("sha256").update(String(token)).digest("hex");
const createOtpVerificationToken = ({ platform, parsed, purpose }) => {
  const token = crypto.randomBytes(32).toString("hex");
  const key = getOtpKey(platform, parsed, purpose);
  otpVerificationTokens.set(hashToken(token), {
    key,
    platform: normalizeMailPlatform(platform),
    purpose: getOtpPurpose(purpose),
    channel: parsed.type,
    identifier: parsed.value,
    expiresAt: Date.now() + getOtpTtlMs(),
    used: false,
  });
  return token;
};
const validateOtpVerificationToken = ({ token, platform, parsed, purpose = "auth" }) => {
  const cleanToken = String(token || "").trim();
  if (!cleanToken) return false;

  const tokenKey = hashToken(cleanToken);
  const record = otpVerificationTokens.get(tokenKey);
  const expectedKey = getOtpKey(platform, parsed, purpose);
  if (!record || record.used || record.key !== expectedKey) return false;

  if (record.expiresAt < Date.now()) {
    otpVerificationTokens.delete(tokenKey);
    return false;
  }

  return true;
};
const consumeOtpVerificationToken = (token = "") => {
  const cleanToken = String(token || "").trim();
  if (!cleanToken) return;
  otpVerificationTokens.delete(hashToken(cleanToken));
};
const getProviderRequestId = (data = {}) =>
  data?.reqId || data?.req_id || data?.requestId || data?.request_id || data?.RequestId || data?.id || "";
const sanitizeMsg91Audit = (data = {}) => {
  if (!data || typeof data !== "object") return {};
  const blocked = new Set(["tokenauth", "token", "accesstoken", "access-token", "jwt", "authkey", "auth_key"]);
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key,
      blocked.has(String(key).toLowerCase()) ? "[redacted]" : value,
    ])
  );
};
const hasMsg91VerificationProof = (data = {}) => {
  if (!data || typeof data !== "object") return false;
  const status = String(data.type || data.status || data.Status || "").toLowerCase();
  const message = String(data.message || data.Message || data.details || data.Details || "").toLowerCase();
  return Boolean(
    status === "success" ||
      status === "verified" ||
      message.includes("verified")
  );
};
const maskOtpKey = (key = "") => {
  const [platform, purpose, type, value = ""] = String(key).split(":");
  if (type === "email") {
    const [name = "", domain = ""] = value.split("@");
    return `${platform}:${purpose}:${type}:${name.slice(0, 2)}***@${domain}`;
  }

  return `${platform}:${purpose}:${type}:${value.slice(0, 3)}****${value.slice(-2)}`;
};

const logOtpError = (message, err) => {
  if (err?.code === "SMTP_SEND_FAILED") {
    console.error(message, {
      code: err.code,
      smtpCode: err.smtpCode,
      smtpDetails: err.smtpDetails,
    });
    return;
  }

  if (err?.code === "MOBILE_OTP_PROVIDER_ERROR") {
    console.error(message, {
      code: err.code,
      provider: err.provider,
      platform: err.platform,
      providerStatus: err.providerStatus,
      providerRequestId: err.providerRequestId,
      providerBody: err.providerBody,
    });
    return;
  }

  console.error(message, err?.message || err);
};

const logAuthDebug = (message, details = {}) => {
  console.log(`Auth debug: ${message}`, details);
};

const getActiveLock = (store, key) => {
  const lock = store.get(key);
  if (!lock) return null;
  if (lock.lockedUntil <= Date.now()) {
    store.delete(key);
    return null;
  }
  return lock;
};

const checkOtpSendThrottle = ({ platform, parsed, purpose }) => {
  const throttleKey = getOtpThrottleKey(platform, parsed);
  const now = Date.now();
  const existing = otpSendThrottleStore.get(throttleKey);

  if (existing?.lockedUntil && existing.lockedUntil > now) {
    return {
      allowed: false,
      reason: "send_locked",
      retryAfterMs: existing.lockedUntil - now,
      throttleKey,
    };
  }

  const sendTimes = (existing?.sendTimes || []).filter((sentAt) => now - sentAt < OTP_SEND_WINDOW_MS);
  const lastSentAt = sendTimes[sendTimes.length - 1] || 0;
  if (OTP_RESEND_INTERVAL_MS > 0 && lastSentAt && now - lastSentAt < OTP_RESEND_INTERVAL_MS) {
    return {
      allowed: false,
      reason: "resend_cooldown",
      retryAfterMs: OTP_RESEND_INTERVAL_MS - (now - lastSentAt),
      throttleKey,
    };
  }

  if (OTP_MAX_SENDS_PER_WINDOW > 0 && sendTimes.length >= OTP_MAX_SENDS_PER_WINDOW) {
    const lockedUntil = now + OTP_LOCK_MS;
    otpSendThrottleStore.set(throttleKey, { sendTimes, lockedUntil });
    return {
      allowed: false,
      reason: "send_limit",
      retryAfterMs: OTP_LOCK_MS,
      throttleKey,
    };
  }

  return { allowed: true, throttleKey, sendTimes, purpose };
};

const recordOtpSend = ({ throttleKey, sendTimes = [] }) => {
  otpSendThrottleStore.set(throttleKey, {
    sendTimes: [...sendTimes.filter((sentAt) => Date.now() - sentAt < OTP_SEND_WINDOW_MS), Date.now()],
    lockedUntil: 0,
  });
};

const lockOtpVerification = (key) => {
  otpVerifyLockStore.set(key, { lockedUntil: Date.now() + OTP_LOCK_MS });
};

const getOtpVerificationLock = (key) => getActiveLock(otpVerifyLockStore, key);

const storeOtp = ({ platform, parsed, otp, purpose }) => {
  const key = getOtpKey(platform, parsed, purpose);
  otpStore.set(key, {
    otp,
    platform,
    purpose,
    expiresAt: Date.now() + getOtpTtlMs(),
    attempts: 0,
    maxAttempts: getOtpMaxAttempts(),
    verified: false,
    used: false,
  });
  return key;
};

const storeWidgetVerification = ({ platform, parsed, purpose, audit }) => {
  const key = getOtpKey(platform, parsed, purpose);
  otpStore.set(key, {
    otp: "",
    platform,
    purpose,
    provider: "MSG91_WIDGET",
    providerAudit: audit,
    expiresAt: Date.now() + getOtpTtlMs(),
    attempts: 0,
    maxAttempts: getOtpMaxAttempts(),
    verified: true,
    used: true,
  });
  return key;
};

const deliverOtp = async ({ platform, parsed, otp, purpose, forceLegacy = false }) => {
  logAuthDebug("deliver OTP selected", {
    platform: normalizeMailPlatform(platform),
    route: parsed.type === "email" ? "email_otp" : "mobile_otp",
    channel: parsed.type,
    purpose,
  });

  // Allow a developer/test mode where OTPs are not sent externally.
  // Controlled via `ALLOW_TEST_OTP=true` and optional `TEST_OTP` value in env.
  try {
    const allowTest = truthyEnv(process.env.ALLOW_TEST_OTP);
    if (allowTest) {
      const testOtp = String(process.env.TEST_OTP || otp || "");
      const requestId = `test:${Date.now()}`;
      console.log("Test OTP mode active; not sending external OTP", { platform, channel: parsed.type, requestId, testOtpConfigured: Boolean(testOtp) });
      return { message: `OTP sent (test)`, requestId };
    }
  } catch (e) {
    // If env read fails for some reason, continue to normal flow.
    console.warn("Could not evaluate ALLOW_TEST_OTP", e?.message || e);
  }

  if (parsed.type === "email") {
    if (!isSmtpConfigured(platform)) {
      const error = new Error("SMTP is not configured");
      error.code = "SMTP_NOT_CONFIGURED";
      throw error;
    }
    await sendOtpEmail({
      platform,
      to: parsed.value,
      otp,
      purpose: purpose === "forgot-password" ? "password reset" : "account verification",
    });
    logAuthDebug("email OTP send success", {
      platform: normalizeMailPlatform(platform),
      route: "auth_email_otp",
      purpose,
    });
    return {};
  }

  if (!shouldUseServerMobileOtp(platform)) {
    const error = new Error("Mobile OTP must be sent with MSG91 widget");
    error.code = "MOBILE_OTP_WIDGET_REQUIRED";
    throw error;
  }

  if (!isMobileOtpConfigured(platform)) {
    logAuthDebug("mobile OTP configuration missing", {
      platform: normalizeMailPlatform(platform),
      provider: "MSG91",
      flow: "widget",
    });
    const error = new Error("Mobile OTP service is not configured");
    error.code = "MOBILE_OTP_NOT_CONFIGURED";
    throw error;
  }

  try {
    const result = await sendMobileOtp({ phone: parsed.value, otp, platform, forceLegacy });
    logAuthDebug("mobile OTP send success", {
      platform: result.platform,
      provider: result.provider,
      flow: result.flow || "template",
      requestId: result.requestId || "",
    });
    return result;
  } catch (err) {
    if (err.code) throw err;
    const error = new Error("Mobile OTP delivery failed");
    error.code = "MOBILE_OTP_PROVIDER_ERROR";
    error.cause = err;
    throw error;
  }
};

const sendOtpForPurpose = async ({ req, res, purpose = "auth", requireExistingUser = false, genericResponse = false }) => {
  const parsed = parseIdentifier(req.body.identifier || req.body.email);
  const platform = getRequestPlatform(req);
  const mode = String(req.body.mode || "").trim().toLowerCase();
  logAuthDebug("OTP route hit", {
    route: req.originalUrl,
    platform,
    mode: mode || "default",
    channel: parsed?.type || "invalid",
    purpose,
    identifier: parsed ? maskOtpKey(getOtpKey(platform, parsed, purpose)) : "invalid",
  });

  if (!parsed) {
    return res.status(400).json({ msg: "Enter a valid email or phone number" });
  }

  if (mode === "signup") {
    const user = await findByParsedIdentifier(parsed);
    if (user) {
      return res.status(409).json({ msg: ACCOUNT_EXISTS_SIGNIN_MESSAGE });
    }
  }

  if (requireExistingUser) {
    const user = await findByParsedIdentifier(parsed);
    if (!user) {
      return genericResponse
        ? res.json({ message: "If the account exists, an OTP has been sent.", channel: parsed.type })
        : res.status(404).json({ msg: "No. does not exist, please check the no. and enter again." });
    }
  }

  const normalizedPurpose = getOtpPurpose(purpose);
  const throttle = checkOtpSendThrottle({ platform, parsed, purpose: normalizedPurpose });
  if (!throttle.allowed) {
    logAuthDebug("OTP send throttled", {
      route: req.originalUrl,
      platform,
      channel: parsed.type,
      purpose: normalizedPurpose,
      identifier: maskOtpKey(getOtpKey(platform, parsed, normalizedPurpose)),
      reason: throttle.reason,
      retryAfterSeconds: Math.ceil(throttle.retryAfterMs / 1000),
    });
    res.set("Retry-After", String(Math.ceil(throttle.retryAfterMs / 1000)));
    return res.status(429).json({ msg: OTP_THROTTLED_MESSAGE });
  }

  const otp = createOtp();
  const key = storeOtp({ platform, parsed, otp, purpose: normalizedPurpose });
  if (parsed.type === "phone" && req.body.recordOnly === true) {
    recordOtpSend(throttle);
    logAuthDebug("OTP request recorded for external delivery", {
      route: req.originalUrl,
      platform,
      channel: parsed.type,
      purpose: normalizedPurpose,
      identifier: maskOtpKey(key),
    });
    return res.json({
      message: "OTP request prepared.",
      channel: parsed.type,
      otpFlow: "widget",
    });
  }

  let delivery = {};
  try {
    // Developer/test mode: if ALLOW_TEST_OTP=true, override stored OTP with TEST_OTP
    try {
      const allowTest = truthyEnv(process.env.ALLOW_TEST_OTP);
      if (allowTest) {
        const testOtp = String(process.env.TEST_OTP || otp || "");
        // update the stored OTP so verify will accept the test value
        const existing = otpStore.get(key) || {};
        otpStore.set(key, { ...existing, otp: testOtp });
        const requestId = `test:${Date.now()}`;
        console.log("Test OTP mode active; storing test OTP for verification", { platform, channel: parsed.type, requestId, testOtpConfigured: Boolean(testOtp) });
        delivery = { message: `OTP sent (test)`, requestId };
      } else {
        delivery = await deliverOtp({ platform, parsed, otp, purpose: normalizedPurpose, forceLegacy: Boolean(req.body.forceLegacy) });
      }
    } catch (e) {
      throw e;
    }
  } catch (err) {
    otpStore.delete(key);
    logOtpError("OTP delivery failed:", err);

    return res.status(502).json({ msg: "Could not send OTP. Please try again." });
  }

  recordOtpSend(throttle);
  logAuthDebug("OTP route success", {
    route: req.originalUrl,
    platform,
    channel: parsed.type,
    purpose: normalizedPurpose,
    identifier: maskOtpKey(key),
  });

  if (String(process.env.APP_ENV || process.env.NODE_ENV || "").trim().toLowerCase() === "development") {
    console.log(`OTP delivery accepted for ${maskOtpKey(key)}`);
  }

  return res.json({
    message: genericResponse ? "If the account exists, an OTP has been sent." : `OTP sent to ${parsed.type}`,
    channel: parsed.type,
    ...(parsed.type === "phone" && delivery?.requestId ? { requestId: delivery.requestId, reqId: delivery.requestId } : {}),
    ...(parsed.type === "phone" && delivery?.flow ? { otpFlow: delivery.flow } : {}),
  });
};

export const sendOtp = async (req, res) => {
  try {
    const mode = String(req.body.mode || "").trim().toLowerCase();
    // By default require the account to exist before sending auth OTPs.
    // Allow sending OTP for signup/profile registration flows without account lookup.
    const requireExisting = !["signup", "profile", "role", "profile-registration"].includes(mode);
    return sendOtpForPurpose({ req, res, purpose: "auth", requireExistingUser: requireExisting });
  } catch (err) {
    logOtpError("OTP request failed:", err);
    res.status(500).json({ msg: "Could not send OTP" });
  }
};

export const resendOtp = async (req, res) => {
  try {
    const purpose = getOtpPurpose(req.body.purpose || "auth");
    const mode = String(req.body.mode || "").trim().toLowerCase();
    const requireExisting = purpose === "auth" ? !["signup", "profile", "role", "profile-registration"].includes(mode) : true;
    return sendOtpForPurpose({ req, res, purpose, requireExistingUser: requireExisting });
  } catch (err) {
    logOtpError("OTP resend failed:", err);
    res.status(500).json({ msg: "Could not resend OTP" });
  }
};

export const forgotPasswordOtp = async (req, res) => {
  try {
    return sendOtpForPurpose({
      req,
      res,
      purpose: "forgot-password",
      requireExistingUser: true,
      genericResponse: false,
    });
  } catch (err) {
    logOtpError("Forgot password OTP failed:", err);
    res.status(500).json({ msg: "Could not send password reset OTP" });
  }
};

export const verifyOtp = async (req, res) => {
  try {
    const parsed = parseIdentifier(req.body.identifier);
    const otp = String(req.body.otp || "").trim();
    const purpose = getOtpPurpose(req.body.purpose || "auth");
    const platform = getRequestPlatform(req);

    if (!parsed || !otp) {
      return res.status(400).json({ msg: "Identifier and OTP are required" });
    }

    const key = getOtpKey(platform, parsed, purpose);
    const record = otpStore.get(key);
    const verifyLock = getOtpVerificationLock(key);
    logAuthDebug("OTP verify route hit", {
      route: req.originalUrl,
      platform,
      channel: parsed.type,
      purpose,
      identifier: maskOtpKey(key),
    });

    if (verifyLock) {
      logAuthDebug("OTP verification throttled", {
        platform,
        channel: parsed.type,
        purpose,
        identifier: maskOtpKey(key),
        reason: "verify_locked",
        retryAfterSeconds: Math.ceil((verifyLock.lockedUntil - Date.now()) / 1000),
      });
      res.set("Retry-After", String(Math.ceil((verifyLock.lockedUntil - Date.now()) / 1000)));
      return res.status(429).json({ msg: OTP_THROTTLED_MESSAGE });
    }

    if (!record) {
      logAuthDebug("OTP verification failed", {
        platform,
        channel: parsed.type,
        purpose,
        identifier: maskOtpKey(key),
        reason: "missing_request",
      });
      return res.status(400).json({ msg: "Invalid OTP" });
    }

    if (record.expiresAt < Date.now()) {
      otpStore.delete(key);
      logAuthDebug("OTP verification failed", {
        platform,
        channel: parsed.type,
        purpose,
        identifier: maskOtpKey(key),
        reason: "expired",
      });
      return res.status(400).json({ msg: "OTP expired. Request a new OTP." });
    }

    if (record.verified && record.used) {
      return res.status(400).json({ msg: "Invalid OTP" });
    }

    if (record.otp !== otp) {
      const attempts = Number(record.attempts || 0) + 1;
      if (attempts >= Number(record.maxAttempts || getOtpMaxAttempts())) {
        otpStore.delete(key);
        lockOtpVerification(key);
        logAuthDebug("OTP verification failed", {
          platform,
          channel: parsed.type,
          purpose,
          identifier: maskOtpKey(key),
          reason: "max_attempts",
        });
        res.set("Retry-After", String(Math.ceil(OTP_LOCK_MS / 1000)));
        return res.status(429).json({ msg: OTP_THROTTLED_MESSAGE });
      }
      otpStore.set(key, { ...record, attempts });
      logAuthDebug("OTP verification failed", {
        platform,
        channel: parsed.type,
        purpose,
        identifier: maskOtpKey(key),
        reason: "invalid_otp",
      });
      return res.status(400).json({ msg: "Invalid OTP" });
    }

    otpStore.set(key, { ...record, otp: "", verified: true, used: true });
    const otpVerificationToken = createOtpVerificationToken({ platform, parsed, purpose });

    logAuthDebug("OTP verified", {
      platform,
      channel: parsed.type,
      purpose,
      identifier: maskOtpKey(key),
      tokenIssued: true,
    });

    res.json({
      message: "OTP verified",
      channel: parsed.type,
      otpVerificationToken,
    });
  } catch (err) {
    console.error("OTP verification failed:", err?.message || err);
    res.status(500).json({ msg: "OTP verification failed" });
  }
};

export const verifyMobileWidgetOtp = async (req, res) => {
  try {
    const parsed = parseIdentifier(req.body.identifier);
    const purpose = getOtpPurpose(req.body.purpose || "auth");
    const platform = getRequestPlatform(req);
    let msg91 = req.body.msg91 || req.body.providerData || {};
    const otp = String(req.body.otp || "").trim();
    const reqId = String(req.body.reqId || req.body.requestId || getProviderRequestId(msg91) || "").trim();

    if (!parsed || parsed.type !== "phone") {
      return res.status(400).json({ msg: "Valid phone number is required" });
    }

    const key = getOtpKey(platform, parsed, purpose);
    const record = otpStore.get(key);
    const verifyLock = getOtpVerificationLock(key);
    logAuthDebug("OTP verify route hit", {
      route: req.originalUrl,
      platform,
      channel: parsed.type,
      purpose,
      identifier: maskOtpKey(key),
    });

    if (verifyLock) {
      logAuthDebug("OTP verification throttled", {
        platform,
        channel: parsed.type,
        purpose,
        identifier: maskOtpKey(key),
        reason: "verify_locked",
        retryAfterSeconds: Math.ceil((verifyLock.lockedUntil - Date.now()) / 1000),
      });
      res.set("Retry-After", String(Math.ceil((verifyLock.lockedUntil - Date.now()) / 1000)));
      return res.status(429).json({ msg: OTP_THROTTLED_MESSAGE });
    }

    if (!record) {
      logAuthDebug("OTP verification failed", {
        platform,
        channel: parsed.type,
        purpose,
        identifier: maskOtpKey(key),
        reason: "missing_request",
      });
      return res.status(400).json({ msg: "Please request OTP first." });
    }

    if (record.expiresAt < Date.now()) {
      otpStore.delete(key);
      logAuthDebug("OTP verification failed", {
        platform,
        channel: parsed.type,
        purpose,
        identifier: maskOtpKey(key),
        reason: "expired",
      });
      return res.status(400).json({ msg: "OTP expired. Request a new OTP." });
    }

    if (record.used || record.verified) {
      return res.status(400).json({ msg: "Invalid OTP" });
    }

    if (!otp || !reqId) {
      return res.status(400).json({ msg: "OTP verification failed" });
    }

    try {
      msg91 = await verifyMsg91WidgetOtp({
        phone: parsed.value,
        otp,
        reqId,
        platform,
      });
    } catch (err) {
      const attempts = Number(record.attempts || 0) + 1;
      if (attempts >= Number(record.maxAttempts || getOtpMaxAttempts())) {
        otpStore.delete(key);
        lockOtpVerification(key);
        logAuthDebug("OTP verification failed", {
          platform,
          channel: parsed.type,
          purpose,
          identifier: maskOtpKey(key),
          reason: "max_attempts",
        });
        res.set("Retry-After", String(Math.ceil(OTP_LOCK_MS / 1000)));
        return res.status(429).json({ msg: OTP_THROTTLED_MESSAGE });
      }

      otpStore.set(key, { ...record, attempts });
      logAuthDebug("OTP verification failed", {
        platform,
        channel: parsed.type,
        purpose,
        identifier: maskOtpKey(key),
        reason: "invalid_otp",
      });
      return res.status(400).json({ msg: "Invalid OTP" });
    }

    if (!hasMsg91VerificationProof(msg91)) {
      const attempts = Number(record.attempts || 0) + 1;
      if (attempts >= Number(record.maxAttempts || getOtpMaxAttempts())) {
        otpStore.delete(key);
        lockOtpVerification(key);
        logAuthDebug("OTP verification failed", {
          platform,
          channel: parsed.type,
          purpose,
          identifier: maskOtpKey(key),
          reason: "max_attempts",
        });
        res.set("Retry-After", String(Math.ceil(OTP_LOCK_MS / 1000)));
        return res.status(429).json({ msg: OTP_THROTTLED_MESSAGE });
      }

      otpStore.set(key, { ...record, attempts });
      logAuthDebug("OTP verification failed", {
        platform,
        channel: parsed.type,
        purpose,
        identifier: maskOtpKey(key),
        reason: "invalid_otp",
      });
      return res.status(400).json({ msg: "OTP verification failed" });
    }

    const audit = sanitizeMsg91Audit({
      ...msg91,
      requestId: reqId || getProviderRequestId(msg91),
      verifiedAt: new Date().toISOString(),
    });
    const verifiedKey = storeWidgetVerification({ platform, parsed, purpose, audit });
    const otpVerificationToken = createOtpVerificationToken({ platform, parsed, purpose });

    if (String(process.env.APP_ENV || process.env.NODE_ENV || "").trim().toLowerCase() === "development") {
      console.log(`MSG91 widget verification accepted for ${maskOtpKey(verifiedKey)}`, {
        provider: "MSG91_WIDGET",
        requestId: audit.requestId || "",
      });
    }

    console.log("MSG91 widget verification accepted", {
      provider: "MSG91",
      flow: "widget",
      platform,
      channel: parsed.type,
      purpose,
      identifier: maskOtpKey(verifiedKey),
      requestId: audit.requestId || "",
      status: "verified",
      tokenIssued: true,
    });

    return res.json({ message: "OTP verified", channel: "phone", otpVerificationToken });
  } catch (err) {
    console.error("MSG91 widget verification failed:", err?.message || err);
    return res.status(500).json({ msg: "OTP verification failed" });
  }
};

export const isOtpVerified = (parsed, platform = "orchardgrowers", purpose = "auth", token = "") => {
  return validateOtpVerificationToken({ token, platform, parsed, purpose });
};

export const consumeOtpVerification = (parsed, platform = "orchardgrowers", purpose = "auth", token = "") => {
  consumeOtpVerificationToken(token);
  otpStore.delete(getOtpKey(platform, parsed, purpose));
};

export const resetPasswordWithOtp = async (req, res) => {
  try {
    const parsed = parseIdentifier(req.body.identifier || req.body.email);
    const otp = String(req.body.otp || "").trim();
    const otpVerificationToken = String(req.body.otpVerificationToken || "").trim();
    const password = String(req.body.password || "");
    const platform = getRequestPlatform(req);

    if (!parsed || (!otp && !otpVerificationToken) || !password) {
      return res.status(400).json({ msg: "Identifier, OTP, and new password are required" });
    }

    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      return res.status(400).json({ msg: "Password must be at least 8 characters and include a letter and a number" });
    }

    const key = getOtpKey(platform, parsed, "forgot-password");
    const record = otpStore.get(key);
    const verifyLock = getOtpVerificationLock(key);
    const hasVerifiedResetToken = validateOtpVerificationToken({
      token: otpVerificationToken,
      platform,
      parsed,
      purpose: "forgot-password",
    });

    if (verifyLock) {
      logAuthDebug("Password reset OTP throttled", {
        platform,
        channel: parsed.type,
        purpose: "forgot-password",
        identifier: maskOtpKey(key),
        reason: "verify_locked",
        retryAfterSeconds: Math.ceil((verifyLock.lockedUntil - Date.now()) / 1000),
      });
      res.set("Retry-After", String(Math.ceil((verifyLock.lockedUntil - Date.now()) / 1000)));
      return res.status(429).json({ msg: OTP_THROTTLED_MESSAGE });
    }

    if (!record && !hasVerifiedResetToken) {
      return res.status(400).json({ msg: "Invalid OTP" });
    }

    if (record && record.expiresAt < Date.now()) {
      otpStore.delete(key);
      return res.status(400).json({ msg: "OTP expired. Request a new OTP." });
    }

    if (record && (record.used || record.verified) && !hasVerifiedResetToken) {
      return res.status(400).json({ msg: "Invalid OTP" });
    }

    if (!hasVerifiedResetToken && record.otp !== otp) {
      const attempts = Number(record.attempts || 0) + 1;
      if (attempts >= Number(record.maxAttempts || getOtpMaxAttempts())) {
        otpStore.delete(key);
        lockOtpVerification(key);
        logAuthDebug("Password reset OTP failed", {
          platform,
          channel: parsed.type,
          purpose: "forgot-password",
          identifier: maskOtpKey(key),
          reason: "max_attempts",
        });
        res.set("Retry-After", String(Math.ceil(OTP_LOCK_MS / 1000)));
        return res.status(429).json({ msg: OTP_THROTTLED_MESSAGE });
      }
      otpStore.set(key, { ...record, attempts });
      return res.status(400).json({ msg: "Invalid OTP" });
    }

    const user = await findByParsedIdentifier(parsed);
    if (!user) {
      otpStore.delete(key);
      return res.status(400).json({ msg: "Invalid OTP" });
    }

    user.password = await bcrypt.hash(password, 10);
    await user.save();
    if (hasVerifiedResetToken) consumeOtpVerificationToken(otpVerificationToken);
    otpStore.delete(key);

    return res.json({ message: "Password reset successful. Please login." });
  } catch (err) {
    console.error("Password reset failed:", err.message || err);
    return res.status(500).json({ msg: "Could not reset password" });
  }
};

// ================= REGISTER USER =================
export const registerUser = async (req, res) => {
  try {
    const { name, identifier, password, otpVerificationToken } = req.body;
    const parsed = parseIdentifier(identifier);
    const platform = getRequestPlatform(req);

    if (!name || !parsed || !password) {
      return res.status(400).json({ msg: "Name, email/phone, and password are required" });
    }

    if (!isOtpVerified(parsed, platform, "auth", otpVerificationToken)) {
      return res.status(400).json({ msg: "Verify OTP before signup" });
    }

    const existingUser = await findByParsedIdentifier(parsed);

    if (existingUser) {
      return res.status(409).json({ msg: ACCOUNT_EXISTS_SIGNIN_MESSAGE });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: name.trim(),
      [parsed.type]: parsed.value,
      password: hashedPassword,
      role: null,
      profileTypes: [],
    });

    consumeOtpVerification(parsed, platform, "auth", otpVerificationToken);
    const { accessToken, refreshToken } = createTokenPair(user);

    logAuthDebug("Auth session issued", {
      route: req.originalUrl,
      platform,
      channel: parsed.type,
      purpose: "auth",
      identifier: maskOtpKey(getOtpKey(platform, parsed, "auth")),
      flow: "signup",
    });

    res.json({
      message: "User registered successfully",
      accessToken,
      refreshToken,
      user: safeUserPayload(user),
    });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ msg: ACCOUNT_EXISTS_SIGNIN_MESSAGE });
    }
    console.error(err);
    res.status(500).json({ msg: err.message });
  }
};

// ================= LOGIN USER =================
export const loginUser = async (req, res) => {
  try {
    const { identifier, password, otpVerificationToken } = req.body;
    const parsed = parseIdentifier(identifier);
    const platform = getRequestPlatform(req);

    if (!parsed || !password) {
      return res.status(400).json({ msg: "Email/phone and password required" });
    }

    if (!isOtpVerified(parsed, platform, "auth", otpVerificationToken)) {
      return res.status(400).json({ msg: "Verify OTP before login" });
    }

    const user = await findByParsedIdentifier(parsed);

    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    if (user.accountStatus && user.accountStatus !== "ACTIVE") {
      return res.status(403).json({ msg: `Account ${String(user.accountStatus).toLowerCase()}. Contact support.` });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ msg: "Invalid password" });
    }

    const { accessToken, refreshToken } = createTokenPair(user);

    consumeOtpVerification(parsed, platform, "auth", otpVerificationToken);

    logAuthDebug("Auth session issued", {
      route: req.originalUrl,
      platform,
      channel: parsed.type,
      purpose: "auth",
      identifier: maskOtpKey(getOtpKey(platform, parsed, "auth")),
      flow: "login",
    });

    res.json({
      message: "Login successful",
      accessToken,
      refreshToken,
      user: safeUserPayload(user),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: err.message });
  }
};

const OAUTH_PLATFORM_ALIASES = {
  orchard: "orchardgrowers",
  orchardgrowers: "orchardgrowers",
  "orchard-growers": "orchardgrowers",
  efruitmandi: "efruitmandi",
  "efruitmandi.live": "efruitmandi",
  efm: "efruitmandi",
};
const normalizeOAuthPlatform = (value = "") => {
  const normalized = String(value || "").trim().toLowerCase();
  return OAUTH_PLATFORM_ALIASES[normalized] || "orchardgrowers";
};
const getOAuthPlatformFromRoute = (req) => {
  const routePath = String(req.originalUrl || req.path || "").toLowerCase();
  if (routePath.includes("/api/auth/efruitmandi/")) return "efruitmandi";
  if (routePath.includes("/api/auth/orchard/")) return "orchardgrowers";
  return "";
};
const getOAuthAppFromRequest = (req) =>
  normalizeOAuthPlatform(getOAuthPlatformFromRoute(req) || req.query.app || req.query.platform);
const getRequestBaseUrl = (req) => `${req.protocol}://${req.get("host")}`;
const getPlatformEnvName = (platform) => (normalizeOAuthPlatform(platform) === "efruitmandi" ? "EFRUITMANDI" : "ORCHARD");
const getPlatformRouteSlug = (platform) => (normalizeOAuthPlatform(platform) === "efruitmandi" ? "efruitmandi" : "orchard");
const getProductionOAuthCallbackOrigin = (platform) =>
  normalizeOAuthPlatform(platform) === "efruitmandi"
    ? String(process.env.EFRUITMANDI_API_URL || "https://api.efruitmandi.live").trim().replace(/\/+$/, "")
    : String(process.env.ORCHARD_API_URL || "https://api.orchardgrowers.in").trim().replace(/\/+$/, "");
const getOAuthCallbackPath = (provider, platform) => `/api/auth/${getPlatformRouteSlug(platform)}/${provider}/callback`;
const coerceOAuthCallbackUrl = (value, provider, platform) => {
  const cleanValue = String(value || "").trim();
  if (!cleanValue) return "";
  try {
    const url = new URL(cleanValue);
    url.pathname = getOAuthCallbackPath(provider, platform);
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
};
const getOAuthCallbackUrl = (req, provider) => {
  const platform = normalizeOAuthPlatform(
    getOAuthPlatformFromRoute(req) || req.query.app || req.query.platform || readOAuthState(req.query.state).platform
  );
  const envPrefix = provider === "google" ? "GOOGLE_CALLBACK_URL" : "FACEBOOK_CALLBACK_URL";
  const platformEnvKey = `${envPrefix}_${getPlatformEnvName(platform)}`;
  const configuredCallback = coerceOAuthCallbackUrl(process.env[platformEnvKey], provider, platform);
  if (configuredCallback) return configuredCallback;
  const genericCallback = coerceOAuthCallbackUrl(process.env[envPrefix], provider, platform);
  if (genericCallback) return genericCallback;
  if (isProductionLikeOAuth()) {
    return `${getProductionOAuthCallbackOrigin(platform)}${getOAuthCallbackPath(provider, platform)}`;
  }
  return `${getRequestBaseUrl(req)}${getOAuthCallbackPath(provider, platform)}`;
};
const getFacebookGraphVersion = () => {
  const configured = String(process.env.FACEBOOK_GRAPH_VERSION || "v25.0").trim();
  return /^v\d+\.\d+$/.test(configured) ? configured : "v25.0";
};
const getGoogleOAuthConfig = (platform) => {
  const normalizedPlatform = normalizeOAuthPlatform(platform);
  const clientId =
    normalizedPlatform === "efruitmandi"
      ? process.env.GOOGLE_CLIENT_ID_EFRUITMANDI
      : process.env.GOOGLE_CLIENT_ID_ORCHARD;
  const clientSecret =
    normalizedPlatform === "efruitmandi"
      ? process.env.GOOGLE_CLIENT_SECRET_EFRUITMANDI
      : process.env.GOOGLE_CLIENT_SECRET_ORCHARD;

  return { clientId, clientSecret };
};
const getFacebookOAuthConfig = (platform) => {
  const normalizedPlatform = normalizeOAuthPlatform(platform);
  const appId =
    normalizedPlatform === "efruitmandi"
      ? process.env.FACEBOOK_APP_ID_EFRUITMANDI
      : process.env.FACEBOOK_APP_ID_ORCHARD;
  const appSecret =
    normalizedPlatform === "efruitmandi"
      ? process.env.FACEBOOK_APP_SECRET_EFRUITMANDI
      : process.env.FACEBOOK_APP_SECRET_ORCHARD;

  return { appId, appSecret };
};
const isBackendUrl = (value = "") => {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host.includes("onrender.com") || host.includes("orchard-growers-backend");
  } catch {
    return false;
  }
};
const firstFrontendUrl = (...values) =>
  values.map((value) => String(value || "").trim()).find((value) => value && !isBackendUrl(value)) || "";
const getFrontendUrl = (platform) => {
  if (platform === "efruitmandi") {
    return firstFrontendUrl(
      process.env.EFRUITMANDI_FRONTEND_URL,
      process.env.EFRUITMANDI_CLIENT_URL,
      process.env.EFRUITMANDI_URL,
      isProductionLikeOAuth() ? "https://efruitmandi.live" : "http://localhost:3000"
    );
  }

  return firstFrontendUrl(
    process.env.ORCHARD_FRONTEND_URL,
    process.env.CLIENT_URL,
    process.env.ORCHARDGROWERS_CLIENT_URL,
    process.env.ORCHARD_URL,
    isProductionLikeOAuth() ? "https://orchardgrowers.in" : "http://localhost:3001"
  );
};
const isProductionLikeOAuth = () => {
  const runtime = String(process.env.APP_ENV || process.env.NODE_ENV || "").trim().toLowerCase();
  return runtime === "production" || runtime === "staging";
};
const getOAuthFallbackUrl = (platform) => {
  const baseUrl = getFrontendUrl(platform);
  if (!baseUrl) return "";
  if (isBackendUrl(baseUrl)) {
    console.error("OAuth frontend URL points to backend; refusing /login redirect.", {
      platform,
      host: new URL(baseUrl).hostname,
    });
    return "";
  }
  return `${baseUrl.replace(/\/+$/, "")}/login`;
};
const redirectOAuthError = (res, platform, message, extraParams = {}) => {
  const fallbackUrl = getOAuthFallbackUrl(platform);
  if (!fallbackUrl) return res.status(400).json({ msg: message });

  const separator = fallbackUrl.includes("?") ? "&" : "?";
  console.log("Redirecting to frontend:", fallbackUrl);
  const params = new URLSearchParams({ oauthError: message, ...extraParams });
  return res.redirect(`${fallbackUrl}${separator}${params.toString()}`);
};
const redirectFacebookMissingEmail = (res, platform) => {
  const fallbackUrl = getOAuthFallbackUrl(platform);
  const message = "Facebook account did not provide an email address. Please sign up with Google, email, or phone.";
  if (!fallbackUrl) return res.status(400).json({ msg: message });

  const separator = fallbackUrl.includes("?") ? "&" : "?";
  console.log("Facebook redirect frontend:", fallbackUrl);
  const params = new URLSearchParams({ oauthError: message, oauthSignup: "facebook" });
  return res.redirect(`${fallbackUrl}${separator}${params.toString()}`);
};
const normalizeOAuthMode = (value = "") => {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "signup" ? "signup" : "login";
};
const createOAuthState = ({ platform, provider, mode, termsAccepted = false }) =>
  jwt.sign(
    { platform: normalizeOAuthPlatform(platform), provider, mode: normalizeOAuthMode(mode), termsAccepted: Boolean(termsAccepted) },
    process.env.JWT_SECRET,
    { expiresIn: "10m" }
  );
const readOAuthState = (state) => {
  try {
    return jwt.verify(state, process.env.JWT_SECRET);
  } catch {
    return { platform: normalizeOAuthPlatform(state) };
  }
};
const redirectOAuthSuccess = (res, platform, payload) => {
  const fallbackUrl = getOAuthFallbackUrl(platform);
  if (!fallbackUrl) return res.json(payload);

  const params = new URLSearchParams({
    oauth: "success",
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
    user: Buffer.from(JSON.stringify(payload.user), "utf8").toString("base64url"),
  });
  console.log("Redirecting to frontend:", fallbackUrl);
  return res.redirect(`${fallbackUrl}#${params.toString()}`);
};
const createOAuthPassword = async () =>
  bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10);
const DEFAULT_OAUTH_NAMES = new Set(["", "OrchardGrowers", "User"]);
const upsertOAuthUser = async ({ provider, providerId, email, name, avatarUrl, mode = "login", termsAccepted = false }) => {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const nextName = String(name || "").trim();
  const nextAvatarUrl = String(avatarUrl || "").trim();
  const oauthMode = normalizeOAuthMode(mode);
  if (!providerId || !normalizedEmail) {
    const error = new Error("OAuth account did not provide a verified email address.");
    error.statusCode = 400;
    throw error;
  }

  let user = await User.findOne({
    $or: [
      { email: normalizedEmail },
      { provider, providerId },
      { oauthProviders: { $elemMatch: { provider, providerId } } },
    ],
  });

  if (!user) {
    if (oauthMode === "login") {
      const error = new Error("Social account is not signed up yet. Please sign up first.");
      error.statusCode = 404;
      error.code = "OAUTH_SIGNUP_REQUIRED";
      throw error;
    }
    if (!termsAccepted) {
      const error = new Error("Accept Terms & Conditions before social signup.");
      error.statusCode = 400;
      throw error;
    }

    user = await User.create({
      name: nextName || normalizedEmail.split("@")[0] || "User",
      email: normalizedEmail,
      password: await createOAuthPassword(),
      avatarUrl: nextAvatarUrl,
      provider,
      providerId,
      oauthProviders: [{ provider, providerId }],
      role: null,
      profileTypes: [],
    });
    return user;
  }

  if (user.accountStatus && user.accountStatus !== "ACTIVE") {
    const error = new Error(`Account ${String(user.accountStatus).toLowerCase()}. Contact support.`);
    error.statusCode = 403;
    throw error;
  }

  user.email = user.email || normalizedEmail;
  const wasSameOAuthProvider = user.provider === provider;
  const isSwitchingOAuthProvider =
    user.provider && user.provider !== "local" && user.provider !== provider;
  if (
    nextName &&
    (DEFAULT_OAUTH_NAMES.has(String(user.name || "").trim()) ||
      wasSameOAuthProvider ||
      isSwitchingOAuthProvider)
  ) {
    user.name = nextName;
  }
  if (nextAvatarUrl && (!user.avatarUrl || wasSameOAuthProvider || isSwitchingOAuthProvider)) {
    user.avatarUrl = nextAvatarUrl;
  }
  user.provider = provider;
  user.providerId = providerId;

  const alreadyLinked = user.oauthProviders?.some(
    (item) => item.provider === provider && item.providerId === providerId
  );
  if (!alreadyLinked) {
    user.oauthProviders = [...(user.oauthProviders || []), { provider, providerId }];
  }

  await user.save();
  return user;
};
const completeOAuthLogin = async (res, platform, oauthProfile) => {
  let user;
  try {
    user = await upsertOAuthUser(oauthProfile);
  } catch (err) {
    if (err.code === "OAUTH_SIGNUP_REQUIRED") {
      return redirectOAuthError(res, platform, err.message, {
        oauthSignup: oauthProfile.provider,
      });
    }
    throw err;
  }
  const tokens = createTokenPair(user);
  if (oauthProfile.provider === "facebook") {
    console.log("Facebook redirect frontend:", getOAuthFallbackUrl(platform));
  }
  return redirectOAuthSuccess(res, platform, {
    message: "Login successful",
    ...tokens,
    user: safeUserPayload(user),
  });
};

export const startGoogleOAuth = (req, res) => {
  try {
    const platform = getOAuthAppFromRequest(req);
    const googleConfig = getGoogleOAuthConfig(platform);
    logAuthDebug("OAuth start", {
      provider: "google",
      platform,
      route: req.originalUrl,
      envGroup: platform === "efruitmandi" ? "EFRUITMANDI/GOOGLE" : "ORCHARD/GOOGLE",
      configured: Boolean(googleConfig.clientId && googleConfig.clientSecret),
    });
    if (!googleConfig.clientId || !googleConfig.clientSecret) {
      return redirectOAuthError(res, platform, "Google OAuth is not configured.");
    }

    const oauth2Client = new google.auth.OAuth2(
      googleConfig.clientId,
      googleConfig.clientSecret,
      getOAuthCallbackUrl(req, "google")
    );
    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "select_account",
      scope: ["openid", "email", "profile"],
      state: createOAuthState({
        platform,
        provider: "google",
        mode: req.query.mode,
        termsAccepted: req.query.termsAccepted === "true",
      }),
    });

    return res.redirect(url);
  } catch (err) {
    console.error("Google OAuth start failed:", err.message || err);
    return res.status(500).json({ msg: "Could not start Google login" });
  }
};

export const handleGoogleOAuthCallback = async (req, res) => {
  const state = readOAuthState(req.query.state);
  const platform = normalizeOAuthPlatform(getOAuthPlatformFromRoute(req) || state.platform);
  const googleConfig = getGoogleOAuthConfig(platform);
  logAuthDebug("OAuth callback", {
    provider: "google",
    platform,
    envGroup: platform === "efruitmandi" ? "EFRUITMANDI/GOOGLE" : "ORCHARD/GOOGLE",
    hasCode: Boolean(req.query.code),
  });

  try {
    if (!req.query.code) {
      return redirectOAuthError(res, platform, "Google login was cancelled.");
    }
    if (!googleConfig.clientId || !googleConfig.clientSecret) {
      return redirectOAuthError(res, platform, "Google OAuth is not configured.");
    }

    const oauth2Client = new google.auth.OAuth2(
      googleConfig.clientId,
      googleConfig.clientSecret,
      getOAuthCallbackUrl(req, "google")
    );
    const { tokens } = await oauth2Client.getToken(String(req.query.code));
    const ticket = await oauth2Client.verifyIdToken({
      idToken: tokens.id_token,
      audience: googleConfig.clientId,
    });
    const payload = ticket.getPayload() || {};
    if (!payload.email_verified) {
      return redirectOAuthError(res, platform, "Google email is not verified.");
    }

    return completeOAuthLogin(res, platform, {
      provider: "google",
      providerId: payload.sub,
      email: payload.email,
      name: payload.name,
      avatarUrl: payload.picture,
      mode: state.mode,
      termsAccepted: state.termsAccepted,
    });
  } catch (err) {
    console.error("Google OAuth callback failed:", err.message || err);
    return redirectOAuthError(res, platform, err.statusCode ? err.message : "Google login failed.");
  }
};

export const startFacebookOAuth = (req, res) => {
  try {
    const platform = getOAuthAppFromRequest(req);
    const facebookConfig = getFacebookOAuthConfig(platform);
    logAuthDebug("OAuth start", {
      provider: "facebook",
      platform,
      route: req.originalUrl,
      envGroup: platform === "efruitmandi" ? "EFRUITMANDI/FACEBOOK" : "ORCHARD/FACEBOOK",
      configured: Boolean(facebookConfig.appId && facebookConfig.appSecret),
    });
    if (!facebookConfig.appId || !facebookConfig.appSecret) {
      return redirectOAuthError(res, platform, "Facebook OAuth is not configured.");
    }

    const params = new URLSearchParams({
      client_id: facebookConfig.appId,
      redirect_uri: getOAuthCallbackUrl(req, "facebook"),
      state: createOAuthState({
        platform,
        provider: "facebook",
        mode: req.query.mode,
        termsAccepted: req.query.termsAccepted === "true",
      }),
      scope: "email,public_profile",
      response_type: "code",
    });

    return res.redirect(`https://www.facebook.com/${getFacebookGraphVersion()}/dialog/oauth?${params.toString()}`);
  } catch (err) {
    console.error("Facebook OAuth start failed:", err.message || err);
    return res.status(500).json({ msg: "Could not start Facebook login" });
  }
};

export const handleFacebookOAuthCallback = async (req, res) => {
  const state = readOAuthState(req.query.state);
  const platform = normalizeOAuthPlatform(getOAuthPlatformFromRoute(req) || state.platform);
  const facebookConfig = getFacebookOAuthConfig(platform);
  logAuthDebug("OAuth callback", {
    provider: "facebook",
    platform,
    envGroup: platform === "efruitmandi" ? "EFRUITMANDI/FACEBOOK" : "ORCHARD/FACEBOOK",
    hasCode: Boolean(req.query.code),
  });

  try {
    if (!req.query.code) {
      return redirectOAuthError(res, platform, "Facebook login was cancelled.");
    }
    if (!facebookConfig.appId || !facebookConfig.appSecret) {
      return redirectOAuthError(res, platform, "Facebook OAuth is not configured.");
    }

    const graphVersion = getFacebookGraphVersion();
    const tokenRes = await axios.get(`https://graph.facebook.com/${graphVersion}/oauth/access_token`, {
      params: {
        client_id: facebookConfig.appId,
        client_secret: facebookConfig.appSecret,
        redirect_uri: getOAuthCallbackUrl(req, "facebook"),
        code: req.query.code,
      },
    });
    const profileRes = await axios.get(`https://graph.facebook.com/${graphVersion}/me`, {
      params: {
        fields: "id,name,email,picture.type(large)",
        access_token: tokenRes.data.access_token,
      },
    });
    const profile = profileRes.data || {};
    if (!profile.email) {
      return redirectFacebookMissingEmail(res, platform);
    }

    return completeOAuthLogin(res, platform, {
      provider: "facebook",
      providerId: profile.id,
      email: profile.email,
      name: profile.name,
      avatarUrl: profile.picture?.data?.url,
      mode: state.mode,
      termsAccepted: state.termsAccepted,
    });
  } catch (err) {
    console.error("Facebook OAuth callback failed:", err.response?.data || err.message || err);
    const providerMessage =
      err.response?.data?.error?.message ||
      err.response?.data?.message ||
      err.message ||
      "";
    const callbackMessage = /redirect_uri|valid oauth redirect/i.test(providerMessage)
      ? "Facebook OAuth redirect URL is not configured for this domain."
      : err.statusCode
        ? err.message
        : "Facebook login failed.";
    return redirectOAuthError(res, platform, callbackMessage);
  }
};

export const getCurrentAuthUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: "User not found" });
    return res.json(safeUserPayload(user));
  } catch (err) {
    console.error("Auth profile failed:", err.message || err);
    return res.status(500).json({ msg: "Could not load user" });
  }
};

export const logoutUser = async (req, res) => {
  return res.json({ message: "Logged out" });
};

// ================= REFRESH TOKEN =================
export const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ msg: "No refresh token provided" });
    }

    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET
    );

    const user = await User.findById(decoded.id).select("_id role");

    if (!user) {
      return res.status(401).json({ msg: "User not found" });
    }

    const { accessToken: newAccessToken } = createTokenPair(user);

    res.json({
      accessToken: newAccessToken,
    });
  } catch (err) {
    console.error("Refresh Error:", err.message);
    return res.status(403).json({ msg: "Invalid refresh token" });
  }
};
