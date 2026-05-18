import express from "express";
import Admin from "../models/Admin.js";
import {
  createAdmin,
  createProductByAdmin,
  deleteAdmin,
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
  resetAdminPassword,
  reviewKycRequest,
  reviewVerificationRequest,
  setUserStatusByAdmin,
  signupAdmin,
  terminateAdmin,
  updateAdmin,
  updateProductByAdmin,
  updateUserByAdmin,
  updateVerificationRequestByAdmin,
} from "../controllers/adminController.js";
import protect, { authorize } from "../middleware/authMiddleware.js";

const router = express.Router();
const wrapAsync = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

const ensureActiveAdmin = async (req, res, next) => {
  const admin = await Admin.findById(req.user.id).select("_id status role");

  if (!admin || admin.status === "TERMINATED") {
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

router.post("/login", wrapAsync(loginAdmin));
router.post("/signup", wrapAsync(signupAdmin));
router.post("/forgot-password", wrapAsync(requestAdminPasswordReset));
router.post("/reset-password", wrapAsync(resetAdminPassword));

router.get("/analytics", ...adminOnly, requireRoles(...ANALYTICS_ROLES), wrapAsync(getAdminAnalytics));

router.get("/admins", ...adminOnly, requireRoles(...ADMIN_MANAGEMENT_ROLES), wrapAsync(listAdmins));
router.post("/admins", ...adminOnly, requireRoles(...ADMIN_MANAGEMENT_ROLES), wrapAsync(createAdmin));
router.patch("/admins/:id", ...adminOnly, requireRoles(...ADMIN_MANAGEMENT_ROLES), wrapAsync(updateAdmin));
router.patch("/admins/:id/status", ...adminOnly, requireRoles(...ADMIN_MANAGEMENT_ROLES), wrapAsync(terminateAdmin));
router.delete("/admins/:id", ...adminOnly, requireRoles(...ADMIN_MANAGEMENT_ROLES), wrapAsync(deleteAdmin));

router.get("/users", ...adminOnly, requireRoles(...USER_READ_ROLES), wrapAsync(listUsers));
router.patch("/users/:id", ...adminOnly, requireRoles(...USER_WRITE_ROLES), wrapAsync(updateUserByAdmin));
router.patch("/users/:id/status", ...adminOnly, requireRoles(...USER_WRITE_ROLES), wrapAsync(setUserStatusByAdmin));
router.delete("/users/:id", ...adminOnly, requireRoles("SUPER_ADMIN", "ADMIN"), wrapAsync(deleteUserByAdmin));

router.get("/products", ...adminOnly, requireRoles(...PRODUCT_READ_ROLES), wrapAsync(listProductsByAdmin));
router.post("/products", ...adminOnly, requireRoles(...PRODUCT_WRITE_ROLES), wrapAsync(createProductByAdmin));
router.patch("/products/:id", ...adminOnly, requireRoles(...PRODUCT_WRITE_ROLES), wrapAsync(updateProductByAdmin));

router.get("/verification-requests", ...adminOnly, requireRoles(...VERIFICATION_READ_ROLES), wrapAsync(listVerificationRequests));
router.patch("/verification-requests/:id", ...adminOnly, requireRoles(...VERIFICATION_WRITE_ROLES), wrapAsync(updateVerificationRequestByAdmin));
router.post("/verification-requests/:id/review", ...adminOnly, requireRoles(...VERIFICATION_WRITE_ROLES), wrapAsync(reviewVerificationRequest));
router.get("/kyc-requests", ...adminOnly, requireRoles(...VERIFICATION_READ_ROLES), wrapAsync(listKycRequests));
router.post("/kyc-requests/:userId/review", ...adminOnly, requireRoles(...VERIFICATION_WRITE_ROLES), wrapAsync(reviewKycRequest));
router.get("/orders", ...adminOnly, requireRoles(...ORDER_READ_ROLES), wrapAsync(listOrders));

export default router;
