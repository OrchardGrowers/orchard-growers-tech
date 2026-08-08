import mongoose from "mongoose";

const userNotificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, trim: true, default: "VERIFICATION_REMARK" },
    title: { type: String, trim: true, required: true, maxlength: 160 },
    message: { type: String, trim: true, required: true, maxlength: 2500 },
    section: { type: String, trim: true, lowercase: true, default: "" },
    status: { type: String, trim: true, uppercase: true, default: "" },
    entityId: { type: mongoose.Schema.Types.ObjectId, default: null },
    remark: { type: mongoose.Schema.Types.ObjectId, ref: "VerificationRemark", default: null },
    actionUrl: { type: String, trim: true, default: "/notifications" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    readAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

userNotificationSchema.index({ user: 1, readAt: 1, createdAt: -1 });

export default mongoose.model("UserNotification", userNotificationSchema);
