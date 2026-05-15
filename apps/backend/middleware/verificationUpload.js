import fs from "fs";
import multer from "multer";
import path from "path";

const uploadDir = "uploads/verification";

fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-z0-9.]+/gi, "-").toLowerCase();
    cb(null, `${Date.now()}-${safeName}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (["udyanCard", "udyanCardFile"].includes(file.fieldname)) {
    const isAllowed =
      file.mimetype.startsWith("image/") || file.mimetype === "application/pdf";
    cb(isAllowed ? null : new Error("Udyan card must be an image or PDF"), isAllowed);
    return;
  }

  if (["orchardVideo", "orchardVideoFile"].includes(file.fieldname)) {
    const isAllowed = file.mimetype.startsWith("video/");
    cb(isAllowed ? null : new Error("Orchard video must be a video file"), isAllowed);
    return;
  }

  cb(new Error("Unsupported verification upload field"), false);
};

const verificationUpload = multer({
  storage,
  fileFilter,
  limits: {
    files: 2,
    fileSize: 500 * 1024 * 1024,
  },
});

export default verificationUpload;
