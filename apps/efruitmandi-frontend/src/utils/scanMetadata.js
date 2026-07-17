import { createCalibrationState } from "./cameraCalibration";

const optionalNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const optionalText = (value) => String(value || "").trim();

export const createScanMetadata = ({
  scanId,
  captureSessionId,
  fruitLotId = null,
  fruitType = "",
  fruitVariety = "",
  growerId = null,
  scanMode = "",
  captureSource = "MANUAL",
  captureNumber = 1,
  capturedAt,
  uploadedAt = null,
  processingStatus = "NOT_STARTED",
  status = "CAPTURED",
  device = {},
  image = {},
  qualitySnapshot = {},
  subjectPlacement = {},
  guideMetadata = {},
  cameraCalibration = {},
  guideLockState = "",
  retakeRequested = false,
} = {}) => ({
  scanId: optionalText(scanId),
  captureSessionId: optionalText(captureSessionId),
  fruitLotId: fruitLotId || null,
  fruitType: optionalText(fruitType),
  fruitVariety: optionalText(fruitVariety),
  growerId: growerId || null,
  scanMode: optionalText(scanMode),
  captureSource: captureSource === "AUTO" ? "AUTO" : "MANUAL",
  captureNumber: Math.max(1, Number(captureNumber) || 1),
  capturedAt: capturedAt || null,
  uploadedAt,
  processingStatus: optionalText(processingStatus) || "NOT_STARTED",
  status: optionalText(status) || "CAPTURED",
  device: {
    deviceModel: optionalText(device.deviceModel),
    browser: optionalText(device.browser),
    platform: optionalText(device.platform),
    cameraFacing: optionalText(device.cameraFacing),
    cameraResolution: {
      width: optionalNumber(device.cameraResolution?.width),
      height: optionalNumber(device.cameraResolution?.height),
    },
    orientation: optionalText(device.orientation),
    networkType: optionalText(device.networkType),
    gpsAccuracy: optionalNumber(device.gpsAccuracy),
    timezone: optionalText(device.timezone),
  },
  image: {
    imageWidth: optionalNumber(image.imageWidth),
    imageHeight: optionalNumber(image.imageHeight),
    mimeType: optionalText(image.mimeType),
    fileSize: optionalNumber(image.fileSize),
    cloudinaryPublicId: "",
    imageUrl: "",
    thumbnailUrl: "",
    hash: "",
  },
  qualitySnapshot: {
    brightnessScore: optionalNumber(qualitySnapshot.brightnessScore),
    contrastScore: optionalNumber(qualitySnapshot.contrastScore),
    sharpnessScore: optionalNumber(qualitySnapshot.sharpnessScore),
    motionScore: optionalNumber(qualitySnapshot.motionScore),
    stabilityScore: optionalNumber(qualitySnapshot.stabilityScore),
    overallQuality: optionalNumber(
      qualitySnapshot.overallQuality ?? qualitySnapshot.overallScore
    ),
    readinessState: optionalText(
      qualitySnapshot.readinessState || qualitySnapshot.readiness
    ),
  },
  deviceMetadata: {
    platform: optionalText(device.platform),
    browser: optionalText(device.browser),
    userAgentFamily: optionalText(device.userAgentFamily),
    cameraFacing: optionalText(device.cameraFacing),
    cameraWidth: optionalNumber(device.cameraResolution?.width),
    cameraHeight: optionalNumber(device.cameraResolution?.height),
    orientation: optionalText(device.orientation),
    timezone: optionalText(device.timezone),
    networkType: optionalText(device.networkType),
  },
  frameQuality: {
    brightnessScore: optionalNumber(qualitySnapshot.brightnessScore),
    contrastScore: optionalNumber(qualitySnapshot.contrastScore),
    sharpnessScore: optionalNumber(qualitySnapshot.sharpnessScore),
    motionScore: optionalNumber(qualitySnapshot.motionScore),
    stabilityScore: optionalNumber(qualitySnapshot.stabilityScore),
    overallScore: optionalNumber(
      qualitySnapshot.overallScore ?? qualitySnapshot.overallQuality
    ),
    readinessState: optionalText(
      qualitySnapshot.readinessState || qualitySnapshot.readiness
    ),
    guideLockState: optionalText(guideLockState),
    evaluatedAt: qualitySnapshot.evaluatedAt || null,
  },
  subjectPlacement: {
    presenceState: optionalText(subjectPlacement.presenceState),
    presenceScore: optionalNumber(subjectPlacement.presenceScore),
    foregroundCoverage: optionalNumber(subjectPlacement.foregroundCoverage),
    centroidXRatio: optionalNumber(subjectPlacement.centroidXRatio),
    centroidYRatio: optionalNumber(subjectPlacement.centroidYRatio),
    borderContact: optionalNumber(subjectPlacement.borderContact),
    sizeState: optionalText(subjectPlacement.sizeState),
    alignmentState: optionalText(subjectPlacement.alignmentState),
    guidance: optionalText(subjectPlacement.guidance),
    evaluatedAt: subjectPlacement.evaluatedAt || null,
  },
  guideMetadata: {
    guideVersion: optionalText(guideMetadata.guideVersion),
    scanMode: optionalText(scanMode),
    xRatio: optionalNumber(guideMetadata.xRatio),
    yRatio: optionalNumber(guideMetadata.yRatio),
    widthRatio: optionalNumber(guideMetadata.widthRatio),
    heightRatio: optionalNumber(guideMetadata.heightRatio),
    sourceX: optionalNumber(guideMetadata.sourceX),
    sourceY: optionalNumber(guideMetadata.sourceY),
    sourceWidth: optionalNumber(guideMetadata.sourceWidth),
    sourceHeight: optionalNumber(guideMetadata.sourceHeight),
  },
  cameraCalibration: createCalibrationState(cameraCalibration),
  retakeRequested: Boolean(retakeRequested),
  aiStatus: null,
  aiVersion: null,
  inspectionId: null,
  confidence: null,
  recommendationVersion: null,
  manualCorrection: null,
  buyerFeedback: null,
  growerFeedback: null,
  adminFeedback: null,
  finalAcceptedGrade: null,
  verificationStatus: null,
});
