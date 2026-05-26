import express from "express";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import protect, { optionalProtect } from "../middleware/authMiddleware.js";

const router = express.Router();

const getOrderVisibilityFilter = (user) => {
  if (user.role === "buyer") return { buyer: user.id };
  if (user.role === "driver") return { driver: user.id };
  if (user.role === "grower") return { grower: user.id };
  return {};
};

const populateOrder = (query) =>
  query
    .populate("product")
    .populate("items.product")
    .populate("buyer", "name businessName")
    .populate("grower", "name orchardName")
    .populate("driver", "name logisticsName");

const INDIA_POST_TEST_KEY = process.env.INDIA_POST_TEST_KEY || "INDIA_POST_TEST_KEY";

const createInvoiceNumber = () =>
  `OG-${new Date().getFullYear()}-${Date.now().toString().slice(-8)}`;

const createIndiaPostTracking = () => `IPTEST${Date.now().toString().slice(-10)}`;

router.post("/checkout", optionalProtect, async (req, res) => {
  try {
    const {
      items = [],
      customer = {},
      shippingAddress = {},
      paymentMethod = "TEST_PAYMENT",
      courierTestKey = "",
      deliveryPartnerSelection = "AUTOMATIC",
      courierPartner = "India Post",
    } = req.body;

    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ msg: "Cart items are required" });
    }

    if (!customer.name || !customer.phone || !shippingAddress.line1 || !shippingAddress.city || !shippingAddress.pinCode) {
      return res.status(400).json({ msg: "Name, phone, address, city, and PIN code are required" });
    }

    if (courierTestKey !== INDIA_POST_TEST_KEY) {
      return res.status(400).json({ msg: "Invalid India Post test key" });
    }

    const productIds = items.map((item) => item.productId).filter(Boolean);
    const products = await Product.find({ _id: { $in: productIds } });
    const productMap = new Map(products.map((product) => [product._id.toString(), product]));

    const orderItems = items.map((item) => {
      const product = productMap.get(String(item.productId));
      const quantity = Math.max(1, Number(item.quantity || 1));
      const unitPrice = Number(product?.basePrice ?? item.unitPrice ?? 0);
      return {
        product: product?._id,
        title: product?.title || item.title || "Product",
        quantity,
        unitPrice,
        lineTotal: quantity * unitPrice,
      };
    });

    const subtotal = orderItems.reduce((sum, item) => sum + item.lineTotal, 0);
    const shippingCharge = subtotal >= 499 ? 0 : 60;
    const taxAmount = Math.round(subtotal * 0.05);
    const totalAmount = subtotal + shippingCharge + taxAmount;
    const invoiceNumber = createInvoiceNumber();

    const selectedDeliveryMode = deliveryPartnerSelection === "MANUAL" ? "MANUAL" : "AUTOMATIC";
    const selectedCourier = courierPartner || "India Post";
    const onlinePayment = paymentMethod === "CASHFREE";

    const order = await Order.create({
      product: orderItems[0]?.product,
      grower: products[0]?.createdBy,
      buyer: req.user?.role === "buyer" ? req.user.id : undefined,
      items: orderItems,
      customer,
      shippingAddress,
      subtotal,
      shippingCharge,
      taxAmount,
      totalAmount,
      finalPrice: totalAmount,
      invoiceNumber,
      invoiceDate: new Date(),
      paymentMethod,
      paymentStatus: paymentMethod === "COD" || onlinePayment ? "PENDING" : "PAID",
      paymentReference: paymentMethod === "COD" || onlinePayment ? "" : `TESTPAY-${Date.now()}`,
      deliveryStatus: "PLACED",
      courierPartner: selectedCourier,
      deliveryPartnerSelection: selectedDeliveryMode,
      courierTestKey,
      courierBookingStatus: selectedDeliveryMode === "MANUAL" ? "MANUAL_REVIEW" : "TEST_BOOKED",
      trackingNumber: selectedDeliveryMode === "MANUAL" ? "" : createIndiaPostTracking(),
    });

    res.status(201).json(await populateOrder(Order.findById(order._id)));
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.get("/:id/tracking", async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ msg: "Order not found" });

    res.json({
      orderId: order._id,
      invoiceNumber: order.invoiceNumber,
      courierPartner: order.courierPartner || "India Post",
      deliveryPartnerSelection: order.deliveryPartnerSelection || "AUTOMATIC",
      courierBookingStatus: order.courierBookingStatus || "PENDING",
      trackingNumber: order.trackingNumber || "",
      deliveryStatus: order.deliveryStatus || "PLACED",
      trackingEvents: [
        { label: "Order placed", status: "DONE", at: order.createdAt },
        {
          label: order.trackingNumber ? "India Post booking created" : "Delivery partner pending",
          status: order.trackingNumber ? "DONE" : "PENDING",
          at: order.trackingNumber ? order.updatedAt : null,
        },
      ],
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.get("/:id/invoice", async (req, res) => {
  try {
    const order = await populateOrder(Order.findById(req.params.id));
    if (!order) return res.status(404).json({ msg: "Order not found" });
    res.json(order);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.get("/", protect, async (req, res) => {
  try {
    const orders = await populateOrder(
      Order.find(getOrderVisibilityFilter(req.user)).sort({ createdAt: -1 })
    );

    res.json(orders);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.get("/:id", protect, async (req, res) => {
  try {
    const order = await populateOrder(Order.findById(req.params.id));

    if (!order) {
      return res.status(404).json({ msg: "Order not found" });
    }

    const userId = req.user.id?.toString();
    const visible =
      req.user.role === "buyer"
        ? order.buyer?._id?.toString() === userId
        : req.user.role === "grower"
          ? order.grower?._id?.toString() === userId
          : req.user.role === "driver"
            ? !order.driver || order.driver?._id?.toString() === userId
            : true;

    if (!visible) {
      return res.status(403).json({ msg: "You cannot view this order" });
    }

    res.json(order);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

export default router;
