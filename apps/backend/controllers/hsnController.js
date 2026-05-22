import HsnMaster from "../models/HsnMaster.js";

export const searchHsn = async (req, res) => {
  const query = String(req.query.q || "").trim();

  try {
    const filter = { isActive: true };

    if (query) {
      const pattern = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [
        { hsnCode: pattern },
        { description: pattern },
        { category: pattern },
        { keywords: pattern },
      ];
    }

    const records = await HsnMaster.find(filter)
      .sort({ category: 1, hsnCode: 1 })
      .limit(20)
      .lean();

    res.json(records);
  } catch (err) {
    console.error("HSN search failed:", err.message || err);
    res.status(500).json({ msg: "Could not search HSN records" });
  }
};
