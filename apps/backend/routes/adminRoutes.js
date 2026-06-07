import express from "express";
import multer from "multer";
import Admin from "../models/Admin.js";
import DealSettings from "../models/DealSettings.js";
import Quotation from "../models/Quotation.js";
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
  getKycRequestByAdmin,
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
  updateKycStatusByAdmin,
  updateProductByAdmin,
  updateUserByAdmin,
  updateVerificationRequestByAdmin,
  uploadProductImagesByAdmin,
  verifyAdminOtp,
} from "../controllers/adminController.js";
import protect, { authorize } from "../middleware/authMiddleware.js";
import { createRateLimiter } from "../middleware/rateLimit.js";
import {
  createShipmentFromEfruitMandiOrder,
  getEfruitMandiOrderForAdmin,
  listEfruitMandiOrdersForAdmin,
} from "../controllers/logisticsController.js";
import {
  DEFAULT_DRIVER_CHARGE_SLABS,
  mergeDealSettings,
} from "../services/dealCalculationService.js";

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
const SETTINGS_WRITE_ROLES = ["SUPER_ADMIN", "ADMIN", "FINANCE_MANAGER"];
const VERIFICATION_READ_ROLES = ADMIN_ACCESS_ROLES;
const VERIFICATION_WRITE_ROLES = ["SUPER_ADMIN", "ADMIN", "VERIFICATION_OFFICER", "EMPLOYEE"];
const requireRoles = (...roles) => authorize(...roles);
const ADMIN_PRODUCT_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const adminOnly = [
  protect,
  authorize(...ADMIN_ACCESS_ROLES),
  wrapAsync(ensureActiveAdmin),
];
const adminProductImageUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (ADMIN_PRODUCT_IMAGE_MIME_TYPES.has(file.mimetype)) return cb(null, true);
    const error = new Error("Only JPG, PNG, or WebP product image uploads are allowed");
    error.statusCode = 400;
    return cb(error);
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
router.get("/kyc", ...adminOnly, requireRoles(...VERIFICATION_READ_ROLES), wrapAsync(listKycRequests));
router.get("/kyc/:id", ...adminOnly, requireRoles(...VERIFICATION_READ_ROLES), wrapAsync(getKycRequestByAdmin));
router.patch("/kyc/:id/status", ...adminOnly, requireRoles(...VERIFICATION_WRITE_ROLES), wrapAsync(updateKycStatusByAdmin));
router.get("/orders", ...adminOnly, requireRoles(...ORDER_READ_ROLES), wrapAsync(listOrders));
router.patch("/orders/:id/logistics", ...adminOnly, requireRoles(...ORDER_READ_ROLES), wrapAsync(updateOrderLogistics));
router.get("/quotes", ...adminOnly, requireRoles(...ORDER_READ_ROLES), wrapAsync(async (req, res) => {
  const quotes = await Quotation.find()
    .populate("lot", "title fruitName quantity status acceptedQuoteId acceptedBuyerId finalPrice finalDealValue")
    .populate("buyer", "name businessName buyerContactPerson phone")
    .populate("grower", "name orchardName businessName phone")
    .sort({ createdAt: -1 })
    .limit(500)
    .lean();

  res.json({
    success: true,
    quotes: quotes.map((quote) => ({
      _id: quote._id,
      lotId: quote.lot?._id || quote.lot,
      buyerId: quote.buyer?._id || quote.buyer,
      growerId: quote.grower?._id || quote.grower,
      lotTitle: quote.lotTitle || quote.lot?.title || quote.lot?.fruitName || "Fruit Lot",
      fruitType: quote.fruitType || quote.lot?.fruitName || "",
      lotQuantity: quote.lotQuantity || quote.lot?.quantity || 0,
      buyerName: quote.buyerName || quote.buyer?.businessName || quote.buyer?.buyerContactPerson || quote.buyer?.name || "Buyer",
      buyerPhone: quote.buyerPhone || quote.buyer?.phone || "",
      growerName: quote.growerName || quote.grower?.orchardName || quote.grower?.businessName || quote.grower?.name || "Grower",
      quotedPrice: quote.quotedPrice || quote.grades?.[0]?.price || 0,
      quotedTotalValue: quote.quotedTotalValue || quote.dealAmount || 0,
      baseDealAmount: quote.baseDealAmount || quote.dealAmount || 0,
      buyerPayable: quote.buyerPayable || quote.dealAmount || 0,
      buyerPayableThroughPlatform: quote.buyerPayableThroughPlatform || quote.buyerPayable || quote.dealAmount || 0,
      sellerReceivable: quote.sellerReceivable || quote.growerReceivable || 0,
      growerReceivable: quote.growerReceivable || quote.sellerReceivable || 0,
      commissionAmount: quote.commissionAmount || 0,
      platformServiceFee: quote.platformServiceFee || quote.commissionAmount || 0,
      platformRevenue: quote.platformServiceFee || quote.commissionAmount || 0,
      commissionPercent: quote.commissionPercent || 0,
      labourAmount: quote.labourAmount || 0,
      labourChargePerUnit: quote.labourChargePerUnit || 0,
      logisticsAmount: quote.logisticsAmount || quote.driverCharge || 0,
      totalCharges: quote.totalCharges || 0,
      totalUnits: quote.totalUnits || 0,
      chargePerUnit: quote.chargePerUnit || 0,
      logisticsChargePerUnit: quote.logisticsChargePerUnit || 0,
      grades: quote.grades || [],
      status: String(quote.status || "pending").toLowerCase().replace("submitted", "pending").replace("expired", "closed"),
      settlementStatus: String(quote.status || "pending").toLowerCase().replace("submitted", "pending").replace("expired", "closed"),
      acceptedAt: quote.acceptedAt,
      rejectedAt: quote.rejectedAt,
      createdAt: quote.createdAt,
      updatedAt: quote.updatedAt,
      lotStatus: quote.lot?.status,
    })),
  });
}));

