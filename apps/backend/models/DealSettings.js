import mongoose from "mongoose";
import { COMMISSION_VERSION } from "../config/commission.js";

const driverChargeSlabSchema = new mongoose.Schema(
  {
    minKm: Number,
    maxKm: Number,
    amount: Number,
    perKm: Number,
  },
  { _id: false }
);

const dealSettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: "default",
      unique: true,
      index: true,
    },
    commissionPercent: {
      type: Number,
      default: 7,
      min: 0,
    },
    growerCommissionEnabled: { type: Boolean, default: false },
    buyerCommissionEnabled: { type: Boolean, default: true },
    growerCommissionPercent: { type: Number, default: 7, min: 0 },
    buyerCommissionPercent: { type: Number, default: 7, min: 0 },
    commissionVersion: { type: String, trim: true, default: COMMISSION_VERSION },
    labourAmount: {
      type: Number,
      default: 5,
      min: 0,
    },
    driverChargeSlabs: [driverChargeSlabSchema],
    gradeRateRules: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
  },
  { timestamps: true }
);

export default mongoose.model("DealSettings", dealSettingsSchema);
