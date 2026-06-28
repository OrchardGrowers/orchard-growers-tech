import mongoose from "mongoose";
import Lead, {
  LEAD_PRIORITIES,
  LEAD_STATUSES,
  LEAD_TYPES,
  normalizeLeadEmail,
  normalizeLeadPhone,
  normalizeLeadWebsite,
} from "../models/Lead.js";
import { collectOrchardAiLeadsFromGoogle } from "../services/orchardAiCollectorService.js";
import { extractOrchardAiLeadFromUrl } from "../services/orchardAiUrlExtractorService.js";

const WRITABLE_FIELDS = new Set([
  "companyName",
  "contactPerson",
  "leadType",
  "fruits",
  "city",
  "state",
  "address",
  "phone",
  "email",
  "whatsapp",
  "website",
  "sourceUrl",
  "sourcePlatform",
  "score",
  "priority",
  "status",
  "assignedTo",
  "notes",
  "tags",
  "lastContactedAt",
  "nextFollowUpAt",
]);

const STRING_LIMITS = {
  companyName: 200,
  contactPerson: 120,
  city: 120,
  state: 120,
  address: 1000,
  phone: 40,
  email: 254,
  whatsapp: 40,
  website: 500,
  sourceUrl: 1000,
  sourcePlatform: 80,
  notes: 5000,
};

const REQUIRED_CREATE_FIELDS = ["companyName", "contactPerson", "leadType"];

const createHttpError = (statusCode, message, code = "INVALID_REQUEST", details) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  if (details) error.details = details;
  return error;
};

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

const cleanString = (value, field, maxLength) => {
  if (value === null || value === undefined) return "";
  if (typeof value !== "string") {
    throw createHttpError(400, `${field} must be a string`, "VALIDATION_ERROR");
  }

  const cleaned = value.trim();
  if (cleaned.length > maxLength) {
    throw createHttpError(
      400,
      `${field} cannot exceed ${maxLength} characters`,
      "VALIDATION_ERROR"
    );
  }
  return cleaned;
};

const cleanStringArray = (value, field, maxItems, maxItemLength) => {
  if (!Array.isArray(value)) {
    throw createHttpError(400, `${field} must be an array`, "VALIDATION_ERROR");
  }
  if (value.length > maxItems) {
    throw createHttpError(
      400,
      `${field} cannot contain more than ${maxItems} items`,
      "VALIDATION_ERROR"
    );
  }

  const values = value.map((item) => cleanString(item, field, maxItemLength)).filter(Boolean);
  const unique = new Map();
  values.forEach((item) => unique.set(item.toLowerCase(), item));
  return Array.from(unique.values());
};

const cleanEnum = (value, field, allowedValues) => {
  const cleaned = cleanString(value, field, 80);
  const match = allowedValues.find((item) => item.toLowerCase() === cleaned.toLowerCase());
  if (!match) {
    throw createHttpError(
      400,
      `${field} must be one of: ${allowedValues.join(", ")}`,
      "VALIDATION_ERROR"
    );
  }
  return match;
};

const cleanObjectId = (value, field, { nullable = false } = {}) => {
  if ((value === null || value === "") && nullable) return null;
  if (typeof value !== "string" || !mongoose.isValidObjectId(value)) {
    throw createHttpError(400, `${field} must be a valid ID`, "VALIDATION_ERROR");
  }
  return value;
};

const cleanDate = (value, field) => {
  if (value === null || value === "") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw createHttpError(400, `${field} must be a valid date`, "VALIDATION_ERROR");
  }
  return date;
};

const isValidEmail = (value) =>
  !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const isValidWebUrl = (value) => {
  if (!value) return true;
  try {
    const urlValue = /^[a-z][a-z0-9+.-]*:\/\//i.test(value)
      ? value
      : `https://${value}`;
    const url = new URL(urlValue);
    return ["http:", "https:"].includes(url.protocol) && Boolean(url.hostname);
  } catch {
    return false;
  }
};

