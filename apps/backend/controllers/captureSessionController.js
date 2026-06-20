import crypto from "crypto";
import CaptureSession from "../models/CaptureSession.js";
import { uploadBufferToCloudinary } from "../services/cloudinaryService.js";

const SESSION_TTL_MS = 15 * 60 * 1000;
const VALID_MEDIA_TYPES = new Set(["image", "video"]);

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

const serializeSession = (session) => ({
  sessionId: session.sessionId,
  mediaType: session.mediaType,
  gradeKey: session.gradeKey,
  slotIndex: session.slotIndex,
  status: session.status,
  expiresAt: session.expiresAt,
});

const serializeMedia = (session) => ({
  ...serializeSession(session),
  media: session.media?.url
    ? {
        url: session.media.url,
        secure_url: session.media.secure_url || session.media.url,
        publicId: session.media.publicId,
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

  if (session.mediaType === "image" && !mimeType.startsWith("image/")) {
    throw createHttpError(400, "Only image files are allowed for this capture slot");
  }

  if (session.mediaType === "video" && !mimeType.startsWith("video/")) {
    throw createHttpError(400, "Only video files are allowed for this capture slot");
  }
};

export const createCaptureSession = async (req, res, next) => {
  try {
    const mediaType = String(req.body.mediaType || "").trim().toLowerCase();
    const gradeKey = String(req.body.gradeKey || "").trim();
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
  try {
    const session = await CaptureSession.findOne({ sessionId: req.params.sessionId });
    assertSessionUsable(session);
    validateUploadedFileType(session, req.file);

    const uploaded = await uploadBufferToCloudinary(req.file, {
      folder: process.env.CLOUDINARY_LOT_FOLDER || "efruitmandi/lots",
      resourceType: session.mediaType,
    });

    session.media = {
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
    session.status = "uploaded";
    await session.save();

    res.json(serializeMedia(session));
  } catch (error) {
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
