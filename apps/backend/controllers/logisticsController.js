import LogisticsShipment from "../models/LogisticsShipment.js";
import Order from "../models/Order.js";
import mongoose from "mongoose";
import {
  COURIER_PARTNERS,
  bookWithProvider,
  cancelWithProvider,
  checkAllServiceability,
  estimateAllRates,
  generateLabelWithProvider,
  getIndiaPostProvider,
  selectCourier,
  trackWithProvider,
} from "../logistics/logisticsService.js";

const required = [
  ["orderId", "Order ID"],
  ["customerDetails.customerName", "Customer name"],
  ["customerDetails.phone", "Mobile"],
  ["customerDetails.addressLine1", "Full address"],
  ["customerDetails.city", "City"],
  ["customerDetails.state", "State"],
  ["customerDetails.pincode", "Pincode"],
  ["pickupDetails.pickupAddress", "Pickup address"],
  ["pickupDetails.pickupPincode", "Pickup pincode"],
  ["packageDetails.productName", "Product name"],
  ["packageDetails.quantity", "Quantity"],
  ["packageDetails.deadWeightKg", "Weight"],
  ["packageDetails.lengthCm", "Length"],
  ["packageDetails.widthCm", "Width"],
  ["packageDetails.heightCm", "Height"],
  ["invoiceDetails.orderAmount", "Order value"],
  ["invoiceDetails.paymentMode", "Payment mode"],
  ["courierMode", "Courier mode"],
];

const get = (object, path) => path.split(".").reduce((value, key) => value?.[key], object);
const adminId = (req) => req.admin?._id || req.user?.id;

const validateBookingPayload = (payload = {}) => {
  const missing = required.filter(([path]) => {
    const value = get(payload, path);
    return value === undefined || value === null || String(value).trim() === "";
  });
  if (missing.length) return `Required before booking: ${missing.map(([, label]) => label).join(", ")}`;
  if (payload.courierMode === "manual" && !payload.selectedCourier) return "Select courier partner for manual booking.";
  return "";
};

const normalizePayload = (payload = {}) => ({
  orderId: String(payload.orderId || "").trim(),
  platform: payload.platform === "efruitmandi" ? "efruitmandi" : "orchardgrowers",
  customerDetails: payload.customerDetails || {},
  pickupDetails: payload.pickupDetails || {},
  packageDetails: payload.packageDetails || {},
  plantDetails: payload.plantDetails || {},
  fruitLotDetails: payload.fruitLotDetails || {},
  invoiceDetails: payload.invoiceDetails || {},
  selectedCourier: payload.selectedCourier || payload.courierPartner || "",
  courierPartner: payload.courierPartner || payload.selectedCourier || "",
  courierMode: payload.courierMode === "automatic" ? "automatic" : "manual",
  courierPriority: payload.courierPriority || "Manual",
  serviceType: payload.serviceType || payload.indiaPostServiceType || "",
  pickupDate: payload.pickupDate || "",
  pickupTimeSlot: payload.pickupTimeSlot || "",
});

const upsertShipment = async (payload, req, extra = {}) => {
  const normalized = normalizePayload(payload);
  const existing = await LogisticsShipment.findOne({ orderId: normalized.orderId, platform: normalized.platform });
  if (existing) {
    Object.assign(existing, normalized, extra, { updatedBy: adminId(req) });
    return existing.save();
  }
  return LogisticsShipment.create({ ...normalized, ...extra, createdBy: adminId(req), updatedBy: adminId(req) });
};

