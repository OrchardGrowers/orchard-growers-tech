import crypto from "crypto";
import { createInspectionLifecycle } from "./inspectionState.js";
import { createVerificationState } from "./verificationState.js";

const SCAN_MODES = new Set([
  "SINGLE_FRUIT",
  "FRUIT_GROUP",
  "TRAY_PACKED",
  "PACKAGE_VIEW",
]);

const boundedText = (value, maxLength) =>
  String(value || "").trim().slice(0, maxLength) || undefined;

const finiteNumber = (value, { min = null, max = null } = {}) => {
  if (value === null || value === undefined || value === "") return undefined;
  const number = Number(value);
  if (!Number.isFinite(number)) return undefined;
  return Math.min(max ?? number, Math.max(min ?? number, number));
};

const optionalDate = (value) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const normalizeScanMode = (value) => {
  const mode = String(value || "").trim().toUpperCase();
  return SCAN_MODES.has(mode) ? mode : "UNKNOWN";
};

const getBrowserFamily = (value) => {
  const browser = String(value || "");
  if (/edg/i.test(browser)) return "Edge";
  if (/firefox/i.test(browser)) return "Firefox";
  if (/chrome|chromium/i.test(browser)) return "Chrome";
  if (/safari/i.test(browser)) return "Safari";
  return browser && !/mozilla|\//i.test(browser)
    ? boundedText(browser.split(",")[0], 50)
    : undefined;
};

const createThumbnailUrl = (url, resourceType) =>
  resourceType === "image" && String(url || "").includes("/image/upload/")
    ? String(url).replace(
        "/image/upload/",
        "/image/upload/c_fill,w_320,h_240,q_auto,f_auto/"
      )
    : undefined;

