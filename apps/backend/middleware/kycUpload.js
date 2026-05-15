import fs from "fs";
import multer from "multer";
import path from "path";

const kycUploadDir = "uploads/kyc";

if (!fs.existsSync(kycUploadDir)) {
  fs.mkdirSync(kycUploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, kycUploadDir);
  },
  filename: (req, file, cb) => {
    const safeExt = path.extname(file.originalname).toLowerCase();
    cb(null, `${req.user.id}-${file.fieldname}-${Date.now()}${safeExt}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedFields = ["udyanCardFile", "passbookFile", "aadhaarCardFile"];
  const isAllowedType =
    file.mimetype.startsWith("image/") || file.mimetype === "application/pdf";

  if (!allowedFields.includes(file.fieldname)) {
    cb(new Error("Only KYC document files are allowed"));
    return;
  }

  if (!isAllowedType) {
    cb(new Error("Only image or PDF files are allowed"));
    return;
  }

  cb(null, true);
};

const kycUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

export default kycUpload;
