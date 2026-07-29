import axios from "axios";
import FruitCategory, { normalizeCommodityName } from "../models/FruitCategory.js";
import MandiRate from "../models/MandiRate.js";
import { getDataBackedMandiSlugs } from "../../../packages/shared-config/fruitSearch.mjs";

const DATA_GOV_RESOURCE_ID = "9ef84268-d588-465a-a308-a864a43d0070";
const DATA_GOV_BASE_URL = `https://api.data.gov.in/resource/${DATA_GOV_RESOURCE_ID}`;
const MANDI_RATE_SOURCE = "data.gov.in-agmarknet";
const MANDI_RATE_UNIT = "INR/quintal";

const DEFAULT_FRUIT_COMMODITY_SEEDS = Object.freeze([
  "Apple",
  "Banana",
  "Mango",
  "Orange",
  "Papaya",
  "Pomegranate",
  "Grapes",
  "Guava",
  "Pineapple",
  "Water Melon",
  "Musk Melon",
  "Pear",
  "Plum",
  "Peach",
  "Apricot",
  "Cherry",
  "Litchi",
  "Lime",
  "Lemon",
  "Sweet Lime",
  "Sapota",
  "Ber",
  "Custard Apple",
  "Jack Fruit",
]);

export const FRUIT_COMMODITIES = DEFAULT_FRUIT_COMMODITY_SEEDS;

const clampNumber = (value, fallback, min, max) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(Math.max(number, min), max);
};

const cleanText = (value) => String(value || "").replace(/\s+/g, " ").trim();

const normalizeKey = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");

const getField = (record, keys) => {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
  }

  const normalizedKeys = new Set(keys.map(normalizeKey));
  const match = Object.entries(record).find(([key]) => normalizedKeys.has(normalizeKey(key)));
  return match ? match[1] : "";
};

const toNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(number) ? number : null;
};

const toKgRate = (value) => (Number.isFinite(value) ? Number((value / 100).toFixed(2)) : null);

