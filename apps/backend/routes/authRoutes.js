import express from "express";
import {
  registerUser,
  loginUser,
  refreshToken,
  sendOtp,
  verifyOtp,
} from "../controllers/authController.js";

const router = express.Router();

router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);
router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/refresh", refreshToken); // 🔥 NEW

export default router;
