import mongoose from "mongoose";

const erpLedgerEntrySchema = new mongoose.Schema(
  {
    platform: {
      type: String,
      enum: ["efruitmandi", "orchardgrowers"],
      default: "efruitmandi",
      index: true,
    },
    sourceType: {
      type: String,
      enum: ["ORDER", "QUOTE", "PAYMENT", "SETTLEMENT", "COMMISSION", "REFUND", "VERIFICATION", "MANUAL"],
      required: true,
      index: true,
    },
    sourceId: { type: mongoose.Schema.Types.ObjectId, index: true },
    sourceOrder: { type: mongoose.Schema.Types.ObjectId, ref: "Order", index: true },
    sourceQuote: { type: mongoose.Schema.Types.ObjectId, ref: "Quotation", index: true },
    journalNumber: { type: String, trim: true, index: true },
    accountCode: { type: String, trim: true, required: true, index: true },
    accountName: { type: String, trim: true, required: true },
    accountType: {
      type: String,
      enum: ["ASSET", "LIABILITY", "REVENUE", "EXPENSE", "EQUITY", "MEMO"],
      required: true,
      index: true,
    },
    partyType: {
      type: String,
      enum: ["BUYER", "GROWER", "LOGISTICS", "PLATFORM", "ADMIN", "NONE"],
      default: "NONE",
      index: true,
    },
    party: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    debit: { type: Number, default: 0, min: 0 },
    credit: { type: Number, default: 0, min: 0 },
    currency: { type: String, trim: true, uppercase: true, default: "INR" },
    postingDate: { type: Date, default: Date.now, index: true },
    status: {
      type: String,
      enum: ["DRAFT", "POSTED", "VOID"],
      default: "POSTED",
      index: true,
    },
    memo: { type: String, trim: true, default: "" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    voidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    voidedAt: Date,
  },
  { timestamps: true }
);

erpLedgerEntrySchema.index({ postingDate: -1, accountCode: 1 });
erpLedgerEntrySchema.index({ sourceType: 1, sourceId: 1 });
erpLedgerEntrySchema.index({ status: 1, postingDate: -1 });
erpLedgerEntrySchema.index({ sourceOrder: 1, sourceType: 1, accountCode: 1, partyType: 1 });

export default mongoose.model("ErpLedgerEntry", erpLedgerEntrySchema);
