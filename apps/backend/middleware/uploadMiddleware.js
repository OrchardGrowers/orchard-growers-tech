import multer from "multer";
import path from "path";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const fileFilter = (req, file, cb) => {
  const isImageField = file.fieldname.startsWith("gradeImages_");
  const isVideoField = file.fieldname === "sampleVideo";
  const isCertificateField = file.fieldname === "organicCertificate";

  if (isImageField && file.mimetype.startsWith("image/")) {
    cb(null, true);
    return;
  }

  if (isVideoField && file.mimetype.startsWith("video/")) {
    cb(null, true);
    return;
  }

  if (
    isCertificateField &&
    (file.mimetype.startsWith("image/") || file.mimetype === "application/pdf")
  ) {
    cb(null, true);
    return;
  }

  cb(new Error("Only lot images, one sample lot video, and organic certificate files are allowed"));
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    files: 40,
    fileSize: 50 * 1024 * 1024,
  },
});

export default upload;
