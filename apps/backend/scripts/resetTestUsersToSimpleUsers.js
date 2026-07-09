import dotenv from "dotenv";
import mongoose from "mongoose";
import User from "../models/User.js";

dotenv.config();

const testEmails = [
  "testbuyer@efruitmandi.live",
  "testgrower@efruitmandi.live",
  "testdriver@efruitmandi.live",
];

await mongoose.connect(process.env.MONGO_URI);
console.log("MongoDB connected");

const result = await User.updateMany(
  { email: { $in: testEmails } },
  {
    $set: {
      role: null,
      activeRole: "",
      profileTypes: [],
      publicProfileRoles: [],
      buyerVerified: false,
      growerVerified: false,
      driverVerified: false,
      buyerOgVerified: false,
      growerOgVerified: false,
      driverOgVerified: false,
      accountStatus: "ACTIVE",
    },
  }
);

console.log("Matched:", result.matchedCount);
console.log("Modified:", result.modifiedCount);

const users = await User.find({
  email: { $in: testEmails },
}).select("name email phone role activeRole profileTypes accountStatus");

console.log(JSON.stringify(users, null, 2));

await mongoose.disconnect();