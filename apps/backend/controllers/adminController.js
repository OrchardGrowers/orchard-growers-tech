import Admin from "../models/Admin.js";
import User from "../models/User.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import VerificationRequest from "../models/VerificationRequest.js";
import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { sendEmail, sendOtpEmail } from "../services/mailService.js";
import {
  getAdminProductFolder,
  uploadBufferToCloudinary,
} from "../services/cloudinaryService.js";

const ADMIN_SELECT = "-password -__v";
const USER_SELECT = "-password -__v";
const ADMIN_MAIL_PLATFORM = "admin";
const adminOtpStore = new Map();
const adminPasswordSetupTokens = new Map();
const adminOtpSendThrottleStore = new Map();
const adminOtpVerifyLockStore = new Map();
const OTP_THROTTLED_MESSAGE = "Too many OTP requests. Please try again later.";
const OTP_RESEND_INTERVAL_MS = 60 * 1000;
const OTP_SEND_WINDOW_MS = 10 * 60 * 1000;
const OTP_MAX_SENDS_PER_WINDOW = 3;
const OTP_LOCK_MS = 15 * 60 * 1000;
const ADMIN_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "UNIT_MANAGER",
  "INVENTORY_MANAGER",
  "SALES_EXECUTIVE",
  "PURCHASE_MANAGER",
  "FINANCE_MANAGER",
  "VERIFICATION_OFFICER",
  "SUPPORT_EXECUTIVE",
  "VIEWER",
  "EMPLOYEE",
];
const ADMIN_STATUSES = ["PENDING", "ACTIVE", "SUSPENDED", "REJECTED", "TERMINATED"];
const USER_ROLES = [null, "grower", "buyer", "driver"];
const USER_STATUSES = ["ACTIVE", "HOLD", "SUSPENDED", "TERMINATED"];
const KYC_REVIEW_STATUSES = ["PENDING", "UNDER_REVIEW", "APPROVED", "REJECTED", "CORRECTION_REQUIRED", "COMPLETED"];
const KYC_SUBMITTED_STATUS_PATTERN = /^(pending|under_review|approved|rejected|correction_required|completed|submitted)$/i;
const ROLE_LABELS = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  UNIT_MANAGER: "Unit Manager",
  INVENTORY_MANAGER: "Inventory Manager",
  SALES_EXECUTIVE: "Sales Executive",
  PURCHASE_MANAGER: "Purchase Manager",
  FINANCE_MANAGER: "Finance Manager",
  VERIFICATION_OFFICER: "Verification Officer",
  SUPPORT_EXECUTIVE: "Support Executive",
  VIEWER: "Viewer",
  EMPLOYEE: "Admin",
};
const ADMIN_CLASS_LABELS = {
  SUPER_ADMIN: "SUPER",
  ADMIN: "CLASS1",
  VERIFICATION_OFFICER: "CLASS2",
  EMPLOYEE: "CLASS2",
};
const INTERNAL_ADMIN_CLASSES = new Set(["CLASS_I", "CLASS_II", "CLASS_III"]);
const ROLE_INTERNAL_CLASS = {
  SUPER_ADMIN: "CLASS_I",
  ADMIN: "CLASS_I",
  UNIT_MANAGER: "CLASS_II",
  INVENTORY_MANAGER: "CLASS_II",
  SALES_EXECUTIVE: "CLASS_III",
  PURCHASE_MANAGER: "CLASS_II",
  FINANCE_MANAGER: "CLASS_II",
  VERIFICATION_OFFICER: "CLASS_II",
  SUPPORT_EXECUTIVE: "CLASS_III",
  VIEWER: "CLASS_III",
  EMPLOYEE: "CLASS_III",
};

const normalizeEmail = (email = "") => email.trim().toLowerCase();
const normalizeKycStatus = (status = "") => {
  const normalized = String(status || "").trim().toUpperCase();
  if (normalized === "SUBMITTED") return "PENDING";
  return normalized;
};
const getKycProfileTypes = (user = {}) => {
  const profiles = new Set(Array.isArray(user.profileTypes) ? user.profileTypes.map((role) => String(role).toLowerCase()) : []);
  const role = String(user.role || "").toLowerCase();

  if (role) profiles.add(role);
  if (user.orchardName || user.kyc?.orchardName) profiles.add("grower");
  if (user.businessName) profiles.add("buyer");
  if (user.logisticsName || user.kyc?.vehicleNumber || user.kyc?.drivingLicenseNumber) profiles.add("driver");

  return profiles;
};
const hasGrowerKycFields = (user = {}) =>
  Boolean(
    user.kyc?.orchardName ||
      user.kyc?.orchardLocation ||
      user.kyc?.udyanCardNo ||
      user.kyc?.udyanCardFileUrl
  );
const getKycRoleType = (user = {}) => {
  const profiles = getKycProfileTypes(user);
  const kycRole = String(user.kyc?.roleType || "").toLowerCase();
  const userRole = String(user.role || "").toLowerCase();

  if (USER_ROLES.includes(kycRole) && (profiles.size === 0 || profiles.has(kycRole))) return kycRole;
  if (hasGrowerKycFields(user)) return "grower";
  if (USER_ROLES.includes(userRole) && (profiles.size === 0 || profiles.has(userRole))) return userRole;
  if (profiles.has("grower")) return "grower";
  if (profiles.has("buyer")) return "buyer";
  if (profiles.has("driver")) return "driver";
  return kycRole || userRole || "";
};
const PASSWORD_RULE_MESSAGE = "Password must be at least 8 characters and include a letter and a number";
const ADMIN_NOT_APPROVED_MESSAGE = "This email is not approved for admin access.";
const ADMIN_RESET_TOKEN_TTL_MS = 30 * 60 * 1000;
const ADMIN_SETUP_TOKEN_TTL_MS = 10 * 60 * 1000;
const CLASS_I_ADMIN_EMAILS = [
  "pawann@orchardgrowers.in",
  "founder@orchardgrowers.in",
  "adminho@orchardgrowers.in",
  "komal@orchardgrowers.in",
].map(normalizeEmail);
const CLASS_II_ADMIN_EMAILS = [
  "testadminclassII@orchardgrowers.in",
  "hr.ho@orchardgrowers.in",
  "invest@orchardgrowers.in",
  "careers@orchardgrowers.in",
  "grievance@orchardgrowers.in",
].map(normalizeEmail);
const CLASS_III_ADMIN_EMAILS = [
  "testadminclassIII@orchardgrowers.in",
  "sales.ffccbb@orchardgrowers.in",
].map(normalizeEmail);
const ADDITIONAL_ALLOWED_ADMIN_EMAILS = [
  "Arpit.Aggarwal@anarock.com",
].map(normalizeEmail);
const ALLOWED_ADMIN_SIGNUP_EMAILS = new Set([
  ...CLASS_I_ADMIN_EMAILS,
  ...CLASS_II_ADMIN_EMAILS,
  ...CLASS_III_ADMIN_EMAILS,
  ...ADDITIONAL_ALLOWED_ADMIN_EMAILS,
]);
const ADMIN_SIGNUP_ROLE_BY_EMAIL = new Map(
  [
    ...CLASS_I_ADMIN_EMAILS.map((email) => [email, "ADMIN"]),
    ...CLASS_II_ADMIN_EMAILS.map((email) => [email, "VERIFICATION_OFFICER"]),
    ...CLASS_III_ADMIN_EMAILS.map((email) => [email, "VIEWER"]),
  ]
);

const signAdminToken = (admin) =>
  jwt.sign(
    { id: admin._id, role: admin.role, adminRole: admin.role },
    process.env.JWT_SECRET
  );

const isMasterLogin = (email, password) => {
  const masterEmail = normalizeEmail(process.env.MASTER_ADMIN_EMAIL || "");
  const masterPassword = process.env.MASTER_ADMIN_PASSWORD || "";

  return Boolean(masterEmail && masterPassword && email === masterEmail && password === masterPassword);
};
const isMasterAdminEmail = (email) => {
  const masterEmail = normalizeEmail(process.env.MASTER_ADMIN_EMAIL || "");
  return Boolean(masterEmail && email === masterEmail);
};
const getAdminRoleLabel = (admin) => {
  const email = normalizeEmail(admin.email);
  if (CLASS_I_ADMIN_EMAILS.includes(email)) return "Class I || Admins";
  if (CLASS_II_ADMIN_EMAILS.includes(email)) return "Class II || Admins";
  if (CLASS_III_ADMIN_EMAILS.includes(email)) return "Class III || Admins";
  return ROLE_LABELS[admin.role] || admin.role;
};

const safeAdmin = (admin) => ({
  id: admin._id,
  _id: admin._id,
  name: admin.name,
  email: admin.email,
  phone: admin.phone || "",
  role: admin.role,
  roleLabel: getAdminRoleLabel(admin),
  adminClass: getInternalAdminClass(admin),
  status: admin.status,
  createdAt: admin.createdAt,
  approvedBy: admin.approvedBy,
  approvedAt: admin.approvedAt,
  createdBy: admin.createdBy,
  auditLogs: admin.auditLogs || [],
});

const getAdminClass = (role) => ADMIN_CLASS_LABELS[role] || "CLASS2";
const normalizeInternalAdminClass = (value = "") => {
  const normalized = String(value || "").trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (["CLASS_I", "CLASS1", "CLASS_1", "I", "SUPER"].includes(normalized)) return "CLASS_I";
  if (["CLASS_II", "CLASS2", "CLASS_2", "II"].includes(normalized)) return "CLASS_II";
  if (["CLASS_III", "CLASS3", "CLASS_3", "III"].includes(normalized)) return "CLASS_III";
  return "";
};
const getInternalAdminClass = (admin = {}) => {
  const safeAdmin = admin || {};
  const storedClass = normalizeInternalAdminClass(safeAdmin.adminClass);
  if (storedClass) return storedClass;

  const email = normalizeEmail(safeAdmin.email);
  if (CLASS_I_ADMIN_EMAILS.includes(email)) return "CLASS_I";
  if (CLASS_II_ADMIN_EMAILS.includes(email)) return "CLASS_II";
  if (CLASS_III_ADMIN_EMAILS.includes(email)) return "CLASS_III";
  return ROLE_INTERNAL_CLASS[safeAdmin.role] || "";
};
const isEligibleInternalAdmin = (admin) =>
  Boolean(
    admin &&
      admin.status === "ACTIVE" &&
      ADMIN_ROLES.includes(admin.role) &&
      INTERNAL_ADMIN_CLASSES.has(getInternalAdminClass(admin))
  );
