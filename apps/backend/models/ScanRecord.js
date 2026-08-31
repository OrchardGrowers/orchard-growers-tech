import mongoose from "mongoose";
import { INSPECTION_STATUS_VALUES } from "../utils/inspectionState.js";
import { VERIFICATION_STATUS_VALUES } from "../utils/verificationState.js";

const optionalText = (maxLength) => ({
  type: String,
  trim: true,
  maxlength: maxLength,
  default: undefined,
});

const optionalNumber = (min = undefined, max = undefined) => ({
  type: Number,
  min,
  max,
  default: undefined,
});

const verificationRecordSchema = new mongoose.Schema(
  {
    timestamp: { type: Date, default: null },
    notes: { type: String, trim: true, maxlength: 1000, default: null },
    reviewVersion: { type: String, trim: true, maxlength: 100, default: null },
  },
  { _id: false }
);

const originalMetadataSchema = new mongoose.Schema(
  {
    format: optionalText(30),
    width: optionalNumber(1),
    height: optionalNumber(1),
    orientation: optionalNumber(1),
    space: optionalText(30),
    channels: optionalNumber(1),
    byteSize: optionalNumber(0),
  },
  { _id: false }
);

const processedMetadataSchema = new mongoose.Schema(
  {
    format: optionalText(30),
    width: optionalNumber(1),
    height: optionalNumber(1),
    orientation: optionalNumber(1),
    space: optionalText(30),
    channels: optionalNumber(1),
    byteSize: optionalNumber(0),
    maxWidth: optionalNumber(1),
    maxHeight: optionalNumber(1),
    quality: optionalNumber(1, 100),
  },
  { _id: false }
);

const processedImageSchema = new mongoose.Schema(
  {
    secureUrl: optionalText(2000),
    cloudinaryPublicId: {
      type: String,
      trim: true,
      default: undefined,
      select: false,
    },
    cloudinaryFolder: {
      type: String,
      trim: true,
      default: undefined,
      select: false,
    },
    resourceType: optionalText(30),
    mimeType: optionalText(100),
    originalName: optionalText(255),
    fileSizeBytes: optionalNumber(0),
    imageWidth: optionalNumber(1, 20000),
    imageHeight: optionalNumber(1, 20000),
    thumbnailUrl: optionalText(2000),
    uploadedAt: { type: Date, default: undefined },
    processingVersion: optionalText(100),
    processingSteps: { type: [String], default: undefined },
    processingDurationMs: optionalNumber(0),
    originalChecksum: {
      type: String,
      trim: true,
      maxlength: 128,
      default: undefined,
      select: false,
    },
    processedChecksum: {
      type: String,
      trim: true,
      maxlength: 128,
      default: undefined,
      select: false,
    },
    originalMetadata: {
      type: originalMetadataSchema,
      default: undefined,
    },
    processedMetadata: {
      type: processedMetadataSchema,
      default: undefined,
    },
  },
  { _id: false }
);

