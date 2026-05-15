import express from "express";
import Auction from "../models/Auction.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import protect, { authorize, optionalProtect } from "../middleware/authMiddleware.js";

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
  user?.role === "grower" &&
  product?.createdBy &&
  (product.createdBy._id || product.createdBy)?.toString() === user.id?.toString();

const serializeAuction = (auction, user) => {
  const data = auction.toObject ? auction.toObject() : { ...auction };

  if (data.product && !canSeeProductBasePrice(data.product, user)) {
    delete data.product.basePrice;
    delete data.startingPrice;
  }

  return data;
};

// ================= CREATE DEAL =================
router.post("/", protect, authorize("grower"), async (req, res) => {
  try {
    const { product, startingPrice, currentBid, startTime } = req.body;

    console.log("Incoming product:", product);

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

    const auction = await Auction.create({
      product,
      startingPrice: openingPrice,
      currentBid: Number(currentBid || openingPrice),
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
      {
        auction: auction._id,
        product: auction.product,
        buyer: auction.highestBidder,
        grower: product.createdBy,
        auctionPrice: auction.currentBid,
        paymentStatus: "PENDING",
      },
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
