import User from "../models/User.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const otpStore = new Map();
const OTP_TTL_MS = 5 * 60 * 1000;
const TEST_OTP = process.env.TEST_OTP || "345123";
const isTestOtpEnabled = () => process.env.NODE_ENV !== "production";
const DEV_TEST_USERS = [
  {
    name: "OrchardGrowerstestuser",
    email: "orchardgrowerstestuser@test.com",
    phone: "7018108900",
    role: "buyer",
    password: "password123",
    location: "India",
    businessName: "Orchard Growers Test Buyer",
    buyerContactPerson: "OrchardGrowerstestuser",
  },
];

const normalizeIdentifier = (identifier = "") => identifier.trim().toLowerCase();
const isEmail = (identifier) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
const isPhone = (identifier) => /^[0-9+\-\s()]{7,20}$/.test(identifier);
const normalizePhone = (identifier) => identifier.replace(/[^\d+]/g, "");

export const parseIdentifier = (identifier) => {
  const normalized = normalizeIdentifier(identifier);

  if (isEmail(normalized)) {
    return { type: "email", value: normalized };
  }

  if (isPhone(normalized)) {
    return { type: "phone", value: normalizePhone(normalized) };
  }

  return null;
};

const safeUserPayload = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  avatarUrl: user.avatarUrl,
  bannerUrl: user.bannerUrl,
  companyLogoUrl: user.companyLogoUrl,
  role: user.role,
  orchardName: user.orchardName,
  businessName: user.businessName,
  buyerContactPerson: user.buyerContactPerson,
  designation: user.designation,
  lockedAmount: user.lockedAmount,
  gstNumber: user.gstNumber,
  tradeLicenseNumber: user.tradeLicenseNumber,
  logisticsName: user.logisticsName,
  vehicleNumber: user.vehicleNumber,
  licenseNumber: user.licenseNumber,
  location: user.location,
  businessAddressLine1: user.businessAddressLine1,
  businessAddressLine2: user.businessAddressLine2,
  businessAddressLine3: user.businessAddressLine3,
  businessPinCode: user.businessPinCode,
  addressLine1: user.addressLine1,
  addressLine2: user.addressLine2,
  addressLine3: user.addressLine3,
  pinCode: user.pinCode,
  contact: user.contact,
  socialLinks: user.socialLinks,
  kyc: user.kyc,
  isVerified: user.isVerified,
  accountStatus: user.accountStatus,
  createdAt: user.createdAt,
});

const findByParsedIdentifier = (parsed) =>
  User.findOne({ [parsed.type]: parsed.value });

const getDevTestUser = (parsed, password) => {
  return DEV_TEST_USERS.find((user) => {
    const identifierMatches =
      (parsed.type === "email" && user.email === parsed.value) ||
      (parsed.type === "phone" && user.phone === parsed.value);

    return identifierMatches && user.password === password;
  }) || null;
};

export const sendOtp = async (req, res) => {
  try {
    const parsed = parseIdentifier(req.body.identifier);

    if (!parsed) {
      return res.status(400).json({ msg: "Enter a valid email or phone number" });
    }

    const otp = isTestOtpEnabled()
      ? TEST_OTP
      : String(Math.floor(100000 + Math.random() * 900000));
    const key = `${parsed.type}:${parsed.value}`;
    otpStore.set(key, {
      otp,
      expiresAt: Date.now() + OTP_TTL_MS,
      verified: false,
    });

    console.log(`OTP for ${key}: ${otp}`);

    res.json({
      message: `OTP sent to ${parsed.type}`,
      channel: parsed.type,
      devOtp: process.env.NODE_ENV === "production" ? undefined : otp,
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

export const verifyOtp = async (req, res) => {
  try {
    const parsed = parseIdentifier(req.body.identifier);
    const otp = String(req.body.otp || "").trim();

    if (!parsed || !otp) {
      return res.status(400).json({ msg: "Identifier and OTP are required" });
    }

    const key = `${parsed.type}:${parsed.value}`;
    const record = otpStore.get(key);

    if (!record || record.expiresAt < Date.now()) {
      otpStore.delete(key);
      return res.status(400).json({ msg: "OTP expired. Request a new OTP." });
    }

    if (record.otp !== otp) {
      return res.status(400).json({ msg: "Invalid OTP" });
    }

    otpStore.set(key, { ...record, verified: true });

    res.json({
      message: "OTP verified",
      channel: parsed.type,
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

export const isOtpVerified = (parsed) => {
  const key = `${parsed.type}:${parsed.value}`;
  const record = otpStore.get(key);
  return Boolean(record?.verified && record.expiresAt >= Date.now());
};

export const consumeOtpVerification = (parsed) => {
  otpStore.delete(`${parsed.type}:${parsed.value}`);
};

// ================= REGISTER USER =================
export const registerUser = async (req, res) => {
  try {
    const { name, identifier, password } = req.body;
    const parsed = parseIdentifier(identifier);

    if (!name || !parsed || !password) {
      return res.status(400).json({ msg: "Name, email/phone, and password are required" });
    }

    if (!isOtpVerified(parsed)) {
      return res.status(400).json({ msg: "Verify OTP before signup" });
    }

    const existingUser = await findByParsedIdentifier(parsed);

    if (existingUser) {
      return res.status(400).json({ msg: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: name.trim(),
      [parsed.type]: parsed.value,
      password: hashedPassword,
      role: null,
    });

    otpStore.delete(`${parsed.type}:${parsed.value}`);

    res.json({
      message: "User registered successfully",
      user: safeUserPayload(user),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: err.message });
  }
};

// ================= LOGIN USER =================
export const loginUser = async (req, res) => {
  try {
    const { identifier, password } = req.body;
    const parsed = parseIdentifier(identifier);

    if (!parsed || !password) {
      return res.status(400).json({ msg: "Email/phone and password required" });
    }

    if (!isOtpVerified(parsed)) {
      return res.status(400).json({ msg: "Verify OTP before login" });
    }

    let user = await findByParsedIdentifier(parsed);

    if (!user) {
      const devUser = getDevTestUser(parsed, password);
      if (!devUser) {
        return res.status(404).json({ msg: "User not found" });
      }

      user = await User.create({
        name: devUser.name,
        email: devUser.email,
        phone: devUser.phone,
        role: devUser.role,
        password: await bcrypt.hash(devUser.password, 10),
        location: devUser.location,
        businessName: devUser.businessName,
        buyerContactPerson: devUser.buyerContactPerson,
        isVerified: true,
        accountStatus: "ACTIVE",
      });
    }

    if (user.accountStatus && user.accountStatus !== "ACTIVE") {
      return res.status(403).json({ msg: `Account ${String(user.accountStatus).toLowerCase()}. Contact support.` });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ msg: "Invalid password" });
    }

    const accessToken = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    const refreshToken = jwt.sign(
      { id: user._id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: "7d" }
    );

    otpStore.delete(`${parsed.type}:${parsed.value}`);

    res.json({
      message: "Login successful",
      accessToken,
      refreshToken,
      user: safeUserPayload(user),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: err.message });
  }
};

// ================= REFRESH TOKEN =================
export const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ msg: "No refresh token provided" });
    }

    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET
    );

    const user = await User.findById(decoded.id).select("_id role");

    if (!user) {
      return res.status(401).json({ msg: "User not found" });
    }

    const newAccessToken = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    res.json({
      accessToken: newAccessToken,
    });
  } catch (err) {
    console.error("Refresh Error:", err.message);
    return res.status(403).json({ msg: "Invalid refresh token" });
  }
};
