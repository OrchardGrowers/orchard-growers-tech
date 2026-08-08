import VerificationRemark from "../models/VerificationRemark.js";
import {
  getPanValidationErrors,
  validateKycSubmission,
} from "./kycEligibilityService.js";
import {
  normalizeVerificationSection,
  VERIFICATION_SECTION_CONFIG,
} from "./verificationFeedbackService.js";

export const KYC_LOCKED_MESSAGE =
  "This verification section is locked. It must be reopened by an administrator before changes can be made.";

export const KYC_SECTION_DEFINITIONS = Object.freeze({
  personal: {
    label: "Personal Details",
    fields: ["fullName", "phone", "email", "address", "district", "state", "pinCode"],
    documentLabels: [],
    fileFields: [],
  },
  identity: {
    label: "Identity / Aadhaar",
    fields: ["idProofType", "idProofNumber", "idProofImage", "aadhaarCardNo", "aadhaarCardFileUrl", "gstNumber", "gstCertificate"],
    documentLabels: ["idProof", "gstCertificate"],
    fileFields: ["idProofImage", "aadhaarCardFile", "gstCertificate"],
  },
  pan: {
    label: "PAN Details",
    fields: ["panNumber", "panImage"],
    documentLabels: ["pan"],
    fileFields: ["panImage"],
  },
  bank: {
    label: "Bank Details",
    fields: ["bankAccountHolderName", "bankName", "accountNumber", "bankAccountNo", "ifscCode", "upiId", "passbookFileUrl"],
    documentLabels: ["passbookFile"],
    fileFields: ["passbookFile"],
  },
  business: {
    label: "Grower Details",
    fields: ["orchardName", "orchardLocation", "udyanCardNo", "udyanCardFileUrl"],
    documentLabels: ["udyanCard"],
    fileFields: ["udyanCardFile"],
    roles: ["grower"],
  },
  driver: {
    label: "Driver Details",
    fields: ["vehicleNumber", "drivingLicenseNumber", "drivingLicenseImage"],
    documentLabels: ["drivingLicense"],
    fileFields: ["drivingLicenseImage"],
    roles: ["driver"],
  },
});

const EDITABLE_STATUSES = new Set(["NOT_SUBMITTED", "CHANGES_REQUIRED", "REJECTED"]);
const SECTION_EVENT_ALIASES = Object.freeze({ document: "identity" });

export const getKycSectionsForRole = (roleType = "") => {
  const role = String(roleType || "").trim().toLowerCase();
  return Object.entries(KYC_SECTION_DEFINITIONS)
    .filter(([, definition]) => !definition.roles || definition.roles.includes(role))
    .filter(([section]) => section !== "pan" || ["buyer", "grower"].includes(role))
    .map(([section]) => section);
};

export const normalizeKycSection = (section = "") => {
  const normalized = normalizeVerificationSection(section);
  const aliased = SECTION_EVENT_ALIASES[normalized] || normalized;
  if (!KYC_SECTION_DEFINITIONS[aliased]) {
    throw Object.assign(new Error("Invalid KYC verification section"), { statusCode: 400 });
  }
  return aliased;
};

const normalizeOverallStatus = (status = "") => {
  const normalized = String(status || "NOT_SUBMITTED").trim().toUpperCase();
  if (normalized === "SUBMITTED" || normalized === "COMPLETED") return "PENDING";
  if (normalized === "APPROVED") return "VERIFIED";
  if (normalized === "CORRECTION_REQUIRED") return "CHANGES_REQUIRED";
  return normalized || "NOT_SUBMITTED";
};

const serializeEvent = (entry) => entry ? ({
  _id: entry._id,
  section: SECTION_EVENT_ALIASES[entry.section] || entry.section,
  status: entry.status,
  remark: entry.remark || "",
  source: entry.source,
  actionUrl: entry.actionUrl,
  createdAt: entry.createdAt,
  resolvedAt: entry.resolvedAt,
}) : null;

