import VerificationRequest from "../models/VerificationRequest.js";
import User from "../models/User.js";
import { uploadVideoToYouTube } from "../services/youtubeService.js";
import {
  consumeOtpVerification,
  isOtpVerified,
  parseIdentifier,
} from "./authController.js";

const toFileMeta = (file) =>
  file
    ? {
        path: file.path,
        originalName: file.originalname,
        mimetype: file.mimetype,
      }
    : undefined;

const firstUploadedFile = (files, ...fieldNames) => {
  for (const fieldName of fieldNames) {
    const file = files?.[fieldName]?.[0];
    if (file) return file;
  }
  return null;
};

const VALID_ROLE_TYPES = new Set(["buyer", "grower", "driver"]);
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
  if (legacyRole === role || (!legacyRole && role && Object.keys(legacyKyc).some((key) => legacyKyc[key]))) return legacyKyc;

  return {};
};

export const getMyVerificationStatus = async (req, res) => {
  try {
    const roleType = String(req.query.roleType || req.query.role || "").trim().toLowerCase();
    if (!VALID_ROLE_TYPES.has(roleType)) {
      return res.status(400).json({ msg: "Valid roleType is required" });
    }

    const user = await User.findById(req.user.id).select("kyc kycByRole buyerVerified growerVerified driverVerified");
    if (!user) return res.status(404).json({ msg: "User not found" });

    const kyc = getRoleKyc(user, roleType);
    const status = normalizeKycStatus(kyc.status);
    const verifiedFlag =
      roleType === "buyer"
        ? user.buyerVerified
        : roleType === "grower"
          ? user.growerVerified
          : user.driverVerified;

    res.json({
      status: status.toLowerCase(),
      roleType,
      kycVerified: Boolean(verifiedFlag || status === "APPROVED"),
      requestId: kyc.submittedAt ? `${user._id}:${roleType}` : "",
      adminRemarks: kyc.adminRemarks || "",
      updatedAt: kyc.reviewedAt || kyc.decidedAt || kyc.submittedAt || "",
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

export const createVerificationRequest = async (req, res) => {
  try {
    const orchardName = String(req.body.orchardName || "").trim();
    const ownerName = String(req.body.ownerName || "").trim();
    const location = String(req.body.location || "").trim();
    const phone = String(req.body.phone || "").trim();
    const udyanCard = firstUploadedFile(req.files, "udyanCard", "udyanCardFile");
    const orchardVideo = firstUploadedFile(req.files, "orchardVideo", "orchardVideoFile");

    if (!orchardName || !ownerName || !location || !phone || !udyanCard || !orchardVideo) {
      return res.status(400).json({ msg: "Complete orchard detail and uploads are required" });
    }

    const parsedPhone = parseIdentifier(phone);

    if (!parsedPhone || parsedPhone.type !== "phone") {
      return res.status(400).json({ msg: "Enter a valid phone number" });
    }

    if (!isOtpVerified(parsedPhone)) {
      return res.status(400).json({ msg: "Verify phone OTP before sending request" });
    }

    const existingSubmitted = await VerificationRequest.findOne({
      user: req.user.id,
      status: "SUBMITTED",
    }).select("_id");

    if (existingSubmitted) {
      return res.status(400).json({
        msg: "You already have a submitted verification request under review",
      });
    }

    const request = await VerificationRequest.create({
      user: req.user.id,
      orchardName,
      ownerName,
      location,
      phone: parsedPhone.value,
      udyanCardFile: toFileMeta(udyanCard),
      orchardVideo: toFileMeta(orchardVideo),
      fee: {
        baseAmount: 5000,
        taxRate: 0.05,
        taxAmount: 250,
        totalAmount: 5250,
        paid: true,
        paidAt: new Date(),
      },
    });

    const clampTitle = (value) => {
      const maxLength = 70;
      return value.length > maxLength ? `${value.slice(0, maxLength).trim()}...` : value;
    };

    const title = clampTitle(
      `${orchardName} || ${ownerName} || Orchard Visit || Fresh From Farm`
    );
    const description = `Orchard Name: ${orchardName}\nOwner: ${ownerName}\nLocation: ${location}\nVerified orchard visit upload by Orchard Growers.`;

    try {
      const videoData = await uploadVideoToYouTube({
        filePath: orchardVideo.path,
        title,
        description,
        tags: ["Orchard Growers", "Fresh From Farm", "Orchard Visit", "Agriculture"],
        privacyStatus: "public",
      });

      request.youtubeVideoId = videoData.id;
      await request.save();
    } catch (uploadErr) {
      console.error("YouTube upload failed:", uploadErr);
      return res.status(500).json({
        msg: "Verification request created, but video upload failed. Please check YouTube configuration.",
        error: uploadErr.message,
      });
    }

    consumeOtpVerification(parsedPhone);

    res.status(201).json({
      message: "Verification request submitted and video uploaded to YouTube",
      request,
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

export const listVerificationRequests = async (req, res) => {
  try {
    const requests = await VerificationRequest.find()
      .populate("user", "name orchardName phone email role isVerified")
      .sort({ createdAt: -1 });

    res.json(requests);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};
