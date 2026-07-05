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
    highestGrade: String,
    highestGradeRate: {
      type: Number,
      default: 0,
    },
    distanceKm: {
      type: Number,
      default: 0,
    },
    dealBreakdown: mongoose.Schema.Types.Mixed,
    highestBidder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    status: {
      type: String,
      enum: ["SCHEDULED", "ACTIVE", "ENDED", "EXPIRED", "CANCELLED"],
      default: "SCHEDULED",
    },
    startTime: Date,
    endTime: Date,
    expiredAt: Date,
    cancelledAt: Date,
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    cancellationReason: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model("Auction", auctionSchema);