const canManageAdminClass = (currentAdmin, targetClass) => {
  const currentClass = getInternalAdminClass(currentAdmin);
  if (currentClass === "CLASS_I") return ["CLASS_II", "CLASS_III"].includes(targetClass);
  if (currentClass === "CLASS_II") return targetClass === "CLASS_III" && Boolean(currentAdmin?.canManageClassIII);
  return false;
};
const appendAdminAudit = (admin, action, by, from = {}, to = {}, note = "") => {
  admin.auditLogs = admin.auditLogs || [];
  admin.auditLogs.push({ action, by: by?._id || by?.id, at: new Date(), from, to, note });
  console.log("Admin management audit", {
    action,
    targetAdmin: maskAdminEmail(admin.email),
    by: by?.email ? maskAdminEmail(by.email) : by?.id || "",
    targetClass: getInternalAdminClass(admin),
    targetStatus: admin.status,
  });
};
const adminHasPassword = (admin = {}) => {
  const safeAdmin = admin || {};
  return Boolean(safeAdmin.hasPassword || String(safeAdmin.password || "").trim());
};
const adminRequiresPasswordSetup = (admin = {}) => {
  const safeAdmin = admin || {};
  return !adminHasPassword(safeAdmin) || safeAdmin.mustSetPassword === true;
};
const ensureAdminClassPersisted = async (admin) => {
  if (!admin) return "";
  const adminClass = getInternalAdminClass(admin);
  if (admin.adminClass || !INTERNAL_ADMIN_CLASSES.has(adminClass)) return adminClass;
  admin.adminClass = adminClass;
  await admin.save();
  return adminClass;
};
const getAdminOtpMaxAttempts = () => {
  const attempts = Number(process.env.OTP_MAX_ATTEMPTS || 5);
  return Number.isFinite(attempts) && attempts > 0 ? Math.min(attempts, 5) : 5;
};

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const getAdminOtpTtlMs = () => {
  const minutes = Number(process.env.OTP_EXPIRY_MINUTES || 5);
  return (Number.isFinite(minutes) && minutes > 0 ? minutes : 5) * 60 * 1000;
};
const createAdminOtp = () => String(Math.floor(Math.random() * 1000000)).padStart(6, "0");
const getAdminOtpKey = (email = "") => `admin-panel:orchardgrowers:${normalizeEmail(email)}`;
const maskAdminEmail = (email = "") => {
  const [name = "", domain = ""] = normalizeEmail(email).split("@");
  return `${name.slice(0, 2)}***@${domain}`;
};
const getAdminOtpMode = (mode = "login") => {
  const normalized = String(mode || "login").trim().toLowerCase();
  if (normalized === "signup") return "signup";
  if (normalized === "forgot" || normalized === "forgot-password" || normalized === "reset") return "forgot-password";
  return "login";
};
const logAdminOtpDebug = (message, details = {}) => {
  console.log(`Admin OTP debug: ${message}`, details);
};
const getAdminOtpThrottleKey = (email = "") => `admin-panel:${normalizeEmail(email)}`;
const getActiveLock = (store, key) => {
  const lock = store.get(key);
  if (!lock) return null;
  if (lock.lockedUntil <= Date.now()) {
    store.delete(key);
    return null;
  }
  return lock;
};
const checkAdminOtpSendThrottle = (email) => {
  const throttleKey = getAdminOtpThrottleKey(email);
  const now = Date.now();
  const existing = adminOtpSendThrottleStore.get(throttleKey);

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
  if (lastSentAt && now - lastSentAt < OTP_RESEND_INTERVAL_MS) {
    return {
      allowed: false,
      reason: "resend_cooldown",
      retryAfterMs: OTP_RESEND_INTERVAL_MS - (now - lastSentAt),
      throttleKey,
    };
  }

  if (sendTimes.length >= OTP_MAX_SENDS_PER_WINDOW) {
    const lockedUntil = now + OTP_LOCK_MS;
    adminOtpSendThrottleStore.set(throttleKey, { sendTimes, lockedUntil });
    return {
      allowed: false,
      reason: "send_limit",
      retryAfterMs: OTP_LOCK_MS,
      throttleKey,
    };
  }

  return { allowed: true, throttleKey, sendTimes };
};
const recordAdminOtpSend = ({ throttleKey, sendTimes = [] }) => {
  adminOtpSendThrottleStore.set(throttleKey, {
    sendTimes: [...sendTimes.filter((sentAt) => Date.now() - sentAt < OTP_SEND_WINDOW_MS), Date.now()],
    lockedUntil: 0,
  });
};
const lockAdminOtpVerification = (key) => {
  adminOtpVerifyLockStore.set(key, { lockedUntil: Date.now() + OTP_LOCK_MS });
};
const getAdminOtpVerificationLock = (key) => getActiveLock(adminOtpVerifyLockStore, key);
const isAdminOtpVerified = (email = "") => {
  const key = getAdminOtpKey(email);
  const record = adminOtpStore.get(key);
  if (!record) return false;

  if (record.expiresAt < Date.now()) {
    adminOtpStore.delete(key);
    return false;
  }

  return Boolean(record.verified && record.used);
};
const consumeAdminOtp = (email = "") => {
  adminOtpStore.delete(getAdminOtpKey(email));
};

const validateAdminPassword = (password = "") => {
  if (typeof password !== "string" || password.length < 8) return PASSWORD_RULE_MESSAGE;
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return PASSWORD_RULE_MESSAGE;
  return "";
};

export const sendAdminOtp = async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const mode = getAdminOtpMode(req.body.mode);
  const response = { message: "If eligible, OTP has been sent." };

  logAdminOtpDebug("route hit", {
    mode,
    emailNormalized: email,
    email: maskAdminEmail(email),
    platform: ADMIN_MAIL_PLATFORM,
  });

  if (!email || !isValidEmail(email)) {
    logAdminOtpDebug("sendMail skipped", {
      email: maskAdminEmail(email),
      mode,
      reason: "invalid_email",
    });
    return res.json(response);
  }

  const existingAdmin = await Admin.findOne({ email }).select("_id password status role adminClass hasPassword mustSetPassword firstLoginCompleted");
  const adminClass = getInternalAdminClass(existingAdmin || { email, role: ADMIN_SIGNUP_ROLE_BY_EMAIL.get(email) });
  logAdminOtpDebug("admin lookup", {
    emailNormalized: email,
    email: maskAdminEmail(email),
    found: Boolean(existingAdmin),
    role: existingAdmin?.role || "",
    adminClass,
    status: existingAdmin?.status || "",
    hasPassword: adminHasPassword(existingAdmin),
    mustSetPassword: Boolean(existingAdmin?.mustSetPassword),
  });

  if (!existingAdmin) {
    logAdminOtpDebug("sendMail skipped", {
      emailNormalized: email,
      email: maskAdminEmail(email),
      mode,
      reason: "admin_not_found",
      found: false,
    });
    return res.status(403).json({ msg: ADMIN_NOT_APPROVED_MESSAGE });
  }

  if (mode === "signup" && adminHasPassword(existingAdmin)) {
    logAdminOtpDebug("sendMail skipped", {
      email: maskAdminEmail(email),
      mode,
      reason: "account_exists",
    });
    return res.status(409).json({ msg: "Account already exists. Please sign in." });
  }

  let isEligible = isEligibleInternalAdmin(existingAdmin);
  if (mode === "signup") {
    isEligible = isEligible && adminRequiresPasswordSetup(existingAdmin);
  }

  if (!isEligible) {
    logAdminOtpDebug("sendMail skipped", {
      email: maskAdminEmail(email),
      mode,
      reason: "not_eligible",
      found: Boolean(existingAdmin),
      role: existingAdmin?.role || "",
      adminClass,
      status: existingAdmin?.status || "",
    });
    return res.json(response);
  }

  const persistedAdminClass = await ensureAdminClassPersisted(existingAdmin);
  const throttle = checkAdminOtpSendThrottle(email);
  if (!throttle.allowed) {
    logAdminOtpDebug("sendMail throttled", {
      email: maskAdminEmail(email),
      mode,
      platform: ADMIN_MAIL_PLATFORM,
      reason: throttle.reason,
      retryAfterSeconds: Math.ceil(throttle.retryAfterMs / 1000),
    });
    res.set("Retry-After", String(Math.ceil(throttle.retryAfterMs / 1000)));
    return res.status(429).json({ msg: OTP_THROTTLED_MESSAGE });
  }

  const otp = createAdminOtp();
  logAdminOtpDebug("otp generated", {
    email: maskAdminEmail(email),
    mode,
    adminClass: persistedAdminClass,
    expiresInMs: getAdminOtpTtlMs(),
  });
  adminOtpStore.set(getAdminOtpKey(email), {
    otp,
    mode,
    expiresAt: Date.now() + getAdminOtpTtlMs(),
    attempts: 0,
    maxAttempts: getAdminOtpMaxAttempts(),
    verified: false,
    used: false,
  });

  try {
    logAdminOtpDebug("sendMail called", {
      email: maskAdminEmail(email),
      mode,
      platform: ADMIN_MAIL_PLATFORM,
      adminClass: persistedAdminClass,
      purpose: mode === "forgot-password" ? "password reset" : mode === "signup" ? "admin signup verification" : "admin login verification",
    });
    await sendOtpEmail({
      platform: ADMIN_MAIL_PLATFORM,
      to: email,
      otp,
      purpose: mode === "forgot-password" ? "password reset" : mode === "signup" ? "admin signup verification" : "admin login verification",
    });
  } catch (err) {
    adminOtpStore.delete(getAdminOtpKey(email));
    console.error("Admin OTP email failed:", {
      email: maskAdminEmail(email),
      code: err?.code,
      smtpCode: err?.smtpCode,
      smtpDetails: err?.smtpDetails,
      message: err?.message,
    });
    logAdminOtpDebug("sendMail failed", {
      email: maskAdminEmail(email),
      mode,
      code: err?.code,
      smtpCode: err?.smtpCode,
    });
    return res.status(502).json({ msg: "Could not send OTP. Please try again." });
  }

  recordAdminOtpSend(throttle);
  logAdminOtpDebug("sendMail success", {
    email: maskAdminEmail(email),
    mode,
    platform: ADMIN_MAIL_PLATFORM,
    adminClass: persistedAdminClass,
  });
  console.log(`Admin OTP delivery accepted for ${maskAdminEmail(email)}`);
  return res.json({ message: "OTP sent to admin email." });
};

