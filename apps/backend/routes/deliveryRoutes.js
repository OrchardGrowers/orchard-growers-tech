import express from "express";
import Delivery from "../models/Delivery.js";
import Order from "../models/Order.js";
import protect, { authorize } from "../middleware/authMiddleware.js";

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

router.post("/generate-settlement-otp", protect, authorize("buyer"), async (req, res) => {
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

router.post("/confirm-settlement", protect, authorize("grower"), async (req, res) => {
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

    delivery.status = "COMPLETED";
    await delivery.save();

    const finalAmount = delivery.isNegotiated
      ? delivery.negotiatedAmount
      : order.auctionPrice;

    order.paymentStatus = "RELEASED";
    order.finalPrice = finalAmount;
    await order.save();

    res.json({
      msg: "Payment released successfully",
      finalAmount,
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

export default router;
