import express from "express";
import Auction from "../models/Auction.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import DealSettings from "../models/DealSettings.js";
import User from "../models/User.js";
import protect, { authorize, optionalProtect } from "../middleware/authMiddleware.js";
import {
  buildGradeQuantitiesFromProduct,
  calculateDealBreakdown,
  getHighestAvailableGrade,
  mergeDealSettings,
} from "../services/dealCalculationService.js";

const router = express.Router();

const AUCTION_DURATION_MS = 5 * 60 * 1000;

const getIstHour = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    hour12: false,
  }).formatToParts(date);

  return Number(parts.find((part) => part.type === "hour")?.value || 0);
};

const isDealOpen = (date = new Date()) => {
  const istHour = getIstHour(date);
  return istHour >= 9 && istHour < 16;
};

const canSeeProductBasePrice = (product, user) =>
  (user?.role === "grower" ||
    (Array.isArray(user?.profileTypes) && user.profileTypes.includes("grower"))) &&
  product?.createdBy &&
  (product.createdBy._id || product.createdBy)?.toString() === user.id?.toString();

const canSeeBuyerDealBreakdown = (auction, user) => {
  const bidderId = auction?.highestBidder?._id || auction?.highestBidder;
  return user?.role === "SUPER_ADMIN" || bidderId?.toString() === user?.id?.toString();
};

const kycRequiredResponse = (res) =>
  res.status(403).json({
    success: false,
    code: "KYC_REQUIRED",
    message: "KYC approval is required before placing a quote.",
    msg: "KYC approval is required before placing a quote.",
  });

const requireApprovedKyc = async (userId, role) => {
  const user = await User.findById(userId).select("kyc role profileTypes buyerVerified growerVerified");
  if (!user) return false;
  const verifiedFlag = role === "buyer" ? user.buyerVerified : role === "grower" ? user.growerVerified : false;
  return Boolean(verifiedFlag) || String(user.kyc?.status || "").toUpperCase() === "APPROVED";
};

const loadDealSettings = async () =>
  mergeDealSettings((await DealSettings.findOne({ key: "default" }).lean()) || {});

const calculateProductDeal = async (product, baseRate, distanceKm = 0) => {
  const gradeQuantities = buildGradeQuantitiesFromProduct(product);
  const availableGrade = getHighestAvailableGrade(gradeQuantities);
  const gradePrices = Object.keys(gradeQuantities).reduce((prices, grade) => {
    if (Number(gradeQuantities[grade] || 0) > 0) prices[grade] = Number(baseRate || 0);
    return prices;
  }, {});
  const settings = await loadDealSettings();

  return calculateDealBreakdown({
    gradeQuantities,
    gradePrices,
    distanceKm,
    ...settings,
    highestGrade: availableGrade,
  });
};

const buildOrderFromAuction = (auction, product) => ({
  auction: auction._id,
  product: auction.product,
  buyer: auction.highestBidder,
  grower: product?.createdBy,
  auctionPrice: auction.dealBreakdown?.dealAmount ?? auction.currentBid,
  finalPrice: auction.dealBreakdown?.buyerPayable ?? auction.currentBid,
  highestGrade: auction.highestGrade,
  highestGradeRate: auction.highestGradeRate,
  dealBreakdown: auction.dealBreakdown,
  driverPayment: auction.dealBreakdown?.driverCharge || 0,
  platformCommission: auction.dealBreakdown?.commissionAmount || 0,
  growerPayout: auction.dealBreakdown?.sellerReceivable || 0,
  paymentStatus: "PENDING",
});

const serializeAuction = (auction, user) => {
  const data = auction.toObject ? auction.toObject() : { ...auction };

  if (data.product && !canSeeProductBasePrice(data.product, user)) {
    delete data.product.basePrice;
    delete data.startingPrice;
  }

  if (data.dealBreakdown && !canSeeBuyerDealBreakdown(data, user)) {
    data.sellerReceivable = data.dealBreakdown.sellerReceivable;
    delete data.dealBreakdown;
  }

  return data;
};

