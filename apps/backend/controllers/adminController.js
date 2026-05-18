import Admin from "../models/Admin.js";
import User from "../models/User.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import VerificationRequest from "../models/VerificationRequest.js";
import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";

const ADMIN_SELECT = "-password -__v";
const USER_SELECT = "-password -__v";
const ADMIN_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "UNIT_MANAGER",
  "INVENTORY_MANAGER",
  "SALES_EXECUTIVE",
  "PURCHASE_MANAGER",
  "FINANCE_MANAGER",
  "VERIFICATION_OFFICER",
  "SUPPORT_EXECUTIVE",
  "VIEWER",
  "EMPLOYEE",
];
const ADMIN_STATUSES = ["ACTIVE", "TERMINATED"];
const USER_ROLES = [null, "grower", "buyer", "driver"];
const USER_STATUSES = ["ACTIVE", "HOLD", "SUSPENDED", "TERMINATED"];
const ROLE_LABELS = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  UNIT_MANAGER: "Unit Manager",
  INVENTORY_MANAGER: "Inventory Manager",
  SALES_EXECUTIVE: "Sales Executive",
  PURCHASE_MANAGER: "Purchase Manager",
  FINANCE_MANAGER: "Finance Manager",
  VERIFICATION_OFFICER: "Verification Officer",
  SUPPORT_EXECUTIVE: "Support Executive",
  VIEWER: "Viewer",
  EMPLOYEE: "Admin",
};
const ADMIN_CLASS_LABELS = {
  SUPER_ADMIN: "SUPER",
  ADMIN: "CLASS1",
  VERIFICATION_OFFICER: "CLASS2",
  EMPLOYEE: "CLASS2",
};

const normalizeEmail = (email = "") => email.trim().toLowerCase();
const PASSWORD_RULE_MESSAGE = "Password must be at least 8 characters and include a letter and a number";
const ADMIN_RESET_TOKEN_TTL_MS = 30 * 60 * 1000;
const ALLOWED_ADMIN_SIGNUP_EMAILS = new Set(
  [
    "testadminclassI@orchardgrowers.in",
    "testadminclassII@orchardgrowers.in",
    "testclassIII@orchardgrowers.in",
    "pawann@orchardgrowers.in",
    "hr.ho@orchardgrowers.in",
    "invest@orchardgrowers.in",
    "careers@orchardgrowers.in",
    "grievance@orchardgrowers.in",
    "no-reply@orchardgrowers.in",
    "founder@orchardgrowers.in",
    "adminho@orchardgrowers.in",
    "sales.ffccbb@orchardgrowers.in",
    "komal@orchardgrowers.in",
  ].map(normalizeEmail)
);
const ADMIN_SIGNUP_ROLE_BY_EMAIL = new Map(
  [
    ["testadminclassI@orchardgrowers.in", "ADMIN"],
    ["testadminclassII@orchardgrowers.in", "VERIFICATION_OFFICER"],
    ["testclassIII@orchardgrowers.in", "VIEWER"],
    ["pawann@orchardgrowers.in", "ADMIN"],
    ["hr.ho@orchardgrowers.in", "SUPPORT_EXECUTIVE"],
    ["invest@orchardgrowers.in", "FINANCE_MANAGER"],
    ["careers@orchardgrowers.in", "SUPPORT_EXECUTIVE"],
    ["grievance@orchardgrowers.in", "SUPPORT_EXECUTIVE"],
    ["no-reply@orchardgrowers.in", "VIEWER"],
    ["founder@orchardgrowers.in", "ADMIN"],
    ["adminho@orchardgrowers.in", "ADMIN"],
    ["sales.ffccbb@orchardgrowers.in", "SALES_EXECUTIVE"],
    ["komal@orchardgrowers.in", "ADMIN"],
  ].map(([email, role]) => [normalizeEmail(email), role])
);
const isTestAdminEnabled = () => process.env.NODE_ENV !== "production";
const TEST_ADMIN_ACCOUNTS = [
  {
    name: "Test Super Admin",
    role: "SUPER_ADMIN",
    email: normalizeEmail(process.env.TEST_SUPER_ADMIN_EMAIL || process.env.TEST_ADMIN1_EMAIL || "admin1@efruitmandi.local"),
    password: process.env.TEST_SUPER_ADMIN_PASSWORD || process.env.TEST_ADMIN1_PASSWORD || "admin112345",
  },
  {
    name: "Test Admin X",
    role: "ADMIN",
    email: normalizeEmail(
      process.env.TEST_ADMIN_X_EMAIL || process.env.TEST_ADMIN2_EMAIL || process.env.TEST_ADMIN_EMAIL || "testadmin@efruitmandi.local"
    ),
    password: process.env.TEST_ADMIN_X_PASSWORD || process.env.TEST_ADMIN2_PASSWORD || process.env.TEST_ADMIN_PASSWORD || "admin12345",
  },
  {
    name: "Test Admin Y",
    role: "EMPLOYEE",
    email: normalizeEmail(process.env.TEST_ADMIN_Y_EMAIL || process.env.TEST_ADMIN3_EMAIL || "adminy@efruitmandi.local"),
    password: process.env.TEST_ADMIN_Y_PASSWORD || process.env.TEST_ADMIN3_PASSWORD || "adminy12345",
  },
];

