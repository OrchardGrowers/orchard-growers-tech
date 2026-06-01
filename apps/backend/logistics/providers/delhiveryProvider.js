import { createMockProvider } from "./mockProvider.js";

// TODO: Add Delhivery pickup-location, waybill/AWB, shipment creation, label, and tracking API calls using DELHIVERY_API_TOKEN.
export default createMockProvider("Delhivery", { baseCost: 92, etaDays: 3, maxWeightKg: 30 });
