import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import User from "../models/User.js";

dotenv.config();

const TEST_PASSWORD = process.env.TEST_ACCOUNT_PASSWORD || "EFM-Test-2026@123";

await mongoose.connect(process.env.MONGO_URI);
console.log("MongoDB connected");

const existing = await User.findOne({
  $or: [
    { email: "testbuyer@efruitmandi.live" },
    { phone: "1234567890" },
  ],
});

if (existing) {
  console.log("Buyer already exists:");
  console.log(JSON.stringify({
    name: existing.name,
    email: existing.email,
    phone: existing.phone,
    role: existing.role,
    activeRole: existing.activeRole,
    profileTypes: existing.profileTypes,
  }, null, 2));
} else {
  const hashedPassword = await bcrypt.hash(TEST_PASSWORD, 10);

  const buyer = await User.create({
    name: "Test Buyer",
    email: "testbuyer@efruitmandi.live",
    phone: "1234567890",
    password: hashedPassword,
    provider: "local",
    role: null,
    activeRole: "",
    profileTypes: [],
    publicProfileRoles: [],
    accountStatus: "ACTIVE",
    isVerified: true,
  });

  console.log("Created simple test buyer:");
  console.log(JSON.stringify({
    name: buyer.name,
    email: buyer.email,
    phone: buyer.phone,
    role: buyer.role,
    activeRole: buyer.activeRole,
    profileTypes: buyer.profileTypes,
  }, null, 2));
}

await mongoose.disconnect();