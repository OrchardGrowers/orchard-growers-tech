import express from "express";
import {
  getBusinessMailLogById,
  getBusinessMailSenderAccessManagement,
  getBusinessMailSenderProfiles,
  getBusinessMailStatus,
  listBusinessMailLogs,
  previewBusinessMailMessage,
  sendBusinessMailMessage,
  updateBusinessMailSenderAccess,
} from "../controllers/adminBusinessMailController.js";
import { authorize } from "../middleware/authMiddleware.js";
import { businessMailSendRateLimit } from "../middleware/businessMailRateLimit.js";
import {
  BUSINESS_MAIL_ACCESS_ROLES,
  requireBusinessMailMasterAdmin,
} from "../services/businessMail/businessMailSenderAccess.js";

const router = express.Router();
const wrapAsync = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

export { BUSINESS_MAIL_ACCESS_ROLES };
export const BUSINESS_MAIL_MANAGEMENT_ROLES = ["SUPER_ADMIN", "ADMIN"];

router.get("/status", authorize(...BUSINESS_MAIL_ACCESS_ROLES), wrapAsync(getBusinessMailStatus));
router.get("/sender-profiles", authorize(...BUSINESS_MAIL_ACCESS_ROLES), wrapAsync(getBusinessMailSenderProfiles));
router.get(
  "/sender-access",
  authorize(...BUSINESS_MAIL_MANAGEMENT_ROLES),
  requireBusinessMailMasterAdmin,
  wrapAsync(getBusinessMailSenderAccessManagement)
);
router.patch(
  "/sender-access/:adminId",
  authorize(...BUSINESS_MAIL_MANAGEMENT_ROLES),
  requireBusinessMailMasterAdmin,
  wrapAsync(updateBusinessMailSenderAccess)
);
router.post(
  "/preview",
  authorize(...BUSINESS_MAIL_ACCESS_ROLES),
  wrapAsync(previewBusinessMailMessage)
);
router.post(
  "/send",
  authorize(...BUSINESS_MAIL_ACCESS_ROLES),
  businessMailSendRateLimit,
  wrapAsync(sendBusinessMailMessage)
);
router.get("/logs", authorize(...BUSINESS_MAIL_ACCESS_ROLES), wrapAsync(listBusinessMailLogs));
router.get("/logs/:id", authorize(...BUSINESS_MAIL_ACCESS_ROLES), wrapAsync(getBusinessMailLogById));

export default router;
