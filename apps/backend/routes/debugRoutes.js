import express from "express";
import { getMailTransport } from "../services/mailService.js";
import protect, { authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

const ADMIN_DEBUG_ROLES = ["SUPER_ADMIN", "ADMIN"];
const truthyEnv = (value = "") => ["1", "true", "yes"].includes(String(value).trim().toLowerCase());
const isProductionLike = () => {
  const runtime = String(process.env.APP_ENV || process.env.NODE_ENV || "").trim().toLowerCase();
  return runtime === "production" || runtime === "staging";
};

const requireDebugAccess = (req, res, next) => {
  if (!isProductionLike() || truthyEnv(process.env.SMTP_DEBUG)) return next();
  return res.status(404).json({ msg: "Route Not Found" });
};

const safeSmtpError = (err = {}) => ({
  ok: false,
  code: err.code,
  command: err.command,
  responseCode: err.responseCode,
  message: err.message || "SMTP verification failed",
});

router.get(
  "/smtp",
  protect,
  authorize(...ADMIN_DEBUG_ROLES),
  requireDebugAccess,
  async (req, res) => {
    const mailConfig = getMailTransport({ platform: "orchardgrowers", purpose: "otp" });

    if (!mailConfig) {
      return res.status(503).json({
        ok: false,
        message: "SMTP is not configured",
      });
    }

    try {
      await mailConfig.transporter.verify();
      return res.json({ ok: true, message: "SMTP verified" });
    } catch (err) {
      return res.status(502).json(safeSmtpError(err));
    }
  }
);

export default router;
