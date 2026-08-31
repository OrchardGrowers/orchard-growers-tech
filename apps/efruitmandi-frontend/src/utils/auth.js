import { sanitizeUserForStorage } from "./userStorage";

export const getStoredItem = (key) => {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const hasAccessToken = () => Boolean(getStoredItem("accessToken"));

export const logoutUser = () => {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("user");

  window.location.href = "/";
};

export const getCurrentUser = () => {
  try {
    const user = JSON.parse(getStoredItem("user")) || {};
    return sanitizeUserForStorage(user);
  } catch {
    return {};
  }
};

export const getProfileTypes = (user = getCurrentUser()) => {
  const profiles = new Set(Array.isArray(user.profileTypes) ? user.profileTypes : []);

  if (user.role) profiles.add(user.role);
  if (user.orchardName) profiles.add("grower");
  if (user.businessName || user.buyerContactPerson) profiles.add("buyer");
  if (user.logisticsName || user.vehicleNumber || user.driverName) profiles.add("driver");

  return profiles;
};

export const hasGrowerProfile = (user = getCurrentUser()) =>
  getProfileTypes(user).has("grower");

export const hasBuyerProfile = (user = getCurrentUser()) =>
  getProfileTypes(user).has("buyer");

export const hasDriverProfile = (user = getCurrentUser()) =>
  getProfileTypes(user).has("driver");

export const hasCompletedKyc = (user = getCurrentUser()) =>
  String(user?.kyc?.status || "").toUpperCase() === "APPROVED";

export const getRoleKyc = (user = getCurrentUser(), roleType = "") => {
  const role = String(roleType || "").trim().toLowerCase();
  const roleKyc = user?.kycByRole?.[role];
  if (roleKyc && Object.keys(roleKyc).length) return roleKyc;

  const legacyKyc = user?.kyc || {};
  const legacyRole = String(legacyKyc.roleType || "").trim().toLowerCase();
  if (legacyRole === role || (!legacyRole && role && Object.keys(legacyKyc).some((key) => legacyKyc[key]))) {
    return legacyKyc;
  }

  return {};
};

export const hasCompletedKycForRole = (user = getCurrentUser(), roleType = "") =>
  String(getRoleKyc(user, roleType)?.status || "").toUpperCase() === "APPROVED" &&
  hasCompletePanForRole(user, roleType);

export const hasCompletePanForRole = (user = getCurrentUser(), roleType = "") => {
  const role = String(roleType || "").trim().toLowerCase();
  if (!new Set(["buyer", "grower"]).has(role)) return true;
  const kyc = getRoleKyc(user, role);
  return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(String(kyc.panNumber || "").trim().toUpperCase()) &&
    Boolean(String(kyc.panImage || "").trim());
};

export const getKycStatus = (user = getCurrentUser()) =>
  String(user?.kyc?.status || "NOT_SUBMITTED").toUpperCase();

export const getKycStatusLabel = (user = getCurrentUser()) => {
  const labels = {
    NOT_SUBMITTED: "Not Submitted",
    PENDING: "Pending Review",
    COMPLETED: "Pending Review",
    UNDER_REVIEW: "Under Review",
    REJECTED: "Rejected",
    CORRECTION_REQUIRED: "Correction Required",
    APPROVED: "Approved",
  };
  return labels[getKycStatus(user)] || "Not Submitted";
};

export const canQuote = (user = getCurrentUser()) => {
  if (!user || !(user._id || user.id || user.email || user.phone)) return false;
  if (hasBuyerProfile(user)) return (Boolean(user.buyerVerified) || hasCompletedKycForRole(user, "buyer")) && hasCompletePanForRole(user, "buyer");
  if (hasGrowerProfile(user)) return (Boolean(user.growerVerified) || hasCompletedKycForRole(user, "grower")) && hasCompletePanForRole(user, "grower");
  return false;
};

export const LOT_LISTING_ACCESS_MESSAGES = Object.freeze({
  VISITOR: "Please login or Sign up first to continue.",
  GROWER_REQUIRED: "Only verified growers can list fruit lots.",
  KYC_INCOMPLETE: "Please complete your KYC to list a fruit lot.",
  KYC_APPROVAL_REQUIRED: "Your KYC must be approved before you can list a fruit lot.",
});
export const LOT_LISTING_ACCESS_STATES = Object.freeze({
  LOADING: "LOADING",
  UNAUTHENTICATED: "UNAUTHENTICATED",
  NOT_GROWER: "NOT_GROWER",
  KYC_INCOMPLETE: "KYC_INCOMPLETE",
  KYC_PENDING: "KYC_PENDING",
  AUTHORIZED: "AUTHORIZED",
});
const KYC_AWAITING_APPROVAL_STATUSES = new Set(["PENDING", "COMPLETED", "UNDER_REVIEW"]);

const lotListingAccessResult = (state, message = "") => ({
  allowed: state === LOT_LISTING_ACCESS_STATES.AUTHORIZED,
  state,
  code: state,
  message,
});

export const canListFruitLot = (user = getCurrentUser()) => {
  const growerKycStatus = String(getRoleKyc(user, "grower")?.status || "NOT_SUBMITTED")
    .trim()
    .toUpperCase();
  const legacyVerifiedApproval = Boolean(user.growerVerified) && growerKycStatus === "NOT_SUBMITTED";
  return (
    String(user.activeRole || user.role || "").trim().toLowerCase() === "grower" &&
    hasGrowerProfile(user) &&
    (hasCompletedKycForRole(user, "grower") || legacyVerifiedApproval) &&
    hasCompletePanForRole(user, "grower")
  );
};

export const getFruitLotListingAccess = (
  user = getCurrentUser(),
  {
    authResolved = true,
    authenticated = hasAccessToken(),
    userResolved = true,
    canonicalResolved,
    canonicalStatus,
    canonicalEligible,
  } = {}
) => {
  if (!authResolved) {
    return lotListingAccessResult(LOT_LISTING_ACCESS_STATES.LOADING);
  }

  if (!authenticated) {
    return lotListingAccessResult(
      LOT_LISTING_ACCESS_STATES.UNAUTHENTICATED,
      LOT_LISTING_ACCESS_MESSAGES.VISITOR
    );
  }

  if (!userResolved) {
    return lotListingAccessResult(LOT_LISTING_ACCESS_STATES.LOADING);
  }

  const activeRole = String(user.activeRole || user.role || "").trim().toLowerCase();
  if (activeRole !== "grower" || !hasGrowerProfile(user)) {
    return lotListingAccessResult(
      LOT_LISTING_ACCESS_STATES.NOT_GROWER,
      LOT_LISTING_ACCESS_MESSAGES.GROWER_REQUIRED
    );
  }

  const hasCanonicalResolution = canonicalResolved ??
    (canonicalEligible !== undefined || canonicalStatus !== undefined);
  if (!hasCanonicalResolution) {
    return lotListingAccessResult(LOT_LISTING_ACCESS_STATES.LOADING);
  }

  const normalizedCanonicalStatus = String(canonicalStatus || "").trim().toUpperCase();
  if (canonicalEligible === true) {
    return lotListingAccessResult(LOT_LISTING_ACCESS_STATES.AUTHORIZED);
  }

  if (KYC_AWAITING_APPROVAL_STATUSES.has(normalizedCanonicalStatus)) {
    return lotListingAccessResult(
      LOT_LISTING_ACCESS_STATES.KYC_PENDING,
      LOT_LISTING_ACCESS_MESSAGES.KYC_APPROVAL_REQUIRED
    );
  }

  return lotListingAccessResult(
    LOT_LISTING_ACCESS_STATES.KYC_INCOMPLETE,
    LOT_LISTING_ACCESS_MESSAGES.KYC_INCOMPLETE
  );
};

export const isGrowerAccount = (user = getCurrentUser()) =>
  hasGrowerProfile(user);

export const isBuyerAccount = (user = getCurrentUser()) =>
  hasBuyerProfile(user);
