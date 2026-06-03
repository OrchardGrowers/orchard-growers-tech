import express from "express";
import { getMyKyc, updateKyc } from "../controllers/userController.js";
import protect from "../middleware/authMiddleware.js";
import kycUpload from "../middleware/kycUpload.js";

const router = express.Router();

const kycFields = [
  { name: "udyanCardFile", maxCount: 1 },
  { name: "passbookFile", maxCount: 1 },
  { name: "aadhaarCardFile", maxCount: 1 },
  { name: "idProofImage", maxCount: 1 },
  { name: "panImage", maxCount: 1 },
  { name: "gstCertificate", maxCount: 1 },
  { name: "drivingLicenseImage", maxCount: 1 },
];

router.get("/me", protect, getMyKyc);
router.post("/submit", protect, kycUpload.fields(kycFields), updateKyc);
router.put("/update", protect, kycUpload.fields(kycFields), updateKyc);

export default router;
