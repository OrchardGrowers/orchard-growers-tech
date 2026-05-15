import express from "express";
import { createVerificationRequest } from "../controllers/verificationController.js";
import protect, { authorize } from "../middleware/authMiddleware.js";
import verificationUpload from "../middleware/verificationUpload.js";

const router = express.Router();

router.post(
  "/",
  protect,
  authorize("grower"),
  verificationUpload.fields([
    { name: "udyanCard", maxCount: 1 },
    { name: "udyanCardFile", maxCount: 1 },
    { name: "orchardVideo", maxCount: 1 },
    { name: "orchardVideoFile", maxCount: 1 },
  ]),
  createVerificationRequest
);

export default router;
