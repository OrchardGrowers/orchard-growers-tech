import { createMockProvider } from "./mockProvider.js";

// TODO: Add Porter local pickup/drop, vehicle selection, goods type, and live tracking APIs using PORTER_API_TOKEN.
export default createMockProvider("Porter", { baseCost: 120, etaDays: 1, maxWeightKg: 100 });
