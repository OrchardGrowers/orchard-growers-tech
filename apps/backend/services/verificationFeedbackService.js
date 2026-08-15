import UserNotification from "../models/UserNotification.js";
import VerificationRemark from "../models/VerificationRemark.js";
import { sendEmail } from "./mailService.js";

export const VERIFICATION_SECTION_CONFIG = Object.freeze({
  kyc: { label: "KYC", actionUrl: "/kyc" },
  personal: { label: "Personal Details", actionUrl: "/kyc#personal" },
  identity: { label: "Identity Verification", actionUrl: "/kyc#identity" },
  pan: { label: "PAN Verification", actionUrl: "/kyc#pan" },
  bank: { label: "Bank Verification", actionUrl: "/kyc#bank" },
  document: { label: "Document Verification", actionUrl: "/kyc#identity" },
  business: { label: "Business Verification", actionUrl: "/kyc#business" },
  driver: { label: "Driver Verification", actionUrl: "/kyc#driver" },
  profile: { label: "Profile Verification", actionUrl: "/get-verified" },
});

const STATUS_ALIASES = Object.freeze({
  APPROVE: "VERIFIED",
  APPROVED: "VERIFIED",
  VERIFIED: "VERIFIED",
  CORRECTION_REQUIRED: "CHANGES_REQUIRED",
  CHANGES_REQUIRED: "CHANGES_REQUIRED",
  REJECT: "REJECTED",
  REJECTED: "REJECTED",
  DISAPPROVE: "REJECTED",
  DISAPPROVED: "REJECTED",
  HOLD: "REJECTED",
  SUSPEND: "REJECTED",
  SUSPENDED: "REJECTED",
  TERMINATE: "REJECTED",
  TERMINATED: "REJECTED",
  UNDER_REVIEW: "UNDER_REVIEW",
  PENDING: "PENDING",
  SUBMITTED: "PENDING",
  COMPLETED: "PENDING",
});

const ACTIVE_WARNING_STATUSES = new Set(["CHANGES_REQUIRED", "REJECTED"]);
const VALID_ROLE_TYPES = new Set(["buyer", "grower", "driver", ""]);

const VERIFICATION_COMPLETION_MESSAGES = Object.freeze({
  grower: {
    kyc: {
      title: "KYC Verified",
      message: "Welcome to eFruitMandi.Live! 🍎\n\nWe are pleased to inform you that your KYC has been successfully verified. You can now list your Fruit Lots and Consignments and begin your fruit trading journey with eFruitMandi.Live — the future of digital fruit trading.\n\nThank you for your patience and for choosing eFruitMandi.Live.\n\nFor any updates, queries, or assistance, please contact our Support Team:\n📱 WhatsApp: 7018108900\n📧 Email: support@efruitmandi.live",
    },
    og_verified: {
      title: "OG Verification Verified",
      message: "Welcome to eFruitMandi.Live! 🍎\n\nWe are pleased to inform you that your OG Verification has been successfully verified. You can now list your OG Verified Fruit Lots and Consignments and begin your fruit trading journey with eFruitMandi.Live — the future of digital fruit trading.\n\nThank you for your patience and for choosing eFruitMandi.Live.\n\nFor any updates, queries, or assistance, please contact our Support Team:\n📱 WhatsApp: 7018108900\n📧 Email: support@efruitmandi.live",
    },
  },
  buyer: {
    kyc: {
      title: "KYC Verified",
      message: "Welcome to eFruitMandi.Live! 🍎\n\nWe are pleased to inform you that your KYC has been successfully verified. You can now Offer Your Buying Price from your Business site for live Fruit Lots and Consignments and begin your fruit trading journey with eFruitMandi.Live — the future of digital fruit trading.\n\nThank you for your patience and for choosing eFruitMandi.Live.\n\nFor any updates, queries, or assistance, please contact our Support Team:\n📱 WhatsApp: 7018108900\n📧 Email: support@efruitmandi.live",
    },
    og_verified: {
      title: "OG Verification Completed",
      message: "Welcome to eFruitMandi.Live! 🍎\n\nWe are pleased to inform you that your OG Verification has been successfully completed. You can now Offer Your Buying Price with 2% less comission from your Business site for live Fruit Lots and Consignments and begin your fruit trading journey with eFruitMandi.Live — the future of digital fruit trading.\n\nThank you for your patience and for choosing eFruitMandi.Live.\n\nFor any updates, queries, or assistance, please contact our Support Team:\n📱 WhatsApp: 7018108900\n📧 Email: support@efruitmandi.live",
    },
  },
});