export const verifyAdminOtp = async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const otp = String(req.body.otp || "").trim();

  if (!email || !isValidEmail(email) || !otp) {
    return res.status(400).json({ msg: "Valid admin email and OTP are required" });
  }

  const key = getAdminOtpKey(email);
  const record = adminOtpStore.get(key);
  const verifyLock = getAdminOtpVerificationLock(key);
  logAdminOtpDebug("verify route hit", {
    emailNormalized: email,
    email: maskAdminEmail(email),
    mode: record?.mode || "",
  });

  if (verifyLock) {
    logAdminOtpDebug("verify throttled", {
      email: maskAdminEmail(email),
      reason: "verify_locked",
      retryAfterSeconds: Math.ceil((verifyLock.lockedUntil - Date.now()) / 1000),
    });
    res.set("Retry-After", String(Math.ceil((verifyLock.lockedUntil - Date.now()) / 1000)));
    return res.status(429).json({ msg: OTP_THROTTLED_MESSAGE });
  }

  if (!record) {
    logAdminOtpDebug("verify failed", {
      email: maskAdminEmail(email),
      reason: "missing_request",
    });
    return res.status(400).json({ msg: "Invalid OTP" });
  }

  if (record.expiresAt < Date.now()) {
    adminOtpStore.delete(key);
    logAdminOtpDebug("verify failed", {
      email: maskAdminEmail(email),
      mode: record.mode,
      reason: "expired",
    });
    return res.status(400).json({ msg: "OTP expired. Request a new OTP." });
  }

  if (record.used || record.verified) {
    return res.status(400).json({ msg: "Invalid OTP" });
  }

  if (record.otp !== otp) {
    const attempts = Number(record.attempts || 0) + 1;
    if (attempts >= Number(record.maxAttempts || getAdminOtpMaxAttempts())) {
      adminOtpStore.delete(key);
      lockAdminOtpVerification(key);
      logAdminOtpDebug("verify failed", {
        email: maskAdminEmail(email),
        mode: record.mode,
        reason: "max_attempts",
      });
      res.set("Retry-After", String(Math.ceil(OTP_LOCK_MS / 1000)));
      return res.status(429).json({ msg: OTP_THROTTLED_MESSAGE });
    }

    adminOtpStore.set(key, { ...record, attempts });
    logAdminOtpDebug("verify failed", {
      email: maskAdminEmail(email),
      mode: record.mode,
      reason: "invalid_otp",
    });
    return res.status(400).json({ msg: "Invalid OTP" });
  }

  adminOtpStore.set(key, { ...record, otp: "", verified: true, used: true });
  const admin = await Admin.findOne({ email }).select("_id email password status role adminClass hasPassword mustSetPassword firstLoginCompleted");
  if (!admin) {
    adminOtpStore.delete(key);
    logAdminOtpDebug("verify failed", {
      emailNormalized: email,
      email: maskAdminEmail(email),
      mode: record.mode,
      reason: "admin_not_found",
      found: false,
    });
    return res.status(403).json({ msg: ADMIN_NOT_APPROVED_MESSAGE });
  }

  if (!isEligibleInternalAdmin(admin)) {
    adminOtpStore.delete(key);
    logAdminOtpDebug("verify failed", {
      emailNormalized: email,
      email: maskAdminEmail(email),
      mode: record.mode,
      reason: "not_eligible",
      found: true,
    });
    return res.status(400).json({ msg: "Invalid OTP" });
  }

  if (adminRequiresPasswordSetup(admin)) {
    const setupToken = createPasswordSetupToken(admin);
    adminOtpStore.delete(key);
    logAdminOtpDebug("verify success password setup required", {
      email: maskAdminEmail(email),
      mode: record.mode,
      found: true,
      hasPassword: adminHasPassword(admin),
      mustSetPassword: Boolean(admin.mustSetPassword),
      requiresPasswordSetup: true,
      setupTokenIssued: Boolean(setupToken),
    });
    return res.json({
      requiresPasswordSetup: true,
      setupToken,
      message: "Password setup required",
    });
  }

  logAdminOtpDebug("verify success", {
    email: maskAdminEmail(email),
    mode: record.mode,
    found: true,
    hasPassword: true,
    mustSetPassword: false,
    requiresPasswordSetup: false,
    setupTokenIssued: false,
  });
  return res.json({ message: "OTP verified" });
};

const getSignupRole = (email) => ADMIN_SIGNUP_ROLE_BY_EMAIL.get(email) || "EMPLOYEE";

const getDefaultAdminName = (email) =>
  email
    .split("@")[0]
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

const hashResetToken = (token = "") =>
  crypto.createHash("sha256").update(token).digest("hex");
const createPasswordSetupToken = (admin) => {
  const token = crypto.randomBytes(32).toString("hex");
  adminPasswordSetupTokens.set(hashResetToken(token), {
    adminId: admin._id.toString(),
    email: normalizeEmail(admin.email),
    expiresAt: Date.now() + ADMIN_SETUP_TOKEN_TTL_MS,
  });
  return token;
};
const consumePasswordSetupToken = (token = "", email = "") => {
  const tokenKey = hashResetToken(String(token || "").trim());
  const record = adminPasswordSetupTokens.get(tokenKey);
  if (!record) return null;
  if (record.expiresAt < Date.now() || record.email !== normalizeEmail(email)) {
    adminPasswordSetupTokens.delete(tokenKey);
    return null;
  }
  adminPasswordSetupTokens.delete(tokenKey);
  return record;
};

const createPasswordResetToken = () => {
  const token = crypto.randomBytes(32).toString("hex");
  return {
    token,
    tokenHash: hashResetToken(token),
    expiresAt: new Date(Date.now() + ADMIN_RESET_TOKEN_TTL_MS),
  };
};

const getResetBaseUrl = (req) =>
  (
    process.env.ADMIN_RESET_BASE_URL ||
    process.env.ADMIN_FRONTEND_URL ||
    process.env.ADMIN_PANEL_URL ||
    req.get("origin") ||
    ""
  )
    .trim()
    .replace(/\/+$/, "");

