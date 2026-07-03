import mongoose from "mongoose";

const ticketMessageSchema = new mongoose.Schema(
  {
    authorAdmin: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    authorUser: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    message: { type: String, trim: true, required: true },
    attachments: { type: [mongoose.Schema.Types.Mixed], default: [] },
    isInternal: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const erpSupportTicketSchema = new mongoose.Schema(
  {
    platform: {
      type: String,
      enum: ["efruitmandi", "orchardgrowers"],
      default: "efruitmandi",
      index: true,
    },
    ticketNumber: { type: String, trim: true, required: true, unique: true, index: true },
    type: {
      type: String,
      enum: ["TICKET", "COMPLAINT", "DISPUTE", "ESCALATION"],
      default: "TICKET",
      index: true,
    },
    subject: { type: String, trim: true, required: true },
    status: {
      type: String,
      enum: ["OPEN", "IN_PROGRESS", "WAITING_ON_USER", "RESOLVED", "CLOSED", "CANCELLED"],
      default: "OPEN",
      index: true,
    },
    priority: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "URGENT"],
      default: "MEDIUM",
      index: true,
    },
    openedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", index: true },
    relatedOrder: { type: mongoose.Schema.Types.ObjectId, ref: "Order", index: true },
    relatedQuote: { type: mongoose.Schema.Types.ObjectId, ref: "Quotation", index: true },
    relatedLot: { type: mongoose.Schema.Types.ObjectId, ref: "Product", index: true },
    relatedVerification: { type: mongoose.Schema.Types.ObjectId, ref: "VerificationRequest", index: true },
    messages: { type: [ticketMessageSchema], default: [] },
    resolutionSummary: { type: String, trim: true, default: "" },
    resolvedAt: Date,
    closedAt: Date,
  },
  { timestamps: true }
);

erpSupportTicketSchema.index({ status: 1, priority: 1, createdAt: -1 });
erpSupportTicketSchema.index({ assignedTo: 1, status: 1 });

export default mongoose.model("ErpSupportTicket", erpSupportTicketSchema);
