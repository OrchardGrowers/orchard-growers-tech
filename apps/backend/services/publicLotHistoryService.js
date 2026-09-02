import { createHash, createHmac } from "node:crypto";
import { isHistoricalLot, isOrderCompletedForMarketplace } from "./dealLifecycleService.js";

const cleanText = (value = "", maxLength = 200) =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

const cleanDate = (value) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

const PRIVATE_DESCRIPTION_PATTERN =
  /(\b(?:phone|mobile|whatsapp|contact|email|e-mail|pan|aadhaar|kyc|bank|account|ifsc|upi|address)\b|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(?:\+?91[\s-]?)?[6-9](?:[\s-]?\d){9})/i;

const cleanPublicDescription = (value = "") => {
  const description = cleanText(value, 2_000);
  return description && !PRIVATE_DESCRIPTION_PATTERN.test(description) ? description : undefined;
};

const cleanPublicMediaUrl = (value = "") => {
  const text = cleanText(value, 2_000).replace(/\\/g, "/");
  if (!text) return undefined;
  try {
    const parsed = new URL(text);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString() : undefined;
  } catch {
    return text.startsWith("/uploads/") ? text : undefined;
  }
};

const cleanNumber = (value) => {
  if (value === undefined || value === null || value === "") return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
};

const compact = (value) =>
  Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== ""));

const sanitizeImageObject = (value = {}) => {
  const url = cleanPublicMediaUrl(value?.url || value?.secure_url || value?.secureUrl || value?.path);
  if (!url) return null;
  return compact({
    url,
    alt: cleanText(value?.alt, 180),
    isPrimary: typeof value?.isPrimary === "boolean" ? value.isPrimary : undefined,
  });
};

const sanitizePackingBreakdown = (value = {}) => compact({
  size: cleanText(value?.size, 80),
  packageCount: cleanNumber(value?.packageCount),
  piecesPerPackage: cleanNumber(value?.piecesPerPackage),
  traysPerPackage: cleanNumber(value?.traysPerPackage),
  piecesPerTray: cleanNumber(value?.piecesPerTray),
  weightPerPackageKg: cleanNumber(value?.weightPerPackageKg),
  packageCapacityCode: cleanText(value?.packageCapacityCode, 80),
  packageTypeCode: cleanText(value?.packageTypeCode, 80),
  packageSizeCode: cleanText(value?.packageSizeCode, 80),
});

const sanitizePackingSummary = (value = {}) => compact({
  totalPackages: cleanNumber(value?.totalPackages),
  totalPieces: cleanNumber(value?.totalPieces),
  totalWeightKg: cleanNumber(value?.totalWeightKg),
  averageFruitWeightGrams: cleanNumber(value?.averageFruitWeightGrams),
});

const getPublicImages = (product = {}) => {
  const imageObjects = [
    ...(Array.isArray(product.imageObjects) ? product.imageObjects : []),
    ...(Array.isArray(product.gradeLots)
      ? product.gradeLots.flatMap((lot) => Array.isArray(lot?.imageObjects) ? lot.imageObjects : [])
      : []),
  ].map(sanitizeImageObject).filter(Boolean);
  const imageUrls = [
    ...(Array.isArray(product.images) ? product.images : []),
    ...(Array.isArray(product.gradeLots)
      ? product.gradeLots.flatMap((lot) => Array.isArray(lot?.images) ? lot.images : [])
      : []),
    ...imageObjects.map((image) => image.url),
  ].map(cleanPublicMediaUrl).filter(Boolean);
  const images = Array.from(new Set(imageUrls));
  const primaryObject = imageObjects.find((image) => image.isPrimary) || imageObjects[0];
  return { images, imageObjects, imageUrl: primaryObject?.url || images[0] };
};

const getPublicVideos = (product = {}) =>
  [cleanPublicMediaUrl(product.sampleVideo)].filter(Boolean);

