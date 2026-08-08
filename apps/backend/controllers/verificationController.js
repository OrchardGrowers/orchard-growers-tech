import VerificationRequest from "../models/VerificationRequest.js";
import User from "../models/User.js";
import { uploadVideoToYouTube } from "../services/youtubeService.js";
import {
  consumeOtpVerification,
  isOtpVerified,
  parseIdentifier,
} from "./authController.js";
import {
  getVerificationFeedback,
  markVerificationResubmitted,
} from "../services/verificationFeedbackService.js";
import { getKycEligibility } from "../services/kycEligibilityService.js";

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
const VALID_VERIFICATION_TYPES = new Set(["kyc", "og_verified"]);
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
const normalizeRequestStatus = (status = "") => {
  const normalized = String(status || "").trim().toUpperCase();
  if (normalized === "SUBMITTED") return "PENDING";
  return normalized || "NOT_SUBMITTED";
};
const getOgVerification = (user = {}, roleType = "") => {
  const role = String(roleType || "").trim().toLowerCase();
  const og = user.ogVerificationByRole?.[role];
  return og?.toObject?.() || og || {};
};

export const getMyVerificationStatus = async (req, res) => {
  try {
    const roleType = String(req.query.roleType || req.query.role || "").trim().toLowerCase();
    const verificationType = String(req.query.verificationType || "kyc").trim().toLowerCase();
    if (!VALID_ROLE_TYPES.has(roleType)) {
      return res.status(400).json({ msg: "Valid roleType is required" });
    }
    if (!VALID_VERIFICATION_TYPES.has(verificationType)) {
      return res.status(400).json({ msg: "Valid verificationType is required" });
    }

    const user = await User.findById(req.user.id).select("kyc kycByRole ogVerificationByRole buyerVerified growerVerified driverVerified buyerOgVerified growerOgVerified driverOgVerified");
    if (!user) return res.status(404).json({ msg: "User not found" });

    if (verificationType === "og_verified") {
      let og = getOgVerification(user, roleType);
      if (!og.requestId) {
        const latestRequest = await VerificationRequest.findOne({
          user: req.user.id,
          roleType,
          verificationType: "og_verified",
        })
          .sort({ createdAt: -1 })
          .select("_id status adminRemarks updatedAt createdAt decidedAt");

        if (latestRequest) {
          og = {
            requestId: latestRequest._id,
            status: latestRequest.status,
            adminRemarks: latestRequest.adminRemarks,
            submittedAt: latestRequest.createdAt,
            decidedAt: latestRequest.decidedAt,
            reviewedAt: latestRequest.updatedAt,
          };
        }
      }
      const status = normalizeRequestStatus(og.status);
      const verifiedFlag =
        roleType === "buyer"
          ? user.buyerOgVerified
          : roleType === "grower"
            ? user.growerOgVerified
            : user.driverOgVerified;
      const feedback = await getVerificationFeedback({
        userId: req.user.id,
        sections: ["profile", "business"],
        roleType,
        includeHistory: false,
      });

      return res.json({
        status: status.toLowerCase(),
        roleType,
        verificationType,
        ogVerified: Boolean(og.requestId && (verifiedFlag || status === "APPROVED")),
        requestId: og.requestId || "",
        adminRemarks: og.adminRemarks || "",
        updatedAt: og.reviewedAt || og.decidedAt || og.submittedAt || "",
        verificationFeedback: feedback.active,
        latestVerificationFeedback: feedback.latest,
      });
    }

    const kyc = getRoleKyc(user, roleType);
    const status = normalizeKycStatus(kyc.status);
    const feedback = await getVerificationFeedback({
      userId: req.user.id,
      sections: ["kyc", "pan", "bank", "document"],
      roleType,
      includeHistory: false,
    });

    res.json({
      status: status.toLowerCase(),
      roleType,
      kycVerified: getKycEligibility(user, roleType).eligible,
      panUpdateRequired: getKycEligibility(user, roleType).panUpdateRequired,
      requestId: kyc.submittedAt ? `${user._id}:${roleType}` : "",
      adminRemarks: kyc.adminRemarks || "",
      updatedAt: kyc.reviewedAt || kyc.decidedAt || kyc.submittedAt || "",
      verificationFeedback: feedback.active,
      latestVerificationFeedback: feedback.latest,
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

export const createVerificationRequest = async (req, res) => {
  try {
    const requestedRole = String(req.body.roleType || req.body.role || "").trim().toLowerCase();
    const roleType = VALID_ROLE_TYPES.has(requestedRole) ? requestedRole : "grower";
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
      roleType,
      verificationType: "og_verified",
      status: "SUBMITTED",
    }).select("_id");

    if (existingSubmitted) {
      return res.status(400).json({
        msg: "You already have a submitted verification request under review",
      });
    }

    const request = await VerificationRequest.create({
      user: req.user.id,
      roleType,
      verificationType: "og_verified",
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
      request.youtubeLink = videoData.id ? `https://www.youtube.com/watch?v=${videoData.id}` : "";
      await request.save();
    } catch (uploadErr) {
      console.error("YouTube upload failed:", uploadErr);
      return res.status(500).json({
        msg: "Verification request created, but video upload failed. Please check YouTube configuration.",
        error: uploadErr.message,
      });
    }

    await User.findByIdAndUpdate(req.user.id, {
      [`ogVerificationByRole.${roleType}`]: {
        status: "SUBMITTED",
        requestId: request._id,
        verificationType: "og_verified",
        youtubeVideoId: request.youtubeVideoId || "",
        youtubeLink: request.youtubeLink || "",
        adminRemarks: "",
        submittedAt: request.createdAt,
      },
      ...(roleType === "buyer" ? { buyerOgVerified: false } : {}),
      ...(roleType === "grower" ? { growerOgVerified: false } : {}),
      ...(roleType === "driver" ? { driverOgVerified: false } : {}),
    });
    await markVerificationResubmitted({
      userId: req.user.id,
      section: "profile",
      roleType,
      entityId: request._id,
    });

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
      .populate("adminReviews.admin", "name email role")
      .sort({ createdAt: -1 });

    res.json(requests);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};
