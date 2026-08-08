import { isPublicLotVisible } from "./dealLifecycleService.js";

const ORCHARD_PLATFORMS = new Set(["orchard", "orchardgrowers", "orchard-growers"]);
const EFRUITMANDI_PLATFORMS = new Set(["efruitmandi", "efruit", "mandi"]);

export const isValidLotLookupId = (value) =>
  /^[a-f0-9]{24}$/i.test(String(value || ""));

export const isLotPlatformEligible = (product, platform = "") => {
  if (!product) return false;

  const normalizedPlatform = String(platform || "").trim().toLowerCase();
  const hasGradeLots = Array.isArray(product.gradeLots) && product.gradeLots.length > 0;

  if (ORCHARD_PLATFORMS.has(normalizedPlatform)) {
    return product.createdSource === "admin-panel" || !hasGradeLots;
  }
  if (EFRUITMANDI_PLATFORMS.has(normalizedPlatform)) {
    return product.createdSource !== "admin-panel";
  }
  return true;
};

export const isLotResourceEligible = (product, platform = "") =>
  Boolean(
    product &&
      product.inventoryType !== "raw_material" &&
      isLotPlatformEligible(product, platform)
  );

export const canAccessLotDetail = ({
  product,
  platform = "",
  completedOrder = null,
  now = new Date(),
  allowNonPublic = false,
} = {}) => {
  if (!isLotResourceEligible(product, platform)) return false;
  if (allowNonPublic) return true;
  return isPublicLotVisible(product, completedOrder, now);
};
