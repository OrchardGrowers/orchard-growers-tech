import crypto from "crypto";
import ProfilePublication from "../models/ProfilePublication.js";
import User from "../models/User.js";

export const OPERATIONAL_PROFILE_ROLES = ["grower", "buyer", "driver"];
export const PUBLIC_BUSINESS_TYPES = [
  "grower",
  "buyer",
  "exporter",
  "commission_agent",
  "cold_storage",
  "logistics",
];

export const BUSINESS_TYPE_LABELS = {
  grower: "Grower",
  buyer: "Buyer",
  exporter: "Exporter",
  commission_agent: "Commission Agent",
  cold_storage: "Cold Storage",
  logistics: "Logistics",
};

const BUYER_BUSINESS_TYPES = new Set([
  "buyer",
  "exporter",
  "commission_agent",
  "cold_storage",
]);
const SENSITIVE_PLACE_PATTERN =
  /\b(address|house|street|road|near|plot|flat|building|village|ward|pin|pincode|post office|landmark|orchard location|exact)\b/i;
const INDIA_TOKEN_PATTERN = /^(india|bharat)$/i;
const POST_HASHTAGS =
  "#eFruitMandi #FruitGrowers #FruitBuyers #AppleGrowers #IndianAgriculture #FruitTrade";

const cleanText = (value = "", maxLength = 180) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

const getNestedRoleRecord = (records = {}, role = "") => {
  if (!records || !role) return {};
  if (typeof records.get === "function") return records.get(role) || {};
  return records[role] || {};
};

