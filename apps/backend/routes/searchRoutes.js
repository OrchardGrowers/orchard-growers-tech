import express from "express";
import User from "../models/User.js";
import Product from "../models/Product.js";
import MandiRate from "../models/MandiRate.js";
import { getFruitCommodityNames } from "../services/mandiRateService.js";
import {
  getSearchContext,
  normalizeSearchText,
  rankSearchResults,
} from "../../../packages/shared-config/fruitSearch.mjs";

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

    let searchContext = getSearchContext(q);

    const marketplaceIntentRegex =
      /\b(fruit lots?|live fruit lots?|available lots?|upcoming lots?|upcoming fruit lots?|deals?|live deals?|fruit deals?|auction|auctions|quote|quotes|quotation|marketplace)\b/i;

    const isMarketplaceIntent =
      searchContext.intent === "fruit_lot" || marketplaceIntentRegex.test(q);

    const fruitCommodityNames = await getFruitCommodityNames();
    if (!searchContext.fruit) {
      const dynamicFruitName = fruitCommodityNames.find(
        (name) => normalizeSearchText(name) === searchContext.subjectQuery
      );
      if (dynamicFruitName) {
        const normalizedName = normalizeSearchText(dynamicFruitName);
        searchContext = {
          ...searchContext,
          fruit: {
            name: dynamicFruitName,
            slug: normalizedName.replace(/\s+/g, "-"),
            normalizedName,
            aliases: [normalizedName],
          },
        };
      }
    }
    const searchableQuery = searchContext.subjectQuery || q;
    const searchTerms = searchContext.fruit
      ? [searchContext.fruit.name, ...searchContext.fruit.aliases]
      : [searchableQuery];
    const regex = new RegExp(
      searchTerms
        .map(normalizeText)
        .filter(Boolean)
        .sort((a, b) => b.length - a.length)
        .map(escapeRegex)
        .join("|"),
      "i"
    );

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
          "name role activeRole profileTypes orchardName businessName buyerContactPerson buyerLocation logisticsName driverName vehicleNumber location companyLogoUrl buyerCompanyLogoUrl isKycVerified isOgVerified isTrustedBadge createdAt"
        )
        .limit(Math.min(limit * 3, 100))
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
        .limit(Math.min(limit * 3, 100))
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
            .limit(Math.min(limit * 3, 100))
            .lean()
        : Promise.resolve([]),
    ]);

    const profileResults = rankSearchResults(profiles.map((user) => {
      const type = getProfileRole(user);
      return {
        _id: user._id,
        type,
        title: getProfileTitle(user),
        name: user.name,
        role: user.role,
        activeRole: user.activeRole,
        profileTypes: user.profileTypes || [],
        location: user.buyerLocation || user.location || "",
        image: user.buyerCompanyLogoUrl || user.companyLogoUrl || "",
        isKycVerified: Boolean(user.isKycVerified),
        isOgVerified: Boolean(user.isOgVerified),
        isTrustedBadge: Boolean(user.isTrustedBadge),
        createdAt: user.createdAt,
        resultType: String(type).toLowerCase(),
      };
    }), searchContext).slice(0, limit);

    const lotResults = rankSearchResults(lots.map((lot) => ({
      ...lot,
      resultType: "fruit_lot",
    })), searchContext).slice(0, limit);

    const liveMandiResults = mandiRates.map((rate) => ({
        _id: rate._id,
        category: "mandi-rate",
        resultType: "mandi_rate",
        title: `${rate.commodity || "Fruit"} Mandi Rate - ${rate.market || "Market"}`,
        subtitle: [rate.district, rate.state].filter(Boolean).join(", "),
        price: formatPrice(rate.modalPriceKg),
        date: rate.arrivalDate,
        commodity: rate.commodity,
        variety: rate.variety,
        market: rate.market,
        district: rate.district,
        state: rate.state,
        url: searchContext.fruit ? `/mandi-rates/${searchContext.fruit.slug}` : "",
      }));
    const rankedLiveMandiResults = rankSearchResults(liveMandiResults, searchContext);

    const directMandiResult = searchContext.fruit
      ? {
          _id: `mandi-page-${searchContext.fruit.slug}`,
          category: "mandi-rate",
          resultType: "mandi_rate",
          title: `${searchContext.fruit.name} Mandi Price Today`,
          subtitle: rankedLiveMandiResults[0]
            ? [
                rankedLiveMandiResults[0].market,
                rankedLiveMandiResults[0].district,
                rankedLiveMandiResults[0].state,
              ]
                .filter(Boolean)
                .join(", ")
            : "No live rate available",
          price: rankedLiveMandiResults[0]?.price || "No live rate available",
          date: rankedLiveMandiResults[0]?.date || null,
          commodity: searchContext.fruit.name,
          url: `/mandi-rates/${searchContext.fruit.slug}`,
          isDirectResult: true,
        }
      : null;

    const mandiRateResults = rankSearchResults(
      [directMandiResult, ...rankedLiveMandiResults].filter(Boolean),
      searchContext
    ).slice(0, limit);

    return res.json({
      profiles: profileResults,
      lots: lotResults,
      mandiRates: mandiRateResults,
      matchedFruit: searchContext.fruit?.name || null,
      matchedIntent: searchContext.intent,
    });
  } catch (err) {
    console.error("Universal search error:", err);
    return res.status(500).json({ msg: "Search failed" });
  }
});

export default router;


