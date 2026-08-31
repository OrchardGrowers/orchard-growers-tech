import axios from "axios";
import { createCipheriv, createDecipheriv, createHash, createHmac } from "node:crypto";

const PRODUCTION_API_BASE_URL = "https://api.efruitmandi.live/api";
const REQUEST_TIMEOUT_MS = 12_000;
const PUBLIC_MARKETPLACE_QUERY_VALUE = "1";

const asObject = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};

const compact = (value) =>
  Object.fromEntries(Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined));

const cleanText = (value, maxLength = 500) =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

const cleanNumber = (value) => {
  if (value === null || value === undefined || value === "") return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
};

const cleanBoolean = (value) => (typeof value === "boolean" ? value : undefined);

const cleanDate = (value) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

const cleanId = (value) => {
  const text = cleanText(value, 100);
  return /^[a-f\d]{24}$/i.test(text) ? text : undefined;
};

const getPublicIdKey = () =>
  createHash("sha256")
    .update(
      String(
        process.env.DEV_PUBLIC_MARKETPLACE_ID_SECRET ||
          process.env.JWT_SECRET ||
          "efruitmandi-local-development-public-id"
      )
    )
    .digest();

const encodePublicId = (value, namespace) => {
  const internalId = cleanId(value);
  if (!internalId) return undefined;
  const key = getPublicIdKey();
  const plaintext = Buffer.from(`${namespace}:${internalId}`, "utf8");
  const nonce = createHmac("sha256", key).update(plaintext).digest().subarray(0, 12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `pub_${Buffer.concat([nonce, tag, ciphertext]).toString("base64url")}`;
};

const decodePublicId = (value, namespace) => {
  const publicId = cleanText(value, 240);
  if (!publicId.startsWith("pub_")) return null;
  try {
    const payload = Buffer.from(publicId.slice(4), "base64url");
    if (payload.length < 29) return null;
    const nonce = payload.subarray(0, 12);
    const tag = payload.subarray(12, 28);
    const ciphertext = payload.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", getPublicIdKey(), nonce);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    const prefix = `${namespace}:`;
    if (!plaintext.startsWith(prefix)) return null;
    const internalId = cleanId(plaintext.slice(prefix.length));
    return internalId && encodePublicId(internalId, namespace) === publicId ? internalId : null;
  } catch {
    return null;
  }
};

const cleanUrl = (value) => {
  const text = cleanText(value, 2_000);
  if (!text) return "";
  try {
    const parsed = new URL(text);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString() : "";
  } catch {
    return text.startsWith("/uploads/") ? text : "";
  }
};

const cleanLocation = (value) => {
  const parts = cleanText(value, 240)
    .replace(/\b\d{4,}\b/g, "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !/\b(address|house|street|road|near|plot|flat|building|ward|pin|pincode|post office)\b/i.test(part));
  return parts.slice(-3).join(", ");
};

const cleanStringArray = (value, mapper = cleanText) =>
  Array.isArray(value) ? value.map((item) => mapper(item)).filter(Boolean) : [];

const sanitizeImageObject = (value) => {
  const image = asObject(value);
  const url = cleanUrl(image.url || image.secure_url || image.secureUrl);
  if (!url) return null;
  return compact({
    url,
    alt: cleanText(image.alt, 180),
    isPrimary: cleanBoolean(image.isPrimary),
  });
};

const sanitizePackingBreakdown = (value) => {
  const packing = asObject(value);
  return compact({
    size: cleanText(packing.size, 80),
    packageCount: cleanNumber(packing.packageCount),
    piecesPerPackage: cleanNumber(packing.piecesPerPackage),
    traysPerPackage: cleanNumber(packing.traysPerPackage),
    piecesPerTray: cleanNumber(packing.piecesPerTray),
    weightPerPackageKg: cleanNumber(packing.weightPerPackageKg),
    packageCapacityCode: cleanText(packing.packageCapacityCode, 80),
    packageTypeCode: cleanText(packing.packageTypeCode, 80),
    packageSizeCode: cleanText(packing.packageSizeCode, 80),
    diameterPresetCode: cleanText(packing.diameterPresetCode, 80),
    diameterMinMm: cleanNumber(packing.diameterMinMm),
    diameterMaxMm: cleanNumber(packing.diameterMaxMm),
    countPreset: cleanText(packing.countPreset, 80),
  });
};

const sanitizePackingSummary = (value) => {
  const packing = asObject(value);
  return compact({
    totalPackages: cleanNumber(packing.totalPackages),
    totalPieces: cleanNumber(packing.totalPieces),
    totalWeightKg: cleanNumber(packing.totalWeightKg),
    averageFruitWeightGrams: cleanNumber(packing.averageFruitWeightGrams),
  });
};

const sanitizeGradeLot = (value) => {
  const gradeLot = asObject(value);
  return compact({
    grade: cleanText(gradeLot.grade, 80),
    boxes: cleanNumber(gradeLot.boxes),
    weightKg: cleanNumber(gradeLot.weightKg),
    images: cleanStringArray(gradeLot.images, cleanUrl),
    imageObjects: Array.isArray(gradeLot.imageObjects)
      ? gradeLot.imageObjects.map(sanitizeImageObject).filter(Boolean)
      : [],
  });
};

export const sanitizeDevelopmentPublicProfile = (value) => {
  const profile = asObject(value);
  const role = cleanText(profile.role || profile.activeRole, 30).toLowerCase();
  if (!['grower', 'buyer'].includes(role)) return null;
  const logoUrl = cleanUrl(
    profile.logoUrl || profile.avatarUrl || profile.profileImage || profile.profilePic || profile.avatar
  );
  const mainLocation = cleanLocation(profile.mainLocation || profile.location);
  return compact({
    _id: encodePublicId(profile._id || profile.id, "profile"),
    slug: cleanText(profile.slug, 160),
    role,
    activeRole: role,
    profileTypes: [role],
    businessType: cleanText(profile.businessType, 80),
    name: cleanText(profile.name, 160),
    companyName: cleanText(profile.companyName, 200),
    orchardName: role === "grower" ? cleanText(profile.orchardName, 200) : "",
    businessName: role === "buyer" ? cleanText(profile.businessName, 200) : "",
    buyerContactPerson: role === "buyer" ? cleanText(profile.buyerContactPerson, 160) : "",
    logoUrl,
    bannerUrl: cleanUrl(profile.bannerUrl),
    avatarUrl: logoUrl,
    profileImage: logoUrl,
    profilePic: logoUrl,
    avatar: logoUrl,
    photoURL: logoUrl,
    mainLocation,
    district: cleanLocation(profile.district),
    state: cleanLocation(profile.state),
    location: mainLocation,
    isKycVerified: cleanBoolean(profile.isKycVerified),
    isOgVerified: cleanBoolean(profile.isOgVerified),
    isTrusted: cleanBoolean(profile.isTrusted),
    registeredAt: cleanDate(profile.registeredAt),
    createdAt: cleanDate(profile.createdAt || profile.registeredAt),
  });
};

const sanitizePublicParty = (value, fallbackRole = "") => {
  const party = asObject(value);
  const role = ["grower", "buyer"].includes(String(party.role || "").toLowerCase())
    ? String(party.role).toLowerCase()
    : fallbackRole;
  return sanitizeDevelopmentPublicProfile({
    ...party,
    role,
    companyName: party.companyName || party.orchardName || party.businessName,
    mainLocation: party.mainLocation || party.location,
    logoUrl: party.logoUrl || party.companyLogoUrl || party.buyerCompanyLogoUrl,
  });
};

const sanitizeBoundingBox = (value) => {
  const box = asObject(value);
  const x = cleanNumber(box.x);
  const y = cleanNumber(box.y);
  const width = cleanNumber(box.width);
  const height = cleanNumber(box.height);
  if ([x, y, width, height].some((item) => item === undefined)) return null;
  return { x, y, width, height };
};

const PUBLIC_METRIC_KEYS = new Set([
  "label",
  "value",
  "score",
  "confidence",
  "average",
  "mean",
  "min",
  "max",
  "unit",
  "category",
  "status",
  "dominant",
  "distribution",
  "percentage",
  "percent",
  "description",
  "grade",
  "name",
]);

const sanitizePublicMetric = (value, depth = 0) => {
  if (depth > 3 || value === undefined) return undefined;
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string") return cleanText(value, 300);
  if (Array.isArray(value)) {
    return value.slice(0, 100).map((item) => sanitizePublicMetric(item, depth + 1)).filter((item) => item !== undefined);
  }
  if (typeof value !== "object") return undefined;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => PUBLIC_METRIC_KEYS.has(key))
      .map(([key, item]) => [key, sanitizePublicMetric(item, depth + 1)])
      .filter(([, item]) => item !== undefined)
  );
};