const cleanPublicLocation = (value = "") => {
  const parts = cleanText(value, 240)
    .replace(/\b\d{4,}\b/g, "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !/\b(address|house|street|road|near|plot|flat|building|village|ward|pin|pincode|post office|exact)\b/i.test(part));
  return parts.slice(-3).join(", ");
};

export const getPublicHistoryKey = (product = {}) => {
  const internalId = String(product?._id || "");
  if (!internalId) return undefined;
  const secret = createHash("sha256")
    .update(String(process.env.PUBLIC_HISTORY_ID_SECRET || process.env.JWT_SECRET || "efruitmandi-public-history"))
    .digest();
  return `history_${createHmac("sha256", secret).update(internalId).digest("base64url").slice(0, 20)}`;
};

export const getPublicHistoryOutcome = ({ offerCount = 0, completedOrder = null } = {}) => {
  if (isOrderCompletedForMarketplace(completedOrder)) return "Deal Completed";
  return Number(offerCount || 0) > 0 ? "No Deal Confirmed" : "No Buyer Interested";
};

export const sanitizePublicHistoricalLot = (
  product = {},
  { offerCount = 0, completedOrder = null } = {}
) => {
  if (!isHistoricalLot(product, completedOrder)) return null;

  const normalizedOfferCount = Math.max(0, Number(offerCount || 0));
  const historyOutcome = getPublicHistoryOutcome({
    offerCount: normalizedOfferCount,
    completedOrder,
  });
  const finalLifecycleStatus = cleanText(
    historyOutcome === "Deal Completed" ? "COMPLETED" : product.status || "CLOSED",
    50
  ).toUpperCase();

  const { images, imageObjects, imageUrl } = getPublicImages(product);
  const videos = getPublicVideos(product);
  const grade = cleanText(
    product.quality ||
      (Array.isArray(product.gradeLots)
        ? product.gradeLots.map((lot) => lot?.grade).filter(Boolean).slice(0, 3).join(", ")
        : ""),
    160
  );
  const hasOrganicCertificateProof = Boolean(
    product.hasOrganicCertificateProof ||
      /\borganic\b/i.test(String(product.quality || ""))
  );

  return compact({
    publicHistoryKey: getPublicHistoryKey(product),
    title: cleanText(product.title || product.fruitName, 240),
    fruitName: cleanText(product.fruitName || product.title, 120),
    variety: cleanText(product.variety, 120),
    grade,
    quality: cleanText(product.quality || grade, 160),
    quantity: Number.isFinite(Number(product.quantity)) ? Number(product.quantity) : 0,
    unit: cleanText(product.unit || "boxes", 40),
    description: cleanPublicDescription(product.description),
    location: cleanPublicLocation(product.location),
    imageUrl,
    images,
    imageObjects,
    sampleVideo: videos[0],
    videos,
    gradeLots: Array.isArray(product.gradeLots)
      ? product.gradeLots.map((lot) => compact({
          grade: cleanText(lot?.grade, 80),
          boxes: cleanNumber(lot?.boxes),
          weightKg: cleanNumber(lot?.weightKg),
          images: Array.isArray(lot?.images) ? lot.images.map(cleanPublicMediaUrl).filter(Boolean) : [],
          imageObjects: Array.isArray(lot?.imageObjects)
            ? lot.imageObjects.map(sanitizeImageObject).filter(Boolean)
            : [],
        }))
      : [],
    packingType: cleanText(product.packingType, 100),
    packingWeightKg: cleanNumber(product.packingWeightKg),
    totalWeightKg: cleanNumber(product.totalWeightKg),
    packingBreakdown: Array.isArray(product.packingBreakdown)
      ? product.packingBreakdown.map(sanitizePackingBreakdown)
      : [],
    packingSummary: sanitizePackingSummary(product.packingSummary),
    hasOrganicCertificateProof,
    listingDate: cleanDate(product.createdAt),
    tradingDate: cleanDate(product.auctionEndTime || product.updatedAt || product.createdAt),
    closedAt: cleanDate(completedOrder?.updatedAt || product.updatedAt || product.auctionEndTime),
    finalLifecycleStatus,
    offerCount: normalizedOfferCount,
    historyOutcome,
    historical: true,
    readOnly: true,
    tradable: false,
  });
};

export const partitionPublicHistoricalLots = (
  products = [],
  { completedOrderByProductId = new Map(), offerCountByProductId = new Map(), now = new Date() } = {}
) => {
  const lotHistory = [];
  const closedDeals = [];
  const seen = new Set();

  for (const product of Array.isArray(products) ? products : []) {
    const productId = String(product?._id || "");
    const completedOrder = completedOrderByProductId.get(productId) || null;
    if (!isHistoricalLot(product, completedOrder, now)) continue;
    const record = sanitizePublicHistoricalLot(product, {
      completedOrder,
      offerCount: offerCountByProductId.get(productId) || 0,
    });
    if (!record?.publicHistoryKey || seen.has(record.publicHistoryKey)) continue;
    seen.add(record.publicHistoryKey);
    (isOrderCompletedForMarketplace(completedOrder) ? closedDeals : lotHistory).push(record);
  }

  return { lotHistory, closedDeals };
};
