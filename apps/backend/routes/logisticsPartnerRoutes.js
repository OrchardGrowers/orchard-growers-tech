import express from "express";
import protect from "../middleware/authMiddleware.js";
import {
  findLogisticsPartner,
  formatSafeLogisticsPartner,
} from "../services/logisticsAssignmentService.js";

const router = express.Router();

router.get("/search", protect, async (req, res) => {
  try {
    const identifier = String(req.query.identifier || "").trim();
    if (!identifier || identifier.length < 3) {
      return res.json({ success: true, partner: null });
    }

    const partner = await findLogisticsPartner({ identifier });
    res.json({ success: true, partner: formatSafeLogisticsPartner(partner) });
  } catch (err) {
    res.status(500).json({ msg: err.message || "Could not search logistics partner" });
  }
});

export default router;
