import mongoose from "mongoose";

const emailDeliveryLogSchema = new mongoose.Schema(
  {
    category: { type: String, trim: true, maxlength: 80, default: "BUSINESS_MAIL", index: true },
    senderProfileKey: { type: String, trim: true, maxlength: 80, required: true, index: true },
    senderName: { type: String, trim: true, maxlength: 100, required: true },
    senderEmail: { type: String, trim: true, lowercase: true, maxlength: 320, required: true },
    replyTo: { type: String, trim: true, lowercase: true, maxlength: 320, default: "" },
    recipient: { type: String, trim: true, lowercase: true, maxlength: 320, required: true, index: true },
    subject: { type: String, trim: true, maxlength: 200, required: true },
    provider: { type: String, trim: true, maxlength: 40, required: true, index: true },
    providerMessageId: { type: String, trim: true, maxlength: 255, default: "" },
    status: {
      type: String,
      enum: ["REQUESTED", "PROCESSING", "SENT", "FAILED"],
      default: "REQUESTED",
      required: true,
      index: true,
    },
    requestedByAdmin: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null, index: true },
    requestedByAdminName: { type: String, trim: true, maxlength: 100, default: "" },
    requestedByAdminEmail: { type: String, trim: true, lowercase: true, maxlength: 320, default: "" },
    requestedByAdminRole: { type: String, trim: true, maxlength: 80, default: "" },
    failureCode: { type: String, trim: true, maxlength: 80, default: "" },
    failureMessage: { type: String, trim: true, maxlength: 500, default: "" },
    metadata: {
      source: { type: String, trim: true, maxlength: 80, default: "" },
      correlationId: { type: String, trim: true, maxlength: 128, default: "" },
    },
    idempotencyKeyHash: { type: String, select: false, maxlength: 64, default: undefined },
    sentAt: { type: Date, default: null },
    failedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

emailDeliveryLogSchema.index({ createdAt: -1 });
emailDeliveryLogSchema.index({ status: 1, createdAt: -1 });
emailDeliveryLogSchema.index({ providerMessageId: 1 }, { sparse: true });
emailDeliveryLogSchema.index({ requestedByAdmin: 1, createdAt: -1 });
emailDeliveryLogSchema.index({ senderProfileKey: 1, createdAt: -1 });
emailDeliveryLogSchema.index(
  { requestedByAdmin: 1, idempotencyKeyHash: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKeyHash: { $exists: true, $type: "string" } },
  }
);

export default mongoose.model("EmailDeliveryLog", emailDeliveryLogSchema);
