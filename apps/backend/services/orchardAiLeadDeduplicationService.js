import Lead, {
  normalizeLeadEmail,
  normalizeLeadPhone,
  normalizeLeadWebsite,
} from "../models/Lead.js";

export const normalizeLeadCompanyName = (value = "") =>
  String(value || "").replace(/\s+/g, " ").trim().toLowerCase();

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildCompanyRegex = (value) => {
  const companyName = String(value || "").replace(/\s+/g, " ").trim();
  if (!companyName) return null;
  const pattern = escapeRegex(companyName).replace(/\s+/g, "\\s+");
  return new RegExp(`^${pattern}$`, "i");
};

export const findExistingOrchardAiLead = async (
  payload,
  { LeadModel = Lead, excludeId = "" } = {}
) => {
  const normalizedWebsite = normalizeLeadWebsite(payload.website || payload.sourceUrl);
  const normalizedPhone = normalizeLeadPhone(payload.phone);
  const normalizedEmail = normalizeLeadEmail(payload.email);
  const companyRegex = buildCompanyRegex(payload.companyName);
  const sourceUrl = String(payload.sourceUrl || "").trim();

  const checks = [
    normalizedWebsite
      ? { field: "website", condition: { normalizedWebsite } }
      : null,
    sourceUrl ? { field: "sourceUrl", condition: { sourceUrl } } : null,
    normalizedPhone ? { field: "phone", condition: { normalizedPhone } } : null,
    normalizedEmail ? { field: "email", condition: { normalizedEmail } } : null,
    companyRegex
      ? { field: "companyName", condition: { companyName: companyRegex } }
      : null,
  ].filter(Boolean);

  if (!checks.length) return null;

  const filter = {
    $or: checks.map((check) => check.condition),
  };
  if (excludeId) filter._id = { $ne: excludeId };

  const lead = await LeadModel.findOne(filter)
    .select(
      "_id companyName website sourceUrl phone email +normalizedWebsite +normalizedPhone +normalizedEmail"
    )
    .lean();
  if (!lead) return null;

  let matchedBy = "lead";
  if (normalizedWebsite && lead.normalizedWebsite === normalizedWebsite) {
    matchedBy = "website";
  } else if (sourceUrl && lead.sourceUrl === sourceUrl) {
    matchedBy = "sourceUrl";
  } else if (normalizedPhone && lead.normalizedPhone === normalizedPhone) {
    matchedBy = "phone";
  } else if (normalizedEmail && lead.normalizedEmail === normalizedEmail) {
    matchedBy = "email";
  } else if (
    normalizeLeadCompanyName(lead.companyName) ===
    normalizeLeadCompanyName(payload.companyName)
  ) {
    matchedBy = "companyName";
  }

  return {
    lead,
    matchedBy,
  };
};

export const isOrchardAiLeadDuplicateError = (error) =>
  error?.code === 11000 || error?.code === "DUPLICATE_LEAD";
