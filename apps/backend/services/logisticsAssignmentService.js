import crypto from "crypto";
import User from "../models/User.js";

export const normalizePhone = (value = "") => String(value || "").replace(/\D/g, "");

export const getRoleKycStatus = (user = {}, role = "driver") => {
  const status = user.kycByRole?.[role]?.status || user.kyc?.status || "";
  return String(status || "").trim().toUpperCase();
};

export const isRoleKycVerified = (user = {}, role = "driver") => {
  if (!user || user.accountStatus === "SUSPENDED") return false;
  const roleVerified = role === "driver" ? user.driverVerified : role === "grower" ? user.growerVerified : user.buyerVerified;
  const status = getRoleKycStatus(user, role);
  return Boolean(roleVerified || status === "APPROVED" || status === "COMPLETED");
};

export const hasVerifiedPayout = (user = {}, role = "driver") => {
  const kyc = user.kycByRole?.[role] || user.kyc || {};
  return Boolean(kyc.upiId || kyc.accountNumber || kyc.bankAccountNo);
};

export const findLogisticsPartner = async ({ driverMobile = "", transportFirmName = "" } = {}) => {
  const mobile = normalizePhone(driverMobile);
  const firm = String(transportFirmName || "").trim();
  const query = {
    $and: [
      { profileTypes: "driver" },
      {
        $or: [
          ...(mobile
            ? [
                { phone: mobile },
                { contact: mobile },
                { driverContact: mobile },
                { logisticsOwnerContact: mobile },
              ]
            : []),
          ...(firm
            ? [
                { logisticsName: new RegExp(escapeRegex(firm), "i") },
                { businessName: new RegExp(escapeRegex(firm), "i") },
              ]
            : []),
        ],
      },
    ],
  };

  if (!query.$and[1].$or.length) return null;
  return User.findOne(query).lean();
};

export const createInvitationToken = () => crypto.randomBytes(18).toString("hex");

export const buildLogisticsInvitationLink = (token) => {
  const baseUrl = process.env.EFRUITMANDI_PUBLIC_URL || process.env.FRONTEND_URL || "https://efruitmandi.live";
  return `${baseUrl.replace(/\/$/, "")}/register-driver?assignment=${encodeURIComponent(token)}`;
};

export const refreshSettlementEligibility = async (order, { grower, logistics } = {}) => {
  const logisticsAccepted = order.logisticsAssignment?.status === "LOGISTICS_ACCEPTED";
  const growerKycVerified = grower ? isRoleKycVerified(grower, "grower") : Boolean(order.settlementEligibility?.growerKycVerified);
  const logisticsKycVerified = logistics ? isRoleKycVerified(logistics, "driver") : Boolean(order.settlementEligibility?.logisticsKycVerified);

  order.settlementEligibility = {
    buyerPaymentReceived: order.paymentStatus === "ESCROW" || order.paymentStatus === "RELEASED",
    growerOtpVerified: Boolean(order.growerApproved),
    consignmentDelivered: order.deliveryStatus === "DELIVERED",
    logisticsAccepted,
    growerKycVerified,
    logisticsKycVerified,
    platformKycVerified: true,
    settlementReleaseAllowed: Boolean(
      (order.paymentStatus === "ESCROW" || order.paymentStatus === "RELEASED") &&
        order.growerApproved &&
        order.deliveryStatus === "DELIVERED" &&
        logisticsAccepted &&
        growerKycVerified &&
        logisticsKycVerified
    ),
  };

  order.logisticsAssignment = {
    ...(order.logisticsAssignment?.toObject ? order.logisticsAssignment.toObject() : order.logisticsAssignment || {}),
    kycStatus: logistics ? getRoleKycStatus(logistics, "driver") || (logistics.driverVerified ? "APPROVED" : "NOT_SUBMITTED") : order.logisticsAssignment?.kycStatus || "",
    settlementEligible: Boolean(logisticsAccepted && logisticsKycVerified && logistics && hasVerifiedPayout(logistics, "driver")),
  };

  order.beneficiaryMapping = [
    {
      beneficiaryType: "GROWER",
      beneficiaryId: String(order.grower || ""),
      kycStatus: growerKycVerified ? "APPROVED" : "PENDING",
      bankOrUpiVerified: grower ? hasVerifiedPayout(grower, "grower") : false,
      settlementAmount: Number(order.growerPayout || order.dealBreakdown?.growerReceivable || 0),
    },
    {
      beneficiaryType: "LOGISTICS",
      beneficiaryId: String(order.logisticsAssignment?.assignedLogisticsAccount || order.driver || ""),
      kycStatus: logisticsKycVerified ? "APPROVED" : "PENDING",
      bankOrUpiVerified: logistics ? hasVerifiedPayout(logistics, "driver") : false,
      settlementAmount: Number(order.driverPayment || order.dealBreakdown?.driverCharge || 0),
    },
    {
      beneficiaryType: "PLATFORM",
      beneficiaryId: "EFRUITMANDI_PLATFORM",
      kycStatus: "APPROVED",
      bankOrUpiVerified: true,
      settlementAmount: Number(order.platformCommission || order.dealBreakdown?.platformServiceFee || 0),
    },
  ];

  return order;
};

const escapeRegex = (value = "") => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
