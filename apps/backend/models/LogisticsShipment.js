import mongoose from "mongoose";

const logisticsShipmentSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true, index: true },
    platform: { type: String, enum: ["orchardgrowers", "efruitmandi"], required: true, index: true },
    customerDetails: { type: mongoose.Schema.Types.Mixed, default: {} },
    pickupDetails: { type: mongoose.Schema.Types.Mixed, default: {} },
    packageDetails: { type: mongoose.Schema.Types.Mixed, default: {} },
    plantDetails: { type: mongoose.Schema.Types.Mixed, default: {} },
    fruitLotDetails: { type: mongoose.Schema.Types.Mixed, default: {} },
    invoiceDetails: { type: mongoose.Schema.Types.Mixed, default: {} },
    selectedCourier: { type: String, default: "" },
    courierMode: { type: String, enum: ["manual", "automatic"], default: "manual" },
    courierPriority: { type: String, enum: ["Cheapest", "Fastest", "Best Rated", "Manual"], default: "Manual" },
    serviceabilityResults: { type: [mongoose.Schema.Types.Mixed], default: [] },
    rateResults: { type: [mongoose.Schema.Types.Mixed], default: [] },
    awbNumber: { type: String, default: "" },
    trackingUrl: { type: String, default: "" },
    labelUrl: { type: String, default: "" },
    invoiceUrl: { type: String, default: "" },
    manifestUrl: { type: String, default: "" },
    shipmentStatus: {
      type: String,
      enum: ["Draft", "Serviceability Checked", "Rate Estimated", "Booked", "Label Generated", "Picked Up", "In Transit", "Delivered", "Cancelled", "Failed"],
      default: "Draft",
      index: true,
    },
    bookingResponseRaw: { type: mongoose.Schema.Types.Mixed, default: {} },
    trackingHistory: { type: [mongoose.Schema.Types.Mixed], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  },
  { timestamps: true }
);

export default mongoose.model("LogisticsShipment", logisticsShipmentSchema);
