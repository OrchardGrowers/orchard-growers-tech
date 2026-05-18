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
  status: {
    type: String,
    enum: ["ACTIVE", "TERMINATED"],
    default: "ACTIVE",
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  terminatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  terminatedAt: Date,
}, { timestamps: true });

export default mongoose.model("Admin", adminSchema);
