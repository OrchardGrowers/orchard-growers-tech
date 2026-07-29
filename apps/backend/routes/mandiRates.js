import express from "express";
import MandiRate from "../models/MandiRate.js";
import {
  getAvailableMandiFruitSlugs,
  getFruitCategories,
  syncCommodityMaster,
  syncMandiRates,
} from "../services/mandiRateService.js";
import { normalizeCommodityName } from "../models/FruitCategory.js";
import {
  FRUIT_ENTITIES,
  getFruitCommodityAliases,
} from "../../../packages/shared-config/fruitSearch.mjs";

const router = express.Router();
const MANDI_RATE_SOURCE = "data.gov.in-agmarknet";

const escapeRegex = (value = "") =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeText = (value = "") => String(value || "").trim();

const exactRegex = (value) => new RegExp(`^${escapeRegex(value)}$`, "i");

export const buildExactCommodityMatchers = (values = []) =>
  (Array.isArray(values) ? values : []).map(exactRegex);

const getAllowedCommodityNames = (categories = []) =>
  Array.from(
    new Set(
      categories
        .flatMap((category) => [
          category.commodity,
          category.displayName,
          ...(Array.isArray(category.aliases) ? category.aliases : []),
        ])
        .map(normalizeText)
        .filter(Boolean)
    )
  );

export const getCommodityFilterValues = (categories, value) => {
  const configuredAliases = getFruitCommodityAliases(value);
  const normalizedTargets = new Set(
    (configuredAliases.length ? configuredAliases : [value]).map(normalizeCommodityName)
  );
  const matches = categories.filter((category) =>
    [category.commodity, category.displayName, ...(category.aliases || [])]
      .map(normalizeCommodityName)
      .some((candidate) => normalizedTargets.has(candidate))
  );

  if (!configuredAliases.length && !matches.length) return [];

  return Array.from(
    new Map(
      [
        ...configuredAliases,
        ...matches.flatMap((match) => [
          match.commodity,
          match.displayName,
          ...(match.aliases || []),
        ]),
      ]
        .map(normalizeText)
        .filter(Boolean)
        .map((candidate) => [normalizeCommodityName(candidate), candidate])
    ).values()
  );
};

const buildMandiRateQuery = async (query = {}) => {
  const fruitCategories = await getFruitCategories();
  const fruitCommodityNames = getAllowedCommodityNames(fruitCategories);

  if (!fruitCommodityNames.length) return null;

  const filter = {
    commodity: { $in: fruitCommodityNames },
  };

  ["state", "district", "market", "commodity"].forEach((field) => {
    const value = normalizeText(query[field]);
    if (!value) return;

    if (field === "commodity") {
      const matchedCommodities = getCommodityFilterValues(fruitCategories, value);
      filter.commodity = matchedCommodities.length
        ? { $in: buildExactCommodityMatchers(matchedCommodities) }
        : "__NO_FRUIT_MATCH__";
      return;
    }

    filter[field] = exactRegex(value);
  });

  const q = normalizeText(query.q || query.search);
  if (q) {
    const regex = new RegExp(escapeRegex(q), "i");
    filter.$or = [
      { state: regex },
      { district: regex },
      { market: regex },
      { commodity: regex },
      { variety: regex },
      { grade: regex },
    ];
  }

  return filter.commodity === "__NO_FRUIT_MATCH__" ? null : filter;
};

export const formatMandiRate = (rate = {}) => {
  const minPrice = Number(rate.minPrice || 0);
  const maxPrice = Number(rate.maxPrice || 0);
  const modalPrice = Number(rate.modalPrice || 0);

  return {
    ...rate,
    id: String(rate._id || rate.id || ""),
    mandi: rate.market || "",
    fruit: rate.commodity || "",
    daily: { min: minPrice, max: maxPrice, avg: modalPrice },
    weekly: { min: minPrice, max: maxPrice, avg: modalPrice },
    monthly: { min: minPrice, max: maxPrice, avg: modalPrice },
    trend: "Live",
  };
};

router.get("/", async (req, res) => {
  try {
    const filter = await buildMandiRateQuery(req.query);
    if (!filter) {
      return res.json({
        source: MANDI_RATE_SOURCE,
        count: 0,
        records: [],
      });
    }

    const records = await MandiRate.find(filter)
      .sort({ arrivalDate: -1 })
      .limit(300)
      .lean();

    return res.json({
      source: MANDI_RATE_SOURCE,
      count: records.length,
      records: records.map(formatMandiRate),
    });
  } catch (error) {
    console.error("Mandi rates query error:", error);
    return res.status(500).json({ msg: "Unable to load mandi rates" });
  }
});

router.get("/latest", async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);
    const filter = await buildMandiRateQuery({});

    if (!filter) {
      return res.json({
        source: MANDI_RATE_SOURCE,
        count: 0,
        records: [],
      });
    }

    const records = await MandiRate.find(filter)
      .sort({ arrivalDate: -1, syncedAt: -1, _id: -1 })
      .limit(limit)
      .lean();

    return res.json({
      source: MANDI_RATE_SOURCE,
      count: records.length,
      records: records.map(formatMandiRate),
    });
  } catch (error) {
    console.error("Latest mandi rates query error:", error);
    return res.status(500).json({ msg: "Unable to load latest mandi rates" });
  }
});

router.get("/fruits", async (req, res) => {
  const categories = await getFruitCategories();
  res.json({
    fruits: categories.map((category) => category.displayName || category.commodity),
    categories: categories.map((category) => ({
      _id: category._id,
      commodity: category.commodity,
      displayName: category.displayName || category.commodity,
      aliases: category.aliases || [],
      category: category.category,
      isFruit: Boolean(category.isFruit),
    })),
  });
});

router.get("/available-fruits", async (req, res) => {
  try {
    const slugs = await getAvailableMandiFruitSlugs();
    const availableSet = new Set(slugs);
    return res.json({
      source: MANDI_RATE_SOURCE,
      slugs,
      fruits: FRUIT_ENTITIES.filter((fruit) => availableSet.has(fruit.slug)).map((fruit) => ({
        name: fruit.name,
        slug: fruit.slug,
      })),
    });
  } catch (error) {
    console.error("Available mandi fruits query error:", error);
    return res.status(500).json({ msg: "Unable to load available mandi fruits" });
  }
});

router.post("/commodities/sync", async (req, res) => {
  try {
    const summary = await syncCommodityMaster({
      limit: req.body?.limit || req.query.limit,
      offset: req.body?.offset || req.query.offset,
      maxPages: req.body?.maxPages || req.query.maxPages,
    });

    res.json({
      success: true,
      ...summary,
    });
  } catch (error) {
    console.error("Mandi commodity sync error:", error);
    res.status(500).json({
      success: false,
      msg: error.message || "Unable to sync mandi commodities",
    });
  }
});

router.post("/sync", async (req, res) => {
  try {
    const summary = await syncMandiRates({
      limit: req.body?.limit || req.query.limit,
      offset: req.body?.offset || req.query.offset,
      maxPages: req.body?.maxPages || req.query.maxPages,
      masterLimit: req.body?.masterLimit || req.query.masterLimit,
      masterMaxPages: req.body?.masterMaxPages || req.query.masterMaxPages,
      commodities: req.body?.commodities,
    });

    res.json({
      success: true,
      ...summary,
    });
  } catch (error) {
    console.error("Mandi rates sync error:", error);
    res.status(500).json({
      success: false,
      msg: error.message || "Unable to sync mandi rates",
    });
  }
});

export default router;
