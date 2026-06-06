import mongoose from "mongoose";

const verificationRequestSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    roleType: {
      type: String,
      enum: ["buyer", "grower", "driver"],
      default: "grower",
    },
    verificationType: {
      type: String,
      enum: ["kyc", "og_verified"],
      default: "og_verified",
    },
    orchardName: { type: String, trim: true, required: true },
    ownerName: { type: String, trim: true, required: true },
    location: { type: String, trim: true, required: true },
    phone: { type: String, trim: true, required: true },
    udyanCardFile: {
      path: String,
      originalName: String,
      mimetype: String,
    },
    orchardVideo: {
      path: String,
      originalName: String,
      mimetype: String,
    },
    youtubeVideoId: String,
    youtubeLink: { type: String, trim: true, default: "" },
    documents: { type: [mongoose.Schema.Types.Mixed], default: [] },
    adminRemarks: { type: String, trim: true, default: "" },
    fee: {
      baseAmount: { type: Number, default: 5000 },
      taxRate: { type: Number, default: 0.05 },
      taxAmount: { type: Number, default: 250 },
      totalAmount: { type: Number, default: 5250 },
      paid: { type: Boolean, default: true },
      paidAt: Date,
    },
    status: {
      type: String,
      enum: ["SUBMITTED", "APPROVED", "REJECTED", "DISAPPROVED", "HOLD", "SUSPENDED", "TERMINATED"],
      default: "SUBMITTED",
    },
    adminReviews: [
      {
        admin: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
        adminClass: {
          type: String,
          enum: ["CLASS1", "CLASS2", "SUPER"],
        },
        action: {
          type: String,
          enum: ["APPROVE", "REJECT", "DISAPPROVE", "HOLD", "SUSPEND", "TERMINATE"],
        },
        note: String,
        reviewedAt: { type: Date, default: Date.now },
      },
    ],
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    decidedAt: Date,
  },
  { timestamps: true }
);

verificationRequestSchema.index({ status: 1, createdAt: -1 });
verificationRequestSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model("VerificationRequest", verificationRequestSchema);
