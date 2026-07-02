import express from "express";
import axios from "axios";
import crypto from "crypto";
import Order from "../models/Order.js";
import { requirePaymentPartnerEnabled } from "../utils/paymentFeatureFlag.js";

const router = express.Router();

router.use(requirePaymentPartnerEnabled);

const SUCCESS_STATUSES = new Set(["PAID", "SUCCESS"]);
const FAILED_ORDER_STATUSES = new Set(["EXPIRED", "TERMINATED", "CANCELLED", "FAILED"]);
const FAILED_PAYMENT_STATUSES = new Set(["FAILED", "USER_DROPPED", "CANCELLED"]);

const normalizeBaseUrl = (value = "") => String(value || "").trim().replace(/\/+$/, "");
const stripApiSuffix = (value = "") => normalizeBaseUrl(value).replace(/\/api$/i, "");
const upper = (value = "") => String(value || "").trim().toUpperCase();

const getCashfreeMode = () => (String(process.env.CASHFREE_ENV || "").toLowerCase() === "production" ? "production" : "sandbox");

const getCashfreeBaseUrl = () =>
  getCashfreeMode() === "production"
    ? "https://api.cashfree.com/pg"
    : "https://sandbox.cashfree.com/pg";

const getFrontendBaseUrl = () =>
  normalizeBaseUrl(process.env.ORCHARDGROWERS_CLIENT_URL || process.env.ORCHARD_FRONTEND_URL || process.env.CLIENT_URL || "https://orchardgrowers.in");

const getBackendBaseUrl = () =>
  stripApiSuffix(process.env.ORCHARD_API_URL || process.env.API_URL || process.env.SERVER_URL || "https://api.orchardgrowers.in");

const getCashfreeClientId = () => process.env.CASHFREE_CLIENT_ID || process.env.CASHFREE_APP_ID || "";
const getCashfreeClientSecret = () => process.env.CASHFREE_CLIENT_SECRET || process.env.CASHFREE_SECRET_KEY || "";

const cashfreeHeaders = () => ({
  "Content-Type": "application/json",
  "x-api-version": process.env.CASHFREE_API_VERSION || "2023-08-01",
  "x-client-id": getCashfreeClientId(),
  "x-client-secret": getCashfreeClientSecret(),
});

const cashfreeConfigured = () => Boolean(getCashfreeClientId() && getCashfreeClientSecret());
const allowLocalCashfreeTestMode = () =>
  String(process.env.CASHFREE_ALLOW_TEST_MODE || "").trim().toLowerCase() === "true";

const createGatewayOrderId = (order) => `OG_${String(order._id)}`.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 45);

const normalizePhone = (phone = "") => {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
};

const amountForCashfree = (order) => Math.round(Number(order.totalAmount || order.finalPrice || 0) * 100) / 100;

const getGatewayOrderId = (order, override = "") => override || order.paymentGatewayOrderId || createGatewayOrderId(order);

const findOrderByGatewayOrderId = async (gatewayOrderId) => {
  if (!gatewayOrderId) return null;

  const byGatewayId = await Order.findOne({ paymentGatewayOrderId: gatewayOrderId });
  if (byGatewayId) return byGatewayId;

  if (gatewayOrderId.startsWith("OG_")) {
    const localId = gatewayOrderId.slice(3);
    if (/^[a-f\d]{24}$/i.test(localId)) return Order.findById(localId);
  }

  return null;
};

const buildCashfreeOrderPayload = (order) => {
  const amount = amountForCashfree(order);
  const phone = normalizePhone(order.customer?.phone);
  const email = String(order.customer?.email || "").trim();

  if (!Number.isFinite(amount) || amount <= 0) {
    const error = new Error("Order amount must be greater than zero for Cashfree payment.");
    error.statusCode = 400;
    throw error;
  }

  if (!/^\d{10}$/.test(phone)) {
    const error = new Error("Enter a valid 10 digit customer phone number before online payment.");
    error.statusCode = 400;
    throw error;
  }

  const payload = {
    order_id: getGatewayOrderId(order),
    order_amount: amount,
    order_currency: "INR",
    customer_details: {
      customer_id: String(order.customer?.phone || order.customer?.email || order._id).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 50),
      customer_name: order.customer?.name || "Orchard Growers Customer",
      customer_phone: phone,
    },
    order_meta: {
      return_url: `${getFrontendBaseUrl()}/payment/cashfree/callback?local_order_id=${order._id}&cashfree_order_id={order_id}`,
      notify_url: `${getBackendBaseUrl()}/api/payments/cashfree/webhook`,
    },
    order_tags: {
      platform: "orchardgrowers",
      local_order_id: String(order._id),
      invoice_number: order.invoiceNumber || "",
    },
  };

  if (email) payload.customer_details.customer_email = email;

  return payload;
};

const getCashfreeOrder = async (gatewayOrderId) => {
  const response = await axios.get(`${getCashfreeBaseUrl()}/orders/${encodeURIComponent(gatewayOrderId)}`, {
    headers: cashfreeHeaders(),
  });
  return response.data;
};