const normalizeHttpUrl = (value = "") => {
  try {
    const url = new URL(cleanText(value, 1000));
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
};

export const normalizeOperationalRole = (value = "") => {
  const role = cleanText(value, 40).toLowerCase();
  if (role === "logistic" || role === "logistics") return "driver";
  return OPERATIONAL_PROFILE_ROLES.includes(role) ? role : "";
};

export const normalizeBuyerBusinessType = (value = "") => {
  const normalized = cleanText(value, 60)
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  return BUYER_BUSINESS_TYPES.has(normalized) ? normalized : "buyer";
};

export const getProfileBusinessType = (user = {}, roleValue = "") => {
  const role = normalizeOperationalRole(roleValue);
  if (role === "grower") return "grower";
  if (role === "driver") return "logistics";
  if (role === "buyer") return normalizeBuyerBusinessType(user.buyerBusinessType);
  return "";
};

const sanitizePlaceName = (value = "") => {
  const place = cleanText(value, 80)
    .replace(/\b\d{6}\b/g, "")
    .replace(/\s+/g, " ")
    .replace(/^[,;.\s]+|[,;.\s]+$/g, "");
  if (!place || /\d/.test(place) || SENSITIVE_PLACE_PATTERN.test(place)) return "";
  return place;
};

export const extractPublicCityState = (user = {}, roleValue = "") => {
  const role = normalizeOperationalRole(roleValue);
  const roleKyc = getNestedRoleRecord(user.kycByRole, role);
  const legacyKyc =
    normalizeOperationalRole(user.kyc?.roleType) === role ? user.kyc || {} : {};

  const explicitCity = sanitizePlaceName(
    user.city || user.town || roleKyc.city || roleKyc.district || legacyKyc.city || legacyKyc.district
  );
  const explicitState = sanitizePlaceName(
    user.state || roleKyc.state || legacyKyc.state
  );
  if (explicitCity && explicitState) {
    return { city: explicitCity, state: explicitState };
  }

  const locationCandidates =
    role === "buyer"
      ? [user.buyerLocation, user.location]
      : role === "grower"
        ? [user.addressLine3, user.businessAddressLine3, user.location]
        : [user.location];

  for (const location of locationCandidates) {
    const parts = cleanText(location, 500)
      .replace(/\b\d{6}\b/g, "")
      .split(",")
      .map(sanitizePlaceName)
      .filter(Boolean)
      .filter((part) => !INDIA_TOKEN_PATTERN.test(part));

    const inferredState = explicitState || parts.at(-1) || "";
    const inferredCity = explicitCity || (parts.length > 1 ? parts.at(-2) : "");
    if (inferredCity && inferredState) {
      return { city: inferredCity, state: inferredState };
    }
  }

  return { city: "", state: "" };
};

export const isRolePublic = (user = {}, roleValue = "") => {
  const role = normalizeOperationalRole(roleValue);
  if (!role || String(user.accountStatus || "ACTIVE").toUpperCase() !== "ACTIVE") {
    return false;
  }

  const publicRoles = Array.isArray(user.publicProfileRoles)
    ? user.publicProfileRoles.map(normalizeOperationalRole)
    : [];
  return publicRoles.includes(role);
};

const getFirmName = (user = {}, role = "") => {
  if (role === "grower") return cleanText(user.orchardName);
  if (role === "buyer") return cleanText(user.businessName);
  if (role === "driver") return cleanText(user.logisticsName);
  return "";
};

const getOfficialFirmLogo = (user = {}, role = "") => {
  if (role === "buyer") {
    return normalizeHttpUrl(user.buyerCompanyLogoUrl || user.companyLogoUrl);
  }
  return normalizeHttpUrl(user.companyLogoUrl);
};

export const getEfruitMandiSiteUrl = () =>
  normalizeHttpUrl(
    process.env.EFRUITMANDI_PUBLIC_URL ||
      process.env.EFRUITMANDI_FRONTEND_URL ||
      process.env.EFRUITMANDI_URL ||
      "https://www.efruitmandi.live"
  ).replace(/\/+$/, "");

export const getDefaultBrandImageUrl = () =>
  normalizeHttpUrl(
    process.env.EFRUITMANDI_DEFAULT_BRAND_IMAGE_URL ||
      `${getEfruitMandiSiteUrl()}/logo-original.png`
  );

const buildProfileUrl = (userId, businessType) =>
  `${getEfruitMandiSiteUrl()}/profiles/${encodeURIComponent(
    businessType.replace(/_/g, "-")
  )}/${encodeURIComponent(String(userId))}`;

export const buildLinkedInCommentary = ({
  businessTypeLabel,
  firmName,
  city,
  state,
  profileUrl,
}) =>
  [
    `🌱 New ${businessTypeLabel} Registered on eFruitMandi`,
    "",
    `🏢 ${firmName}`,
    "",
    `📍 ${city}, ${state}`,
    "",
    "View the complete profile and connect through eFruitMandi.",
    "",
    `👉 ${profileUrl}`,
    "",
    POST_HASHTAGS,
  ].join("\n");

const buildFeaturedLinkedInCommentary = ({
  businessTypeLabel,
  firmName,
  city,
  state,
  profileUrl,
}) =>
  [
    `🌟 Featured ${businessTypeLabel} on eFruitMandi`,
    "",
    `🏢 ${firmName}`,
    "",
    `📍 ${city}, ${state}`,
    "",
    "View the complete profile and connect through eFruitMandi.",
    "",
    `👉 ${profileUrl}`,
    "",
    POST_HASHTAGS,
  ].join("\n");

export const buildPublicProfileSnapshot = (user = {}, roleValue = "") => {
  const role = normalizeOperationalRole(roleValue);
  if (!role) return { eligible: false, reason: "unsupported_role" };
  if (!isRolePublic(user, role)) return { eligible: false, reason: "not_public" };

  const firmName = getFirmName(user, role);
  if (!firmName) return { eligible: false, reason: "missing_firm_name" };

  const businessType = getProfileBusinessType(user, role);
  const businessTypeLabel = BUSINESS_TYPE_LABELS[businessType];
  if (!businessTypeLabel) return { eligible: false, reason: "missing_business_type" };

  const { city, state } = extractPublicCityState(user, role);
  if (!city || !state) return { eligible: false, reason: "missing_city_or_state" };

  const profileUrl = buildProfileUrl(user._id || user.id, businessType);
  const logoUrl = getOfficialFirmLogo(user, role) || getDefaultBrandImageUrl();
  const title = `New ${businessTypeLabel} Registered on eFruitMandi`;
  const description = buildLinkedInCommentary({
    businessTypeLabel,
    firmName,
    city,
    state,
    profileUrl,
  });

  return {
    eligible: true,
    role,
    snapshot: {
      firmName,
      businessType,
      businessTypeLabel,
      city,
      state,
      logoUrl,
      profileUrl,
      title,
      description,
    },
  };
};

const getProfileRegistrationDate = (user = {}, role = "") => {
  const value = getNestedRoleRecord(user.profileRegisteredAtByRole, role);
  const date = value instanceof Date ? value : value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
};

const upsertPublication = async ({
  user,
  role,
  publicationType,
  eventId,
  publishedAt,
}) => {
  const built = buildPublicProfileSnapshot(user, role);
  if (!built.eligible) return { queued: false, reason: built.reason };

  const userId = String(user._id || user.id);
  const stableEventId =
    publicationType === "registration" ? "registration" : cleanText(eventId, 120);
  if (!stableEventId) return { queued: false, reason: "missing_feature_event_id" };

  const dedupeKey = `${publicationType}:${userId}:${role}:${stableEventId}`;
  const guid = `urn:efruitmandi:profile:${userId}:${role}:${stableEventId}`;
  const existing = await ProfilePublication.findOne({ dedupeKey });

  if (existing) {
    return { queued: false, reason: "already_recorded", publication: existing };
  }

  try {
    const snapshot =
      publicationType === "featured"
        ? {
            ...built.snapshot,
            title: `Featured ${built.snapshot.businessTypeLabel} on eFruitMandi`,
            description: buildFeaturedLinkedInCommentary(built.snapshot),
          }
        : built.snapshot;
    const publication = await ProfilePublication.create({
      dedupeKey,
      guid,
      user: user._id || user.id,
      profileRole: role,
      publicationType,
      snapshot,
      rssPublishedAt: publishedAt || new Date(),
      linkedinStatus:
        String(process.env.LINKEDIN_PROFILE_PUBLISHING_ENABLED).toLowerCase() === "true"
          ? "pending"
          : "disabled",
    });
    return { queued: true, publication };
  } catch (error) {
    if (error?.code === 11000) {
      const publication = await ProfilePublication.findOne({ dedupeKey });
      return { queued: false, reason: "already_recorded", publication };
    }
    throw error;
  }
};

export const syncRegistrationPublication = async (userOrId, roleValue) => {
  const user =
    typeof userOrId === "object" && userOrId
      ? userOrId
      : await User.findById(userOrId).lean();
  if (!user) return { queued: false, reason: "user_not_found" };

  const role = normalizeOperationalRole(roleValue);
  const registeredAt = getProfileRegistrationDate(user, role);
  if (!registeredAt) return { queued: false, reason: "not_newly_registered" };

  return upsertPublication({
    user,
    role,
    publicationType: "registration",
    eventId: "registration",
    publishedAt: registeredAt,
  });
};

export const enqueueFeaturedProfile = async (
  userOrId,
  roleValue,
  eventId = crypto.randomUUID()
) => {
  const user =
    typeof userOrId === "object" && userOrId
      ? userOrId
      : await User.findById(userOrId).lean();
  if (!user) return { queued: false, reason: "user_not_found" };

  const role = normalizeOperationalRole(roleValue);
  return upsertPublication({
    user,
    role,
    publicationType: "featured",
    eventId,
    publishedAt: new Date(),
  });
};

export const discoverEligibleProfilePublications = async ({ limit = 200 } = {}) => {
  const users = await User.find({
    accountStatus: "ACTIVE",
    publicProfileRoles: { $in: OPERATIONAL_PROFILE_ROLES },
    $or: OPERATIONAL_PROFILE_ROLES.map((role) => ({
      [`profileRegisteredAtByRole.${role}`]: { $exists: true },
    })),
  })
    .sort({ updatedAt: -1, _id: -1 })
    .limit(Math.min(Math.max(Number(limit) || 200, 1), 1000))
    .lean();

  const summary = { scanned: users.length, queued: 0, skipped: 0 };
  for (const user of users) {
    for (const role of user.publicProfileRoles || []) {
      const result = await syncRegistrationPublication(user, role);
      if (result.queued) summary.queued += 1;
      else summary.skipped += 1;
    }
  }
  return summary;
};

export const getVisibleProfilePublications = async ({ limit = 50 } = {}) => {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const publications = await ProfilePublication.find()
    .sort({ rssPublishedAt: -1, _id: -1 })
    .limit(safeLimit * 3)
    .lean();
  const userIds = [...new Set(publications.map((item) => String(item.user)))];
  const users = await User.find({ _id: { $in: userIds } })
    .select("_id accountStatus publicProfileRoles")
    .lean();
  const usersById = new Map(users.map((user) => [String(user._id), user]));

  return publications
    .filter((publication) => {
      const user = usersById.get(String(publication.user));
      return user && isRolePublic(user, publication.profileRole);
    })
    .slice(0, safeLimit);
};

const escapeXml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const toRfc822Date = (value) => {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toUTCString() : date.toUTCString();
};

export const buildProfileRssXml = (publications = [], { feedUrl } = {}) => {
  const siteUrl = getEfruitMandiSiteUrl();
  const selfUrl = feedUrl || `${siteUrl}/rss/public-profiles.xml`;
  const buildDate = publications[0]?.rssPublishedAt || new Date();
  const items = publications
    .map((publication) => {
      const snapshot = publication.snapshot || {};
      return `    <item>
      <title>${escapeXml(snapshot.title)}</title>
      <link>${escapeXml(snapshot.profileUrl)}</link>
      <description>${escapeXml(snapshot.description)}</description>
      <guid isPermaLink="false">${escapeXml(publication.guid)}</guid>
      <pubDate>${escapeXml(toRfc822Date(publication.rssPublishedAt))}</pubDate>
      <media:content url="${escapeXml(snapshot.logoUrl)}" medium="image" />
      <efm:firmLogo>${escapeXml(snapshot.logoUrl)}</efm:firmLogo>
      <efm:businessType>${escapeXml(snapshot.businessTypeLabel)}</efm:businessType>
      <efm:city>${escapeXml(snapshot.city)}</efm:city>
      <efm:state>${escapeXml(snapshot.state)}</efm:state>
      <efm:profileUrl>${escapeXml(snapshot.profileUrl)}</efm:profileUrl>
    </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:media="http://search.yahoo.com/mrss/"
  xmlns:efm="https://www.efruitmandi.live/rss/ns/profile">
  <channel>
    <title>eFruitMandi New Public Profiles</title>
    <link>${escapeXml(siteUrl)}</link>
    <description>New public business profiles registered on eFruitMandi.</description>
    <language>en-IN</language>
    <lastBuildDate>${escapeXml(toRfc822Date(buildDate))}</lastBuildDate>
    <atom:link href="${escapeXml(selfUrl)}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;
};
