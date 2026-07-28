import express from "express";
import {
  getCareerApplication,
  listCareerApplications,
  syncCareerApplications,
} from "../controllers/adminCareerApplicationsController.js";
import { authorize } from "../middleware/authMiddleware.js";

const router = express.Router();
const careerAdminOnly = authorize("SUPER_ADMIN", "ADMIN");
const wrapAsync = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

router.post("/sync", careerAdminOnly, wrapAsync(syncCareerApplications));
router.get("/", careerAdminOnly, wrapAsync(listCareerApplications));
router.get("/:id", careerAdminOnly, wrapAsync(getCareerApplication));

export default router;