const getCashfreePayments = async (gatewayOrderId) => {
  const response = await axios.get(`${getCashfreeBaseUrl()}/orders/${encodeURIComponent(gatewayOrderId)}/payments`, {
    headers: cashfreeHeaders(),
  });
  return Array.isArray(response.data) ? response.data : response.data?.data || [];
};

const createCashfreeOrder = async (order) => {
  const payload = buildCashfreeOrderPayload(order);

  try {
    const response = await axios.post(`${getCashfreeBaseUrl()}/orders`, payload, {
      headers: cashfreeHeaders(),
    });
    return response.data;
  } catch (err) {
    const alreadyExists =
      err.response?.status === 409 ||
      /already\s+exists/i.test(err.response?.data?.message || "") ||
      /order_id/i.test(err.response?.data?.code || "");

    if (!alreadyExists) throw err;

    const existingOrder = await getCashfreeOrder(payload.order_id);
    if (!existingOrder?.payment_session_id) throw err;
    return existingOrder;
  }
};

const extractSuccessfulPayment = (payments = []) =>
  payments.find((payment) => SUCCESS_STATUSES.has(upper(payment?.payment_status))) || null;

const extractLatestPayment = (payments = []) =>
  [...payments].sort((a, b) => {
    const first = new Date(a?.payment_time || a?.created_at || 0).getTime();
    const second = new Date(b?.payment_time || b?.created_at || 0).getTime();
    return second - first;
  })[0] || null;

const buildGatewayResponse = ({ cashfreeOrder, payments, webhookPayload, source }) => ({
  source,
  cashfreeOrder,
  payments,
  webhookPayload,
  syncedAt: new Date().toISOString(),
});

const markOrderPaid = async (order, { reference, response }) => {
  order.paymentStatus = "PAID";
  order.paymentMethod = "CASHFREE";
  order.paymentGateway = "CASHFREE";
  order.paymentGatewayStatus = "PAID";
  order.paymentReference = reference || order.paymentReference || `CASHFREE-${Date.now()}`;
  order.paymentGatewayResponse = response;
  order.settlementEligibility = {
    ...(order.settlementEligibility?.toObject ? order.settlementEligibility.toObject() : order.settlementEligibility || {}),
    buyerPaymentReceived: true,
  };

  if (order.deliveryPartnerSelection !== "MANUAL" && !order.trackingNumber) {
    order.courierPartner = order.courierPartner || "India Post";
    order.courierBookingStatus = "TEST_BOOKED";
    order.trackingNumber = `IPTEST${Date.now().toString().slice(-10)}`;
  }

  await order.save();
  return order;
};

const syncCashfreePaymentStatus = async (order, { gatewayOrderId = "", webhookPayload = null, source = "confirm" } = {}) => {
  const resolvedGatewayOrderId = getGatewayOrderId(order, gatewayOrderId);
  const cashfreeOrder = await getCashfreeOrder(resolvedGatewayOrderId);
  const payments = await getCashfreePayments(resolvedGatewayOrderId);
  const successfulPayment = extractSuccessfulPayment(payments);
  const latestPayment = extractLatestPayment(payments);
  const orderStatus = upper(cashfreeOrder?.order_status);
  const latestPaymentStatus = upper(latestPayment?.payment_status);
  const gatewayResponse = buildGatewayResponse({ cashfreeOrder, payments, webhookPayload, source });

  order.paymentMethod = "CASHFREE";
  order.paymentGateway = "CASHFREE";
  order.paymentGatewayOrderId = resolvedGatewayOrderId;
  order.paymentGatewaySessionId = cashfreeOrder?.payment_session_id || order.paymentGatewaySessionId;
  order.paymentGatewayStatus = successfulPayment ? "PAID" : orderStatus || latestPaymentStatus || "PENDING";
  order.paymentGatewayResponse = gatewayResponse;

  if (successfulPayment || SUCCESS_STATUSES.has(orderStatus)) {
    return {
      paid: true,
      order: await markOrderPaid(order, {
        reference: successfulPayment?.cf_payment_id || cashfreeOrder?.cf_order_id || resolvedGatewayOrderId,
        response: gatewayResponse,
      }),
      cashfreeOrder,
      payments,
    };
  }

  if (FAILED_ORDER_STATUSES.has(orderStatus) || FAILED_PAYMENT_STATUSES.has(latestPaymentStatus)) {
    order.paymentStatus = "FAILED";
  }

  await order.save();
  return { paid: false, order, cashfreeOrder, payments };
};

const verifyCashfreeWebhookSignature = (req) => {
  if (!cashfreeConfigured()) return allowLocalCashfreeTestMode();

  const signature = req.get("x-webhook-signature") || "";
  const timestamp = req.get("x-webhook-timestamp") || "";
  const rawBody = req.rawBody || "";

  if (!signature || !timestamp || !rawBody) return false;

  const expected = crypto
    .createHmac("sha256", getCashfreeClientSecret())
    .update(`${timestamp}${rawBody}`)
    .digest("base64");

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return signatureBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
};

const handleCashfreeError = (res, err, fallbackMessage) => {
  const status = err.statusCode || err.response?.status || 500;
  const message = err.response?.data?.message || err.response?.data?.msg || err.message || fallbackMessage;
  res.status(status >= 400 && status < 600 ? status : 500).json({ msg: message });
};

