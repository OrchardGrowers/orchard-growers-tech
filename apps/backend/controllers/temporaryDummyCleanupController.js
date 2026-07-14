import crypto from "crypto";
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
  if (!["prepare", "execute"].includes(mode)) {
    return res.status(400).json({ success: false, msg: "mode must be prepare or execute" });
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
