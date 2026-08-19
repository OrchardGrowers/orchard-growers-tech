import express from "express";
import Delivery from "../models/Delivery.js";
import Order from "../models/Order.js";
import User from "../models/User.js";
import protect, { authorize } from "../middleware/authMiddleware.js";
import { refreshSettlementEligibility } from "../services/logisticsAssignmentService.js";
import { requirePaymentPartnerEnabled } from "../utils/paymentFeatureFlag.js";
import {
  applyFinancialSnapshotToOrder,
  calculateDealSettlement,
} from "../services/dealSettlementService.js";
import { ensureFinalTransactionDocuments } from "../services/transactionDocumentService.js";

const router = express.Router();

const genOTP = () => Math.floor(1000 + Math.random() * 9000).toString();
router.get("/", (req, res) => {
  res.json({ message: "Delivery API working" });
});

router.post("/start", protect, authorize("driver"), async (req, res) => {
  try {
    const { orderId } = req.body;
    const order = await Order.findById(orderId);

    if (!order) return res.status(404).json({ msg: "Order not found" });

    if (order.paymentStatus !== "ESCROW") {
      return res.status(400).json({
        msg: "Payment not completed. Cannot start delivery.",
      });
    }

    if (!["LOGISTICS_ACCEPTED", "READY_FOR_DISPATCH"].includes(order.logisticsAssignment?.status) || order.driver?.toString() !== req.user.id?.toString()) {
      return res.status(403).json({
        msg: "Dispatch is blocked until the assigned logistics partner accepts this consignment.",
      });
    }

    const existing = await Delivery.findOne({ order: orderId });
    if (existing) {
      return res.json({
        msg: "Delivery already started",
        deliveryId: existing._id,
        deliveryOTP: existing.deliveryOTP,
      });
    }

    const otp = genOTP();
    const delivery = await Delivery.create({
      order: orderId,
      driver: req.user.id,
      deliveryOTP: otp,
      status: "IN_TRANSIT",
    });

    order.driver = req.user.id;
    order.deliveryStatus = "IN_TRANSIT";
    order.escrowStatus = "CONSIGNMENT_IN_TRANSIT";
    await refreshSettlementEligibility(order, {
      grower: await User.findById(order.grower).lean(),
      logistics: await User.findById(req.user.id).lean(),
    });
    await order.save();

    res.json({
      msg: "Delivery started",
      deliveryId: delivery._id,
      deliveryOTP: otp,
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.post("/confirm-delivery", protect, authorize("buyer"), async (req, res) => {
  try {
    const { orderId, otp } = req.body;
    const delivery = await Delivery.findOne({ order: orderId });

    if (!delivery) return res.status(404).json({ msg: "Delivery not found" });

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ msg: "Order not found" });

    if (order.buyer?.toString() !== req.user.id?.toString()) {
      return res.status(403).json({ msg: "You can confirm only your own delivery" });
    }

    if (delivery.deliveryOTP !== otp) {
      return res.status(400).json({ msg: "Invalid delivery OTP" });
    }

    delivery.status = "DELIVERED";
    await delivery.save();

    order.deliveryStatus = "DELIVERED";
    order.escrowStatus = "BUYER_CONFIRMED";
    await refreshSettlementEligibility(order, {
      grower: await User.findById(order.grower).lean(),
      logistics: order.driver ? await User.findById(order.driver).lean() : null,
    });
    await order.save();

    res.json({ msg: "Delivery confirmed. Negotiation unlocked." });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.post("/negotiate", protect, authorize("buyer"), async (req, res) => {
  try {
    const { orderId, amount, finalQuantity, finalWeightKg, finalRate } = req.body;
    const delivery = await Delivery.findOne({ order: orderId });

    if (!delivery) return res.status(404).json({ msg: "Delivery not found" });

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ msg: "Order not found" });

    if (order.buyer?.toString() !== req.user.id?.toString()) {
      return res.status(403).json({ msg: "You can negotiate only your own order" });
    }

    if (delivery.status !== "DELIVERED") {
      return res.status(400).json({ msg: "Delivery not completed yet" });
    }

    const negotiatedAmount = Number(amount || 0);
    if (!Number.isFinite(negotiatedAmount) || negotiatedAmount <= 0) {
      return res.status(400).json({ msg: "Final negotiated amount must be greater than zero" });
    }
    const optionalNumbers = { finalQuantity, finalWeightKg, finalRate };
    for (const [field, value] of Object.entries(optionalNumbers)) {
      if (value !== undefined && value !== "" && (!Number.isFinite(Number(value)) || Number(value) <= 0)) {
        return res.status(400).json({ msg: `${field} must be greater than zero when provided` });
      }
    }

    delivery.negotiatedAmount = negotiatedAmount;
    delivery.isNegotiated = true;
    if (finalQuantity !== undefined && finalQuantity !== "") delivery.finalQuantity = Number(finalQuantity);
    if (finalWeightKg !== undefined && finalWeightKg !== "") delivery.finalWeightKg = Number(finalWeightKg);
    if (finalRate !== undefined && finalRate !== "") delivery.finalRate = Number(finalRate);
    await delivery.save();

    res.json({
      msg: "Negotiation updated",
      finalAmount: delivery.negotiatedAmount,
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.post("/generate-settlement-otp", protect, authorize("buyer"), requirePaymentPartnerEnabled, async (req, res) => {
  try {
    const { orderId } = req.body;
    const delivery = await Delivery.findOne({ order: orderId });

    if (!delivery) return res.status(404).json({ msg: "Delivery not found" });

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ msg: "Order not found" });

    if (order.buyer?.toString() !== req.user.id?.toString()) {
      return res.status(403).json({ msg: "You can settle only your own order" });
    }

    const otp = genOTP();
    delivery.settlementOTP = otp;
    await delivery.save();

    res.json({
      msg: "Settlement OTP generated",
      settlementOTP: otp,
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.post("/confirm-settlement", protect, authorize("grower"), requirePaymentPartnerEnabled, async (req, res) => {
  try {
    const { orderId, otp } = req.body;
    const delivery = await Delivery.findOne({ order: orderId });

    if (!delivery) return res.status(404).json({ msg: "Delivery not found" });

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ msg: "Order not found" });

    if (order.grower?.toString() !== req.user.id?.toString()) {
      return res.status(403).json({ msg: "You can confirm settlement only for your own lot" });
    }

    if (delivery.settlementOTP !== otp) {
      return res.status(400).json({ msg: "Invalid settlement OTP" });
    }

    if (order.receivingStatus === "DISCREPANCY_RAISED") {
      return res.status(400).json({
        msg: "Settlement is blocked until the Buyer receiving discrepancy is resolved.",
      });
    }

    order.growerApproved = true;
    await refreshSettlementEligibility(order, {
      grower: await User.findById(order.grower).lean(),
      logistics: order.driver ? await User.findById(order.driver).lean() : null,
    });

    if (!order.settlementEligibility?.settlementReleaseAllowed) {
      await order.save();
      return res.status(400).json({
        msg: "Settlement release blocked until buyer payment, delivery, logistics acceptance, grower KYC, logistics KYC, and beneficiary validation are complete.",
        settlementEligibility: order.settlementEligibility,
      });
    }

    delivery.status = "COMPLETED";
    await delivery.save();

    const finalAmount = delivery.isNegotiated
      ? delivery.negotiatedAmount
      : order.auctionPrice;
    if (!Number.isFinite(Number(finalAmount)) || Number(finalAmount) <= 0) {
      return res.status(400).json({ msg: "A valid final fruit transaction amount is required" });
    }
    const financialSnapshot = calculateDealSettlement(order, {
      grossSaleAmount: finalAmount,
      finalQuantity: delivery.finalQuantity,
      finalWeightKg: delivery.finalWeightKg,
      finalRate: delivery.finalRate,
      lockedAt: new Date(),
    });

    order.paymentStatus = "RELEASED";
    applyFinancialSnapshotToOrder(order, financialSnapshot);
    order.finalQuantity = financialSnapshot.finalQuantity || undefined;
    order.finalWeightKg = financialSnapshot.finalWeightKg || undefined;
    order.finalRate = financialSnapshot.finalRate || undefined;
    order.commissionTaxableAmount = financialSnapshot.platformRevenue;
    order.commissionGstPercent = financialSnapshot.commissionTaxRate;
    order.commissionGstAmount = financialSnapshot.taxAmount;
    order.commissionTotalAmount =
      financialSnapshot.platformRevenue + financialSnapshot.taxAmount;
    order.escrowStatus = "DEAL_CLOSED";
    delivery.driverPayment = financialSnapshot.logisticsAmount;
    delivery.platformCommission = financialSnapshot.platformRevenue;
    delivery.growerPayout = financialSnapshot.growerNetSettlement;
    await delivery.save();
    await order.save();

    const documents = await ensureFinalTransactionDocuments(order);
    const salesInvoice = documents.find((document) => document.documentType === "SALES_INVOICE");
    const commissionInvoice = documents.find((document) =>
      ["GROWER_COMMISSION_INVOICE", "BUYER_COMMISSION_INVOICE"].includes(document.documentType)
    );
    if (salesInvoice && !order.invoiceNumber) {
      order.invoiceNumber = salesInvoice.documentNumber;
      order.invoiceDate = salesInvoice.finalizedAt || new Date();
    }
    if (commissionInvoice && !order.commissionInvoiceNumber) {
      order.commissionInvoiceNumber = commissionInvoice.documentNumber;
      order.commissionInvoiceDate = commissionInvoice.finalizedAt || new Date();
    }
    await order.save();

    res.json({
      msg: "Payment released successfully",
      finalReceivableAmount: financialSnapshot.growerNetSettlement,
      financialSnapshot,
      documents,
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.post("/location", protect, authorize("driver"), async (req, res) => {
  try {
    const { orderId, lat, lng, accuracy, source = "MANUAL", stationName = "", status = "" } = req.body;
    const delivery = await Delivery.findOne({ order: orderId });
    if (!delivery) return res.status(404).json({ msg: "Delivery not found" });
    if (delivery.driver?.toString() !== req.user.id?.toString()) {
      return res.status(403).json({ msg: "You can update only your own delivery location" });
    }

    const location = {
      lat: Number(lat),
      lng: Number(lng),
      accuracy: Number(accuracy || 0),
      stationName: String(stationName || "").trim(),
      status: String(status || "GPS station update").trim(),
      source: source === "AUTO" ? "AUTO" : "MANUAL",
      updatedAt: new Date(),
    };
    if (!Number.isFinite(location.lat) || !Number.isFinite(location.lng)) {
      return res.status(400).json({ msg: "Valid latitude and longitude are required" });
    }

    delivery.lastLocation = location;
    delivery.locationHistory.push(location);
    await delivery.save();
    // TODO: Reuse notification/SMS hooks here when station-progress alerts are enabled.
    res.json({ msg: "Location updated", location });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.post("/unload", protect, authorize("driver"), async (req, res) => {
  try {
    const { orderId, stationName = "" } = req.body;
    const delivery = await Delivery.findOne({ order: orderId });
    if (!delivery) return res.status(404).json({ msg: "Delivery not found" });
    if (delivery.driver?.toString() !== req.user.id?.toString()) {
      return res.status(403).json({ msg: "You can update only your own delivery" });
    }

    delivery.status = "DELIVERED";
    const lastLocation = delivery.lastLocation?.toObject ? delivery.lastLocation.toObject() : delivery.lastLocation;
    if (lastLocation?.lat && lastLocation?.lng) {
      delivery.locationHistory.push({
        ...lastLocation,
        stationName: String(stationName || lastLocation.stationName || "Unloaded / Delivered").trim(),
        status: "Unloaded / Delivered",
        updatedAt: new Date(),
      });
    }
    await delivery.save();
    res.json({ msg: "Consignment marked unloaded/delivered", delivery });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.get("/track/:orderId", protect, async (req, res) => {
  try {
    const delivery = await Delivery.findOne({ order: req.params.orderId }).populate("driver", "name logisticsName vehicleNumber driverName driverContact logisticsOwnerName logisticsOwnerContact");
    if (!delivery) return res.status(404).json({ msg: "Delivery not found" });
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ msg: "Order not found" });

    const userId = req.user.id?.toString();
    const canView = [order.buyer, order.grower, order.driver].some((id) => id?.toString() === userId);
    if (!canView) return res.status(403).json({ msg: "You cannot view this delivery" });

    res.json({ delivery, order });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

export default router;