export const sanitizeLeadPayload = (body, { partial = false } = {}) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw createHttpError(400, "Request body must be an object", "VALIDATION_ERROR");
  }

  const unsupportedFields = Object.keys(body).filter((field) => !WRITABLE_FIELDS.has(field));
  if (unsupportedFields.length) {
    throw createHttpError(
      400,
      `Unsupported fields: ${unsupportedFields.join(", ")}`,
      "VALIDATION_ERROR"
    );
  }

  if (!partial) {
    const missingFields = REQUIRED_CREATE_FIELDS.filter((field) => !hasOwn(body, field));
    if (missingFields.length) {
      throw createHttpError(
        400,
        `Missing required fields: ${missingFields.join(", ")}`,
        "VALIDATION_ERROR"
      );
    }
  }

  const payload = {};

  Object.entries(STRING_LIMITS).forEach(([field, maxLength]) => {
    if (hasOwn(body, field)) payload[field] = cleanString(body[field], field, maxLength);
  });

  if (hasOwn(payload, "email")) {
    payload.email = normalizeLeadEmail(payload.email);
    if (!isValidEmail(payload.email)) {
      throw createHttpError(400, "email is invalid", "VALIDATION_ERROR");
    }
  }

  ["phone", "whatsapp"].forEach((field) => {
    if (!hasOwn(payload, field) || !payload[field]) return;
    const normalized = normalizeLeadPhone(payload[field]);
    if (normalized.length < 7 || normalized.length > 15) {
      throw createHttpError(
        400,
        `${field} must contain between 7 and 15 digits`,
        "VALIDATION_ERROR"
      );
    }
  });

  ["website", "sourceUrl"].forEach((field) => {
    if (hasOwn(payload, field) && !isValidWebUrl(payload[field])) {
      throw createHttpError(
        400,
        `${field} must be a valid HTTP or HTTPS URL`,
        "VALIDATION_ERROR"
      );
    }
  });

  if (hasOwn(body, "leadType")) {
    payload.leadType = cleanEnum(body.leadType, "leadType", LEAD_TYPES);
  }
  if (hasOwn(body, "priority")) {
    payload.priority = cleanEnum(body.priority, "priority", LEAD_PRIORITIES);
  }
  if (hasOwn(body, "status")) {
    payload.status = cleanEnum(body.status, "status", LEAD_STATUSES);
  }
  if (hasOwn(body, "fruits")) {
    payload.fruits = cleanStringArray(body.fruits, "fruits", 30, 80);
  }
  if (hasOwn(body, "tags")) {
    payload.tags = cleanStringArray(body.tags, "tags", 50, 60);
  }
  if (hasOwn(body, "score")) {
    const score = Number(body.score);
    if (!Number.isFinite(score) || !Number.isInteger(score) || score < 0 || score > 100) {
      throw createHttpError(
        400,
        "score must be an integer between 0 and 100",
        "VALIDATION_ERROR"
      );
    }
    payload.score = score;
  }
  if (hasOwn(body, "assignedTo")) {
    payload.assignedTo = cleanObjectId(body.assignedTo, "assignedTo", { nullable: true });
  }
  if (hasOwn(body, "lastContactedAt")) {
    payload.lastContactedAt = cleanDate(body.lastContactedAt, "lastContactedAt");
  }
  if (hasOwn(body, "nextFollowUpAt")) {
    payload.nextFollowUpAt = cleanDate(body.nextFollowUpAt, "nextFollowUpAt");
  }

  REQUIRED_CREATE_FIELDS.forEach((field) => {
    if (hasOwn(payload, field) && !payload[field]) {
      throw createHttpError(400, `${field} is required`, "VALIDATION_ERROR");
    }
  });

  if (partial && !Object.keys(payload).length) {
    throw createHttpError(400, "Provide at least one lead field to update", "VALIDATION_ERROR");
  }

  return payload;
};

