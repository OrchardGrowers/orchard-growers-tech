import { createMockProvider } from "./mockProvider.js";

// Manual provider keeps externally-booked AWB/tracking data inside the admin panel.
export default createMockProvider("Manual Other", { baseCost: 0, etaDays: 0, maxWeightKg: 999 });
