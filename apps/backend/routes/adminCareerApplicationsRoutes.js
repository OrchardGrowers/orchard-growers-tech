import express from "express";
import {
  downloadCareerApplicationAttachment,
  exportCareerApplications,
  getCareerApplication,
  getCareerApplicationFilterOptions,
  listCareerApplications,
  syncCareerApplications,
  updateCareerApplicationReview,
} from "../controllers/adminCareerApplicationsController.js";
import { authorize } from "../middleware/authMiddleware.js";

const router = express.Router();
const careerAdminOnly = authorize("SUPER_ADMIN", "ADMIN");
const wrapAsync = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

router.post("/sync", careerAdminOnly, wrapAsync(syncCareerApplications));
router.post("/search", careerAdminOnly, wrapAsync(listCareerApplications));
router.post("/export", careerAdminOnly, wrapAsync(exportCareerApplications));
router.get("/export", careerAdminOnly, wrapAsync(exportCareerApplications));
router.get("/filter-options", careerAdminOnly, wrapAsync(getCareerApplicationFilterOptions));
router.get("/", careerAdminOnly, wrapAsync(listCareerApplications));
router.get("/:id/attachments/:attachmentIndex", careerAdminOnly, wrapAsync(downloadCareerApplicationAttachment));
router.patch("/:id/review", careerAdminOnly, wrapAsync(updateCareerApplicationReview));
router.get("/:id", careerAdminOnly, wrapAsync(getCareerApplication));

export default router;