export const buildKycSectionStates = ({ kyc = {}, roleType = "", entries = [] }) => {
  const sections = getKycSectionsForRole(roleType);
  const fallbackStatus = normalizeOverallStatus(kyc.status);
  const latestBySection = new Map();
  const historyBySection = new Map();

  entries.forEach((entry) => {
    const eventSection = SECTION_EVENT_ALIASES[entry.section] || entry.section;
    if (!sections.includes(eventSection)) return;
    if (!historyBySection.has(eventSection)) historyBySection.set(eventSection, []);
    historyBySection.get(eventSection).push(serializeEvent(entry));
    if (!latestBySection.has(eventSection)) latestBySection.set(eventSection, entry);
  });

  return Object.fromEntries(sections.map((section) => {
    const latest = latestBySection.get(section);
    let status = latest?.status || fallbackStatus;
    // Existing approved buyer/grower accounts without the newly mandatory PAN
    // must be able to update PAN without reopening unrelated verified sections.
    if (section === "pan" && Object.keys(getPanValidationErrors(kyc, roleType)).length) {
      status = "CHANGES_REQUIRED";
    }
    const latestRemark = latest?.source === "ADMIN" && ["CHANGES_REQUIRED", "REJECTED"].includes(latest.status)
      ? serializeEvent(latest)
      : null;
    return [section, {
      section,
      label: KYC_SECTION_DEFINITIONS[section].label,
      status,
      editable: EDITABLE_STATUSES.has(status),
      actionUrl: VERIFICATION_SECTION_CONFIG[section]?.actionUrl || `/kyc#${section}`,
      latestRemark,
      history: historyBySection.get(section) || [],
    }];
  }));
};

export const getKycSectionStates = async ({ userId, roleType = "", kyc = {} }) => {
  const entries = await VerificationRemark.find({
    user: userId,
    roleType: String(roleType || "").trim().toLowerCase(),
    section: { $in: [...getKycSectionsForRole(roleType), "document"] },
  }).sort({ createdAt: -1 }).lean();
  return buildKycSectionStates({ kyc, roleType, entries });
};

export const ensureKycSectionStateEvents = async ({ userId, roleType = "", entityId = null, states = {} }) => {
  const missingEvents = Object.values(states)
    .filter((state) => !state.history.length && state.status !== "NOT_SUBMITTED")
    .map((state) => ({
      user: userId,
      section: state.section,
      roleType: String(roleType || "").trim().toLowerCase(),
      status: state.status,
      remark: "Legacy KYC section state initialized.",
      source: "SYSTEM",
      entityId,
      actionUrl: state.actionUrl,
      resolvedAt: new Date(),
    }));
  if (missingEvents.length) await VerificationRemark.insertMany(missingEvents);
  return missingEvents.length;
};

export const assertKycSectionEditable = (sectionState) => {
  if (!sectionState?.editable) {
    throw Object.assign(new Error(KYC_LOCKED_MESSAGE), { statusCode: 403 });
  }
};

export const getKycSectionPayloadViolations = ({ section, body = {}, files = {} }) => {
  const definition = KYC_SECTION_DEFINITIONS[section];
  const allKycFields = new Set(Object.values(KYC_SECTION_DEFINITIONS).flatMap((item) => item.fields));
  const allowedFields = new Set(definition.fields);
  const bodyViolations = Object.keys(body).filter((field) => allKycFields.has(field) && !allowedFields.has(field));
  const allowedFileFields = new Set(definition.fileFields);
  const fileViolations = Object.keys(files || {}).filter((field) => !allowedFileFields.has(field));
  return [...bodyViolations, ...fileViolations];
};

export const getKycSectionDocuments = (section, documents = []) => {
  const allowedLabels = new Set(KYC_SECTION_DEFINITIONS[section].documentLabels);
  return documents.filter((document) => allowedLabels.has(document.label));
};

export const validateKycSection = (kyc = {}, roleType = "", section = "") => {
  const normalizedSection = normalizeKycSection(section);
  if (normalizedSection === "pan") return getPanValidationErrors(kyc, roleType);
  const fullErrors = validateKycSubmission(kyc, roleType);
  const allowedErrorFields = {
    personal: ["roleType", "fullName", "phone", "email", "address", "district", "state", "pinCode"],
    identity: ["idProofType", "idProofNumber", "idProof"],
    bank: ["accountNumber", "ifscCode", "bankAccountHolderName", "bankName", "passbookFile"],
    business: [],
    driver: ["vehicleNumber", "drivingLicenseNumber", "drivingLicense"],
  }[normalizedSection] || [];
  return Object.fromEntries(Object.entries(fullErrors).filter(([field]) => allowedErrorFields.includes(field)));
};
