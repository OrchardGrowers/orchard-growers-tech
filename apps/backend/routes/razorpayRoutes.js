import express from "express";
import protect, { authorize } from "../middleware/authMiddleware.js";
import { requirePaymentPartnerEnabled } from "../utils/paymentFeatureFlag.js";
import {
  createRazorpayOrder,
  verifyRazorpayPayment,
  razorpayWebhook,
} from "../controllers/razorpayController.js";

const router = express.Router();

router.post("/webhook", razorpayWebhook);

router.use(requirePaymentPartnerEnabled);

router.post("/create-order", protect, authorize("buyer"), createRazorpayOrder);
router.post("/verify-payment", protect, authorize("buyer"), verifyRazorpayPayment);

export default router;