const readQueryValue = (query, field, maxLength = 120) => {
  const value = query[field];
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string") {
    throw createHttpError(400, `${field} filter must be a string`, "VALIDATION_ERROR");
  }
  return cleanString(value, field, maxLength);
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const buildLeadFilter = (query = {}) => {
  const filter = {};
  const search = readQueryValue(query, "search", 100);
  const leadType = readQueryValue(query, "leadType", 80);
  const fruit = readQueryValue(query, "fruit", 80);
  const city = readQueryValue(query, "city", 120);
  const state = readQueryValue(query, "state", 120);
  const status = readQueryValue(query, "status", 80);
  const assignedTo = readQueryValue(query, "assignedTo", 80);
  const priority = readQueryValue(query, "priority", 80);

  if (search) {
    const pattern = new RegExp(escapeRegex(search), "i");
    filter.$or = [
      { companyName: pattern },
      { contactPerson: pattern },
      { fruits: pattern },
      { city: pattern },
      { state: pattern },
      { address: pattern },
      { phone: pattern },
      { email: pattern },
      { whatsapp: pattern },
      { website: pattern },
      { sourceUrl: pattern },
      { sourcePlatform: pattern },
      { notes: pattern },
      { tags: pattern },
    ];
  }
  if (leadType) filter.leadType = cleanEnum(leadType, "leadType", LEAD_TYPES);
  if (fruit) filter.fruits = new RegExp(`^${escapeRegex(fruit)}$`, "i");
  if (city) filter.city = new RegExp(`^${escapeRegex(city)}$`, "i");
  if (state) filter.state = new RegExp(`^${escapeRegex(state)}$`, "i");
  if (status) filter.status = cleanEnum(status, "status", LEAD_STATUSES);
  if (assignedTo) filter.assignedTo = cleanObjectId(assignedTo, "assignedTo");
  if (priority) filter.priority = cleanEnum(priority, "priority", LEAD_PRIORITIES);

  return filter;
};

const parsePositiveInteger = (value, fallback, field, maximum) => {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    throw createHttpError(400, `${field} must be a positive integer`, "VALIDATION_ERROR");
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw createHttpError(
      400,
      `${field} must be between 1 and ${maximum}`,
      "VALIDATION_ERROR"
    );
  }
  return parsed;
};

export const parseLeadPagination = (query = {}) => ({
  page: parsePositiveInteger(query.page, 1, "page", 1000000),
  limit: parsePositiveInteger(query.limit, 25, "limit", 100),
});

const duplicateValuesFor = (payload) => ({
  normalizedPhone: normalizeLeadPhone(payload.phone),
  normalizedEmail: normalizeLeadEmail(payload.email),
  normalizedWebsite: normalizeLeadWebsite(payload.website),
});

const duplicateFieldLabels = {
  normalizedPhone: "phone",
  normalizedEmail: "email",
  normalizedWebsite: "website",
};

const checkForDuplicateLead = async (payload, excludedLeadId) => {
  const values = duplicateValuesFor(payload);
  const checks = Object.entries(values).filter(([, value]) => Boolean(value));
  if (!checks.length) return;

  const conditions = checks.map(([field, value]) => ({ [field]: value }));
  const query = { $or: conditions };
  if (excludedLeadId) query._id = { $ne: excludedLeadId };

  const duplicate = await Lead.findOne(query)
    .select("+normalizedPhone +normalizedEmail +normalizedWebsite")
    .lean();
  if (!duplicate) return;

  const duplicateField =
    checks.find(([field, value]) => duplicate[field] === value)?.[0] || checks[0][0];
  const field = duplicateFieldLabels[duplicateField] || "contact";
  throw createHttpError(
    409,
    `A lead with this ${field} already exists`,
    "DUPLICATE_LEAD",
    { field }
  );
};

const validateLeadId = (value) => {
  if (!mongoose.isValidObjectId(value)) {
    throw createHttpError(400, "Lead ID is invalid", "VALIDATION_ERROR");
  }
  return value;
};

const leadPopulate = [
  { path: "assignedTo", select: "name email role adminClass" },
  { path: "createdBy", select: "name email role" },
  { path: "updatedBy", select: "name email role" },
];

export const listOrchardAiLeads = async (req, res) => {
  const filter = buildLeadFilter(req.query);
  const { page, limit } = parseLeadPagination(req.query);
  const skip = (page - 1) * limit;

  const [leads, total] = await Promise.all([
    Lead.find(filter)
      .select("-__v")
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .populate(leadPopulate)
      .lean(),
    Lead.countDocuments(filter),
  ]);

  const totalPages = total ? Math.ceil(total / limit) : 0;
  return res.json({
    data: leads,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1 && totalPages > 0,
    },
  });
};

