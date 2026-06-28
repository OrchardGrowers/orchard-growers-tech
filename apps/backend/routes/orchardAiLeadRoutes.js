import express from "express";
import {
  createOrchardAiLead,
  collectOrchardAiLeads,
  deleteOrchardAiLead,
  extractOrchardAiLeadUrl,
  getOrchardAiLead,
  listOrchardAiLeads,
  orchardAiLeadErrorHandler,
  updateOrchardAiLead,
} from "../controllers/orchardAiLeadController.js";
import protect, { authorize } from "../middleware/authMiddleware.js";
import Admin from "../models/Admin.js";

const router = express.Router();

const ADMIN_ACCESS_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "UNIT_MANAGER",
  "INVENTORY_MANAGER",
  "SALES_EXECUTIVE",
  "PURCHASE_MANAGER",
  "FINANCE_MANAGER",
  "VERIFICATION_OFFICER",
  "SUPPORT_EXECUTIVE",
  "VIEWER",
  "EMPLOYEE",
];

const wrapAsync = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

const ensureActiveAdmin = async (req, res, next) => {
  const admin = await Admin.findById(req.user.id).select("_id status role");

  if (!admin || admin.status !== "ACTIVE" || !ADMIN_ACCESS_ROLES.includes(admin.role)) {
    return res.status(403).json({
      message: "Admin account is not active",
      msg: "Admin account is not active",
    });
  }

  req.admin = admin;
  return next();
};

router.use(
  protect,
  authorize(...ADMIN_ACCESS_ROLES),
  wrapAsync(ensureActiveAdmin)
);

router.get("/", wrapAsync(listOrchardAiLeads));
router.post("/", wrapAsync(createOrchardAiLead));
router.post("/collect", wrapAsync(collectOrchardAiLeads));
router.post("/extract-url", wrapAsync(extractOrchardAiLeadUrl));
router.get("/:id", wrapAsync(getOrchardAiLead));
router.patch("/:id", wrapAsync(updateOrchardAiLead));
router.delete("/:id", wrapAsync(deleteOrchardAiLead));

router.use(orchardAiLeadErrorHandler);

export default router;