router.post("/create-session", async (req, res) => {
  try {
    const { orderId } = req.body;
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ msg: "Order not found" });
    if (order.paymentStatus === "PAID") {
      return res.json({ order, paid: true, msg: "Order already paid" });
    }

    order.paymentMethod = "CASHFREE";
    order.paymentGateway = "CASHFREE";
    order.paymentGatewayOrderId = getGatewayOrderId(order);

    if (!cashfreeConfigured()) {
      if (!allowLocalCashfreeTestMode()) {
        return res.status(503).json({ msg: "Cashfree credentials are not configured on the backend." });
      }

      order.paymentGatewayStatus = "TEST_SESSION_CREATED";
      order.paymentGatewaySessionId = `test_session_${Date.now()}`;
      await order.save();
      return res.json({
        order,
        testMode: true,
        paymentUrl: `${getFrontendBaseUrl()}/payment/cashfree/callback?local_order_id=${order._id}&cashfree_order_id=${order.paymentGatewayOrderId}&test=true`,
        msg: "Cashfree test mode callback generated. Configure Cashfree credentials before production use.",
      });
    }

    const cashfreeOrder = await createCashfreeOrder(order);
    order.paymentGatewaySessionId = cashfreeOrder?.payment_session_id || order.paymentGatewaySessionId;
    order.paymentGatewayStatus = cashfreeOrder?.order_status || "ACTIVE";
    order.paymentGatewayResponse = buildGatewayResponse({ cashfreeOrder, payments: [], source: "create-session" });
    await order.save();

    res.json({
      order,
      paymentSessionId: order.paymentGatewaySessionId,
      cashfreeOrderId: order.paymentGatewayOrderId,
      cashfreeMode: getCashfreeMode(),
      cashfreeOrder,
    });
  } catch (err) {
    handleCashfreeError(res, err, "Could not create Cashfree payment session");
  }
});

router.post("/confirm", async (req, res) => {
  try {
    const { orderId, cashfreeOrderId } = req.body;
    const order = orderId ? await Order.findById(orderId) : await findOrderByGatewayOrderId(cashfreeOrderId);
    if (!order) return res.status(404).json({ msg: "Order not found" });

    if (!cashfreeConfigured()) {
      if (!allowLocalCashfreeTestMode()) {
        return res.status(503).json({ msg: "Cashfree credentials are not configured on the backend." });
      }

      const paidOrder = await markOrderPaid(order, {
        reference: order.paymentGatewayOrderId || `CASHFREE-TEST-${Date.now()}`,
        response: { source: "local-test-confirm", cashfreeOrderId, syncedAt: new Date().toISOString() },
      });
      return res.json({ paid: true, msg: "Local Cashfree test payment confirmed.", order: paidOrder });
    }

    const result = await syncCashfreePaymentStatus(order, { gatewayOrderId: cashfreeOrderId, source: "confirm" });
    res.json({
      paid: result.paid,
      msg: result.paid ? "Cashfree payment confirmed." : "Cashfree payment is not successful yet.",
      order: result.order,
      cashfreeOrder: result.cashfreeOrder,
      payments: result.payments,
    });
  } catch (err) {
    handleCashfreeError(res, err, "Could not confirm Cashfree payment");
  }
});

router.get("/status/:orderId", async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ msg: "Order not found" });
    if (!cashfreeConfigured()) return res.json({ paid: order.paymentStatus === "PAID", order });

    const result = await syncCashfreePaymentStatus(order, {
      gatewayOrderId: req.query.cashfree_order_id || req.query.cf_order_id || "",
      source: "status",
    });
    res.json({ paid: result.paid, order: result.order, cashfreeOrder: result.cashfreeOrder, payments: result.payments });
  } catch (err) {
    handleCashfreeError(res, err, "Could not read Cashfree payment status");
  }
});

router.post("/webhook", async (req, res) => {
  try {
    if (!verifyCashfreeWebhookSignature(req)) {
      return res.status(401).json({ msg: "Invalid Cashfree webhook signature" });
    }

    const payload = req.body || {};
    const data = payload.data || {};
    const gatewayOrderId = data.order?.order_id || data.order_id || payload.order_id || "";
    const order = await findOrderByGatewayOrderId(gatewayOrderId);

    if (!order) return res.json({ received: true, ignored: true, msg: "Order not found for Cashfree webhook" });

    if (cashfreeConfigured()) {
      await syncCashfreePaymentStatus(order, { gatewayOrderId, webhookPayload: payload, source: "webhook" });
    } else if (allowLocalCashfreeTestMode()) {
      const status = upper(data.payment?.payment_status || data.payment_status || data.order?.order_status || data.order_status);
      if (SUCCESS_STATUSES.has(status)) {
        await markOrderPaid(order, { reference: data.payment?.cf_payment_id || gatewayOrderId, response: payload });
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error("Cashfree webhook failed:", err.response?.data || err.message || err);
    res.status(500).json({ msg: "Cashfree webhook failed" });
  }
});

export default router;
