import express from "express";
import Product from "../models/Product.js";
import Quotation from "../models/Quotation.js";
import User from "../models/User.js";
import DealSettings from "../models/DealSettings.js";
import Order from "../models/Order.js";
import protect, { authorize } from "../middleware/authMiddleware.js";
import { requirePaymentPartnerEnabled } from "../utils/paymentFeatureFlag.js";
import { sendMobileMessage } from "../services/mobileOtpService.js";
import {
  buildGradeQuantitiesFromProduct,
  calculateDealBreakdown,
  mergeDealSettings,
} from "../services/dealCalculationService.js";

const router = express.Router();
const PAYMENT_CONFIRMATION_WINDOW_MS = 15 * 60 * 1000;
const BUSINESS_LOCATION_DISTANCE_MESSAGE =
  "Delivery distance will be calculated after buyer and grower business locations are available.";

const hasCompletedKyc = (user = {}, roleType = "") => {
  const role = String(roleType || "").toLowerCase();
  const roleKyc = user?.kycByRole?.[role] || {};
  const legacyKyc = String(user?.kyc?.roleType || "").toLowerCase() === role ? user.kyc : {};
  return String(roleKyc.status || legacyKyc.status || "").toUpperCase() === "APPROVED";
};

const getProfileTypes = (user = {}) => {
  const profiles = new Set(Array.isArray(user.profileTypes) ? user.profileTypes : []);
  if (user.role) profiles.add(user.role);
  if (user.businessName || user.buyerContactPerson) profiles.add("buyer");
  if (user.orchardName) profiles.add("grower");
  return profiles;
};

const loadDealSettings = async () =>
  mergeDealSettings((await DealSettings.findOne({ key: "default" }).lean()) || {});

const toRadians = (value) => (Number(value) * Math.PI) / 180;

const calculateDistanceKm = (from = {}, to = {}) => {
  const lat1 = Number(from.mapLatitude);
  const lon1 = Number(from.mapLongitude);
  const lat2 = Number(to.mapLatitude);
  const lon2 = Number(to.mapLongitude);

  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return null;

  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(earthRadiusKm * c * 10) / 10;
};

const requireBusinessLocationDistance = (from = {}, to = {}) => {
  const distanceKm = calculateDistanceKm(from, to);
  if (distanceKm === null) {
    const error = new Error(BUSINESS_LOCATION_DISTANCE_MESSAGE);
    error.statusCode = 400;
    error.code = "BUSINESS_LOCATION_REQUIRED";
    throw error;
  }
  return distanceKm;
};

const buildGradePrices = (prices = []) => {
  if (!Array.isArray(prices)) return {};

  return prices.reduce((result, item) => {
    const grade = String(item?.grade || "").trim();
    const price = Number(item?.price || 0);
    if (grade) result[grade] = price;
    return result;
  }, {});
};

const normalizeQuoteStatus = (status = "") => {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "submitted") return "pending";
  if (normalized === "expired") return "closed";
  return normalized || "pending";
};

const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const firstPositiveNumber = (...values) => {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number) && number > 0) return number;
  }
  return 0;
};

const calculateStoredGrowerNetRate = (grade = {}, quotation = {}) => {
  const directRate = firstPositiveNumber(grade.netRate, grade.netSettlementRate);
  if (directRate > 0) return directRate;

  const buyerBidRate = Number(grade.price || grade.quotedRatePerUnit || 0);
  if (!Number.isFinite(buyerBidRate) || buyerBidRate <= 0) return 0;

  const platformServiceFee = firstPositiveNumber(
    grade.platformServiceFee,
    buyerBidRate * (Number(quotation.commissionPercent || 0) / 100)
  );
  const labourCharge = firstPositiveNumber(grade.labourCharge, quotation.labourChargePerUnit);
  const logisticsCharge = firstPositiveNumber(
    grade.logisticsCharge,
    quotation.logisticsChargePerUnit,
    Number(quotation.totalUnits || 0) > 0 ? Number(quotation.logisticsAmount || quotation.driverCharge || 0) / Number(quotation.totalUnits || 0) : 0
  );

  return Math.round(Math.max(0, buyerBidRate - platformServiceFee - labourCharge - logisticsCharge));
};

const formatGrowerGrade = (grade = {}, quotation = {}) => {
  const quantity = Number(grade.quantity || 0);
  const netRate = calculateStoredGrowerNetRate(grade, quotation);
  const netAmount = roundMoney(firstPositiveNumber(grade.netAmount, netRate * quantity));

  return {
    grade: grade.grade,
    quantity,
    netRate,
    netAmount,
  };
};

