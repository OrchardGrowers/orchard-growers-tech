import Auction from "../models/Auction.js";
import { resolveDealSchedule } from "../services/dealLifecycleService.js";

// CREATE DEAL
export const createAuction = async (req, res) => {
  try {
    const { productId, startingPrice } = req.body;

    if (!productId || !startingPrice) {
      return res.status(400).json({ msg: "All fields required" });
    }

    const dealSchedule = resolveDealSchedule(new Date());
    const startTime = dealSchedule.startTime;
    const endTime = dealSchedule.endTime;

    const auction = await Auction.create({
      product: productId,
      startingPrice,
      currentBid: startingPrice,
      status: dealSchedule.isLiveNow ? "ACTIVE" : "SCHEDULED",
      startTime,
      endTime,
    });

    res.json(auction);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: err.message });
  }
};

// GET DEALS
export const getAuctions = async (req, res) => {
  try {
    const auctions = await Auction.find()
      .populate("product")
      .populate("highestBidder", "name");

    res.json(auctions);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};
