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
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/send-otp", sendOtp);
router.post("/resend-otp", resendOtp);
router.post("/verify-otp", verifyOtp);
router.post("/verify-mobile-widget-otp", verifyMobileWidgetOtp);
router.post("/forgot-password", forgotPasswordOtp);
router.post("/reset-password", resetPasswordWithOtp);
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
