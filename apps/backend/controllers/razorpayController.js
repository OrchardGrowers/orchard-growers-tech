import crypto from "crypto";
import Order from "../models/Order.js";
import User from "../models/User.js";
import getRazorpayClient from "../config/razorpay.js";
import { isLocalTestAccount } from "../utils/testAccount.js";
import {
  generateBillDeskPaymentRef,
  generateBuyerInvoiceNo,
  generateCommissionInvoiceNo,
  generateCommissionReceiptNo,
} from "../services/invoiceNumberingService.js";
import { refreshSettlementEligibility } from "../services/logisticsAssignmentService.js";

const roundMoney = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const ensureOwnBuyerOrder = (order, userId) =>
  order.buyer?.toString() === userId?.toString();

const normalizePaymentStatus = (status) =>
  String(status || "PENDING").trim().toUpperCase();

const isPaymentPending = (order) =>
  normalizePaymentStatus(order?.paymentStatus) === "PENDING";

const isPaymentCompleted = (order) =>
  ["ESCROW", "PAID", "RELEASED"].includes(normalizePaymentStatus(order?.paymentStatus));

const canUseLocalRazorpayTestMode = (buyer = {}) =>
  process.env.NODE_ENV !== "production" &&
  process.env.ALLOW_TEST_OTP === "true" &&
  isLocalTestAccount(buyer);

const getLocalRazorpayOrderId = (order) =>
  `order_local_${String(order._id).slice(-10)}_${Date.now()}`;

const getRazorpayErrorMessage = (err) =>
  err?.error?.description ||
  err?.error?.reason ||
  err?.response?.data?.error?.description ||
  err?.response?.data?.error?.reason ||
  err?.message ||
  "Razorpay order creation failed";

const getRazorpayPaymentEntity = (payload = {}) =>
  payload?.payload?.payment?.entity || payload?.payment?.entity || {};

const getRazorpayOrderEntity = (payload = {}) =>
  payload?.payload?.order?.entity || payload?.order?.entity || {};

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

  const taxableAmount = roundMoney(
    order.platformCommission ||
      order.dealBreakdown?.platformServiceFee ||
      order.dealBreakdown?.commissionAmount ||
      0
  );

  const gstPercent = Number(process.env.EFRUITMANDI_COMMISSION_GST_PERCENT || 0);
  const gstAmount = roundMoney(taxableAmount * (gstPercent / 100));

  order.commissionTaxableAmount = taxableAmount;
  order.commissionGstPercent = gstPercent;
  order.commissionGstAmount = gstAmount;
  order.commissionTotalAmount = roundMoney(taxableAmount + gstAmount);
};

const holdOrderInEscrow = async (
  order,
  {
    gatewayOrderId = "",
    paymentId = "",
    signature = "",
    gatewayStatus = "CAPTURED",
    response = {},
  } = {}
) => {
  if (!order) return null;

  if (isPaymentCompleted(order)) {
    order.paymentGatewayResponse = {
      ...(order.paymentGatewayResponse || {}),
      ...response,
      idempotentWebhookAt: new Date(),
    };
    await order.save();
    return order;
  }

  order.paymentStatus = "ESCROW";
  order.escrowStatus = "PAYMENT_RECEIVED_AND_HELD";
  order.paymentGateway = "RAZORPAY";
  order.paymentGatewayStatus = gatewayStatus;
  if (paymentId) order.paymentReference = paymentId;
  if (gatewayOrderId) order.paymentGatewayOrderId = gatewayOrderId;
  order.logisticsAssignment = {
    ...(order.logisticsAssignment?.toObject
      ? order.logisticsAssignment.toObject()
      : order.logisticsAssignment || {}),
    status: "AWAITING_GROWER_DETAILS",
  };

  order.paymentGatewayResponse = {
    ...(order.paymentGatewayResponse || {}),
    ...response,
    razorpay_order_id: gatewayOrderId || order.paymentGatewayOrderId,
    razorpay_payment_id: paymentId || order.paymentReference,
    razorpay_signature: signature || response.razorpay_signature,
    signatureVerified: response.signatureVerified ?? Boolean(signature),
    verifiedAt: response.verifiedAt || new Date(),
  };

  await ensureCommissionDocuments(order);
  await refreshSettlementEligibility(order);
  await order.save();
  return order;
};

const markOrderPaymentFailed = async (order, response = {}) => {
  if (!order || isPaymentCompleted(order)) return order;

  order.paymentGateway = "RAZORPAY";
  order.paymentGatewayStatus = "FAILED";
  order.paymentStatus = "FAILED";
  order.paymentGatewayResponse = {
    ...(order.paymentGatewayResponse || {}),
    ...response,
    failedAt: new Date(),
  };
  await order.save();
  return order;
};

