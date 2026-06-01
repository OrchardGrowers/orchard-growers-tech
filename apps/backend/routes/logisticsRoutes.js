import express from "express";
import Admin from "../models/Admin.js";
import protect, { authorize } from "../middleware/authMiddleware.js";
import {
  bookShipment,
  cancelShipment,
  checkServiceability,
  estimateRates,
  getInvoice,
  getLabel,
  getLogisticsOrder,
  listLogisticsOrders,
  manualBookShipment,
  reassignShipment,
  trackShipment,
} from "../controllers/logisticsController.js";

const router = express.Router();
const wrapAsync = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
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

const ensureActiveAdmin = async (req, res, next) => {
  const admin = await Admin.findById(req.user.id).select("_id status role adminClass");
  if (!admin || admin.status !== "ACTIVE" || !ADMIN_ACCESS_ROLES.includes(admin.role)) {
    return res.status(403).json({ msg: "Admin account is not active" });
  }
  req.admin = admin;
  next();
};

router.use(protect, authorize(...ADMIN_ACCESS_ROLES), wrapAsync(ensureActiveAdmin));

router.get("/orders", wrapAsync(listLogisticsOrders));
router.get("/orders/:orderId", wrapAsync(getLogisticsOrder));
router.post("/serviceability", wrapAsync(checkServiceability));
router.post("/rates", wrapAsync(estimateRates));
router.post("/book", wrapAsync(bookShipment));
router.post("/manual-book", wrapAsync(manualBookShipment));
router.get("/track/:shipmentId", wrapAsync(trackShipment));
router.post("/cancel/:shipmentId", wrapAsync(cancelShipment));
router.post("/reassign/:shipmentId", wrapAsync(reassignShipment));
router.get("/label/:shipmentId", wrapAsync(getLabel));
router.get("/invoice/:shipmentId", wrapAsync(getInvoice));

export default router;
