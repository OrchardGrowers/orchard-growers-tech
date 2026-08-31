const PRIVATE_LOT_PRICE_KEYS = new Set(["basePrice", "reservePrice", "startingPrice"]);
const PRIVATE_PRICE_ADMIN_ROLES = new Set([
  "SUPER_ADMIN",
  "ADMIN",
  "UNIT_MANAGER",
  "INVENTORY_MANAGER",
  "SALES_EXECUTIVE",
  "PURCHASE_MANAGER",
  "FINANCE_MANAGER",
]);
const idText = (value) => String(value?._id || value?.id || value || "");

export const canViewPrivateLotPrice = (product = {}, viewer = {}) => {
  if (PRIVATE_PRICE_ADMIN_ROLES.has(String(viewer?.role || "").trim().toUpperCase())) return true;
  const viewerId = idText(viewer);
  const ownerId = idText(product?.createdBy);
  if (!viewerId || !ownerId || viewerId !== ownerId) return false;
  const profiles = new Set(
    (Array.isArray(viewer?.profileTypes) ? viewer.profileTypes : [])
      .map((profile) => String(profile).trim().toLowerCase())
  );
  if (viewer?.role) profiles.add(String(viewer.role).trim().toLowerCase());
  return profiles.has("grower");
};

const removePrivatePrices = (value, seen = new WeakSet()) => {
  if (!value || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item) => removePrivatePrices(item, seen));
    return value;
  }
  const startingPrice = Number(value.startingPrice);
  const currentBid = Number(value.currentBid);
  if (
    value.startingPrice !== undefined &&
    !value.highestBidder &&
    Number.isFinite(startingPrice) &&
    Number.isFinite(currentBid) &&
    currentBid === startingPrice
  ) {
    delete value.currentBid;
    if (Number(value.highestGradeRate) === startingPrice) delete value.highestGradeRate;
    delete value.dealBreakdown;
    delete value.sellerReceivable;
  }
  PRIVATE_LOT_PRICE_KEYS.forEach((key) => delete value[key]);
  Object.values(value).forEach((item) => removePrivatePrices(item, seen));
  return value;
};

export const sanitizeLotPricing = (
  payload,
  { product = payload?.product || payload, viewer = {} } = {}
) => {
  const source = payload?.toObject ? payload.toObject() : payload || {};
  const data = JSON.parse(JSON.stringify(source));
  // Admin-panel products are Orchard Growers retail inventory, where the
  // selling price is public. Grower/legacy marketplace Products are fruit lots.
  if (product?.createdSource === "admin-panel") return data;
  if (!canViewPrivateLotPrice(product, viewer)) removePrivatePrices(data);
  return data;
};