export const createRazorpayOrder = async (req, res) => {
  try {
    const { orderId } = req.body;

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ msg: "Order not found" });
    }

    if (!ensureOwnBuyerOrder(order, req.user.id)) {
      return res.status(403).json({ msg: "You can pay only for your own order" });
    }

    if (!isPaymentPending(order)) {
      return res.status(400).json({ msg: "Order already paid or in escrow" });
    }

    const amount = Number(order.finalPrice || order.totalAmount || order.auctionPrice || 0);

    if (!amount || amount <= 0) {
      return res.status(400).json({ msg: "Invalid payable amount" });
    }

    const buyer = await User.findById(order.buyer).select("email phone contact").lean();
    let razorpayOrder;
    let localTestMode = false;

    try {
      const razorpay = getRazorpayClient();

      razorpayOrder = await razorpay.orders.create({
        amount: Math.round(amount * 100),
        currency: "INR",
        receipt: `EFM-${order._id}`,
        notes: {
          platform: "efruitmandi",
          internalOrderId: order._id.toString(),
          buyerId: order.buyer?.toString() || "",
          growerId: order.grower?.toString() || "",
        },
      });
    } catch (razorpayErr) {
      if (!canUseLocalRazorpayTestMode(buyer)) {
        return res.status(502).json({ msg: getRazorpayErrorMessage(razorpayErr) });
      }

      localTestMode = true;
      razorpayOrder = {
        id: getLocalRazorpayOrderId(order),
        amount: Math.round(amount * 100),
        currency: "INR",
        status: "created",
        localTestMode: true,
      };
    }

    order.paymentGateway = "RAZORPAY";
    order.paymentGatewayStatus = localTestMode ? "LOCAL_TEST_ORDER_CREATED" : "ORDER_CREATED";
    order.paymentStatus = "PENDING";
    order.paymentGatewayOrderId = razorpayOrder.id;
    order.paymentGatewayResponse = {
      ...(order.paymentGatewayResponse || {}),
      razorpayOrder,
      localTestMode,
    };

    await order.save();

    res.json({
      msg: "Razorpay order created",
      keyId: process.env.RAZORPAY_KEY_ID,
      orderId: order._id,
      razorpayOrderId: razorpayOrder.id,
      amount,
      currency: "INR",
      localTestMode,
    });
  } catch (err) {
    res.status(500).json({ msg: err.message || "Could not create Razorpay order" });
  }
};

export const verifyRazorpayPayment = async (req, res) => {
  try {
    const {
      orderId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ msg: "Order not found" });
    }

    if (!ensureOwnBuyerOrder(order, req.user.id)) {
      return res.status(403).json({ msg: "You can pay only for your own order" });
    }

    if (!isPaymentPending(order)) {
      return res.json({ msg: "Payment already processed", order });
    }

    const buyer = await User.findById(order.buyer).select("email phone contact").lean();
    const localTestMode =
      canUseLocalRazorpayTestMode(buyer) &&
      (req.body.localTestPayment === true || String(razorpay_order_id || "").startsWith("order_local_"));

    if (localTestMode) {
      const localPaymentId = razorpay_payment_id || `pay_local_${Date.now()}`;
      await holdOrderInEscrow(order, {
        gatewayOrderId: razorpay_order_id || order.paymentGatewayOrderId,
        paymentId: localPaymentId,
        gatewayStatus: "LOCAL_TEST_CAPTURED",
        response: {
          razorpay_order_id: razorpay_order_id || order.paymentGatewayOrderId,
          razorpay_payment_id: localPaymentId,
          signatureVerified: true,
          localTestMode: true,
          verifiedAt: new Date(),
        },
      });

      return res.json({
        msg: "Local test payment successful and held in escrow",
        order,
      });
    }

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      await markOrderPaymentFailed(order, {
        razorpay_order_id,
        razorpay_payment_id,
        signatureVerified: false,
      });

      return res.status(400).json({ msg: "Invalid Razorpay payment signature" });
    }

    await holdOrderInEscrow(order, {
      gatewayOrderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
      gatewayStatus: "CAPTURED",
      response: {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      signatureVerified: true,
      verifiedAt: new Date(),
      },
    });

    res.json({
      msg: "Payment successful and held in escrow",
      order,
    });
  } catch (err) {
    res.status(500).json({ msg: err.message || "Could not verify Razorpay payment" });
  }
};

export const razorpayWebhook = async (req, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!webhookSecret) {
      return res.status(200).json({ received: true, skipped: "Webhook secret not configured" });
    }

    const signature = req.headers["x-razorpay-signature"];
    const body = req.rawBody || JSON.stringify(req.body);

    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(body)
      .digest("hex");

    if (signature !== expectedSignature) {
      return res.status(400).json({ msg: "Invalid webhook signature" });
    }

    const payload = req.body || {};
    const event = String(payload.event || "").trim();
    const payment = getRazorpayPaymentEntity(payload);
    const razorpayOrder = getRazorpayOrderEntity(payload);
    const gatewayOrderId = payment.order_id || razorpayOrder.id || "";
    const internalOrderId =
      payment.notes?.internalOrderId ||
      razorpayOrder.notes?.internalOrderId ||
      "";
    const order = internalOrderId
      ? await Order.findById(internalOrderId)
      : await Order.findOne({ paymentGatewayOrderId: gatewayOrderId });

    if (!order) {
      return res.status(200).json({ received: true, ignored: true, msg: "Order not found for Razorpay webhook" });
    }

    const paymentStatus = String(payment.status || razorpayOrder.status || "").toLowerCase();
    if (event === "payment.captured" || paymentStatus === "captured" || event === "order.paid") {
      await holdOrderInEscrow(order, {
        gatewayOrderId,
        paymentId: payment.id || "",
        gatewayStatus: "CAPTURED",
        response: {
          webhookEvent: event,
          webhookPayload: payload,
          webhookProcessedAt: new Date(),
          signatureVerified: true,
        },
      });
    } else if (event === "payment.failed" || paymentStatus === "failed") {
      await markOrderPaymentFailed(order, {
        webhookEvent: event,
        webhookPayload: payload,
      });
    } else {
      order.paymentGateway = "RAZORPAY";
      order.paymentGatewayStatus = paymentStatus ? paymentStatus.toUpperCase() : event || "WEBHOOK_RECEIVED";
      order.paymentGatewayResponse = {
        ...(order.paymentGatewayResponse || {}),
        webhookEvent: event,
        webhookPayload: payload,
        webhookReceivedAt: new Date(),
      };
      await order.save();
    }

    res.status(200).json({ received: true, orderId: order._id, paymentStatus: order.paymentStatus || "PENDING" });
  } catch (err) {
    res.status(500).json({ msg: err.message || "Webhook processing failed" });
  }
};