const signAdminToken = (admin) =>
  jwt.sign(
    { id: admin._id, role: admin.role, adminRole: admin.role },
    process.env.JWT_SECRET
  );

const isMasterLogin = (email, password) => {
  const masterEmail = normalizeEmail(process.env.MASTER_ADMIN_EMAIL || "");
  const masterPassword = process.env.MASTER_ADMIN_PASSWORD || "";

  return Boolean(masterEmail && masterPassword && email === masterEmail && password === masterPassword);
};

const getTestAdminAccount = (email, password) => {
  if (!isTestAdminEnabled()) return null;

  return (
    TEST_ADMIN_ACCOUNTS.find(
      (account) => account.email && account.password && email === account.email && password === account.password
    ) || null
  );
};

const safeAdmin = (admin) => ({
  id: admin._id,
  name: admin.name,
  email: admin.email,
  role: admin.role,
  roleLabel: ROLE_LABELS[admin.role] || admin.role,
  status: admin.status,
});

const getAdminClass = (role) => ADMIN_CLASS_LABELS[role] || "CLASS2";

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const validateAdminPassword = (password = "") => {
  if (typeof password !== "string" || password.length < 8) return PASSWORD_RULE_MESSAGE;
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return PASSWORD_RULE_MESSAGE;
  return "";
};

const getSignupRole = (email) => ADMIN_SIGNUP_ROLE_BY_EMAIL.get(email) || "EMPLOYEE";

const getDefaultAdminName = (email) =>
  email
    .split("@")[0]
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

const hashResetToken = (token = "") =>
  crypto.createHash("sha256").update(token).digest("hex");

const createPasswordResetToken = () => {
  const token = crypto.randomBytes(32).toString("hex");
  return {
    token,
    tokenHash: hashResetToken(token),
    expiresAt: new Date(Date.now() + ADMIN_RESET_TOKEN_TTL_MS),
  };
};

const truthyEnv = (value = "") => ["1", "true", "yes"].includes(String(value).toLowerCase());

const getResetBaseUrl = (req) =>
  (process.env.ADMIN_RESET_BASE_URL || process.env.ADMIN_PANEL_URL || req.get("origin") || "")
    .trim()
    .replace(/\/+$/, "");

