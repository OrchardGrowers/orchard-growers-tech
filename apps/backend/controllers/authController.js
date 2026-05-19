import User from "../models/User.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { isSmtpConfigured, sendOtpEmail } from "../services/mailService.js";
import { isMobileOtpConfigured, sendMobileOtp } from "../services/mobileOtpService.js";

const otpStore = new Map();
const getOtpTtlMs = () => {
  const minutes = Number(process.env.OTP_EXPIRY_MINUTES || 5);
  return (Number.isFinite(minutes) && minutes > 0 ? minutes : 5) * 60 * 1000;
};
const truthyEnv = (value = "") => ["1", "true", "yes"].includes(String(value).trim().toLowerCase());
const isProductionLike = () => {
  const runtime = String(process.env.APP_ENV || process.env.NODE_ENV || "").trim().toLowerCase();
  return runtime === "production" || runtime === "staging";
};
const getLocalTestOtp = () => {
  const testOtp = String(process.env.TEST_OTP || "").trim();
  if (!truthyEnv(process.env.ALLOW_TEST_OTP) || isProductionLike()) return "";
  return /^\d{6}$/.test(testOtp) ? testOtp : "";
};
const createOtp = () => {
  const testOtp = getLocalTestOtp();
  if (testOtp) return { otp: testOtp, isLocalTestOtp: true };

  return {
    otp: String(Math.floor(100000 + Math.random() * 900000)),
    isLocalTestOtp: false,
  };
};
const OTP_PURPOSES = new Set(["auth", "forgot-password"]);

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

const getOtpPurpose = (purpose = "auth") => {
  const normalized = String(purpose || "auth").trim().toLowerCase();
  return OTP_PURPOSES.has(normalized) ? normalized : "auth";
};

const getOtpKey = (parsed, purpose = "auth") => `${getOtpPurpose(purpose)}:${parsed.type}:${parsed.value}`;
const maskOtpKey = (key = "") => {
  const [purpose, type, value = ""] = String(key).split(":");
  if (type === "email") {
    const [name = "", domain = ""] = value.split("@");
    return `${purpose}:${type}:${name.slice(0, 2)}***@${domain}`;
  }

  return `${purpose}:${type}:${value.slice(0, 3)}****${value.slice(-2)}`;
};

const logOtpError = (message, err) => {
  if (err?.code === "MOBILE_OTP_PROVIDER_ERROR") {
    console.error(message, {
      code: err.code,
      providerStatus: err.providerStatus,
      providerBody: err.providerBody,
    });
    return;
  }

  console.error(message, err?.message || err);
};

const storeOtp = ({ parsed, otp, purpose }) => {
  const key = getOtpKey(parsed, purpose);
  otpStore.set(key, {
    otp,
    purpose,
    expiresAt: Date.now() + getOtpTtlMs(),
    verified: false,
    used: false,
  });
  return key;
};

const deliverOtp = async ({ parsed, otp, purpose, isLocalTestOtp }) => {
  if (parsed.type === "email") {
    if (isLocalTestOtp && !isProductionLike() && !isSmtpConfigured()) {
      return;
    }

    await sendOtpEmail({
      to: parsed.value,
      otp,
      purpose: purpose === "forgot-password" ? "password reset" : "account verification",
    });
    return;
  }

  if (isLocalTestOtp && !isProductionLike() && !isMobileOtpConfigured()) {
    return;
  }

  try {
    await sendMobileOtp({ phone: parsed.value, otp });
  } catch (err) {
    if (err.code) throw err;
    const error = new Error("Mobile OTP delivery failed");
    error.code = "MOBILE_OTP_PROVIDER_ERROR";
    error.cause = err;
    throw error;
  }

  if (isProductionLike() && isLocalTestOtp) {
    const error = new Error("Phone OTP delivery is not configured");
    error.code = "PHONE_OTP_NOT_CONFIGURED";
    throw error;
  }
};

const sendOtpForPurpose = async ({ req, res, purpose = "auth", requireExistingUser = false, genericResponse = false }) => {
  const parsed = parseIdentifier(req.body.identifier || req.body.email);

  if (!parsed) {
    return res.status(400).json({ msg: "Enter a valid email or phone number" });
  }

  if (requireExistingUser) {
    const user = await findByParsedIdentifier(parsed);
    if (!user) {
      return genericResponse
        ? res.json({ message: "If the account exists, an OTP has been sent.", channel: parsed.type })
        : res.status(404).json({ msg: "User not found" });
    }
  }

  const { otp, isLocalTestOtp } = createOtp();
  const normalizedPurpose = getOtpPurpose(purpose);
  const key = storeOtp({ parsed, otp, purpose: normalizedPurpose });

  try {
    await deliverOtp({ parsed, otp, purpose: normalizedPurpose, isLocalTestOtp });
  } catch (err) {
    otpStore.delete(key);
    logOtpError("OTP delivery failed:", err);

    if (err.code === "SMTP_NOT_CONFIGURED") {
      return res.status(500).json({ msg: "Email service is not configured" });
    }

    if (err.code === "SMTP_SEND_FAILED") {
      return res.status(502).json({ msg: "Could not send OTP email. Please try again." });
    }

    if (err.code === "PHONE_OTP_NOT_CONFIGURED") {
      return res.status(500).json({ msg: "Phone OTP delivery is not configured" });
    }

    if (err.code === "MOBILE_OTP_NOT_CONFIGURED") {
      return res.status(500).json({ msg: "Mobile OTP service is not configured" });
    }

    if (err.code === "MOBILE_OTP_PROVIDER_UNSUPPORTED") {
      return res.status(500).json({ msg: "Mobile OTP provider is not supported" });
    }

    return res.status(502).json({ msg: "Could not send OTP. Please try again." });
  }

  if (!isProductionLike() && (isLocalTestOtp || parsed.type === "phone")) {
    console.log(`${isLocalTestOtp ? "Local test OTP" : "Local OTP"} for ${maskOtpKey(key)}: ${otp}`);
  } else if (!isProductionLike()) {
    console.log(`OTP delivery accepted for ${maskOtpKey(key)}`);
  }

  return res.json({
    message: genericResponse ? "If the account exists, an OTP has been sent." : `OTP sent to ${parsed.type}`,
    channel: parsed.type,
    devOtp: isLocalTestOtp ? otp : undefined,
  });
};

