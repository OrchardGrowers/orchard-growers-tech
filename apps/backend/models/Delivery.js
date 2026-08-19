import mongoose from "mongoose";

const deliverySchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    driver: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    deliveryOTP: { type: String },
    settlementOTP: { type: String },

    status: {
      type: String,
      enum: ["PENDING", "IN_TRANSIT", "DELIVERED", "COMPLETED"],
      default: "PENDING",
    },

    // optional negotiation fields
    negotiatedAmount: { type: Number },
    isNegotiated: { type: Boolean, default: false },
    finalQuantity: { type: Number, min: 0 },
    finalWeightKg: { type: Number, min: 0 },
    finalRate: { type: Number, min: 0 },
    driverPayment: { type: Number, default: 0 },
    platformCommission: { type: Number, default: 0 },
    growerPayout: { type: Number, default: 0 },
    lastLocation: {
      lat: Number,
      lng: Number,
      accuracy: Number,
      stationName: { type: String, trim: true, default: "" },
      status: { type: String, trim: true, default: "" },
      source: { type: String, enum: ["MANUAL", "AUTO"], default: "MANUAL" },
      updatedAt: Date,
    },
    locationHistory: [
      {
        lat: Number,
        lng: Number,
        accuracy: Number,
        stationName: { type: String, trim: true, default: "" },
        status: { type: String, trim: true, default: "" },
        source: { type: String, enum: ["MANUAL", "AUTO"], default: "MANUAL" },
        updatedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model("Delivery", deliverySchema);
