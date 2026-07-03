import mongoose from "mongoose";

const paymentEventSchema = new mongoose.Schema(
  {
    status: { type: String, trim: true, default: "" },
    message: { type: String, trim: true, default: "" },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    receivedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const erpPaymentTransactionSchema = new mongoose.Schema(
  {
    platform: {
      type: String,
      enum: ["efruitmandi", "orchardgrowers"],
      default: "efruitmandi",
      index: true,
    },
    paymentType: {
      type: String,
      enum: [
        "BUYER_COLLECTION",
        "REFUND",
        "VERIFICATION_FEE",
        "SUBSCRIPTION",
        "ADVERTISEMENT",
        "PREMIUM_SERVICE",
      ],
      default: "BUYER_COLLECTION",
      index: true,
    },
    sourceOrder: { type: mongoose.Schema.Types.ObjectId, ref: "Order", index: true },
    sourceQuote: { type: mongoose.Schema.Types.ObjectId, ref: "Quotation", index: true },
    lot: { type: mongoose.Schema.Types.ObjectId, ref: "Product", index: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    grower: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    transactionNumber: { type: String, trim: true, unique: true, sparse: true },
    provider: {
      type: String,
      enum: ["RAZORPAY_ROUTE", "BILLDESK", "CASHFREE", "MANUAL", "TEST", "UNKNOWN"],
      default: "UNKNOWN",
      index: true,
    },
    gatewayOrderId: { type: String, trim: true, default: "", index: true },
    gatewayPaymentId: { type: String, trim: true, default: "", index: true },
    gatewaySettlementId: { type: String, trim: true, default: "" },
    gatewaySignature: { type: String, trim: true, default: "", select: false },
    amount: { type: Number, default: 0, min: 0 },
    currency: { type: String, trim: true, uppercase: true, default: "INR" },
    status: {
      type: String,
      enum: [
        "INITIATED",
        "PENDING",
        "SUCCESS",
        "FAILED",
        "CANCELLED",
        "REFUNDED",
        "ESCROW_HELD",
        "RELEASED",
      ],
      default: "PENDING",
      index: true,
    },
    escrowStatus: { type: String, trim: true, default: "", index: true },
    paidAt: Date,
    failedAt: Date,
    failureReason: { type: String, trim: true, default: "" },
    rawPayload: { type: mongoose.Schema.Types.Mixed, default: {} },
    eventHistory: { type: [paymentEventSchema], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  },
  { timestamps: true }
);

erpPaymentTransactionSchema.index({ status: 1, createdAt: -1 });
erpPaymentTransactionSchema.index({ provider: 1, gatewayOrderId: 1 });
erpPaymentTransactionSchema.index({ paymentType: 1, createdAt: -1 });
erpPaymentTransactionSchema.index({ sourceOrder: 1, paymentType: 1 });

export default mongoose.model("ErpPaymentTransaction", erpPaymentTransactionSchema);
