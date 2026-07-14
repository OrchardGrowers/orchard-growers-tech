import crypto from "crypto";
import User from "../models/User.js";
import { runSpecifiedDummyAccountCleanup } from "../scripts/permanentlyDeleteSpecifiedDummyAccounts.js";

const AUTHORIZED_EMAIL = "adminho@orchardgrowers.in";
const CONFIRMATION = "DELETE SIX DUMMY ACCOUNTS PERMANENTLY";
let cleanupInProgress = false;

const normalizeEmail = (value = "") => String(value || "").trim().toLowerCase();
const hasValidCleanupKey = (providedKey, configuredKey) => {
  const provided = Buffer.from(String(providedKey || ""), "utf8");
  const configured = Buffer.from(String(configuredKey || ""), "utf8");
  return provided.length === configured.length
    && provided.length > 0
    && crypto.timingSafeEqual(provided, configured);
};
const maskEmail = (value = "") => {
  const [local, domain] = String(value || "").split("@");
  return local && domain ? `${local.slice(0, 1)}***@${domain}` : "";
};
const maskPhone = (value = "") => {
  const digits = String(value || "").replace(/\D/g, "");
  return digits ? `${"*".repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}` : "";
};
const normalizeIdentity = (value = "") => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
const normalizePhone = (value = "") => String(value || "").replace(/\D/g, "");
const greenValleyNameMatch = (value) => /greenvalley|greenalley/.test(normalizeIdentity(value));
const greenValleyPhoneMatch = (value) => {
  const phone = normalizePhone(value);
  return phone === "918580660462" || phone === "8580660462" || phone.endsWith("8580660462");
};

const inspectGreenValleyCandidates = async () => {
  const namePattern = /green\s*valley(?:\s*orchard)?|green\s*alley/i;
  const phonePattern = /8\D*5\D*8\D*0\D*6\D*6\D*0\D*4\D*6\D*2\s*$/;
  const users = await User.find({
    $or: [
      { phone: phonePattern },
      { contact: phonePattern },
      { "kyc.phone": phonePattern },
      { "kycByRole.grower.phone": phonePattern },
      { "kycByRole.buyer.phone": phonePattern },
      { "kycByRole.driver.phone": phonePattern },
      { name: namePattern },
      { orchardName: namePattern },
      { businessName: namePattern },
      { buyerContactPerson: namePattern },
      { "kyc.fullName": namePattern },
      { "kyc.orchardName": namePattern },
      { "kycByRole.grower.fullName": namePattern },
      { "kycByRole.grower.orchardName": namePattern },
      { "kycByRole.buyer.fullName": namePattern },
    ],
  })
    .select([
      "_id", "name", "email", "phone", "contact", "role", "activeRole",
      "orchardName", "businessName", "buyerContactPerson", "createdAt",
      "kyc.fullName", "kyc.orchardName", "kyc.phone",
      "kycByRole.grower.fullName", "kycByRole.grower.orchardName", "kycByRole.grower.phone",
      "kycByRole.buyer.fullName", "kycByRole.buyer.phone",
      "kycByRole.driver.phone",
    ].join(" "))
    .lean();

  const nameFields = [
    ["name", (user) => user.name],
    ["orchardName", (user) => user.orchardName],
    ["businessName", (user) => user.businessName],
    ["buyerContactPerson", (user) => user.buyerContactPerson],
    ["kyc.fullName", (user) => user.kyc?.fullName],
    ["kyc.orchardName", (user) => user.kyc?.orchardName],
    ["kycByRole.grower.fullName", (user) => user.kycByRole?.grower?.fullName],
    ["kycByRole.grower.orchardName", (user) => user.kycByRole?.grower?.orchardName],
    ["kycByRole.buyer.fullName", (user) => user.kycByRole?.buyer?.fullName],
  ];
  const phoneFields = [
    ["phone", (user) => user.phone],
    ["contact", (user) => user.contact],
    ["kyc.phone", (user) => user.kyc?.phone],
    ["kycByRole.grower.phone", (user) => user.kycByRole?.grower?.phone],
    ["kycByRole.buyer.phone", (user) => user.kycByRole?.buyer?.phone],
    ["kycByRole.driver.phone", (user) => user.kycByRole?.driver?.phone],
  ];

  const evaluatedCandidates = users.map((user) => {
    const matchedNameFields = nameFields.filter(([, getValue]) => greenValleyNameMatch(getValue(user)));
    const matchedPhoneFields = phoneFields.filter(([, getValue]) => greenValleyPhoneMatch(getValue(user)));
    return {
      candidate: {
        _id: String(user._id),
        name: String(user.name || ""),
        email: maskEmail(user.email),
        phone: maskPhone(user.phone),
        contact: maskPhone(user.contact),
        role: String(user.role || ""),
        activeRole: String(user.activeRole || ""),
        orchardName: String(user.orchardName || ""),
        businessName: String(user.businessName || ""),
        buyerContactPerson: String(user.buyerContactPerson || ""),
        createdAt: user.createdAt,
        matchedFields: [
          ...matchedNameFields.map(([field]) => `${field}:name-variant`),
          ...matchedPhoneFields.map(([field]) => `${field}:target-phone`),
        ],
      },
      currentlyMatchesCleanup: matchedNameFields.length > 0 && matchedPhoneFields.length > 0,
    };
  });

  return {
    count: evaluatedCandidates.length,
    currentlyMatched: evaluatedCandidates.filter((item) => item.currentlyMatchesCleanup).map((item) => item.candidate),
    plausibleNotCurrentlyMatched: evaluatedCandidates.filter((item) => !item.currentlyMatchesCleanup).map((item) => item.candidate),
  };
};

