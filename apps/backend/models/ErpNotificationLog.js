import mongoose from "mongoose";

const erpNotificationLogSchema = new mongoose.Schema(
  {
    platform: {
      type: String,
      enum: ["efruitmandi", "orchardgrowers"],
      default: "efruitmandi",
      index: true,
    },
    channel: {
      type: String,
      enum: ["EMAIL", "SMS", "WHATSAPP", "PUSH", "SYSTEM"],
      required: true,
      index: true,
    },
    recipientUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    recipient: { type: String, trim: true, default: "" },
    templateKey: { type: String, trim: true, default: "", index: true },
    subject: { type: String, trim: true, default: "" },
    message: { type: String, trim: true, default: "" },
    status: {
      type: String,
      enum: ["QUEUED", "SENT", "FAILED", "SKIPPED"],
      default: "QUEUED",
      index: true,
    },
    provider: { type: String, trim: true, default: "" },
    providerMessageId: { type: String, trim: true, default: "" },
    sourceOrder: { type: mongoose.Schema.Types.ObjectId, ref: "Order", index: true },
    sourceQuote: { type: mongoose.Schema.Types.ObjectId, ref: "Quotation", index: true },
    sourceTicket: { type: mongoose.Schema.Types.ObjectId, ref: "ErpSupportTicket", index: true },
    sentAt: Date,
    failedAt: Date,
    failureReason: { type: String, trim: true, default: "" },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

erpNotificationLogSchema.index({ status: 1, createdAt: -1 });
erpNotificationLogSchema.index({ channel: 1, createdAt: -1 });
erpNotificationLogSchema.index({ recipientUser: 1, createdAt: -1 });

export default mongoose.model("ErpNotificationLog", erpNotificationLogSchema);
