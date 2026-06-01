import { createMockProvider } from "./mockProvider.js";

const mock = createMockProvider("India Post", { baseCost: 55, etaDays: 5, maxWeightKg: 35 });
const truthy = (value = "") => ["1", "true", "yes"].includes(String(value).trim().toLowerCase());
const trimSlash = (value = "") => String(value || "").trim().replace(/\/+$/, "");
const mode = () => String(process.env.INDIA_POST_MODE || "sandbox").trim().toLowerCase();
const enabled = () => truthy(process.env.INDIA_POST_ENABLED);
const mockMode = () => truthy(process.env.LOGISTICS_MOCK_MODE);
const baseUrl = () => trimSlash(process.env.INDIA_POST_BASE_URL || "");
const canCallIndiaPost = () => enabled() && !mockMode() && Boolean(baseUrl()) && truthy(process.env.INDIA_POST_IP_WHITELISTED || "false");

const endpoint = (key, fallback) => {
  const configured = process.env[key];
  return configured ? `/${String(configured).replace(/^\/+/, "")}` : fallback;
};

const getHeaders = () => ({
  "Content-Type": "application/json",
  ...(process.env.INDIA_POST_CLIENT_ID ? { "X-Client-Id": process.env.INDIA_POST_CLIENT_ID } : {}),
  ...(process.env.INDIA_POST_CLIENT_SECRET ? { "X-Client-Secret": process.env.INDIA_POST_CLIENT_SECRET } : {}),
  ...(process.env.INDIA_POST_API_SUBSCRIPTION_KEY ? { "Ocp-Apim-Subscription-Key": process.env.INDIA_POST_API_SUBSCRIPTION_KEY } : {}),
});

const request = async ({ path, body, method = "POST" }) => {
  if (!canCallIndiaPost()) {
    return {
      mocked: true,
      reason: "India Post sandbox is disabled, base URL is missing, IP is not whitelisted, or LOGISTICS_MOCK_MODE=true.",
      mode: mode(),
    };
  }

  const url = `${baseUrl()}${path}`;
  const rawRequest = { url, method, headers: { ...getHeaders(), "X-Client-Secret": "[redacted]" }, body };
  try {
    const response = await fetch(url, {
      method,
      headers: getHeaders(),
      body: method === "GET" ? undefined : JSON.stringify(body || {}),
    });
    const rawResponse = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(rawResponse?.message || rawResponse?.msg || `India Post API failed with ${response.status}`);
      error.status = response.status;
      error.rawRequest = rawRequest;
      error.rawResponse = rawResponse;
      throw error;
    }
    return { rawRequest, rawResponse };
  } catch (err) {
    if (err.rawRequest) throw err;
    const error = new Error(err?.message || "India Post API request failed");
    error.rawRequest = rawRequest;
    error.rawResponse = { message: err?.message || "Network request failed" };
    throw error;
  }
};

const mapArticle = (raw = {}, fallback = "") =>
  raw.articleNumber || raw.articleNo || raw.awbNumber || raw.awb || raw.trackingNumber || raw.data?.articleNumber || fallback;

const mapTrackingUrl = (articleNumber = "") =>
  articleNumber ? `https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx?ArticleNo=${encodeURIComponent(articleNumber)}` : "";

const buildIndiaPostPayload = (payload = {}) => ({
  customerId: process.env.INDIA_POST_CUSTOMER_ID || "",
  contractId: process.env.INDIA_POST_CONTRACT_ID || "",
  pickupOfficeCode: process.env.INDIA_POST_PICKUP_OFFICE_CODE || "",
  pickupPincode: payload.pickupDetails?.pickupPincode || process.env.INDIA_POST_PICKUP_PINCODE || "",
  serviceType: payload.serviceType || payload.indiaPostServiceType || "Speed Post Parcel",
  orderId: payload.orderId,
  consignee: payload.customerDetails || {},
  pickup: payload.pickupDetails || {},
  package: payload.packageDetails || {},
  invoice: payload.invoiceDetails || {},
  plantDetails: payload.plantDetails || {},
  fruitLotDetails: payload.fruitLotDetails || {},
});

