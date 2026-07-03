import mongoose from "mongoose";

const erpRefundSchema = new mongoose.Schema(
  {
    platform: {
      type: String,
      enum: ["efruitmandi", "orchardgrowers"],
      default: "efruitmandi",
      index: true,
    },
    sourceOrder: { type: mongoose.Schema.Types.ObjectId, ref: "Order", index: true },
    sourcePayment: { type: mongoose.Schema.Types.ObjectId, ref: "ErpPaymentTransaction", index: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    refundNumber: { type: String, trim: true, unique: true, sparse: true },
    amount: { type: Number, default: 0, min: 0 },
    currency: { type: String, trim: true, uppercase: true, default: "INR" },
    reason: { type: String, trim: true, default: "" },
    status: {
      type: String,
      enum: ["REQUESTED", "APPROVED", "PROCESSING", "REFUNDED", "FAILED", "REJECTED", "CANCELLED"],
      default: "REQUESTED",
      index: true,
    },
    provider: {
      type: String,
      enum: ["RAZORPAY_ROUTE", "BILLDESK", "CASHFREE", "MANUAL", "UNKNOWN"],
      default: "UNKNOWN",
    },
    gatewayRefundId: { type: String, trim: true, default: "", index: true },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    processedAt: Date,
    failureReason: { type: String, trim: true, default: "" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

erpRefundSchema.index({ status: 1, createdAt: -1 });
erpRefundSchema.index({ sourceOrder: 1 });
erpRefundSchema.index({ buyer: 1, createdAt: -1 });

export default mongoose.model("ErpRefund", erpRefundSchema);
