import express from "express";

const router = express.Router();

const DATA_GOV_RESOURCE =
  "current-daily-price-various-commodities-various-markets-mandi";

const fallbackRates = [
  {
    id: "shimla-apple",
    mandi: "Shimla Fruit Mandi",
    state: "Himachal Pradesh",
    fruit: "Apple",
    grade: "A+",
    daily: { min: 1800, max: 2600, avg: 2200 },
    weekly: { min: 1700, max: 2550, avg: 2140 },
    monthly: { min: 1550, max: 2480, avg: 2020 },
    trend: "+6%",
    date: new Date().toISOString(),
  },
  {
    id: "azadpur-apple",
    mandi: "Azadpur Mandi",
    state: "Delhi",
    fruit: "Apple",
    grade: "A",
    daily: { min: 1500, max: 2300, avg: 1900 },
    weekly: { min: 1450, max: 2200, avg: 1840 },
    monthly: { min: 1350, max: 2100, avg: 1730 },
    trend: "+3%",
    date: new Date().toISOString(),
  },
  {
    id: "nashik-grapes",
    mandi: "Nashik APMC",
    state: "Maharashtra",
    fruit: "Grapes",
    grade: "Export",
    daily: { min: 900, max: 1450, avg: 1180 },
    weekly: { min: 850, max: 1380, avg: 1110 },
    monthly: { min: 780, max: 1320, avg: 1030 },
    trend: "+4%",
    date: new Date().toISOString(),
  },
];

const toNumber = (value) => {
  const number = Number(String(value || "").replace(/,/g, ""));
  return Number.isFinite(number) ? number : 0;
};

const normalizeRecord = (record, index) => {
  const min = toNumber(record.min_price);
  const max = toNumber(record.max_price);
  const avg = toNumber(record.modal_price || record.model_price);
  const safeAvg = avg || Math.round((min + max) / 2);

  return {
    id: `${record.state || "india"}-${record.market || "mandi"}-${
      record.commodity || "fruit"
    }-${index}`,
    mandi: record.market || "Govt. Fruit Mandi",
    state: record.state || "India",
    fruit: record.commodity || "Fruit",
    grade: record.variety || "Standard",
    daily: { min, max, avg: safeAvg },
    weekly: { min, max, avg: safeAvg },
    monthly: { min, max, avg: safeAvg },
    trend: "Live",
    date: record.arrival_date || record.created_date || new Date().toISOString(),
  };
};

router.get("/", async (req, res) => {
  const apiKey = process.env.DATA_GOV_API_KEY;
  const limit = Math.min(Number(req.query.limit || 100), 500);
  const search = String(req.query.search || "").trim().toLowerCase();

  if (!apiKey) {
    return res.json({
      source: "fallback",
      msg: "Set DATA_GOV_API_KEY in backend .env to enable live Data.gov.in rates.",
      records: fallbackRates,
    });
  }

  try {
    const url = new URL(`https://api.data.gov.in/resource/${DATA_GOV_RESOURCE}`);
    url.searchParams.set("api-key", apiKey);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", String(limit));

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Data.gov.in returned ${response.status}`);
    }

    const payload = await response.json();
    let records = (payload.records || []).map(normalizeRecord);

    if (search) {
      records = records.filter((rate) =>
        `${rate.mandi} ${rate.state} ${rate.fruit} ${rate.grade}`
          .toLowerCase()
          .includes(search)
      );
    }

    res.json({
      source: "data.gov.in",
      count: records.length,
      updatedAt: new Date().toISOString(),
      records: records.length ? records : fallbackRates,
    });
  } catch (err) {
    res.json({
      source: "fallback",
      msg: err.message,
      records: fallbackRates,
    });
  }
});

export default router;
