import mongoose from "mongoose";

const captureMediaSchema = new mongoose.Schema(
  {
    url: { type: String, trim: true, default: "" },
    secure_url: { type: String, trim: true, default: "" },
    publicId: { type: String, trim: true, default: "" },
    folder: { type: String, trim: true, default: "" },
    resourceType: { type: String, trim: true, default: "" },
    mimeType: { type: String, trim: true, default: "" },
    originalName: { type: String, trim: true, default: "" },
    size: { type: Number, default: 0 },
    uploadedAt: Date,
  },
  { _id: false }
);

const captureSessionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    mediaType: {
      type: String,
      enum: ["image", "video"],
      required: true,
    },
    gradeKey: { type: String, trim: true, default: "" },
    slotIndex: { type: Number, default: null },
    status: {
      type: String,
      enum: ["pending", "uploaded", "attached"],
      default: "pending",
      index: true,
    },
    media: captureMediaSchema,
    expiresAt: { type: Date, required: true, index: true },
    attachedProduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },
  },
  { timestamps: true }
);

captureSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("CaptureSession", captureSessionSchema);