const sanitizeScanAnalysis = (value) => {
  const analysis = asObject(value);
  return compact({
    grade: cleanText(analysis.grade, 80),
    status: cleanText(analysis.status, 40),
    analysisVersion: cleanText(analysis.analysisVersion, 80),
    modelProvider: cleanText(analysis.modelProvider, 80),
    modelVersion: cleanText(analysis.modelVersion, 80),
    analyzedAt: cleanDate(analysis.analyzedAt),
    capturedAt: cleanDate(analysis.capturedAt),
    imagesAnalyzed: cleanNumber(analysis.imagesAnalyzed),
    fruitCount: cleanNumber(analysis.fruitCount),
    detections: Array.isArray(analysis.detections)
      ? analysis.detections.map((item) => {
          const detection = asObject(item);
          return compact({
            category: cleanText(detection.category, 80),
            label: cleanText(detection.label, 120),
            confidence: cleanNumber(detection.confidence),
            boundingBox: sanitizeBoundingBox(detection.boundingBox),
            obstruction: cleanBoolean(detection.obstruction),
          });
        })
      : [],
    colour: sanitizePublicMetric(analysis.colour) ?? null,
    size: sanitizePublicMetric(analysis.size) ?? null,
    shape: sanitizePublicMetric(analysis.shape) ?? null,
    surface: sanitizePublicMetric(analysis.surface) ?? null,
    maturity: sanitizePublicMetric(analysis.maturity) ?? null,
    russetingPercent: cleanNumber(analysis.russetingPercent),
    decayPercent: cleanNumber(analysis.decayPercent),
    defectPercent: cleanNumber(analysis.defectPercent),
    uniformityScore: cleanNumber(analysis.uniformityScore),
    imageQuality: sanitizePublicMetric(analysis.imageQuality) ?? null,
    warningCodes: cleanStringArray(analysis.warningCodes, (item) => cleanText(item, 80)),
    failureCode: cleanText(analysis.failureCode, 80),
    imageUrl: cleanUrl(analysis.imageUrl),
  });
};