const scanRecordSchema = new mongoose.Schema(
  {
    scanId: { type: String, required: true, unique: true, index: true, maxlength: 128 },
    captureSessionId: { type: String, required: true, index: true, maxlength: 128 },
    growerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    fruitLotId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null, index: true },
    receivingOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
      index: true,
    },
    fruitType: optionalText(100),
    fruitVariety: optionalText(100),
    scanPurpose: {
      type: String,
      enum: ["GROWER_LOT_SCAN", "BUYER_RECEIVING_SCAN"],
      default: undefined,
      index: true,
    },
    capturedAt: { type: Date, required: true },
    uploadedAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ["UPLOADED", "ATTACHED", "SUPERSEDED"],
      default: "UPLOADED",
      required: true,
      index: true,
    },
    supersededAt: { type: Date, default: null },
    captureSource: { type: String, enum: ["MANUAL", "AUTO"], required: true },
    scanMode: {
      type: String,
      enum: ["SINGLE_FRUIT", "FRUIT_GROUP", "TRAY_PACKED", "PACKAGE_VIEW", "UNKNOWN"],
      default: "UNKNOWN",
    },
    image: {
      secureUrl: { type: String, required: true, trim: true },
      cloudinaryPublicId: { type: String, required: true, trim: true, select: false },
      cloudinaryFolder: { type: String, trim: true, default: undefined, select: false },
      resourceType: optionalText(30),
      mimeType: { type: String, required: true, trim: true, maxlength: 100 },
      originalName: optionalText(255),
      fileSizeBytes: { type: Number, required: true, min: 0 },
      imageWidth: optionalNumber(1, 20000),
      imageHeight: optionalNumber(1, 20000),
      thumbnailUrl: optionalText(2000),
      contentHash: { type: String, trim: true, maxlength: 128, select: false },
      uploadedAt: { type: Date, required: true },
      processed: { type: processedImageSchema, default: undefined },
    },
    deviceMetadata: {
      platform: optionalText(100),
      browser: optionalText(100),
      userAgentFamily: optionalText(50),
      cameraFacing: optionalText(30),
      cameraWidth: optionalNumber(1, 20000),
      cameraHeight: optionalNumber(1, 20000),
      orientation: optionalText(50),
      timezone: optionalText(100),
      networkType: optionalText(30),
    },
    frameQuality: {
      brightnessScore: optionalNumber(0, 100),
      contrastScore: optionalNumber(0, 100),
      sharpnessScore: optionalNumber(0, 100),
      motionScore: optionalNumber(0, 100),
      stabilityScore: optionalNumber(0, 100),
      overallScore: optionalNumber(0, 100),
      readinessState: optionalText(50),
      guideLockState: optionalText(30),
      evaluatedAt: { type: Date, default: undefined },
    },
    subjectPlacement: {
      presenceState: optionalText(50),
      presenceScore: optionalNumber(0, 100),
      foregroundCoverage: optionalNumber(0, 1),
      centroidXRatio: optionalNumber(0, 1),
      centroidYRatio: optionalNumber(0, 1),
      borderContact: optionalNumber(0, 1),
      sizeState: optionalText(50),
      alignmentState: optionalText(50),
      guidance: optionalText(256),
      evaluatedAt: { type: Date, default: undefined },
    },
    guideMetadata: {
      guideVersion: optionalText(30),
      scanMode: optionalText(30),
      xRatio: optionalNumber(0, 1),
      yRatio: optionalNumber(0, 1),
      widthRatio: optionalNumber(0, 1),
      heightRatio: optionalNumber(0, 1),
      sourceX: optionalNumber(0, 100000),
      sourceY: optionalNumber(0, 100000),
      sourceWidth: optionalNumber(0, 100000),
      sourceHeight: optionalNumber(0, 100000),
    },
    inspection: {
      status: { type: String, enum: INSPECTION_STATUS_VALUES, default: "WAITING" },
      version: { type: String, default: null },
      queuedAt: { type: Date, default: null },
      startedAt: { type: Date, default: null },
      completedAt: { type: Date, default: null },
      retryCount: { type: Number, min: 0, default: 0 },
      failureReason: { type: String, trim: true, maxlength: 500, default: null, select: false },
    },
    analysis: {
      status: {
        type: String,
        enum: ["PENDING", "PROCESSING", "COMPLETED", "FAILED", "REVIEW_REQUIRED"],
        default: "PENDING",
        index: true,
      },
      grade: optionalText(100),
      analysisVersion: optionalText(100),
      modelProvider: optionalText(100),
      modelVersion: optionalText(100),
      analyzedAt: { type: Date, default: null },
      imagesAnalyzed: { type: Number, min: 0, default: 0 },
      fruitCount: { type: Number, min: 0, default: null },
      detections: { type: [mongoose.Schema.Types.Mixed], default: undefined },
      colour: { type: mongoose.Schema.Types.Mixed, default: null },
      size: { type: mongoose.Schema.Types.Mixed, default: null },
      shape: { type: mongoose.Schema.Types.Mixed, default: null },
      surface: { type: mongoose.Schema.Types.Mixed, default: null },
      maturity: { type: mongoose.Schema.Types.Mixed, default: null },
      russetingPercent: { type: Number, min: 0, max: 100, default: null },
      decayPercent: { type: Number, min: 0, max: 100, default: null },
      defectPercent: { type: Number, min: 0, max: 100, default: null },
      uniformityScore: { type: Number, min: 0, max: 100, default: null },
      imageQuality: { type: mongoose.Schema.Types.Mixed, default: null },
      warningCodes: { type: [String], default: undefined },
      failureCode: optionalText(100),
      imageContentHash: {
        type: String,
        trim: true,
        maxlength: 128,
        default: undefined,
        select: false,
      },
      aiStatus: { type: String, default: null },
      aiVersion: { type: String, default: null },
      processorVersion: { type: String, default: null },
      confidence: { type: Number, min: 0, max: 1, default: null },
      inspectionReportId: { type: mongoose.Schema.Types.ObjectId, default: null },
    },
    researchFeedback: {
      growerFeedback: { type: mongoose.Schema.Types.Mixed, default: null, select: false },
      buyerFeedback: { type: mongoose.Schema.Types.Mixed, default: null, select: false },
      adminFeedback: { type: mongoose.Schema.Types.Mixed, default: null, select: false },
      manualCorrection: { type: mongoose.Schema.Types.Mixed, default: null, select: false },
      verificationStatus: {
        type: String,
        enum: VERIFICATION_STATUS_VALUES,
        default: "UNVERIFIED",
        select: false,
      },
      buyerVerification: {
        type: verificationRecordSchema,
        default: null,
        select: false,
      },
      growerVerification: {
        type: verificationRecordSchema,
        default: null,
        select: false,
      },
      adminVerification: {
        type: verificationRecordSchema,
        default: null,
        select: false,
      },
      groundTruthVersion: {
        type: String,
        trim: true,
        maxlength: 100,
        default: null,
        select: false,
      },
      groundTruthLocked: { type: Boolean, default: false, select: false },
      finalAcceptedGrade: { type: String, maxlength: 100, default: null, select: false },
      correctedAt: { type: Date, default: null, select: false },
      correctedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, select: false },
    },
  },
  { timestamps: true }
);

scanRecordSchema.index({ captureSessionId: 1, createdAt: -1 });
scanRecordSchema.index({ fruitLotId: 1, createdAt: -1 });

export default mongoose.model("ScanRecord", scanRecordSchema);
