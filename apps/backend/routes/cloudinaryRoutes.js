import express from "express";
import { getCloudinaryUploadSignature } from "../controllers/cloudinaryController.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/signature", protect, getCloudinaryUploadSignature);

export default router;
