import express from "express";
import multer from "multer";
import Admin from "../models/Admin.js";
import {
  createAdmin,
  activateAdmin,
  approveAdmin,
  createProductByAdmin,
  deleteAdmin,
  deleteProductByAdmin,
  deleteUserByAdmin,
  getAdminAnalytics,
  listAdmins,
  listProductsByAdmin,
  listUsers,
  listVerificationRequests,
  listKycRequests,
  listOrders,
  loginAdmin,
  requestAdminPasswordReset,
  changeAdminClass,
  rejectAdmin,
  resetAdminPassword,
  resetManagedAdminPassword,
  reviewKycRequest,
  reviewVerificationRequest,
  sendAdminOtp,
  setUserStatusByAdmin,
  signupAdmin,
  suspendAdmin,
  terminateAdmin,
  updateAdmin,
  updateOrderLogistics,
  updateProductByAdmin,
  updateUserByAdmin,
  updateVerificationRequestByAdmin,
  uploadProductImagesByAdmin,
  verifyAdminOtp,
} from "../controllers/adminController.js";
import protect, { authorize } from "../middleware/authMiddleware.js";
import { createRateLimiter } from "../middleware/rateLimit.js";

const router = express.Router();
const wrapAsync = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);
const adminOtpLimiter = createRateLimiter({
  keyPrefix: "admin-otp",
  windowMs: 10 * 60 * 1000,
  lockMs: 15 * 60 * 1000,
  max: 3,
  message: "Too many OTP requests. Please try again later.",
});
const adminOtpVerifyLimiter = createRateLimiter({
  keyPrefix: "admin-otp-verify",
  windowMs: 15 * 60 * 1000,
  lockMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many OTP requests. Please try again later.",
});

const ensureActiveAdmin = async (req, res, next) => {
  const admin = await Admin.findById(req.user.id).select("_id email status role adminClass canManageClassIII");

  const validClasses = new Set(["CLASS_I", "CLASS_II", "CLASS_III"]);
  const roleClass = {
    SUPER_ADMIN: "CLASS_I",
    ADMIN: "CLASS_I",
    UNIT_MANAGER: "CLASS_II",
    INVENTORY_MANAGER: "CLASS_II",
    SALES_EXECUTIVE: "CLASS_III",
    PURCHASE_MANAGER: "CLASS_II",
    FINANCE_MANAGER: "CLASS_II",
    VERIFICATION_OFFICER: "CLASS_II",
    SUPPORT_EXECUTIVE: "CLASS_III",
    VIEWER: "CLASS_III",
    EMPLOYEE: "CLASS_III",
  };
  const adminClass = admin?.adminClass || roleClass[admin?.role] || "";

  if (!admin || admin.status !== "ACTIVE" || !ADMIN_ACCESS_ROLES.includes(admin.role) || !validClasses.has(adminClass)) {
    return res.status(403).json({ msg: "Admin account is not active" });
  }

  req.admin = admin;
  next();
};
const ADMIN_ACCESS_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "UNIT_MANAGER",
  "INVENTORY_MANAGER",
  "SALES_EXECUTIVE",
  "PURCHASE_MANAGER",
  "FINANCE_MANAGER",
  "VERIFICATION_OFFICER",
  "SUPPORT_EXECUTIVE",
  "VIEWER",
  "EMPLOYEE",
];
const ADMIN_MANAGEMENT_ROLES = ["SUPER_ADMIN"];
const ANALYTICS_ROLES = ADMIN_ACCESS_ROLES;
const USER_READ_ROLES = ADMIN_ACCESS_ROLES;
const USER_WRITE_ROLES = ["SUPER_ADMIN", "ADMIN", "VERIFICATION_OFFICER", "SUPPORT_EXECUTIVE", "EMPLOYEE"];
const PRODUCT_READ_ROLES = ADMIN_ACCESS_ROLES;
const PRODUCT_WRITE_ROLES = ["SUPER_ADMIN", "ADMIN", "INVENTORY_MANAGER", "EMPLOYEE"];
const ORDER_READ_ROLES = ADMIN_ACCESS_ROLES;
const VERIFICATION_READ_ROLES = ADMIN_ACCESS_ROLES;
const VERIFICATION_WRITE_ROLES = ["SUPER_ADMIN", "ADMIN", "VERIFICATION_OFFICER", "EMPLOYEE"];
const requireRoles = (...roles) => authorize(...roles);
const adminOnly = [
  protect,
  authorize(...ADMIN_ACCESS_ROLES),
  wrapAsync(ensureActiveAdmin),
];
const adminProductImageUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype?.startsWith("image/")) return cb(null, true);
    return cb(new Error("Only product image uploads are allowed"));
  },
  limits: {
    files: 10,
    fileSize: 8 * 1024 * 1024,
  },
});

