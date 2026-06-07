import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    auction: { type: mongoose.Schema.Types.ObjectId, ref: "Auction" },
    quote: { type: mongoose.Schema.Types.ObjectId, ref: "Quotation" },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },

    buyer: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    grower: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    driver: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    auctionPrice: Number,
    finalPrice: Number,
    highestGrade: String,
    highestGradeRate: Number,
    dealBreakdown: mongoose.Schema.Types.Mixed,
    buyerProposedPrice: Number,
    items: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
        title: String,
        quantity: { type: Number, default: 1 },
        unitPrice: { type: Number, default: 0 },
        lineTotal: { type: Number, default: 0 },
      },
    ],

    customer: {
      name: String,
      phone: String,
      email: String,
    },

    shippingAddress: {
      line1: String,
      line2: String,
      city: String,
      state: String,
      pinCode: String,
      country: { type: String, default: "India" },
    },

    subtotal: { type: Number, default: 0 },
    shippingCharge: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    invoiceNumber: String,
    invoiceDate: Date,
    commissionInvoiceNumber: { type: String, unique: true, sparse: true },
    commissionInvoiceDate: Date,
    commissionReceiptNumber: { type: String, unique: true, sparse: true },
    commissionReceiptDate: Date,
    commissionTaxableAmount: { type: Number, default: 0 },
    commissionGstPercent: { type: Number, default: 0 },
    commissionGstAmount: { type: Number, default: 0 },
    commissionTotalAmount: { type: Number, default: 0 },

    paymentMethod: {
      type: String,
      enum: ["COD", "UPI", "CARD", "NETBANKING", "CASHFREE", "TEST_PAYMENT"],
      default: "TEST_PAYMENT",
    },

    paymentReference: String,
    paymentGatewayOrderId: String,
    paymentGatewaySessionId: String,
    paymentGateway: String,
    paymentGatewayStatus: String,
    paymentGatewayResponse: mongoose.Schema.Types.Mixed,
    paymentDueAt: Date,

    courierPartner: {
      type: String,
      default: "India Post",
    },
    deliveryPartnerSelection: {
      type: String,
      enum: ["AUTOMATIC", "MANUAL"],
      default: "AUTOMATIC",
    },
    courierTestKey: String,
    courierBookingStatus: {
      type: String,
      enum: ["PENDING", "TEST_BOOKED", "BOOKED", "FAILED", "MANUAL_REVIEW"],
      default: "PENDING",
    },
    trackingNumber: String,

    paymentStatus: {
      type: String,
      enum: ["PENDING", "ESCROW", "RELEASED", "PAID", "FAILED"],
      default: "PENDING",
    },

    deliveryStatus: {
      type: String,
      enum: ["PENDING", "IN_TRANSIT", "DELIVERED", "PLACED"],
      default: "PENDING",
    },
    escrowStatus: {
      type: String,
      enum: ["PENDING_BUYER_PAYMENT", "PAYMENT_RECEIVED_AND_HELD", "HELD_BY_BILLDESK", "CONSIGNMENT_IN_TRANSIT", "BUYER_CONFIRMED", "PAYOUT_RELEASED", "DEAL_CLOSED"],
      default: "PENDING_BUYER_PAYMENT",
    },
    logisticsAssignment: {
      status: {
        type: String,
        enum: [
          "NOT_REQUIRED",
          "AWAITING_GROWER_DETAILS",
          "REGISTERED_LOGISTICS_FOUND",
          "UNREGISTERED_LOGISTICS",
          "AWAITING_LOGISTICS_REGISTRATION",
          "LOGISTICS_REGISTERED",
          "LOGISTICS_ACCEPTED",
          "LOGISTICS_REJECTED",
        ],
        default: "NOT_REQUIRED",
      },
      driverName: { type: String, trim: true, default: "" },
      driverMobile: { type: String, trim: true, default: "" },
      vehicleNumber: { type: String, uppercase: true, trim: true, default: "" },
      vehicleType: { type: String, trim: true, default: "" },
      transportFirmName: { type: String, trim: true, default: "" },
      ownerName: { type: String, trim: true, default: "" },
      pickupDate: Date,
      expectedDispatchDate: Date,
      remarks: { type: String, trim: true, default: "" },
      assignedLogisticsAccount: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      registrationStatus: { type: String, trim: true, default: "" },
      invitationToken: { type: String, trim: true, default: "" },
      invitationLink: { type: String, trim: true, default: "" },
      invitationSentAt: Date,
      submittedAt: Date,
      acceptedAt: Date,
      rejectedAt: Date,
      kycStatus: { type: String, trim: true, default: "" },
      settlementEligible: { type: Boolean, default: false },
      notifications: {
        app: { type: Boolean, default: false },
        sms: { type: Boolean, default: false },
        email: { type: Boolean, default: false },
        whatsapp: { type: Boolean, default: false },
      },
    },
    beneficiaryMapping: [
      {
        beneficiaryType: { type: String, enum: ["GROWER", "LOGISTICS", "PLATFORM"], required: true },
        beneficiaryId: String,
        kycStatus: String,
        bankOrUpiVerified: { type: Boolean, default: false },
        settlementAmount: { type: Number, default: 0 },
      },
    ],
    settlementEligibility: {
      buyerPaymentReceived: { type: Boolean, default: false },
      growerOtpVerified: { type: Boolean, default: false },
      consignmentDelivered: { type: Boolean, default: false },
      logisticsAccepted: { type: Boolean, default: false },
      growerKycVerified: { type: Boolean, default: false },
      logisticsKycVerified: { type: Boolean, default: false },
      platformKycVerified: { type: Boolean, default: true },
      settlementReleaseAllowed: { type: Boolean, default: false },
    },
    driverPayment: { type: Number, default: 0 },
    platformCommission: { type: Number, default: 0 },
    growerPayout: { type: Number, default: 0 },

    // 🔐 OTPs
    deliveryOTP: String,
    settlementOTP: String,

    buyerApproved: { type: Boolean, default: false },
    growerApproved: { type: Boolean, default: false },

  },
  { timestamps: true }
);

export default mongoose.model("Order", orderSchema);