const getGrowerTotalNetReceivable = (grades = [], quotation = {}) => {
  const visibleTotal = roundMoney(grades.reduce((sum, grade) => sum + Number(grade.netAmount || 0), 0));
  return visibleTotal || Number(quotation.growerReceivable || quotation.sellerReceivable || 0);
};

const pickText = (...values) => {
  for (const value of values) {
    const text = String(value || "").trim();
    if (text) return text;
  }
  return "";
};

const isApprovedStatus = (status = "") => String(status || "").trim().toUpperCase() === "APPROVED";

const getRoleRecord = (records = {}, role = "") => {
  const normalizedRole = String(role || "").trim().toLowerCase();
  return normalizedRole ? records?.[normalizedRole] || {} : {};
};

const hasApprovedOgRequest = (record = {}) =>
  Boolean(record?.requestId && isApprovedStatus(record?.status));

const getSafeLocationFromText = (value = "") => {
  const text = String(value || "")
    .replace(/\b\d{6}\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "";

  const sensitivePattern =
    /\b(address|house|street|road|near|plot|flat|building|village|ward|pin|pincode|post office|orchard location|exact)\b/i;
  const parts = text
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !/\d/.test(part))
    .filter((part) => !sensitivePattern.test(part));

  if (parts.length) return parts.slice(-3).join(", ");
  if (!/\d/.test(text) && !sensitivePattern.test(text) && text.length <= 42) return text;
  return "";
};

const getSafeMainLocation = (user = {}, role = "") => {
  const roleKyc = getRoleRecord(user.kycByRole, role);
  const legacyKyc = user.kyc || {};
  const explicitLocation = [user.city, user.district || roleKyc.district || legacyKyc.district, user.state || roleKyc.state || legacyKyc.state]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .filter((part) => !/\b\d{6}\b/.test(part))
    .slice(0, 3)
    .join(", ");

  if (explicitLocation) return explicitLocation;
  return getSafeLocationFromText(role === "buyer" ? user.buyerLocation || user.location : user.location);
};

const formatPublicProfile = (user = {}, role = "", fallback = {}) => {
  const roleKyc = getRoleRecord(user.kycByRole, role);
  const legacyKyc = user.kyc || {};
  const roleOg = getRoleRecord(user.ogVerificationByRole, role);
  const isBuyer = role === "buyer";
  const isGrower = role === "grower";
  const isKycVerified = Boolean(
    (isBuyer && user.buyerVerified) ||
      (isGrower && user.growerVerified) ||
      isApprovedStatus(roleKyc.status) ||
      isApprovedStatus(legacyKyc.status)
  );
  const isOgVerified = Boolean(
    (isBuyer && user.buyerOgVerified) ||
      (isGrower && user.growerOgVerified) ||
      hasApprovedOgRequest(roleOg)
  );

  return {
    name: pickText(user.name, user.buyerContactPerson, fallback.name),
    companyName: pickText(user.orchardName, user.businessName, fallback.companyName),
    logoUrl: isBuyer
      ? pickText(user.buyerCompanyLogoUrl, user.companyLogoUrl)
      : pickText(user.companyLogoUrl),
    mainLocation: getSafeMainLocation(user, role),
    isKycVerified,
    isOgVerified,
    isTrusted: isOgVerified,
    memberSince: user.createdAt,
    businessType: role,
  };
};

