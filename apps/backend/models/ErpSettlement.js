import mongoose from "mongoose";

const settlementEventSchema = new mongoose.Schema(
  {
    status: { type: String, trim: true, default: "" },
    note: { type: String, trim: true, default: "" },
    by: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    at: { type: Date, default: Date.now },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const erpSettlementSchema = new mongoose.Schema(
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
    settlementNumber: { type: String, trim: true, unique: true, sparse: true },
    beneficiaryType: {
      type: String,
      enum: ["GROWER", "LOGISTICS", "PLATFORM", "BUYER"],
      required: true,
      index: true,
    },
    beneficiaryUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    beneficiaryName: { type: String, trim: true, default: "" },
    grossAmount: { type: Number, default: 0, min: 0 },
    commissionAmount: { type: Number, default: 0, min: 0 },
    logisticsAmount: { type: Number, default: 0, min: 0 },
    taxAmount: { type: Number, default: 0, min: 0 },
    netAmount: { type: Number, default: 0, min: 0 },
    currency: { type: String, trim: true, uppercase: true, default: "INR" },
    status: {
      type: String,
      enum: ["PENDING", "ELIGIBLE", "PROCESSING", "SETTLED", "FAILED", "ON_HOLD", "CANCELLED"],
      default: "PENDING",
      index: true,
    },
    provider: {
      type: String,
      enum: ["RAZORPAY_ROUTE", "BILLDESK", "CASHFREE", "MANUAL", "UNKNOWN"],
      default: "UNKNOWN",
    },
    routeAccountId: { type: String, trim: true, default: "" },
    payoutId: { type: String, trim: true, default: "", index: true },
    settlementBatchId: { type: String, trim: true, default: "", index: true },
    scheduledFor: Date,
    settledAt: Date,
    failureReason: { type: String, trim: true, default: "" },
    events: { type: [settlementEventSchema], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  },
  { timestamps: true }
);

erpSettlementSchema.index({ status: 1, createdAt: -1 });
erpSettlementSchema.index({ sourceOrder: 1, beneficiaryType: 1 });
erpSettlementSchema.index({ beneficiaryUser: 1, status: 1 });

export default mongoose.model("ErpSettlement", erpSettlementSchema);
