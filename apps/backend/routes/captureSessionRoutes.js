import express from "express";
import {
  createCaptureSession,
  getCaptureSession,
  getCaptureSessionMedia,
  uploadCaptureSessionMedia,
} from "../controllers/captureSessionController.js";
import captureUpload from "../middleware/captureUpload.js";
import protect, { authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", protect, authorize("grower", "buyer"), createCaptureSession);
router.get("/:sessionId", getCaptureSession);
router.post("/:sessionId/media", captureUpload.single("media"), uploadCaptureSessionMedia);
router.get("/:sessionId/media", protect, authorize("grower", "buyer"), getCaptureSessionMedia);

export default router;
