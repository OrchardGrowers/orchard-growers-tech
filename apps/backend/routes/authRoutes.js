import express from "express";
import {
  registerUser,
  loginUser,
  refreshToken,
  sendOtp,
  resendOtp,
  verifyOtp,
  forgotPasswordOtp,
  resetPasswordWithOtp,
} from "../controllers/authController.js";
import { createRateLimiter } from "../middleware/rateLimit.js";

const router = express.Router();

const otpLimiter = createRateLimiter({
  keyPrefix: "otp",
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many OTP requests. Please try again later.",
});

const otpVerifyLimiter = createRateLimiter({
  keyPrefix: "otp-verify",
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many OTP attempts. Please try again later.",
});

router.post("/send-otp", otpLimiter, sendOtp);
router.post("/resend-otp", otpLimiter, resendOtp);
router.post("/verify-otp", otpVerifyLimiter, verifyOtp);
router.post("/forgot-password", otpLimiter, forgotPasswordOtp);
router.post("/reset-password", otpVerifyLimiter, resetPasswordWithOtp);
router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/refresh", refreshToken);

export default router;