export const checkPincode = async (payload = {}) => {
  const body = {
    fromPincode: payload.pickupDetails?.pickupPincode || process.env.INDIA_POST_PICKUP_PINCODE || "",
    toPincode: payload.customerDetails?.pincode || "",
    serviceType: payload.serviceType || "Speed Post Parcel",
  };
  const result = await request({ path: endpoint("INDIA_POST_PINCODE_CHECK_PATH", "/pincode/check"), body });
  if (result.mocked) return mock.checkServiceability(payload);
  const serviceable = result.rawResponse?.serviceable ?? result.rawResponse?.data?.serviceable ?? true;
  return {
    courier: "India Post",
    serviceable: Boolean(serviceable),
    estimatedCost: Number(result.rawResponse?.estimatedCost || result.rawResponse?.tariff || 0),
    eta: result.rawResponse?.eta || result.rawResponse?.expectedDelivery || "",
    reason: serviceable ? "" : result.rawResponse?.reason || "India Post marked this route unavailable.",
    rawRequest: result.rawRequest,
    rawResponse: result.rawResponse,
  };
};

export const estimateTariff = async (payload = {}) => {
  const body = buildIndiaPostPayload(payload);
  const result = await request({ path: endpoint("INDIA_POST_TARIFF_PATH", "/tariff/estimate"), body });
  if (result.mocked) return mock.estimateRate(payload);
  return {
    courier: "India Post",
    serviceable: true,
    estimatedCost: Number(result.rawResponse?.tariff || result.rawResponse?.estimatedCost || result.rawResponse?.data?.amount || 0),
    eta: result.rawResponse?.eta || result.rawResponse?.data?.eta || "",
    reason: "",
    rawRequest: result.rawRequest,
    rawResponse: result.rawResponse,
  };
};

export const createArticleOrShipment = async (payload = {}) => {
  const body = buildIndiaPostPayload(payload);
  const result = await request({ path: endpoint("INDIA_POST_BOOK_PATH", "/articles/book"), body });
  if (result.mocked) return mock.bookShipment(payload);
  const articleNumber = mapArticle(result.rawResponse);
  return {
    courier: "India Post",
    articleNumber,
    awbNumber: articleNumber,
    trackingUrl: mapTrackingUrl(articleNumber),
    labelUrl: result.rawResponse?.labelUrl || "",
    manifestUrl: result.rawResponse?.manifestUrl || "",
    status: "Booked",
    rawRequest: result.rawRequest,
    rawResponse: result.rawResponse,
  };
};

export const bookShipment = createArticleOrShipment;

export const trackShipment = async (payload = {}) => {
  const articleNumber = payload.articleNumber || payload.awbNumber || payload.shipmentId || "";
  const result = await request({ path: endpoint("INDIA_POST_TRACK_PATH", `/track/${encodeURIComponent(articleNumber)}`), method: "GET" });
  if (result.mocked) return mock.trackShipment({ ...payload, awbNumber: articleNumber });
  return {
    articleNumber,
    awbNumber: articleNumber,
    status: result.rawResponse?.status || result.rawResponse?.data?.status || "In Transit",
    trackingHistory: result.rawResponse?.events || result.rawResponse?.data?.events || [],
    rawRequest: result.rawRequest,
    rawResponse: result.rawResponse,
  };
};

export const cancelShipment = async (payload = {}) => {
  const body = { articleNumber: payload.articleNumber || payload.awbNumber || payload.shipmentId || "", reason: payload.reason || "Admin cancellation" };
  const result = await request({ path: endpoint("INDIA_POST_CANCEL_PATH", "/articles/cancel"), body });
  if (result.mocked) return mock.cancelShipment(payload);
  return { status: "Cancelled", rawRequest: result.rawRequest, rawResponse: result.rawResponse };
};

export const generateLabel = async (payload = {}) => {
  const articleNumber = payload.articleNumber || payload.awbNumber || payload.shipmentId || "";
  const result = await request({ path: endpoint("INDIA_POST_LABEL_PATH", `/labels/${encodeURIComponent(articleNumber)}`), method: "GET" });
  if (result.mocked) return mock.generateLabel({ ...payload, awbNumber: articleNumber });
  return {
    articleNumber,
    awbNumber: articleNumber,
    labelUrl: result.rawResponse?.labelUrl || result.rawResponse?.data?.labelUrl || "",
    rawRequest: result.rawRequest,
    rawResponse: result.rawResponse,
  };
};

export const getEvents = async (payload = {}) => trackShipment(payload);

export default {
  checkPincode,
  estimateTariff,
  createArticleOrShipment,
  bookShipment,
  trackShipment,
  cancelShipment,
  generateLabel,
  getEvents,
  checkServiceability: checkPincode,
  estimateRate: estimateTariff,
};
