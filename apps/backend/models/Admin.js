import mongoose from "mongoose";

const adminSchema = new mongoose.Schema({
  name: String,
  email: {
    type: String,
    unique: true,
    sparse: true,
    lowercase: true,
    trim: true,
  },
  phone: {
    type: String,
    trim: true,
  },
  password: String,
  resetPasswordTokenHash: {
    type: String,
    select: false,
  },
  resetPasswordExpiresAt: {
    type: Date,
    select: false,
  },
  resetPasswordRequestedAt: Date,
  passwordChangedAt: Date,
  hasPassword: {
    type: Boolean,
    default: false,
  },
  mustSetPassword: {
    type: Boolean,
    default: false,
  },
  firstLoginCompleted: {
    type: Boolean,
    default: false,
  },
  canManageClassIII: {
    type: Boolean,
    default: false,
  },
  role: {
    type: String,
    enum: [
      "SUPER_ADMIN",
      "ADMIN",
      "UNIT_MANAGER",
      "INVENTORY_MANAGER",
      "SALES_EXECUTIVE",
      "PURCHASE_MANAGER",
      "FINANCE_MANAGER",
      "VERIFICATION_OFFICER",
      "SUPPORT_EXECUTIVE",
      "VIEWER",
      "EMPLOYEE",
    ],
    default: "EMPLOYEE",
  },
  adminClass: {
    type: String,
    enum: ["CLASS_I", "CLASS_II", "CLASS_III"],
  },
  status: {
    type: String,
    enum: ["PENDING", "ACTIVE", "SUSPENDED", "REJECTED", "TERMINATED"],
    default: "ACTIVE",
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  approvedAt: Date,
  rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  rejectedAt: Date,
  suspendedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  suspendedAt: Date,
  classChangedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  classChangedAt: Date,
  resetPasswordBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  resetPasswordAt: Date,
  auditLogs: [
    {
      action: String,
      by: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
      at: { type: Date, default: Date.now },
      from: mongoose.Schema.Types.Mixed,
      to: mongoose.Schema.Types.Mixed,
      note: String,
    },
  ],
  terminatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  terminatedAt: Date,
}, { timestamps: true });

export default mongoose.model("Admin", adminSchema);
