import express from "express";
import {
  registerUser,
  loginUser,
  refreshToken,
  sendOtp,
  resendOtp,
  verifyOtp,
  verifyMobileWidgetOtp,
  forgotPasswordOtp,
  resetPasswordWithOtp,
  startGoogleOAuth,
  handleGoogleOAuthCallback,
  startFacebookOAuth,
  handleFacebookOAuthCallback,
  getCurrentAuthUser,
  logoutUser,
} from "../controllers/authController.js";
import { createRateLimiter } from "../middleware/rateLimit.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

const otpLimiter = createRateLimiter({
  keyPrefix: "otp",
  windowMs: 10 * 60 * 1000,
  lockMs: 15 * 60 * 1000,
  max: 3,
  message: "Too many OTP requests. Please try again later.",
});

const otpVerifyLimiter = createRateLimiter({
  keyPrefix: "otp-verify",
  windowMs: 15 * 60 * 1000,
  lockMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many OTP requests. Please try again later.",
});

router.post("/send-otp", otpLimiter, sendOtp);
router.post("/resend-otp", otpLimiter, resendOtp);
router.post("/verify-otp", otpVerifyLimiter, verifyOtp);
router.post("/verify-mobile-widget-otp", otpVerifyLimiter, verifyMobileWidgetOtp);
router.post("/forgot-password", otpLimiter, forgotPasswordOtp);
router.post("/reset-password", otpVerifyLimiter, resetPasswordWithOtp);
router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/refresh", refreshToken);
router.get("/google", startGoogleOAuth);
router.get("/google/callback", handleGoogleOAuthCallback);
router.get("/facebook", startFacebookOAuth);
router.get("/facebook/callback", handleFacebookOAuthCallback);
router.get("/me", protect, getCurrentAuthUser);
router.post("/logout", logoutUser);

export default router;
