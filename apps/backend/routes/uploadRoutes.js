import express from "express";
import multer from "multer";
import { uploadEfruitmandiFiles, uploadFileFilter } from "../controllers/uploadController.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

const efruitmandiUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: uploadFileFilter,
  limits: {
    files: 10,
    fileSize: 10 * 1024 * 1024,
  },
});

router.post(
  "/efruitmandi",
  protect,
  efruitmandiUpload.fields([
    { name: "image", maxCount: 1 },
    { name: "images", maxCount: 10 },
    { name: "file", maxCount: 1 },
    { name: "files", maxCount: 10 },
  ]),
  uploadEfruitmandiFiles
);

export default router;
