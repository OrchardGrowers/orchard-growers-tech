import User from "../models/User.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import {
  getResourceType,
  uploadBufferToCloudinary,
} from "../services/cloudinaryService.js";
import {
  consumeOtpVerification,
  isOtpVerified,
  parseIdentifier,
} from "./authController.js";
import { getRoleKycStatus, refreshSettlementEligibility } from "../services/logisticsAssignmentService.js";

const getVerifiedPhone = (contact, user = null, otpVerificationToken = "", platform = "efruitmandi") => {
  const parsed = parseIdentifier(contact);

  if (!parsed || parsed.type !== "phone") {
    return null;
  }

  const trustedPhones = [user?.contact, user?.phone]
    .map((value) => parseIdentifier(value))
    .filter((value) => value?.type === "phone")
    .map((value) => value.value);

  if (trustedPhones.includes(parsed.value)) return parsed;

  const verified =
    isOtpVerified(parsed, platform, "auth", otpVerificationToken) ||
    isOtpVerified(parsed, "efruitmandi", "auth", otpVerificationToken) ||
    isOtpVerified(parsed, "orchardgrowers", "auth", otpVerificationToken);

  if (!verified) return null;

  return parsed;
};

const getUserProfileTypes = (user) => {
  const profiles = new Set(Array.isArray(user.profileTypes) ? user.profileTypes : []);

  if (user.role) profiles.add(user.role);
  if (user.orchardName) profiles.add("grower");
  if (user.businessName || user.buyerContactPerson) profiles.add("buyer");
  if (user.logisticsName || user.vehicleNumber || user.driverName) profiles.add("driver");

  return profiles;
};

const PUBLIC_PROFILE_SELECT = [
  "name",
  "role",
  "activeRole",
  "profileTypes",
  "orchardName",
  "businessName",
  "buyerContactPerson",
  "buyerLocation",
  "location",
  "avatarUrl",
  "buyerAvatarUrl",
  "companyLogoUrl",
  "buyerCompanyLogoUrl",
  "buyerVerified",
  "growerVerified",
  "buyerOgVerified",
  "growerOgVerified",
  "kycByRole",
  "ogVerificationByRole",
  "accountStatus",
  "createdAt",
].join(" ");

const PUBLIC_PROFILE_ROLES = new Set(["grower", "buyer"]);
const SENSITIVE_PUBLIC_LOCATION_PATTERN =
  /\b(address|house|street|road|near|plot|flat|building|village|ward|pin|pincode|post office|orchard location|exact)\b/i;

const cleanPublicText = (value = "") => String(value || "").trim();

const isApprovedStatus = (status = "") =>
  cleanPublicText(status).toUpperCase() === "APPROVED";

const getRoleRecord = (records = {}, role = "") => {
  const normalizedRole = cleanPublicText(role).toLowerCase();
  return normalizedRole ? records?.[normalizedRole] || {} : {};
};

const getPublicLocationFromText = (value = "") => {
  const text = cleanPublicText(value).replace(/\b\d{6}\b/g, "").replace(/\s+/g, " ");
  if (!text) return "";

  const parts = text
    .split(",")
    .map(cleanPublicText)
    .filter(Boolean)
    .filter((part) => !/\d/.test(part))
    .filter((part) => !SENSITIVE_PUBLIC_LOCATION_PATTERN.test(part));

  if (parts.length) return parts.slice(-3).join(", ");
  if (!/\d/.test(text) && !SENSITIVE_PUBLIC_LOCATION_PATTERN.test(text) && text.length <= 42) {
    return text;
  }
  return "";
};

const getPublicLocationFromParts = (...parts) =>
  parts
    .map(cleanPublicText)
    .filter(Boolean)
    .filter((part) => !/\d/.test(part))
    .filter((part) => !SENSITIVE_PUBLIC_LOCATION_PATTERN.test(part))
    .slice(0, 3)
    .join(", ");

const buildPublicProfileQuery = (role) => {
  const roleClauses = [
    { role },
    { activeRole: role },
    { profileTypes: role },
  ];

  if (role === "grower") {
    roleClauses.push({ orchardName: { $exists: true, $ne: "" } });
  }

  if (role === "buyer") {
    roleClauses.push(
      { businessName: { $exists: true, $ne: "" } },
      { buyerContactPerson: { $exists: true, $ne: "" } }
    );
  }

  return {
    $and: [
      { $or: [{ accountStatus: "ACTIVE" }, { accountStatus: { $exists: false } }] },
      { $or: roleClauses },
    ],
  };
};

