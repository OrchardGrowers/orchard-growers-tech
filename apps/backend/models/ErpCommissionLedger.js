import mongoose from "mongoose";

const erpCommissionLedgerSchema = new mongoose.Schema(
  {
    platform: {
      type: String,
      enum: ["efruitmandi", "orchardgrowers"],
      default: "efruitmandi",
      index: true,
    },
    sourceOrder: { type: mongoose.Schema.Types.ObjectId, ref: "Order", index: true },
    sourceQuote: { type: mongoose.Schema.Types.ObjectId, ref: "Quotation", index: true },
    lot: { type: mongoose.Schema.Types.ObjectId, ref: "Product", index: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    grower: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    commissionBase: { type: Number, default: 0, min: 0 },
    commissionPercent: { type: Number, default: 0, min: 0 },
    commissionAmount: { type: Number, default: 0, min: 0 },
    taxPercent: { type: Number, default: 0, min: 0 },
    taxAmount: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, default: 0, min: 0 },
    currency: { type: String, trim: true, uppercase: true, default: "INR" },
    status: {
      type: String,
      enum: ["ACCRUED", "INVOICED", "COLLECTED", "REFUNDED", "VOID"],
      default: "ACCRUED",
      index: true,
    },
    invoiceNumber: { type: String, trim: true, default: "", index: true },
    invoiceDate: Date,
    receiptNumber: { type: String, trim: true, default: "" },
    receiptDate: Date,
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  },
  { timestamps: true }
);

erpCommissionLedgerSchema.index({ status: 1, createdAt: -1 });
erpCommissionLedgerSchema.index({ sourceOrder: 1 });
erpCommissionLedgerSchema.index({ buyer: 1, grower: 1 });

export default mongoose.model("ErpCommissionLedger", erpCommissionLedgerSchema);
