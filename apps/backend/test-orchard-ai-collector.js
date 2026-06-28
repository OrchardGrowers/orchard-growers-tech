import dotenv from "dotenv";
import mongoose from "mongoose";
import Admin from "./models/Admin.js";
import { collectOrchardAiLeadsFromGoogle } from "./services/orchardAiCollectorService.js";

dotenv.config();

const findCollectorAdmin = async () => {
  const configuredAdminId = String(
    process.env.ORCHARD_AI_COLLECTOR_ADMIN_ID || ""
  ).trim();

  if (configuredAdminId && mongoose.isValidObjectId(configuredAdminId)) {
    const configuredAdmin = await Admin.findOne({
      _id: configuredAdminId,
      status: "ACTIVE",
    })
      .select("_id")
      .lean();
    if (configuredAdmin) return configuredAdmin;
  }

  return Admin.findOne({
    status: "ACTIVE",
    role: { $in: ["SUPER_ADMIN", "ADMIN", "EMPLOYEE"] },
  })
    .sort({ createdAt: 1, _id: 1 })
    .select("_id")
    .lean();
};

try {
  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
  });

  const admin = await findCollectorAdmin();
  if (!admin) {
    throw new Error("No active admin is available for collector attribution.");
  }

  const summary = await collectOrchardAiLeadsFromGoogle({
    category: "buyers",
    query: "apple fruit buyers India",
    fruit: "Apple",
    state: "India",
    city: "",
    leadType: "Buyer",
    limit: 5,
    actorId: admin._id,
  });

  // These logs intentionally contain counts and titles only, never credentials.
  // eslint-disable-next-line no-console
  console.log(`Created count: ${summary.created}`);
  // eslint-disable-next-line no-console
  console.log(`Skipped count: ${summary.skipped}`);
  // eslint-disable-next-line no-console
  console.log(`Error count: ${summary.errors}`);
  // eslint-disable-next-line no-console
  console.log(
    "Sample lead titles:",
    summary.createdLeads.slice(0, 3).map((lead) => lead.companyName)
  );

  if (!summary.ok && summary.message) {
    // eslint-disable-next-line no-console
    console.warn(summary.message);
  }
} catch {
  // Do not print raw provider errors because request metadata may contain credentials.
  // eslint-disable-next-line no-console
  console.error("Collector test could not complete safely.");
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