const sanitizeFruitScanningReport = (value) => {
  const report = asObject(value);
  const analyses = Array.isArray(report.analyses)
    ? report.analyses.map(sanitizeScanAnalysis)
    : [];
  return compact({
    available: cleanBoolean(report.available),
    status: cleanText(report.status, 40),
    imagesCaptured: cleanNumber(report.imagesCaptured),
    imagesAnalyzed: cleanNumber(report.imagesAnalyzed),
    imagesCompleted: cleanNumber(report.imagesCompleted),
    imagesReviewRequired: cleanNumber(report.imagesReviewRequired),
    imagesFailed: cleanNumber(report.imagesFailed),
    totalFruitCount: cleanNumber(report.totalFruitCount),
    startedAt: cleanDate(report.startedAt),
    completedAt: cleanDate(report.completedAt),
    warningCodes: cleanStringArray(report.warningCodes, (item) => cleanText(item, 80)),
    analyses,
  });
};

export const sanitizeDevelopmentPublicProduct = (value) => {
  const product = asObject(value);
  const createdBy = sanitizePublicParty(product.createdBy, "grower");
  return compact({
    _id: encodePublicId(product._id || product.id, "product"),
    slug: cleanText(product.slug, 180),
    title: cleanText(product.title, 240),
    fruitName: cleanText(product.fruitName, 120),
    variety: cleanText(product.variety, 120),
    quality: cleanText(product.quality, 120),
    description: cleanText(product.description, 2_000),
    unit: cleanText(product.unit, 40),
    active: cleanBoolean(product.active),
    images: cleanStringArray(product.images, cleanUrl),
    imageObjects: Array.isArray(product.imageObjects)
      ? product.imageObjects.map(sanitizeImageObject).filter(Boolean)
      : [],
    createdSource: cleanText(product.createdSource, 40),
    gradeLots: Array.isArray(product.gradeLots) ? product.gradeLots.map(sanitizeGradeLot) : [],
    sampleVideo: cleanUrl(product.sampleVideo),
    quantity: cleanNumber(product.quantity),
    lotNo: cleanText(product.lotNo, 100),
    packingType: cleanText(product.packingType, 100),
    packingWeightKg: cleanNumber(product.packingWeightKg),
    totalWeightKg: cleanNumber(product.totalWeightKg),
    packingBreakdown: Array.isArray(product.packingBreakdown)
      ? product.packingBreakdown.map(sanitizePackingBreakdown)
      : [],
    packingSummary: sanitizePackingSummary(product.packingSummary),
    auctionStartTime: cleanDate(product.auctionStartTime),
    auctionEndTime: cleanDate(product.auctionEndTime),
    location: cleanLocation(product.location),
    createdBy,
    status: cleanText(product.status, 40),
    finalPrice: cleanNumber(product.finalPrice),
    finalDealValue: cleanNumber(product.finalDealValue),
    hasOrganicCertificateProof: cleanBoolean(product.hasOrganicCertificateProof),
    createdAt: cleanDate(product.createdAt),
    updatedAt: cleanDate(product.updatedAt),
    fruitScanningReport: product.fruitScanningReport
      ? sanitizeFruitScanningReport(product.fruitScanningReport)
      : undefined,
  });
};

