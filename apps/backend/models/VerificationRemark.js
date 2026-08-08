import mongoose from "mongoose";

const verificationRemarkSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    section: { type: String, required: true, trim: true, lowercase: true },
    roleType: {
      type: String,
      enum: ["buyer", "grower", "driver", ""],
      default: "",
    },
    status: {
      type: String,
      enum: ["PENDING", "UNDER_REVIEW", "CHANGES_REQUIRED", "VERIFIED", "REJECTED"],
      required: true,
    },
    remark: { type: String, trim: true, default: "", maxlength: 2000 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
    createdByUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    source: { type: String, enum: ["ADMIN", "USER", "SYSTEM"], default: "ADMIN" },
    entityId: { type: mongoose.Schema.Types.ObjectId, default: null },
    actionUrl: { type: String, trim: true, default: "" },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

verificationRemarkSchema.index({ user: 1, section: 1, roleType: 1, createdAt: -1 });
verificationRemarkSchema.index({ user: 1, resolvedAt: 1, createdAt: -1 });

export default mongoose.model("VerificationRemark", verificationRemarkSchema);
