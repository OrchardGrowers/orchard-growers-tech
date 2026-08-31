import express from "express";
import Admin from "../models/Admin.js";
import Order from "../models/Order.js";
import User from "../models/User.js";
import protect, { authorize } from "../middleware/authMiddleware.js";
import {
  getRoleKycStatus,
  refreshSettlementEligibility,
} from "../services/logisticsAssignmentService.js";
import {
  bookShipment,
  cancelShipment,
  checkServiceability,
  estimateRates,
  getInvoice,
  getLabel,
  getLogisticsOrder,
  indiaPostBook,
  indiaPostCancel,
  indiaPostEvents,
  indiaPostLabel,
  indiaPostPincodeCheck,
  indiaPostTariff,
  indiaPostTrack,
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

const hasDriverProfile = (user = {}) =>
  user.role === "driver" || (Array.isArray(user.profileTypes) && user.profileTypes.includes("driver"));

const populateAssignmentOrder = (query) =>
  query
    .populate("product", "-basePrice")
    .populate("buyer", "name businessName")
    .populate("grower", "name orchardName")
    .populate("driver", "name email phone contact logisticsName logisticsOwnerName driverName driverContact vehicleNumber vehicleType driverVerified kycByRole accountStatus")
    .populate("logisticsAssignment.assignedLogisticsAccount", "name email phone contact logisticsName logisticsOwnerName driverName driverContact vehicleNumber vehicleType driverVerified kycByRole accountStatus");

const ensureActiveAdmin = async (req, res, next) => {
  const admin = await Admin.findById(req.user.id).select("_id status role adminClass");
  if (!admin || admin.status !== "ACTIVE" || !ADMIN_ACCESS_ROLES.includes(admin.role)) {
    return res.status(403).json({ msg: "Admin account is not active" });
  }
  req.admin = admin;
  next();
};

router.post("/assignments/:orderId/accept", protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ msg: "Order not found" });

    const assignedId = order.logisticsAssignment?.assignedLogisticsAccount?.toString();
    if (!hasDriverProfile(req.user) || assignedId !== req.user.id?.toString()) {
      return res.status(403).json({ msg: "Only the assigned logistics account can accept this assignment" });
    }

    if (!["PENDING_LOGISTICS_ACCEPTANCE", "REGISTERED_LOGISTICS_FOUND", "LOGISTICS_REGISTERED", "LOGISTICS_REJECTED"].includes(order.logisticsAssignment?.status)) {
      return res.status(400).json({ msg: "This logistics assignment cannot be accepted now" });
    }

    const logistics = await User.findById(req.user.id).lean();
    order.driver = req.user.id;
    order.logisticsAssignment.status = "READY_FOR_DISPATCH";
    order.logisticsAssignment.acceptedAt = new Date();
    order.logisticsAssignment.rejectedAt = undefined;
    order.logisticsAssignment.kycStatus = getRoleKycStatus(logistics, "driver") || (logistics?.driverVerified ? "APPROVED" : "NOT_SUBMITTED");
    order.logisticsAssignment.registrationStatus = "REGISTERED";
    await refreshSettlementEligibility(order, { grower: await User.findById(order.grower).lean(), logistics });
    await order.save();

    res.json({ msg: "Logistics assignment accepted", order: await populateAssignmentOrder(Order.findById(order._id)) });
  } catch (err) {
    res.status(500).json({ msg: err.message || "Could not accept logistics assignment" });
  }
});

router.use(protect, authorize(...ADMIN_ACCESS_ROLES), wrapAsync(ensureActiveAdmin));

router.get("/orders", wrapAsync(listLogisticsOrders));
router.get("/orders/:orderId", wrapAsync(getLogisticsOrder));
router.post("/serviceability", wrapAsync(checkServiceability));
router.post("/rates", wrapAsync(estimateRates));
router.post("/book", wrapAsync(bookShipment));
router.post("/manual-book", wrapAsync(manualBookShipment));
router.post("/india-post/pincode-check", wrapAsync(indiaPostPincodeCheck));
router.post("/india-post/tariff", wrapAsync(indiaPostTariff));
router.post("/india-post/book", wrapAsync(indiaPostBook));
router.get("/india-post/track/:articleNumber", wrapAsync(indiaPostTrack));
router.post("/india-post/cancel/:shipmentId", wrapAsync(indiaPostCancel));
router.get("/india-post/label/:shipmentId", wrapAsync(indiaPostLabel));
router.get("/india-post/events/:articleNumber", wrapAsync(indiaPostEvents));
router.get("/track/:shipmentId", wrapAsync(trackShipment));
router.post("/cancel/:shipmentId", wrapAsync(cancelShipment));
router.post("/reassign/:shipmentId", wrapAsync(reassignShipment));
router.get("/label/:shipmentId", wrapAsync(getLabel));
router.get("/invoice/:shipmentId", wrapAsync(getInvoice));

export default router;
