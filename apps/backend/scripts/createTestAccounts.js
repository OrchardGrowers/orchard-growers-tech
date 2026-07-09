import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import User from "../models/User.js";

dotenv.config();

const TEST_PASSWORD = process.env.TEST_ACCOUNT_PASSWORD || "EFM-Test-2026@123";

const testUsers = [
  {
    name: "Test Buyer",
    email: "testbuyer@efruitmandi.live",
    phone: "1234567890",
    role: "buyer",
    activeRole: "buyer",
    profileTypes: ["buyer"],
    publicProfileRoles: ["buyer"],
    accountStatus: "ACTIVE",
    buyerVerified: true,
    buyerOgVerified: true,
    isVerified: true,
  },
  {
    name: "Test Grower",
    email: "testgrower@efruitmandi.live",
    phone: "1234567891",
    role: "grower",
    activeRole: "grower",
    profileTypes: ["grower"],
    publicProfileRoles: ["grower"],
    accountStatus: "ACTIVE",
    growerVerified: true,
    growerOgVerified: true,
    isVerified: true,
    orchardName: "Test Orchard",
    location: "Shimla",
  },
  {
    name: "Test Driver",
    email: "testdriver@efruitmandi.live",
    phone: "1234567892",
    role: "driver",
    activeRole: "driver",
    profileTypes: ["driver"],
    publicProfileRoles: ["driver"],
    accountStatus: "ACTIVE",
    driverVerified: true,
    driverOgVerified: true,
    isVerified: true,
    logisticsName: "Test Logistics",
    vehicleNumber: "TESTHP01",
    licenseNumber: "TESTDL001",
  },
];

const run = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI missing in .env");
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log("MongoDB connected");

  const hashedPassword = await bcrypt.hash(TEST_PASSWORD, 10);

  for (const data of testUsers) {
    const existing = await User.findOne({
      $or: [{ email: data.email }, { phone: data.phone }],
    });

    if (existing) {
      console.log(`Skipped existing user: ${data.email}`);
      continue;
    }

    await User.create({
      ...data,
      password: hashedPassword,
      provider: "local",
    });

    console.log(`Created test user: ${data.email}`);
  }

  console.log("Test user seed completed");
  console.log("Password:", TEST_PASSWORD);
  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error("Seed failed:", err.message);
  await mongoose.disconnect();
  process.exit(1);
});