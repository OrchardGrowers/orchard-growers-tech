import express from "express";
import { getMailTransport } from "../services/mailService.js";
import { checkMsg91DeliveryStatus, getMsg91OtpAttempt } from "../services/mobileOtpService.js";
import protect, { authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

const ADMIN_DEBUG_ROLES = ["SUPER_ADMIN", "ADMIN"];
const truthyEnv = (value = "") => ["1", "true", "yes"].includes(String(value).trim().toLowerCase());
const isProductionLike = () => {
  const runtime = String(process.env.APP_ENV || process.env.NODE_ENV || "").trim().toLowerCase();
  return runtime === "production" || runtime === "staging";
};

const requireDebugAccess = (req, res, next) => {
  if (!isProductionLike() || truthyEnv(process.env.SMTP_DEBUG) || truthyEnv(process.env.MSG91_DEBUG)) return next();
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
    const mailConfig = getMailTransport({
      platform: req.query.platform || "orchardgrowers",
      purpose: req.query.purpose === "reset" ? "reset" : "otp",
    });

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

router.get(
  "/msg91/:requestId",
  protect,
  authorize(...ADMIN_DEBUG_ROLES),
  requireDebugAccess,
  async (req, res) => {
    const requestId = String(req.params.requestId || "").trim();
    const platform = String(req.query.platform || "orchardgrowers").trim();

    if (!requestId) {
      return res.status(400).json({
        ok: false,
        message: "MSG91 request_id is required",
      });
    }

    const localAttempt = getMsg91OtpAttempt(requestId);

    try {
      const providerStatus = await checkMsg91DeliveryStatus({ requestId, platform });
      return res.json({
        ok: providerStatus.ok,
        requestId,
        localAttempt,
        providerStatus,
      });
    } catch (err) {
      return res.status(err?.code === "MOBILE_OTP_NOT_CONFIGURED" ? 503 : 502).json({
        ok: false,
        requestId,
        localAttempt,
        code: err?.code,
        message: err?.message || "MSG91 delivery status check failed",
      });
    }
  }
);

export default router;
