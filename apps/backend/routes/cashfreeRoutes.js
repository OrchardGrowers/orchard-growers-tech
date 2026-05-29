import express from "express";
import axios from "axios";
import Order from "../models/Order.js";

const router = express.Router();

const getCashfreeBaseUrl = () =>
  String(process.env.CASHFREE_ENV || "").toLowerCase() === "production"
    ? "https://api.cashfree.com/pg"
    : "https://sandbox.cashfree.com/pg";

const getFrontendBaseUrl = () =>
  (process.env.ORCHARDGROWERS_CLIENT_URL || process.env.CLIENT_URL || "https://orchardgrowers.in").replace(/\/+$/, "");

const cashfreeHeaders = () => ({
  "Content-Type": "application/json",
  "x-api-version": process.env.CASHFREE_API_VERSION || "2025-01-01",
  "x-client-id": process.env.CASHFREE_CLIENT_ID || "",
  "x-client-secret": process.env.CASHFREE_CLIENT_SECRET || "",
});

const cashfreeConfigured = () =>
  Boolean(process.env.CASHFREE_CLIENT_ID && process.env.CASHFREE_CLIENT_SECRET);

const markOrderPaid = async (order, reference, response = {}) => {
  order.paymentStatus = "PAID";
  order.paymentGatewayStatus = "PAID";
  order.paymentReference = reference || order.paymentReference || `CASHFREE-${Date.now()}`;
  order.paymentGatewayResponse = response;
  if (order.deliveryPartnerSelection !== "MANUAL" && !order.trackingNumber) {
    order.courierPartner = order.courierPartner || "India Post";
    order.courierBookingStatus = "TEST_BOOKED";
    order.trackingNumber = `IPTEST${Date.now().toString().slice(-10)}`;
  }
  await order.save();
  return order;
};

router.post("/create-session", async (req, res) => {
  try {
    const { orderId } = req.body;
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ msg: "Order not found" });
    if (order.paymentStatus === "PAID") return res.json({ order, paymentUrl: "", msg: "Order already paid" });

    order.paymentMethod = "CASHFREE";
    order.paymentGateway = "CASHFREE";
    order.paymentGatewayOrderId = order.paymentGatewayOrderId || `OG_${order._id}`;

    if (!cashfreeConfigured()) {
      order.paymentGatewayStatus = "TEST_SESSION_CREATED";
      order.paymentGatewaySessionId = `test_session_${Date.now()}`;
      await order.save();
      return res.json({
        order,
        testMode: true,
        paymentUrl: `${getFrontendBaseUrl()}/payment/cashfree/callback?order_id=${order._id}&status=PAID&test=true`,
        msg: "Cashfree is not configured. Test callback URL generated.",
      });
    }

    const payload = {
      order_id: order.paymentGatewayOrderId,
      order_amount: Number(order.totalAmount || order.finalPrice || 0),
      order_currency: "INR",
      customer_details: {
        customer_id: String(order.customer?.phone || order.customer?.email || order._id).replace(/[^a-zA-Z0-9_-]/g, "_"),
        customer_name: order.customer?.name || "Orchard Growers Customer",
        customer_email: order.customer?.email || "care@orchardgrowers.in",
        customer_phone: order.customer?.phone || "9999999999",
      },
      order_meta: {
        return_url: `${getFrontendBaseUrl()}/payment/cashfree/callback?order_id=${order._id}&cf_order_id={order_id}`,
      },
    };

    const created = await axios.post(`${getCashfreeBaseUrl()}/orders`, payload, { headers: cashfreeHeaders() });
    const sessionId = created.data?.payment_session_id || "";
    order.paymentGatewaySessionId = sessionId;
    order.paymentGatewayStatus = created.data?.order_status || "SESSION_CREATED";
    order.paymentGatewayResponse = created.data;
    await order.save();

    const paid = await axios.post(
      `${getCashfreeBaseUrl()}/orders/sessions`,
      { payment_session_id: sessionId, payment_method: { upi: { channel: "link" } } },
      { headers: cashfreeHeaders() }
    );

    res.json({
      order,
      paymentSessionId: sessionId,
      paymentUrl: paid.data?.data?.url || paid.data?.url || "",
      cashfreeOrder: created.data,
      cashfreePay: paid.data,
    });
  } catch (err) {
    res.status(500).json({ msg: err.response?.data?.message || err.message || "Could not create Cashfree payment" });
  }
});

router.post("/confirm", async (req, res) => {
  try {
    const { orderId, status, reference, gatewayResponse } = req.body;
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ msg: "Order not found" });

    if (String(status || "").toUpperCase() === "PAID" || String(status || "").toUpperCase() === "SUCCESS") {
      const paidOrder = await markOrderPaid(order, reference, gatewayResponse);
      return res.json({ msg: "Payment confirmed", order: paidOrder });
    }

    order.paymentStatus = "FAILED";
    order.paymentGatewayStatus = String(status || "FAILED").toUpperCase();
    order.paymentGatewayResponse = gatewayResponse || {};
    await order.save();
    return res.status(400).json({ msg: "Payment was not successful", order });
  } catch (err) {
    res.status(500).json({ msg: err.message || "Could not confirm payment" });
  }
});

router.post("/webhook", async (req, res) => {
  try {
    const data = req.body?.data || req.body || {};
    const gatewayOrderId = data.order?.order_id || data.order_id || "";
    const status = data.payment?.payment_status || data.order_status || data.payment_status || "";
    const order = await Order.findOne({ paymentGatewayOrderId: gatewayOrderId });
    if (!order) return res.status(404).json({ msg: "Order not found" });

    if (String(status).toUpperCase() === "SUCCESS" || String(status).toUpperCase() === "PAID") {
      await markOrderPaid(order, data.payment?.cf_payment_id || data.cf_payment_id, req.body);
    }

    res.json({ received: true });
  } catch (err) {
    res.status(500).json({ msg: err.message || "Cashfree webhook failed" });
  }
});

export default router;
