import { getKycEligibility } from "../services/kycEligibilityService.js";

export const isRoleOgPubliclyVerified = ({ isKycVerified = false, roleOg = {} } = {}) =>
  Boolean(
    isKycVerified &&
      roleOg?.requestId &&
      roleOg?.decidedAt &&
      String(roleOg?.status || "").trim().toUpperCase() === "APPROVED"
  );

export const GROWER_VERIFICATION_LEVELS = Object.freeze({
  REGISTERED: "REGISTERED",
  VERIFIED: "VERIFIED",
  OG_VERIFIED: "OG_VERIFIED",
});

export const getGrowerVerificationLevel = ({
  kycStatus = "NOT_SUBMITTED",
  isKycEligible = false,
  roleOg = {},
} = {}) => {
  const hasCanonicalApprovedKyc =
    String(kycStatus || "").trim().toUpperCase() === "APPROVED" &&
    isKycEligible === true;

  if (!hasCanonicalApprovedKyc) return GROWER_VERIFICATION_LEVELS.REGISTERED;
  if (isRoleOgPubliclyVerified({ isKycVerified: true, roleOg })) {
    return GROWER_VERIFICATION_LEVELS.OG_VERIFIED;
  }
  return GROWER_VERIFICATION_LEVELS.VERIFIED;
};

// Untagged legacy KYC cannot prove which business role was approved.
export const getPublicGrowerKycEligibility = (user = {}) => getKycEligibility({
  ...user,
  kycByRole: user.kycByRole,
  kyc: String(user.kyc?.roleType || "").trim().toLowerCase() === "grower" ? user.kyc : {},
}, "grower");