export const getVerificationCompletionNotification = ({ roleType = "", verificationType = "" }) => {
  const role = String(roleType).trim().toLowerCase();
  const verification = String(verificationType).trim().toLowerCase();
  const content = VERIFICATION_COMPLETION_MESSAGES[role]?.[verification];
  return content ? { ...content, type: "VERIFICATION_SUCCESS" } : null;
};

const completionEmailHtml = (message = "") => String(message)
  .split(/\n{2,}/)
  .map((paragraph) => `<p>${paragraph.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br />")}</p>`)
  .join("");

const getPersonalizedGreeting = (recipientName = "") => {
  const name = String(recipientName || "").trim().replace(/\s+/g, " ");
  return name && name.toLowerCase() !== "orchardgrowers" ? `${name} Ji Namaste,` : "Namaste,";
};

export const sendVerificationCompletionEmail = async ({
  to,
  recipientName = "",
  roleType = "",
  verificationType = "",
}) => {
  const recipient = String(to || "").trim();
  const notification = getVerificationCompletionNotification({ roleType, verificationType });
  if (!recipient || !notification) return false;
  const emailText = `${getPersonalizedGreeting(recipientName)}\n\n${notification.message}`;

  await sendEmail({
    platform: "efruitmandi",
    to: recipient,
    subject: notification.title,
    text: emailText,
    html: completionEmailHtml(emailText),
  });
  return true;
};

export const normalizeVerificationSection = (section = "") => {
  const normalized = String(section || "").trim().toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(VERIFICATION_SECTION_CONFIG, normalized)) {
    throw Object.assign(new Error("Invalid verification section"), { statusCode: 400 });
  }
  return normalized;
};

export const normalizeVerificationFeedbackStatus = (status = "") => {
  const normalized = STATUS_ALIASES[String(status || "").trim().toUpperCase()];
  if (!normalized) {
    throw Object.assign(new Error("Invalid verification status"), { statusCode: 400 });
  }
  return normalized;
};

const normalizeRoleType = (roleType = "") => {
  const normalized = String(roleType || "").trim().toLowerCase();
  if (!VALID_ROLE_TYPES.has(normalized)) {
    throw Object.assign(new Error("Invalid verification role"), { statusCode: 400 });
  }
  return normalized;
};

const getStatusCopy = (status) => ({
  PENDING: "is pending review",
  UNDER_REVIEW: "is under review",
  CHANGES_REQUIRED: "requires changes",
  VERIFIED: "has been verified",
  REJECTED: "was not approved",
}[status]);

const serializeRemark = (entry) => ({
  _id: entry._id,
  section: entry.section,
  roleType: entry.roleType || "",
  status: entry.status,
  remark: entry.remark || "",
  actionUrl: entry.actionUrl,
  source: entry.source,
  entityId: entry.entityId,
  createdAt: entry.createdAt,
  updatedAt: entry.updatedAt,
  resolvedAt: entry.resolvedAt,
});