export const sendOtp = async (req, res) => {
  try {
    return sendOtpForPurpose({ req, res, purpose: "auth" });
  } catch (err) {
    logOtpError("OTP request failed:", err);
    res.status(500).json({ msg: "Could not send OTP" });
  }
};

export const resendOtp = async (req, res) => {
  try {
    return sendOtpForPurpose({ req, res, purpose: getOtpPurpose(req.body.purpose || "auth") });
  } catch (err) {
    logOtpError("OTP resend failed:", err);
    res.status(500).json({ msg: "Could not resend OTP" });
  }
};

export const forgotPasswordOtp = async (req, res) => {
  try {
    return sendOtpForPurpose({
      req,
      res,
      purpose: "forgot-password",
      requireExistingUser: true,
      genericResponse: true,
    });
  } catch (err) {
    logOtpError("Forgot password OTP failed:", err);
    res.status(500).json({ msg: "Could not send password reset OTP" });
  }
};

export const verifyOtp = async (req, res) => {
  try {
    const parsed = parseIdentifier(req.body.identifier);
    const otp = String(req.body.otp || "").trim();
    const purpose = getOtpPurpose(req.body.purpose || "auth");

    if (!parsed || !otp) {
      return res.status(400).json({ msg: "Identifier and OTP are required" });
    }

    const key = getOtpKey(parsed, purpose);
    const record = otpStore.get(key);

    if (!record) {
      return res.status(400).json({ msg: "Invalid OTP" });
    }

    if (record.expiresAt < Date.now()) {
      otpStore.delete(key);
      return res.status(400).json({ msg: "OTP expired. Request a new OTP." });
    }

    if (record.verified && record.used) {
      return res.json({
        message: "OTP already verified",
        channel: parsed.type,
      });
    }

    if (record.otp !== otp) {
      return res.status(400).json({ msg: "Invalid OTP" });
    }

    otpStore.set(key, { ...record, otp: "", verified: true, used: true });

    res.json({
      message: "OTP verified",
      channel: parsed.type,
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

export const isOtpVerified = (parsed) => {
  const key = getOtpKey(parsed, "auth");
  const record = otpStore.get(key);
  if (!record) return false;

  if (record.expiresAt < Date.now()) {
    otpStore.delete(key);
    return false;
  }

  return Boolean(record.verified && record.used);
};

export const consumeOtpVerification = (parsed) => {
  otpStore.delete(getOtpKey(parsed, "auth"));
};

export const resetPasswordWithOtp = async (req, res) => {
  try {
    const parsed = parseIdentifier(req.body.identifier || req.body.email);
    const otp = String(req.body.otp || "").trim();
    const password = String(req.body.password || "");

    if (!parsed || !otp || !password) {
      return res.status(400).json({ msg: "Identifier, OTP, and new password are required" });
    }

    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      return res.status(400).json({ msg: "Password must be at least 8 characters and include a letter and a number" });
    }

    const key = getOtpKey(parsed, "forgot-password");
    const record = otpStore.get(key);

    if (!record) {
      return res.status(400).json({ msg: "Invalid OTP" });
    }

    if (record.expiresAt < Date.now()) {
      otpStore.delete(key);
      return res.status(400).json({ msg: "OTP expired. Request a new OTP." });
    }

    if (record.used || record.verified || record.otp !== otp) {
      return res.status(400).json({ msg: "Invalid OTP" });
    }

    const user = await findByParsedIdentifier(parsed);
    if (!user) {
      otpStore.delete(key);
      return res.status(400).json({ msg: "Invalid OTP" });
    }

    user.password = await bcrypt.hash(password, 10);
    await user.save();
    otpStore.delete(key);

    return res.json({ message: "Password reset successful. Please login." });
  } catch (err) {
    console.error("Password reset failed:", err.message || err);
    return res.status(500).json({ msg: "Could not reset password" });
  }
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

    otpStore.delete(getOtpKey(parsed, "auth"));

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

    const user = await findByParsedIdentifier(parsed);

    if (!user) {
      return res.status(404).json({ msg: "User not found" });
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

    otpStore.delete(getOtpKey(parsed, "auth"));

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