export const sanitizeDevelopmentPublicAuction = (value) => {
  const auction = asObject(value);
  const product = sanitizeDevelopmentPublicProduct(auction.product);
  return compact({
    _id: encodePublicId(auction._id || auction.id, "auction"),
    product,
    status: cleanText(auction.status, 40),
    currentBid: cleanNumber(auction.currentBid),
    highestGrade: cleanText(auction.highestGrade, 80),
    highestGradeRate: cleanNumber(auction.highestGradeRate),
    startTime: cleanDate(auction.startTime),
    endTime: cleanDate(auction.endTime),
    finalPrice: cleanNumber(auction.finalPrice),
    finalDealValue: cleanNumber(auction.finalDealValue),
    createdAt: cleanDate(auction.createdAt),
    updatedAt: cleanDate(auction.updatedAt),
  });
};

export const isDevelopmentPublicMarketplaceEnabled = () =>
  process.env.NODE_ENV !== "production" &&
  process.env.APP_ENV !== "production" &&
  String(process.env.DEV_PUBLIC_MARKETPLACE_SOURCE || "").trim().toLowerCase() === "production";

export const isDevelopmentPublicMarketplaceRequest = (req) =>
  req?.method === "GET" &&
  isDevelopmentPublicMarketplaceEnabled() &&
  String(req?.query?.devPublicMarketplace || "").trim() === PUBLIC_MARKETPLACE_QUERY_VALUE;

