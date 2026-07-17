import multer from "multer";

export const CAPTURE_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

export const CAPTURE_VIDEO_MIME_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

export const isAllowedCaptureMimeType = (mimeType = "") => {
  const normalizedMimeType = String(mimeType).trim().toLowerCase();
  return (
    CAPTURE_IMAGE_MIME_TYPES.has(normalizedMimeType) ||
    CAPTURE_VIDEO_MIME_TYPES.has(normalizedMimeType)
  );
};

const captureFileFilter = (req, file, cb) => {
  if (file.fieldname === "media" && isAllowedCaptureMimeType(file.mimetype)) {
    cb(null, true);
    return;
  }

  const error = new Error("Unsupported capture media type");
  error.statusCode = 400;
  cb(error);
};

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: captureFileFilter,
  limits: {
    files: 1,
    fileSize: 50 * 1024 * 1024,
  },
});

export default upload;