const toPublicProfile = (user = {}, role = "") => {
  const roleKyc = getRoleRecord(user.kycByRole, role);
  const roleOg = getRoleRecord(user.ogVerificationByRole, role);
  const district = cleanPublicText(roleKyc.district);
  const state = cleanPublicText(roleKyc.state);
  const mainLocation =
    getPublicLocationFromParts(district, state) ||
    getPublicLocationFromText(role === "buyer" ? user.buyerLocation || user.location : user.location);

  const roleLogo =
    role === "buyer"
      ? cleanPublicText(user.buyerCompanyLogoUrl) ||
        cleanPublicText(user.buyerAvatarUrl) ||
        cleanPublicText(user.companyLogoUrl) ||
        cleanPublicText(user.avatarUrl)
      : cleanPublicText(user.companyLogoUrl) ||
        cleanPublicText(user.avatarUrl) ||
        cleanPublicText(user.buyerCompanyLogoUrl) ||
        cleanPublicText(user.buyerAvatarUrl);

  const isKycVerified = Boolean(
    (role === "buyer" && user.buyerVerified) ||
      (role === "grower" && user.growerVerified) ||
      isApprovedStatus(roleKyc.status)
  );
  const isOgVerified = Boolean(
    (role === "buyer" && user.buyerOgVerified) ||
      (role === "grower" && user.growerOgVerified) ||
      (roleOg.requestId && isApprovedStatus(roleOg.status))
  );

  return {
    _id: user._id,
    role,
    activeRole: role,
    profileTypes: [role],
    businessType: role,
    name: user.name || "",
    companyName: role === "grower" ? user.orchardName || "" : user.businessName || "",
    orchardName: role === "grower" ? user.orchardName || "" : "",
    businessName: role === "buyer" ? user.businessName || "" : "",
    buyerContactPerson: role === "buyer" ? user.buyerContactPerson || "" : "",
    logoUrl: roleLogo,
    avatarUrl: roleLogo,
    mainLocation,
    district,
    state,
    location: mainLocation,
    isKycVerified,
    isOgVerified,
    isTrusted: isOgVerified,
    createdAt: user.createdAt,
  };
};

const hasGrowerKycPayload = (body = {}, files = {}) =>
  Boolean(
    String(body.roleType || "").trim().toLowerCase() === "grower" ||
      String(body.orchardName || "").trim() ||
      String(body.orchardLocation || "").trim() ||
      String(body.udyanCardNo || "").trim() ||
      files?.udyanCardFile?.[0]
  );

const joinAddressParts = (...parts) =>
  parts
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(", ");

const getBuyerPremisesAddress = (user = {}) =>
  user.buyerLocation ||
  joinAddressParts(
    user.businessAddressLine1,
    user.businessAddressLine2,
    user.businessAddressLine3
  ) ||
  user.location ||
  "";

const getGrowerPremisesAddress = (user = {}) =>
  joinAddressParts(
    user.addressLine1,
    user.addressLine2,
    user.addressLine3,
    user.location
  ) || user.location || "";

const getKycAddressFallback = (user = {}, roleType = "") => {
  if (roleType === "buyer") return getBuyerPremisesAddress(user);
  if (roleType === "grower") return getGrowerPremisesAddress(user);
  return user.location || "";
};

const getKycPinCodeFallback = (user = {}, roleType = "") => {
  if (roleType === "buyer") return user.buyerPinCode || user.businessPinCode || user.pinCode || "";
  return user.pinCode || "";
};

const VALID_KYC_ROLE_TYPES = new Set(["buyer", "grower", "driver"]);

const normalizeKycStatus = (status = "") => {
  const normalized = String(status || "").trim().toUpperCase();
  if (normalized === "SUBMITTED") return "PENDING";
  return normalized || "NOT_SUBMITTED";
};

const getRoleKyc = (user = {}, roleType = "") => {
  const role = String(roleType || "").trim().toLowerCase();
  const roleKyc = user.kycByRole?.[role];
  if (roleKyc && Object.keys(roleKyc.toObject?.() || roleKyc).length) return roleKyc.toObject?.() || roleKyc;

  const legacyKyc = user.kyc?.toObject?.() || user.kyc || {};
  const legacyRole = String(legacyKyc.roleType || "").trim().toLowerCase();
  if (legacyRole === role || (!legacyRole && role && Object.keys(legacyKyc).some((key) => legacyKyc[key]))) {
    return legacyKyc;
  }

  return {};
};

const resolveRequestedKycRole = (user = {}, requestedRoleType = "") => {
  const profiles = getUserProfileTypes(user);
  const requestedRole = String(requestedRoleType || "").trim().toLowerCase();
  if (VALID_KYC_ROLE_TYPES.has(requestedRole) && (profiles.size === 0 || profiles.has(requestedRole))) return requestedRole;
  if (profiles.has("buyer")) return "buyer";
  if (profiles.has("grower")) return "grower";
  if (profiles.has("driver")) return "driver";
  return "buyer";
};

const parseKycDocuments = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const normalizeKycDocument = (doc = {}, userId = "", roleType = "") => {
  const url = String(doc.url || doc.secure_url || "").trim();
  if (!url) return null;
  return {
    label: String(doc.label || doc.field || "").trim(),
    url,
    publicId: String(doc.publicId || doc.public_id || "").trim(),
    resourceType: String(doc.resourceType || doc.resource_type || "").trim(),
    originalFilename: String(doc.originalFilename || doc.original_filename || doc.fileName || "").trim(),
    sizeBytes: Number(doc.sizeBytes || doc.bytes || 0) || 0,
    mimeType: String(doc.mimeType || doc.mimetype || "").trim(),
    roleType,
    uploadedBy: userId,
    uploadedAt: doc.uploadedAt || new Date(),
  };
};

const KYC_DOCUMENT_FIELD_BY_LABEL = {
  idProof: "idProofImage",
  idProofImage: "idProofImage",
  aadhaarCard: "aadhaarCardFileUrl",
  aadhaarCardFile: "aadhaarCardFileUrl",
  pan: "panImage",
  panImage: "panImage",
  gst: "gstCertificate",
  gstCertificate: "gstCertificate",
  passbook: "passbookFileUrl",
  passbookFile: "passbookFileUrl",
  bankProof: "passbookFileUrl",
  udyanCard: "udyanCardFileUrl",
  udyanCardFile: "udyanCardFileUrl",
  drivingLicense: "drivingLicenseImage",
  drivingLicenseImage: "drivingLicenseImage",
};

