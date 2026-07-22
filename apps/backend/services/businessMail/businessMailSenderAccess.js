import mongoose from "mongoose";
import Admin from "../../models/Admin.js";
import {
  BUSINESS_MAIL_ERROR_CODES,
  BusinessMailError,
} from "./businessMailErrors.js";
import {
  BUSINESS_MAIL_SENDER_PROFILE_KEYS,
  listBusinessMailSenderProfiles,
} from "./senderProfiles.js";

const CONTROLLED_PROFILE_KEYS = new Set(Object.values(BUSINESS_MAIL_SENDER_PROFILE_KEYS));
export const BUSINESS_MAIL_ACCESS_ROLES = Object.freeze([
  "SUPER_ADMIN",
  "ADMIN",
  "SUPPORT_EXECUTIVE",
  "SALES_EXECUTIVE",
]);
const BUSINESS_MAIL_ACCESS_ROLE_SET = new Set(BUSINESS_MAIL_ACCESS_ROLES);
export const BUSINESS_MAIL_COMMON_SENDER_PROFILE_KEYS = Object.freeze([
  BUSINESS_MAIL_SENDER_PROFILE_KEYS.EFRUITMANDI_NO_REPLY,
  BUSINESS_MAIL_SENDER_PROFILE_KEYS.ORCHARD_NO_REPLY,
]);
const COMMON_PROFILE_KEY_SET = new Set(BUSINESS_MAIL_COMMON_SENDER_PROFILE_KEYS);

const normalizeEmail = (value = "") => String(value || "").trim().toLowerCase();
const normalizeProfileKey = (value = "") => String(value || "").trim().toUpperCase();

export const getBusinessMailMasterAdminEmail = () =>
  normalizeEmail(process.env.BUSINESS_MAIL_MASTER_ADMIN_EMAIL);

export const isBusinessMailMasterAdmin = (admin = {}) => {
  const masterEmail = getBusinessMailMasterAdminEmail();
  return Boolean(masterEmail && normalizeEmail(admin.email) === masterEmail);
};

export const normalizeBusinessMailSenderProfileKeys = (values, { rejectUnknown = true } = {}) => {
  if (!Array.isArray(values)) {
    throw new BusinessMailError(
      BUSINESS_MAIL_ERROR_CODES.INVALID_REQUEST,
      "Sender profile allowlist must be an array of controlled sender profile keys."
    );
  }

  const normalized = [...new Set(values.map((value) => normalizeProfileKey(value)).filter(Boolean))];
  const unknown = normalized.some((key) => !CONTROLLED_PROFILE_KEYS.has(key));
  if (unknown && rejectUnknown) {
    throw new BusinessMailError(
      BUSINESS_MAIL_ERROR_CODES.INVALID_REQUEST,
      "One or more sender profile keys are invalid."
    );
  }
  return normalized.filter((key) => CONTROLLED_PROFILE_KEYS.has(key));
};

export const normalizeBusinessMailRestrictedSenderProfileKeys = (values) => {
  const normalized = normalizeBusinessMailSenderProfileKeys(values);
  if (normalized.some((key) => COMMON_PROFILE_KEY_SET.has(key))) {
    throw new BusinessMailError(
      BUSINESS_MAIL_ERROR_CODES.INVALID_REQUEST,
      "Common sender profiles are automatic and cannot be assigned."
    );
  }
  return normalized;
};

export const getGloballyEnabledBusinessMailSenderProfiles = () =>
  listBusinessMailSenderProfiles().filter((profile) => profile.enabled);

const loadAdminAccessRecord = async (admin = {}) => {
  if (Object.prototype.hasOwnProperty.call(admin, "businessMailAccess")) return admin;
  const id = String(admin._id || admin.id || "").trim();
  if (!mongoose.isValidObjectId(id)) return null;
  return Admin.findById(id).select("_id email businessMailAccess").lean();
};

export const getAuthorizedBusinessMailSenderProfiles = async (admin = {}) => {
  if (!BUSINESS_MAIL_ACCESS_ROLE_SET.has(String(admin.role || "").trim().toUpperCase())) return [];
  const globallyEnabled = getGloballyEnabledBusinessMailSenderProfiles();
  if (isBusinessMailMasterAdmin(admin)) return globallyEnabled;

  const commonProfiles = globallyEnabled.filter((profile) => COMMON_PROFILE_KEY_SET.has(profile.key));
  const storedAdmin = await loadAdminAccessRecord(admin);
  if (!storedAdmin?.businessMailAccess?.enabled) return commonProfiles;
  const assignedKeys = new Set(
    normalizeBusinessMailSenderProfileKeys(
      storedAdmin.businessMailAccess.allowedRestrictedSenderProfiles
        || storedAdmin.businessMailAccess.allowedSenderProfiles
        || [],
      { rejectUnknown: false }
    ).filter((key) => !COMMON_PROFILE_KEY_SET.has(key))
  );
  return globallyEnabled.filter(
    (profile) => COMMON_PROFILE_KEY_SET.has(profile.key) || assignedKeys.has(profile.key)
  );
};

export const assertBusinessMailSenderAccess = async (admin, senderProfileKey) => {
  const normalizedKey = normalizeProfileKey(senderProfileKey);
  const authorizedProfiles = await getAuthorizedBusinessMailSenderProfiles(admin);
  const authorized = authorizedProfiles.find((profile) => profile.key === normalizedKey);
  if (!authorized) {
    throw new BusinessMailError(
      BUSINESS_MAIL_ERROR_CODES.SENDER_ACCESS_DENIED,
      "You are not authorized to use this Business Mail sender profile."
    );
  }
  return authorized;
};

export const requireBusinessMailMasterAdmin = (req, res, next) => {
  if (!isBusinessMailMasterAdmin(req.admin || req.user || {})) {
    return res.status(403).json({
      success: false,
      code: BUSINESS_MAIL_ERROR_CODES.SENDER_ACCESS_DENIED,
      msg: "Business Mail sender access management is not permitted.",
    });
  }
  return next();
};
