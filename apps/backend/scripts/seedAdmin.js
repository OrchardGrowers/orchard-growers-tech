#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config();

import { seedAdminFromEnv } from "../services/adminSeedService.js";
import connectDB from "../config/db.js";

(async () => {
  try {
    const connected = await connectDB();
    if (!connected) {
      console.error("[seed-admin-script] Could not connect to DB; aborting seed.");
      process.exit(1);
    }

    const res = await seedAdminFromEnv();
    if (res) {
      console.log("[seed-admin-script] Seed completed.");
      process.exit(0);
    }
    console.log("[seed-admin-script] No seed performed.");
    process.exit(0);
  } catch (err) {
    console.error("[seed-admin-script] Error:", err?.message || err);
    process.exit(1);
  }
})();
