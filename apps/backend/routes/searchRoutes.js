import express from "express";
import User from "../models/User.js";
import Product from "../models/Product.js";
import MandiRate from "../models/MandiRate.js";
import { getFruitCommodityNames } from "../services/mandiRateService.js";

const router = express.Router();

const escapeRegex = (value = "") =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeText = (value = "") => String(value || "").trim();

const getProfileTitle = (user = {}) =>
  user.orchardName ||
  user.businessName ||
  user.logisticsName ||
  user.driverName ||
  user.buyerContactPerson ||
  user.name ||
  "Marketplace Profile";

const getProfileRole = (user = {}) => {
  const profiles = Array.isArray(user.profileTypes) ? user.profileTypes : [];
  if (profiles.includes("grower") || user.orchardName) return "Grower";
  if (profiles.includes("buyer") || user.businessName || user.buyerContactPerson) return "Buyer";
  if (profiles.includes("driver") || user.logisticsName || user.driverName) return "Driver";
  return user.role || user.activeRole || "Profile";
};

const formatPrice = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return "Modal rate not available";
  return `Modal ₹${number.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}/kg`;
};

router.get("/", async (req, res) => {
  try {
    const q = normalizeText(req.query.q);
    const limit = Math.min(Number(req.query.limit) || 20, 50);

    if (!q) {
      return res.json({
        profiles: [],
        lots: [],
        mandiRates: [],
      });
    }

    const regex = new RegExp(escapeRegex(q), "i");

    const marketplaceIntentRegex =
      /\b(fruit lots?|live fruit lots?|available lots?|upcoming lots?|upcoming fruit lots?|deals?|live deals?|fruit deals?|auction|auctions|quote|quotes|quotation|marketplace)\b/i;

    const isMarketplaceIntent = marketplaceIntentRegex.test(q);

    const fruitCommodityNames = await getFruitCommodityNames();

    const [profiles, lots, mandiRates] = await Promise.all([
      User.find({
        $or: [
          { name: regex },
          { orchardName: regex },
          { businessName: regex },
          { buyerContactPerson: regex },
          { buyerLocation: regex },
          { logisticsName: regex },
          { driverName: regex },
          { vehicleNumber: regex },
          { location: regex },
          { activeRole: regex },
          { role: regex },
          { profileTypes: regex },
        ],
      })
        .select(
          "name role activeRole profileTypes orchardName businessName buyerContactPerson buyerLocation logisticsName driverName vehicleNumber location avatarUrl buyerAvatarUrl companyLogoUrl isKycVerified isOgVerified isTrustedBadge createdAt"
        )
        .limit(limit)
        .lean(),

      Product.find(
        isMarketplaceIntent
          ? { createdSource: "grower" }
          : {
              createdSource: "grower",
              $or: [
                { title: regex },
                { fruitName: regex },
                { variety: regex },
                { description: regex },
                { location: regex },
                { lotNo: regex },
                { packingType: regex },
                { status: regex },
                { "gradeLots.grade": regex },
              ],
            }
      )
        .select(
          "title fruitName variety description location lotNo quantity status images imageObjects gradeLots createdBy createdAt"
        )
        .populate("createdBy", "name orchardName businessName")
        .limit(limit)
        .lean(),

      fruitCommodityNames.length
        ? MandiRate.find({
            commodity: { $in: fruitCommodityNames },
            $or: [
              { commodity: regex },
              { variety: regex },
              { market: regex },
              { district: regex },
              { state: regex },
            ],
          })
            .select("commodity variety market district state modalPriceKg arrivalDate")
            .sort({ arrivalDate: -1 })
            .limit(limit)
            .lean()
        : Promise.resolve([]),
    ]);

    return res.json({
      profiles: profiles.map((user) => ({
        _id: user._id,
        type: getProfileRole(user),
        title: getProfileTitle(user),
        name: user.name,
        role: user.role,
        activeRole: user.activeRole,
        profileTypes: user.profileTypes || [],
        location: user.buyerLocation || user.location || "",
        image: user.companyLogoUrl || user.buyerAvatarUrl || user.avatarUrl || "",
        isKycVerified: Boolean(user.isKycVerified),
        isOgVerified: Boolean(user.isOgVerified),
        isTrustedBadge: Boolean(user.isTrustedBadge),
        createdAt: user.createdAt,
      })),
      lots,
      mandiRates: mandiRates.map((rate) => ({
        _id: rate._id,
        category: "mandi-rate",
        title: `${rate.commodity || "Fruit"} Mandi Rate - ${rate.market || "Market"}`,
        subtitle: [rate.district, rate.state].filter(Boolean).join(", "),
        price: formatPrice(rate.modalPriceKg),
        date: rate.arrivalDate,
        commodity: rate.commodity,
        variety: rate.variety,
        market: rate.market,
        district: rate.district,
        state: rate.state,
      })),
    });
  } catch (err) {
    console.error("Universal search error:", err);
    return res.status(500).json({ msg: "Search failed" });
  }
});

export default router;


