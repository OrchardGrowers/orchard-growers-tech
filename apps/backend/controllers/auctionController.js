import Auction from "../models/Auction.js";

const AUCTION_DURATION_MS = 5 * 60 * 1000;

// CREATE DEAL
export const createAuction = async (req, res) => {
  try {
    const { productId, startingPrice } = req.body;

    if (!productId || !startingPrice) {
      return res.status(400).json({ msg: "All fields required" });
    }

    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + AUCTION_DURATION_MS);

    const auction = await Auction.create({
      product: productId,
      startingPrice,
      currentBid: startingPrice,
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