const formatQuote = (quotation = {}, visibility = "admin") => {
  const lot = quotation.lot || {};
  const buyer = quotation.buyer || {};
  const grower = quotation.grower || {};
  const buyerName =
    quotation.buyerName ||
    buyer.businessName ||
    buyer.buyerContactPerson ||
    buyer.name ||
    "Buyer";
  const growerName =
    quotation.growerName ||
    grower.orchardName ||
    grower.businessName ||
    grower.name ||
    "Grower";

  const grades = (quotation.grades || []).map((grade) => {
    if (visibility === "grower") {
      return formatGrowerGrade(grade, quotation);
    }

    const baseGrade = {
      grade: grade.grade,
      quantity: grade.quantity,
      price: grade.price,
      quotedRatePerUnit: grade.quotedRatePerUnit || grade.price || 0,
      amount: grade.amount,
    };
    if (visibility === "buyer") {
      return {
        ...baseGrade,
        buyerPayableThroughPlatform: grade.buyerPayableThroughPlatform || Number(grade.price || 0),
        labourCharge: grade.labourCharge || quotation.labourChargePerUnit || 0,
      };
    }
    return {
      ...baseGrade,
      netSettlementRate: grade.netSettlementRate || 0,
      platformServiceFee: grade.platformServiceFee || 0,
      logisticsCharge: grade.logisticsCharge || 0,
      labourCharge: grade.labourCharge || quotation.labourChargePerUnit || 0,
      buyerPayableThroughPlatform: grade.buyerPayableThroughPlatform || 0,
    };
  });

  const base = {
    _id: quotation._id,
    lotId: lot._id || quotation.lot,
    buyerId: buyer._id || quotation.buyer,
    growerId: grower._id || quotation.grower,
    lotTitle: quotation.lotTitle || lot.title || lot.fruitName || "Fruit Lot",
    fruitType: quotation.fruitType || lot.fruitName || lot.title || "",
    lotQuantity: quotation.lotQuantity || lot.quantity || 0,
    lotNo: lot.lotNo || "",
    lotVariety: lot.variety || "",
    lotQuality: lot.quality || "",
    lotUnit: lot.unit || "boxes",
    packingType: lot.packingType || "",
    totalWeightKg: lot.totalWeightKg || 0,
    lotLocation: lot.location || "",
    buyerName,
    buyerPhone: quotation.buyerPhone || buyer.phone || "",
    buyerProfile: formatPublicProfile(buyer, "buyer", {
      name: buyerName,
      companyName: buyerName,
    }),
    growerName,
    growerProfile: formatPublicProfile(grower, "grower", {
      name: growerName,
      companyName: growerName,
    }),
    quotedPrice: quotation.quotedPrice || quotation.grades?.[0]?.price || 0,
    quotedTotalValue: quotation.quotedTotalValue || quotation.baseDealAmount || quotation.dealAmount || 0,
    dealAmount: quotation.dealAmount || 0,
    baseDealAmount: quotation.baseDealAmount || quotation.dealAmount || 0,
    buyerPayable: quotation.dealAmount || quotation.buyerPayable || 0,
    buyerPayableThroughPlatform: quotation.dealAmount || quotation.buyerPayableThroughPlatform || quotation.buyerPayable || 0,
    labourChargePerUnit: quotation.labourChargePerUnit || 0,
    acceptedOrderId: quotation.acceptedOrder?._id || quotation.acceptedOrder || undefined,
    acceptedOrderPaymentStatus: quotation.acceptedOrder?.paymentStatus || undefined,
    acceptedOrderFinalPrice: quotation.acceptedOrder?.finalPrice || undefined,
    acceptedOrderDeliveryStatus: quotation.acceptedOrder?.deliveryStatus || undefined,
    acceptedOrderInvoiceNumber: quotation.acceptedOrder?.invoiceNumber || undefined,
    paymentDueAt: quotation.paymentDueAt || quotation.acceptedOrder?.paymentDueAt || undefined,
    grades,
    message: quotation.message || "",
    status: normalizeQuoteStatus(quotation.status),
    createdAt: quotation.createdAt,
    updatedAt: quotation.updatedAt,
    acceptedAt: quotation.acceptedAt,
    rejectedAt: quotation.rejectedAt,
    lotStatus: lot.status,
  };

  if (visibility === "buyer") return base;

  const settlement = visibility === "grower" ? {
    _id: base._id,
    lotId: base.lotId,
    growerId: base.growerId,
    lotTitle: base.lotTitle,
    fruitType: base.fruitType,
    lotQuantity: base.lotQuantity,
    buyerName: base.buyerProfile.companyName || base.buyerProfile.name || "Buyer",
    buyerProfile: base.buyerProfile,
    growerName: base.growerName,
    growerProfile: base.growerProfile,
    grades,
    status: base.status,
    createdAt: base.createdAt,
    updatedAt: base.updatedAt,
    acceptedAt: base.acceptedAt,
    rejectedAt: base.rejectedAt,
    lotStatus: base.lotStatus,
    totalNetReceivable: getGrowerTotalNetReceivable(grades, quotation),
  } : {
    ...base,
    sellerReceivable: quotation.sellerReceivable || quotation.growerReceivable || 0,
    growerReceivable: quotation.growerReceivable || quotation.sellerReceivable || 0,
    totalCharges: quotation.totalCharges || 0,
    totalUnits: quotation.totalUnits || 0,
    chargePerUnit: quotation.chargePerUnit || 0,
    logisticsChargePerUnit: quotation.logisticsChargePerUnit || 0,
  };

  if (visibility === "grower") return settlement;

  return {
    ...settlement,
    commissionAmount: quotation.commissionAmount || 0,
    platformServiceFee: quotation.platformServiceFee || quotation.commissionAmount || 0,
    platformRevenue: quotation.platformServiceFee || quotation.commissionAmount || 0,
    commissionPercent: quotation.commissionPercent || 0,
    labourAmount: quotation.labourAmount || 0,
    labourChargePerUnit: quotation.labourChargePerUnit || 0,
    logisticsAmount: quotation.logisticsAmount || quotation.driverCharge || 0,
    driverCharge: quotation.driverCharge || quotation.logisticsAmount || 0,
    settlementStatus: settlement.status,
  };
};