router.get("/deal-settings", ...adminOnly, requireRoles(...ORDER_READ_ROLES), wrapAsync(async (req, res) => {
  const settings = await DealSettings.findOne({ key: "default" }).lean();
  res.json({
    key: "default",
    ...mergeDealSettings(settings || {}),
    updatedAt: settings?.updatedAt,
  });
}));

router.patch("/deal-settings", ...adminOnly, requireRoles(...SETTINGS_WRITE_ROLES), wrapAsync(async (req, res) => {
  const currentSettings = mergeDealSettings((await DealSettings.findOne({ key: "default" }).lean()) || {});
  const commissionPercent =
    req.body.commissionPercent === undefined
      ? currentSettings.commissionPercent
      : Number(req.body.commissionPercent);
  const driverChargeSlabs = Array.isArray(req.body.driverChargeSlabs)
    ? req.body.driverChargeSlabs
    : currentSettings.driverChargeSlabs || DEFAULT_DRIVER_CHARGE_SLABS;
  const labourAmount =
    req.body.labourAmount === undefined
      ? currentSettings.labourAmount
      : Number(req.body.labourAmount);
  if (!Number.isFinite(commissionPercent) || commissionPercent < 0) {
    return res.status(400).json({ msg: "Commission percent must be greater than or equal to 0" });
  }
  if (!Number.isFinite(labourAmount) || labourAmount < 0) {
    return res.status(400).json({ msg: "Labour amount must be greater than or equal to 0" });
  }

  const settings = await DealSettings.findOneAndUpdate(
    { key: "default" },
    {
      commissionPercent,
      labourAmount,
      driverChargeSlabs,
      updatedBy: req.user.id,
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();

  res.json({
    success: true,
    key: "default",
    ...mergeDealSettings(settings),
    updatedAt: settings?.updatedAt,
  });
}));

router.get("/efruitmandi/orders", ...adminOnly, requireRoles(...ORDER_READ_ROLES), wrapAsync(listEfruitMandiOrdersForAdmin));
router.get("/efruitmandi/orders/:orderId", ...adminOnly, requireRoles(...ORDER_READ_ROLES), wrapAsync(getEfruitMandiOrderForAdmin));
router.post("/efruitmandi/orders/:orderId/create-shipment", ...adminOnly, requireRoles(...ORDER_READ_ROLES), wrapAsync(createShipmentFromEfruitMandiOrder));

export default router;