// ================= CREATE DEAL =================
router.post("/", protect, authorize("grower"), async (req, res) => {
  try {
    const { product, startingPrice, currentBid, startTime, distanceKm = 0 } = req.body;

    console.log("Incoming product:", product);

    if (!(await requireApprovedKyc(req.user.id, "grower"))) {
      return kycRequiredResponse(res);
    }

    const productExists = await Product.findById(product);

    if (!productExists) {
      return res.status(404).json({ msg: "Product not found" });
    }

    if (productExists.createdBy?.toString() !== req.user.id?.toString()) {
      return res.status(403).json({ msg: "You can create deals only for your own lot" });
    }

    const auctionStartTime = startTime
      ? new Date(startTime)
      : productExists.auctionStartTime || new Date();
    const auctionEndTime = new Date(auctionStartTime.getTime() + AUCTION_DURATION_MS);
    const status =
      auctionStartTime > new Date() || !isDealOpen()
        ? "SCHEDULED"
        : "ACTIVE";
    const openingPrice = Number(startingPrice || productExists.basePrice || 0);
    const openingBreakdown = calculateProductDeal
      ? await calculateProductDeal(productExists, Number(currentBid || openingPrice), distanceKm)
      : null;

    const auction = await Auction.create({
      product,
      startingPrice: openingPrice,
      currentBid: openingBreakdown?.dealAmount ?? Number(currentBid || openingPrice),
      highestGrade: openingBreakdown?.highestGrade,
      highestGradeRate: Number(currentBid || openingPrice),
      distanceKm: Number(distanceKm || 0),
      dealBreakdown: openingBreakdown,
      status,
      startTime: auctionStartTime,
      endTime: auctionEndTime,
    });

    res.json(auction);

  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server Error" });
  }
});

// ================= PREVIEW COMPLETE LOT CALCULATION =================
router.post("/:id/calculate", protect, authorize("buyer"), async (req, res) => {
  try {
    const { baseRate, distanceKm = 0 } = req.body;
    if (!(await requireApprovedKyc(req.user.id, "buyer"))) {
      return kycRequiredResponse(res);
    }

    const auction = await Auction.findById(req.params.id).populate("product");

    if (!auction) {
      return res.status(404).json({ msg: "Deal not found" });
    }

    if (!auction.product) {
      return res.status(404).json({ msg: "Lot not found" });
    }

    const breakdown = await calculateProductDeal(auction.product, baseRate, distanceKm);

    res.json({
      completeLotOnly: true,
      ...breakdown,
    });
  } catch (err) {
    res.status(400).json({ msg: err.message });
  }
});


// ================= GET ALL DEALS =================
router.get("/", optionalProtect, async (req, res) => {
  try {
    const auctions = await Auction.find()
      .populate({
        path: "product",
        populate: {
          path: "createdBy",
          select: "name orchardName businessName role",
        },
      })
      .populate("highestBidder", "name");

    res.json(auctions.map((auction) => serializeAuction(auction, req.user)));

  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});


// ================= GET SINGLE DEAL =================
router.get("/:id", optionalProtect, async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id)
      .populate({
        path: "product",
        populate: {
          path: "createdBy",
          select: "name orchardName businessName role",
        },
      })
      .populate("highestBidder", "name");

    if (!auction) {
      return res.status(404).json({ msg: "Deal not found" });
    }

    res.json(serializeAuction(auction, req.user));

  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});


// ================= END DEAL (MANUAL) =================
router.post("/end/:id", protect, authorize("grower"), async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id);

    if (!auction) {
      return res.status(404).json({ msg: "Deal not found" });
    }

    const product = await Product.findById(auction.product);

    if (!product) {
      return res.status(404).json({ msg: "Product not found" });
    }

    if (product.createdBy?.toString() !== req.user.id?.toString()) {
      return res.status(403).json({ msg: "You can end only your own deal" });
    }

    if (auction.status === "ENDED") {
      return res.json({ msg: "Deal already ended" });
    }

    auction.status = "ENDED";
    await auction.save();

    if (!auction.highestBidder) {
      return res.json({
        msg: "Deal ended without deal prices",
      });
    }

    const order = await Order.findOneAndUpdate(
      { auction: auction._id },
      buildOrderFromAuction(auction, product),
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json({
      msg: "Deal ended successfully",
      orderId: order._id,
    });

  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});


export default router;
