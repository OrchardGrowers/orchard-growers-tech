import multer from "multer";

const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

const fileFilter = (req, file, cb) => {
  const isImageField = file.fieldname.startsWith("gradeImages_");
  const isVideoField = file.fieldname === "sampleVideo";
  const isCertificateField = file.fieldname === "organicCertificate";

  if (isImageField && ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
    cb(null, true);
    return;
  }

  if (isVideoField && file.mimetype.startsWith("video/")) {
    cb(null, true);
    return;
  }

  if (
    isCertificateField &&
    (ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype) || file.mimetype === "application/pdf")
  ) {
    cb(null, true);
    return;
  }

  const error = new Error("Only lot images, one sample lot video, and organic certificate files are allowed");
  error.statusCode = 400;
  cb(error);
};

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    files: 40,
    fileSize: 50 * 1024 * 1024,
  },
});

export default upload;
