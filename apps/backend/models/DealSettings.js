import mongoose from "mongoose";

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
      default: 5,
      min: 0,
    },
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
