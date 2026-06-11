import express from "express";
import Delivery from "../models/Delivery.js";
import Order from "../models/Order.js";
import User from "../models/User.js";
import protect, { authorize } from "../middleware/authMiddleware.js";
import { refreshSettlementEligibility } from "../services/logisticsAssignmentService.js";
import { requirePaymentPartnerEnabled } from "../utils/paymentFeatureFlag.js";

const router = express.Router();

const genOTP = () => Math.floor(1000 + Math.random() * 9000).toString();
const calculateSettlement = (amount = 0, order = {}) => {
  const finalAmount = Number(amount || 0);
  const driverPayment = Number(order.dealBreakdown?.driverCharge || order.driverPayment || 0);
  const platformCommission = Math.round(
    (finalAmount + driverPayment) * Number(process.env.PLATFORM_COMMISSION_PERCENT || 5) / 100
  );
  return {
    driverPayment,
    platformCommission,
    growerPayout: Math.max(0, finalAmount - platformCommission),
  };
};

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

    if (order.logisticsAssignment?.status !== "LOGISTICS_ACCEPTED" || order.driver?.toString() !== req.user.id?.toString()) {
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
    const { orderId, amount } = req.body;
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

    delivery.negotiatedAmount = Number(amount || 0);
    delivery.isNegotiated = true;
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
    const settlement = calculateSettlement(finalAmount, order);

    order.paymentStatus = "RELEASED";
    order.finalPrice = finalAmount;
    order.driverPayment = settlement.driverPayment;
    order.platformCommission = settlement.platformCommission;
    order.growerPayout = settlement.growerPayout;
    order.escrowStatus = "DEAL_CLOSED";
    delivery.driverPayment = settlement.driverPayment;
    delivery.platformCommission = settlement.platformCommission;
    delivery.growerPayout = settlement.growerPayout;
    await delivery.save();
    await order.save();

    res.json({
      msg: "Payment released successfully",
      finalReceivableAmount: settlement.growerPayout,
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.post("/location", protect, authorize("driver"), async (req, res) => {
  try {
    const { orderId, lat, lng, accuracy, source = "MANUAL" } = req.body;
    const delivery = await Delivery.findOne({ order: orderId });
    if (!delivery) return res.status(404).json({ msg: "Delivery not found" });
    if (delivery.driver?.toString() !== req.user.id?.toString()) {
      return res.status(403).json({ msg: "You can update only your own delivery location" });
    }

    const location = {
      lat: Number(lat),
      lng: Number(lng),
      accuracy: Number(accuracy || 0),
      source: source === "AUTO" ? "AUTO" : "MANUAL",
      updatedAt: new Date(),
    };
    if (!Number.isFinite(location.lat) || !Number.isFinite(location.lng)) {
      return res.status(400).json({ msg: "Valid latitude and longitude are required" });
    }

    delivery.lastLocation = location;
    delivery.locationHistory.push(location);
    await delivery.save();
    res.json({ msg: "Location updated", location });
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