const populateQuoteQuery = (query) =>
  query
    .populate("lot", "title fruitName variety quality quantity unit lotNo packingType totalWeightKg location status acceptedQuoteId acceptedBuyerId finalPrice finalDealValue createdBy")
    .populate("buyer", "name businessName buyerContactPerson buyerLocation location buyerCompanyLogoUrl companyLogoUrl role profileTypes createdAt buyerVerified buyerOgVerified kycByRole ogVerificationByRole")
    .populate("grower", "name orchardName businessName location companyLogoUrl role profileTypes createdAt growerVerified growerOgVerified kycByRole ogVerificationByRole");

const normalizeId = (value) => {
  if (!value) return "";
  return String(value._id || value.id || value.userId || value).trim();
};

const normalizePhone = (value = "") => String(value || "").replace(/\D/g, "");

const isLocalTestAccount = (user = {}) => {
  if (process.env.NODE_ENV === "production") return false;
  if (process.env.ALLOW_TEST_OTP !== "true") return false;

  const email = String(user.email || "").trim().toLowerCase();
  const phone = String(user.phone || user.contact || "").trim();

  return (
    email === "testbuyer@efruitmandi.live" ||
    phone === "1234567890"
  );
};

const isOwnListedLot = (product = {}, buyer = {}, authenticatedUser = {}) => {
  const requesterIds = new Set(
    [
      normalizeId(authenticatedUser.id),
      normalizeId(authenticatedUser._id),
      normalizeId(buyer._id),
      normalizeId(buyer.id),
    ].filter(Boolean)
  );
  const ownerIds = new Set(
    [
      normalizeId(product.createdBy),
      normalizeId(product.growerUserId),
      normalizeId(product.growerId),
      normalizeId(product.growerId?.userId),
      normalizeId(product.ownerId),
    ].filter(Boolean)
  );
  const sameUserId = [...requesterIds].some((id) => ownerIds.has(id));
  const buyerPhone = normalizePhone(buyer.phone || authenticatedUser.phone);
  const growerPhone = normalizePhone(product.createdBy?.phone || product.growerPhone);

  return Boolean(sameUserId || (buyerPhone && growerPhone && buyerPhone === growerPhone));
};

