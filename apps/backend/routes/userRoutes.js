import express from "express";
import {
  setUserRole,
  getProfile,
  updateProfile,
  updateProfileMedia,
  updateKyc,
  rateGrowerForLot,
} from "../controllers/userController.js";
import protect from "../middleware/authMiddleware.js";
import profileMediaUpload from "../middleware/profileMediaUpload.js";
import kycUpload from "../middleware/kycUpload.js";

const router = express.Router();

// ================= SET ROLE =================
// 🔐 Protected (requires login)
router.post("/set-role", protect, setUserRole);

// ================= GET PROFILE =================
// 🔐 Get logged-in user profile
router.get("/profile", protect, getProfile);
router.patch("/profile", protect, updateProfile);
router.patch(
  "/profile/media",
  protect,
  profileMediaUpload.fields([
    { name: "avatar", maxCount: 1 },
    { name: "banner", maxCount: 1 },
    { name: "companyLogo", maxCount: 1 },
    { name: "avatarUrl", maxCount: 1 },
    { name: "bannerUrl", maxCount: 1 },
    { name: "companyLogoUrl", maxCount: 1 },
  ]),
  updateProfileMedia
);
router.patch(
  "/kyc",
  protect,
  kycUpload.fields([
    { name: "udyanCardFile", maxCount: 1 },
    { name: "passbookFile", maxCount: 1 },
    { name: "aadhaarCardFile", maxCount: 1 },
  ]),
  updateKyc
);
router.post("/grower-rating/:lotId", protect, rateGrowerForLot);

export default router;
