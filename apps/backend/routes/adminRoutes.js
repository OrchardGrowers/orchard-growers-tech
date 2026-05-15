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
  reviewKycRequest,
  reviewVerificationRequest,
  setUserStatusByAdmin,
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
const adminOnly = [
  protect,
  authorize("EMPLOYEE", "ADMIN", "SUPER_ADMIN"),
  wrapAsync(ensureActiveAdmin),
];

router.post("/login", wrapAsync(loginAdmin));

router.get("/analytics", ...adminOnly, wrapAsync(getAdminAnalytics));

router.get("/admins", ...adminOnly, wrapAsync(listAdmins));
router.post("/admins", ...adminOnly, wrapAsync(createAdmin));
router.patch("/admins/:id", ...adminOnly, wrapAsync(updateAdmin));
router.patch("/admins/:id/status", ...adminOnly, wrapAsync(terminateAdmin));
router.delete("/admins/:id", ...adminOnly, wrapAsync(deleteAdmin));

router.get("/users", ...adminOnly, wrapAsync(listUsers));
router.patch("/users/:id", ...adminOnly, wrapAsync(updateUserByAdmin));
router.patch("/users/:id/status", ...adminOnly, wrapAsync(setUserStatusByAdmin));
router.delete("/users/:id", ...adminOnly, wrapAsync(deleteUserByAdmin));

router.get("/products", ...adminOnly, wrapAsync(listProductsByAdmin));
router.post("/products", ...adminOnly, wrapAsync(createProductByAdmin));
router.patch("/products/:id", ...adminOnly, wrapAsync(updateProductByAdmin));

router.get("/verification-requests", ...adminOnly, wrapAsync(listVerificationRequests));
router.patch("/verification-requests/:id", ...adminOnly, wrapAsync(updateVerificationRequestByAdmin));
router.post("/verification-requests/:id/review", ...adminOnly, wrapAsync(reviewVerificationRequest));
router.get("/kyc-requests", ...adminOnly, wrapAsync(listKycRequests));
router.post("/kyc-requests/:userId/review", ...adminOnly, wrapAsync(reviewKycRequest));
router.get("/orders", ...adminOnly, wrapAsync(listOrders));

export default router;
