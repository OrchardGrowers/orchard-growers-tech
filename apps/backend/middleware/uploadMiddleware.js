import multer from "multer";
import path from "path";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  const isImageField = file.fieldname.startsWith("gradeImages_");
  const isVideoField = file.fieldname === "sampleVideo";

  if (isImageField && file.mimetype.startsWith("image/")) {
    cb(null, true);
    return;
  }

  if (isVideoField && file.mimetype.startsWith("video/")) {
    cb(null, true);
    return;
  }

  cb(new Error("Only lot images and one sample lot video are allowed"));
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