export const recordAdminVerificationRemark = async ({
  userId,
  section,
  status,
  remark = "",
  createdBy,
  roleType = "",
  entityId = null,
  notificationOverride = null,
}) => {
  const normalizedSection = normalizeVerificationSection(section);
  const normalizedStatus = normalizeVerificationFeedbackStatus(status);
  const normalizedRoleType = normalizeRoleType(roleType);
  const sectionConfig = VERIFICATION_SECTION_CONFIG[normalizedSection];
  const now = new Date();

  await VerificationRemark.updateMany(
    {
      user: userId,
      section: normalizedSection,
      roleType: normalizedRoleType,
      resolvedAt: null,
    },
    { $set: { resolvedAt: now } }
  );
  await UserNotification.updateMany(
    {
      user: userId,
      section: normalizedSection,
      "metadata.roleType": normalizedRoleType,
      resolvedAt: null,
    },
    { $set: { resolvedAt: now } }
  );

  const verificationRemark = await VerificationRemark.create({
    user: userId,
    section: normalizedSection,
    roleType: normalizedRoleType,
    status: normalizedStatus,
    remark: String(remark || "").trim(),
    createdBy,
    source: "ADMIN",
    entityId,
    actionUrl: sectionConfig.actionUrl,
    resolvedAt: normalizedStatus === "VERIFIED" ? now : null,
  });

  const messageParts = [`Your ${sectionConfig.label} ${getStatusCopy(normalizedStatus)}.`];
  if (verificationRemark.remark) messageParts.push(`Admin remark: ${verificationRemark.remark}`);
  if (["CHANGES_REQUIRED", "REJECTED"].includes(normalizedStatus)) {
    messageParts.push("Please review and resubmit the required information.");
  }

  const notification = await UserNotification.create({
    user: userId,
    type: notificationOverride?.type || "VERIFICATION_REMARK",
    title: notificationOverride?.title || `${sectionConfig.label} Update`,
    message: notificationOverride?.message || messageParts.join(" "),
    section: normalizedSection,
    status: normalizedStatus,
    entityId,
    remark: verificationRemark._id,
    actionUrl: sectionConfig.actionUrl,
    metadata: { roleType: normalizedRoleType },
  });

  return { verificationRemark, notification };
};

export const markVerificationResubmitted = async ({
  userId,
  section,
  roleType = "",
  entityId = null,
}) => {
  const normalizedSection = normalizeVerificationSection(section);
  const normalizedRoleType = normalizeRoleType(roleType);
  const actionUrl = VERIFICATION_SECTION_CONFIG[normalizedSection].actionUrl;
  const now = new Date();

  await VerificationRemark.updateMany(
    {
      user: userId,
      section: normalizedSection,
      roleType: normalizedRoleType,
      resolvedAt: null,
    },
    { $set: { resolvedAt: now } }
  );
  await UserNotification.updateMany(
    {
      user: userId,
      section: normalizedSection,
      "metadata.roleType": normalizedRoleType,
      resolvedAt: null,
    },
    { $set: { resolvedAt: now } }
  );

  return VerificationRemark.create({
    user: userId,
    section: normalizedSection,
    roleType: normalizedRoleType,
    status: "PENDING",
    remark: "Updated verification information submitted.",
    createdByUser: userId,
    source: "USER",
    entityId,
    actionUrl,
    resolvedAt: now,
  });
};

export const getVerificationFeedback = async ({
  userId,
  section,
  sections = [],
  roleType = "",
  includeHistory = true,
}) => {
  const query = { user: userId };
  if (section) {
    query.section = normalizeVerificationSection(section);
  } else if (sections.length) {
    query.section = { $in: sections.map(normalizeVerificationSection) };
  }
  if (roleType) query.roleType = normalizeRoleType(roleType);

  const entries = await VerificationRemark.find(query).sort({ createdAt: -1 }).lean();
  const latestAdminFeedback = entries.find((entry) => entry.source === "ADMIN") || null;
  const activeFeedback = entries.find(
    (entry) => entry.source === "ADMIN" && !entry.resolvedAt && ACTIVE_WARNING_STATUSES.has(entry.status)
  ) || null;

  return {
    latest: latestAdminFeedback ? serializeRemark(latestAdminFeedback) : null,
    active: activeFeedback ? serializeRemark(activeFeedback) : null,
    history: includeHistory ? entries.map(serializeRemark) : undefined,
  };
};
