#!/usr/bin/env node
import dotenv from "dotenv";
import mongoose from "mongoose";
import { fileURLToPath } from "url";
import User from "../models/User.js";

dotenv.config();

const EMPTY_SLUG_FILTER = {
  $or: [
    { slug: { $exists: false } },
    { slug: null },
    { slug: /^\s*$/ },
  ],
};

const USABLE_PUBLIC_NAME_FILTER = {
  $or: [
    { orchardName: /\S/ },
    { businessName: /\S/ },
    { buyerContactPerson: /\S/ },
  ],
};

const ELIGIBLE_USER_FILTER = {
  $and: [EMPTY_SLUG_FILTER, USABLE_PUBLIC_NAME_FILTER],
};

const PUBLIC_PROFILE_ROLE_FILTER = {
  publicProfileRoles: { $in: ["grower", "buyer", "driver"] },
};

const processUsers = async (filter, counters) => {
  const cursor = User.find(filter).cursor();

  for await (const user of cursor) {
    counters.scanned += 1;

    try {
      // Recheck in memory so reruns and concurrently updated records remain safe.
      if (typeof user.slug === "string" && user.slug.trim()) {
        counters.skipped += 1;
        continue;
      }

      const slug = await user.ensurePublicSlug();
      if (!slug) {
        counters.skipped += 1;
        continue;
      }

      await user.save();
      counters.updated += 1;
      console.log(`[backfill-public-slugs] Updated ${user._id}: ${user.slug}`);
    } catch (error) {
      counters.failed += 1;
      console.error(
        `[backfill-public-slugs] Failed ${user._id}:`,
        error?.message || error
      );
    }
  }
};

export const runPublicSlugBackfill = async () => {
  const counters = {
    scanned: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
  };

  if (mongoose.connection.readyState !== 1) {
    throw new Error("MongoDB must be connected before running the slug backfill");
  }

  // Public profiles are processed first; the second pass handles all other
  // eligible users without revisiting the first group.
  await processUsers({
    $and: [ELIGIBLE_USER_FILTER, PUBLIC_PROFILE_ROLE_FILTER],
  }, counters);
  await processUsers({
    $and: [
      ELIGIBLE_USER_FILTER,
      { $nor: [PUBLIC_PROFILE_ROLE_FILTER] },
    ],
  }, counters);

  console.log(`[backfill-public-slugs] Scanned: ${counters.scanned}`);
  console.log(`[backfill-public-slugs] Updated: ${counters.updated}`);
  console.log(`[backfill-public-slugs] Skipped: ${counters.skipped}`);
  console.log(`[backfill-public-slugs] Failed: ${counters.failed}`);

  return counters;
};

const runFromCommandLine = async () => {
  let connected = false;

  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is not configured");
    }

    await mongoose.connect(process.env.MONGO_URI);
    connected = true;
    console.log("[backfill-public-slugs] MongoDB connected");

    await runPublicSlugBackfill();
    process.exitCode = 0;
  } catch (error) {
    console.error("[backfill-public-slugs] Fatal error:", error?.message || error);
    process.exitCode = 1;
  } finally {
    if (connected || mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      console.log("[backfill-public-slugs] MongoDB disconnected");
    }
  }
};

const isDirectExecution = process.argv[1]
  && fileURLToPath(import.meta.url) === process.argv[1];

if (isDirectExecution) {
  await runFromCommandLine();
}
