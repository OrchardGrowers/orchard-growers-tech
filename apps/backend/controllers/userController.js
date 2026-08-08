import mongoose from "mongoose";
import User from "../models/User.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import {
  getResourceType,
  uploadBufferToCloudinary,
} from "../services/cloudinaryService.js";
import {
  consumeOtpVerification,
  isOtpVerified,
  parseIdentifier,
} from "./authController.js";
import { getRoleKycStatus, refreshSettlementEligibility } from "../services/logisticsAssignmentService.js";
import {
  getVerificationFeedback,
  markVerificationResubmitted,
} from "../services/verificationFeedbackService.js";
import {
  getKycEligibility,
  normalizePanNumber,
  validateKycSubmission,
} from "../services/kycEligibilityService.js";
import {
  assertKycSectionEditable,
  getKycSectionDocuments,
  getKycSectionPayloadViolations,
  getKycSectionStates,
  getKycSectionsForRole,
  normalizeKycSection,
  validateKycSection,
} from "../services/kycSectionVerificationService.js";
import {
  createCloudinaryKycDocumentMetadata,
  normalizeKycDocumentMetadata,
} from "../services/kycDocumentStorageService.js";
import {
  getProfileBusinessType,
  normalizeBuyerBusinessType,
  normalizeOperationalRole,
  syncRegistrationPublication,
} from "../services/profilePublicationService.js";
import {
  isOrderCompletedForMarketplace,
  isPublicLotVisible,
} from "../services/dealLifecycleService.js";

const getVerifiedPhone = (contact, user = null, otpVerificationToken = "", platform = "efruitmandi") => {
  const parsed = parseIdentifier(contact);

  if (!parsed || parsed.type !== "phone") {
    return null;
  }

  const trustedPhones = [user?.contact, user?.phone]
    .map((value) => parseIdentifier(value))
    .filter((value) => value?.type === "phone")
    .map((value) => value.value);

  if (trustedPhones.includes(parsed.value)) return parsed;

  const verified =
    isOtpVerified(parsed, platform, "auth", otpVerificationToken) ||
    isOtpVerified(parsed, "efruitmandi", "auth", otpVerificationToken) ||
    isOtpVerified(parsed, "orchardgrowers", "auth", otpVerificationToken);

  if (!verified) return null;

  return parsed;
};

const getUserProfileTypes = (user) => {
  const profiles = new Set(Array.isArray(user.profileTypes) ? user.profileTypes : []);

  if (user.role) profiles.add(user.role);
  if (user.orchardName) profiles.add("grower");
  if (user.businessName || user.buyerContactPerson) profiles.add("buyer");
  if (user.logisticsName || user.vehicleNumber || user.driverName) profiles.add("driver");

  return profiles;
};

const PUBLIC_PROFILE_SELECT = [
  "name",
  "role",
  "activeRole",
  "profileTypes",
  "publicProfileRoles",
  "slug",
  "profileRegisteredAtByRole",
  "orchardName",
  "businessName",
  "buyerBusinessType",
  "buyerContactPerson",
  "buyerLocation",
  "logisticsName",
  "location",
  "addressLine3",
  "businessAddressLine3",
  "companyLogoUrl",
  "buyerCompanyLogoUrl",
  "bannerUrl",
  "buyerBannerUrl",
  "buyerVerified",
  "growerVerified",
  "driverVerified",
  "buyerOgVerified",
  "growerOgVerified",
  "driverOgVerified",
  "kycByRole",
  "ogVerificationByRole",
  "accountStatus",
  "createdAt",
].join(" ");

const PUBLIC_PROFILE_ROLES = new Set(["grower", "buyer", "driver"]);
const PUBLIC_PROFILE_ALL_LIMIT = 1000;
const PUBLIC_PROFILE_MARKET_LIMIT = 12;
const PUBLIC_LOCATION_MIN_PROFILES = 2;
const PUBLIC_FRUIT_PROFILE_MIN = 2;
const PUBLIC_MARKET_PRODUCT_SELECT = [
  "_id",
  "title",
  "fruitName",
  "variety",
  "quality",
  "gradeLots",
  "quantity",
  "unit",
  "basePrice",
  "finalPrice",
  "finalDealValue",
  "location",
  "images",
  "imageObjects",
  "status",
  "active",
  "auctionEndTime",
  "createdAt",
  "updatedAt",
  "createdBy",
  "createdSource",
  "inventoryType",
].join(" ");
const SENSITIVE_PUBLIC_LOCATION_PATTERN =
  /\b(address|house|street|road|near|plot|flat|building|village|ward|pin|pincode|post office|orchard location|exact)\b/i;

const cleanPublicText = (value = "") => String(value || "").trim();

