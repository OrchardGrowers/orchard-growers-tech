import express from "express";
import Order from "../models/Order.js";
import protect, { authorize } from "../middleware/authMiddleware.js";
import {
  generateBillDeskPaymentRef,
  generateBuyerInvoiceNo,
  generateCommissionInvoiceNo,
  generateCommissionReceiptNo,
} from "../services/invoiceNumberingService.js";
import { refreshSettlementEligibility } from "../services/logisticsAssignmentService.js";

const router = express.Router();

const ensureOwnBuyerOrder = (order, userId) =>
  order.buyer?.toString() === userId?.toString();

const hasProfile = (user, profileType) =>
  user?.role === profileType ||
  (Array.isArray(user?.profileTypes) && user.profileTypes.includes(profileType));

const sanitizeEscrowOrder = (order, user) => {
  const data = order?.toObject ? order.toObject() : { ...order };
  const userId = user?.id?.toString();
  const isGrowerView =
    hasProfile(user, "grower") && (data.grower?._id || data.grower)?.toString() === userId;
  const isBuyerView =
    hasProfile(user, "buyer") && (data.buyer?._id || data.buyer)?.toString() === userId;

  if (isGrowerView && !isBuyerView) {
    data.sellerReceivable = data.growerPayout || data.dealBreakdown?.sellerReceivable || data.auctionPrice || 0;
    delete data.dealBreakdown;
    delete data.driverPayment;
    delete data.platformCommission;
    delete data.shippingCharge;
    delete data.taxAmount;
    delete data.finalPrice;
    delete data.totalAmount;
    delete data.commissionInvoiceNumber;
    delete data.commissionInvoiceDate;
    delete data.commissionReceiptNumber;
    delete data.commissionReceiptDate;
    delete data.commissionTaxableAmount;
    delete data.commissionGstPercent;
    delete data.commissionGstAmount;
    delete data.commissionTotalAmount;
  }

  return data;
};

const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const ensureCommissionDocuments = async (order) => {
  const now = new Date();
  if (!order.invoiceNumber) {
    order.invoiceNumber = await generateBuyerInvoiceNo(now);
    order.invoiceDate = now;
  }
  if (!order.commissionInvoiceNumber) {
    order.commissionInvoiceNumber = await generateCommissionInvoiceNo(now);
    order.commissionInvoiceDate = now;
  }
  if (!order.commissionReceiptNumber) {
    order.commissionReceiptNumber = await generateCommissionReceiptNo(now);
    order.commissionReceiptDate = now;
  }
  if (!order.paymentReference) {
    order.paymentReference = await generateBillDeskPaymentRef(now);
  }

  const taxableAmount = roundMoney(order.platformCommission || order.dealBreakdown?.platformServiceFee || order.dealBreakdown?.commissionAmount || 0);
  const gstPercent = Number(process.env.EFRUITMANDI_COMMISSION_GST_PERCENT || 0);
  const gstAmount = roundMoney(taxableAmount * (gstPercent / 100));
  order.commissionTaxableAmount = taxableAmount;
  order.commissionGstPercent = gstPercent;
  order.commissionGstAmount = gstAmount;
  order.commissionTotalAmount = roundMoney(taxableAmount + gstAmount);
};

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
    order.escrowStatus = "PAYMENT_RECEIVED_AND_HELD";
    order.paymentGateway = "BILLDESK";
    order.paymentGatewayStatus = "ESCROW";
    order.logisticsAssignment = {
      ...(order.logisticsAssignment?.toObject ? order.logisticsAssignment.toObject() : order.logisticsAssignment || {}),
      status: "AWAITING_GROWER_DETAILS",
    };
    await ensureCommissionDocuments(order);
    await refreshSettlementEligibility(order);
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
      order: sanitizeEscrowOrder(order, req.user),
      steps: [
        { key: "DEAL_CONFIRMED", label: "Winning deal confirmed by grower", complete: Boolean(order.auction) },
        { key: "PAYMENT_RECEIVED_AND_HELD", label: "Buyer payment received and held by BillDesk escrow", complete: ["ESCROW", "RELEASED"].includes(order.paymentStatus) },
        { key: "LOGISTICS_ACCEPTED", label: "Grower assigns logistics and driver accepts assignment", complete: order.logisticsAssignment?.status === "LOGISTICS_ACCEPTED" },
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