const mapOrderToLogistics = (order) => {
  const firstItem = order.items?.[0] || {};
  return {
    orderId: order.invoiceNumber || order._id.toString(),
    sourceOrderId: order._id.toString(),
    platform: (order.courierPartner || "").toLowerCase() === "efruitmandi" ? "efruitmandi" : "orchardgrowers",
    customerDetails: {
      customerName: order.customer?.name || "",
      phone: order.customer?.phone || "",
      email: order.customer?.email || "",
      addressLine1: order.shippingAddress?.line1 || "",
      addressLine2: order.shippingAddress?.line2 || "",
      city: order.shippingAddress?.city || "",
      state: order.shippingAddress?.state || "",
      pincode: order.shippingAddress?.pinCode || "",
      country: order.shippingAddress?.country || "India",
    },
    pickupDetails: {
      sellerName: "Orchard Growers",
      pickupContactName: "Dispatch Desk",
      pickupPhone: "",
      pickupEmail: "",
      pickupAddress: "",
      pickupCity: "",
      pickupDistrict: "",
      pickupState: "",
      pickupPincode: "",
      gstNumber: "",
      warehouseName: "Main Warehouse",
    },
    packageDetails: {
      productName: firstItem.title || "Order shipment",
      quantity: firstItem.quantity || 1,
      productCategory: "",
      packageType: "Box",
      deadWeightKg: "",
      lengthCm: "",
      widthCm: "",
      heightCm: "",
      volumetricWeightKg: "",
    },
    invoiceDetails: {
      orderAmount: order.totalAmount || order.finalPrice || 0,
      shippingCharge: order.shippingCharge || 0,
      gstAmount: order.taxAmount || 0,
      totalInvoiceValue: order.totalAmount || order.finalPrice || 0,
      invoiceNumber: order.invoiceNumber || "",
      invoiceDate: order.invoiceDate || order.createdAt,
      paymentMode: order.paymentMethod === "COD" ? "COD" : order.paymentStatus === "ESCROW" ? "Escrow" : "Prepaid",
    },
    selectedCourier: order.courierPartner || "India Post",
    courierMode: String(order.deliveryPartnerSelection || "AUTOMATIC").toLowerCase() === "manual" ? "manual" : "automatic",
    courierPriority: "Cheapest",
    awbNumber: order.trackingNumber || "",
    shipmentStatus: order.trackingNumber ? "Booked" : "Draft",
  };
};

export const listLogisticsOrders = async (req, res) => {
  const shipments = await LogisticsShipment.find().sort({ updatedAt: -1 }).lean();
  const sourceOrders = await Order.find().sort({ createdAt: -1 }).limit(80).lean();
  const existingKeys = new Set(shipments.map((item) => `${item.platform}:${item.orderId}`));
  const mappedOrders = sourceOrders.map(mapOrderToLogistics).filter((item) => !existingKeys.has(`${item.platform}:${item.orderId}`));
  res.json({ orders: [...shipments, ...mappedOrders], courierPartners: COURIER_PARTNERS });
};

export const getLogisticsOrder = async (req, res) => {
  const shipment = await LogisticsShipment.findOne({ orderId: req.params.orderId }).lean();
  if (shipment) return res.json({ order: shipment });
  const orderQuery = mongoose.isValidObjectId(req.params.orderId)
    ? { $or: [{ _id: req.params.orderId }, { invoiceNumber: req.params.orderId }] }
    : { invoiceNumber: req.params.orderId };
  const order = await Order.findOne(orderQuery).lean();
  if (!order) return res.status(404).json({ msg: "Logistics order not found" });
  return res.json({ order: mapOrderToLogistics(order) });
};

export const checkServiceability = async (req, res) => {
  const payload = normalizePayload(req.body);
  const results = await checkAllServiceability(payload);
  const shipment = await upsertShipment(payload, req, { serviceabilityResults: results, shipmentStatus: "Serviceability Checked" });
  res.json({ shipment, results });
};

export const estimateRates = async (req, res) => {
  const payload = normalizePayload(req.body);
  const results = await estimateAllRates(payload);
  const selectedCourier = payload.courierMode === "automatic" ? selectCourier(results, payload.courierPriority) : payload.selectedCourier;
  const shipment = await upsertShipment({ ...payload, selectedCourier }, req, { rateResults: results, shipmentStatus: "Rate Estimated" });
  res.json({ shipment, results, selectedCourier });
};

