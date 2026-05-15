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
  },
  { timestamps: true }
);

export default mongoose.model("Delivery", deliverySchema);