const publicTarget = (target = {}) => ({
  _id: target._id,
  name: target.name,
  email: maskEmail(target.email),
  phone: maskPhone(target.phone),
  role: target.role,
  orchardName: target.orchardName,
  businessName: target.businessName,
  products: target.products,
  auctions: target.auctions,
  quotations: target.quotations,
  orders: target.orders,
  paymentAndErpRecords: target.paymentAndErpRecords,
});

export const runTemporaryDummyCleanup = async (req, res) => {
  const configuredCleanupKey = process.env.INTERNAL_DUMMY_CLEANUP_KEY;
  if (!configuredCleanupKey) {
    return res.status(503).json({ success: false, msg: "Internal cleanup endpoint is not configured" });
  }
  if (!hasValidCleanupKey(req.get("X-Internal-Cleanup-Key"), configuredCleanupKey)) {
    return res.status(403).json({ success: false, msg: "Valid internal cleanup key is required" });
  }
  if (normalizeEmail(req.admin?.email) !== AUTHORIZED_EMAIL) {
    return res.status(403).json({ success: false, msg: "This internal cleanup is restricted to the authorized head-office admin" });
  }
  if (cleanupInProgress) {
    return res.status(409).json({ success: false, msg: "Dummy-account cleanup is already in progress" });
  }

  const mode = String(req.body?.mode || "").trim().toLowerCase();
  if (!["prepare", "execute", "inspect-green-valley"].includes(mode)) {
    return res.status(400).json({ success: false, msg: "Unsupported cleanup endpoint mode" });
  }
  if (mode === "inspect-green-valley") {
    return res.json({
      success: true,
      mode,
      ...(await inspectGreenValleyCandidates()),
    });
  }
  if (mode === "execute" && req.body?.confirmation !== CONFIRMATION) {
    return res.status(400).json({ success: false, msg: "Exact cleanup confirmation phrase is required" });
  }

  cleanupInProgress = true;
  try {
    const result = await runSpecifiedDummyAccountCleanup({
      execute: mode === "execute",
      confirmation: req.body?.confirmation || "",
    });

    if (mode === "prepare") {
      return res.json({
        success: true,
        mode: result.mode,
        manifest: {
          path: result.manifestPath,
          createdAt: result.manifest.createdAt,
          expiresAt: result.manifest.expiresAt,
          executedAt: result.manifest.executedAt,
        },
        targets: result.results.map(publicTarget),
        missingUserIds: result.missing,
      });
    }

    return res.json({
      success: true,
      mode: result.mode,
      deletedUserIds: result.userIds,
      deleted: result.deleted,
      cloudinary: result.cloudinary,
      executedAt: result.executedAt,
      removalNote: "Remove this temporary route and controller after confirming cleanup.",
    });
  } finally {
    cleanupInProgress = false;
  }
};
