import { createMockProvider } from "./mockProvider.js";

// TODO: Add India Post parcel booking, label, manifest, and tracking APIs using INDIA_POST_API_TOKEN.
export default createMockProvider("India Post", { baseCost: 55, etaDays: 5, maxWeightKg: 35 });