const getAvailableRoles = (user = {}) => Array.from(getUserProfileTypes(user)).filter((role) => VALID_KYC_ROLE_TYPES.has(role));

const isAadhaarProof = (value = "") => String(value || "").trim().toLowerCase() === "aadhaar";
const normalizeAadhaar = (value = "") => String(value || "").replace(/\D/g, "").slice(0, 12);
const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

const getAllowedCreateRoles = (roles = []) => {
  const roleSet = new Set(roles);
  return ["grower", "buyer", "driver"].filter((role) => {
    if (roleSet.has(role)) return false;
    if (role === "buyer" && roleSet.has("driver")) return false;
    if (role === "driver" && roleSet.has("buyer")) return false;
    return true;
  });
};

const getRoleKycSummary = (user = {}, roleType = "") => {
  const kyc = getRoleKyc(user, roleType);
  const status = normalizeKycStatus(kyc.status).toLowerCase();
  return {
    roleType: roleType === "driver" ? "logistic" : roleType,
    exists: true,
    profileId: `${user._id}:${roleType}`,
    kycStatus: status,
    kycVerified: status === "approved" || Boolean(roleType === "buyer" ? user.buyerVerified : roleType === "grower" ? user.growerVerified : user.driverVerified),
    verificationRequestId: kyc.submittedAt ? `${user._id}:${roleType}` : "",
    status: user.accountStatus || "ACTIVE",
  };
};

export const getPublicProfiles = async (req, res) => {
  try {
    const role = cleanPublicText(req.query.role).toLowerCase();
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 30);
    const roles = PUBLIC_PROFILE_ROLES.has(role) ? [role] : Array.from(PUBLIC_PROFILE_ROLES);

    const profilesByRole = await Promise.all(
      roles.map(async (profileRole) => {
        const users = await User.find(buildPublicProfileQuery(profileRole))
          .select(PUBLIC_PROFILE_SELECT)
          .sort({ createdAt: -1, _id: -1 })
          .limit(limit)
          .lean();

        return users.map((user) => toPublicProfile(user, profileRole));
      })
    );

    const profiles = profilesByRole.flat().sort((a, b) => {
      const bTime = new Date(b.createdAt || 0).getTime();
      const aTime = new Date(a.createdAt || 0).getTime();
      return bTime - aTime;
    });

    res.json({
      role: role || "all",
      count: profiles.length,
      profiles: profiles.slice(0, roles.length === 1 ? limit : limit * roles.length),
    });
  } catch (err) {
    console.error("Get public profiles error:", err);
    res.status(500).json({ msg: "Unable to load public profiles" });
  }
};

