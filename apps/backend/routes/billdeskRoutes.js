import express from "express";
import Order from "../models/Order.js";
import protect, { authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

const ensureOwnBuyerOrder = (order, userId) =>
  order.buyer?.toString() === userId?.toString();

router.post("/pay", protect, authorize("buyer"), async (req, res) => {
  try {
    const { orderId } = req.body;
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ msg: "Order not found" });
    }

    if (!ensureOwnBuyerOrder(order, req.user.id)) {
      return res.status(403).json({ msg: "You can pay only for your own order" });
    }

    if (order.paymentStatus !== "PENDING") {
      return res.json({ msg: "Order already paid or in escrow" });
    }

    const amount = order.finalPrice || order.auctionPrice;

    res.json({
      msg: "Redirecting to payment (TEST MODE)",
      orderId,
      amount,
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.post("/callback", protect, authorize("buyer"), async (req, res) => {
  try {
    const { orderId } = req.body;
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ msg: "Order not found" });
    }

    if (!ensureOwnBuyerOrder(order, req.user.id)) {
      return res.status(403).json({ msg: "You can pay only for your own order" });
    }

    if (order.paymentStatus !== "PENDING") {
      return res.json({ msg: "Payment already processed" });
    }

    order.paymentStatus = "ESCROW";
    order.escrowStatus = "HELD_BY_BILLDESK";
    await order.save();

    res.json({
      msg: "Payment successful (ESCROW)",
      order,
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.get("/escrow/:orderId", protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId)
      .populate("product")
      .populate("buyer", "name businessName buyerContactPerson phone email location")
      .populate("grower", "name orchardName phone email location")
      .populate("driver", "name logisticsName vehicleNumber driverName driverContact");

    if (!order) return res.status(404).json({ msg: "Order not found" });

    const userId = req.user.id?.toString();
    const canView = [order.buyer?._id || order.buyer, order.grower?._id || order.grower, order.driver?._id || order.driver]
      .some((id) => id?.toString() === userId);
    if (!canView) return res.status(403).json({ msg: "You cannot view this escrow workflow" });

    res.json({
      order,
      steps: [
        { key: "DEAL_CONFIRMED", label: "Winning deal confirmed by grower", complete: Boolean(order.auction) },
        { key: "HELD_BY_BILLDESK", label: "Buyer payment held by BillDesk escrow", complete: ["ESCROW", "RELEASED"].includes(order.paymentStatus) },
        { key: "CONSIGNMENT_IN_TRANSIT", label: "Grower sends consignment and logistics details are updated", complete: ["IN_TRANSIT", "DELIVERED"].includes(order.deliveryStatus) },
        { key: "BUYER_CONFIRMED", label: "Buyer confirms consignment received", complete: ["DELIVERED"].includes(order.deliveryStatus) },
        { key: "PAYOUT_RELEASED", label: "Driver payment and platform commission deducted, grower payout released", complete: order.paymentStatus === "RELEASED" },
      ],
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.get("/status/:orderId", protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);

    if (!order) {
      return res.status(404).json({ msg: "Order not found" });
    }

    const userId = req.user.id?.toString();
    const canView =
      order.buyer?.toString() === userId ||
      order.grower?.toString() === userId ||
      order.driver?.toString() === userId;

    if (!canView) {
      return res.status(403).json({ msg: "You cannot view this payment" });
    }

    res.json({
      orderId: order._id,
      paymentStatus: order.paymentStatus,
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

export default router;
