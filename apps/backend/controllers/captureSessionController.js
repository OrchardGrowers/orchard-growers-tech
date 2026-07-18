import crypto from "crypto";
import CaptureSession from "../models/CaptureSession.js";
import ScanRecord from "../models/ScanRecord.js";
import {
  deleteCloudinaryAssetsByUrls,
  uploadBufferToCloudinary,
} from "../services/cloudinaryService.js";
import { preprocessFruitImage } from "../services/imagePreprocessingService.js";
import { createScanRecord } from "../utils/createScanRecord.js";
import {
  CAPTURE_IMAGE_MIME_TYPES,
  CAPTURE_VIDEO_MIME_TYPES,
  isAllowedCaptureMimeType,
} from "../middleware/captureUpload.js";

const SESSION_TTL_MS = 15 * 60 * 1000;
const MAX_SCAN_METADATA_BYTES = 16 * 1024;
const VALID_MEDIA_TYPES = new Set(["image", "video"]);

const boundedText = (value, maxLength = 256) =>
  String(value || "").trim().slice(0, maxLength);

const logOptionalProcessingFailure = (stage, error) => {
  const detail = boundedText(error?.message || error?.name || "Unknown error", 200);
  console.error(
    `[capture-upload] Optional processed image ${stage} failed; original upload preserved: ${detail}`
  );
};

const getProcessedOriginalName = (value) => {
  const baseName = boundedText(value, 240).replace(/\.[^.]+$/, "") || "capture";
  return `${baseName}-processed.jpg`;
};

const createProcessedMediaData = ({ preprocessing, uploaded, originalName, uploadedAt }) => {
  const audit = {
    processingVersion: preprocessing.processingVersion,
    processingSteps: [...preprocessing.processingSteps],
    processingDurationMs: preprocessing.processingDurationMs,
    originalChecksum: preprocessing.originalChecksum,
    processedChecksum: preprocessing.processedChecksum,
    originalMetadata: { ...preprocessing.original },
    processedMetadata: { ...preprocessing.processed },
  };

  return {
    captureSession: {
      url: uploaded.secure_url,
      secure_url: uploaded.secure_url,
      publicId: uploaded.publicId,
      folder: uploaded.folder,
      resourceType: uploaded.resourceType,
      mimeType: preprocessing.contentType,
      originalName,
      size: preprocessing.byteSize,
      uploadedAt,
      ...audit,
    },
    scanRecord: {
      secureUrl: uploaded.secure_url,
      cloudinaryPublicId: uploaded.publicId,
      cloudinaryFolder: uploaded.folder,
      resourceType: uploaded.resourceType,
      mimeType: preprocessing.contentType,
      originalName,
      fileSizeBytes: preprocessing.byteSize,
      imageWidth: preprocessing.processed.width,
      imageHeight: preprocessing.processed.height,
      uploadedAt,
      ...audit,
    },
  };
};

