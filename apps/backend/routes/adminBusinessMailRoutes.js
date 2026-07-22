import express from "express";
import {
  getBusinessMailLogById,
  getBusinessMailSenderProfiles,
  getBusinessMailStatus,
  listBusinessMailLogs,
  sendBusinessMailMessage,
} from "../controllers/adminBusinessMailController.js";
import { authorize } from "../middleware/authMiddleware.js";
import { businessMailSendRateLimit } from "../middleware/businessMailRateLimit.js";

const router = express.Router();
const wrapAsync = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

export const BUSINESS_MAIL_ACCESS_ROLES = ["SUPER_ADMIN", "ADMIN", "SUPPORT_EXECUTIVE", "SALES_EXECUTIVE"];

router.get("/status", authorize(...BUSINESS_MAIL_ACCESS_ROLES), wrapAsync(getBusinessMailStatus));
router.get("/sender-profiles", authorize(...BUSINESS_MAIL_ACCESS_ROLES), wrapAsync(getBusinessMailSenderProfiles));
router.post(
  "/send",
  authorize(...BUSINESS_MAIL_ACCESS_ROLES),
  businessMailSendRateLimit,
  wrapAsync(sendBusinessMailMessage)
);
router.get("/logs", authorize(...BUSINESS_MAIL_ACCESS_ROLES), wrapAsync(listBusinessMailLogs));
router.get("/logs/:id", authorize(...BUSINESS_MAIL_ACCESS_ROLES), wrapAsync(getBusinessMailLogById));

export default router;

