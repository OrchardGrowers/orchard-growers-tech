import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      default: "OrchardGrowers",
    },

    phone: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },

    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
    },

    provider: {
      type: String,
      enum: ["local", "google", "facebook"],
      default: "local",
    },

    providerId: {
      type: String,
      trim: true,
      default: "",
    },

    oauthProviders: [
      {
        provider: {
          type: String,
          enum: ["google", "facebook"],
          required: true,
        },
        providerId: {
          type: String,
          trim: true,
          required: true,
        },
      },
    ],

    avatarUrl: {
      type: String,
      default: "",
    },

    bannerUrl: {
      type: String,
      default: "",
    },

    companyLogoUrl: {
      type: String,
      default: "",
    },

    role: {
      type: String,
      enum: ["grower", "buyer", "driver", null],
      default: null,
    },

    profileTypes: [
      {
        type: String,
        enum: ["grower", "buyer", "driver"],
      },
    ],
    activeRole: {
      type: String,
      enum: ["grower", "buyer", "driver", ""],
      default: "",
    },
    publicProfileRoles: [
      {
        type: String,
        enum: ["grower", "buyer", "driver"],
      },
    ],
    profileRegisteredAtByRole: {
      grower: { type: Date },
      buyer: { type: Date },
      driver: { type: Date },
    },

    // Grower profile
    orchardName: {
      type: String,
      trim: true,
      default: "",
    },

    // Buyer profile
    businessName: {
      type: String,
      trim: true,
      default: "",
    },
    buyerBusinessType: {
      type: String,
      enum: ["buyer", "exporter", "commission_agent", "cold_storage"],
      default: "buyer",
    },
    buyerContactPerson: {
      type: String,
      trim: true,
      default: "",
    },
    buyerLocation: {
      type: String,
      trim: true,
      default: "",
    },
    buyerPinCode: {
      type: String,
      trim: true,
      default: "",
    },
    buyerAvatarUrl: {
      type: String,
      default: "",
    },
    buyerBannerUrl: {
      type: String,
      default: "",
    },
    buyerCompanyLogoUrl: {
      type: String,
      default: "",
    },
    designation: {
      type: String,
      trim: true,
      default: "",
    },
    gstNumber: {
      type: String,
      uppercase: true,
      trim: true,
      default: "",
    },
    tradeLicenseNumber: {
      type: String,
      trim: true,
      default: "",
    },
    lockedAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Driver / logistics profile
    logisticsName: {
      type: String,
      trim: true,
      default: "",
    },
    vehicleNumber: {
      type: String,
      uppercase: true,
      trim: true,
      default: "",
    },
    licenseNumber: {
      type: String,
      uppercase: true,
      trim: true,
      default: "",
    },
    logisticsOwnerName: {
      type: String,
      trim: true,
      default: "",
    },
    logisticsOwnerContact: {
      type: String,
      trim: true,
      default: "",
    },
    driverName: {
      type: String,
      trim: true,
      default: "",
    },
    driverContact: {
      type: String,
      trim: true,
      default: "",
    },
    ownerIsDriver: {
      type: Boolean,
      default: false,
    },

    location: {
      type: String,
      trim: true,
      default: "",
    },

    businessAddressLine1: {
      type: String,
      trim: true,
      default: "",
    },

    businessAddressLine2: {
      type: String,
      trim: true,
      default: "",
    },

    businessAddressLine3: {
      type: String,
      trim: true,
      default: "",
    },

    businessPinCode: {
      type: String,
      trim: true,
      default: "",
    },

    addressLine1: {
      type: String,
      trim: true,
      default: "",
    },

    addressLine2: {
      type: String,
      trim: true,
      default: "",
    },

    addressLine3: {
      type: String,
      trim: true,
      default: "",
    },

    pinCode: {
      type: String,
      trim: true,
      default: "",
    },
    mapLatitude: {
      type: Number,
      default: null,
    },
    mapLongitude: {
      type: Number,
      default: null,
    },
    googleMapUrl: {
      type: String,
      trim: true,
      default: "",
    },

    contact: {
      type: String,
      trim: true,
      default: "",
    },

    socialLinks: {
      google: { type: String, trim: true, default: "" },
      facebook: { type: String, trim: true, default: "" },
      twitter: { type: String, trim: true, default: "" },
    },

    kyc: {
      roleType: {
        type: String,
        enum: ["buyer", "grower", "driver", ""],
        default: "",
      },
      fullName: { type: String, trim: true, default: "" },
      phone: { type: String, trim: true, default: "" },
      email: { type: String, lowercase: true, trim: true, default: "" },
      address: { type: String, trim: true, default: "" },
      district: { type: String, trim: true, default: "" },
      state: { type: String, trim: true, default: "" },
      pinCode: { type: String, trim: true, default: "" },
      idProofType: { type: String, trim: true, default: "" },
      idProofNumber: { type: String, trim: true, default: "" },
      idProofImage: { type: String, trim: true, default: "" },
      panNumber: { type: String, uppercase: true, trim: true, default: "" },
      panImage: { type: String, trim: true, default: "" },
      gstNumber: { type: String, uppercase: true, trim: true, default: "" },
      gstCertificate: { type: String, trim: true, default: "" },
      bankAccountHolderName: { type: String, trim: true, default: "" },
      bankName: { type: String, trim: true, default: "" },
      accountNumber: { type: String, trim: true, default: "" },
      ifscCode: { type: String, uppercase: true, trim: true, default: "" },
      upiId: { type: String, trim: true, default: "" },
      orchardName: { type: String, trim: true, default: "" },
      orchardLocation: { type: String, trim: true, default: "" },
      vehicleNumber: { type: String, uppercase: true, trim: true, default: "" },
      drivingLicenseNumber: { type: String, uppercase: true, trim: true, default: "" },
      drivingLicenseImage: { type: String, trim: true, default: "" },
      udyanCardNo: { type: String, uppercase: true, trim: true, default: "" },
      udyanCardFileUrl: { type: String, trim: true, default: "" },
      bankAccountNo: { type: String, trim: true, default: "" },
      ifscCode: { type: String, uppercase: true, trim: true, default: "" },
      passbookFileUrl: { type: String, trim: true, default: "" },
      aadhaarCardNo: { type: String, trim: true, default: "" },
      aadhaarCardFileUrl: { type: String, trim: true, default: "" },
      documents: { type: [mongoose.Schema.Types.Mixed], default: [] },
      status: {
        type: String,
        enum: ["NOT_SUBMITTED", "PENDING", "UNDER_REVIEW", "APPROVED", "REJECTED", "CORRECTION_REQUIRED", "COMPLETED"],
        default: "NOT_SUBMITTED",
      },
      adminRemarks: { type: String, trim: true, default: "" },
      adminReviews: [
        {
          admin: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
          adminClass: {
            type: String,
            enum: ["CLASS1", "CLASS2", "SUPER"],
          },
          action: {
            type: String,
            enum: ["APPROVE", "REJECT", "UNDER_REVIEW", "CORRECTION_REQUIRED"],
          },
          note: String,
          reviewedAt: { type: Date, default: Date.now },
        },
      ],
      decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
      decidedAt: { type: Date },
      submittedAt: { type: Date },
      reviewedAt: { type: Date },
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    },
    kycByRole: {
      buyer: { type: mongoose.Schema.Types.Mixed, default: {} },
      grower: { type: mongoose.Schema.Types.Mixed, default: {} },
      driver: { type: mongoose.Schema.Types.Mixed, default: {} },
    },

    buyerVerified: { type: Boolean, default: false },
    growerVerified: { type: Boolean, default: false },
    driverVerified: { type: Boolean, default: false },
    buyerOgVerified: { type: Boolean, default: false },
    growerOgVerified: { type: Boolean, default: false },
    driverOgVerified: { type: Boolean, default: false },
    ogVerificationByRole: {
      buyer: { type: mongoose.Schema.Types.Mixed, default: {} },
      grower: { type: mongoose.Schema.Types.Mixed, default: {} },
      driver: { type: mongoose.Schema.Types.Mixed, default: {} },
    },

    profileImpressions: {
      type: Number,
      default: 0,
      min: 0,
    },

    profileVisitors: {
      type: Number,
      default: 0,
      min: 0,
    },

    growerRatingAverage: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    growerRatingCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    growerRatings: [
      {
        lot: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
        rater: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        rating: { type: Number, min: 1, max: 5, required: true },
        comment: { type: String, trim: true, default: "" },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
      },
    ],

    isVerified: {
      type: Boolean,
      default: false,
    },
    accountStatus: {
      type: String,
      enum: ["ACTIVE", "HOLD", "SUSPENDED", "TERMINATED"],
      default: "ACTIVE",
    },
    adminNotes: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

userSchema.index({ role: 1 });
userSchema.index({ profileTypes: 1 });
userSchema.index({ publicProfileRoles: 1, createdAt: -1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ provider: 1, providerId: 1 });

export default mongoose.model("User", userSchema);