const createQuoteForLot = async (req, res) => {
  try {
    const lotId = req.params.lotId || req.body.lotId;
    const [product, buyer] = await Promise.all([
      Product.findById(lotId).populate("createdBy", "name orchardName businessName phone mapLatitude mapLongitude"),
      User.findById(req.user.id).select("email phone contact role profileTypes name businessName buyerContactPerson kyc kycByRole buyerVerified mapLatitude mapLongitude"),
    ]);

    if (!product || product.createdSource === "admin-panel") {
      return res.status(404).json({ msg: "Fruit lot not found" });
    }

    if (!buyer || !getProfileTypes(buyer).has("buyer")) {
      return res.status(403).json({ msg: "Register as Fruit Buyer first" });
    }

    if (!isLocalTestAccount(buyer) && !buyer.buyerVerified && !hasCompletedKyc(buyer, "buyer")) {
      return res.status(403).json({
        success: false,
        code: "KYC_REQUIRED",
        message: "KYC approval is required before placing an offer.",
        msg: "KYC approval is required before placing an offer.",
      });
    }

    if (!product.createdBy) {
      return res.status(404).json({ msg: "Grower not found for this lot" });
    }

    if (isOwnListedLot(product, buyer, req.user)) {
      return res.status(400).json({ msg: "You cannot make an offer on your own listed lot." });
    }

    const existingActiveQuote = await Quotation.findOne({
      lot: product._id,
      buyer: buyer._id,
      status: { $in: ["pending", "SUBMITTED"] },
    });
    if (existingActiveQuote) {
      return res.status(409).json({
        msg: "You already have a pending offer for this lot. Please wait for grower action before submitting another offer.",
        quotation: formatQuote(existingActiveQuote, "buyer"),
      });
    }

    const gradeQuantities = buildGradeQuantitiesFromProduct(product);
    const availableGrades = Object.entries(gradeQuantities)
      .filter(([, quantity]) => Number(quantity || 0) > 0)
      .map(([grade]) => grade);

    if (!availableGrades.length) {
      return res.status(400).json({ msg: "No available grades found for this lot" });
    }

    const gradePrices = buildGradePrices(req.body.grades);
    const missingGrade = availableGrades.find((grade) => !Number(gradePrices[grade] || 0));
    if (missingGrade) {
      return res.status(400).json({ msg: `Enter a price greater than 0 for Grade ${missingGrade}` });
    }

    const distanceKm = requireBusinessLocationDistance(product.createdBy, buyer);
    const settings = await loadDealSettings();
    const breakdown = calculateDealBreakdown({
      gradeQuantities,
      gradePrices,
      distanceKm,
      ...settings,
    });
    const primaryGrade = breakdown.grades?.[0] || {};
    const buyerName = buyer.businessName || buyer.buyerContactPerson || buyer.name || "Buyer";
    const growerName = product.createdBy.orchardName || product.createdBy.businessName || product.createdBy.name || "Grower";

    const quotation = await Quotation.create({
      lot: product._id,
      buyer: buyer._id,
      grower: product.createdBy._id || product.createdBy,
      lotQuantity: Number(product.quantity || 0),
      fruitType: product.fruitName || product.title || "",
      lotTitle: product.title || product.fruitName || "Fruit Lot",
      buyerName,
      buyerPhone: buyer.phone || "",
      growerName,
      message: String(req.body.message || "").trim(),
      grades: breakdown.grades,
      distanceKm,
      quotedPrice: Number(req.body.quotedPrice || primaryGrade.price || 0),
      quotedTotalValue: breakdown.dealAmount,
      baseDealAmount: breakdown.baseDealAmount,
      dealAmount: breakdown.dealAmount,
      driverCharge: breakdown.driverCharge,
      logisticsAmount: breakdown.logisticsAmount,
      labourAmount: breakdown.labourAmount,
      labourChargePerUnit: breakdown.labourChargePerUnit,
      commissionBase: breakdown.commissionBase,
      commissionPercent: breakdown.commissionPercent,
      commissionAmount: breakdown.commissionAmount,
      platformServiceFee: breakdown.platformServiceFee,
      totalCharges: breakdown.totalCharges,
      totalUnits: breakdown.totalUnits,
      chargePerUnit: breakdown.chargePerUnit,
      logisticsChargePerUnit: breakdown.logisticsChargePerUnit,
      buyerPayable: breakdown.buyerPayable,
      buyerPayableThroughPlatform: breakdown.buyerPayableThroughPlatform,
      sellerReceivable: breakdown.sellerReceivable,
      growerReceivable: breakdown.growerReceivable,
    });

    const populated = await populateQuoteQuery(Quotation.findById(quotation._id)).lean();

    res.status(201).json({
      success: true,
      quotation: formatQuote(populated || quotation.toObject(), "buyer"),
      distanceSource: "profile",
    });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ msg: "You already have a pending offer for this lot." });
    }
    res.status(err.statusCode || 400).json({
      msg: err.message || "Offer could not be saved",
      code: err.code,
    });
  }
};

router.post("/", protect, authorize("buyer"), createQuoteForLot);

router.post("/lots/:lotId", protect, authorize("buyer"), createQuoteForLot);

router.get("/grower", protect, authorize("grower"), async (req, res) => {
  try {
    const quotations = await populateQuoteQuery(
      Quotation.find({ grower: req.user.id }).sort({ createdAt: -1 })
    ).lean();
    res.json({ success: true, quotes: quotations.map((quote) => formatQuote(quote, "grower")) });
  } catch (err) {
    res.status(500).json({ msg: err.message || "Could not load grower offers" });
  }
});

router.get("/buyer", protect, authorize("buyer"), async (req, res) => {
  try {
    const quotations = await populateQuoteQuery(
      Quotation.find({ buyer: req.user.id }).sort({ createdAt: -1 })
    ).lean();
    const quoteIds = quotations.map((quote) => quote._id).filter(Boolean);
    const orders = await Order.find({ quote: { $in: quoteIds } }).select("_id quote paymentStatus finalPrice paymentDueAt").lean();
    const orderByQuoteId = new Map(orders.map((order) => [String(order.quote), order]));
    res.json({
      success: true,
      quotes: quotations.map((quote) => formatQuote({ ...quote, acceptedOrder: orderByQuoteId.get(String(quote._id)) }, "buyer")),
    });
  } catch (err) {
    res.status(500).json({ msg: err.message || "Could not load buyer offers" });
  }
});

