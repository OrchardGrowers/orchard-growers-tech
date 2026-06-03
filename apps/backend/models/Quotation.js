import mongoose from "mongoose";

const quotationGradeSchema = new mongoose.Schema(
  {
    grade: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 0 },
    price: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const quotationSchema = new mongoose.Schema(
  {
    lot: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    grower: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    grades: [quotationGradeSchema],
    distanceKm: { type: Number, default: 0, min: 0 },
    dealAmount: { type: Number, required: true, min: 0 },
    driverCharge: { type: Number, required: true, min: 0 },
    commissionBase: { type: Number, required: true, min: 0 },
    commissionPercent: { type: Number, required: true, min: 0 },
    commissionAmount: { type: Number, required: true, min: 0 },
    buyerPayable: { type: Number, required: true, min: 0 },
    sellerReceivable: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["SUBMITTED", "ACCEPTED", "REJECTED", "EXPIRED"],
      default: "SUBMITTED",
      index: true,
    },
  },
  { timestamps: true }
);

quotationSchema.index({ lot: 1, buyer: 1, createdAt: -1 });

export default mongoose.model("Quotation", quotationSchema);
