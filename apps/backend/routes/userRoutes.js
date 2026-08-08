import express from "express";
import {
  getPublicProfiles,
  getPublicProfileById,
  getPublicProfileBySlug,
  getPublicProfileLocations,
  getPublicFruitDiscovery,
  setUserRole,
  createRoleProfile,
  getMyRoles,
  getProfile,
  switchMyRole,
  updateProfile,
  updateProfileMedia,
  updateKyc,
  rateGrowerForLot,
} from "../controllers/userController.js";
import protect from "../middleware/authMiddleware.js";
import profileMediaUpload from "../middleware/profileMediaUpload.js";
import kycUpload from "../middleware/kycUpload.js";
import {
  getMyNotifications,
  getMyVerificationFeedback,
  markAllMyNotificationsRead,
  markMyNotificationRead,
} from "../controllers/notificationController.js";

const router = express.Router();
const wrapAsync = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

router.get("/public-profiles", getPublicProfiles);
router.get("/public-profile-locations", getPublicProfileLocations);
router.get("/public-fruit-discovery", getPublicFruitDiscovery);
router.get("/public-profiles/by-slug/:businessType/:slug", getPublicProfileBySlug);
router.get("/public-profiles/:businessType/:userId", getPublicProfileById);

// ================= SET ROLE =================
// 🔐 Protected (requires login)
router.post("/set-role", protect, setUserRole);
router.get("/roles", protect, getMyRoles);
router.post("/switch-role", protect, switchMyRole);
router.post("/create-role-profile", protect, createRoleProfile);

// ================= GET PROFILE =================
// 🔐 Get logged-in user profile
router.get("/profile", protect, getProfile);
router.patch("/profile", protect, updateProfile);
router.get("/notifications", protect, wrapAsync(getMyNotifications));
router.patch("/notifications/read-all", protect, wrapAsync(markAllMyNotificationsRead));
router.patch("/notifications/:id/read", protect, wrapAsync(markMyNotificationRead));
router.get("/verification-feedback", protect, wrapAsync(getMyVerificationFeedback));
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
    { name: "idProofImage", maxCount: 1 },
    { name: "panImage", maxCount: 1 },
    { name: "gstCertificate", maxCount: 1 },
    { name: "drivingLicenseImage", maxCount: 1 },
  ]),
  updateKyc
);
router.post("/grower-rating/:lotId", protect, rateGrowerForLot);

export default router;
