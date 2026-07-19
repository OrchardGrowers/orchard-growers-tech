export const VERIFICATION_STATUS = Object.freeze({
  UNVERIFIED: "UNVERIFIED",
  BUYER_VERIFIED: "BUYER_VERIFIED",
  GROWER_VERIFIED: "GROWER_VERIFIED",
  ADMIN_VERIFIED: "ADMIN_VERIFIED",
  FINALIZED: "FINALIZED",
});

export const VERIFICATION_STATUS_VALUES = Object.freeze(
  Object.values(VERIFICATION_STATUS)
);

const boundedText = (value, maxLength) => {
  if (value === null || value === undefined) return null;
  return String(value).trim().slice(0, maxLength) || null;
};

const optionalDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const createVerificationRecord = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  return {
    timestamp: optionalDate(value.timestamp),
    notes: boundedText(value.notes, 1000),
    reviewVersion: boundedText(value.reviewVersion, 100),
  };
};

export const createVerificationState = (overrides = {}) => {
  const requestedStatus = String(overrides.verificationStatus || "").toUpperCase();

  return {
    verificationStatus: VERIFICATION_STATUS_VALUES.includes(requestedStatus)
      ? requestedStatus
      : VERIFICATION_STATUS.UNVERIFIED,
    buyerVerification: createVerificationRecord(overrides.buyerVerification),
    growerVerification: createVerificationRecord(overrides.growerVerification),
    adminVerification: createVerificationRecord(overrides.adminVerification),
    groundTruthVersion: boundedText(overrides.groundTruthVersion, 100),
    groundTruthLocked: overrides.groundTruthLocked === true,
  };
};