router.get("/admin", protect, authorize("SUPER_ADMIN", "ADMIN", "UNIT_MANAGER", "INVENTORY_MANAGER", "SALES_EXECUTIVE", "PURCHASE_MANAGER", "FINANCE_MANAGER", "VERIFICATION_OFFICER", "SUPPORT_EXECUTIVE", "VIEWER", "EMPLOYEE"), async (req, res) => {
  try {
    const quotations = await populateQuoteQuery(Quotation.find().sort({ createdAt: -1 }).limit(500)).lean();
    res.json({ success: true, quotes: quotations.map((quote) => formatQuote(quote, "admin")) });
  } catch (err) {
    res.status(500).json({ msg: err.message || "Could not load offers" });
  }
});

router.patch("/:quoteId", protect, authorize("buyer"), async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.quoteId).populate({
      path: "lot",
      populate: { path: "createdBy", select: "name orchardName businessName mapLatitude mapLongitude" },
    });

    if (!quotation || !quotation.lot) {
      return res.status(404).json({ msg: "Offer not found" });
    }

    if (quotation.buyer?.toString() !== req.user.id?.toString()) {
      return res.status(403).json({ msg: "You can update only your own offer" });
    }

    if (!["pending", "submitted"].includes(normalizeQuoteStatus(quotation.status))) {
      return res.status(400).json({ msg: "Only pending offers can be updated" });
    }

    const buyer = await User.findById(req.user.id).select("name phone businessName buyerContactPerson mapLatitude mapLongitude");
    const gradeQuantities = buildGradeQuantitiesFromProduct(quotation.lot);
    const availableGrades = Object.entries(gradeQuantities)
      .filter(([, quantity]) => Number(quantity || 0) > 0)
      .map(([grade]) => grade);
    const gradePrices = buildGradePrices(req.body.grades);
    const missingGrade = availableGrades.find((grade) => !Number(gradePrices[grade] || 0));
    if (missingGrade) {
      return res.status(400).json({ msg: `Enter a price greater than 0 for Grade ${missingGrade}` });
    }

    const distanceKm = requireBusinessLocationDistance(quotation.lot.createdBy, buyer);
    const settings = await loadDealSettings();
    const breakdown = calculateDealBreakdown({
      gradeQuantities,
      gradePrices,
      distanceKm,
      ...settings,
    });
    const primaryGrade = breakdown.grades?.[0] || {};

    quotation.grades = breakdown.grades;
    quotation.distanceKm = distanceKm;
    quotation.quotedPrice = Number(req.body.quotedPrice || primaryGrade.price || 0);
    quotation.quotedTotalValue = breakdown.dealAmount;
    quotation.baseDealAmount = breakdown.baseDealAmount;
    quotation.dealAmount = breakdown.dealAmount;
    quotation.driverCharge = breakdown.driverCharge;
    quotation.logisticsAmount = breakdown.logisticsAmount;
    quotation.labourAmount = breakdown.labourAmount;
    quotation.labourChargePerUnit = breakdown.labourChargePerUnit;
    quotation.commissionBase = breakdown.commissionBase;
    quotation.commissionPercent = breakdown.commissionPercent;
    quotation.commissionAmount = breakdown.commissionAmount;
    quotation.platformServiceFee = breakdown.platformServiceFee;
    quotation.totalCharges = breakdown.totalCharges;
    quotation.totalUnits = breakdown.totalUnits;
    quotation.chargePerUnit = breakdown.chargePerUnit;
    quotation.logisticsChargePerUnit = breakdown.logisticsChargePerUnit;
    quotation.buyerPayable = breakdown.buyerPayable;
    quotation.buyerPayableThroughPlatform = breakdown.buyerPayableThroughPlatform;
    quotation.sellerReceivable = breakdown.sellerReceivable;
    quotation.growerReceivable = breakdown.growerReceivable;
    quotation.message = String(req.body.message || quotation.message || "").trim();
    await quotation.save();

    const updated = await populateQuoteQuery(Quotation.findById(quotation._id)).lean();
    res.json({ success: true, quotation: formatQuote(updated || quotation.toObject(), "buyer") });
  } catch (err) {
    res.status(err.statusCode || 400).json({
      msg: err.message || "Offer could not be updated",
      code: err.code,
    });
  }
});

