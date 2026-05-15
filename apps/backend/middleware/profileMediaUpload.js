import fs from "fs";
import multer from "multer";
import path from "path";

const profileUploadDir = "uploads/profile";

if (!fs.existsSync(profileUploadDir)) {
  fs.mkdirSync(profileUploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, profileUploadDir);
  },
  filename: (req, file, cb) => {
    const safeExt = path.extname(file.originalname).toLowerCase();
    cb(null, `${req.user.id}-${file.fieldname}-${Date.now()}${safeExt}`);
  },
});

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
    cb(new Error("Only profile avatar, banner, and company logo images are allowed"));
    return;
  }

  if (!file.mimetype.startsWith("image/")) {
    cb(new Error("Only image files are allowed"));
    return;
  }

  cb(null, true);
};

const profileMediaUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

export default profileMediaUpload;
