import delhiveryProvider from "./providers/delhiveryProvider.js";
import indiaPostProvider from "./providers/indiaPostProvider.js";
import porterProvider from "./providers/porterProvider.js";
import manualProvider from "./providers/manualProvider.js";
import { createMockProvider } from "./providers/mockProvider.js";

export const COURIER_PARTNERS = [
  "India Post",
  "Delhivery",
  "Porter",
  "DTDC",
  "Blue Dart",
  "Xpressbees",
  "Shadowfax",
  "Ecom Express",
  "Shiprocket",
  "Manual Other",
];

const providers = {
  "India Post": indiaPostProvider,
  Delhivery: delhiveryProvider,
  Porter: porterProvider,
  "Manual Other": manualProvider,
  DTDC: createMockProvider("DTDC", { baseCost: 88, etaDays: 4, maxWeightKg: 40 }),
  "Blue Dart": createMockProvider("Blue Dart", { baseCost: 140, etaDays: 2, maxWeightKg: 25 }),
  Xpressbees: createMockProvider("Xpressbees", { baseCost: 84, etaDays: 4, maxWeightKg: 30 }),
  Shadowfax: createMockProvider("Shadowfax", { baseCost: 100, etaDays: 1, maxWeightKg: 20 }),
  "Ecom Express": createMockProvider("Ecom Express", { baseCost: 82, etaDays: 4, maxWeightKg: 30 }),
  Shiprocket: createMockProvider("Shiprocket", { baseCost: 95, etaDays: 4, maxWeightKg: 30 }),
};

export const getProvider = (courier = "") => providers[courier] || createMockProvider(courier || "Manual Other");
export const getIndiaPostProvider = () => indiaPostProvider;

export const checkAllServiceability = async (payload = {}) =>
  Promise.all(COURIER_PARTNERS.filter((partner) => partner !== "Manual Other").map((partner) => getProvider(partner).checkServiceability(payload)));

export const estimateAllRates = async (payload = {}) =>
  Promise.all(COURIER_PARTNERS.filter((partner) => partner !== "Manual Other").map((partner) => getProvider(partner).estimateRate(payload)));

export const selectCourier = (results = [], priority = "Cheapest") => {
  const serviceable = results.filter((item) => item.serviceable);
  if (!serviceable.length) return "";
  if (priority === "Fastest") return [...serviceable].sort((a, b) => Number(String(a.eta).match(/\d+/)?.[0] || 99) - Number(String(b.eta).match(/\d+/)?.[0] || 99))[0].courier;
  if (priority === "Best Rated") return serviceable.find((item) => ["Blue Dart", "Delhivery", "India Post"].includes(item.courier))?.courier || serviceable[0].courier;
  return [...serviceable].sort((a, b) => Number(a.estimatedCost || 0) - Number(b.estimatedCost || 0))[0].courier;
};

export const bookWithProvider = async (payload = {}) => getProvider(payload.selectedCourier).bookShipment(payload);
export const trackWithProvider = async (payload = {}) => getProvider(payload.selectedCourier).trackShipment(payload);
export const cancelWithProvider = async (payload = {}) => getProvider(payload.selectedCourier).cancelShipment(payload);
export const generateLabelWithProvider = async (payload = {}) => getProvider(payload.selectedCourier).generateLabel(payload);
