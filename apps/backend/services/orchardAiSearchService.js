import axios from "axios";

const GOOGLE_SEARCH_URL = "https://www.googleapis.com/customsearch/v1";

const SEARCH_CX_BY_CATEGORY = {
  growers: "GOOGLE_CX_GROWERS",
  buyers: "GOOGLE_CX_BUYERS",
  exporters: "GOOGLE_CX_EXPORTERS",
  markets: "GOOGLE_CX_MARKETS",
  research: "GOOGLE_CX_RESEARCH",
};

const normalizeCategory = (value = "buyers") => {
  const category = String(value || "").trim().toLowerCase();
  return SEARCH_CX_BY_CATEGORY[category] ? category : "buyers";
};

const getGoogleSearchConfig = (category) => {
  const normalizedCategory = normalizeCategory(category);
  const apiKey = process.env.GOOGLE_PROGRAMMABLE_SEARCH_API_KEY;
  const cxEnvName = SEARCH_CX_BY_CATEGORY[normalizedCategory];
  const cx = process.env[cxEnvName];

  if (!apiKey) {
    throw new Error("GOOGLE_PROGRAMMABLE_SEARCH_API_KEY is not configured");
  }

  if (!cx) {
    throw new Error(`${cxEnvName} is not configured`);
  }

  return { apiKey, cx, category: normalizedCategory };
};

export const buildLeadSearchQuery = ({ query, fruit, state, city, leadType }) => {
  if (query && String(query).trim()) return String(query).trim();

  const parts = [
    fruit,
    leadType,
    "fruit",
    "business",
    city,
    state,
    "India",
    "phone email contact",
  ].filter(Boolean);

  return parts.join(" ");
};

export const searchGoogleProgrammable = async ({
  category = "buyers",
  query,
  fruit,
  state,
  city,
  leadType,
  limit = 10,
}) => {
  const { apiKey, cx, category: selectedCategory } = getGoogleSearchConfig(category);
  const q = buildLeadSearchQuery({ query, fruit, state, city, leadType });
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 10);

  const response = await axios.get(GOOGLE_SEARCH_URL, {
    params: {
      key: apiKey,
      cx,
      q,
      num: safeLimit,
    },
    timeout: 20000,
  });

  const items = Array.isArray(response.data?.items) ? response.data.items : [];

  return {
    category: selectedCategory,
    query: q,
    totalResults: Number(response.data?.searchInformation?.totalResults || 0),
    results: items.map((item) => ({
      title: item.title || "",
      snippet: item.snippet || "",
      link: item.link || "",
      displayLink: item.displayLink || "",
    })),
  };
};
