import mongoose from "mongoose";
import Lead, {
  LEAD_TYPES,
} from "../models/Lead.js";
import {
  findExistingOrchardAiLead,
  isOrchardAiLeadDuplicateError,
} from "./orchardAiLeadDeduplicationService.js";
import { searchGoogleProgrammable } from "./orchardAiSearchService.js";

export const GOOGLE_CUSTOM_SEARCH_ACCESS_DENIED_MESSAGE =
  "Google CSE unavailable. Use manual import or URL extractor.";

export const SEARCH_PROVIDER_DISABLED_MESSAGE =
  "Search provider disabled. Use manual import or URL extractor.";

const GOOGLE_CUSTOM_SEARCH_RATE_LIMIT_MESSAGE =
  "Google Custom Search quota or rate limit reached. Try again later.";

const COLLECTOR_CATEGORIES = new Set([
  "growers",
  "buyers",
  "exporters",
  "markets",
  "research",
]);

const DEFAULT_LEAD_TYPE_BY_CATEGORY = {
  growers: "Grower",
  buyers: "Buyer",
  exporters: "Exporter",
  markets: "Buyer",
  research: "Buyer",
};

const createCollectorError = (message, statusCode = 400, code = "COLLECTOR_VALIDATION_ERROR") => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
};

export const isGoogleSearchProviderEnabled = () =>
  ["google", "google-cse", "google_cse"].includes(
    String(process.env.SEARCH_PROVIDER || "disabled").trim().toLowerCase()
  );

const cleanText = (value, fallback = "", maximumLength = 500) => {
  const text = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return (text || fallback).slice(0, maximumLength);
};

const normalizeCategory = (value) => {
  const category = cleanText(value, "buyers", 40).toLowerCase();
  if (!COLLECTOR_CATEGORIES.has(category)) {
    throw createCollectorError(
      `category must be one of: ${Array.from(COLLECTOR_CATEGORIES).join(", ")}`
    );
  }
  return category;
};

const normalizeLeadType = (value, category) => {
  const requested = cleanText(value, DEFAULT_LEAD_TYPE_BY_CATEGORY[category], 80);
  const leadType = LEAD_TYPES.find(
    (option) => option.toLowerCase() === requested.toLowerCase()
  );
  if (!leadType) {
    throw createCollectorError(`leadType must be one of: ${LEAD_TYPES.join(", ")}`);
  }
  return leadType;
};

const normalizeLimit = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 10;
  return Math.min(Math.max(Math.floor(parsed), 1), 10);
};

export const normalizeCollectorRequest = (input = {}) => {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw createCollectorError("Collector input must be an object");
  }

  const category = normalizeCategory(input.category);
  const actorId = String(input.actorId || input.createdBy || "").trim();
  if (!mongoose.isValidObjectId(actorId)) {
    throw createCollectorError(
      "A valid collector admin ID is required",
      400,
      "COLLECTOR_ACTOR_REQUIRED"
    );
  }

  return {
    category,
    query: cleanText(input.query, "", 500),
    fruit: cleanText(input.fruit, "", 80),
    state: cleanText(input.state, "", 120),
    city: cleanText(input.city, "", 120),
    leadType: normalizeLeadType(input.leadType, category),
    limit: normalizeLimit(input.limit),
    actorId,
  };
};

const getSafeResultLink = (value) => {
  const link = cleanText(value, "", 1000);
  if (!link) return "";

  try {
    const parsed = new URL(link);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString() : "";
  } catch {
    return "";
  }
};

const getWebsiteValue = (link) => {
  if (link.length <= 500) return link;
  try {
    return new URL(link).origin;
  } catch {
    return "";
  }
};

export const buildCollectedLeadPayload = ({
  result,
  request,
  resolvedQuery,
}) => {
  const companyName = cleanText(result?.title, "", 200);
  const sourceUrl = getSafeResultLink(result?.link);
  if (!companyName) {
    throw createCollectorError(
      "Search result does not include a company title",
      422,
      "COLLECTOR_RESULT_INVALID"
    );
  }
  if (!sourceUrl) {
    throw createCollectorError(
      "Search result does not include a valid public URL",
      422,
      "COLLECTOR_RESULT_INVALID"
    );
  }

  const snippet = cleanText(result?.snippet, "No search snippet was provided.", 3500);
  const displayLink = cleanText(result?.displayLink, "", 80);
  const sourcePlatform =
    displayLink || cleanText(new URL(sourceUrl).hostname.replace(/^www\./, ""), "Google CSE", 80);

  return {
    companyName,
    contactPerson: "To be verified",
    leadType: request.leadType,
    fruits: request.fruit ? [request.fruit] : [],
    city: request.city,
    state: request.state,
    address: "",
    phone: "",
    email: "",
    whatsapp: "",
    website: getWebsiteValue(sourceUrl),
    sourceUrl,
    sourcePlatform,
    score: 40,
    priority: "Medium",
    status: "New",
    assignedTo: null,
    notes: `Search snippet: ${snippet}\nOriginal query: ${cleanText(
      resolvedQuery || request.query,
      "Not provided",
      500
    )}`,
    tags: ["ai-collected", "google-cse", "needs-verification"],
    createdBy: request.actorId,
    updatedBy: request.actorId,
  };
};

