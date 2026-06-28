import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mongoose from "mongoose";
import Admin from "./models/Admin.js";
import Lead from "./models/Lead.js";
import { extractOrchardAiLeadFromUrl } from "./services/orchardAiUrlExtractorService.js";

dotenv.config({
  path: fileURLToPath(new URL("./.env", import.meta.url)),
});

const findTestAdmin = async () => {
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

let createdLeadId = "";

try {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is not configured");
  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
  });

  const admin = await findTestAdmin();
  if (!admin) throw new Error("No active admin is available for extractor attribution");

  const result = await extractOrchardAiLeadFromUrl({
    url: "https://example.com/",
    leadType: "Buyer",
    fruit: "Apple",
    city: "",
    state: "India",
    actorId: admin._id,
  });

  createdLeadId = result.created ? String(result.lead?._id || "") : "";
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        ok: result.ok,
        created: result.created,
        skipped: result.skipped,
        errors: result.errors,
        leadTitle: result.lead?.companyName || null,
        message: result.message,
      },
      null,
      2
    )
  );
} catch {
  // Never print raw network errors or request metadata.
  // eslint-disable-next-line no-console
  console.error("URL extractor test could not complete safely.");
  process.exitCode = 1;
} finally {
  if (createdLeadId) {
    await Lead.findByIdAndDelete(createdLeadId).catch(() => {});
    // eslint-disable-next-line no-console
    console.log("Test lead cleanup complete.");
  }
  await mongoose.disconnect();
}