const fetchProductionPublicJson = async (path, params = {}) => {
  const response = await axios.get(`${PRODUCTION_API_BASE_URL}${path}`, {
    params,
    timeout: REQUEST_TIMEOUT_MS,
    maxContentLength: 5 * 1024 * 1024,
    maxBodyLength: 5 * 1024 * 1024,
    headers: { Accept: "application/json" },
    validateStatus: (status) => status >= 200 && status < 300,
  });
  return response.data;
};

const withLocalFallback = async (loader) => {
  try {
    return await loader();
  } catch (error) {
    console.warn("Development public marketplace source unavailable; using local data:", error?.message || error);
    return null;
  }
};

export const loadDevelopmentPublicProfiles = async (req, query = {}) => {
  if (!isDevelopmentPublicMarketplaceRequest(req)) return null;
  const requestedRole = cleanText(query.role, 30).toLowerCase();
  if (!["grower", "buyer"].includes(requestedRole)) return null;
  return withLocalFallback(async () => {
    const data = asObject(await fetchProductionPublicJson("/user/public-profiles", {
      role: requestedRole,
      limit: query.limit === "all" ? "all" : Math.min(Math.max(Number(query.limit) || 10, 1), 1000),
      ...(query.state ? { state: cleanText(query.state, 100) } : {}),
      ...(query.district ? { district: cleanText(query.district, 100) } : {}),
    }));
    const profiles = Array.isArray(data.profiles)
      ? data.profiles.map(sanitizeDevelopmentPublicProfile).filter(Boolean)
      : [];
    return { role: requestedRole, count: profiles.length, profiles };
  });
};

const slugifyPublicLocation = (value) =>
  cleanText(value, 160)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const loadDevelopmentPublicProfileLocations = async (req, role) => {
  if (!isDevelopmentPublicMarketplaceRequest(req)) return null;
  const requestedRole = cleanText(role, 30).toLowerCase();
  if (!["grower", "buyer"].includes(requestedRole)) return null;
  return withLocalFallback(async () => {
    const data = asObject(await fetchProductionPublicJson("/user/public-profile-locations", {
      role: requestedRole,
    }));
    const states = Array.isArray(data.states)
      ? data.states.map((stateValue) => {
          const state = asObject(stateValue);
          const name = cleanLocation(state.name);
          return {
            name,
            slug: slugifyPublicLocation(name),
            count: Math.max(0, cleanNumber(state.count) || 0),
            districts: Array.isArray(state.districts)
              ? state.districts.map((districtValue) => {
                  const district = asObject(districtValue);
                  const districtName = cleanLocation(district.name);
                  return {
                    name: districtName,
                    slug: slugifyPublicLocation(districtName),
                    count: Math.max(0, cleanNumber(district.count) || 0),
                  };
                }).filter((district) => district.name && district.slug)
              : [],
          };
        }).filter((state) => state.name && state.slug)
      : [];
    return {
      role: requestedRole,
      minimumIndexableProfiles: Math.max(1, cleanNumber(data.minimumIndexableProfiles) || 2),
      states,
    };
  });
};

const sanitizePublicMarketLot = (value, { closed = false } = {}) => {
  const lot = asObject(value);
  return compact({
    _id: encodePublicId(lot._id || lot.id, "product"),
    title: cleanText(lot.title, 240),
    fruitName: cleanText(lot.fruitName, 120),
    variety: cleanText(lot.variety, 120),
    grade: cleanText(lot.grade || lot.quality, 120),
    quantity: cleanNumber(lot.quantity),
    unit: cleanText(lot.unit, 40),
    price: closed ? cleanNumber(lot.price || lot.finalDealValue || lot.finalPrice) : undefined,
    finalPrice: closed ? cleanNumber(lot.finalPrice) : undefined,
    finalDealValue: closed ? cleanNumber(lot.finalDealValue) : undefined,
    status: cleanText(lot.status, 60),
    imageUrl: cleanUrl(lot.imageUrl),
    createdAt: cleanDate(lot.createdAt),
    updatedAt: cleanDate(lot.updatedAt),
  });
};

