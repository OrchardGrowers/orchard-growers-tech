import dotenv from "dotenv";
import mongoose from "mongoose";
import User from "./models/User.js";

dotenv.config();

await mongoose.connect(process.env.MONGO_URI);

const now = new Date();

const result = await User.updateMany(
  {
    $or: [
      { phone: "1234567890" },
      { contact: "1234567890" },
      { email: "testbuyer@efruitmandi.live" }
    ]
  },
  {
    $set: {
      role: "buyer",
      activeRole: "buyer",
      profileTypes: ["buyer"],
      publicProfileRoles: ["buyer"],
      buyerVerified: true,
      buyerOgVerified: true,
      isVerified: true,
      accountStatus: "ACTIVE",
      "kyc.status": "APPROVED",
      "kyc.roleType": "buyer",
      "kyc.submittedAt": now,
      "kyc.reviewedAt": now,
      "kycByRole.buyer.status": "APPROVED",
      "kycByRole.buyer.roleType": "buyer",
      "kycByRole.buyer.submittedAt": now,
      "kycByRole.buyer.reviewedAt": now
    }
  }
);

console.log("Matched:", result.matchedCount);
console.log("Modified:", result.modifiedCount);

await mongoose.disconnect();
