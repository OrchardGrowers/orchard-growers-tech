import mongoose from "mongoose";

const mandiRateSchema = new mongoose.Schema(
  {
    state: { type: String, required: true, trim: true, index: true },
    district: { type: String, required: true, trim: true, index: true },
    market: { type: String, required: true, trim: true, index: true },
    commodity: { type: String, required: true, trim: true, index: true },
    variety: { type: String, trim: true, default: "" },
    grade: { type: String, trim: true, default: "" },
    arrivalDate: { type: Date, required: true, index: true },
    minPrice: { type: Number, default: null },
    maxPrice: { type: Number, default: null },
    modalPrice: { type: Number, default: null },
    minPriceKg: { type: Number, default: null },
    maxPriceKg: { type: Number, default: null },
    modalPriceKg: { type: Number, default: null },
    unit: { type: String, default: "INR/quintal", trim: true },
    source: { type: String, default: "data.gov.in-agmarknet", trim: true },
    syncedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

mandiRateSchema.index(
  {
    state: 1,
    district: 1,
    market: 1,
    commodity: 1,
    variety: 1,
    grade: 1,
    arrivalDate: 1,
  },
  { unique: true }
);

export default mongoose.model("MandiRate", mandiRateSchema);
