import multer from "multer";

const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

const fileFilter = (req, file, cb) => {
  const allowedFields = [
    "avatar",
    "banner",
    "companyLogo",
    "avatarUrl",
    "bannerUrl",
    "companyLogoUrl",
  ];

  if (!allowedFields.includes(file.fieldname)) {
    const error = new Error("Only profile avatar, banner, and company logo images are allowed");
    error.statusCode = 400;
    cb(error);
    return;
  }

  if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
    const error = new Error("Only JPG, PNG, or WebP image files are allowed");
    error.statusCode = 400;
    cb(error);
    return;
  }

  cb(null, true);
};

const profileMediaUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

export default profileMediaUpload;