router.patch("/:quoteId/accept", protect, authorize("grower"), requirePaymentPartnerEnabled, async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.quoteId).populate("lot");
    if (!quotation || !quotation.lot) {
      return res.status(404).json({ msg: "Offer not found" });
    }

    const lotOwner = quotation.lot.createdBy?.toString();
    if (lotOwner !== req.user.id?.toString() || quotation.grower?.toString() !== req.user.id?.toString()) {
      return res.status(403).json({ msg: "You can accept offers only on your own lots" });
    }

    if (quotation.lot.acceptedQuoteId && quotation.lot.acceptedQuoteId.toString() !== quotation._id.toString()) {
      return res.status(409).json({ msg: "An offer has already been accepted for this lot" });
    }

    if (!["pending", "submitted"].includes(normalizeQuoteStatus(quotation.status))) {
      return res.status(400).json({ msg: "Only pending offers can be accepted" });
    }

    quotation.status = "accepted";
    quotation.acceptedAt = new Date();
    quotation.paymentDueAt = new Date(Date.now() + PAYMENT_CONFIRMATION_WINDOW_MS);
    await quotation.save();

    await Product.findByIdAndUpdate(quotation.lot._id, {
      status: "DEAL_CONFIRMED",
      acceptedQuoteId: quotation._id,
      acceptedBuyerId: quotation.buyer,
      finalPrice: quotation.dealAmount || quotation.buyerPayableThroughPlatform || quotation.buyerPayable,
      finalDealValue: quotation.dealAmount || quotation.buyerPayableThroughPlatform || quotation.buyerPayable,
    });

    await Quotation.updateMany(
      {
        lot: quotation.lot._id,
        _id: { $ne: quotation._id },
        status: { $in: ["pending", "SUBMITTED"] },
      },
      { $set: { status: "closed", rejectedAt: new Date() } }
    );

    await Order.findOneAndUpdate(
      { quote: quotation._id },
      {
        quote: quotation._id,
        product: quotation.lot._id,
        buyer: quotation.buyer,
        grower: quotation.grower,
        totalAmount: quotation.dealAmount || quotation.buyerPayableThroughPlatform || quotation.buyerPayable,
        auctionPrice: quotation.dealAmount || quotation.buyerPayableThroughPlatform || quotation.buyerPayable,
        finalPrice: quotation.dealAmount || quotation.buyerPayableThroughPlatform || quotation.buyerPayable,
        dealBreakdown: {
          grades: quotation.grades,
          dealAmount: quotation.dealAmount,
          baseDealAmount: quotation.baseDealAmount || quotation.dealAmount,
          buyerPayable: quotation.dealAmount || quotation.buyerPayable || quotation.buyerPayableThroughPlatform,
          buyerPayableThroughPlatform: quotation.dealAmount || quotation.buyerPayableThroughPlatform || quotation.buyerPayable,
          sellerReceivable: quotation.sellerReceivable || quotation.growerReceivable,
          growerReceivable: quotation.growerReceivable || quotation.sellerReceivable,
          commissionAmount: quotation.commissionAmount,
          platformServiceFee: quotation.platformServiceFee || quotation.commissionAmount,
          commissionPercent: quotation.commissionPercent,
          labourAmount: quotation.labourAmount || 0,
          labourChargePerUnit: quotation.labourChargePerUnit || 0,
          logisticsAmount: quotation.logisticsAmount || quotation.driverCharge || 0,
          totalCharges: quotation.totalCharges || 0,
          totalUnits: quotation.totalUnits || 0,
          chargePerUnit: quotation.chargePerUnit || 0,
          logisticsChargePerUnit: quotation.logisticsChargePerUnit || 0,
          driverCharge: quotation.driverCharge,
        },
        driverPayment: quotation.driverCharge || 0,
        platformCommission: quotation.commissionAmount || 0,
        growerPayout: quotation.sellerReceivable || quotation.growerReceivable || 0,
        paymentStatus: "PENDING",
        paymentDueAt: quotation.paymentDueAt,
        deliveryStatus: "PENDING",
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    const buyer = await User.findById(quotation.buyer).select("phone name businessName buyerContactPerson").lean();
    if (buyer?.phone) {
      const buyerName = buyer.businessName || buyer.buyerContactPerson || buyer.name || "Buyer";
      const amount = quotation.dealAmount || quotation.buyerPayableThroughPlatform || quotation.buyerPayable || 0;
      sendMobileMessage({
        phone: buyer.phone,
        platform: "efruitmandi",
        message: `Hi ${buyerName}, your offer was accepted for ${quotation.lotTitle || "your fruit lot"}. Please pay Rs. ${amount} within 15 minutes to confirm the consignment.`,
      }).catch((smsErr) => {
        console.warn("Offer accepted SMS could not be sent", {
          quoteId: quotation._id?.toString(),
          buyerId: quotation.buyer?.toString(),
          code: smsErr?.code || "",
          message: smsErr?.message || "SMS failed",
        });
      });
    }

    const updated = await populateQuoteQuery(Quotation.findById(quotation._id)).lean();
    res.json({ success: true, quote: formatQuote(updated || quotation.toObject(), "grower") });
  } catch (err) {
    res.status(500).json({ msg: err.message || "Offer could not be accepted" });
  }
});

