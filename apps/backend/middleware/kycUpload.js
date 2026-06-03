import multer from "multer";

const ALLOWED_DOCUMENT_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const fileFilter = (req, file, cb) => {
  const allowedFields = ["udyanCardFile", "passbookFile", "aadhaarCardFile"];
  const isAllowedType = ALLOWED_DOCUMENT_MIME_TYPES.has(file.mimetype);

  if (!allowedFields.includes(file.fieldname)) {
    const error = new Error("Only KYC document files are allowed");
    error.statusCode = 400;
    cb(error);
    return;
  }

  if (!isAllowedType) {
    const error = new Error("Only JPG, PNG, WebP, or PDF files are allowed");
    error.statusCode = 400;
    cb(error);
    return;
  }

  cb(null, true);
};

const kycUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

export default kycUpload;
