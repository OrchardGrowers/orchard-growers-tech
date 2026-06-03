import express from "express";
import Product from "../models/Product.js";
import Quotation from "../models/Quotation.js";
import User from "../models/User.js";
import DealSettings from "../models/DealSettings.js";
import protect, { authorize } from "../middleware/authMiddleware.js";
import {
  buildGradeQuantitiesFromProduct,
  calculateDealBreakdown,
  mergeDealSettings,
} from "../services/dealCalculationService.js";

const router = express.Router();

const hasCompletedKyc = (user = {}) =>
  ["COMPLETED", "APPROVED"].includes(String(user?.kyc?.status || "").toUpperCase());

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

const buildGradePrices = (prices = []) => {
  if (!Array.isArray(prices)) return {};

  return prices.reduce((result, item) => {
    const grade = String(item?.grade || "").trim();
    const price = Number(item?.price || 0);
    if (grade) result[grade] = price;
    return result;
  }, {});
};

router.post("/lots/:lotId", protect, authorize("buyer"), async (req, res) => {
  try {
    const [product, buyer] = await Promise.all([
      Product.findById(req.params.lotId).populate("createdBy", "name orchardName businessName mapLatitude mapLongitude"),
      User.findById(req.user.id).select("role profileTypes businessName buyerContactPerson kyc mapLatitude mapLongitude"),
    ]);

    if (!product || product.createdSource === "admin-panel") {
      return res.status(404).json({ msg: "Fruit lot not found" });
    }

    if (!buyer || !getProfileTypes(buyer).has("buyer")) {
      return res.status(403).json({ msg: "Register as Fruit Buyer first" });
    }

    if (!hasCompletedKyc(buyer)) {
      return res.status(403).json({ msg: "Complete KYC before quoting" });
    }

    if (!product.createdBy) {
      return res.status(404).json({ msg: "Grower not found for this lot" });
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

    const autoDistanceKm = calculateDistanceKm(product.createdBy, buyer);
    const fallbackDistance = req.body.distanceKm === undefined || req.body.distanceKm === ""
      ? null
      : Number(req.body.distanceKm);
    const distanceKm = autoDistanceKm ?? (Number.isFinite(fallbackDistance) ? fallbackDistance : 0);
    const settings = await loadDealSettings();
    const breakdown = calculateDealBreakdown({
      gradeQuantities,
      gradePrices,
      distanceKm,
      ...settings,
    });

    const quotation = await Quotation.create({
      lot: product._id,
      buyer: buyer._id,
      grower: product.createdBy._id || product.createdBy,
      grades: breakdown.grades,
      distanceKm,
      dealAmount: breakdown.dealAmount,
      driverCharge: breakdown.driverCharge,
      commissionBase: breakdown.commissionBase,
      commissionPercent: breakdown.commissionPercent,
      commissionAmount: breakdown.commissionAmount,
      buyerPayable: breakdown.buyerPayable,
      sellerReceivable: breakdown.sellerReceivable,
    });

    res.status(201).json({
      success: true,
      quotation,
      distanceSource: autoDistanceKm === null ? "manual" : "profile",
    });
  } catch (err) {
    res.status(400).json({ msg: err.message || "Quotation could not be saved" });
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
      : { lot: product._id, buyer: req.user.id };

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
          sellerReceivable: quotation.sellerReceivable,
          createdAt: quotation.createdAt,
          buyer: {
            _id: quotation.buyer?._id,
            name:
              quotation.buyer?.businessName ||
              quotation.buyer?.buyerContactPerson ||
              quotation.buyer?.name ||
              "Buyer",
          },
        })),
      });
    }

    res.json({ success: true, sellerView: false, quotations });
  } catch (err) {
    res.status(500).json({ msg: err.message || "Could not load quotations" });
  }
});

export default router;