router.patch("/:quoteId/reject", protect, authorize("grower"), async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.quoteId).populate("lot");
    if (!quotation || !quotation.lot) {
      return res.status(404).json({ msg: "Offer not found" });
    }

    if (quotation.lot.createdBy?.toString() !== req.user.id?.toString()) {
      return res.status(403).json({ msg: "You can reject offers only on your own lots" });
    }

    if (!["pending", "submitted"].includes(normalizeQuoteStatus(quotation.status))) {
      return res.status(400).json({ msg: "Only pending offers can be rejected" });
    }

    quotation.status = "rejected";
    quotation.rejectedAt = new Date();
    await quotation.save();

    const updated = await populateQuoteQuery(Quotation.findById(quotation._id)).lean();
    res.json({ success: true, quote: formatQuote(updated || quotation.toObject(), "grower") });
  } catch (err) {
    res.status(500).json({ msg: err.message || "Offer could not be rejected" });
  }
});

router.get("/:quoteId", protect, authorize("buyer", "grower"), async (req, res) => {
  try {
    const quotation = await populateQuoteQuery(Quotation.findById(req.params.quoteId)).lean();
    if (!quotation) return res.status(404).json({ msg: "Offer not found" });
    const requesterId = req.user.id?.toString();
    const isBuyerRequester = quotation.buyer?._id?.toString() === requesterId;
    const isGrowerRequester = quotation.grower?._id?.toString() === requesterId;
    if (!isBuyerRequester && !isGrowerRequester) {
      return res.status(403).json({ msg: "You cannot view this offer" });
    }
    const requestedView = String(req.query.view || "").trim().toLowerCase();
    const visibility =
      requestedView === "grower" && isGrowerRequester
        ? "grower"
        : requestedView === "buyer" && isBuyerRequester
          ? "buyer"
          : isBuyerRequester
            ? "buyer"
            : "grower";
    const acceptedOrder = visibility === "buyer"
      ? await Order.findOne({ quote: quotation._id }).select("_id quote paymentStatus deliveryStatus finalPrice paymentDueAt invoiceNumber").lean()
      : null;
    res.json({ success: true, quote: formatQuote({ ...quotation, acceptedOrder }, visibility) });
  } catch (err) {
    res.status(500).json({ msg: err.message || "Could not load offer" });
  }
});

router.get("/lots/:lotId", protect, authorize("buyer", "grower"), async (req, res) => {
  try {
    const product = await Product.findById(req.params.lotId).select("createdBy");
    if (!product) {
      return res.status(404).json({ msg: "Fruit lot not found" });
    }

    const requesterId = req.user.id?.toString();
    const isGrowerOwner = product.createdBy?.toString() === requesterId;
    const query = isGrowerOwner
      ? { lot: product._id }
      : {
          lot: product._id,
          buyer: { $ne: req.user.id },
        };

    const quotations = await Quotation.find(query)
      .populate("buyer", "name businessName buyerContactPerson")
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    if (isGrowerOwner) {
      return res.json({
        success: true,
        sellerView: true,
        quotations: quotations.map((quotation) => ({
          _id: quotation._id,
          status: quotation.status,
          grades: (quotation.grades || []).map((grade) => formatGrowerGrade(grade, quotation)),
          totalNetReceivable: getGrowerTotalNetReceivable(
            (quotation.grades || []).map((grade) => formatGrowerGrade(grade, quotation)),
            quotation
          ),
          createdAt: quotation.createdAt,
        })),
      });
    }

    res.json({
      success: true,
      sellerView: false,
      quotations: quotations.map((quotation) => ({
        _id: quotation._id,
        buyerName:
          quotation.buyer?.businessName ||
          quotation.buyer?.buyerContactPerson ||
          quotation.buyer?.name ||
          quotation.buyerName ||
          "Buyer",
        status: quotation.status,
        grades: quotation.grades || [],
        quotedTotalValue: quotation.quotedTotalValue || quotation.baseDealAmount || quotation.dealAmount || quotation.buyerPayableThroughPlatform || 0,
        createdAt: quotation.createdAt,
      })),
    });
  } catch (err) {
    res.status(500).json({ msg: err.message || "Could not load offerings" });
  }
});

export default router;