export const loadDevelopmentPublicProfile = async (req, { businessType, slug, userId } = {}) => {
  if (!isDevelopmentPublicMarketplaceRequest(req)) return null;
  const requestedType = cleanText(businessType, 80).toLowerCase().replace(/-/g, "_");
  const internalUserId = slug ? "" : decodePublicId(userId, "profile");
  if (!slug && !internalUserId) return null;
  const path = slug
    ? `/user/public-profiles/by-slug/${encodeURIComponent(requestedType)}/${encodeURIComponent(cleanText(slug, 180))}`
    : `/user/public-profiles/${encodeURIComponent(requestedType)}/${encodeURIComponent(internalUserId)}`;
  return withLocalFallback(async () => {
    const data = asObject(await fetchProductionPublicJson(path));
    const profile = sanitizeDevelopmentPublicProfile(data.profile);
    if (!profile) return null;
    const liveLots = Array.isArray(data.liveLots)
      ? data.liveLots.map((lot) => sanitizePublicMarketLot(lot, { closed: false }))
      : [];
    const closedDeals = Array.isArray(data.closedDeals)
      ? data.closedDeals.map((lot) => sanitizePublicMarketLot(lot, { closed: true }))
      : [];
    return {
      profile: { ...profile, totalLots: liveLots.length, totalDeals: closedDeals.length },
      liveLots,
      closedDeals,
    };
  });
};

export const loadDevelopmentPublicProducts = async (req) => {
  if (!isDevelopmentPublicMarketplaceRequest(req)) return null;
  return withLocalFallback(async () => {
    const data = await fetchProductionPublicJson("/products", { platform: "efruitmandi" });
    return Array.isArray(data) ? data.map(sanitizeDevelopmentPublicProduct) : [];
  });
};

const sanitizeClosedDeal = (value) => {
  const deal = asObject(value);
  if (!Object.keys(deal).length) return null;
  return compact({
    status: cleanText(deal.status, 60),
    closedRate: cleanNumber(deal.closedRate),
    finalDealValue: cleanNumber(deal.finalDealValue),
    soldBy: sanitizePublicParty(deal.soldBy, "grower"),
    purchasedBy: sanitizePublicParty(deal.purchasedBy, "buyer"),
    grade: cleanText(deal.grade, 80),
    closedAt: cleanDate(deal.closedAt),
    source: cleanText(deal.source, 30),
  });
};

export const loadDevelopmentPublicProduct = async (req, productId) => {
  if (!isDevelopmentPublicMarketplaceRequest(req)) return null;
  const id = decodePublicId(productId, "product");
  if (!id) return null;
  return withLocalFallback(async () => {
    const data = asObject(await fetchProductionPublicJson(`/products/${encodeURIComponent(id)}`, {
      platform: "efruitmandi",
    }));
    const product = sanitizeDevelopmentPublicProduct(data.product);
    if (!product?._id) return null;
    return {
      product,
      auction: data.auction ? sanitizeDevelopmentPublicAuction(data.auction) : null,
      closedDeal: sanitizeClosedDeal(data.closedDeal),
      fruitScanningReport: data.fruitScanningReport
        ? sanitizeFruitScanningReport(data.fruitScanningReport)
        : null,
    };
  });
};

export const loadDevelopmentPublicAuctions = async (req) => {
  if (!isDevelopmentPublicMarketplaceRequest(req)) return null;
  return withLocalFallback(async () => {
    const data = await fetchProductionPublicJson("/auctions");
    return Array.isArray(data) ? data.map(sanitizeDevelopmentPublicAuction) : [];
  });
};

export const DEVELOPMENT_PUBLIC_MARKETPLACE_RESPONSE_HEADER = "X-Dev-Public-Marketplace-Source";