export const bookShipment = async (req, res) => {
  const payload = normalizePayload(req.body);
  const validationError = validateBookingPayload(payload);
  if (validationError) return res.status(400).json({ msg: validationError });
  let selectedCourier = payload.selectedCourier;
  let serviceabilityResults = req.body.serviceabilityResults || [];
  let rateResults = req.body.rateResults || [];
  if (payload.courierMode === "automatic") {
    serviceabilityResults = serviceabilityResults.length ? serviceabilityResults : await checkAllServiceability(payload);
    rateResults = rateResults.length ? rateResults : await estimateAllRates(payload);
    selectedCourier = selectCourier(rateResults, payload.courierPriority);
    if (!selectedCourier) return res.status(400).json({ msg: "No serviceable courier found for automatic mode." });
  }
  const booking = await bookWithProvider({ ...payload, selectedCourier });
  const shipment = await upsertShipment({ ...payload, selectedCourier }, req, {
    serviceabilityResults,
    rateResults,
    awbNumber: booking.awbNumber,
    articleNumber: booking.articleNumber || booking.awbNumber,
    trackingUrl: booking.trackingUrl,
    labelUrl: booking.labelUrl,
    manifestUrl: booking.manifestUrl,
    shipmentStatus: "Booked",
    bookingResponseRaw: booking.raw || booking,
    indiaPostRequestRaw: booking.rawRequest || {},
    indiaPostResponseRaw: booking.rawResponse || {},
  });
  res.json({ shipment, booking });
};

export const manualBookShipment = async (req, res) => {
  const payload = normalizePayload({ ...req.body, courierMode: "manual" });
  const validationError = validateBookingPayload(payload);
  if (validationError) return res.status(400).json({ msg: validationError });
  const awbNumber = req.body.awbNumber || req.body.awb || "";
  const shipment = await upsertShipment(payload, req, {
    awbNumber,
    trackingUrl: req.body.trackingUrl || "",
    labelUrl: req.body.labelUrl || "",
    shipmentStatus: awbNumber ? "Booked" : "Draft",
    bookingResponseRaw: { manual: true },
  });
  res.json({ shipment });
};

export const trackShipment = async (req, res) => {
  const shipment = await LogisticsShipment.findById(req.params.shipmentId).lean();
  const tracking = await trackWithProvider({ ...(shipment || {}), shipmentId: req.params.shipmentId });
  if (shipment?._id) {
    await LogisticsShipment.findByIdAndUpdate(shipment._id, { trackingHistory: tracking.trackingHistory || [], shipmentStatus: tracking.status || "In Transit" });
  }
  res.json({ tracking });
};

export const cancelShipment = async (req, res) => {
  const shipment = await LogisticsShipment.findById(req.params.shipmentId).lean();
  const result = await cancelWithProvider({ ...(shipment || {}), shipmentId: req.params.shipmentId });
  if (shipment?._id) await LogisticsShipment.findByIdAndUpdate(shipment._id, { shipmentStatus: "Cancelled" });
  res.json({ result });
};

export const reassignShipment = async (req, res) => {
  const shipment = await LogisticsShipment.findByIdAndUpdate(
    req.params.shipmentId,
    { selectedCourier: req.body.selectedCourier || req.body.courierPartner || "", shipmentStatus: "Draft", updatedBy: adminId(req) },
    { new: true }
  );
  if (!shipment) return res.status(404).json({ msg: "Shipment not found" });
  res.json({ shipment });
};

export const getLabel = async (req, res) => {
  const label = await generateLabelWithProvider({ shipmentId: req.params.shipmentId, awbNumber: req.params.shipmentId });
  res.json({ labelUrl: label.labelUrl, label });
};

export const getInvoice = async (req, res) => {
  res.json({ invoiceUrl: `/api/logistics/invoice/${encodeURIComponent(req.params.shipmentId)}.pdf`, mock: true });
};