export const getMyRoles = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password -__v");
    if (!user) return res.status(404).json({ msg: "User not found" });

    const roles = getAvailableRoles(user);
    const activeRole = resolveRequestedKycRole(user, user.activeRole || user.role || roles[0] || "");
    res.json({
      userId: user._id,
      phone: user.phone || user.contact,
      activeRole: activeRole === "driver" ? "logistic" : activeRole,
      roles: roles.map((role) => getRoleKycSummary(user, role)),
      allowedCreateRoles: getAllowedCreateRoles(roles).map((role) => (role === "driver" ? "logistic" : role)),
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

export const switchMyRole = async (req, res) => {
  try {
    const requestedRole = String(req.body.roleType || req.body.role || "").trim().toLowerCase();
    const role = requestedRole === "logistic" ? "driver" : requestedRole;
    if (!VALID_KYC_ROLE_TYPES.has(role)) return res.status(400).json({ msg: "Invalid role" });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: "User not found" });

    const roles = getAvailableRoles(user);
    const currentRole = resolveRequestedKycRole(user, user.activeRole || user.role || roles[0] || "");
    if (!roles.includes(role)) return res.status(400).json({ msg: "Requested role profile does not exist" });
    if (currentRole === role) return res.status(400).json({ msg: "This role is already active" });

    user.activeRole = role;
    await user.save();
    const safeUser = await User.findById(user._id).select("-password -__v");
    res.json({ success: true, activeRole: role === "driver" ? "logistic" : role, user: safeUser });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

export const createRoleProfile = async (req, res) => {
  req.body.role = String(req.body.roleType || req.body.role || "").trim().toLowerCase() === "logistic" ? "driver" : req.body.role || req.body.roleType;
  return setUserRole(req, res);
};

// ================= SET ROLE =================
export const setUserRole = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      role,
      orchardName,
      businessName,
      buyerContactPerson,
      buyerLocation,
      buyerPinCode,
      designation,
      gstNumber,
      tradeLicenseNumber,
      logisticsName,
      logisticsOwnerName,
      logisticsOwnerContact,
      driverName,
      driverContact,
      ownerIsDriver,
      vehicleNumber,
      licenseNumber,
      location,
      addressLine1,
      addressLine2,
      addressLine3,
      pinCode,
      mapLatitude,
      mapLongitude,
      googleMapUrl,
      contact,
      otpVerificationToken = "",
      assignmentToken = "",
      platform = "efruitmandi",
      allowUpdate = false,
    } = req.body;

    // ✅ Validate role
    const allowedRoles = ["grower", "buyer", "driver"];
    if (!role || !allowedRoles.includes(role)) {
      return res.status(400).json({ msg: "Invalid role" });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    // 🔒 Prevent role change after set (important for integrity)
    const profileTypes = getUserProfileTypes(user);
    const profileAlreadyExists = profileTypes.has(role);

    if (profileAlreadyExists && !allowUpdate) {
      const safeUser = await User.findById(userId).select("-password -__v");
      return res.status(409).json({
        success: false,
        msg: "Profile already exists",
        profileCreated: false,
        role,
        user: safeUser,
      });
    }

    if (role === "buyer" && profileTypes.has("driver")) {
      return res.status(400).json({
        msg: "Buyer profile cannot be added because this account is already registered as Driver.",
      });
    }

    if (role === "driver" && profileTypes.has("buyer")) {
      return res.status(400).json({
        msg: "Driver profile cannot be added because this account is already registered as Buyer.",
      });
    }

    // ✅ Assign role
    let verifiedPhone = null;

    // ✅ Role-specific validation
    if (role === "grower") {
      if (!orchardName || !contact) {
        return res.status(400).json({
          msg: "Orchard name and verified contact number are required",
        });
      }

      verifiedPhone = getVerifiedPhone(contact, profileAlreadyExists ? user : null, otpVerificationToken, platform);
      if (!verifiedPhone) {
        return res.status(400).json({
          msg: "Verify contact number OTP before grower registration",
        });
      }

      user.role = user.role || role;
      user.orchardName = orchardName.trim();
      user.contact = verifiedPhone.value;
      if (designation) user.designation = designation.trim();
    }

    if (role === "buyer") {
      const nextBuyerLocation = buyerLocation || location;
      const nextBuyerPinCode = buyerPinCode || pinCode;
      if (!businessName || !buyerContactPerson || !nextBuyerLocation || !contact) {
        return res.status(400).json({
          msg: "Company name, contact person, location, and contact number are required",
        });
      }

      verifiedPhone = getVerifiedPhone(contact, profileAlreadyExists ? user : null, otpVerificationToken, platform);
      if (!verifiedPhone) {
        return res.status(400).json({
          msg: "Verify contact number OTP before buyer registration",
        });
      }

      user.role = user.role || role;
      user.businessName = businessName.trim();
      user.buyerContactPerson = buyerContactPerson.trim();
      user.buyerLocation = nextBuyerLocation.trim();
      if (nextBuyerPinCode) user.buyerPinCode = nextBuyerPinCode.trim();
      if (designation) user.designation = designation.trim();
      user.contact = verifiedPhone.value;
      if (gstNumber) user.gstNumber = gstNumber.trim();
      if (tradeLicenseNumber) {
        user.tradeLicenseNumber = tradeLicenseNumber.trim();
      }
    }

    if (role === "driver") {
      if (!logisticsName || !vehicleNumber || !contact) {
        return res.status(400).json({
          msg: "Logistics name, vehicle number, and contact are required",
        });
      }
      user.role = user.role || role;
      user.logisticsName = logisticsName.trim();
      user.logisticsOwnerName = (logisticsOwnerName || logisticsName).trim();
      user.logisticsOwnerContact = (logisticsOwnerContact || contact).trim();
      user.ownerIsDriver = Boolean(ownerIsDriver);
      user.driverName = (ownerIsDriver ? logisticsOwnerName || logisticsName : driverName || logisticsName).trim();
      user.driverContact = (ownerIsDriver ? logisticsOwnerContact || contact : driverContact || contact).trim();
      user.vehicleNumber = vehicleNumber.trim();
      user.contact = contact.trim();
      if (licenseNumber) user.licenseNumber = licenseNumber.trim();
    }

    // ✅ Optional fields (only update if provided)
    if (location) user.location = location.trim();
    if (addressLine1) user.addressLine1 = addressLine1.trim();
    if (addressLine2) user.addressLine2 = addressLine2.trim();
    if (addressLine3) user.addressLine3 = addressLine3.trim();
    if (pinCode) user.pinCode = pinCode.trim();
    if (mapLatitude !== undefined && mapLatitude !== null && mapLatitude !== "") {
      const latitude = Number(mapLatitude);
      if (Number.isFinite(latitude)) user.mapLatitude = latitude;
    }
    if (mapLongitude !== undefined && mapLongitude !== null && mapLongitude !== "") {
      const longitude = Number(mapLongitude);
      if (Number.isFinite(longitude)) user.mapLongitude = longitude;
    }
    if (googleMapUrl) user.googleMapUrl = googleMapUrl.trim();

    profileTypes.add(role);
    user.profileTypes = Array.from(profileTypes);
    user.activeRole = role;

    await user.save();

    if (role === "driver" && assignmentToken) {
      const order = await Order.findOne({ "logisticsAssignment.invitationToken": String(assignmentToken).trim() });
      if (order && ["AWAITING_LOGISTICS_REGISTRATION", "UNREGISTERED_LOGISTICS"].includes(order.logisticsAssignment?.status)) {
        order.logisticsAssignment.status = "LOGISTICS_REGISTERED";
        order.logisticsAssignment.assignedLogisticsAccount = user._id;
        order.logisticsAssignment.registrationStatus = "REGISTERED";
        order.logisticsAssignment.kycStatus = getRoleKycStatus(user, "driver") || (user.driverVerified ? "APPROVED" : "NOT_SUBMITTED");
        order.logisticsAssignment.notifications.app = true;
        await refreshSettlementEligibility(order, {
          grower: await User.findById(order.grower).lean(),
          logistics: user.toObject ? user.toObject() : user,
        });
        await order.save();
      }
    }

    if (verifiedPhone && otpVerificationToken) {
      consumeOtpVerification(verifiedPhone, platform, "auth", otpVerificationToken);
    }

    // 🔐 Return safe user data only
    const safeUser = await User.findById(userId).select("-password -__v");

    res.json({
      success: true,
      profileCreated: !profileAlreadyExists,
      role,
      message: profileAlreadyExists ? "Profile updated successfully" : "Profile created successfully",
      user: safeUser,
    });

  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};


// ================= GET PROFILE =================
export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select("-password -__v");

    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    res.json(user);

  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

export const getMyKyc = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password -__v");
    if (!user) return res.status(404).json({ msg: "User not found" });
    const roleType = resolveRequestedKycRole(user, req.query.roleType || req.query.role || "");
    const roleKyc = getRoleKyc(user, roleType);
    const kyc = {
      ...roleKyc,
      roleType,
      status: normalizeKycStatus(roleKyc.status),
    };

    res.json({
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        phone: user.phone || user.contact,
        email: user.email,
        role: user.role,
        profileTypes: user.profileTypes || [],
        orchardName: user.orchardName,
        businessName: user.businessName,
        logisticsName: user.logisticsName,
        location: user.location,
        pinCode: user.pinCode,
        buyerLocation: user.buyerLocation,
        buyerPinCode: user.buyerPinCode,
        businessAddressLine1: user.businessAddressLine1,
        businessAddressLine2: user.businessAddressLine2,
        businessAddressLine3: user.businessAddressLine3,
        businessPinCode: user.businessPinCode,
        addressLine1: user.addressLine1,
        addressLine2: user.addressLine2,
        addressLine3: user.addressLine3,
        buyerOgVerified: user.buyerOgVerified,
        growerOgVerified: user.growerOgVerified,
        driverOgVerified: user.driverOgVerified,
        ogVerificationByRole: user.ogVerificationByRole,
      },
      kyc,
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// ================= UPDATE BASIC PROFILE =================
export const updateProfile = async (req, res) => {
  try {
    const {
      location,
      businessAddressLine1,
      businessAddressLine2,
      businessAddressLine3,
      businessPinCode,
      addressLine1,
      addressLine2,
      addressLine3,
      pinCode,
      name,
      designation,
      orchardName,
      businessName,
      buyerContactPerson,
      buyerLocation,
      buyerPinCode,
      logisticsName,
      phone,
      contact,
      email,
      socialLinks,
    } = req.body;
    const updates = {};

    if (typeof location === "string") {
      updates.location = location.trim();
    }
    if (typeof name === "string" && name.trim()) {
      updates.name = name.trim();
    }
    if (typeof designation === "string") {
      updates.designation = designation.trim();
    }
    if (typeof orchardName === "string") {
      updates.orchardName = orchardName.trim();
    }
    if (typeof businessName === "string") {
      updates.businessName = businessName.trim();
    }
    if (typeof buyerContactPerson === "string") {
      updates.buyerContactPerson = buyerContactPerson.trim();
    }
    if (typeof buyerLocation === "string") {
      updates.buyerLocation = buyerLocation.trim();
    }
    if (typeof buyerPinCode === "string") {
      updates.buyerPinCode = buyerPinCode.trim();
    }
    if (typeof logisticsName === "string") {
      updates.logisticsName = logisticsName.trim();
    }
    if (typeof businessAddressLine1 === "string") {
      updates.businessAddressLine1 = businessAddressLine1.trim();
    }
    if (typeof businessAddressLine2 === "string") {
      updates.businessAddressLine2 = businessAddressLine2.trim();
    }
    if (typeof businessAddressLine3 === "string") {
      updates.businessAddressLine3 = businessAddressLine3.trim();
    }
    if (typeof businessPinCode === "string") {
      updates.businessPinCode = businessPinCode.trim();
    }
    if (typeof addressLine1 === "string") {
      updates.addressLine1 = addressLine1.trim();
    }
    if (typeof addressLine2 === "string") {
      updates.addressLine2 = addressLine2.trim();
    }
    if (typeof addressLine3 === "string") {
      updates.addressLine3 = addressLine3.trim();
    }
    if (typeof pinCode === "string") {
      updates.pinCode = pinCode.trim();
    }
    if (typeof email === "string" && email.trim()) {
      const parsedEmail = parseIdentifier(email);

      if (!parsedEmail || parsedEmail.type !== "email" || !isOtpVerified(parsedEmail)) {
        return res.status(400).json({ msg: "Verify email OTP before saving" });
      }

      updates.email = parsedEmail.value;
      consumeOtpVerification(parsedEmail);
    }
    const contactNumber = typeof phone === "string" ? phone : contact;
    if (typeof contactNumber === "string" && contactNumber.trim()) {
      const parsedPhone = parseIdentifier(contactNumber);

      if (!parsedPhone || parsedPhone.type !== "phone" || !isOtpVerified(parsedPhone)) {
        return res.status(400).json({ msg: "Verify contact number OTP before saving" });
      }

      updates.phone = parsedPhone.value;
      consumeOtpVerification(parsedPhone);
    }
    if (socialLinks && typeof socialLinks === "object") {
      const currentUser = await User.findById(req.user.id).select("socialLinks");
      const currentSocialLinks = currentUser?.socialLinks?.toObject?.() || {};
      updates.socialLinks = {
        google: sanitizeSocialLink(socialLinks.google, currentSocialLinks.google),
        facebook: sanitizeSocialLink(socialLinks.facebook, currentSocialLinks.facebook),
        twitter: sanitizeSocialLink(socialLinks.twitter, currentSocialLinks.twitter),
      };
    }

    const user = await User.findByIdAndUpdate(req.user.id, updates, {
      new: true,
    }).select("-password -__v");

    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

const sanitizeSocialLink = (value, fallback = "") => {
  if (typeof value !== "string") return fallback || "";
  return value.trim();
};

// ================= UPDATE PROFILE MEDIA =================
export const updateProfileMedia = async (req, res) => {
  try {
    const { avatarUrl, bannerUrl, companyLogoUrl } = req.body;
    const profileMode = String(req.body.profileMode || "").trim().toLowerCase();
    const updates = {};
    const avatarFile = req.files?.avatar?.[0] || req.files?.avatarUrl?.[0];
    const bannerFile = req.files?.banner?.[0] || req.files?.bannerUrl?.[0];
    const companyLogoFile =
      req.files?.companyLogo?.[0] || req.files?.companyLogoUrl?.[0];
    const profileTypes = new Set(req.user?.profileTypes || []);
    if (req.user?.role) profileTypes.add(req.user.role);
    const activeProfileMode =
      profileMode === "buyer" && profileTypes.has("buyer")
        ? "buyer"
        : profileMode === "grower" && profileTypes.has("grower")
          ? "grower"
          : profileMode === "driver" && profileTypes.has("driver")
            ? "driver"
            : profileTypes.has("driver")
              ? "driver"
              : profileTypes.has("buyer")
                ? "buyer"
                : "grower";
    const profileFolder = activeProfileMode === "driver"
      ? "efruitmandi/drivers"
      : activeProfileMode === "buyer"
        ? "efruitmandi/buyers"
        : "efruitmandi/growers";
    const uploadProfileFile = (file) =>
      uploadBufferToCloudinary(file, {
        folder: profileFolder,
        resourceType: "image",
      });

    if (avatarFile) {
      const uploaded = await uploadProfileFile(avatarFile);
      updates[activeProfileMode === "buyer" ? "buyerAvatarUrl" : "avatarUrl"] = uploaded.secure_url;
    } else if (typeof avatarUrl === "string" && !avatarUrl.startsWith("data:")) {
      updates[activeProfileMode === "buyer" ? "buyerAvatarUrl" : "avatarUrl"] = avatarUrl;
    }

    if (bannerFile) {
      const uploaded = await uploadProfileFile(bannerFile);
      updates[activeProfileMode === "buyer" ? "buyerBannerUrl" : "bannerUrl"] = uploaded.secure_url;
    } else if (typeof bannerUrl === "string" && !bannerUrl.startsWith("data:")) {
      updates[activeProfileMode === "buyer" ? "buyerBannerUrl" : "bannerUrl"] = bannerUrl;
    }

    if (companyLogoFile) {
      const uploaded = await uploadProfileFile(companyLogoFile);
      updates[activeProfileMode === "buyer" ? "buyerCompanyLogoUrl" : "companyLogoUrl"] = uploaded.secure_url;
    } else if (
      typeof companyLogoUrl === "string" &&
      !companyLogoUrl.startsWith("data:")
    ) {
      updates[activeProfileMode === "buyer" ? "buyerCompanyLogoUrl" : "companyLogoUrl"] = companyLogoUrl;
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({ msg: "No valid profile image provided" });
    }

    const user = await User.findByIdAndUpdate(req.user.id, updates, {
      new: true,
    }).select("-password -__v");

    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// ================= UPDATE KYC =================
export const updateKyc = async (req, res) => {
  try {
    const existingUser = await User.findById(req.user.id).select("-password -__v");

    if (!existingUser) {
      return res.status(404).json({ msg: "User not found" });
    }

    const submittedRoleType = resolveRequestedKycRole(existingUser, req.body.roleType || req.body.role || "");
    const existingKyc = getRoleKyc(existingUser, submittedRoleType);
    const existingKycStatus = normalizeKycStatus(existingKyc.status);
    if (existingKycStatus === "APPROVED") {
      return res.status(400).json({ msg: "KYC already approved." });
    }

    if (
      ["PENDING", "UNDER_REVIEW", "COMPLETED"].includes(existingKycStatus) &&
      !["REJECTED", "CORRECTION_REQUIRED"].includes(existingKycStatus) &&
      Object.keys(existingKyc).some((key) => existingKyc[key])
    ) {
      return res.status(400).json({ msg: "Only rejected or correction-required KYC can be edited." });
    }

    const udyanCardFile = req.files?.udyanCardFile?.[0];
    const passbookFile = req.files?.passbookFile?.[0];
    const aadhaarCardFile = req.files?.aadhaarCardFile?.[0];
    const idProofImage = req.files?.idProofImage?.[0] || aadhaarCardFile;
    const panImage = req.files?.panImage?.[0];
    const gstCertificate = req.files?.gstCertificate?.[0];
    const drivingLicenseImage = req.files?.drivingLicenseImage?.[0];
    const uploadKycFile = (file) =>
      uploadBufferToCloudinary(file, {
        folder: "efruitmandi/kyc",
        resourceType: getResourceType(file),
      });
    const roleTypes = new Set(getUserProfileTypes(existingUser));
    const explicitBodyRoleType = String(req.body.roleType || submittedRoleType || "").trim().toLowerCase();
    const inferredBodyRoleType = hasGrowerKycPayload(req.body, req.files) ? "grower" : "";
    const requestedRoleType = String(
      ["buyer", "grower", "driver"].includes(explicitBodyRoleType)
        ? explicitBodyRoleType
        : inferredBodyRoleType || existingKyc.roleType || existingUser.role || ""
    )
      .trim()
      .toLowerCase();
    const ownsRequestedRoleType = roleTypes.size === 0 || roleTypes.has(requestedRoleType);
    const roleType = ["buyer", "grower", "driver"].includes(requestedRoleType) && ownsRequestedRoleType
      ? requestedRoleType
      : roleTypes.has("grower")
        ? "grower"
        : roleTypes.has("driver")
          ? "driver"
          : "buyer";

    const rawIdProofType = String(req.body.idProofType || existingKyc.idProofType || "Aadhaar").trim();
    const rawIdProofNumber = String(req.body.idProofNumber || existingKyc.idProofNumber || req.body.aadhaarCardNo || existingKyc.aadhaarCardNo || "").trim();
    const normalizedAadhaar = normalizeAadhaar(req.body.aadhaarCardNo || rawIdProofNumber);
    const rawPanNumber = String(req.body.panNumber || existingKyc.panNumber || "").trim().toUpperCase();

    const kyc = {
      ...existingKyc,
      roleType,
      fullName: String(req.body.fullName || existingKyc.fullName || existingUser.name || "").trim(),
      phone: String(req.body.phone || existingKyc.phone || existingUser.contact || existingUser.phone || "").trim(),
      email: String(req.body.email || existingKyc.email || existingUser.email || "").trim().toLowerCase(),
      address: String(req.body.address || existingKyc.address || getKycAddressFallback(existingUser, roleType)).trim(),
      district: String(req.body.district || existingKyc.district || "").trim(),
      state: String(req.body.state || existingKyc.state || "").trim(),
      pinCode: String(req.body.pinCode || existingKyc.pinCode || getKycPinCodeFallback(existingUser, roleType)).trim(),
      idProofType: rawIdProofType,
      idProofNumber: isAadhaarProof(rawIdProofType) ? normalizedAadhaar : rawIdProofNumber,
      panNumber: rawPanNumber,
      gstNumber: String(req.body.gstNumber || existingKyc.gstNumber || existingUser.gstNumber || "").trim().toUpperCase(),
      bankAccountHolderName: String(req.body.bankAccountHolderName || existingKyc.bankAccountHolderName || existingUser.name || "").trim(),
      bankName: String(req.body.bankName || existingKyc.bankName || "").trim(),
      accountNumber: String(req.body.accountNumber || existingKyc.accountNumber || req.body.bankAccountNo || existingKyc.bankAccountNo || "").trim(),
      upiId: String(req.body.upiId || existingKyc.upiId || "").trim(),
      orchardName: String(req.body.orchardName || existingKyc.orchardName || existingUser.orchardName || "").trim(),
      orchardLocation: String(req.body.orchardLocation || existingKyc.orchardLocation || getGrowerPremisesAddress(existingUser)).trim(),
      vehicleNumber: String(req.body.vehicleNumber || existingKyc.vehicleNumber || existingUser.vehicleNumber || "").trim().toUpperCase(),
      drivingLicenseNumber: String(req.body.drivingLicenseNumber || existingKyc.drivingLicenseNumber || existingUser.licenseNumber || "").trim().toUpperCase(),
      udyanCardNo: String(req.body.udyanCardNo || existingKyc.udyanCardNo || "")
        .trim()
        .toUpperCase(),
      bankAccountNo: String(req.body.bankAccountNo || existingKyc.bankAccountNo || "").trim(),
      ifscCode: String(req.body.ifscCode || existingKyc.ifscCode || "")
        .trim()
        .toUpperCase(),
      aadhaarCardNo: isAadhaarProof(rawIdProofType) ? normalizedAadhaar : String(req.body.aadhaarCardNo || existingKyc.aadhaarCardNo || "").trim(),
      status: "PENDING",
      adminRemarks: "",
      submittedAt: new Date(),
    };

    if (udyanCardFile) kyc.udyanCardFileUrl = (await uploadKycFile(udyanCardFile)).secure_url;
    if (passbookFile) kyc.passbookFileUrl = (await uploadKycFile(passbookFile)).secure_url;
    if (aadhaarCardFile) kyc.aadhaarCardFileUrl = (await uploadKycFile(aadhaarCardFile)).secure_url;
    if (idProofImage) kyc.idProofImage = (await uploadKycFile(idProofImage)).secure_url;
    if (panImage) kyc.panImage = (await uploadKycFile(panImage)).secure_url;
    if (gstCertificate) kyc.gstCertificate = (await uploadKycFile(gstCertificate)).secure_url;
    if (drivingLicenseImage) kyc.drivingLicenseImage = (await uploadKycFile(drivingLicenseImage)).secure_url;

    const uploadedDocuments = parseKycDocuments(req.body.documents)
      .map((doc) => normalizeKycDocument(doc, req.user.id, roleType))
      .filter(Boolean);
    uploadedDocuments.forEach((doc) => {
      const kycField = KYC_DOCUMENT_FIELD_BY_LABEL[doc.label];
      if (kycField) kyc[kycField] = doc.url;
    });
    if (uploadedDocuments.length) {
      const previousDocuments = Array.isArray(existingKyc.documents) ? existingKyc.documents : [];
      const byLabel = new Map(previousDocuments.map((doc) => [doc.label, doc]));
      uploadedDocuments.forEach((doc) => byLabel.set(doc.label, doc));
      kyc.documents = Array.from(byLabel.values());
    }

    const fieldErrors = {};
    if (!kyc.roleType) fieldErrors.roleType = "Role type is required.";
    if (!kyc.fullName) fieldErrors.fullName = "Full name is required.";
    if (!kyc.phone) fieldErrors.phone = "Phone is required.";
    if (!kyc.address) fieldErrors.address = roleType === "buyer" ? "Buyer premises address is required." : "Address is required.";
    if (!kyc.pinCode) fieldErrors.pinCode = "PIN code is required.";
    if (!kyc.idProofType) fieldErrors.idProofType = "ID proof type is required.";
    if (!kyc.idProofNumber) fieldErrors.idProofNumber = "ID proof number is required.";
    if (isAadhaarProof(kyc.idProofType) && normalizeAadhaar(kyc.idProofNumber).length !== 12) {
      fieldErrors.idProofNumber = "Aadhaar must be exactly 12 digits.";
    }
    if (kyc.panNumber && !PAN_PATTERN.test(kyc.panNumber)) {
      fieldErrors.panNumber = "Enter a valid PAN, for example ABCDE1234F.";
    }
    if (!kyc.idProofImage) fieldErrors.idProof = "ID proof image is required.";
    if (!kyc.accountNumber) fieldErrors.accountNumber = "Bank account number is required.";
    if (!kyc.ifscCode) fieldErrors.ifscCode = "IFSC code is required.";
    if (!kyc.bankAccountHolderName) fieldErrors.bankAccountHolderName = "Bank account holder name is required.";
    if (!kyc.bankName) fieldErrors.bankName = "Bank name is required.";
    if (!kyc.passbookFileUrl) fieldErrors.passbookFile = "Bank proof/passbook file is required.";
    if (roleType === "driver" && !kyc.vehicleNumber) fieldErrors.vehicleNumber = "Vehicle number is required.";
    if (roleType === "driver" && !kyc.drivingLicenseNumber) {
      fieldErrors.drivingLicenseNumber = "Driving license number is required.";
    }
    if (roleType === "driver" && !kyc.drivingLicenseImage) {
      fieldErrors.drivingLicense = "Driving license image is required.";
    }

    const missingKycDetails = Object.values(fieldErrors);

    if (missingKycDetails.length) {
      return res.status(400).json({
        msg: `Complete KYC details: ${missingKycDetails.join(" ")}`,
        errors: fieldErrors,
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        $set: {
          kyc,
          [`kycByRole.${roleType}`]: kyc,
        },
      },
      { new: true }
    ).select("-password -__v");

    res.json(user);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

export const rateGrowerForLot = async (req, res) => {
  try {
    const rating = Number(req.body.rating || 0);
    const comment = String(req.body.comment || "").trim().slice(0, 1000);

    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ msg: "Rating must be between 1 and 5" });
    }

    if (!getUserProfileTypes(req.user).has("buyer")) {
      return res.status(403).json({ msg: "Register as Fruit Buyer first to rate a grower" });
    }

    const product = await Product.findById(req.params.lotId).select("title createdBy gradeLots createdSource");
    if (!product || product.createdSource === "admin-panel") {
      return res.status(404).json({ msg: "Fruit lot not found" });
    }

    const growerId = product.createdBy?.toString();
    const raterId = req.user.id?.toString();
    if (!growerId) {
      return res.status(404).json({ msg: "Grower not found for this lot" });
    }

    if (growerId === raterId) {
      return res.status(400).json({ msg: "You cannot rate your own grower profile" });
    }

    const grower = await User.findById(growerId);
    if (!grower) {
      return res.status(404).json({ msg: "Grower not found" });
    }

    const existingRating = grower.growerRatings.find(
      (item) =>
        item.lot?.toString() === product._id.toString() &&
        item.rater?.toString() === raterId
    );

    if (existingRating) {
      existingRating.rating = rating;
      existingRating.comment = comment;
      existingRating.updatedAt = new Date();
    } else {
      grower.growerRatings.push({
        lot: product._id,
        rater: req.user.id,
        rating,
        comment,
      });
    }

    const ratings = grower.growerRatings.map((item) => Number(item.rating || 0)).filter((value) => value > 0);
    grower.growerRatingCount = ratings.length;
    grower.growerRatingAverage = ratings.length
      ? Number((ratings.reduce((sum, value) => sum + value, 0) / ratings.length).toFixed(2))
      : 0;

    await grower.save();

    res.status(existingRating ? 200 : 201).json({
      success: true,
      message: existingRating ? "Rating updated." : "Rating submitted.",
      rating: {
        rating,
        comment,
      },
      grower: {
        _id: grower._id,
        name: grower.name,
        orchardName: grower.orchardName,
        businessName: grower.businessName,
        growerRatingAverage: grower.growerRatingAverage,
        growerRatingCount: grower.growerRatingCount,
      },
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};
