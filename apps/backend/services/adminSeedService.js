import Admin from "../models/Admin.js";

const normalizeEmail = (email = "") => String(email || "").trim().toLowerCase();

const mapRole = (role = "") => {
  const v = String(role || "").trim().toLowerCase();
  if (!v) return "SUPER_ADMIN";
  if (v.includes("super")) return "SUPER_ADMIN";
  if (v.includes("verification")) return "VERIFICATION_OFFICER";
  if (v.includes("viewer")) return "VIEWER";
  if (v.includes("admin")) return "ADMIN";
  return String(role || "").toUpperCase().replace(/[^A-Z0-9_]/g, "_");
};

const mapStatus = (status = "") => {
  const v = String(status || "").trim().toLowerCase();
  if (v === "terminated") return "TERMINATED";
  return "ACTIVE";
};

const defaultNameFromEmail = (email = "") => {
  const name = normalizeEmail(email).split("@")[0] || "admin";
  return name.replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
};

export const seedAdminFromEnv = async () => {
  try {
    const rawEmail = process.env.ADMIN_SEED_EMAIL;
    if (!rawEmail) {
      console.log("[admin-seed] No ADMIN_SEED_EMAIL configured; skipping admin seed.");
      return null;
    }

    const email = normalizeEmail(rawEmail);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      console.warn(`[admin-seed] ADMIN_SEED_EMAIL is not a valid email: ${rawEmail}`);
      return null;
    }

    const role = mapRole(process.env.ADMIN_SEED_ROLE || "SUPER_ADMIN");
    const status = mapStatus(process.env.ADMIN_SEED_STATUS || "ACTIVE");

    const existing = await Admin.findOne({ email }).select("_id role status password");
    if (existing) {
      console.log("[admin-seed] Admin already exists; skipping creation.", {
        email: email,
        role: existing.role,
        status: existing.status,
        hasPassword: Boolean(existing.password),
      });
      return existing;
    }

    const admin = await Admin.create({
      name: defaultNameFromEmail(email),
      email,
      role,
      status,
    });

    console.log("[admin-seed] Created initial admin from env.", {
      email,
      role: admin.role,
      status: admin.status,
      id: admin._id?.toString?.() || "",
    });

    return admin;
  } catch (err) {
    console.error("[admin-seed] Failed to seed admin:", err?.message || err);
    return null;
  }
};

export default seedAdminFromEnv;