const buildAdminResetUrl = (req, email, token) => {
  const baseUrl = getResetBaseUrl(req);
  if (!baseUrl) return "";

  const separator = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${separator}mode=reset&email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`;
};

const sendAdminPasswordResetEmail = async ({ req, email, token }) => {
  const resetUrl = buildAdminResetUrl(req, email, token);
  if (!resetUrl) {
    console.error("Admin reset email skipped: reset URL is not configured", {
      platform: ADMIN_MAIL_PLATFORM,
      email: maskAdminEmail(email),
      adminResetBaseUrlPresent: Boolean(process.env.ADMIN_RESET_BASE_URL),
      adminFrontendUrlPresent: Boolean(process.env.ADMIN_FRONTEND_URL),
      adminPanelUrlPresent: Boolean(process.env.ADMIN_PANEL_URL),
      originPresent: Boolean(req.get("origin")),
    });
    return false;
  }

  await sendEmail({
    platform: ADMIN_MAIL_PLATFORM,
    purpose: "reset",
    to: email,
    subject: "Admin password reset",
    text: `Use this secure link to reset your admin password. It expires in 30 minutes:\n\n${resetUrl}`,
    html: `<p>Use this secure link to reset your admin password. It expires in 30 minutes:</p><p><a href="${resetUrl}">Reset admin password</a></p>`,
  });

  return true;
};

const hasDualApproval = (reviews = []) => {
  const approvedClasses = new Set(
    reviews
      .filter((review) => review.action === "APPROVE")
      .map((review) => review.adminClass)
  );

  return approvedClasses.has("CLASS1") && approvedClasses.has("CLASS2");
};

const hasDualRejection = (reviews = []) => {
  const rejectedClasses = new Set(
    reviews
      .filter((review) => ["REJECT", "DISAPPROVE", "HOLD", "SUSPEND", "TERMINATE"].includes(review.action))
      .map((review) => review.adminClass)
  );

  return rejectedClasses.has("CLASS1") && rejectedClasses.has("CLASS2");
};

const requireAdmin = (req, res) => {
  if (!req.user || !ADMIN_ROLES.includes(req.user.role)) {
    res.status(403).json({ msg: "Admin access required" });
    return null;
  }
  return req.user;
};

const requireSuperAdmin = (req, res) => {
  const admin = requireAdmin(req, res);
  if (!admin) return null;

  if (admin.role !== "SUPER_ADMIN") {
    res.status(403).json({ msg: "Super admin access required" });
    return null;
  }

  return admin;
};

export const signupAdmin = async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const name = String(req.body.name || "").trim();
  const { password, confirmPassword } = req.body;

  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ msg: "Valid admin email is required" });
  }

  const existingAdminForEligibility = await Admin.findOne({ email }).select("_id status role adminClass password hasPassword mustSetPassword firstLoginCompleted");
  if (!existingAdminForEligibility) {
    logAdminOtpDebug("signup blocked", {
      emailNormalized: email,
      email: maskAdminEmail(email),
      reason: "admin_not_found",
      found: false,
    });
    return res.status(403).json({ msg: ADMIN_NOT_APPROVED_MESSAGE });
  }

  if (existingAdminForEligibility && !isEligibleInternalAdmin(existingAdminForEligibility)) {
    return res.status(403).json({ msg: "Admin account is not eligible" });
  }

  const passwordError = validateAdminPassword(password);
  if (passwordError) return res.status(400).json({ msg: passwordError });

  if (confirmPassword && password !== confirmPassword) {
    return res.status(400).json({ msg: "Passwords do not match" });
  }

  if (!isAdminOtpVerified(email)) {
    return res.status(400).json({ msg: "Verify OTP before admin signup" });
  }

  const existingAdmin = await Admin.findOne({ email }).select("+resetPasswordTokenHash +resetPasswordExpiresAt");
  if (existingAdmin?.status === "TERMINATED") {
    return res.status(403).json({ msg: "Admin account terminated" });
  }

  if (adminHasPassword(existingAdmin) && !existingAdmin?.mustSetPassword) {
    return res.status(409).json({ msg: "Account already exists. Please sign in." });
  }

  const isNewAdmin = !existingAdmin;
  const admin = existingAdmin || new Admin({ email });
  admin.name = name || admin.name || getDefaultAdminName(email);
  admin.email = email;
  admin.password = await bcrypt.hash(password, 10);
  admin.role = isNewAdmin ? getSignupRole(email) : admin.role || getSignupRole(email);
  admin.adminClass = getInternalAdminClass(admin) || "CLASS_III";
  admin.status = "ACTIVE";
  admin.hasPassword = true;
  admin.mustSetPassword = false;
  admin.firstLoginCompleted = true;
  admin.resetPasswordTokenHash = undefined;
  admin.resetPasswordExpiresAt = undefined;
  admin.resetPasswordRequestedAt = undefined;
  admin.passwordChangedAt = new Date();
  await admin.save();
  consumeAdminOtp(email);

  res.status(201).json({
    token: signAdminToken(admin),
    role: admin.role,
    admin: safeAdmin(admin),
  });
};

export const loginAdmin = async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const { password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ msg: "Email and password are required" });
  }

  if (!isAdminOtpVerified(email)) {
    return res.status(400).json({ msg: "Verify OTP before admin login" });
  }

  if (isMasterLogin(email, password)) {
    const hashedPassword = await bcrypt.hash(password, 10);
    const admin = await Admin.findOneAndUpdate(
      { email },
      {
        name: "Master Admin",
        email,
        password: hashedPassword,
        role: "SUPER_ADMIN",
        adminClass: "CLASS_I",
        status: "ACTIVE",
        hasPassword: true,
        mustSetPassword: false,
        firstLoginCompleted: true,
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    consumeAdminOtp(email);
    return res.json({
      token: signAdminToken(admin),
      role: admin.role,
      admin: safeAdmin(admin),
    });
  }

  const admin = await Admin.findOne({ email });

  if (!admin) {
    console.log("Admin login blocked: admin not found", {
      emailNormalized: email,
      email: maskAdminEmail(email),
      found: false,
    });
    return res.status(403).json({ msg: ADMIN_NOT_APPROVED_MESSAGE });
  }
  if (!isEligibleInternalAdmin(admin)) {
    return res.status(403).json({ msg: "Admin account is not eligible" });
  }

  if (adminRequiresPasswordSetup(admin)) {
    console.log("Admin login blocked: password setup required", {
      emailNormalized: email,
      email: maskAdminEmail(email),
      found: true,
      hasPassword: adminHasPassword(admin),
      mustSetPassword: Boolean(admin.mustSetPassword),
      requiresPasswordSetup: true,
      setupTokenIssued: false,
    });
    return res.status(403).json({
      requiresPasswordSetup: true,
      msg: "Password setup required",
    });
  }

  if (!admin.password) {
    return res.status(401).json({ msg: "Admin password is not configured" });
  }

  const isMatch = await bcrypt.compare(password, admin.password);

  if (!isMatch) return res.status(401).json({ msg: "Wrong password" });
  consumeAdminOtp(email);

  res.json({
    token: signAdminToken(admin),
    role: admin.role,
    admin: safeAdmin(admin),
  });
};

export const requestAdminPasswordReset = async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const response = { msg: "If the admin email is registered, reset instructions have been sent." };

  console.log("Admin reset route hit", {
    platform: ADMIN_MAIL_PLATFORM,
    emailNormalized: email,
    email: maskAdminEmail(email),
  });

  if (!email || !isValidEmail(email)) {
    console.log("Admin reset skipped", {
      platform: ADMIN_MAIL_PLATFORM,
      emailNormalized: email,
      email: maskAdminEmail(email),
      reason: "invalid_email",
    });
    return res.json(response);
  }

  const admin = await Admin.findOne({ email }).select("+resetPasswordTokenHash +resetPasswordExpiresAt");
  if (!admin || !isEligibleInternalAdmin(admin)) {
    console.log("Admin reset skipped", {
      platform: ADMIN_MAIL_PLATFORM,
      emailNormalized: email,
      email: maskAdminEmail(email),
      adminFound: Boolean(admin),
      status: admin?.status || "",
      role: admin?.role || "",
      adminClass: getInternalAdminClass(admin || {}),
      reason: !admin ? "admin_not_found" : "not_eligible",
    });
    return res.json(response);
  }

  const { token, tokenHash, expiresAt } = createPasswordResetToken();
  admin.resetPasswordTokenHash = tokenHash;
  admin.resetPasswordExpiresAt = expiresAt;
  admin.resetPasswordRequestedAt = new Date();
  await admin.save();

  try {
    const emailSent = await sendAdminPasswordResetEmail({ req, email, token });
    console.log("Admin reset email processed", {
      platform: ADMIN_MAIL_PLATFORM,
      email: maskAdminEmail(email),
      emailSent,
    });
  } catch (err) {
    console.error("Admin reset email failed:", {
      platform: ADMIN_MAIL_PLATFORM,
      email: maskAdminEmail(email),
      code: err?.code,
      smtpCode: err?.smtpCode,
      smtpDetails: err?.smtpDetails,
      message: err?.message,
    });
  }

  res.json(response);
};

export const resetAdminPassword = async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const token = String(req.body.token || "").trim();
  const otp = String(req.body.otp || (/^\d{4,8}$/.test(token) ? token : "")).trim();
  const { password, confirmPassword } = req.body;

  if (!email || !isValidEmail(email) || (!token && !otp)) {
    return res.status(400).json({ msg: "Valid email and reset token are required" });
  }

  const passwordError = validateAdminPassword(password);
  if (passwordError) return res.status(400).json({ msg: passwordError });

  if (confirmPassword && password !== confirmPassword) {
    return res.status(400).json({ msg: "Passwords do not match" });
  }

  if (otp) {
    const key = getAdminOtpKey(email);
    const record = adminOtpStore.get(key);
    const verifyLock = getAdminOtpVerificationLock(key);
    if (verifyLock) {
      logAdminOtpDebug("reset OTP throttled", {
        email: maskAdminEmail(email),
        mode: "forgot-password",
        reason: "verify_locked",
        retryAfterSeconds: Math.ceil((verifyLock.lockedUntil - Date.now()) / 1000),
      });
      res.set("Retry-After", String(Math.ceil((verifyLock.lockedUntil - Date.now()) / 1000)));
      return res.status(429).json({ msg: OTP_THROTTLED_MESSAGE });
    }

    if (!record || record.mode !== "forgot-password") {
      return res.status(400).json({ msg: "Invalid or expired OTP" });
    }

    if (record.expiresAt < Date.now()) {
      adminOtpStore.delete(key);
      return res.status(400).json({ msg: "Invalid or expired OTP" });
    }

    if (record.used || record.verified || record.otp !== otp) {
      const attempts = Number(record.attempts || 0) + 1;
      if (attempts >= Number(record.maxAttempts || getAdminOtpMaxAttempts())) {
        adminOtpStore.delete(key);
        lockAdminOtpVerification(key);
        res.set("Retry-After", String(Math.ceil(OTP_LOCK_MS / 1000)));
        return res.status(429).json({ msg: OTP_THROTTLED_MESSAGE });
      }
      adminOtpStore.set(key, { ...record, attempts });
      return res.status(400).json({ msg: "Invalid or expired OTP" });
    }

    const admin = await Admin.findOne({ email }).select("+resetPasswordTokenHash +resetPasswordExpiresAt");
    if (!admin || !isEligibleInternalAdmin(admin)) {
      adminOtpStore.delete(key);
      return res.status(400).json({ msg: "Invalid or expired OTP" });
    }

    admin.password = await bcrypt.hash(password, 10);
    admin.resetPasswordTokenHash = undefined;
    admin.resetPasswordExpiresAt = undefined;
    admin.resetPasswordRequestedAt = undefined;
    admin.passwordChangedAt = new Date();
    admin.hasPassword = true;
    admin.mustSetPassword = false;
    admin.firstLoginCompleted = true;
    await admin.save();
    adminOtpStore.delete(key);

    return res.json({ msg: "Password reset successful. Please login." });
  }

  const setupRecord = consumePasswordSetupToken(token, email);
  if (setupRecord) {
    const admin = await Admin.findById(setupRecord.adminId).select("+resetPasswordTokenHash +resetPasswordExpiresAt");
    if (!admin || normalizeEmail(admin.email) !== email || !isEligibleInternalAdmin(admin)) {
      return res.status(400).json({ msg: "Reset link is invalid or expired" });
    }

    admin.password = await bcrypt.hash(password, 10);
    admin.resetPasswordTokenHash = undefined;
    admin.resetPasswordExpiresAt = undefined;
    admin.resetPasswordRequestedAt = undefined;
    admin.passwordChangedAt = new Date();
    admin.hasPassword = true;
    admin.mustSetPassword = false;
    admin.firstLoginCompleted = true;
    await admin.save();

    console.log("Admin password setup completed", {
      email: maskAdminEmail(email),
      hasPassword: true,
      mustSetPassword: false,
      firstLoginCompleted: true,
    });

    return res.json({ msg: "Password setup successful. Please login." });
  }

  const admin = await Admin.findOne({
    email,
    resetPasswordTokenHash: hashResetToken(token),
    resetPasswordExpiresAt: { $gt: new Date() },
  }).select("+resetPasswordTokenHash +resetPasswordExpiresAt");

  if (!admin) {
    return res.status(400).json({ msg: "Reset link is invalid or expired" });
  }

  if (!isEligibleInternalAdmin(admin)) {
    return res.status(403).json({ msg: "Admin account is not eligible" });
  }

  admin.password = await bcrypt.hash(password, 10);
  admin.resetPasswordTokenHash = undefined;
  admin.resetPasswordExpiresAt = undefined;
  admin.resetPasswordRequestedAt = undefined;
  admin.passwordChangedAt = new Date();
  admin.hasPassword = true;
  admin.mustSetPassword = false;
  admin.firstLoginCompleted = true;
  await admin.save();

  res.json({ msg: "Password reset successful. Please login." });
};

export const getAdminAnalytics = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const [
    totalUsers,
    growers,
    buyers,
    logistics,
    verifiedUsers,
    terminatedUsers,
    totalLots,
    totalOrders,
    verificationSubmitted,
    verificationApproved,
    verificationRejected,
    activeAdmins,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ role: "grower" }),
    User.countDocuments({ role: "buyer" }),
    User.countDocuments({ role: "driver" }),
    User.countDocuments({ isVerified: true }),
    User.countDocuments({ accountStatus: "TERMINATED" }),
    Product.countDocuments(),
    Order.countDocuments(),
    VerificationRequest.countDocuments({ status: "SUBMITTED" }),
    VerificationRequest.countDocuments({ status: "APPROVED" }),
    VerificationRequest.countDocuments({ status: { $in: ["REJECTED", "DISAPPROVED", "TERMINATED"] } }),
    Admin.countDocuments({ status: "ACTIVE" }),
  ]);

  res.json({
    totalUsers,
    growers,
    buyers,
    logistics,
    verifiedUsers,
    terminatedUsers,
    totalLots,
    totalOrders,
    verificationSubmitted,
    verificationApproved,
    verificationRejected,
    activeAdmins,
  });
};

export const listAdmins = async (req, res) => {
  const currentAdmin = req.admin || requireAdmin(req, res);
  if (!currentAdmin) return;

  const currentClass = getInternalAdminClass(currentAdmin);
  if (currentClass === "CLASS_III") return res.json([]);
  const filter = currentClass === "CLASS_II" && currentAdmin.canManageClassIII ? { adminClass: "CLASS_III" } : {};
  const admins = await Admin.find(filter)
    .select(ADMIN_SELECT)
    .populate("createdBy approvedBy rejectedBy suspendedBy classChangedBy resetPasswordBy", "name email role adminClass")
    .sort({ role: -1, createdAt: -1 });
  res.json(admins.map(safeAdmin));
};

export const createAdmin = async (req, res) => {
  const currentAdmin = req.admin || requireAdmin(req, res);
  if (!currentAdmin) return;

  const { name, phone } = req.body;
  const email = normalizeEmail(req.body.email);
  const role = req.body.role || "EMPLOYEE";
  const adminClass = normalizeInternalAdminClass(req.body.adminClass) || ROLE_INTERNAL_CLASS[role] || "CLASS_III";
  const status = String(req.body.status || "PENDING").trim().toUpperCase();

  if (!email || !ADMIN_ROLES.includes(role) || !INTERNAL_ADMIN_CLASSES.has(adminClass)) {
    return res.status(400).json({ msg: "Valid email, role, and admin class are required" });
  }

  if (role === "SUPER_ADMIN" || adminClass === "CLASS_I") {
    return res.status(403).json({ msg: "Class I admins must be seeded or managed outside public creation" });
  }

  if (!["PENDING", "ACTIVE"].includes(status)) {
    return res.status(400).json({ msg: "Status must be PENDING or ACTIVE" });
  }

  if (!canManageAdminClass(currentAdmin, adminClass)) {
    return res.status(403).json({ msg: "You do not have permission to create this admin class" });
  }

  const existing = await Admin.findOne({ email });
  if (existing) return res.status(400).json({ msg: "Admin already exists" });

  const admin = await Admin.create({
    name: name || ROLE_LABELS[role],
    email,
    phone: String(phone || "").trim(),
    role,
    adminClass,
    status,
    hasPassword: false,
    mustSetPassword: true,
    firstLoginCompleted: false,
    createdBy: currentAdmin.id,
    ...(status === "ACTIVE" ? { approvedBy: currentAdmin.id, approvedAt: new Date() } : {}),
  });
  appendAdminAudit(admin, "CREATE_ADMIN", currentAdmin, {}, { status, adminClass, role }, "New admin must verify OTP and set password on first login");
  if (status === "ACTIVE") appendAdminAudit(admin, "APPROVE_ADMIN", currentAdmin, { status: "PENDING" }, { status: "ACTIVE" });
  await admin.save();

  res.status(201).json(safeAdmin(admin));
};

export const updateAdmin = async (req, res) => {
  const currentAdmin = req.admin || requireAdmin(req, res);
  if (!currentAdmin) return;

  const updates = {};
  const { name, role, password, phone } = req.body;

  if (typeof name === "string") updates.name = name.trim();
  if (typeof phone === "string") updates.phone = phone.trim();
  if (role && ADMIN_ROLES.includes(role) && role !== "SUPER_ADMIN") {
    updates.role = role;
    updates.adminClass = ROLE_INTERNAL_CLASS[role] || "CLASS_III";
  }
  if (password) {
    updates.password = await bcrypt.hash(password, 10);
    updates.hasPassword = true;
    updates.mustSetPassword = false;
    updates.firstLoginCompleted = true;
  }

  const existing = await Admin.findById(req.params.id);
  if (!existing) return res.status(404).json({ msg: "Admin not found" });
  if (!canManageAdminClass(currentAdmin, getInternalAdminClass(existing))) {
    return res.status(403).json({ msg: "You do not have permission to update this admin" });
  }
  Object.assign(existing, updates);
  appendAdminAudit(existing, "UPDATE_ADMIN", currentAdmin, {}, updates);
  await existing.save();
  const admin = await Admin.findById(req.params.id).select(ADMIN_SELECT);
  if (!admin) return res.status(404).json({ msg: "Admin not found" });

  res.json(safeAdmin(admin));
};

export const terminateAdmin = async (req, res) => {
  const currentAdmin = req.admin || requireAdmin(req, res);
  if (!currentAdmin) return;

  const admin = await Admin.findById(req.params.id);
  if (!admin) return res.status(404).json({ msg: "Admin not found" });
  if (admin.role === "SUPER_ADMIN") {
    return res.status(403).json({ msg: "Super Admin cannot be terminated here" });
  }
  if (!canManageAdminClass(currentAdmin, getInternalAdminClass(admin))) {
    return res.status(403).json({ msg: "You do not have permission to change this admin status" });
  }

  const requestedStatus = String(req.body.status || "TERMINATED").toUpperCase();
  if (!ADMIN_STATUSES.includes(requestedStatus)) {
    return res.status(400).json({ msg: "Invalid admin status" });
  }

  const previousStatus = admin.status;
  admin.status = requestedStatus;
  if (admin.status === "ACTIVE") {
    admin.approvedBy = currentAdmin.id;
    admin.approvedAt = new Date();
  }
  if (admin.status === "REJECTED") {
    admin.rejectedBy = currentAdmin.id;
    admin.rejectedAt = new Date();
  }
  if (admin.status === "SUSPENDED") {
    admin.suspendedBy = currentAdmin.id;
    admin.suspendedAt = new Date();
  }
  if (admin.status === "TERMINATED") {
    admin.terminatedBy = currentAdmin.id;
    admin.terminatedAt = new Date();
  }
  appendAdminAudit(admin, "CHANGE_ADMIN_STATUS", currentAdmin, { status: previousStatus }, { status: requestedStatus });
  await admin.save();

  res.json(safeAdmin(admin));
};

export const deleteAdmin = async (req, res) => {
  if (!requireSuperAdmin(req, res)) return;

  const admin = await Admin.findById(req.params.id);
  if (!admin) return res.status(404).json({ msg: "Admin not found" });
  if (admin.role === "SUPER_ADMIN") {
    return res.status(403).json({ msg: "Super Admin cannot be deleted here" });
  }

  await admin.deleteOne();
  res.json({ message: "Admin deleted" });
};

export const approveAdmin = async (req, res) => {
  req.body.status = "ACTIVE";
  return terminateAdmin(req, res);
};

export const rejectAdmin = async (req, res) => {
  req.body.status = "REJECTED";
  return terminateAdmin(req, res);
};

export const suspendAdmin = async (req, res) => {
  req.body.status = "SUSPENDED";
  return terminateAdmin(req, res);
};

export const activateAdmin = async (req, res) => {
  req.body.status = "ACTIVE";
  return terminateAdmin(req, res);
};

export const changeAdminClass = async (req, res) => {
  const currentAdmin = req.admin || requireAdmin(req, res);
  if (!currentAdmin) return;

  const adminClass = normalizeInternalAdminClass(req.body.adminClass);
  if (!INTERNAL_ADMIN_CLASSES.has(adminClass)) {
    return res.status(400).json({ msg: "Invalid admin class" });
  }
  if (!canManageAdminClass(currentAdmin, adminClass)) {
    return res.status(403).json({ msg: "You do not have permission to assign this admin class" });
  }

  const admin = await Admin.findById(req.params.id);
  if (!admin) return res.status(404).json({ msg: "Admin not found" });
  if (admin.role === "SUPER_ADMIN") return res.status(403).json({ msg: "Super Admin class cannot be changed here" });
  if (!canManageAdminClass(currentAdmin, getInternalAdminClass(admin))) {
    return res.status(403).json({ msg: "You do not have permission to change this admin" });
  }

  const previousClass = getInternalAdminClass(admin);
  admin.adminClass = adminClass;
  admin.classChangedBy = currentAdmin.id;
  admin.classChangedAt = new Date();
  appendAdminAudit(admin, "CHANGE_ADMIN_CLASS", currentAdmin, { adminClass: previousClass }, { adminClass });
  await admin.save();
  res.json(safeAdmin(admin));
};

export const resetManagedAdminPassword = async (req, res) => {
  const currentAdmin = req.admin || requireAdmin(req, res);
  if (!currentAdmin) return;

  const admin = await Admin.findById(req.params.id);
  if (!admin) return res.status(404).json({ msg: "Admin not found" });
  if (admin.role === "SUPER_ADMIN") return res.status(403).json({ msg: "Super Admin password cannot be reset here" });
  if (!canManageAdminClass(currentAdmin, getInternalAdminClass(admin))) {
    return res.status(403).json({ msg: "You do not have permission to reset this admin" });
  }

  admin.password = undefined;
  admin.hasPassword = false;
  admin.mustSetPassword = true;
  admin.firstLoginCompleted = false;
  admin.resetPasswordBy = currentAdmin.id;
  admin.resetPasswordAt = new Date();
  appendAdminAudit(admin, "RESET_ADMIN_PASSWORD", currentAdmin, {}, { mustSetPassword: true });
  await admin.save();
  res.json({ message: "Admin password reset. User must verify OTP and set password on next login.", admin: safeAdmin(admin) });
};

export const listUsers = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const users = await User.find().select(USER_SELECT).sort({ createdAt: -1 });
  res.json(users);
};

export const updateUserByAdmin = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const allowed = [
    "name",
    "phone",
    "email",
    "role",
    "orchardName",
    "businessName",
    "buyerContactPerson",
    "designation",
    "businessAddressLine1",
    "businessAddressLine2",
    "businessAddressLine3",
    "businessPinCode",
    "lockedAmount",
    "logisticsName",
    "vehicleNumber",
    "licenseNumber",
    "location",
    "contact",
    "isVerified",
    "adminNotes",
  ];
  const updates = {};

  allowed.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      updates[field] = req.body[field];
    }
  });

  if (Object.prototype.hasOwnProperty.call(updates, "email")) {
    updates.email = normalizeEmail(updates.email);
  }

  if (Object.prototype.hasOwnProperty.call(updates, "role")) {
    const requestedRole = updates.role === "" ? null : updates.role;
    if (!USER_ROLES.includes(requestedRole)) {
      return res.status(400).json({ msg: "Invalid user role" });
    }
    updates.role = requestedRole;
  }

  if (Object.prototype.hasOwnProperty.call(updates, "isVerified")) {
    updates.isVerified = Boolean(updates.isVerified);
  }

  if (Object.prototype.hasOwnProperty.call(updates, "lockedAmount")) {
    const lockedAmount = Number(updates.lockedAmount);
    if (!Number.isFinite(lockedAmount) || lockedAmount < 0) {
      return res.status(400).json({ msg: "Invalid locked amount" });
    }
    updates.lockedAmount = lockedAmount;
  }

  const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true }).select(USER_SELECT);
  if (!user) return res.status(404).json({ msg: "User not found" });

  res.json(user);
};

export const setUserStatusByAdmin = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const status = String(req.body.status || "TERMINATED").toUpperCase();
  if (!USER_STATUSES.includes(status)) {
    return res.status(400).json({ msg: "Invalid user status" });
  }

  const user = await User.findByIdAndUpdate(
    req.params.id,
    { accountStatus: status, adminNotes: req.body.note || "" },
    { new: true }
  ).select(USER_SELECT);

  if (!user) return res.status(404).json({ msg: "User not found" });

  res.json(user);
};

export const deleteUserByAdmin = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ msg: "User not found" });

  await user.deleteOne();
  res.json({ message: "User deleted" });
};

const PRODUCT_ADMIN_FIELDS = [
  "title",
  "slug",
  "sku",
  "hsnCode",
  "hsnDescription",
  "gstRate",
  "cgst",
  "sgst",
  "fruitName",
  "variety",
  "productCategory",
  "seasonalCategory",
  "productType",
  "inventoryType",
  "unit",
  "description",
  "seoMetaTitle",
  "seoMetaDescription",
  "seoKeywords",
  "featured",
  "active",
  "quantity",
  "basePrice",
  "discountPercent",
  "location",
  "status",
  "packingType",
  "packShape",
  "packLengthCm",
  "packWidthCm",
  "packHeightCm",
  "packRadiusCm",
  "packThicknessCm",
  "actualWeightKg",
  "dimensionWeightKg",
  "chargeableWeightKg",
  "packingWeightKg",
  "totalWeightKg",
  "images",
  "imagePublicIds",
  "platform",
];
const parseBooleanInput = (value) => {
  if (typeof value === "boolean") return value;
  const normalized = String(value || "").trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(normalized);
};
const GST_ALLOWED_VALUES = new Set([0, 5, 12, 18, 28]);
const SKU_CATEGORY_CODES = {
  plant: "PLT",
  plants: "PLT",
  "live plants": "PLT",
  "fruit plants": "PLT",
  seed: "SED",
  seeds: "SED",
  tool: "TOOL",
  tools: "TOOL",
  "gardening tools": "TOOL",
  fertilizer: "FRT",
  fertilizers: "FRT",
  manure: "MAN",
  "organic manure": "MAN",
  cocopeat: "COCO",
  pot: "POT",
  pots: "POT",
  "nursery pots": "POT",
  "shade net": "NET",
  irrigation: "IRR",
};
const SKU_UNIT_CODES = {
  kg: "U1",
  piece: "U2",
  plant: "U1",
  box: "U3",
  litre: "U4",
  liter: "U4",
};
const toSkuPart = (value = "", maxLength = 8) => {
  const cleaned = String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");
  return (cleaned || "ITEM").slice(0, maxLength);
};
const getCategoryCode = (category = "") => {
  const normalized = String(category || "").trim().toLowerCase();
  return SKU_CATEGORY_CODES[normalized] || toSkuPart(normalized, 4);
};
const getUnitCode = (unitId = "") => {
  const normalized = String(unitId || "").trim().toLowerCase();
  if (/^u\d+$/i.test(normalized)) return normalized.toUpperCase();
  return SKU_UNIT_CODES[normalized] || toSkuPart(normalized || "U1", 3);
};
const createProductSlug = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
const generateAdminSku = async ({ category, productName, unitId }) => {
  const categoryCode = getCategoryCode(category);
  const productShort = toSkuPart(String(productName || "").split(/\s+/)[0] || productName, 8);
  const unitCode = getUnitCode(unitId);
  const familyPattern = new RegExp(`^OG-${categoryCode}-[A-Z0-9]+-${unitCode}-(\\d{4})$`);
  const existing = await Product.find({ sku: familyPattern }).select("sku").lean();
  const maxSerial = existing.reduce((max, product) => {
    const match = String(product.sku || "").match(familyPattern);
    return match ? Math.max(max, Number(match[1] || 0)) : max;
  }, 0);

  for (let serial = maxSerial + 1; serial < 10000; serial += 1) {
    const sku = `OG-${categoryCode}-${productShort}-${unitCode}-${String(serial).padStart(4, "0")}`;
    // eslint-disable-next-line no-await-in-loop
    const duplicate = await Product.exists({ sku });
    if (!duplicate) return sku;
  }

  return "";
};
const calculatePackWeights = (payload) => {
  const shape = ["box", "cylinder", "flyer"].includes(String(payload.packShape || "").toLowerCase())
    ? String(payload.packShape).toLowerCase()
    : "box";
  const length = Number(payload.packLengthCm || 0);
  const width = Number(payload.packWidthCm || 0);
  const height = Number(payload.packHeightCm || 0);
  const radius = Number(payload.packRadiusCm || 0);
  const thickness = Number(payload.packThicknessCm || 0);
  const actualWeightKg = Number(payload.actualWeightKg || 0);
  const volume =
    shape === "cylinder"
      ? Math.PI * radius * radius * height
      : length * width * (shape === "flyer" ? thickness : height);
  const dimensionWeightKg = volume > 0 ? Number((volume / 5000).toFixed(2)) : 0;

  return {
    packShape: shape,
    dimensionWeightKg,
    actualWeightKg: Number.isFinite(actualWeightKg) ? actualWeightKg : 0,
    chargeableWeightKg: Math.max(Number.isFinite(actualWeightKg) ? actualWeightKg : 0, dimensionWeightKg),
  };
};

const uploadAdminProductImage = (file, platform = "orchardgrowers") =>
  uploadBufferToCloudinary(file, {
    folder: getAdminProductFolder(platform),
    resourceType: "image",
  });

const uploadAdminProductImages = async (files = [], platform = "orchardgrowers") => {
  const uploadedImages = await Promise.all(files.map((file) => uploadAdminProductImage(file, platform)));
  return uploadedImages.filter(Boolean);
};

const normalizeProductAdminPayload = (body = {}) => {
  const payload = {};

  PRODUCT_ADMIN_FIELDS.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      payload[field] = body[field];
    }
  });

  ["quantity", "basePrice", "discountPercent", "packingWeightKg", "totalWeightKg", "cgst", "sgst", "gstRate"].forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(payload, field)) {
      const value = Number(payload[field]);
      payload[field] = Number.isFinite(value) ? value : 0;
    }
  });

  ["featured", "active"].forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(payload, field)) {
      payload[field] = parseBooleanInput(payload[field]);
    }
  });

  if (Object.prototype.hasOwnProperty.call(payload, "images")) {
    if (Array.isArray(payload.images)) {
      payload.images = payload.images.filter(Boolean);
    } else {
      try {
        const parsedImages = JSON.parse(String(payload.images || "[]"));
        payload.images = Array.isArray(parsedImages) ? parsedImages.filter(Boolean) : [];
      } catch {
        payload.images = String(payload.images || "")
            .split(/\r?\n|,/)
            .map((image) => image.trim())
            .filter(Boolean);
      }
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, "imagePublicIds")) {
    if (Array.isArray(payload.imagePublicIds)) {
      payload.imagePublicIds = payload.imagePublicIds.filter(Boolean);
    } else {
      try {
        const parsedIds = JSON.parse(String(payload.imagePublicIds || "[]"));
        payload.imagePublicIds = Array.isArray(parsedIds) ? parsedIds.filter(Boolean) : [];
      } catch {
        payload.imagePublicIds = String(payload.imagePublicIds || "")
          .split(/\r?\n|,/)
          .map((id) => id.trim())
          .filter(Boolean);
      }
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, "seoKeywords")) {
    if (Array.isArray(payload.seoKeywords)) {
      payload.seoKeywords = payload.seoKeywords.map((keyword) => String(keyword).trim().toLowerCase()).filter(Boolean);
    } else {
      try {
        const parsedKeywords = JSON.parse(String(payload.seoKeywords || "[]"));
        payload.seoKeywords = Array.isArray(parsedKeywords)
          ? parsedKeywords.map((keyword) => String(keyword).trim().toLowerCase()).filter(Boolean)
          : [];
      } catch {
        payload.seoKeywords = String(payload.seoKeywords || "")
          .split(/\r?\n|,/)
          .map((keyword) => keyword.trim().toLowerCase())
          .filter(Boolean);
      }
    }
  }

  return payload;
};

export const listProductsByAdmin = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const products = await Product.find()
    .populate("createdBy", "name orchardName businessName role")
    .sort({ createdAt: -1 });
  res.json(products);
};

export const uploadProductImagesByAdmin = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const imageFiles = Array.isArray(req.files) ? req.files : [];
  if (!imageFiles.length) {
    return res.status(400).json({ msg: "Select at least one product image" });
  }

  const platform = req.body?.platform || req.query?.platform || "orchardgrowers";
  const uploadedImages = await uploadAdminProductImages(imageFiles, platform);
  const files = uploadedImages.map((image) => ({
    url: image.secure_url,
    secure_url: image.secure_url,
    publicId: image.publicId,
    folder: image.folder,
    resourceType: image.resourceType,
  }));

  res.status(201).json({
    success: true,
    files,
    images: files.map((image) => ({
      url: image.secure_url,
      publicId: image.publicId,
    })),
  });
};

export const createProductByAdmin = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const payload = normalizeProductAdminPayload(req.body);
  const isRawMaterial = payload.inventoryType === "raw_material";
  const category = String(payload.productCategory || payload.fruitName || "").trim();
  const price = Number(payload.basePrice || 0);
  const discountPercent = Number(payload.discountPercent || 0);

  if (!payload.title || !category || (!isRawMaterial && !payload.description)) {
    return res.status(400).json({ msg: isRawMaterial ? "Raw material name and category are required" : "Product name, category, and description are required" });
  }

  payload.slug = createProductSlug(payload.title);
  payload.sku = await generateAdminSku({
    category,
    productName: payload.title,
    unitId: payload.unit || "Plant",
  });
  if (!payload.sku) {
    return res.status(400).json({ msg: "SKU is required" });
  }

  const skuExists = await Product.exists({ sku: payload.sku });
  if (skuExists) {
    return res.status(409).json({ msg: "SKU already exists. Please generate a new SKU or edit manually." });
  }

  if (!isRawMaterial && (!Number.isFinite(price) || price <= 0)) {
    return res.status(400).json({ msg: "Price must be greater than zero" });
  }

  if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {
    return res.status(400).json({ msg: "Discount must be between 0 and 100" });
  }

  if (Object.prototype.hasOwnProperty.call(payload, "quantity")) {
    const quantity = Number(payload.quantity || 0);
    if (!Number.isFinite(quantity) || quantity < 0) {
      return res.status(400).json({ msg: "Negative stock cannot be processed. Purchase or update stock first." });
    }
    payload.quantity = quantity;
  }

  payload.hsnCode = String(payload.hsnCode || "").trim();
  if (!/^\d+$/.test(payload.hsnCode)) {
    return res.status(400).json({ msg: "HSN code is required and must be numeric" });
  }

  if (!GST_ALLOWED_VALUES.has(Number(payload.gstRate))) {
    return res.status(400).json({ msg: "GST rate must be one of 0, 5, 12, 18, or 28" });
  }

  const imageFiles = Array.isArray(req.files) ? req.files : [];
  const existingImageUrls = Array.isArray(payload.images) ? payload.images : [];
  const existingPublicIds = Array.isArray(payload.imagePublicIds) ? payload.imagePublicIds : [];
  if (!isRawMaterial && imageFiles.length + existingImageUrls.length < 5) {
    return res.status(400).json({ msg: "At least 5 product images are required" });
  }

  if (payload.status && !["AVAILABLE", "SOLD"].includes(payload.status)) {
    return res.status(400).json({ msg: "Invalid product status" });
  }

  const uploadedImages = await uploadAdminProductImages(imageFiles, payload.platform);
  const uploadedUrls = uploadedImages.map((image) => image.secure_url);
  const uploadedPublicIds = uploadedImages.map((image) => image.publicId);
  const packWeights = calculatePackWeights(payload);

  const product = await Product.create({
    ...payload,
    ...packWeights,
    fruitName: category,
    productCategory: category,
    variety: payload.variety || category,
    description: payload.description || `${payload.title} raw material`,
    basePrice: Number.isFinite(price) ? price : 0,
    discountPercent,
    gstRate: Number(payload.gstRate),
    cgst: Number(payload.gstRate) / 2,
    sgst: Number(payload.gstRate) / 2,
    quantity: Number(payload.quantity || 0),
    images: [...existingImageUrls, ...uploadedUrls],
    imageObjects: [
      ...existingImageUrls.map((url, index) => ({
        url,
        publicId: existingPublicIds[index] || "",
        alt: `${payload.title} image ${index + 1}`,
        isPrimary: index === 0,
      })),
      ...uploadedImages.map((image, index) => ({
        url: image.secure_url,
        publicId: image.publicId,
        alt: `${payload.title} image ${existingImageUrls.length + index + 1}`,
        isPrimary: existingImageUrls.length + index === 0,
      })),
    ],
    imagePublicIds: [...existingPublicIds, ...uploadedPublicIds],
    status: payload.status || "AVAILABLE",
    packingType: payload.packingType || "0 x 0 x 0 cm",
    location: payload.location || "Orchard Growers",
    createdSource: "admin-panel",
  });

  res.status(201).json(product);
};

export const updateProductByAdmin = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const payload = normalizeProductAdminPayload(req.body);
  if (payload.title) {
    payload.slug = createProductSlug(payload.title);
  }
  if (Object.prototype.hasOwnProperty.call(payload, "status")) {
    if (!["AVAILABLE", "SOLD"].includes(payload.status)) {
      return res.status(400).json({ msg: "Invalid product status" });
    }
  }

  delete payload.sku;

  if (payload.hsnCode && !/^\d+$/.test(String(payload.hsnCode).trim())) {
    return res.status(400).json({ msg: "HSN code must be numeric" });
  }

  if (Object.prototype.hasOwnProperty.call(payload, "gstRate") && !GST_ALLOWED_VALUES.has(Number(payload.gstRate))) {
    return res.status(400).json({ msg: "GST rate must be one of 0, 5, 12, 18, or 28" });
  }

  if (Object.prototype.hasOwnProperty.call(payload, "discountPercent")) {
    const discountPercent = Number(payload.discountPercent || 0);
    if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {
      return res.status(400).json({ msg: "Discount must be between 0 and 100" });
    }
    payload.discountPercent = discountPercent;
  }

  if (Object.prototype.hasOwnProperty.call(payload, "quantity")) {
    const quantity = Number(payload.quantity || 0);
    if (!Number.isFinite(quantity) || quantity < 0) {
      return res.status(400).json({ msg: "Negative stock cannot be processed. Purchase or update stock first." });
    }
    payload.quantity = quantity;
  }

  if (
    [
      "packShape",
      "packLengthCm",
      "packWidthCm",
      "packHeightCm",
      "packRadiusCm",
      "packThicknessCm",
      "actualWeightKg",
    ].some((field) => Object.prototype.hasOwnProperty.call(payload, field))
  ) {
    Object.assign(payload, calculatePackWeights(payload));
  }

  const product = await Product.findByIdAndUpdate(req.params.id, payload, { new: true });
  if (!product) return res.status(404).json({ msg: "Product not found" });

  res.json(product);
};

export const deleteProductByAdmin = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ msg: "Product not found" });

  await product.deleteOne();
  res.json({ msg: "Product deleted successfully" });
};

export const listVerificationRequests = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const requests = await VerificationRequest.find()
    .populate("user", "name orchardName phone email role isVerified accountStatus")
    .populate("adminReviews.admin", "name email role")
    .sort({ createdAt: -1 });

  res.json(requests);
};

export const listKycRequests = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const users = await User.find({
    $or: [
      { "kyc.status": { $in: KYC_REVIEW_STATUSES } },
      { "kyc.status": KYC_SUBMITTED_STATUS_PATTERN },
      { "kyc.submittedAt": { $exists: true, $ne: null } },
      {
        "kyc.fullName": { $exists: true, $ne: "" },
        "kyc.idProofNumber": { $exists: true, $ne: "" },
        "kyc.accountNumber": { $exists: true, $ne: "" },
      },
    ],
  })
    .select("-password -__v")
    .populate("kyc.adminReviews.admin", "name email role")
    .sort({ "kyc.submittedAt": -1, createdAt: -1 });

  res.json(users);
};

export const getKycRequestByAdmin = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const user = await User.findById(req.params.id)
    .select("-password -__v")
    .populate("kyc.adminReviews.admin", "name email role");

  if (!user || !user.kyc || normalizeKycStatus(user.kyc.status) === "NOT_SUBMITTED") {
    return res.status(404).json({ msg: "KYC request not found" });
  }

  res.json(user);
};

export const listOrders = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const orders = await Order.find()
    .populate("items.product", "title fruitName basePrice")
    .populate("product", "title fruitName basePrice")
    .populate("buyer", "name businessName phone email")
    .populate("grower", "name orchardName phone email")
    .sort({ createdAt: -1 });

  res.json(orders);
};

export const updateOrderLogistics = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ msg: "Order not found" });

  const deliveryMode = String(req.body.deliveryPartnerSelection || order.deliveryPartnerSelection || "AUTOMATIC").toUpperCase();
  const courierPartner = String(req.body.courierPartner || order.courierPartner || "India Post").trim();
  const bookingStatus = String(req.body.courierBookingStatus || "").trim().toUpperCase();
  const deliveryStatus = String(req.body.deliveryStatus || "").trim().toUpperCase();

  if (["AUTOMATIC", "MANUAL"].includes(deliveryMode)) {
    order.deliveryPartnerSelection = deliveryMode;
  }
  if (courierPartner) order.courierPartner = courierPartner;
  if (req.body.trackingNumber !== undefined) order.trackingNumber = String(req.body.trackingNumber || "").trim();
  if (["PENDING", "TEST_BOOKED", "BOOKED", "FAILED", "MANUAL_REVIEW"].includes(bookingStatus)) {
    order.courierBookingStatus = bookingStatus;
  }
  if (["PENDING", "IN_TRANSIT", "DELIVERED", "PLACED"].includes(deliveryStatus)) {
    order.deliveryStatus = deliveryStatus;
  }
  if (order.deliveryPartnerSelection === "AUTOMATIC" && !order.trackingNumber) {
    order.courierPartner = "India Post";
    order.courierBookingStatus = "TEST_BOOKED";
    order.trackingNumber = `IPTEST${Date.now().toString().slice(-10)}`;
  }

  await order.save();
  res.json(order);
};

export const reviewKycRequest = async (req, res) => {
  const currentAdmin = requireAdmin(req, res);
  if (!currentAdmin) return;

  const action = String(req.body.action || "").toUpperCase();
  if (!["APPROVE", "REJECT", "UNDER_REVIEW", "CORRECTION_REQUIRED"].includes(action)) {
    return res.status(400).json({ msg: "Invalid KYC review action" });
  }

  const user = await User.findById(req.params.userId);
  if (!user) return res.status(404).json({ msg: "User not found" });
  const kycStatus = normalizeKycStatus(user.kyc?.status);
  if (!KYC_REVIEW_STATUSES.includes(kycStatus)) {
    return res.status(400).json({ msg: "KYC is not completed by user" });
  }
  if (user.kyc.status !== kycStatus) user.kyc.status = kycStatus;
  const kycRoleType = getKycRoleType(user);
  if (kycRoleType && user.kyc.roleType !== kycRoleType) user.kyc.roleType = kycRoleType;

  if (["REJECT", "CORRECTION_REQUIRED"].includes(action) && !String(req.body.note || req.body.adminRemarks || "").trim()) {
    return res.status(400).json({ msg: "Admin remarks are required for rejection or correction." });
  }

  const adminClass = getAdminClass(currentAdmin.role);
  const existingReview = user.kyc.adminReviews.find(
    (review) =>
      review.admin?.toString() === currentAdmin.id?.toString() ||
      review.adminClass === adminClass
  );

  if (existingReview) {
    existingReview.admin = currentAdmin.id;
    existingReview.adminClass = adminClass;
    existingReview.action = action;
    existingReview.note = req.body.note || req.body.adminRemarks || "";
    existingReview.reviewedAt = new Date();
  } else {
    user.kyc.adminReviews.push({
      admin: currentAdmin.id,
      adminClass,
      action,
      note: req.body.note || req.body.adminRemarks || "",
      reviewedAt: new Date(),
    });
  }

  const canFinalizeImmediately = currentAdmin.role === "SUPER_ADMIN";
  if (action === "UNDER_REVIEW") {
    user.kyc.status = "UNDER_REVIEW";
    user.kyc.reviewedBy = currentAdmin.id;
    user.kyc.reviewedAt = new Date();
  }

  if (action === "CORRECTION_REQUIRED") {
    user.kyc.status = "CORRECTION_REQUIRED";
    user.kyc.adminRemarks = req.body.note || req.body.adminRemarks || "";
    user.kyc.reviewedBy = currentAdmin.id;
    user.kyc.reviewedAt = new Date();
  }

  if (action === "APPROVE" && (hasDualApproval(user.kyc.adminReviews) || canFinalizeImmediately)) {
    user.kyc.status = "APPROVED";
    user.kyc.decidedBy = currentAdmin.id;
    user.kyc.decidedAt = new Date();
    user.kyc.reviewedBy = currentAdmin.id;
    user.kyc.reviewedAt = new Date();
    user.kyc.adminRemarks = req.body.note || req.body.adminRemarks || "";
    user.isVerified = true;
    if (kycRoleType === "buyer") user.buyerVerified = true;
    if (kycRoleType === "grower") user.growerVerified = true;
    if (kycRoleType === "driver") user.driverVerified = true;
    user.accountStatus = "ACTIVE";
  }

  if (action === "REJECT" && (hasDualRejection(user.kyc.adminReviews) || canFinalizeImmediately)) {
    user.kyc.status = "REJECTED";
    user.kyc.decidedBy = currentAdmin.id;
    user.kyc.decidedAt = new Date();
    user.kyc.reviewedBy = currentAdmin.id;
    user.kyc.reviewedAt = new Date();
    user.kyc.adminRemarks = req.body.note || req.body.adminRemarks || "";
    user.isVerified = false;
    if (kycRoleType === "buyer") user.buyerVerified = false;
    if (kycRoleType === "grower") user.growerVerified = false;
    if (kycRoleType === "driver") user.driverVerified = false;
  }

  await user.save();
  const populated = await User.findById(user._id)
    .select("-password -__v")
    .populate("kyc.adminReviews.admin", "name email role");

  res.json(populated);
};

export const updateKycStatusByAdmin = async (req, res) => {
  const status = String(req.body.status || "").trim().toLowerCase();
  const actionByStatus = {
    under_review: "UNDER_REVIEW",
    approved: "APPROVE",
    rejected: "REJECT",
    correction_required: "CORRECTION_REQUIRED",
  };

  if (status === "pending") {
    const currentAdmin = requireAdmin(req, res);
    if (!currentAdmin) return;
    const user = await User.findById(req.params.id);
    if (!user || !user.kyc || normalizeKycStatus(user.kyc.status) === "NOT_SUBMITTED") {
      return res.status(404).json({ msg: "KYC request not found" });
    }
    user.kyc.status = "PENDING";
    user.kyc.reviewedBy = currentAdmin.id;
    user.kyc.reviewedAt = new Date();
    await user.save();
    return res.json(await User.findById(user._id).select("-password -__v"));
  }

  const action = actionByStatus[status];
  if (!action) return res.status(400).json({ msg: "Invalid KYC status" });

  req.params.userId = req.params.id;
  req.body.action = action;
  req.body.note = req.body.adminRemarks || req.body.note || "";
  return reviewKycRequest(req, res);
};

export const reviewVerificationRequest = async (req, res) => {
  const currentAdmin = requireAdmin(req, res);
  if (!currentAdmin) return;

  const action = String(req.body.action || "").toUpperCase();
  const allowedActions = ["APPROVE", "REJECT", "DISAPPROVE", "HOLD", "SUSPEND", "TERMINATE"];

  if (!allowedActions.includes(action)) {
    return res.status(400).json({ msg: "Invalid review action" });
  }

  const request = await VerificationRequest.findById(req.params.id);
  if (!request) return res.status(404).json({ msg: "Verification request not found" });

  const existingReview = request.adminReviews.find(
    (review) => review.admin?.toString() === currentAdmin.id?.toString()
  );

  if (existingReview) {
    existingReview.adminClass = getAdminClass(currentAdmin.role);
    existingReview.action = action;
    existingReview.note = req.body.note || "";
    existingReview.reviewedAt = new Date();
  } else {
    request.adminReviews.push({
      admin: currentAdmin.id,
      adminClass: getAdminClass(currentAdmin.role),
      action,
      note: req.body.note || "",
      reviewedAt: new Date(),
    });
  }

  const hasTwoApprovals = hasDualApproval(request.adminReviews);
  const hasTwoRejects = hasDualRejection(request.adminReviews);
  const canFinalizeImmediately = currentAdmin.role === "SUPER_ADMIN";

  if ((action === "APPROVE" && (hasTwoApprovals || canFinalizeImmediately))) {
    request.status = "APPROVED";
    request.decidedBy = currentAdmin.id;
    request.decidedAt = new Date();
    await User.findByIdAndUpdate(request.user, { isVerified: true, accountStatus: "ACTIVE" });
  }

  if (["HOLD", "SUSPEND", "TERMINATE"].includes(action)) {
    request.status = action === "SUSPEND" ? "SUSPENDED" : action === "TERMINATE" ? "TERMINATED" : "HOLD";
    request.decidedBy = currentAdmin.id;
    request.decidedAt = new Date();

    const accountStatus = action === "SUSPEND" ? "SUSPENDED" : action === "TERMINATE" ? "TERMINATED" : "HOLD";
    await User.findByIdAndUpdate(request.user, {
      accountStatus,
      isVerified: false,
      adminNotes: req.body.note || `${request.status} by admin`,
    });
  } else if (action !== "APPROVE" && (hasTwoRejects || canFinalizeImmediately)) {
    request.status = action === "DISAPPROVE" ? "DISAPPROVED" : "REJECTED";
    request.decidedBy = currentAdmin.id;
    request.decidedAt = new Date();
  }

  await request.save();
  const populated = await VerificationRequest.findById(request._id)
    .populate("user", "name orchardName phone email role isVerified accountStatus")
    .populate("adminReviews.admin", "name email role");

  res.json(populated);
};

export const updateVerificationRequestByAdmin = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const allowed = ["orchardName", "ownerName", "location", "phone", "youtubeVideoId"];
  const updates = {};

  allowed.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      updates[field] = String(req.body[field] || "").trim();
    }
  });

  if (!Object.keys(updates).length) {
    return res.status(400).json({ msg: "No request changes supplied" });
  }

  const request = await VerificationRequest.findByIdAndUpdate(req.params.id, updates, { new: true })
    .populate("user", "name orchardName phone email role isVerified accountStatus")
    .populate("adminReviews.admin", "name email role");

  if (!request) return res.status(404).json({ msg: "Verification request not found" });

  res.json(request);
};
