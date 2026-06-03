import User from "../models/User.js";
import Product from "../models/Product.js";
import {
  getResourceType,
  uploadBufferToCloudinary,
} from "../services/cloudinaryService.js";
import {
  consumeOtpVerification,
  isOtpVerified,
  parseIdentifier,
} from "./authController.js";

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

// ================= SET ROLE =================
export const setUserRole = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      role,
      orchardName,
      businessName,
      buyerContactPerson,
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
      if (!businessName || !buyerContactPerson || !location || !contact) {
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

    await user.save();

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
    const updates = {};
    const avatarFile = req.files?.avatar?.[0] || req.files?.avatarUrl?.[0];
    const bannerFile = req.files?.banner?.[0] || req.files?.bannerUrl?.[0];
    const companyLogoFile =
      req.files?.companyLogo?.[0] || req.files?.companyLogoUrl?.[0];
    const profileTypes = new Set(req.user?.profileTypes || []);
    if (req.user?.role) profileTypes.add(req.user.role);
    const profileFolder = profileTypes.has("driver")
      ? "efruitmandi/drivers"
      : profileTypes.has("buyer")
        ? "efruitmandi/buyers"
        : "efruitmandi/growers";
    const uploadProfileFile = (file) =>
      uploadBufferToCloudinary(file, {
        folder: profileFolder,
        resourceType: "image",
      });

    if (avatarFile) {
      const uploaded = await uploadProfileFile(avatarFile);
      updates.avatarUrl = uploaded.secure_url;
    } else if (typeof avatarUrl === "string" && !avatarUrl.startsWith("data:")) {
      updates.avatarUrl = avatarUrl;
    }

    if (bannerFile) {
      const uploaded = await uploadProfileFile(bannerFile);
      updates.bannerUrl = uploaded.secure_url;
    } else if (typeof bannerUrl === "string" && !bannerUrl.startsWith("data:")) {
      updates.bannerUrl = bannerUrl;
    }

    if (companyLogoFile) {
      const uploaded = await uploadProfileFile(companyLogoFile);
      updates.companyLogoUrl = uploaded.secure_url;
    } else if (
      typeof companyLogoUrl === "string" &&
      !companyLogoUrl.startsWith("data:")
    ) {
      updates.companyLogoUrl = companyLogoUrl;
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
    const existingUser = await User.findById(req.user.id).select("kyc");

    if (!existingUser) {
      return res.status(404).json({ msg: "User not found" });
    }

    const existingKyc = existingUser.kyc?.toObject?.() || {};
    const udyanCardFile = req.files?.udyanCardFile?.[0];
    const passbookFile = req.files?.passbookFile?.[0];
    const aadhaarCardFile = req.files?.aadhaarCardFile?.[0];
    const uploadKycFile = (file) =>
      uploadBufferToCloudinary(file, {
        folder: "efruitmandi/kyc",
        resourceType: getResourceType(file),
      });

    const kyc = {
      ...existingKyc,
      udyanCardNo: String(req.body.udyanCardNo || existingKyc.udyanCardNo || "")
        .trim()
        .toUpperCase(),
      bankAccountNo: String(req.body.bankAccountNo || existingKyc.bankAccountNo || "").trim(),
      ifscCode: String(req.body.ifscCode || existingKyc.ifscCode || "")
        .trim()
        .toUpperCase(),
      aadhaarCardNo: String(req.body.aadhaarCardNo || existingKyc.aadhaarCardNo || "").trim(),
      status: "COMPLETED",
      submittedAt: new Date(),
    };

    if (udyanCardFile) kyc.udyanCardFileUrl = (await uploadKycFile(udyanCardFile)).secure_url;
    if (passbookFile) kyc.passbookFileUrl = (await uploadKycFile(passbookFile)).secure_url;
    if (aadhaarCardFile) kyc.aadhaarCardFileUrl = (await uploadKycFile(aadhaarCardFile)).secure_url;

    const missingKycDetails = [
      !kyc.udyanCardNo && "Udyan card number",
      !kyc.udyanCardFileUrl && "Udyan card file",
      !kyc.bankAccountNo && "Bank account number",
      !kyc.ifscCode && "IFSC code",
      !kyc.passbookFileUrl && "Passbook file",
      !kyc.aadhaarCardNo && "Aadhaar card number",
      !kyc.aadhaarCardFileUrl && "Aadhaar card file",
    ].filter(Boolean);

    if (missingKycDetails.length) {
      return res.status(400).json({
        msg: `Complete KYC details: ${missingKycDetails.join(", ")}`,
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { kyc },
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