const getSafeGoogleError = (error) => {
  const status = Number(error?.response?.status || error?.status || 0);
  if (status === 403) {
    return {
      status,
      message: GOOGLE_CUSTOM_SEARCH_ACCESS_DENIED_MESSAGE,
    };
  }
  if (status === 429) {
    return {
      status,
      message: GOOGLE_CUSTOM_SEARCH_RATE_LIMIT_MESSAGE,
    };
  }
  if (
    typeof error?.message === "string" &&
    error.message.includes("is not configured")
  ) {
    return {
      status: 503,
      message: error.message,
    };
  }
  return {
    status: status || 502,
    message: "Google Custom Search request failed. Try again later.",
  };
};

const createSearchFailureSummary = (request, safeError) => ({
  ok: false,
  category: request.category,
  query: request.query,
  totalResults: 0,
  resultCount: 0,
  created: 0,
  skipped: 0,
  errors: 1,
  createdLeads: [],
  skippedItems: [],
  errorItems: [
    {
      stage: "search",
      status: safeError.status,
      message: safeError.message,
    },
  ],
  message: safeError.message,
});

export const collectOrchardAiLeadsFromGoogle = async (
  input,
  dependencies = {}
) => {
  const request = normalizeCollectorRequest(input);
  if (!isGoogleSearchProviderEnabled() && !dependencies.allowDisabledProvider) {
    return {
      ok: false,
      disabled: true,
      category: request.category,
      query: request.query,
      totalResults: 0,
      resultCount: 0,
      created: 0,
      skipped: 0,
      errors: 0,
      createdLeads: [],
      skippedItems: [],
      errorItems: [],
      message: SEARCH_PROVIDER_DISABLED_MESSAGE,
    };
  }

  const search = dependencies.search || searchGoogleProgrammable;
  const LeadModel = dependencies.LeadModel || Lead;
  let searchResponse;

  try {
    searchResponse = await search({
      category: request.category,
      query: request.query,
      fruit: request.fruit,
      state: request.state,
      city: request.city,
      leadType: request.leadType,
      limit: request.limit,
    });
  } catch (error) {
    return createSearchFailureSummary(request, getSafeGoogleError(error));
  }

  const results = Array.isArray(searchResponse?.results)
    ? searchResponse.results.slice(0, request.limit)
    : [];
  const createdLeads = [];
  const skippedItems = [];
  const errorItems = [];

  for (const result of results) {
    let payload;
    try {
      payload = buildCollectedLeadPayload({
        result,
        request,
        resolvedQuery: searchResponse?.query,
      });
      const duplicate = await findExistingOrchardAiLead(payload, { LeadModel });
      if (duplicate) {
        skippedItems.push({
          companyName: payload.companyName,
          sourceUrl: payload.sourceUrl,
          reason: "Possible duplicate website, source URL, or company name",
        });
        continue;
      }

      const lead = await LeadModel.create(payload);
      createdLeads.push({
        id: String(lead._id),
        companyName: lead.companyName,
        website: lead.website || "",
        sourceUrl: lead.sourceUrl || "",
      });
    } catch (error) {
      if (isOrchardAiLeadDuplicateError(error)) {
        skippedItems.push({
          companyName: payload?.companyName || cleanText(result?.title, "Unknown lead", 200),
          sourceUrl: payload?.sourceUrl || getSafeResultLink(result?.link),
          reason: "Duplicate lead",
        });
        continue;
      }

      errorItems.push({
        companyName: payload?.companyName || cleanText(result?.title, "Unknown lead", 200),
        sourceUrl: payload?.sourceUrl || getSafeResultLink(result?.link),
        message:
          error?.code === "COLLECTOR_RESULT_INVALID"
            ? error.message
            : "Lead could not be created from this search result",
      });
    }
  }

  const summary = {
    ok: errorItems.length === 0,
    category: searchResponse?.category || request.category,
    query: searchResponse?.query || request.query,
    totalResults: Number(searchResponse?.totalResults || 0),
    resultCount: results.length,
    created: createdLeads.length,
    skipped: skippedItems.length,
    errors: errorItems.length,
    createdLeads,
    skippedItems,
    errorItems,
  };

  return {
    ...summary,
    message: `Collector finished. Created ${summary.created}, skipped ${summary.skipped}, errors ${summary.errors}.`,
  };
};
