import express from "express";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import protect, { optionalProtect } from "../middleware/authMiddleware.js";

const router = express.Router();

const hasProfile = (user, profileType) =>
  user?.role === profileType ||
  (Array.isArray(user?.profileTypes) && user.profileTypes.includes(profileType));

const getOrderVisibilityFilter = (user) => {
  const filters = [];
  if (hasProfile(user, "buyer")) filters.push({ buyer: user.id });
  if (hasProfile(user, "driver")) filters.push({ driver: user.id });
  if (hasProfile(user, "grower")) filters.push({ grower: user.id });
  if (filters.length === 1) return filters[0];
  if (filters.length > 1) return { $or: filters };
  return {};
};

const populateOrder = (query) =>
  query
    .populate("product")
    .populate("items.product")
    .populate("buyer", "name businessName")
    .populate("grower", "name orchardName")
    .populate("driver", "name logisticsName");

const sanitizeOrderForUser = (order, user) => {
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
    delete data.paymentReference;
    delete data.paymentGatewayOrderId;
    delete data.paymentGatewaySessionId;
    delete data.paymentGatewayResponse;
  }

  return data;
};

const INDIA_POST_TEST_KEY = process.env.INDIA_POST_TEST_KEY || "INDIA_POST_TEST_KEY";

const getFinancialYearStart = () => {
  const now = new Date();
  return new Date(now.getFullYear(), 0, 1);
};

const createInvoiceNumber = async () => {
  const year = new Date().getFullYear();
  const count = await Order.countDocuments({
    invoiceDate: { $gte: getFinancialYearStart() },
    invoiceNumber: new RegExp(`^OG/${year}/`),
  });
  return `OG/${year}/${String(count + 1).padStart(7, "0")}`;
};

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

    const requestedByProduct = new Map();
    items.forEach((item) => {
      if (!item.productId) return;
      const productId = String(item.productId);
      requestedByProduct.set(productId, (requestedByProduct.get(productId) || 0) + Math.max(1, Number(item.quantity || 1)));
    });

    for (const [productId, requestedQuantity] of requestedByProduct.entries()) {
      const product = productMap.get(productId);
      if (!product || product.active === false || product.inventoryType === "raw_material") {
        return res.status(400).json({ msg: "Selected product is not available for sale" });
      }
      const availableQuantity = Number(product.quantity || 0);
      if (!Number.isFinite(availableQuantity) || availableQuantity < requestedQuantity) {
        return res.status(400).json({
          msg: `${product.title || product.fruitName || "Product"} has only ${Math.max(0, availableQuantity)} unit(s) available. Please purchase or update stock first.`,
        });
      }
    }

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
    const invoiceNumber = await createInvoiceNumber();

    const selectedDeliveryMode = deliveryPartnerSelection === "MANUAL" ? "MANUAL" : "AUTOMATIC";
    const selectedCourier = courierPartner || "India Post";
    const onlinePayment = paymentMethod === "CASHFREE";

    const order = await Order.create({
      product: orderItems[0]?.product,
      grower: products[0]?.createdBy,
      buyer: hasProfile(req.user, "buyer") ? req.user.id : undefined,
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

    await Promise.all(
      Array.from(requestedByProduct.entries()).map(async ([productId, requestedQuantity]) => {
        const product = productMap.get(productId);
        product.quantity = Math.max(0, Number(product.quantity || 0) - requestedQuantity);
        if (product.quantity <= 0) product.status = "SOLD";
        await product.save();
      })
    );

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

    res.json(orders.map((order) => sanitizeOrderForUser(order, req.user)));
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
      (hasProfile(req.user, "buyer") && order.buyer?._id?.toString() === userId) ||
      (hasProfile(req.user, "grower") && order.grower?._id?.toString() === userId) ||
      (hasProfile(req.user, "driver") && (!order.driver || order.driver?._id?.toString() === userId)) ||
      (!hasProfile(req.user, "buyer") && !hasProfile(req.user, "grower") && !hasProfile(req.user, "driver"));

    if (!visible) {
      return res.status(403).json({ msg: "You cannot view this order" });
    }

    res.json(sanitizeOrderForUser(order, req.user));
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

export default router;