const buildAdminResetUrl = (req, email, token) => {
  const baseUrl = getResetBaseUrl(req);
  if (!baseUrl) return "";

  const separator = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${separator}mode=reset&email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`;
};

const getSmtpTransport = () => {
  const host = process.env.SMTP_HOST || "";
  const from = process.env.SMTP_FROM || process.env.ADMIN_RESET_FROM_EMAIL || process.env.SMTP_USER || "";
  if (!host || !from) return null;

  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER || "";
  const pass = process.env.SMTP_PASS || "";

  return {
    from,
    transporter: nodemailer.createTransport({
      host,
      port,
      secure: truthyEnv(process.env.SMTP_SECURE) || port === 465,
      ...(user && pass ? { auth: { user, pass } } : {}),
    }),
  };
};

const sendAdminPasswordResetEmail = async ({ req, email, token }) => {
  const mailConfig = getSmtpTransport();
  if (!mailConfig) return false;

  const resetUrl = buildAdminResetUrl(req, email, token);
  if (!resetUrl) return false;

  await mailConfig.transporter.sendMail({
    from: mailConfig.from,
    to: email,
    subject: "Admin password reset",
    text: `Use this secure link to reset your admin password. It expires in 30 minutes:\n\n${resetUrl}`,
    html: `<p>Use this secure link to reset your admin password. It expires in 30 minutes:</p><p><a href="${resetUrl}">Reset admin password</a></p>`,
  });

  return true;
};

const hasDualApproval = (reviews = []) => {
  const approvedClasses = new Set(
    reviews
      .filter((review) => review.action === "APPROVE")
      .map((review) => review.adminClass)
  );

  return approvedClasses.has("CLASS1") && approvedClasses.has("CLASS2");
};

const hasDualRejection = (reviews = []) => {
  const rejectedClasses = new Set(
    reviews
      .filter((review) => ["REJECT", "DISAPPROVE", "HOLD", "SUSPEND", "TERMINATE"].includes(review.action))
      .map((review) => review.adminClass)
  );

  return rejectedClasses.has("CLASS1") && rejectedClasses.has("CLASS2");
};

const requireAdmin = (req, res) => {
  if (!req.user || !ADMIN_ROLES.includes(req.user.role)) {
    res.status(403).json({ msg: "Admin access required" });
    return null;
  }
  return req.user;
};

const requireSuperAdmin = (req, res) => {
  const admin = requireAdmin(req, res);
  if (!admin) return null;

  if (admin.role !== "SUPER_ADMIN") {
    res.status(403).json({ msg: "Super admin access required" });
    return null;
  }

  return admin;
};

export const signupAdmin = async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const name = String(req.body.name || "").trim();
  const { password, confirmPassword } = req.body;

  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ msg: "Valid admin email is required" });
  }

  if (!ALLOWED_ADMIN_SIGNUP_EMAILS.has(email)) {
    return res.status(403).json({ msg: "This email is not allowed for admin signup" });
  }

  const passwordError = validateAdminPassword(password);
  if (passwordError) return res.status(400).json({ msg: passwordError });

  if (confirmPassword && password !== confirmPassword) {
    return res.status(400).json({ msg: "Passwords do not match" });
  }

  const existingAdmin = await Admin.findOne({ email }).select("+resetPasswordTokenHash +resetPasswordExpiresAt");
  if (existingAdmin?.status === "TERMINATED") {
    return res.status(403).json({ msg: "Admin account terminated" });
  }

  if (existingAdmin?.password) {
    return res.status(409).json({ msg: "Admin already exists. Please login or reset password." });
  }

  const isNewAdmin = !existingAdmin;
  const admin = existingAdmin || new Admin({ email });
  admin.name = name || admin.name || getDefaultAdminName(email);
  admin.email = email;
  admin.password = await bcrypt.hash(password, 10);
  admin.role = isNewAdmin ? getSignupRole(email) : admin.role || getSignupRole(email);
  admin.status = "ACTIVE";
  admin.resetPasswordTokenHash = undefined;
  admin.resetPasswordExpiresAt = undefined;
  admin.resetPasswordRequestedAt = undefined;
  admin.passwordChangedAt = new Date();
  await admin.save();

  res.status(201).json({
    token: signAdminToken(admin),
    role: admin.role,
    admin: safeAdmin(admin),
  });
};

export const loginAdmin = async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const { password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ msg: "Email and password are required" });
  }

  if (isMasterLogin(email, password)) {
    const hashedPassword = await bcrypt.hash(password, 10);
    const admin = await Admin.findOneAndUpdate(
      { email },
      {
        name: "Master Admin",
        email,
        password: hashedPassword,
        role: "SUPER_ADMIN",
        status: "ACTIVE",
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return res.json({
      token: signAdminToken(admin),
      role: admin.role,
      admin: safeAdmin(admin),
    });
  }

  const matchedTestAdmin = getTestAdminAccount(email, password);
  if (matchedTestAdmin) {
    const hashedPassword = await bcrypt.hash(password, 10);
    const admin = await Admin.findOneAndUpdate(
      { email },
      {
        name: matchedTestAdmin.name,
        email,
        password: hashedPassword,
        role: matchedTestAdmin.role,
        status: "ACTIVE",
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return res.json({
      token: signAdminToken(admin),
      role: admin.role,
      admin: safeAdmin(admin),
    });
  }

  const admin = await Admin.findOne({ email });

  if (!admin) return res.status(404).json({ msg: "Admin not found" });
  if (admin.status === "TERMINATED") {
    return res.status(403).json({ msg: "Admin account terminated" });
  }

  if (!admin.password) {
    return res.status(401).json({ msg: "Admin password is not configured" });
  }

  const isMatch = await bcrypt.compare(password, admin.password);

  if (!isMatch) return res.status(401).json({ msg: "Wrong password" });

  res.json({
    token: signAdminToken(admin),
    role: admin.role,
    admin: safeAdmin(admin),
  });
};

export const requestAdminPasswordReset = async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const response = { msg: "If the admin email is registered, reset instructions have been sent." };

  if (!email || !isValidEmail(email) || !ALLOWED_ADMIN_SIGNUP_EMAILS.has(email)) {
    return res.json(response);
  }

  const admin = await Admin.findOne({ email }).select("+resetPasswordTokenHash +resetPasswordExpiresAt");
  if (!admin || admin.status === "TERMINATED") {
    return res.json(response);
  }

  const { token, tokenHash, expiresAt } = createPasswordResetToken();
  admin.resetPasswordTokenHash = tokenHash;
  admin.resetPasswordExpiresAt = expiresAt;
  admin.resetPasswordRequestedAt = new Date();
  await admin.save();

  let emailSent = false;
  try {
    emailSent = await sendAdminPasswordResetEmail({ req, email, token });
  } catch (err) {
    console.error("Admin reset email failed:", err.message || err);
  }

  if (isTestAdminEnabled()) {
    return res.json({
      ...response,
      emailSent,
      resetToken: token,
      resetUrl: buildAdminResetUrl(req, email, token),
    });
  }

  res.json(response);
};

export const resetAdminPassword = async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const token = String(req.body.token || "").trim();
  const { password, confirmPassword } = req.body;

  if (!email || !isValidEmail(email) || !token) {
    return res.status(400).json({ msg: "Valid email and reset token are required" });
  }

  const passwordError = validateAdminPassword(password);
  if (passwordError) return res.status(400).json({ msg: passwordError });

  if (confirmPassword && password !== confirmPassword) {
    return res.status(400).json({ msg: "Passwords do not match" });
  }

  const admin = await Admin.findOne({
    email,
    resetPasswordTokenHash: hashResetToken(token),
    resetPasswordExpiresAt: { $gt: new Date() },
  }).select("+resetPasswordTokenHash +resetPasswordExpiresAt");

  if (!admin) {
    return res.status(400).json({ msg: "Reset link is invalid or expired" });
  }

  if (admin.status === "TERMINATED") {
    return res.status(403).json({ msg: "Admin account terminated" });
  }

  admin.password = await bcrypt.hash(password, 10);
  admin.resetPasswordTokenHash = undefined;
  admin.resetPasswordExpiresAt = undefined;
  admin.resetPasswordRequestedAt = undefined;
  admin.passwordChangedAt = new Date();
  await admin.save();

  res.json({ msg: "Password reset successful. Please login." });
};

export const getAdminAnalytics = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const [
    totalUsers,
    growers,
    buyers,
    logistics,
    verifiedUsers,
    terminatedUsers,
    totalLots,
    totalOrders,
    verificationSubmitted,
    verificationApproved,
    verificationRejected,
    activeAdmins,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ role: "grower" }),
    User.countDocuments({ role: "buyer" }),
    User.countDocuments({ role: "driver" }),
    User.countDocuments({ isVerified: true }),
    User.countDocuments({ accountStatus: "TERMINATED" }),
    Product.countDocuments(),
    Order.countDocuments(),
    VerificationRequest.countDocuments({ status: "SUBMITTED" }),
    VerificationRequest.countDocuments({ status: "APPROVED" }),
    VerificationRequest.countDocuments({ status: { $in: ["REJECTED", "DISAPPROVED", "TERMINATED"] } }),
    Admin.countDocuments({ status: "ACTIVE" }),
  ]);

  res.json({
    totalUsers,
    growers,
    buyers,
    logistics,
    verifiedUsers,
    terminatedUsers,
    totalLots,
    totalOrders,
    verificationSubmitted,
    verificationApproved,
    verificationRejected,
    activeAdmins,
  });
};

export const listAdmins = async (req, res) => {
  if (!requireSuperAdmin(req, res)) return;

  const admins = await Admin.find().select(ADMIN_SELECT).sort({ role: -1, createdAt: -1 });
  res.json(admins.map(safeAdmin));
};

export const createAdmin = async (req, res) => {
  const currentAdmin = requireSuperAdmin(req, res);
  if (!currentAdmin) return;

  const { name, password } = req.body;
  const email = normalizeEmail(req.body.email);
  const role = req.body.role || "EMPLOYEE";

  if (!email || !password || !ADMIN_ROLES.includes(role)) {
    return res.status(400).json({ msg: "Valid email, password, and role are required" });
  }

  if (role === "SUPER_ADMIN") {
    return res.status(403).json({ msg: "Only one master Super Admin should be used" });
  }

  const existing = await Admin.findOne({ email });
  if (existing) return res.status(400).json({ msg: "Admin already exists" });

  const admin = await Admin.create({
    name: name || ROLE_LABELS[role],
    email,
    password: await bcrypt.hash(password, 10),
    role,
    status: "ACTIVE",
    createdBy: currentAdmin.id,
  });

  res.status(201).json(safeAdmin(admin));
};

export const updateAdmin = async (req, res) => {
  if (!requireSuperAdmin(req, res)) return;

  const updates = {};
  const { name, role, password } = req.body;

  if (typeof name === "string") updates.name = name.trim();
  if (role && ADMIN_ROLES.includes(role) && role !== "SUPER_ADMIN") updates.role = role;
  if (password) updates.password = await bcrypt.hash(password, 10);

  const admin = await Admin.findByIdAndUpdate(req.params.id, updates, { new: true }).select(ADMIN_SELECT);
  if (!admin) return res.status(404).json({ msg: "Admin not found" });

  res.json(safeAdmin(admin));
};

export const terminateAdmin = async (req, res) => {
  const currentAdmin = requireSuperAdmin(req, res);
  if (!currentAdmin) return;

  const admin = await Admin.findById(req.params.id);
  if (!admin) return res.status(404).json({ msg: "Admin not found" });
  if (admin.role === "SUPER_ADMIN") {
    return res.status(403).json({ msg: "Super Admin cannot be terminated here" });
  }

  const requestedStatus = String(req.body.status || "TERMINATED").toUpperCase();
  if (!ADMIN_STATUSES.includes(requestedStatus)) {
    return res.status(400).json({ msg: "Invalid admin status" });
  }

  admin.status = requestedStatus;
  if (admin.status === "TERMINATED") {
    admin.terminatedBy = currentAdmin.id;
    admin.terminatedAt = new Date();
  } else {
    admin.terminatedBy = null;
    admin.terminatedAt = null;
  }
  await admin.save();

  res.json(safeAdmin(admin));
};

export const deleteAdmin = async (req, res) => {
  if (!requireSuperAdmin(req, res)) return;

  const admin = await Admin.findById(req.params.id);
  if (!admin) return res.status(404).json({ msg: "Admin not found" });
  if (admin.role === "SUPER_ADMIN") {
    return res.status(403).json({ msg: "Super Admin cannot be deleted here" });
  }

  await admin.deleteOne();
  res.json({ message: "Admin deleted" });
};

export const listUsers = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const users = await User.find().select(USER_SELECT).sort({ createdAt: -1 });
  res.json(users);
};

export const updateUserByAdmin = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const allowed = [
    "name",
    "phone",
    "email",
    "role",
    "orchardName",
    "businessName",
    "buyerContactPerson",
    "designation",
    "businessAddressLine1",
    "businessAddressLine2",
    "businessAddressLine3",
    "businessPinCode",
    "lockedAmount",
    "logisticsName",
    "vehicleNumber",
    "licenseNumber",
    "location",
    "contact",
    "isVerified",
    "adminNotes",
  ];
  const updates = {};

  allowed.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      updates[field] = req.body[field];
    }
  });

  if (Object.prototype.hasOwnProperty.call(updates, "email")) {
    updates.email = normalizeEmail(updates.email);
  }

  if (Object.prototype.hasOwnProperty.call(updates, "role")) {
    const requestedRole = updates.role === "" ? null : updates.role;
    if (!USER_ROLES.includes(requestedRole)) {
      return res.status(400).json({ msg: "Invalid user role" });
    }
    updates.role = requestedRole;
  }

  if (Object.prototype.hasOwnProperty.call(updates, "isVerified")) {
    updates.isVerified = Boolean(updates.isVerified);
  }

  if (Object.prototype.hasOwnProperty.call(updates, "lockedAmount")) {
    const lockedAmount = Number(updates.lockedAmount);
    if (!Number.isFinite(lockedAmount) || lockedAmount < 0) {
      return res.status(400).json({ msg: "Invalid locked amount" });
    }
    updates.lockedAmount = lockedAmount;
  }

  const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true }).select(USER_SELECT);
  if (!user) return res.status(404).json({ msg: "User not found" });

  res.json(user);
};

export const setUserStatusByAdmin = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const status = String(req.body.status || "TERMINATED").toUpperCase();
  if (!USER_STATUSES.includes(status)) {
    return res.status(400).json({ msg: "Invalid user status" });
  }

  const user = await User.findByIdAndUpdate(
    req.params.id,
    { accountStatus: status, adminNotes: req.body.note || "" },
    { new: true }
  ).select(USER_SELECT);

  if (!user) return res.status(404).json({ msg: "User not found" });

  res.json(user);
};

export const deleteUserByAdmin = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ msg: "User not found" });

  await user.deleteOne();
  res.json({ message: "User deleted" });
};

const PRODUCT_ADMIN_FIELDS = [
  "title",
  "fruitName",
  "variety",
  "description",
  "quantity",
  "basePrice",
  "location",
  "status",
  "packingType",
  "packingWeightKg",
  "totalWeightKg",
  "images",
];

const normalizeProductAdminPayload = (body = {}) => {
  const payload = {};

  PRODUCT_ADMIN_FIELDS.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      payload[field] = body[field];
    }
  });

  ["quantity", "basePrice", "packingWeightKg", "totalWeightKg"].forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(payload, field)) {
      const value = Number(payload[field]);
      payload[field] = Number.isFinite(value) ? value : 0;
    }
  });

  if (Object.prototype.hasOwnProperty.call(payload, "images")) {
    payload.images = Array.isArray(payload.images)
      ? payload.images.filter(Boolean)
      : String(payload.images || "")
          .split(/\r?\n|,/)
          .map((image) => image.trim())
          .filter(Boolean);
  }

  return payload;
};

export const listProductsByAdmin = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const products = await Product.find()
    .populate("createdBy", "name orchardName businessName role")
    .sort({ createdAt: -1 });
  res.json(products);
};

export const createProductByAdmin = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const payload = normalizeProductAdminPayload(req.body);
  if (!payload.title || !payload.fruitName || !payload.variety || !payload.location) {
    return res.status(400).json({ msg: "Product name, category, variety, and location are required" });
  }

  if (!Number.isFinite(payload.quantity) || payload.quantity < 0) {
    return res.status(400).json({ msg: "Stock quantity must be zero or more" });
  }

  if (!Number.isFinite(payload.basePrice) || payload.basePrice < 0) {
    return res.status(400).json({ msg: "Price must be zero or more" });
  }

  if (payload.status && !["AVAILABLE", "IN_AUCTION", "SOLD"].includes(payload.status)) {
    return res.status(400).json({ msg: "Invalid product status" });
  }

  const product = await Product.create({
    ...payload,
    status: payload.status || "AVAILABLE",
    packingType: payload.packingType || "Orchard Growers pack",
    location: payload.location || "Orchard Growers",
  });

  res.status(201).json(product);
};

export const updateProductByAdmin = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const payload = normalizeProductAdminPayload(req.body);
  if (Object.prototype.hasOwnProperty.call(payload, "status")) {
    if (!["AVAILABLE", "IN_AUCTION", "SOLD"].includes(payload.status)) {
      return res.status(400).json({ msg: "Invalid product status" });
    }
  }

  const product = await Product.findByIdAndUpdate(req.params.id, payload, { new: true });
  if (!product) return res.status(404).json({ msg: "Product not found" });

  res.json(product);
};

export const listVerificationRequests = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const requests = await VerificationRequest.find()
    .populate("user", "name orchardName phone email role isVerified accountStatus")
    .populate("adminReviews.admin", "name email role")
    .sort({ createdAt: -1 });

  res.json(requests);
};

export const listKycRequests = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const users = await User.find({
    "kyc.status": { $in: ["COMPLETED", "APPROVED", "REJECTED"] },
  })
    .select("-password -__v")
    .populate("kyc.adminReviews.admin", "name email role")
    .sort({ "kyc.submittedAt": -1, createdAt: -1 });

  res.json(users);
};

export const listOrders = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const orders = await Order.find()
    .populate("items.product", "title fruitName basePrice")
    .populate("product", "title fruitName basePrice")
    .populate("buyer", "name businessName phone email")
    .populate("grower", "name orchardName phone email")
    .sort({ createdAt: -1 });

  res.json(orders);
};

export const reviewKycRequest = async (req, res) => {
  const currentAdmin = requireAdmin(req, res);
  if (!currentAdmin) return;

  const action = String(req.body.action || "").toUpperCase();
  if (!["APPROVE", "REJECT"].includes(action)) {
    return res.status(400).json({ msg: "Invalid KYC review action" });
  }

  const user = await User.findById(req.params.userId);
  if (!user) return res.status(404).json({ msg: "User not found" });
  if (!["COMPLETED", "APPROVED", "REJECTED"].includes(user.kyc?.status)) {
    return res.status(400).json({ msg: "KYC is not completed by user" });
  }

  const adminClass = getAdminClass(currentAdmin.role);
  const existingReview = user.kyc.adminReviews.find(
    (review) =>
      review.admin?.toString() === currentAdmin.id?.toString() ||
      review.adminClass === adminClass
  );

  if (existingReview) {
    existingReview.admin = currentAdmin.id;
    existingReview.adminClass = adminClass;
    existingReview.action = action;
    existingReview.note = req.body.note || "";
    existingReview.reviewedAt = new Date();
  } else {
    user.kyc.adminReviews.push({
      admin: currentAdmin.id,
      adminClass,
      action,
      note: req.body.note || "",
      reviewedAt: new Date(),
    });
  }

  const canFinalizeImmediately = currentAdmin.role === "SUPER_ADMIN";
  if (action === "APPROVE" && (hasDualApproval(user.kyc.adminReviews) || canFinalizeImmediately)) {
    user.kyc.status = "APPROVED";
    user.kyc.decidedBy = currentAdmin.id;
    user.kyc.decidedAt = new Date();
    user.isVerified = true;
    user.accountStatus = "ACTIVE";
  }

  if (action === "REJECT" && (hasDualRejection(user.kyc.adminReviews) || canFinalizeImmediately)) {
    user.kyc.status = "REJECTED";
    user.kyc.decidedBy = currentAdmin.id;
    user.kyc.decidedAt = new Date();
    user.isVerified = false;
  }

  await user.save();
  const populated = await User.findById(user._id)
    .select("-password -__v")
    .populate("kyc.adminReviews.admin", "name email role");

  res.json(populated);
};

export const reviewVerificationRequest = async (req, res) => {
  const currentAdmin = requireAdmin(req, res);
  if (!currentAdmin) return;

  const action = String(req.body.action || "").toUpperCase();
  const allowedActions = ["APPROVE", "REJECT", "DISAPPROVE", "HOLD", "SUSPEND", "TERMINATE"];

  if (!allowedActions.includes(action)) {
    return res.status(400).json({ msg: "Invalid review action" });
  }

  const request = await VerificationRequest.findById(req.params.id);
  if (!request) return res.status(404).json({ msg: "Verification request not found" });

  const existingReview = request.adminReviews.find(
    (review) => review.admin?.toString() === currentAdmin.id?.toString()
  );

  if (existingReview) {
    existingReview.adminClass = getAdminClass(currentAdmin.role);
    existingReview.action = action;
    existingReview.note = req.body.note || "";
    existingReview.reviewedAt = new Date();
  } else {
    request.adminReviews.push({
      admin: currentAdmin.id,
      adminClass: getAdminClass(currentAdmin.role),
      action,
      note: req.body.note || "",
      reviewedAt: new Date(),
    });
  }

  const hasTwoApprovals = hasDualApproval(request.adminReviews);
  const hasTwoRejects = hasDualRejection(request.adminReviews);
  const canFinalizeImmediately = currentAdmin.role === "SUPER_ADMIN";

  if ((action === "APPROVE" && (hasTwoApprovals || canFinalizeImmediately))) {
    request.status = "APPROVED";
    request.decidedBy = currentAdmin.id;
    request.decidedAt = new Date();
    await User.findByIdAndUpdate(request.user, { isVerified: true, accountStatus: "ACTIVE" });
  }

  if (["HOLD", "SUSPEND", "TERMINATE"].includes(action)) {
    request.status = action === "SUSPEND" ? "SUSPENDED" : action === "TERMINATE" ? "TERMINATED" : "HOLD";
    request.decidedBy = currentAdmin.id;
    request.decidedAt = new Date();

    const accountStatus = action === "SUSPEND" ? "SUSPENDED" : action === "TERMINATE" ? "TERMINATED" : "HOLD";
    await User.findByIdAndUpdate(request.user, {
      accountStatus,
      isVerified: false,
      adminNotes: req.body.note || `${request.status} by admin`,
    });
  } else if (action !== "APPROVE" && (hasTwoRejects || canFinalizeImmediately)) {
    request.status = action === "DISAPPROVE" ? "DISAPPROVED" : "REJECTED";
    request.decidedBy = currentAdmin.id;
    request.decidedAt = new Date();
  }

  await request.save();
  const populated = await VerificationRequest.findById(request._id)
    .populate("user", "name orchardName phone email role isVerified accountStatus")
    .populate("adminReviews.admin", "name email role");

  res.json(populated);
};

export const updateVerificationRequestByAdmin = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const allowed = ["orchardName", "ownerName", "location", "phone", "youtubeVideoId"];
  const updates = {};

  allowed.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      updates[field] = String(req.body[field] || "").trim();
    }
  });

  if (!Object.keys(updates).length) {
    return res.status(400).json({ msg: "No request changes supplied" });
  }

  const request = await VerificationRequest.findByIdAndUpdate(req.params.id, updates, { new: true })
    .populate("user", "name orchardName phone email role isVerified accountStatus")
    .populate("adminReviews.admin", "name email role");

  if (!request) return res.status(404).json({ msg: "Verification request not found" });

  res.json(request);
};
