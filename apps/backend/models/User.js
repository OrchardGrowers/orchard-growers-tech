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
    buyerContactPerson: {
      type: String,
      trim: true,
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
      udyanCardNo: { type: String, uppercase: true, trim: true, default: "" },
      udyanCardFileUrl: { type: String, trim: true, default: "" },
      bankAccountNo: { type: String, trim: true, default: "" },
      ifscCode: { type: String, uppercase: true, trim: true, default: "" },
      passbookFileUrl: { type: String, trim: true, default: "" },
      aadhaarCardNo: { type: String, trim: true, default: "" },
      aadhaarCardFileUrl: { type: String, trim: true, default: "" },
      status: {
        type: String,
        enum: ["NOT_SUBMITTED", "COMPLETED", "APPROVED", "REJECTED"],
        default: "NOT_SUBMITTED",
      },
      adminReviews: [
        {
          admin: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
          adminClass: {
            type: String,
            enum: ["CLASS1", "CLASS2", "SUPER"],
          },
          action: {
            type: String,
            enum: ["APPROVE", "REJECT"],
          },
          note: String,
          reviewedAt: { type: Date, default: Date.now },
        },
      ],
      decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
      decidedAt: { type: Date },
      submittedAt: { type: Date },
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
userSchema.index({ createdAt: -1 });
userSchema.index({ provider: 1, providerId: 1 });

export default mongoose.model("User", userSchema);
