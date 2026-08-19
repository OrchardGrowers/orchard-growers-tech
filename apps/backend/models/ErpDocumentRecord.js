import mongoose from "mongoose";

const documentVersionSchema = new mongoose.Schema(
  {
    version: { type: Number, required: true },
    fileUrl: { type: String, trim: true, default: "" },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    generatedAt: { type: Date, default: Date.now },
    note: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const erpDocumentRecordSchema = new mongoose.Schema(
  {
    platform: {
      type: String,
      enum: ["efruitmandi", "orchardgrowers"],
      default: "efruitmandi",
      index: true,
    },
    documentType: {
      type: String,
      enum: [
        "DELIVERY_CHALLAN",
        "LOT_CHALLAN",
        "SALE_BILL",
        "SALES_INVOICE",
        "COMMISSION_INVOICE",
        "GROWER_COMMISSION_INVOICE",
        "BUYER_COMMISSION_INVOICE",
        "VERIFICATION_INVOICE",
        "SETTLEMENT_STATEMENT",
        "CREDIT_NOTE",
        "DEBIT_NOTE",
        "REFUND_DOCUMENT",
        "OTHER",
      ],
      required: true,
      index: true,
    },
    sourceType: {
      type: String,
      enum: ["LOT", "ORDER", "QUOTE", "VERIFICATION", "SETTLEMENT", "REFUND", "MANUAL"],
      required: true,
      index: true,
    },
    sourceOrder: { type: mongoose.Schema.Types.ObjectId, ref: "Order", index: true },
    sourceLot: { type: mongoose.Schema.Types.ObjectId, ref: "Product", index: true },
    sourceQuote: { type: mongoose.Schema.Types.ObjectId, ref: "Quotation", index: true },
    sourceVerification: { type: mongoose.Schema.Types.ObjectId, ref: "VerificationRequest", index: true },
    sourceSettlement: { type: mongoose.Schema.Types.ObjectId, ref: "ErpSettlement", index: true },
    documentNumber: { type: String, trim: true, required: true, index: true },
    version: { type: Number, default: 1, min: 1 },
    status: {
      type: String,
      enum: ["DRAFT", "GENERATED", "FINAL", "SENT", "CANCELLED", "VOID"],
      default: "GENERATED",
      index: true,
    },
    fileUrl: { type: String, trim: true, default: "" },
    issuedFrom: { type: String, trim: true, default: "Orchard Growers Private Limited" },
    issuedToUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    issuedToName: { type: String, trim: true, default: "" },
    recipientRole: {
      type: String,
      enum: ["GROWER", "BUYER", "BOTH", "ADMIN", ""],
      default: "",
      index: true,
    },
    grower: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    taxableAmount: { type: Number, default: 0, min: 0 },
    taxAmount: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, default: 0, min: 0 },
    currency: { type: String, trim: true, uppercase: true, default: "INR" },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    finalizedAt: Date,
    sentAt: Date,
    versions: { type: [documentVersionSchema], default: [] },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    snapshot: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

erpDocumentRecordSchema.index({ documentType: 1, createdAt: -1 });
erpDocumentRecordSchema.index({ sourceOrder: 1, documentType: 1 });
erpDocumentRecordSchema.index({ documentNumber: 1, version: 1 }, { unique: true });
erpDocumentRecordSchema.index(
  { sourceLot: 1, documentType: 1 },
  {
    unique: true,
    partialFilterExpression: {
      sourceLot: { $type: "objectId" },
      documentType: "LOT_CHALLAN",
    },
  }
);
erpDocumentRecordSchema.index(
  { sourceOrder: 1, documentType: 1, recipientRole: 1 },
  {
    unique: true,
    partialFilterExpression: { sourceOrder: { $type: "objectId" } },
  }
);

export default mongoose.model("ErpDocumentRecord", erpDocumentRecordSchema);