const slugifyPublicLocation = (value = "") =>
  cleanPublicText(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const normalizePublicProduceName = (value = "") => {
  const name = cleanPublicText(value).replace(/\s+/g, " ");
  const slug = slugifyPublicLocation(name.replace(/\s+fruit$/i, ""));
  if (!name || name.length > 80 || /^\d+$/.test(name) || /^(n\/?a|na|none|other|unknown)$/i.test(name) || !slug) return null;
  return { name: name.replace(/\s+fruit$/i, "").replace(/\b\w/g, (letter) => letter.toUpperCase()), slug };
};

const exactPublicLocationRegex = (value = "") => {
  const escaped = cleanPublicText(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^\\s*${escaped}\\s*$`, "i");
};

const isApprovedStatus = (status = "") =>
  cleanPublicText(status).toUpperCase() === "APPROVED";

const getRoleRecord = (records = {}, role = "") => {
  const normalizedRole = cleanPublicText(role).toLowerCase();
  return normalizedRole ? records?.[normalizedRole] || {} : {};
};

const getPublicLocationFromText = (value = "") => {
  const text = cleanPublicText(value).replace(/\b\d{6}\b/g, "").replace(/\s+/g, " ");
  if (!text) return "";

  const parts = text
    .split(",")
    .map(cleanPublicText)
    .filter(Boolean)
    .filter((part) => !/\d/.test(part))
    .filter((part) => !SENSITIVE_PUBLIC_LOCATION_PATTERN.test(part));

  if (parts.length) return parts.slice(-3).join(", ");
  if (!/\d/.test(text) && !SENSITIVE_PUBLIC_LOCATION_PATTERN.test(text) && text.length <= 42) {
    return text;
  }
  return "";
};

const getPublicLocationFromParts = (...parts) =>
  parts
    .map(cleanPublicText)
    .filter(Boolean)
    .filter((part) => !/\d/.test(part))
    .filter((part) => !SENSITIVE_PUBLIC_LOCATION_PATTERN.test(part))
    .slice(0, 3)
    .join(", ");

const getPublicProfileIdentityQuery = (role) => {
  if (role === "grower") {
    return { orchardName: { $type: "string", $regex: /\S/ } };
  }

  if (role === "buyer") {
    return {
      $or: [
        { businessName: { $type: "string", $regex: /\S/ } },
        { buyerContactPerson: { $type: "string", $regex: /\S/ } },
      ],
    };
  }

  return null;
};

export const buildPublicProfileQuery = (role) => {
  const identityQuery = getPublicProfileIdentityQuery(role);

  return {
    $and: [
      { $or: [{ accountStatus: "ACTIVE" }, { accountStatus: { $exists: false } }] },
      { publicProfileRoles: role },
      { $or: [{ role }, { activeRole: role }, { profileTypes: role }] },
      ...(identityQuery ? [identityQuery] : []),
    ],
  };
};

export const toPublicProfile = (user = {}, role = "") => {
  const roleKyc = getRoleRecord(user.kycByRole, role);
  const roleOg = getRoleRecord(user.ogVerificationByRole, role);
  const district = cleanPublicText(roleKyc.district);
  const state = cleanPublicText(roleKyc.state);
  const mainLocation =
    getPublicLocationFromParts(district, state) ||
    getPublicLocationFromText(
      role === "buyer"
        ? user.buyerLocation || user.location
        : role === "grower"
          ? user.addressLine3 || user.location
          : user.location
    );

  const roleLogo =
    role === "buyer"
      ? cleanPublicText(user.buyerCompanyLogoUrl) ||
        cleanPublicText(user.companyLogoUrl)
      : cleanPublicText(user.companyLogoUrl);
  const registeredAt = user.profileRegisteredAtByRole?.[role] || user.createdAt;

  const isKycVerified = getKycEligibility(user, role).eligible;
  const isOgVerified = Boolean(
    (role === "buyer" && user.buyerOgVerified) ||
    (role === "grower" && user.growerOgVerified) ||
    (role === "driver" && user.driverOgVerified) ||
    (roleOg.requestId && isApprovedStatus(roleOg.status))
  );

  return {
    _id: user._id,
    slug: user.slug || "",
    role,
    activeRole: role,
    profileTypes: [role],
    businessType: getProfileBusinessType(user, role),
    name: user.name || "",
    companyName:
      role === "grower"
        ? user.orchardName || ""
        : role === "driver"
          ? user.logisticsName || ""
          : user.businessName || "",
    orchardName: role === "grower" ? user.orchardName || "" : "",
    businessName: role === "buyer" ? user.businessName || "" : "",
    logisticsName: role === "driver" ? user.logisticsName || "" : "",
    buyerContactPerson: role === "buyer" ? user.buyerContactPerson || "" : "",
    logoUrl: roleLogo,
    bannerUrl: cleanPublicText(role === "buyer" ? user.buyerBannerUrl || user.bannerUrl : user.bannerUrl),
    avatarUrl: roleLogo,
    profileImage: roleLogo,
    profilePic: roleLogo,
    avatar: roleLogo,
    photoURL: roleLogo,
    mainLocation,
    district,
    state,
    location: mainLocation,
    isKycVerified,
    isOgVerified,
    isTrusted: isOgVerified,
    registeredAt,
    createdAt: registeredAt || user.createdAt,
  };
};

const getPrimaryProductImage = (product = {}) => {
  const imageObject = Array.isArray(product.imageObjects)
    ? product.imageObjects.find((image) => image?.isPrimary && image?.url) ||
      product.imageObjects.find((image) => image?.url)
    : null;
  if (imageObject?.url) return imageObject.url;
  return Array.isArray(product.images) ? product.images.find(Boolean) || "" : "";
};

const getProductGradeLabel = (product = {}) => {
  if (product.quality) return product.quality;
  if (Array.isArray(product.gradeLots) && product.gradeLots.length) {
    return product.gradeLots.map((lot) => lot?.grade).filter(Boolean).slice(0, 2).join(", ");
  }
  return "";
};

const toPublicMarketLot = (product = {}, order = null) => ({
  _id: product._id,
  title: product.title || product.fruitName || "Fruit Lot",
  fruitName: product.fruitName || product.title || "",
  variety: product.variety || "",
  grade: getProductGradeLabel(product),
  location: getPublicLocationFromText(product.location),
  quantity: product.quantity || 0,
  unit: product.unit || "boxes",
  price: order
    ? order.totalAmount || order.finalPrice || product.finalDealValue || product.finalPrice || product.basePrice || 0
    : product.basePrice || product.finalDealValue || product.finalPrice || 0,
  status: order ? "Completed Deal" : product.status || "AVAILABLE",
  imageUrl: getPrimaryProductImage(product),
  createdAt: product.createdAt,
  updatedAt: product.updatedAt,
  closedAt: order?.updatedAt || order?.invoiceDate || "",
});

const getPublicProfileMarketActivity = async (userId, role) => {
  if (!["grower", "buyer"].includes(role)) {
    return { liveLots: [], closedDeals: [] };
  }

  const liveLots =
    role === "grower"
      ? await Product.find({
          createdBy: userId,
          active: { $ne: false },
          inventoryType: { $ne: "raw_material" },
          createdSource: { $ne: "admin-panel" },
        })
          .select(PUBLIC_MARKET_PRODUCT_SELECT)
          .sort({ createdAt: -1, _id: -1 })
          .limit(PUBLIC_PROFILE_MARKET_LIMIT)
          .lean()
      : [];

  const liveLotIds = liveLots.map((lot) => lot._id).filter(Boolean);
  const liveLotOrders = liveLotIds.length
    ? await Order.find({ product: { $in: liveLotIds } })
        .select("_id product paymentStatus deliveryStatus")
        .lean()
    : [];
  const completedOrderByProductId = liveLotOrders.reduce((map, order) => {
    if (isOrderCompletedForMarketplace(order)) map.set(String(order.product), order);
    return map;
  }, new Map());
  const now = new Date();

  const visibleLiveLots = liveLots
    .filter((lot) => isPublicLotVisible(lot, completedOrderByProductId.get(String(lot._id)) || null, now))
    .filter((lot) => !completedOrderByProductId.has(String(lot._id)))
    .map((lot) => toPublicMarketLot(lot));

  const closedOrders = await Order.find({ [role]: userId })
    .select("_id product finalPrice totalAmount paymentStatus deliveryStatus invoiceDate updatedAt createdAt")
    .populate("product", PUBLIC_MARKET_PRODUCT_SELECT)
    .sort({ updatedAt: -1, _id: -1 })
    .limit(PUBLIC_PROFILE_MARKET_LIMIT)
    .lean();

  const closedDeals = closedOrders
    .filter(isOrderCompletedForMarketplace)
    .filter((order) => order.product)
    .map((order) => toPublicMarketLot(order.product, order));

  return { liveLots: visibleLiveLots, closedDeals };
};

const hasGrowerKycPayload = (body = {}, files = {}) =>
  Boolean(
    String(body.roleType || "").trim().toLowerCase() === "grower" ||
      String(body.orchardName || "").trim() ||
      String(body.orchardLocation || "").trim() ||
      String(body.udyanCardNo || "").trim() ||
      files?.udyanCardFile?.[0]
  );

const joinAddressParts = (...parts) =>
  parts
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(", ");

const getBuyerPremisesAddress = (user = {}) =>
  user.buyerLocation ||
  joinAddressParts(
    user.businessAddressLine1,
    user.businessAddressLine2,
    user.businessAddressLine3
  ) ||
  user.location ||
  "";

const getGrowerPremisesAddress = (user = {}) =>
  joinAddressParts(
    user.addressLine1,
    user.addressLine2,
    user.addressLine3,
    user.location
  ) || user.location || "";

const getKycAddressFallback = (user = {}, roleType = "") => {
  if (roleType === "buyer") return getBuyerPremisesAddress(user);
  if (roleType === "grower") return getGrowerPremisesAddress(user);
  return user.location || "";
};

const getKycPinCodeFallback = (user = {}, roleType = "") => {
  if (roleType === "buyer") return user.buyerPinCode || user.businessPinCode || user.pinCode || "";
  return user.pinCode || "";
};

const VALID_KYC_ROLE_TYPES = new Set(["buyer", "grower", "driver"]);

const normalizeKycStatus = (status = "") => {
  const normalized = String(status || "").trim().toUpperCase();
  if (normalized === "SUBMITTED") return "PENDING";
  return normalized || "NOT_SUBMITTED";
};

const getRoleKyc = (user = {}, roleType = "") => {
  const role = String(roleType || "").trim().toLowerCase();
  const roleKyc = user.kycByRole?.[role];
  if (roleKyc && Object.keys(roleKyc.toObject?.() || roleKyc).length) return roleKyc.toObject?.() || roleKyc;

  const legacyKyc = user.kyc?.toObject?.() || user.kyc || {};
  const legacyRole = String(legacyKyc.roleType || "").trim().toLowerCase();
  if (legacyRole === role || (!legacyRole && role && Object.keys(legacyKyc).some((key) => legacyKyc[key]))) {
    return legacyKyc;
  }

  return {};
};

const resolveRequestedKycRole = (user = {}, requestedRoleType = "") => {
  const profiles = getUserProfileTypes(user);
  const requestedRole = String(requestedRoleType || "").trim().toLowerCase();
  if (VALID_KYC_ROLE_TYPES.has(requestedRole) && (profiles.size === 0 || profiles.has(requestedRole))) return requestedRole;
  if (profiles.has("buyer")) return "buyer";
  if (profiles.has("grower")) return "grower";
  if (profiles.has("driver")) return "driver";
  return "buyer";
};

const parseKycDocuments = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const KYC_DOCUMENT_FIELD_BY_LABEL = {
  idProof: "idProofImage",
  idProofImage: "idProofImage",
  aadhaarCard: "aadhaarCardFileUrl",
  aadhaarCardFile: "aadhaarCardFileUrl",
  pan: "panImage",
  panImage: "panImage",
  gst: "gstCertificate",
  gstCertificate: "gstCertificate",
  passbook: "passbookFileUrl",
  passbookFile: "passbookFileUrl",
  bankProof: "passbookFileUrl",
  udyanCard: "udyanCardFileUrl",
  udyanCardFile: "udyanCardFileUrl",
  drivingLicense: "drivingLicenseImage",
  drivingLicenseImage: "drivingLicenseImage",
};

const getAvailableRoles = (user = {}) => Array.from(getUserProfileTypes(user)).filter((role) => VALID_KYC_ROLE_TYPES.has(role));

const isAadhaarProof = (value = "") => String(value || "").trim().toLowerCase() === "aadhaar";
const normalizeAadhaar = (value = "") => String(value || "").replace(/\D/g, "").slice(0, 12);
const getAllowedCreateRoles = (roles = []) => {
  const roleSet = new Set(roles);
  return ["grower", "buyer", "driver"].filter((role) => {
    if (roleSet.has(role)) return false;
    if (role === "buyer" && roleSet.has("driver")) return false;
    if (role === "driver" && roleSet.has("buyer")) return false;
    return true;
  });
};

const getRoleKycSummary = (user = {}, roleType = "") => {
  const kyc = getRoleKyc(user, roleType);
  const status = normalizeKycStatus(kyc.status).toLowerCase();
  const eligibility = getKycEligibility(user, roleType);
  return {
    roleType: roleType === "driver" ? "logistic" : roleType,
    exists: true,
    profileId: `${user._id}:${roleType}`,
    kycStatus: status,
    kycVerified: eligibility.eligible,
    panUpdateRequired: eligibility.panUpdateRequired,
    verificationRequestId: kyc.submittedAt ? `${user._id}:${roleType}` : "",
    status: user.accountStatus || "ACTIVE",
  };
};

export const getPublicProfiles = async (req, res) => {
  try {
    const requestedRole = cleanPublicText(req.query.role).toLowerCase();
    const role =
      normalizeOperationalRole(requestedRole) ||
      (["exporter", "commission_agent", "commission-agent", "cold_storage", "cold-storage"].includes(requestedRole)
        ? "buyer"
        : "");
    const requestedBusinessType = requestedRole.replace(/-/g, "_");
    const requestedLimit = cleanPublicText(req.query.limit).toLowerCase();
    const limit =
      requestedLimit === "all"
        ? PUBLIC_PROFILE_ALL_LIMIT
        : Math.min(Math.max(Number(req.query.limit) || 10, 1), PUBLIC_PROFILE_ALL_LIMIT);
    const roles = PUBLIC_PROFILE_ROLES.has(role) ? [role] : Array.from(PUBLIC_PROFILE_ROLES);
    const requestedState = cleanPublicText(req.query.state);
    const requestedDistrict = cleanPublicText(req.query.district);

    const profilesByRole = await Promise.all(
      roles.map(async (profileRole) => {
        const locationQuery = {
          ...(requestedState ? { [`kycByRole.${profileRole}.state`]: exactPublicLocationRegex(requestedState) } : {}),
          ...(requestedDistrict ? { [`kycByRole.${profileRole}.district`]: exactPublicLocationRegex(requestedDistrict) } : {}),
        };
        const users = await User.find({
          ...buildPublicProfileQuery(profileRole),
          ...locationQuery,
        })
          .select(PUBLIC_PROFILE_SELECT)
          .sort({ [`profileRegisteredAtByRole.${profileRole}`]: -1, createdAt: -1, _id: -1 })
          .limit(limit)
          .lean();

        return users
          .map((user) => toPublicProfile(user, profileRole))
          .filter(
            (profile) =>
              !["exporter", "commission_agent", "cold_storage"].includes(requestedBusinessType) ||
              profile.businessType === requestedBusinessType
          );
      })
    );

    const profiles = profilesByRole.flat().sort((a, b) => {
      const bTime = new Date(b.registeredAt || b.createdAt || 0).getTime();
      const aTime = new Date(a.registeredAt || a.createdAt || 0).getTime();
      return bTime - aTime;
    });

    res.json({
      role: role || "all",
      count: profiles.length,
      profiles: profiles.slice(0, roles.length === 1 ? limit : limit * roles.length),
    });
  } catch (err) {
    console.error("Get public profiles error:", err);
    res.status(500).json({ msg: "Unable to load public profiles" });
  }
};

const getPublicProfile = async (req, res, lookup) => {
  try {
    const requestedType = cleanPublicText(req.query.role || req.params.businessType)
      .toLowerCase()
      .replace(/-/g, "_");
    const role =
      normalizeOperationalRole(requestedType) ||
      (["exporter", "commission_agent", "cold_storage"].includes(requestedType)
        ? "buyer"
        : "");
    if (!role || !PUBLIC_PROFILE_ROLES.has(role)) {
      return res.status(400).json({ msg: "Unsupported public profile type" });
    }

    const userDocument = await User.findOne({
      ...lookup,
      ...buildPublicProfileQuery(role),
    })
      .select(PUBLIC_PROFILE_SELECT);
    if (!userDocument) return res.status(404).json({ msg: "Public profile not found" });

    if (!userDocument.slug) {
      await userDocument.ensurePublicSlug();
      await userDocument.save();
    }
    const user = userDocument.toObject();

    const profile = toPublicProfile(user, role);
    if (
      ["exporter", "commission_agent", "cold_storage"].includes(requestedType) &&
      profile.businessType !== requestedType
    ) {
      return res.status(404).json({ msg: "Public profile not found" });
    }

    const marketActivity = await getPublicProfileMarketActivity(user._id, role);
    return res.json({
      profile: {
        ...profile,
        totalLots: marketActivity.liveLots.length,
        totalDeals: marketActivity.closedDeals.length,
      },
      ...marketActivity,
    });
  } catch (err) {
    if (err?.name === "CastError") {
      return res.status(404).json({ msg: "Public profile not found" });
    }
    console.error("Get public profile error:", err);
    return res.status(500).json({ msg: "Unable to load public profile" });
  }
};

export const getPublicProfileLocations = async (req, res) => {
  try {
    const requestedRole = cleanPublicText(req.query.role).toLowerCase();
    const role = normalizeOperationalRole(requestedRole);
    if (!role || !["grower", "buyer"].includes(role)) {
      return res.status(400).json({ msg: "Unsupported public profile type" });
    }

    const users = await User.find(buildPublicProfileQuery(role))
      .select(PUBLIC_PROFILE_SELECT)
      .sort({ createdAt: -1, _id: -1 })
      .limit(PUBLIC_PROFILE_ALL_LIMIT)
      .lean();
    const states = new Map();

    users.map((user) => toPublicProfile(user, role)).forEach((profile) => {
      const state = cleanPublicText(profile.state);
      const district = cleanPublicText(profile.district);
      const stateSlug = slugifyPublicLocation(state);
      if (!state || !stateSlug) return;

      const stateKey = state.toLocaleLowerCase("en-IN").replace(/\s+/g, " ");
      if (!states.has(stateKey)) {
        states.set(stateKey, { name: state, slug: stateSlug, count: 0, districts: new Map() });
      }
      const stateEntry = states.get(stateKey);
      stateEntry.count += 1;

      const districtSlug = slugifyPublicLocation(district);
      if (!district || !districtSlug) return;
      const districtKey = district.toLocaleLowerCase("en-IN").replace(/\s+/g, " ");
      if (!stateEntry.districts.has(districtKey)) {
        stateEntry.districts.set(districtKey, { name: district, slug: districtSlug, count: 0 });
      }
      stateEntry.districts.get(districtKey).count += 1;
    });

    const stateValues = Array.from(states.values());
    const stateSlugCounts = stateValues.reduce((counts, state) => counts.set(state.slug, (counts.get(state.slug) || 0) + 1), new Map());
    return res.json({
      role,
      minimumIndexableProfiles: PUBLIC_LOCATION_MIN_PROFILES,
      states: stateValues.filter((state) => stateSlugCounts.get(state.slug) === 1).map((state) => {
        const districts = Array.from(state.districts.values());
        const districtSlugCounts = districts.reduce((counts, district) => counts.set(district.slug, (counts.get(district.slug) || 0) + 1), new Map());
        return {
        name: state.name,
        slug: state.slug,
        count: state.count,
        districts: districts.filter((district) => districtSlugCounts.get(district.slug) === 1),
        };
      }),
    });
  } catch (err) {
    console.error("Get public profile locations error:", err);
    return res.status(500).json({ msg: "Unable to load public profile locations" });
  }
};

export const buildPublicFruitDiscovery = async () => {
  const candidateProducts = await Product.find({
    active: { $ne: false },
    inventoryType: { $ne: "raw_material" },
    createdSource: { $ne: "admin-panel" },
    status: { $in: ["AVAILABLE", "SCHEDULED", "IN_AUCTION", "SOLD", "DEAL_CONFIRMED", "deal_confirmed"] },
  }).select("_id fruitName variety createdBy acceptedBuyerId status active auctionEndTime").limit(5000).lean();
  const candidateProductIds = candidateProducts.map((product) => product._id).filter(Boolean);
  const completedOrders = candidateProductIds.length
    ? await Order.find({ product: { $in: candidateProductIds } })
        .select("_id product paymentStatus deliveryStatus")
        .lean()
    : [];
  const completedOrderByProductId = completedOrders.reduce((map, order) => {
    if (isOrderCompletedForMarketplace(order)) map.set(String(order.product), order);
    return map;
  }, new Map());
  const now = new Date();
  const products = candidateProducts.filter((product) =>
    isPublicLotVisible(product, completedOrderByProductId.get(String(product._id)) || null, now)
  );
  const growerIds = [...new Set(products.map((product) => String(product.createdBy || "")).filter(Boolean))];
  const completedProducts = products.filter((product) => product.status === "SOLD");
  const buyerIds = [...new Set(completedProducts.map((product) => String(product.acceptedBuyerId || "")).filter(Boolean))];
  const [growers, buyers] = await Promise.all([
    User.find({ _id: { $in: growerIds }, ...buildPublicProfileQuery("grower") }).select(PUBLIC_PROFILE_SELECT).lean(),
    User.find({ _id: { $in: buyerIds }, ...buildPublicProfileQuery("buyer") }).select(PUBLIC_PROFILE_SELECT).lean(),
  ]);
  const toFruitDiscoveryProfile = (user, role) => {
    const profile = toPublicProfile(user, role);
    return {
      _id: profile._id,
      slug: profile.slug,
      role: profile.role,
      businessType: profile.businessType,
      companyName: profile.companyName,
      orchardName: profile.orchardName,
      businessName: profile.businessName,
      mainLocation: profile.mainLocation,
      district: profile.district,
      state: profile.state,
      logoUrl: profile.logoUrl,
      isKycVerified: profile.isKycVerified,
      isOgVerified: profile.isOgVerified,
    };
  };
  const growerMap = new Map(growers.map((user) => [String(user._id), toFruitDiscoveryProfile(user, "grower")]));
  const buyerMap = new Map(buyers.map((user) => [String(user._id), toFruitDiscoveryProfile(user, "buyer")]));
  const fruits = new Map();

  products.forEach((product) => {
    const fruit = normalizePublicProduceName(product.fruitName);
    if (!fruit) return;
    const entry = fruits.get(fruit.slug) || { name: fruit.name, slug: fruit.slug, lotIds: new Set(), growers: new Map(), buyers: new Map(), varieties: new Map() };
    entry.lotIds.add(String(product._id));
    const grower = growerMap.get(String(product.createdBy || ""));
    if (grower) entry.growers.set(String(grower._id), grower);
    if (product.status === "SOLD") {
      const buyer = buyerMap.get(String(product.acceptedBuyerId || ""));
      if (buyer) entry.buyers.set(String(buyer._id), buyer);
    }
    const variety = normalizePublicProduceName(product.variety);
    if (variety) {
      const varietyEntry = entry.varieties.get(variety.slug) || { name: variety.name, slug: variety.slug, lotIds: new Set(), growers: new Map(), buyers: new Map() };
      varietyEntry.lotIds.add(String(product._id));
      if (grower) varietyEntry.growers.set(String(grower._id), grower);
      const buyer = entry.buyers.get(String(product.acceptedBuyerId || ""));
      if (buyer) varietyEntry.buyers.set(String(buyer._id), buyer);
      entry.varieties.set(variety.slug, varietyEntry);
    }
    fruits.set(fruit.slug, entry);
  });

  const serialize = (entry) => ({
    name: entry.name, slug: entry.slug, lotCount: entry.lotIds.size,
    growers: Array.from(entry.growers.values()), buyers: Array.from(entry.buyers.values()),
    growerCount: entry.growers.size, buyerCount: entry.buyers.size,
  });
  return {
    thresholds: { overview: 1, profiles: PUBLIC_FRUIT_PROFILE_MIN, variety: 2 },
    fruits: Array.from(fruits.values()).map((fruit) => ({ ...serialize(fruit), varieties: Array.from(fruit.varieties.values()).map(serialize) })),
  };
};

export const getPublicFruitDiscovery = async (req, res) => {
  try {
    return res.json(await buildPublicFruitDiscovery());
  } catch (err) {
    console.error("Get public fruit discovery error:", err);
    return res.status(500).json({ msg: "Unable to load public fruit discovery" });
  }
};

export const getPublicProfileById = (req, res) => {
  if (!mongoose.isValidObjectId(req.params.userId)) {
    return res.status(404).json({ msg: "Public profile not found" });
  }
  return getPublicProfile(req, res, { _id: req.params.userId });
};

export const getPublicProfileBySlug = (req, res) => {
  const slug = cleanPublicText(req.params.slug).toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return res.status(404).json({ msg: "Public profile not found" });
  }
  return getPublicProfile(req, res, { slug });
};

export const getMyRoles = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password -__v");
    if (!user) return res.status(404).json({ msg: "User not found" });

    const roles = getAvailableRoles(user);
    const activeRole = resolveRequestedKycRole(user, user.activeRole || user.role || roles[0] || "");
    res.json({
      userId: user._id,
      phone: user.phone || user.contact,
      activeRole: activeRole === "driver" ? "logistic" : activeRole,
      roles: roles.map((role) => getRoleKycSummary(user, role)),
      allowedCreateRoles: getAllowedCreateRoles(roles).map((role) => (role === "driver" ? "logistic" : role)),
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

export const switchMyRole = async (req, res) => {
  try {
    const requestedRole = String(req.body.roleType || req.body.role || "").trim().toLowerCase();
    const role = requestedRole === "logistic" ? "driver" : requestedRole;
    if (!VALID_KYC_ROLE_TYPES.has(role)) return res.status(400).json({ msg: "Invalid role" });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: "User not found" });

    const roles = getAvailableRoles(user);
    const currentRole = resolveRequestedKycRole(user, user.activeRole || user.role || roles[0] || "");
    if (!roles.includes(role)) return res.status(400).json({ msg: "Requested role profile does not exist" });
    if (currentRole === role) return res.status(400).json({ msg: "This role is already active" });

    user.activeRole = role;
    await user.save();
    const safeUser = await User.findById(user._id).select("-password -__v");
    res.json({ success: true, activeRole: role === "driver" ? "logistic" : role, user: safeUser });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

export const createRoleProfile = async (req, res) => {
  req.body.role = String(req.body.roleType || req.body.role || "").trim().toLowerCase() === "logistic" ? "driver" : req.body.role || req.body.roleType;
  return setUserRole(req, res);
};

// ================= SET ROLE =================
export const setUserRole = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      role,
      orchardName,
      businessName,
      buyerBusinessType,
      buyerContactPerson,
      buyerLocation,
      buyerPinCode,
      designation,
      gstNumber,
      tradeLicenseNumber,
      logisticsName,
      logisticsOwnerName,
      logisticsOwnerContact,
      driverName,
      driverContact,
      ownerIsDriver,
      vehicleNumber,
      licenseNumber,
      location,
      addressLine1,
      addressLine2,
      addressLine3,
      pinCode,
      mapLatitude,
      mapLongitude,
      googleMapUrl,
      contact,
      otpVerificationToken = "",
      assignmentToken = "",
      platform = "efruitmandi",
      allowUpdate = false,
      publicProfile = false,
    } = req.body;

    // ✅ Validate role
    const allowedRoles = ["grower", "buyer", "driver"];
    if (!role || !allowedRoles.includes(role)) {
      return res.status(400).json({ msg: "Invalid role" });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    // 🔒 Prevent role change after set (important for integrity)
    const profileTypes = getUserProfileTypes(user);
    const profileAlreadyExists = profileTypes.has(role);

    if (profileAlreadyExists && !allowUpdate) {
      const safeUser = await User.findById(userId).select("-password -__v");
      return res.status(409).json({
        success: false,
        msg: "Profile already exists",
        profileCreated: false,
        role,
        user: safeUser,
      });
    }

    if (role === "buyer" && profileTypes.has("driver")) {
      return res.status(400).json({
        msg: "Buyer profile cannot be added because this account is already registered as Driver.",
      });
    }

    if (role === "driver" && profileTypes.has("buyer")) {
      return res.status(400).json({
        msg: "Driver profile cannot be added because this account is already registered as Buyer.",
      });
    }

    // ✅ Assign role
    let verifiedPhone = null;

    // ✅ Role-specific validation
    if (role === "grower") {
      if (!orchardName || !contact) {
        return res.status(400).json({
          msg: "Orchard name and verified contact number are required",
        });
      }

      verifiedPhone = getVerifiedPhone(contact, profileAlreadyExists ? user : null, otpVerificationToken, platform);
      if (!verifiedPhone) {
        return res.status(400).json({
          msg: "Verify contact number OTP before grower registration",
        });
      }

      user.role = user.role || role;
      user.orchardName = orchardName.trim();
      user.contact = verifiedPhone.value;
      if (designation) user.designation = designation.trim();
    }

    if (role === "buyer") {
      const nextBuyerLocation = buyerLocation || location;
      const nextBuyerPinCode = buyerPinCode || pinCode;
      if (!businessName || !buyerContactPerson || !nextBuyerLocation || !contact) {
        return res.status(400).json({
          msg: "Company name, contact person, location, and contact number are required",
        });
      }

      verifiedPhone = getVerifiedPhone(contact, profileAlreadyExists ? user : null, otpVerificationToken, platform);
      if (!verifiedPhone) {
        return res.status(400).json({
          msg: "Verify contact number OTP before buyer registration",
        });
      }

      user.role = user.role || role;
      user.businessName = businessName.trim();
      user.buyerBusinessType = normalizeBuyerBusinessType(buyerBusinessType);
      user.buyerContactPerson = buyerContactPerson.trim();
      user.buyerLocation = nextBuyerLocation.trim();
      if (nextBuyerPinCode) user.buyerPinCode = nextBuyerPinCode.trim();
      if (designation) user.designation = designation.trim();
      user.contact = verifiedPhone.value;
      if (gstNumber) user.gstNumber = gstNumber.trim();
      if (tradeLicenseNumber) {
        user.tradeLicenseNumber = tradeLicenseNumber.trim();
      }
    }

    if (role === "driver") {
      if (!logisticsName || !vehicleNumber || !contact) {
        return res.status(400).json({
          msg: "Logistics name, vehicle number, and contact are required",
        });
      }
      user.role = user.role || role;
      user.logisticsName = logisticsName.trim();
      user.logisticsOwnerName = (logisticsOwnerName || logisticsName).trim();
      user.logisticsOwnerContact = (logisticsOwnerContact || contact).trim();
      user.ownerIsDriver = Boolean(ownerIsDriver);
      user.driverName = (ownerIsDriver ? logisticsOwnerName || logisticsName : driverName || logisticsName).trim();
      user.driverContact = (ownerIsDriver ? logisticsOwnerContact || contact : driverContact || contact).trim();
      user.vehicleNumber = vehicleNumber.trim();
      user.contact = contact.trim();
      if (licenseNumber) user.licenseNumber = licenseNumber.trim();
    }

    // ✅ Optional fields (only update if provided)
    if (location) user.location = location.trim();
    if (addressLine1) user.addressLine1 = addressLine1.trim();
    if (addressLine2) user.addressLine2 = addressLine2.trim();
    if (addressLine3) user.addressLine3 = addressLine3.trim();
    if (pinCode) user.pinCode = pinCode.trim();
    if (mapLatitude !== undefined && mapLatitude !== null && mapLatitude !== "") {
      const latitude = Number(mapLatitude);
      if (Number.isFinite(latitude)) user.mapLatitude = latitude;
    }
    if (mapLongitude !== undefined && mapLongitude !== null && mapLongitude !== "") {
      const longitude = Number(mapLongitude);
      if (Number.isFinite(longitude)) user.mapLongitude = longitude;
    }
    if (googleMapUrl) user.googleMapUrl = googleMapUrl.trim();

    profileTypes.add(role);
    user.profileTypes = Array.from(profileTypes);
    user.activeRole = role;
    const publicProfileRoles = new Set(
      Array.isArray(user.publicProfileRoles) ? user.publicProfileRoles : []
    );
    const isPublicProfile =
      publicProfile === true || String(publicProfile).trim().toLowerCase() === "true";
    if (isPublicProfile) publicProfileRoles.add(role);
    else publicProfileRoles.delete(role);
    user.publicProfileRoles = Array.from(publicProfileRoles);
    if (!profileAlreadyExists && !user.profileRegisteredAtByRole?.[role]) {
      user.set(`profileRegisteredAtByRole.${role}`, new Date());
    }

    await user.save();
    void syncRegistrationPublication(user.toObject(), role).catch((error) => {
      console.error("Profile publication sync failed:", error?.message || error);
    });

    if (role === "driver" && assignmentToken) {
      const order = await Order.findOne({ "logisticsAssignment.invitationToken": String(assignmentToken).trim() });
      if (order && ["AWAITING_LOGISTICS_REGISTRATION", "UNREGISTERED_LOGISTICS"].includes(order.logisticsAssignment?.status)) {
        order.logisticsAssignment.status = "LOGISTICS_REGISTERED";
        order.logisticsAssignment.assignedLogisticsAccount = user._id;
        order.logisticsAssignment.registrationStatus = "REGISTERED";
        order.logisticsAssignment.kycStatus = getRoleKycStatus(user, "driver") || (user.driverVerified ? "APPROVED" : "NOT_SUBMITTED");
        order.logisticsAssignment.notifications.app = true;
        await refreshSettlementEligibility(order, {
          grower: await User.findById(order.grower).lean(),
          logistics: user.toObject ? user.toObject() : user,
        });
        await order.save();
      }
    }

    if (verifiedPhone && otpVerificationToken) {
      consumeOtpVerification(verifiedPhone, platform, "auth", otpVerificationToken);
    }

    // 🔐 Return safe user data only
    const safeUser = await User.findById(userId).select("-password -__v");

    res.json({
      success: true,
      profileCreated: !profileAlreadyExists,
      role,
      message: profileAlreadyExists ? "Profile updated successfully" : "Profile created successfully",
      user: safeUser,
    });

  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};


// ================= GET PROFILE =================
export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select("-password -__v");

    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    res.json(user);

  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

export const getMyKyc = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password -__v");
    if (!user) return res.status(404).json({ msg: "User not found" });
    const roleType = resolveRequestedKycRole(user, req.query.roleType || req.query.role || "");
    const roleKyc = getRoleKyc(user, roleType);
    const kyc = {
      ...roleKyc,
      roleType,
      status: normalizeKycStatus(roleKyc.status),
    };
    const feedback = await getVerificationFeedback({
      userId: req.user.id,
      sections: ["kyc", "pan", "bank", "document"],
      roleType,
      includeHistory: false,
    });
    const sectionStates = await getKycSectionStates({
      userId: req.user.id,
      roleType,
      kyc,
    });

    res.json({
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        phone: user.phone || user.contact,
        email: user.email,
        role: user.role,
        profileTypes: user.profileTypes || [],
        orchardName: user.orchardName,
        businessName: user.businessName,
        logisticsName: user.logisticsName,
        location: user.location,
        pinCode: user.pinCode,
        buyerLocation: user.buyerLocation,
        buyerPinCode: user.buyerPinCode,
        businessAddressLine1: user.businessAddressLine1,
        businessAddressLine2: user.businessAddressLine2,
        businessAddressLine3: user.businessAddressLine3,
        businessPinCode: user.businessPinCode,
        addressLine1: user.addressLine1,
        addressLine2: user.addressLine2,
        addressLine3: user.addressLine3,
        buyerOgVerified: user.buyerOgVerified,
        growerOgVerified: user.growerOgVerified,
        driverOgVerified: user.driverOgVerified,
        ogVerificationByRole: user.ogVerificationByRole,
      },
      kyc,
      panUpdateRequired: getKycEligibility(user, roleType).panUpdateRequired,
      verificationFeedback: feedback.active,
      latestVerificationFeedback: feedback.latest,
      sectionStates,
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// ================= UPDATE BASIC PROFILE =================
export const updateProfile = async (req, res) => {
  try {
    const {
      location,
      businessAddressLine1,
      businessAddressLine2,
      businessAddressLine3,
      businessPinCode,
      addressLine1,
      addressLine2,
      addressLine3,
      pinCode,
      name,
      designation,
      orchardName,
      businessName,
      buyerContactPerson,
      buyerLocation,
      buyerPinCode,
      logisticsName,
      phone,
      contact,
      email,
      phoneOtpVerificationToken,
      emailOtpVerificationToken,
      platform,
      socialLinks,
    } = req.body;
    let publicNameChanged = false;
    let verifiedEmailForUpdate = null;
    let verifiedPhoneForUpdate = null;
    if (typeof orchardName === "string" || typeof businessName === "string" || typeof buyerContactPerson === "string") {
      const currentPublicNames = await User.findById(req.user.id).select("orchardName businessName buyerContactPerson").lean();
      publicNameChanged = Boolean(
        (typeof orchardName === "string" && orchardName.trim() !== String(currentPublicNames?.orchardName || "")) ||
        (typeof businessName === "string" && businessName.trim() !== String(currentPublicNames?.businessName || "")) ||
        (typeof buyerContactPerson === "string" && buyerContactPerson.trim() !== String(currentPublicNames?.buyerContactPerson || ""))
      );
    }
    const updates = {};

    if (typeof location === "string") {
      updates.location = location.trim();
    }
    if (typeof name === "string" && name.trim()) {
      updates.name = name.trim();
    }
    if (typeof designation === "string") {
      updates.designation = designation.trim();
    }
    if (typeof orchardName === "string") {
      updates.orchardName = orchardName.trim();
    }
    if (typeof businessName === "string") {
      updates.businessName = businessName.trim();
    }
    if (typeof buyerContactPerson === "string") {
      updates.buyerContactPerson = buyerContactPerson.trim();
    }
    if (typeof buyerLocation === "string") {
      updates.buyerLocation = buyerLocation.trim();
    }
    if (typeof buyerPinCode === "string") {
      updates.buyerPinCode = buyerPinCode.trim();
    }
    if (typeof logisticsName === "string") {
      updates.logisticsName = logisticsName.trim();
    }
    if (typeof businessAddressLine1 === "string") {
      updates.businessAddressLine1 = businessAddressLine1.trim();
    }
    if (typeof businessAddressLine2 === "string") {
      updates.businessAddressLine2 = businessAddressLine2.trim();
    }
    if (typeof businessAddressLine3 === "string") {
      updates.businessAddressLine3 = businessAddressLine3.trim();
    }
    if (typeof businessPinCode === "string") {
      updates.businessPinCode = businessPinCode.trim();
    }
    if (typeof addressLine1 === "string") {
      updates.addressLine1 = addressLine1.trim();
    }
    if (typeof addressLine2 === "string") {
      updates.addressLine2 = addressLine2.trim();
    }
    if (typeof addressLine3 === "string") {
      updates.addressLine3 = addressLine3.trim();
    }
    if (typeof pinCode === "string") {
      updates.pinCode = pinCode.trim();
    }
    if (typeof email === "string" && email.trim()) {
      const parsedEmail = parseIdentifier(email);

      if (
        !parsedEmail ||
        parsedEmail.type !== "email" ||
        !isOtpVerified(parsedEmail, platform || "efruitmandi", "auth", emailOtpVerificationToken)
      ) {
        return res.status(400).json({ msg: "Verify email OTP before saving" });
      }

      updates.email = parsedEmail.value;
      verifiedEmailForUpdate = parsedEmail;
    }
    const contactNumber = typeof phone === "string" ? phone : contact;
    if (typeof contactNumber === "string" && contactNumber.trim()) {
      const parsedPhone = parseIdentifier(contactNumber);

      if (
        !parsedPhone ||
        parsedPhone.type !== "phone" ||
        !isOtpVerified(parsedPhone, platform || "efruitmandi", "auth", phoneOtpVerificationToken)
      ) {
        return res.status(400).json({ msg: "Verify contact number OTP before saving" });
      }

      updates.phone = parsedPhone.value;
      verifiedPhoneForUpdate = parsedPhone;
    }
    if (socialLinks && typeof socialLinks === "object") {
      const currentUser = await User.findById(req.user.id).select("socialLinks");
      const currentSocialLinks = currentUser?.socialLinks?.toObject?.() || {};
      updates.socialLinks = {
        google: sanitizeSocialLink(socialLinks.google, currentSocialLinks.google),
        facebook: sanitizeSocialLink(socialLinks.facebook, currentSocialLinks.facebook),
        twitter: sanitizeSocialLink(socialLinks.twitter, currentSocialLinks.twitter),
      };
    }

    let user = await User.findByIdAndUpdate(req.user.id, updates, {
      new: true,
    }).select("-password -__v");

    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    if (verifiedEmailForUpdate) {
      consumeOtpVerification(
        verifiedEmailForUpdate,
        platform || "efruitmandi",
        "auth",
        emailOtpVerificationToken
      );
    }
    if (verifiedPhoneForUpdate) {
      consumeOtpVerification(
        verifiedPhoneForUpdate,
        platform || "efruitmandi",
        "auth",
        phoneOtpVerificationToken
      );
    }

    if (publicNameChanged) {
      await user.ensurePublicSlug(true);
      await user.save();
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

const sanitizeSocialLink = (value, fallback = "") => {
  if (typeof value !== "string") return fallback || "";
  return value.trim();
};

// ================= UPDATE PROFILE MEDIA =================
export const updateProfileMedia = async (req, res) => {
  try {
    const { avatarUrl, bannerUrl, companyLogoUrl } = req.body;
    const profileMode = String(req.body.profileMode || "").trim().toLowerCase();
    const updates = {};
    const avatarFile = req.files?.avatar?.[0] || req.files?.avatarUrl?.[0];
    const bannerFile = req.files?.banner?.[0] || req.files?.bannerUrl?.[0];
    const companyLogoFile =
      req.files?.companyLogo?.[0] || req.files?.companyLogoUrl?.[0];
    const profileTypes = new Set(req.user?.profileTypes || []);
    if (req.user?.role) profileTypes.add(req.user.role);
    const activeProfileMode =
      profileMode === "buyer" && profileTypes.has("buyer")
        ? "buyer"
        : profileMode === "grower" && profileTypes.has("grower")
          ? "grower"
          : profileMode === "driver" && profileTypes.has("driver")
            ? "driver"
            : profileTypes.has("driver")
              ? "driver"
              : profileTypes.has("buyer")
                ? "buyer"
                : "grower";
    const profileFolder = activeProfileMode === "driver"
      ? "efruitmandi/drivers"
      : activeProfileMode === "buyer"
        ? "efruitmandi/buyers"
        : "efruitmandi/growers";
    const uploadProfileFile = (file) =>
      uploadBufferToCloudinary(file, {
        folder: profileFolder,
        resourceType: "image",
      });

    if (avatarFile) {
      const uploaded = await uploadProfileFile(avatarFile);
      updates[activeProfileMode === "buyer" ? "buyerAvatarUrl" : "avatarUrl"] = uploaded.secure_url;
    } else if (typeof avatarUrl === "string" && !avatarUrl.startsWith("data:")) {
      updates[activeProfileMode === "buyer" ? "buyerAvatarUrl" : "avatarUrl"] = avatarUrl;
    }

    if (bannerFile) {
      const uploaded = await uploadProfileFile(bannerFile);
      updates[activeProfileMode === "buyer" ? "buyerBannerUrl" : "bannerUrl"] = uploaded.secure_url;
    } else if (typeof bannerUrl === "string" && !bannerUrl.startsWith("data:")) {
      updates[activeProfileMode === "buyer" ? "buyerBannerUrl" : "bannerUrl"] = bannerUrl;
    }

    if (companyLogoFile) {
      const uploaded = await uploadProfileFile(companyLogoFile);
      updates[activeProfileMode === "buyer" ? "buyerCompanyLogoUrl" : "companyLogoUrl"] = uploaded.secure_url;
    } else if (
      typeof companyLogoUrl === "string" &&
      !companyLogoUrl.startsWith("data:")
    ) {
      updates[activeProfileMode === "buyer" ? "buyerCompanyLogoUrl" : "companyLogoUrl"] = companyLogoUrl;
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({ msg: "No valid profile image provided" });
    }

    const user = await User.findByIdAndUpdate(req.user.id, updates, {
      new: true,
    }).select("-password -__v");

    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// ================= UPDATE KYC =================
export const updateKyc = async (req, res) => {
  try {
    const existingUser = await User.findById(req.user.id).select("-password -__v");

    if (!existingUser) {
      return res.status(404).json({ msg: "User not found" });
    }

    const submittedRoleType = resolveRequestedKycRole(existingUser, req.body.roleType || req.body.role || "");
    const existingKyc = getRoleKyc(existingUser, submittedRoleType);
    const existingKycStatus = normalizeKycStatus(existingKyc.status);
    const udyanCardFile = req.files?.udyanCardFile?.[0];
    const passbookFile = req.files?.passbookFile?.[0];
    const aadhaarCardFile = req.files?.aadhaarCardFile?.[0];
    const idProofImage = req.files?.idProofImage?.[0] || aadhaarCardFile;
    const panImage = req.files?.panImage?.[0];
    const gstCertificate = req.files?.gstCertificate?.[0];
    const drivingLicenseImage = req.files?.drivingLicenseImage?.[0];
    const uploadKycFile = (file) =>
      uploadBufferToCloudinary(file, {
        folder: "efruitmandi/kyc",
        resourceType: getResourceType(file),
      });
    const roleTypes = new Set(getUserProfileTypes(existingUser));
    const explicitBodyRoleType = String(req.body.roleType || submittedRoleType || "").trim().toLowerCase();
    const inferredBodyRoleType = hasGrowerKycPayload(req.body, req.files) ? "grower" : "";
    const requestedRoleType = String(
      ["buyer", "grower", "driver"].includes(explicitBodyRoleType)
        ? explicitBodyRoleType
        : inferredBodyRoleType || existingKyc.roleType || existingUser.role || ""
    )
      .trim()
      .toLowerCase();
    const ownsRequestedRoleType = roleTypes.size === 0 || roleTypes.has(requestedRoleType);
    const roleType = ["buyer", "grower", "driver"].includes(requestedRoleType) && ownsRequestedRoleType
      ? requestedRoleType
      : roleTypes.has("grower")
        ? "grower"
        : roleTypes.has("driver")
          ? "driver"
          : "buyer";
    const isInitialSubmission = existingKycStatus === "NOT_SUBMITTED";
    let requestedSection = "";
    if (!isInitialSubmission) {
      const sectionStates = await getKycSectionStates({
        userId: req.user.id,
        roleType,
        kyc: existingKyc,
      });
      if (req.body.section) {
        requestedSection = normalizeKycSection(req.body.section);
      } else {
        const editableSections = Object.values(sectionStates).filter((state) => state.editable);
        if (editableSections.length === 1) requestedSection = editableSections[0].section;
      }
      if (!requestedSection || !sectionStates[requestedSection]) {
        return res.status(400).json({ msg: "Select the verification section being resubmitted." });
      }
      assertKycSectionEditable(sectionStates[requestedSection]);
      const payloadViolations = getKycSectionPayloadViolations({
        section: requestedSection,
        body: req.body,
        files: req.files,
      });
      if (payloadViolations.length) {
        return res.status(403).json({
          msg: "Only fields in the reopened verification section may be changed.",
          fields: payloadViolations,
        });
      }
    }

    const rawIdProofType = String(req.body.idProofType || existingKyc.idProofType || "Aadhaar").trim();
    const rawIdProofNumber = String(req.body.idProofNumber || existingKyc.idProofNumber || req.body.aadhaarCardNo || existingKyc.aadhaarCardNo || "").trim();
    const normalizedAadhaar = normalizeAadhaar(req.body.aadhaarCardNo || rawIdProofNumber);
    const rawPanNumber = normalizePanNumber(req.body.panNumber || existingKyc.panNumber || "");

    const kyc = {
      ...existingKyc,
      roleType,
      fullName: String(req.body.fullName || existingKyc.fullName || existingUser.name || "").trim(),
      phone: String(req.body.phone || existingKyc.phone || existingUser.contact || existingUser.phone || "").trim(),
      email: String(req.body.email || existingKyc.email || existingUser.email || "").trim().toLowerCase(),
      address: String(req.body.address || existingKyc.address || getKycAddressFallback(existingUser, roleType)).trim(),
      district: String(req.body.district || existingKyc.district || "").trim(),
      state: String(req.body.state || existingKyc.state || "").trim(),
      pinCode: String(req.body.pinCode || existingKyc.pinCode || getKycPinCodeFallback(existingUser, roleType)).trim(),
      idProofType: rawIdProofType,
      idProofNumber: isAadhaarProof(rawIdProofType) ? normalizedAadhaar : rawIdProofNumber,
      panNumber: rawPanNumber,
      gstNumber: String(req.body.gstNumber || existingKyc.gstNumber || existingUser.gstNumber || "").trim().toUpperCase(),
      bankAccountHolderName: String(req.body.bankAccountHolderName || existingKyc.bankAccountHolderName || existingUser.name || "").trim(),
      bankName: String(req.body.bankName || existingKyc.bankName || "").trim(),
      accountNumber: String(req.body.accountNumber || existingKyc.accountNumber || req.body.bankAccountNo || existingKyc.bankAccountNo || "").trim(),
      upiId: String(req.body.upiId || existingKyc.upiId || "").trim(),
      orchardName: String(req.body.orchardName || existingKyc.orchardName || existingUser.orchardName || "").trim(),
      orchardLocation: String(req.body.orchardLocation || existingKyc.orchardLocation || getGrowerPremisesAddress(existingUser)).trim(),
      vehicleNumber: String(req.body.vehicleNumber || existingKyc.vehicleNumber || existingUser.vehicleNumber || "").trim().toUpperCase(),
      drivingLicenseNumber: String(req.body.drivingLicenseNumber || existingKyc.drivingLicenseNumber || existingUser.licenseNumber || "").trim().toUpperCase(),
      udyanCardNo: String(req.body.udyanCardNo || existingKyc.udyanCardNo || "")
        .trim()
        .toUpperCase(),
      bankAccountNo: String(req.body.bankAccountNo || existingKyc.bankAccountNo || "").trim(),
      ifscCode: String(req.body.ifscCode || existingKyc.ifscCode || "")
        .trim()
        .toUpperCase(),
      aadhaarCardNo: isAadhaarProof(rawIdProofType) ? normalizedAadhaar : String(req.body.aadhaarCardNo || existingKyc.aadhaarCardNo || "").trim(),
      status: "PENDING",
      adminRemarks: "",
      submittedAt: new Date(),
    };

    const serverUploadedDocuments = [];
    const uploadAndAssignKycDocument = async (file, field, label) => {
      if (!file) return;
      const uploaded = await uploadKycFile(file);
      kyc[field] = uploaded.secure_url;
      const metadata = createCloudinaryKycDocumentMetadata(uploaded, {
        label,
        userId: req.user.id,
        roleType,
        mimeType: file.mimetype,
      });
      if (metadata) serverUploadedDocuments.push(metadata);
    };
    await uploadAndAssignKycDocument(udyanCardFile, "udyanCardFileUrl", "udyanCard");
    await uploadAndAssignKycDocument(passbookFile, "passbookFileUrl", "passbookFile");
    await uploadAndAssignKycDocument(aadhaarCardFile, "aadhaarCardFileUrl", "idProof");
    if (idProofImage && idProofImage !== aadhaarCardFile) {
      await uploadAndAssignKycDocument(idProofImage, "idProofImage", "idProof");
    } else if (aadhaarCardFile) {
      kyc.idProofImage = kyc.aadhaarCardFileUrl;
    }
    await uploadAndAssignKycDocument(panImage, "panImage", "pan");
    await uploadAndAssignKycDocument(gstCertificate, "gstCertificate", "gstCertificate");
    await uploadAndAssignKycDocument(drivingLicenseImage, "drivingLicenseImage", "drivingLicense");

    let uploadedDocuments = parseKycDocuments(req.body.documents)
      .map((doc) => normalizeKycDocumentMetadata(doc, { userId: req.user.id, roleType }))
      .filter(Boolean);
    uploadedDocuments.push(...serverUploadedDocuments);
    if (requestedSection) {
      const permittedDocuments = getKycSectionDocuments(requestedSection, uploadedDocuments);
      if (permittedDocuments.length !== uploadedDocuments.length) {
        return res.status(403).json({ msg: "Only documents in the reopened verification section may be changed." });
      }
      uploadedDocuments = permittedDocuments;
    }
    uploadedDocuments.forEach((doc) => {
      const kycField = KYC_DOCUMENT_FIELD_BY_LABEL[doc.label];
      if (kycField) kyc[kycField] = doc.url;
    });
    if (uploadedDocuments.length) {
      const previousDocuments = Array.isArray(existingKyc.documents) ? existingKyc.documents : [];
      const byLabel = new Map(previousDocuments.map((doc) => [doc.label, doc]));
      uploadedDocuments.forEach((doc) => byLabel.set(doc.label, doc));
      kyc.documents = Array.from(byLabel.values());
    }

    const fieldErrors = requestedSection
      ? validateKycSection(kyc, roleType, requestedSection)
      : validateKycSubmission(kyc, roleType);

    const missingKycDetails = Object.values(fieldErrors);

    if (missingKycDetails.length) {
      return res.status(400).json({
        msg: `Complete KYC details: ${missingKycDetails.join(" ")}`,
        errors: fieldErrors,
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        $set: {
          kyc,
          [`kycByRole.${roleType}`]: kyc,
          ...(roleType === "buyer" ? { buyerVerified: false } : {}),
          ...(roleType === "grower" ? { growerVerified: false } : {}),
        },
      },
      { new: true }
    ).select("-password -__v");

    if (requestedSection) {
      await markVerificationResubmitted({
        userId: req.user.id,
        section: requestedSection,
        roleType,
        entityId: req.user.id,
      });
    } else {
      await Promise.all(getKycSectionsForRole(roleType).map((section) =>
        markVerificationResubmitted({
          userId: req.user.id,
          section,
          roleType,
          entityId: req.user.id,
        })
      ));
    }

    res.json(user);
  } catch (err) {
    res.status(err.statusCode || 500).json({ msg: err.message });
  }
};

export const rateGrowerForLot = async (req, res) => {
  try {
    const rating = Number(req.body.rating || 0);
    const comment = String(req.body.comment || "").trim().slice(0, 1000);

    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ msg: "Rating must be between 1 and 5" });
    }

    if (!getUserProfileTypes(req.user).has("buyer")) {
      return res.status(403).json({ msg: "Register as Fruit Buyer first to rate a grower" });
    }

    const product = await Product.findById(req.params.lotId).select("title createdBy gradeLots createdSource");
    if (!product || product.createdSource === "admin-panel") {
      return res.status(404).json({ msg: "Fruit lot not found" });
    }

    const growerId = product.createdBy?.toString();
    const raterId = req.user.id?.toString();
    if (!growerId) {
      return res.status(404).json({ msg: "Grower not found for this lot" });
    }

    if (growerId === raterId) {
      return res.status(400).json({ msg: "You cannot rate your own grower profile" });
    }

    const grower = await User.findById(growerId);
    if (!grower) {
      return res.status(404).json({ msg: "Grower not found" });
    }

    const existingRating = grower.growerRatings.find(
      (item) =>
        item.lot?.toString() === product._id.toString() &&
        item.rater?.toString() === raterId
    );

    if (existingRating) {
      existingRating.rating = rating;
      existingRating.comment = comment;
      existingRating.updatedAt = new Date();
    } else {
      grower.growerRatings.push({
        lot: product._id,
        rater: req.user.id,
        rating,
        comment,
      });
    }

    const ratings = grower.growerRatings.map((item) => Number(item.rating || 0)).filter((value) => value > 0);
    grower.growerRatingCount = ratings.length;
    grower.growerRatingAverage = ratings.length
      ? Number((ratings.reduce((sum, value) => sum + value, 0) / ratings.length).toFixed(2))
      : 0;

    await grower.save();

    res.status(existingRating ? 200 : 201).json({
      success: true,
      message: existingRating ? "Rating updated." : "Rating submitted.",
      rating: {
        rating,
        comment,
      },
      grower: {
        _id: grower._id,
        name: grower.name,
        orchardName: grower.orchardName,
        businessName: grower.businessName,
        growerRatingAverage: grower.growerRatingAverage,
        growerRatingCount: grower.growerRatingCount,
      },
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};