export const createOrchardAiLead = async (req, res) => {
  const payload = sanitizeLeadPayload(req.body);
  await checkForDuplicateLead(payload);

  const lead = await Lead.create({
    ...payload,
    createdBy: req.user.id,
    updatedBy: req.user.id,
  });
  await lead.populate(leadPopulate);

  return res.status(201).json({ data: lead });
};

export const getOrchardAiLead = async (req, res) => {
  const leadId = validateLeadId(req.params.id);
  const lead = await Lead.findById(leadId).select("-__v").populate(leadPopulate);

  if (!lead) {
    throw createHttpError(404, "Lead not found", "LEAD_NOT_FOUND");
  }

  return res.json({ data: lead });
};

export const updateOrchardAiLead = async (req, res) => {
  const leadId = validateLeadId(req.params.id);
  const payload = sanitizeLeadPayload(req.body, { partial: true });
  const lead = await Lead.findById(leadId);

  if (!lead) {
    throw createHttpError(404, "Lead not found", "LEAD_NOT_FOUND");
  }

  await checkForDuplicateLead(
    {
      phone: hasOwn(payload, "phone") ? payload.phone : lead.phone,
      email: hasOwn(payload, "email") ? payload.email : lead.email,
      website: hasOwn(payload, "website") ? payload.website : lead.website,
    },
    leadId
  );

  Object.assign(lead, payload, { updatedBy: req.user.id });
  await lead.save();
  await lead.populate(leadPopulate);

  return res.json({ data: lead });
};

export const collectOrchardAiLeads = async (req, res) => {
  const summary = await collectOrchardAiLeadsFromGoogle({
    ...(req.body || {}),
    actorId: req.user.id,
  });

  return res.json(summary);
};

export const extractOrchardAiLeadUrl = async (req, res) => {
  const summary = await extractOrchardAiLeadFromUrl({
    ...(req.body || {}),
    actorId: req.user.id,
  });
  const { statusCode = 200, ...response } = summary;
  return res.status(statusCode).json(response);
};

export const deleteOrchardAiLead = async (req, res) => {
  const leadId = validateLeadId(req.params.id);
  const lead = await Lead.findByIdAndDelete(leadId).select("_id");

  if (!lead) {
    throw createHttpError(404, "Lead not found", "LEAD_NOT_FOUND");
  }

  return res.json({
    message: "Lead deleted successfully",
    id: lead._id,
  });
};

const getDuplicateFieldFromError = (error) => {
  const key = Object.keys(error.keyPattern || error.keyValue || {})[0] || "";
  return duplicateFieldLabels[key] || "contact";
};

export const orchardAiLeadErrorHandler = (error, req, res, next) => {
  if (res.headersSent) return next(error);

  if (error.statusCode) {
    return res.status(error.statusCode).json({
      message: error.message,
      msg: error.message,
      code: error.code || "REQUEST_ERROR",
      ...(error.details ? { details: error.details } : {}),
    });
  }

  if (error.code === 11000) {
    const field = getDuplicateFieldFromError(error);
    const message = `A lead with this ${field} already exists`;
    return res.status(409).json({
      message,
      msg: message,
      code: "DUPLICATE_LEAD",
      details: { field },
    });
  }

  if (error.name === "ValidationError") {
    const details = Object.fromEntries(
      Object.entries(error.errors || {}).map(([field, validationError]) => [
        field,
        validationError.message,
      ])
    );
    return res.status(400).json({
      message: "Lead validation failed",
      msg: "Lead validation failed",
      code: "VALIDATION_ERROR",
      details,
    });
  }

  if (error.name === "CastError") {
    return res.status(400).json({
      message: "Invalid lead field value",
      msg: "Invalid lead field value",
      code: "VALIDATION_ERROR",
    });
  }

  // eslint-disable-next-line no-console
  console.error("Orchard AI lead API error:", error?.message || error);
  return res.status(500).json({
    message: "Unable to process the lead request",
    msg: "Unable to process the lead request",
    code: "LEAD_API_ERROR",
  });
};