const validateIndiaPostPayload = (payload = {}) => {
  const checks = [
    ["orderId", "orderId"],
    ["customerDetails.customerName", "buyer/customer name"],
    ["customerDetails.phone", "buyer mobile"],
    ["customerDetails.addressLine1", "buyer full address"],
    ["customerDetails.pincode", "buyer pincode"],
    ["pickupDetails.pickupContactName", "pickup name"],
    ["pickupDetails.pickupPhone", "pickup mobile"],
    ["pickupDetails.pickupAddress", "pickup address"],
    ["pickupDetails.pickupPincode", "pickup pincode"],
    ["packageDetails.productName", "product/fruit name"],
    ["packageDetails.quantity", "number of crates/packages"],
    ["packageDetails.deadWeightKg", "total weight"],
    ["packageDetails.lengthCm", "package length"],
    ["packageDetails.widthCm", "package width"],
    ["packageDetails.heightCm", "package height"],
    ["invoiceDetails.orderAmount", "invoice value"],
    ["invoiceDetails.paymentMode", "payment mode"],
    ["pickupDate", "pickup date"],
    ["serviceType", "selected India Post service type"],
  ];
  const missing = checks.filter(([path]) => {
    const value = get(payload, path);
    return value === undefined || value === null || String(value).trim() === "";
  });
  return missing.map(([, label]) => label);
};

export const indiaPostPincodeCheck = async (req, res) => {
  const payload = normalizePayload({ ...req.body, selectedCourier: "India Post", courierPartner: "india_post" });
  const result = await getIndiaPostProvider().checkPincode(payload);
  const shipment = await upsertShipment(payload, req, {
    selectedCourier: "India Post",
    courierPartner: "india_post",
    serviceabilityResults: [result],
    shipmentStatus: "Serviceability Checked",
    indiaPostRequestRaw: result.rawRequest || {},
    indiaPostResponseRaw: result.rawResponse || {},
  });
  res.json({ shipment, result, mode: process.env.INDIA_POST_MODE || "sandbox" });
};

export const indiaPostTariff = async (req, res) => {
  const payload = normalizePayload({ ...req.body, selectedCourier: "India Post", courierPartner: "india_post" });
  const result = await getIndiaPostProvider().estimateTariff(payload);
  const shipment = await upsertShipment(payload, req, {
    selectedCourier: "India Post",
    courierPartner: "india_post",
    rateResults: [result],
    shipmentStatus: "Rate Estimated",
    indiaPostRequestRaw: result.rawRequest || {},
    indiaPostResponseRaw: result.rawResponse || {},
  });
  res.json({ shipment, result, mode: process.env.INDIA_POST_MODE || "sandbox" });
};

export const indiaPostBook = async (req, res) => {
  const payload = normalizePayload({ ...req.body, selectedCourier: "India Post", courierPartner: "india_post" });
  const missing = validateIndiaPostPayload(payload);
  if (missing.length) return res.status(400).json({ msg: `Required before India Post booking: ${missing.join(", ")}` });
  const booking = await getIndiaPostProvider().bookShipment(payload);
  const articleNumber = booking.articleNumber || booking.awbNumber || "";
  const shipment = await upsertShipment(payload, req, {
    selectedCourier: "India Post",
    courierPartner: "india_post",
    awbNumber: articleNumber,
    articleNumber,
    trackingUrl: booking.trackingUrl,
    labelUrl: booking.labelUrl,
    manifestUrl: booking.manifestUrl,
    shipmentStatus: "Booked",
    bookingResponseRaw: booking,
    indiaPostRequestRaw: booking.rawRequest || {},
    indiaPostResponseRaw: booking.rawResponse || {},
  });
  res.json({ shipment, booking, mode: process.env.INDIA_POST_MODE || "sandbox" });
};

