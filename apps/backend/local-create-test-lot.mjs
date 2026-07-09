import dotenv from "dotenv";
import mongoose from "mongoose";
import Product from "./models/Product.js";
import Auction from "./models/Auction.js";
import User from "./models/User.js";

dotenv.config();

if (process.env.NODE_ENV === "production") {
  throw new Error("Blocked: local test lot script cannot run in production");
}

await mongoose.connect(process.env.MONGO_URI);

const grower = await User.findOne({
  $or: [
    { phone: "1234567891" },
    { mobile: "1234567891" },
    { email: "testgrower@efruitmandi.live" }
  ]
});

if (!grower) {
  throw new Error("Test grower not found. Login/create test grower first.");
}

const now = new Date();
const end = new Date(now.getTime() + 24 * 60 * 60 * 1000);

const product = await Product.create({
  title: "LOCAL TEST Apple Royal Delicious",
  fruitName: "Apple",
  variety: "Royal Delicious",
  quality: "A",
  productCategory: "Fruit",
  productType: "Fresh Fruit",
  unit: "boxes",
  description: "Local Razorpay test lot only. Do not use in production.",
  quantity: 10,
  lotNo: `LOCAL-TEST-${Date.now()}`,
  packingType: "Box",
  packingWeightKg: 20,
  totalWeightKg: 200,
  basePrice: 100,
  auctionStartTime: now,
  auctionEndTime: end,
  location: "Shimla, Himachal Pradesh",
  createdBy: grower._id,
  createdSource: "grower",
  status: "IN_AUCTION",
  active: true,
  featured: true,
  gradeLots: [
    {
      grade: "A",
      boxes: 10,
      weightKg: 200,
      images: []
    }
  ],
  images: []
});

const auction = await Auction.create({
  product: product._id,
  startingPrice: 100,
  currentBid: 100,
  highestGrade: "A",
  highestGradeRate: 100,
  status: "ACTIVE",
  startTime: now,
  endTime: end
});

console.log("LOCAL TEST LOT CREATED");
console.log("Product ID:", product._id.toString());
console.log("Auction ID:", auction._id.toString());
console.log("Visible Until:", end.toISOString());

await mongoose.disconnect();
