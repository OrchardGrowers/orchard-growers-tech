import mongoose from "mongoose";

const quotationGradeSchema = new mongoose.Schema(
  {
    grade: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 0 },
    price: { type: Number, required: true, min: 0 },
    quotedRatePerUnit: { type: Number, default: 0, min: 0 },
    netSettlementRate: { type: Number, default: 0, min: 0 },
    netRate: { type: Number, default: 0, min: 0 },
    netAmount: { type: Number, default: 0, min: 0 },
    platformServiceFee: { type: Number, default: 0, min: 0 },
    logisticsCharge: { type: Number, default: 0, min: 0 },
    labourCharge: { type: Number, default: 0, min: 0 },
    buyerPayableThroughPlatform: { type: Number, default: 0, min: 0 },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const quotationSchema = new mongoose.Schema(
  {
    lot: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    grower: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    lotQuantity: { type: Number, default: 0, min: 0 },
    fruitType: { type: String, trim: true, default: "" },
    lotTitle: { type: String, trim: true, default: "" },
    buyerName: { type: String, trim: true, default: "" },
    buyerPhone: { type: String, trim: true, default: "" },
    growerName: { type: String, trim: true, default: "" },
    message: { type: String, trim: true, default: "" },
    grades: [quotationGradeSchema],
    distanceKm: { type: Number, default: 0, min: 0 },
    quotedPrice: { type: Number, default: 0, min: 0 },
    quotedTotalValue: { type: Number, default: 0, min: 0 },
    baseDealAmount: { type: Number, default: 0, min: 0 },
    dealAmount: { type: Number, required: true, min: 0 },
    driverCharge: { type: Number, required: true, min: 0 },
    logisticsAmount: { type: Number, default: 0, min: 0 },
    labourAmount: { type: Number, default: 0, min: 0 },
    labourChargePerUnit: { type: Number, default: 0, min: 0 },
    commissionBase: { type: Number, required: true, min: 0 },
    commissionPercent: { type: Number, required: true, min: 0 },
    commissionAmount: { type: Number, required: true, min: 0 },
    platformServiceFee: { type: Number, default: 0, min: 0 },
    totalCharges: { type: Number, default: 0, min: 0 },
    totalUnits: { type: Number, default: 0, min: 0 },
    chargePerUnit: { type: Number, default: 0, min: 0 },
    logisticsChargePerUnit: { type: Number, default: 0, min: 0 },
    buyerPayable: { type: Number, required: true, min: 0 },
    buyerPayableThroughPlatform: { type: Number, default: 0, min: 0 },
    sellerReceivable: { type: Number, required: true, min: 0 },
    growerReceivable: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "closed", "cancelled", "SUBMITTED", "ACCEPTED", "REJECTED", "EXPIRED"],
      default: "pending",
      index: true,
    },
    paymentDueAt: Date,
    acceptedAt: Date,
    rejectedAt: Date,
  },
  { timestamps: true }
);

quotationSchema.index({ lot: 1, buyer: 1, createdAt: -1 });
quotationSchema.index(
  { lot: 1, buyer: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ["pending", "SUBMITTED"] } },
  }
);

export default mongoose.model("Quotation", quotationSchema);