export const createScanRecord = ({
  scanId,
  session,
  uploadResult,
  file,
  clientMetadata = {},
  now,
}) => {
  const createdAt = new Date(now);
  if (!scanId || Number.isNaN(createdAt.getTime())) {
    throw new Error("Valid server scan identity and timestamp are required");
  }

  const device = clientMetadata.deviceMetadata || clientMetadata.device || {};
  const cameraResolution = device.cameraResolution || {};
  const quality = clientMetadata.frameQuality || clientMetadata.qualitySnapshot || {};
  const subject = clientMetadata.subjectPlacement || {};
  const guide = clientMetadata.guideMetadata || {};
  const requestedCapturedAt = optionalDate(clientMetadata.capturedAt);
  const capturedAt =
    requestedCapturedAt && requestedCapturedAt.getTime() <= createdAt.getTime() + 5 * 60 * 1000
      ? requestedCapturedAt
      : createdAt;
  const scanMode = normalizeScanMode(clientMetadata.scanMode);

  return {
    scanId: String(scanId),
    captureSessionId: session.sessionId,
    growerId: session.userId,
    fruitLotId: session.attachedProduct || null,
    fruitType: boundedText(session.fruitType, 100),
    fruitVariety: boundedText(session.fruitVariety, 100),
    capturedAt,
    uploadedAt: createdAt,
    status: "UPLOADED",
    supersededAt: null,
    captureSource: clientMetadata.captureSource === "AUTO" ? "AUTO" : "MANUAL",
    scanMode,
    image: {
      secureUrl: uploadResult.secure_url,
      cloudinaryPublicId: uploadResult.publicId,
      cloudinaryFolder: boundedText(uploadResult.folder, 500),
      resourceType: boundedText(uploadResult.resourceType, 30),
      mimeType: boundedText(file.mimetype, 100),
      originalName: boundedText(file.originalname, 255),
      fileSizeBytes: Number(file.size) || 0,
      imageWidth: finiteNumber(uploadResult.width, { min: 1, max: 20000 }),
      imageHeight: finiteNumber(uploadResult.height, { min: 1, max: 20000 }),
      thumbnailUrl: createThumbnailUrl(uploadResult.secure_url, uploadResult.resourceType),
      contentHash: crypto.createHash("sha256").update(file.buffer).digest("hex"),
      uploadedAt: createdAt,
    },
    deviceMetadata: {
      platform: boundedText(device.platform, 100),
      browser: getBrowserFamily(device.browser || device.userAgentFamily),
      userAgentFamily: getBrowserFamily(device.userAgentFamily || device.browser),
      cameraFacing: boundedText(device.cameraFacing, 30),
      cameraWidth: finiteNumber(device.cameraWidth ?? cameraResolution.width, { min: 1, max: 20000 }),
      cameraHeight: finiteNumber(device.cameraHeight ?? cameraResolution.height, { min: 1, max: 20000 }),
      orientation: boundedText(device.orientation, 50),
      timezone: boundedText(device.timezone, 100),
      networkType: boundedText(device.networkType, 30),
    },
    frameQuality: {
      brightnessScore: finiteNumber(quality.brightnessScore, { min: 0, max: 100 }),
      contrastScore: finiteNumber(quality.contrastScore, { min: 0, max: 100 }),
      sharpnessScore: finiteNumber(quality.sharpnessScore, { min: 0, max: 100 }),
      motionScore: finiteNumber(quality.motionScore, { min: 0, max: 100 }),
      stabilityScore: finiteNumber(quality.stabilityScore, { min: 0, max: 100 }),
      overallScore: finiteNumber(quality.overallScore ?? quality.overallQuality, { min: 0, max: 100 }),
      readinessState: boundedText(quality.readinessState || quality.readiness, 50),
      guideLockState: boundedText(quality.guideLockState, 30),
      evaluatedAt: optionalDate(quality.evaluatedAt),
    },
    subjectPlacement: {
      presenceState: boundedText(subject.presenceState, 50),
      presenceScore: finiteNumber(subject.presenceScore, { min: 0, max: 100 }),
      foregroundCoverage: finiteNumber(subject.foregroundCoverage, { min: 0, max: 1 }),
      centroidXRatio: finiteNumber(subject.centroidXRatio, { min: 0, max: 1 }),
      centroidYRatio: finiteNumber(subject.centroidYRatio, { min: 0, max: 1 }),
      borderContact: finiteNumber(subject.borderContact, { min: 0, max: 1 }),
      sizeState: boundedText(subject.sizeState, 50),
      alignmentState: boundedText(subject.alignmentState, 50),
      guidance: boundedText(subject.guidance, 256),
      evaluatedAt: optionalDate(subject.evaluatedAt),
    },
    guideMetadata: {
      guideVersion: boundedText(guide.guideVersion, 30),
      scanMode,
      xRatio: finiteNumber(guide.xRatio, { min: 0, max: 1 }),
      yRatio: finiteNumber(guide.yRatio, { min: 0, max: 1 }),
      widthRatio: finiteNumber(guide.widthRatio, { min: 0, max: 1 }),
      heightRatio: finiteNumber(guide.heightRatio, { min: 0, max: 1 }),
      sourceX: finiteNumber(guide.sourceX, { min: 0, max: 100000 }),
      sourceY: finiteNumber(guide.sourceY, { min: 0, max: 100000 }),
      sourceWidth: finiteNumber(guide.sourceWidth, { min: 0, max: 100000 }),
      sourceHeight: finiteNumber(guide.sourceHeight, { min: 0, max: 100000 }),
    },
    inspection: createInspectionLifecycle(),
    analysis: {
      aiStatus: null,
      aiVersion: null,
      processorVersion: null,
      confidence: null,
      inspectionReportId: null,
    },
    researchFeedback: {
      growerFeedback: null,
      buyerFeedback: null,
      adminFeedback: null,
      manualCorrection: null,
      ...createVerificationState(),
      finalAcceptedGrade: null,
      correctedAt: null,
      correctedBy: null,
    },
  };
};
