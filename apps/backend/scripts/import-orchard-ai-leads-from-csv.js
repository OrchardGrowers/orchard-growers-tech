import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mongoose from "mongoose";
import Admin from "../models/Admin.js";
import Lead, { LEAD_TYPES } from "../models/Lead.js";
import {
  findExistingOrchardAiLead,
  isOrchardAiLeadDuplicateError,
} from "../services/orchardAiLeadDeduplicationService.js";

dotenv.config({
  path: fileURLToPath(new URL("../.env", import.meta.url)),
});

const REQUIRED_COLUMNS = [
  "companyName",
  "contactPerson",
  "leadType",
  "fruit",
  "city",
  "state",
  "website",
  "sourceUrl",
  "sourcePlatform",
  "phone",
  "email",
  "notes",
];

const MAX_CSV_SIZE_BYTES = 25 * 1024 * 1024;

const cleanText = (value = "", maximumLength = 5000) =>
  String(value || "").trim().slice(0, maximumLength);

const parseCsv = (content) => {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];

    if (character === '"') {
      if (inQuotes && content[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && character === ",") {
      row.push(cell);
      cell = "";
      continue;
    }

    if (!inQuotes && (character === "\n" || character === "\r")) {
      if (character === "\r" && content[index + 1] === "\n") index += 1;
      row.push(cell);
      cell = "";
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      continue;
    }

    cell += character;
  }

  if (inQuotes) throw new Error("CSV contains an unclosed quoted value");
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
};

const normalizeLeadType = (value) => {
  const requested = cleanText(value, 80);
  return LEAD_TYPES.find(
    (leadType) => leadType.toLowerCase() === requested.toLowerCase()
  );
};

const findImportAdmin = async () => {
  const configuredAdminId = cleanText(
    process.env.ORCHARD_AI_COLLECTOR_ADMIN_ID,
    100
  );
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

const buildLeadPayload = (row, actorId) => {
  const leadType = normalizeLeadType(row.leadType);
  if (!leadType) {
    throw new Error(`Invalid leadType: ${cleanText(row.leadType, 80) || "empty"}`);
  }

  const companyName = cleanText(row.companyName, 200);
  if (!companyName) throw new Error("companyName is required");

  const website = cleanText(row.website || row.sourceUrl, 500);
  const sourceUrl = cleanText(row.sourceUrl || row.website, 1000);

  return {
    companyName,
    contactPerson: cleanText(row.contactPerson, 120) || "To be verified",
    leadType,
    fruits: cleanText(row.fruit, 80) ? [cleanText(row.fruit, 80)] : [],
    city: cleanText(row.city, 120),
    state: cleanText(row.state, 120),
    address: "",
    phone: cleanText(row.phone, 40),
    email: cleanText(row.email, 254).toLowerCase(),
    whatsapp: "",
    website,
    sourceUrl,
    sourcePlatform: cleanText(row.sourcePlatform, 80) || "CSV Import",
    score: 40,
    priority: "Medium",
    status: "New",
    assignedTo: null,
    notes: cleanText(row.notes, 5000),
    tags: ["manual-import", "public-data", "needs-verification"],
    createdBy: actorId,
    updatedBy: actorId,
  };
};

const run = async () => {
  const csvArgument = process.argv[2];
  if (!csvArgument) {
    throw new Error(
      "CSV path is required. Example: node scripts/import-orchard-ai-leads-from-csv.js data/orchard-ai-leads-sample.csv"
    );
  }
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is not configured");

  const csvPath = path.resolve(process.cwd(), csvArgument);
  const fileStats = await fs.stat(csvPath);
  if (!fileStats.isFile()) throw new Error("CSV path must point to a file");
  if (fileStats.size > MAX_CSV_SIZE_BYTES) {
    throw new Error("CSV file cannot exceed 25 MB");
  }

  const content = await fs.readFile(csvPath, "utf8");
  const rows = parseCsv(content.replace(/^\uFEFF/, ""));
  if (rows.length < 2) throw new Error("CSV must include a header and at least one data row");

  const headers = rows[0].map((header) => cleanText(header, 100));
  const missingColumns = REQUIRED_COLUMNS.filter((column) => !headers.includes(column));
  if (missingColumns.length) {
    throw new Error(`CSV is missing required columns: ${missingColumns.join(", ")}`);
  }

  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
  });
  const admin = await findImportAdmin();
  if (!admin) throw new Error("No active admin is available for import attribution");

  const summary = {
    created: 0,
    skipped: 0,
    errors: 0,
    sampleCreated: [],
  };

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const values = rows[rowIndex];
    const row = Object.fromEntries(
      headers.map((header, index) => [header, values[index] || ""])
    );

    try {
      const payload = buildLeadPayload(row, admin._id);
      const duplicate = await findExistingOrchardAiLead(payload);
      if (duplicate) {
        summary.skipped += 1;
        continue;
      }

      const lead = await Lead.create(payload);
      summary.created += 1;
      if (summary.sampleCreated.length < 5) {
        summary.sampleCreated.push(lead.companyName);
      }
    } catch (error) {
      if (isOrchardAiLeadDuplicateError(error)) {
        summary.skipped += 1;
      } else {
        summary.errors += 1;
      }
    }
  }

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(summary, null, 2));
};

try {
  await run();
} catch (error) {
  // Fatal import errors are safe to print because no provider request metadata is involved.
  // eslint-disable-next-line no-console
  console.error(`CSV import failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