router.post("/login", wrapAsync(loginAdmin));
router.post("/signup", wrapAsync(signupAdmin));
router.post("/send-otp", adminOtpLimiter, wrapAsync(sendAdminOtp));
router.post("/verify-otp", adminOtpVerifyLimiter, wrapAsync(verifyAdminOtp));
router.post("/forgot-password", wrapAsync(requestAdminPasswordReset));
router.post("/reset-password", wrapAsync(resetAdminPassword));

router.get("/analytics", ...adminOnly, requireRoles(...ANALYTICS_ROLES), wrapAsync(getAdminAnalytics));

router.get("/admins", ...adminOnly, wrapAsync(listAdmins));
router.post("/admins", ...adminOnly, wrapAsync(createAdmin));
router.patch("/admins/:id", ...adminOnly, wrapAsync(updateAdmin));
router.patch("/admins/:id/status", ...adminOnly, wrapAsync(terminateAdmin));
router.patch("/admins/:id/approve", ...adminOnly, wrapAsync(approveAdmin));
router.patch("/admins/:id/reject", ...adminOnly, wrapAsync(rejectAdmin));
router.patch("/admins/:id/suspend", ...adminOnly, wrapAsync(suspendAdmin));
router.patch("/admins/:id/activate", ...adminOnly, wrapAsync(activateAdmin));
router.patch("/admins/:id/class", ...adminOnly, wrapAsync(changeAdminClass));
router.patch("/admins/:id/reset-password", ...adminOnly, wrapAsync(resetManagedAdminPassword));
router.delete("/admins/:id", ...adminOnly, requireRoles(...ADMIN_MANAGEMENT_ROLES), wrapAsync(deleteAdmin));

router.get("/users", ...adminOnly, requireRoles(...USER_READ_ROLES), wrapAsync(listUsers));
router.patch("/users/:id", ...adminOnly, requireRoles(...USER_WRITE_ROLES), wrapAsync(updateUserByAdmin));
router.patch("/users/:id/status", ...adminOnly, requireRoles(...USER_WRITE_ROLES), wrapAsync(setUserStatusByAdmin));
router.delete("/users/:id", ...adminOnly, requireRoles("SUPER_ADMIN", "ADMIN"), wrapAsync(deleteUserByAdmin));

router.get("/products", ...adminOnly, requireRoles(...PRODUCT_READ_ROLES), wrapAsync(listProductsByAdmin));
router.post("/product-images", ...adminOnly, requireRoles(...PRODUCT_WRITE_ROLES), adminProductImageUpload.array("images", 10), wrapAsync(uploadProductImagesByAdmin));
router.post("/products", ...adminOnly, requireRoles(...PRODUCT_WRITE_ROLES), adminProductImageUpload.array("images", 10), wrapAsync(createProductByAdmin));
router.patch("/products/:id", ...adminOnly, requireRoles(...PRODUCT_WRITE_ROLES), wrapAsync(updateProductByAdmin));
router.delete("/products/:id", ...adminOnly, requireRoles(...PRODUCT_WRITE_ROLES), wrapAsync(deleteProductByAdmin));

router.get("/verification-requests", ...adminOnly, requireRoles(...VERIFICATION_READ_ROLES), wrapAsync(listVerificationRequests));
router.patch("/verification-requests/:id", ...adminOnly, requireRoles(...VERIFICATION_WRITE_ROLES), wrapAsync(updateVerificationRequestByAdmin));
router.post("/verification-requests/:id/review", ...adminOnly, requireRoles(...VERIFICATION_WRITE_ROLES), wrapAsync(reviewVerificationRequest));
router.get("/kyc-requests", ...adminOnly, requireRoles(...VERIFICATION_READ_ROLES), wrapAsync(listKycRequests));
router.post("/kyc-requests/:userId/review", ...adminOnly, requireRoles(...VERIFICATION_WRITE_ROLES), wrapAsync(reviewKycRequest));
router.get("/orders", ...adminOnly, requireRoles(...ORDER_READ_ROLES), wrapAsync(listOrders));
router.patch("/orders/:id/logistics", ...adminOnly, requireRoles(...ORDER_READ_ROLES), wrapAsync(updateOrderLogistics));

export default router;