const parseArrivalDate = (value) => {
  const raw = cleanText(value);
  if (!raw) return null;

  const dmy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const [, day, month, year] = dmy;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const ymd = raw.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (ymd) {
    const [, year, month, day] = ymd;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
};

const uniqueSorted = (items = []) =>
  Array.from(new Set(items.map(cleanText).filter(Boolean))).sort((a, b) => a.localeCompare(b));

const fetchMandiPage = async ({ apiKey, limit, offset, commodity }) => {
  const params = {
    "api-key": apiKey,
    format: "json",
    limit,
    offset,
  };

  if (commodity) params["filters[commodity]"] = commodity;

  const response = await axios.get(DATA_GOV_BASE_URL, {
    params,
    timeout: 20000,
  });

  return response.data || {};
};

const extractCommodity = (record = {}) => cleanText(getField(record, ["commodity", "Commodity"]));

export const ensureSeedFruitCategories = async () => {
  const now = new Date();

  await Promise.all(
    DEFAULT_FRUIT_COMMODITY_SEEDS.map((commodity) =>
      FruitCategory.updateOne(
        { normalizedCommodity: normalizeCommodityName(commodity) },
        {
          $setOnInsert: {
            commodity,
            normalizedCommodity: normalizeCommodityName(commodity),
            displayName: commodity,
            category: "fruit",
            isFruit: true,
            source: "admin-seed",
            firstSeenAt: now,
            lastSeenAt: now,
            seenCount: 0,
          },
        },
        { upsert: true }
      )
    )
  );
};

export const upsertCommodityCategoryFromRecord = async (record, syncedAt = new Date()) => {
  const commodity = extractCommodity(record);
  if (!commodity) return null;

  const normalizedCommodity = normalizeCommodityName(commodity);

  return FruitCategory.findOneAndUpdate(
    { normalizedCommodity },
    {
      $set: {
        commodity,
        lastSeenAt: syncedAt,
      },
      $setOnInsert: {
        normalizedCommodity,
        displayName: commodity,
        source: MANDI_RATE_SOURCE,
        category: "uncategorized",
        isFruit: false,
        firstSeenAt: syncedAt,
      },
      $inc: { seenCount: 1 },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
};

export const getFruitCategories = async () => {
  await ensureSeedFruitCategories();

  return FruitCategory.find({ isFruit: true })
    .sort({ displayName: 1, commodity: 1 })
    .lean();
};

export const getFruitCommodityNames = async () => {
  const categories = await getFruitCategories();

  return uniqueSorted(
    categories.flatMap((category) => [
      category.commodity,
      category.displayName,
      ...(Array.isArray(category.aliases) ? category.aliases : []),
    ])
  );
};

export const getAvailableMandiFruitSlugs = async () => {
  const commodities = await MandiRate.distinct("commodity", {
    commodity: { $type: "string", $ne: "" },
  });
  return getDataBackedMandiSlugs(commodities);
};

const normalizeRecord = (record, syncedAt) => {
  const commodity = extractCommodity(record);
  const state = cleanText(getField(record, ["state", "State"]));
  const district = cleanText(getField(record, ["district", "District"]));
  const market = cleanText(getField(record, ["market", "Market"]));
  const variety = cleanText(getField(record, ["variety", "Variety"]));
  const grade = cleanText(getField(record, ["grade", "Grade"]));
  const arrivalDate = parseArrivalDate(
    getField(record, ["arrival_date", "arrivalDate", "arrival date", "Arrival_Date"])
  );

  if (!state || !district || !market || !commodity || !arrivalDate) return null;

  const minPrice = toNumber(getField(record, ["min_price", "minPrice", "minimum_price", "Min_Price"]));
  const maxPrice = toNumber(getField(record, ["max_price", "maxPrice", "maximum_price", "Max_Price"]));
  const modalPrice = toNumber(
    getField(record, ["modal_price", "model_price", "modalPrice", "Modal_Price"])
  );

  return {
    state,
    district,
    market,
    commodity,
    variety,
    grade,
    arrivalDate,
    minPrice,
    maxPrice,
    modalPrice,
    minPriceKg: toKgRate(minPrice),
    maxPriceKg: toKgRate(maxPrice),
    modalPriceKg: toKgRate(modalPrice),
    unit: MANDI_RATE_UNIT,
    source: MANDI_RATE_SOURCE,
    syncedAt,
  };
};

const upsertMandiRate = (record) =>
  MandiRate.updateOne(
    {
      state: record.state,
      district: record.district,
      market: record.market,
      commodity: record.commodity,
      variety: record.variety,
      grade: record.grade,
      arrivalDate: record.arrivalDate,
    },
    { $set: record },
    { upsert: true }
  );

export async function syncCommodityMaster(options = {}) {
  const apiKey = process.env.DATA_GOV_API_KEY;
  if (!apiKey) {
    throw new Error("DATA_GOV_API_KEY is required to sync AGMARKNET commodity master data.");
  }

  await ensureSeedFruitCategories();

  const limit = clampNumber(options.limit ?? process.env.MANDI_MASTER_SYNC_LIMIT, 1000, 1, 1000);
  const startOffset = clampNumber(options.offset, 0, 0, Number.MAX_SAFE_INTEGER);
  const maxPages = clampNumber(options.maxPages ?? process.env.MANDI_MASTER_SYNC_MAX_PAGES, 200, 1, 500);
  const syncedAt = new Date();
  const seen = new Set();
  let offset = startOffset;

  const summary = {
    source: MANDI_RATE_SOURCE,
    resourceId: DATA_GOV_RESOURCE_ID,
    fetched: 0,
    commoditiesSeen: 0,
    categoriesUpserted: 0,
    pages: 0,
    syncedAt,
    errors: [],
  };

  for (let page = 0; page < maxPages; page += 1) {
    try {
      const payload = await fetchMandiPage({ apiKey, limit, offset });
      const records = Array.isArray(payload.records) ? payload.records : [];
      summary.fetched += records.length;
      summary.pages += 1;

      if (!records.length) break;

      for (const rawRecord of records) {
        const commodity = extractCommodity(rawRecord);
        if (!commodity) continue;
        seen.add(normalizeCommodityName(commodity));
        await upsertCommodityCategoryFromRecord(rawRecord, syncedAt);
        summary.categoriesUpserted += 1;
      }

      const total = Number(payload.total);
      if (records.length < limit || (Number.isFinite(total) && offset + records.length >= total)) {
        break;
      }

      offset += limit;
    } catch (error) {
      summary.errors.push({
        offset,
        message: error?.response?.data?.message || error.message || "Unable to fetch AGMARKNET commodity master data",
      });
      break;
    }
  }

  summary.commoditiesSeen = seen.size;
  return summary;
}

export async function syncMandiRates(options = {}) {
  const apiKey = process.env.DATA_GOV_API_KEY;
  if (!apiKey) {
    throw new Error("DATA_GOV_API_KEY is required to sync mandi rates.");
  }

  const masterSummary = await syncCommodityMaster({
    limit: options.masterLimit ?? process.env.MANDI_MASTER_SYNC_LIMIT,
    offset: options.masterOffset ?? 0,
    maxPages: options.masterMaxPages ?? process.env.MANDI_MASTER_SYNC_MAX_PAGES,
  });

  const limit = clampNumber(options.limit ?? process.env.MANDI_SYNC_LIMIT, 1000, 1, 1000);
  const startOffset = clampNumber(options.offset, 0, 0, Number.MAX_SAFE_INTEGER);
  const maxPages = clampNumber(options.maxPages ?? process.env.MANDI_SYNC_MAX_PAGES, 25, 1, 200);
  const fruitCommodityNames = await getFruitCommodityNames();
  const requestedCommodities = Array.isArray(options.commodities) && options.commodities.length
    ? options.commodities.filter((commodity) =>
        fruitCommodityNames.some((fruitName) => normalizeCommodityName(fruitName) === normalizeCommodityName(commodity))
      )
    : fruitCommodityNames;
  const commodities = uniqueSorted(requestedCommodities);
  const fruitSet = new Set(commodities.map(normalizeCommodityName));
  const syncedAt = new Date();

  const summary = {
    source: MANDI_RATE_SOURCE,
    resourceId: DATA_GOV_RESOURCE_ID,
    master: masterSummary,
    fetched: 0,
    imported: 0,
    skipped: 0,
    upserted: 0,
    modified: 0,
    matched: 0,
    pages: 0,
    commodities: commodities.length,
    syncedAt,
    errors: [],
  };

  for (const commodity of commodities) {
    let offset = startOffset;

    for (let page = 0; page < maxPages; page += 1) {
      try {
        const payload = await fetchMandiPage({ apiKey, limit, offset, commodity });
        const records = Array.isArray(payload.records) ? payload.records : [];
        summary.fetched += records.length;
        summary.pages += 1;

        if (!records.length) break;

        for (const rawRecord of records) {
          await upsertCommodityCategoryFromRecord(rawRecord, syncedAt);
          const normalizedCommodity = normalizeCommodityName(extractCommodity(rawRecord));

          if (!fruitSet.has(normalizedCommodity)) {
            summary.skipped += 1;
            continue;
          }

          const normalized = normalizeRecord(rawRecord, syncedAt);
          if (!normalized) {
            summary.skipped += 1;
            continue;
          }

          const result = await upsertMandiRate(normalized);
          summary.imported += 1;
          summary.upserted += result.upsertedCount || 0;
          summary.modified += result.modifiedCount || 0;
          summary.matched += result.matchedCount || 0;
        }

        const total = Number(payload.total);
        if (records.length < limit || (Number.isFinite(total) && offset + records.length >= total)) {
          break;
        }

        offset += limit;
      } catch (error) {
        summary.errors.push({
          commodity,
          offset,
          message: error?.response?.data?.message || error.message || "Unable to fetch mandi rates",
        });
        break;
      }
    }
  }

  return summary;
}

export default syncMandiRates;
