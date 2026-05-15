import mongoose from "mongoose";

const auctionSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
    },
    startingPrice: Number,
    currentBid: {
      type: Number,
      default: 0,
    },
    highestBidder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    status: {
      type: String,
      enum: ["SCHEDULED", "ACTIVE", "ENDED"],
      default: "SCHEDULED",
    },
    startTime: Date,
    endTime: Date,
  },
  { timestamps: true }
);

export default mongoose.model("Auction", auctionSchema);
