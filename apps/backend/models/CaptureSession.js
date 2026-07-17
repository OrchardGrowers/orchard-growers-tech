import mongoose from "mongoose";
import { INSPECTION_STATUS_VALUES } from "../utils/inspectionState.js";

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

const scanMetadataSchema = new mongoose.Schema(
  {
    scanId: { type: String, required: true, trim: true },
    captureSessionId: { type: String, required: true, trim: true },
    fruitLotId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null },
    fruitType: { type: String, trim: true, default: "" },
    fruitVariety: { type: String, trim: true, default: "" },
    growerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    scanMode: { type: String, trim: true, default: "" },
    captureSource: { type: String, enum: ["MANUAL", "AUTO"], default: "MANUAL" },
    captureNumber: { type: Number, min: 1, required: true },
    capturedAt: Date,
    uploadedAt: Date,
    processingStatus: { type: String, trim: true, default: "NOT_STARTED" },
    status: { type: String, trim: true, default: "UPLOADED" },
    inspectionStatus: { type: String, enum: INSPECTION_STATUS_VALUES, default: undefined },
    inspectionStartedAt: { type: Date, default: undefined },
    inspectionCompletedAt: { type: Date, default: undefined },
    inspectionVersion: { type: String, trim: true, default: undefined },
    retryCount: { type: Number, min: 0, default: undefined },
    failureReason: { type: String, trim: true, default: undefined },
    device: {
      deviceModel: { type: String, trim: true, default: "" },
      browser: { type: String, trim: true, default: "" },
      platform: { type: String, trim: true, default: "" },
      cameraFacing: { type: String, trim: true, default: "" },
      cameraResolution: {
        width: { type: Number, default: null },
        height: { type: Number, default: null },
      },
      orientation: { type: String, trim: true, default: "" },
      networkType: { type: String, trim: true, default: "" },
      gpsAccuracy: { type: Number, default: null },
      timezone: { type: String, trim: true, default: "" },
    },
    image: {
      imageWidth: { type: Number, default: null },
      imageHeight: { type: Number, default: null },
      mimeType: { type: String, trim: true, default: "" },
      fileSize: { type: Number, default: 0 },
      cloudinaryPublicId: { type: String, trim: true, default: "" },
      imageUrl: { type: String, trim: true, default: "" },
      thumbnailUrl: { type: String, trim: true, default: "" },
      hash: { type: String, trim: true, default: "" },
    },
    qualitySnapshot: {
      brightnessScore: { type: Number, default: null },
      contrastScore: { type: Number, default: null },
      sharpnessScore: { type: Number, default: null },
      motionScore: { type: Number, default: null },
      stabilityScore: { type: Number, default: null },
      overallQuality: { type: Number, default: null },
      readinessState: { type: String, trim: true, default: "" },
    },
    aiStatus: { type: String, default: null },
    aiVersion: { type: String, default: null },
    inspectionId: { type: mongoose.Schema.Types.ObjectId, default: null },
    confidence: { type: Number, default: null },
    recommendationVersion: { type: String, default: null },
    manualCorrection: { type: mongoose.Schema.Types.Mixed, default: null },
    buyerFeedback: { type: mongoose.Schema.Types.Mixed, default: null },
    growerFeedback: { type: mongoose.Schema.Types.Mixed, default: null },
    adminFeedback: { type: mongoose.Schema.Types.Mixed, default: null },
    finalAcceptedGrade: { type: String, default: null },
    verificationStatus: { type: String, default: null },
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
    fruitType: { type: String, trim: true, default: "" },
    fruitVariety: { type: String, trim: true, default: "" },
    status: {
      type: String,
      enum: ["pending", "uploaded", "attached"],
      default: "pending",
      index: true,
    },
    media: captureMediaSchema,
    // Legacy temporary snapshots; new authoritative records are stored in ScanRecord.
    scans: { type: [scanMetadataSchema], default: [] },
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