const parseClientScanMetadata = (value) => {
  if (!value) return {};
  if (typeof value === "object") {
    if (Array.isArray(value)) return {};
    try {
      if (Buffer.byteLength(JSON.stringify(value), "utf8") > MAX_SCAN_METADATA_BYTES) {
        throw createHttpError(400, "Scan metadata is too large");
      }
    } catch (error) {
      if (error?.statusCode) throw error;
      return {};
    }
    return value;
  }
  if (Buffer.byteLength(String(value), "utf8") > MAX_SCAN_METADATA_BYTES) {
    throw createHttpError(400, "Scan metadata is too large");
  }
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const isExpired = (session) =>
  !session?.expiresAt || new Date(session.expiresAt).getTime() <= Date.now();

const assertSessionUsable = (session) => {
  if (!session) {
    throw createHttpError(404, "Capture session not found");
  }

  if (isExpired(session)) {
    throw createHttpError(410, "Capture session expired");
  }
};

const assertSessionUploadable = (session) => {
  assertSessionUsable(session);

  if (session.status === "attached") {
    throw createHttpError(409, "Capture session is already finalized");
  }
};

const serializeSession = (session) => ({
  sessionId: session.sessionId,
  mediaType: session.mediaType,
  gradeKey: session.gradeKey,
  slotIndex: session.slotIndex,
  fruitType: session.fruitType || "",
  fruitVariety: session.fruitVariety || "",
  status: session.status,
  expiresAt: session.expiresAt,
});

const serializeMedia = (session) => ({
  ...serializeSession(session),
  media: session.media?.url
    ? {
        url: session.media.url,
        secure_url: session.media.secure_url || session.media.url,
        resourceType: session.media.resourceType,
        mimeType: session.media.mimeType,
        originalName: session.media.originalName,
        size: session.media.size,
        uploadedAt: session.media.uploadedAt,
      }
    : null,
});

const validateSessionOwner = (session, userId) => {
  if (session.userId?.toString() !== userId?.toString()) {
    throw createHttpError(403, "Capture session does not belong to this user");
  }
};

const validateUploadedFileType = (session, file) => {
  if (!file) {
    throw createHttpError(400, "Capture media file is required");
  }

  const mimeType = String(file.mimetype || "").toLowerCase();

  if (!isAllowedCaptureMimeType(mimeType)) {
    throw createHttpError(400, "Unsupported capture media type");
  }

  if (session.mediaType === "image" && !CAPTURE_IMAGE_MIME_TYPES.has(mimeType)) {
    throw createHttpError(400, "Only image files are allowed for this capture slot");
  }

  if (session.mediaType === "video" && !CAPTURE_VIDEO_MIME_TYPES.has(mimeType)) {
    throw createHttpError(400, "Only video files are allowed for this capture slot");
  }
};

export const createCaptureSession = async (req, res, next) => {
  try {
    const mediaType = String(req.body.mediaType || "").trim().toLowerCase();
    const gradeKey = String(req.body.gradeKey || "").trim();
    const fruitType = boundedText(req.body.fruitType, 100);
    const fruitVariety = boundedText(req.body.fruitVariety, 100);
    const slotIndex =
      req.body.slotIndex === undefined || req.body.slotIndex === null || req.body.slotIndex === ""
        ? null
        : Number(req.body.slotIndex);

    if (!VALID_MEDIA_TYPES.has(mediaType)) {
      return res.status(400).json({ msg: "mediaType must be image or video" });
    }

    if (mediaType === "image" && (!gradeKey || !Number.isInteger(slotIndex))) {
      return res.status(400).json({ msg: "gradeKey and slotIndex are required for image capture" });
    }

    const session = await CaptureSession.create({
      sessionId: crypto.randomBytes(32).toString("base64url"),
      userId: req.user.id,
      mediaType,
      gradeKey: mediaType === "image" ? gradeKey : "",
      slotIndex: mediaType === "image" ? slotIndex : null,
      fruitType,
      fruitVariety,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    });

    res.status(201).json(serializeSession(session));
  } catch (error) {
    next(error);
  }
};

export const getCaptureSession = async (req, res, next) => {
  try {
    const session = await CaptureSession.findOne({ sessionId: req.params.sessionId });
    assertSessionUsable(session);

    res.json(serializeSession(session));
  } catch (error) {
    next(error);
  }
};

export const uploadCaptureSessionMedia = async (req, res, next) => {
  let uploaded = null;
  let processedUploaded = null;
  let createdScanRecord = null;
  let previousCurrentIds = [];
  let committed = false;
  try {
    const session = await CaptureSession.findOne({ sessionId: req.params.sessionId });
    assertSessionUploadable(session);
    validateUploadedFileType(session, req.file);
    const clientMetadata = parseClientScanMetadata(req.body?.scanMetadata);
    const explicitRetake = clientMetadata.retakeRequested === true;
    if (session.status === "uploaded" && !explicitRetake) {
      throw createHttpError(409, "Capture session already has an uploaded frame; explicit retake is required");
    }

    const uploadFolder = process.env.CLOUDINARY_LOT_FOLDER || "efruitmandi/lots";
    uploaded = await uploadBufferToCloudinary(req.file, {
      folder: uploadFolder,
      resourceType: session.mediaType,
    });
    const now = new Date();
    let processedMedia = null;
    if (session.mediaType === "image") {
      let preprocessing = null;
      try {
        preprocessing = await preprocessFruitImage(req.file.buffer);
      } catch (error) {
        logOptionalProcessingFailure("preprocessing", error);
      }

      if (preprocessing) {
        const processedOriginalName = getProcessedOriginalName(req.file.originalname);
        try {
          processedUploaded = await uploadBufferToCloudinary(
            {
              buffer: preprocessing.buffer,
              mimetype: preprocessing.contentType,
              originalname: processedOriginalName,
              size: preprocessing.byteSize,
            },
            {
              folder: uploadFolder,
              resourceType: "image",
            }
          );
          if (processedUploaded) {
            processedMedia = createProcessedMediaData({
              preprocessing,
              uploaded: processedUploaded,
              originalName: processedOriginalName,
              uploadedAt: now,
            });
          }
        } catch (error) {
          logOptionalProcessingFailure("upload", error);
        }
      }
    }

    const scanRecord = createScanRecord({
      scanId: crypto.randomUUID(),
      session,
      file: req.file,
      uploadResult: uploaded,
      clientMetadata,
      now,
    });
    if (processedMedia) {
      scanRecord.image.processed = processedMedia.scanRecord;
    }
    previousCurrentIds = await ScanRecord.find({
      captureSessionId: session.sessionId,
      growerId: session.userId,
      status: "UPLOADED",
    }).distinct("_id");
    createdScanRecord = await ScanRecord.create(scanRecord);
    if (previousCurrentIds.length) {
      await ScanRecord.updateMany(
        { _id: { $in: previousCurrentIds } },
        { $set: { status: "SUPERSEDED", supersededAt: now } }
      );
    }

    const sessionMedia = {
      url: uploaded.secure_url,
      secure_url: uploaded.secure_url,
      publicId: uploaded.publicId,
      folder: uploaded.folder,
      resourceType: uploaded.resourceType,
      mimeType: req.file.mimetype,
      originalName: req.file.originalname,
      size: req.file.size,
      uploadedAt: new Date(),
    };
    if (processedMedia) {
      sessionMedia.processed = processedMedia.captureSession;
    }
    session.media = sessionMedia;
    session.status = "uploaded";
    await session.save();
    committed = true;

    res.json(serializeMedia(session));
  } catch (error) {
    if (!committed) {
      await Promise.allSettled([
        createdScanRecord
          ? ScanRecord.deleteOne({ _id: createdScanRecord._id })
          : Promise.resolve(),
        previousCurrentIds.length
          ? ScanRecord.updateMany(
              { _id: { $in: previousCurrentIds }, status: "SUPERSEDED" },
              { $set: { status: "UPLOADED" }, $unset: { supersededAt: 1 } }
            )
          : Promise.resolve(),
        uploaded?.secure_url || processedUploaded?.secure_url
          ? deleteCloudinaryAssetsByUrls(
              [uploaded?.secure_url, processedUploaded?.secure_url].filter(Boolean)
            )
          : Promise.resolve(),
      ]);
    }
    next(error);
  }
};

export const getCaptureSessionMedia = async (req, res, next) => {
  try {
    const session = await CaptureSession.findOne({ sessionId: req.params.sessionId });
    assertSessionUsable(session);
    validateSessionOwner(session, req.user.id);

    res.json(serializeMedia(session));
  } catch (error) {
    next(error);
  }
};