export const indiaPostTrack = async (req, res) => {
  const tracking = await getIndiaPostProvider().trackShipment({ articleNumber: req.params.articleNumber });
  await LogisticsShipment.findOneAndUpdate(
    { $or: [{ articleNumber: req.params.articleNumber }, { awbNumber: req.params.articleNumber }] },
    {
      trackingHistory: tracking.trackingHistory || [],
      shipmentStatus: tracking.status || "In Transit",
      indiaPostRequestRaw: tracking.rawRequest || {},
      indiaPostResponseRaw: tracking.rawResponse || {},
    }
  );
  res.json({ tracking, mode: process.env.INDIA_POST_MODE || "sandbox" });
};

export const indiaPostCancel = async (req, res) => {
  const shipment = await LogisticsShipment.findById(req.params.shipmentId).lean();
  const result = await getIndiaPostProvider().cancelShipment({ ...(shipment || {}), shipmentId: req.params.shipmentId });
  if (shipment?._id) {
    await LogisticsShipment.findByIdAndUpdate(shipment._id, {
      shipmentStatus: "Cancelled",
      indiaPostRequestRaw: result.rawRequest || {},
      indiaPostResponseRaw: result.rawResponse || {},
    });
  }
  res.json({ result, mode: process.env.INDIA_POST_MODE || "sandbox" });
};

export const indiaPostLabel = async (req, res) => {
  const shipment = await LogisticsShipment.findById(req.params.shipmentId).lean();
  const label = await getIndiaPostProvider().generateLabel({ ...(shipment || {}), shipmentId: req.params.shipmentId });
  if (shipment?._id) {
    await LogisticsShipment.findByIdAndUpdate(shipment._id, {
      labelUrl: label.labelUrl || shipment.labelUrl,
      shipmentStatus: "Label Generated",
      indiaPostRequestRaw: label.rawRequest || {},
      indiaPostResponseRaw: label.rawResponse || {},
    });
  }
  res.json({ labelUrl: label.labelUrl, label, mode: process.env.INDIA_POST_MODE || "sandbox" });
};

export const indiaPostEvents = async (req, res) => {
  const events = await getIndiaPostProvider().getEvents({ articleNumber: req.params.articleNumber });
  res.json({ events, mode: process.env.INDIA_POST_MODE || "sandbox" });
};

export const listEfruitMandiOrdersForAdmin = async (req, res) => {
  const orders = await Order.find().sort({ createdAt: -1 }).limit(80).lean();
  const efruitOrders = orders
    .filter((order) => (order.courierPartner || "").toLowerCase() === "efruitmandi" || order.paymentStatus === "ESCROW")
    .map((order) => ({ ...mapOrderToLogistics(order), platform: "efruitmandi" }));
  res.json({ orders: efruitOrders });
};

export const getEfruitMandiOrderForAdmin = async (req, res) => {
  const orderQuery = mongoose.isValidObjectId(req.params.orderId)
    ? { $or: [{ _id: req.params.orderId }, { invoiceNumber: req.params.orderId }] }
    : { invoiceNumber: req.params.orderId };
  const order = await Order.findOne(orderQuery).lean();
  if (!order) return res.status(404).json({ msg: "eFruitMandi order not found" });
  res.json({ order: { ...mapOrderToLogistics(order), platform: "efruitmandi" } });
};

export const createShipmentFromEfruitMandiOrder = async (req, res) => {
  const orderQuery = mongoose.isValidObjectId(req.params.orderId)
    ? { $or: [{ _id: req.params.orderId }, { invoiceNumber: req.params.orderId }] }
    : { invoiceNumber: req.params.orderId };
  const order = await Order.findOne(orderQuery).lean();
  if (!order) return res.status(404).json({ msg: "eFruitMandi order not found" });
  const payload = { ...mapOrderToLogistics(order), platform: "efruitmandi", ...(req.body || {}) };
  const shipment = await upsertShipment(payload, req, { shipmentStatus: "Draft", courierPartner: "india_post", selectedCourier: "India Post" });
  res.json({ shipment });
};
