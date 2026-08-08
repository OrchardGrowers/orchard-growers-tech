export const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export const PAN_REQUIRED_ROLES = new Set(["buyer", "grower"]);
export const PAN_KYC_REQUIRED_MESSAGE =
  "Complete PAN and KYC verification before proceeding with this transaction.";

export const normalizePanNumber = (value = "") =>
  String(value || "").trim().toUpperCase();

export const getRoleKycRecord = (user = {}, roleType = "") => {
  const role = String(roleType || "").trim().toLowerCase();
  const roleKyc = user?.kycByRole?.[role];
  if (roleKyc && Object.keys(roleKyc.toObject?.() || roleKyc).length) {
    return roleKyc.toObject?.() || roleKyc;
  }

  const legacyKyc = user?.kyc?.toObject?.() || user?.kyc || {};
  const legacyRole = String(legacyKyc.roleType || "").trim().toLowerCase();
  if (legacyRole === role || (!legacyRole && role && Object.keys(legacyKyc).length)) {
    return legacyKyc;
  }
  return {};
};

export const getPanValidationErrors = (kyc = {}, roleType = "") => {
  const role = String(roleType || "").trim().toLowerCase();
  const errors = {};
  const panNumber = normalizePanNumber(kyc.panNumber);
  if (PAN_REQUIRED_ROLES.has(role) && !panNumber) errors.panNumber = "PAN Number is required.";
  else if (panNumber && !PAN_PATTERN.test(panNumber)) {
    errors.panNumber = "Enter a valid PAN, for example ABCDE1234F.";
  }
  if (PAN_REQUIRED_ROLES.has(role) && !String(kyc.panImage || "").trim()) {
    errors.panImage = "PAN Card document is required.";
  }
  return errors;
};

export const hasCompletePanForRole = (kyc = {}, roleType = "") =>
  Object.keys(getPanValidationErrors(kyc, roleType)).length === 0;

export const validateKycSubmission = (kyc = {}, roleType = "") => {
  const role = String(roleType || "").trim().toLowerCase();
  const errors = {};
  if (!kyc.roleType) errors.roleType = "Role type is required.";
  if (!kyc.fullName) errors.fullName = "Full name is required.";
  if (!kyc.phone) errors.phone = "Phone is required.";
  if (!kyc.address) errors.address = role === "buyer" ? "Buyer premises address is required." : "Address is required.";
  if (!kyc.pinCode) errors.pinCode = "PIN code is required.";
  if (!kyc.idProofType) errors.idProofType = "ID proof type is required.";
  if (!kyc.idProofNumber) errors.idProofNumber = "ID proof number is required.";
  if (String(kyc.idProofType || "").trim().toLowerCase() === "aadhaar" && String(kyc.idProofNumber || "").replace(/\D/g, "").length !== 12) {
    errors.idProofNumber = "Aadhaar must be exactly 12 digits.";
  }
  if (!kyc.idProofImage) errors.idProof = "ID proof image is required.";
  if (!kyc.accountNumber) errors.accountNumber = "Bank account number is required.";
  if (!kyc.ifscCode) errors.ifscCode = "IFSC code is required.";
  if (!kyc.bankAccountHolderName) errors.bankAccountHolderName = "Bank account holder name is required.";
  if (!kyc.bankName) errors.bankName = "Bank name is required.";
  if (!kyc.passbookFileUrl) errors.passbookFile = "Bank proof/passbook file is required.";
  if (role === "driver" && !kyc.vehicleNumber) errors.vehicleNumber = "Vehicle number is required.";
  if (role === "driver" && !kyc.drivingLicenseNumber) errors.drivingLicenseNumber = "Driving license number is required.";
  if (role === "driver" && !kyc.drivingLicenseImage) errors.drivingLicense = "Driving license image is required.";
  return { ...errors, ...getPanValidationErrors(kyc, role) };
};

export const getKycEligibility = (user = {}, roleType = "") => {
  const role = String(roleType || "").trim().toLowerCase();
  const kyc = getRoleKycRecord(user, role);
  const status = String(kyc.status || "NOT_SUBMITTED").trim().toUpperCase();
  const verifiedFlag = role === "buyer"
    ? user.buyerVerified
    : role === "grower"
      ? user.growerVerified
      : role === "driver"
        ? user.driverVerified
        : false;
  const panComplete = hasCompletePanForRole(kyc, role);
  const approved = Boolean(verifiedFlag) || status === "APPROVED";
  return {
    roleType: role,
    kyc,
    status,
    approved,
    panRequired: PAN_REQUIRED_ROLES.has(role),
    panComplete,
    panUpdateRequired: PAN_REQUIRED_ROLES.has(role) && status !== "NOT_SUBMITTED" && !panComplete,
    eligible: approved && panComplete,
  };
};

export const hasTransactionEligibleKyc = (user = {}, roleType = "") =>
  getKycEligibility(user, roleType).eligible;
