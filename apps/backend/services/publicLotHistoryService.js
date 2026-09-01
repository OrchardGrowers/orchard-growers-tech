import { createHash, createHmac } from "node:crypto";
import { isHistoricalLot, isOrderCompletedForMarketplace } from "./dealLifecycleService.js";

const cleanText = (value = "", maxLength = 200) =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

const cleanDate = (value) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

const cleanPublicLocation = (value = "") => {
  const parts = cleanText(value, 240)
    .replace(/\b\d{4,}\b/g, "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !/\b(address|house|street|road|near|plot|flat|building|village|ward|pin|pincode|post office|exact)\b/i.test(part));
  return parts.slice(-3).join(", ");
};

const getHistoryKey = (product = {}) => {
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

  return Object.fromEntries(Object.entries({
    publicHistoryKey: getHistoryKey(product),
    fruitName: cleanText(product.fruitName || product.title, 120),
    variety: cleanText(product.variety, 120),
    quantity: Number.isFinite(Number(product.quantity)) ? Number(product.quantity) : 0,
    unit: cleanText(product.unit || "boxes", 40),
    location: cleanPublicLocation(product.location),
    listingDate: cleanDate(product.createdAt),
    tradingDate: cleanDate(product.auctionEndTime || product.updatedAt || product.createdAt),
    closedAt: cleanDate(completedOrder?.updatedAt || product.updatedAt || product.auctionEndTime),
    finalLifecycleStatus,
    offerCount: normalizedOfferCount,
    historyOutcome,
    historical: true,
    readOnly: true,
    tradable: false,
  }).filter(([, value]) => value !== undefined && value !== ""));
};
