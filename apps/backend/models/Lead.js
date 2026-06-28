import mongoose from "mongoose";

export const LEAD_TYPES = [
  "Buyer",
  "Grower",
  "Commission Agent",
  "Exporter",
  "Cold Storage",
  "Logistics",
];

export const LEAD_PRIORITIES = ["Low", "Medium", "High", "Urgent"];

export const LEAD_STATUSES = [
  "New",
  "Contacted",
  "Follow-up",
  "Qualified",
  "Hot",
  "Converted",
  "Lost",
  "Archived",
];

export const normalizeLeadPhone = (value = "") =>
  String(value || "").replace(/\D/g, "");

export const normalizeLeadEmail = (value = "") =>
  String(value || "").trim().toLowerCase();

const addDefaultWebProtocol = (value) =>
  /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`;

export const normalizeLeadWebsite = (value = "") => {
  const website = String(value || "").trim();
  if (!website) return "";

  try {
    const parsed = new URL(addDefaultWebProtocol(website));
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
    const pathname = parsed.pathname.replace(/\/+$/, "");
    return `${hostname}${pathname}`.toLowerCase();
  } catch {
    return website.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "");
  }
};

const isEmail = (value) =>
  !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const isPhone = (value) => {
  if (!value) return true;
  const normalized = normalizeLeadPhone(value);
  return normalized.length >= 7 && normalized.length <= 15;
};

const isWebUrl = (value) => {
  if (!value) return true;

  try {
    const parsed = new URL(addDefaultWebProtocol(value));
    return ["http:", "https:"].includes(parsed.protocol) && Boolean(parsed.hostname);
  } catch {
    return false;
  }
};

const leadSchema = new mongoose.Schema(
  {
    companyName: {
      type: String,
      required: [true, "Company name is required"],
      trim: true,
      maxlength: [200, "Company name cannot exceed 200 characters"],
    },
    contactPerson: {
      type: String,
      required: [true, "Contact person is required"],
      trim: true,
      maxlength: [120, "Contact person cannot exceed 120 characters"],
    },
    leadType: {
      type: String,
      enum: LEAD_TYPES,
      required: [true, "Lead type is required"],
      index: true,
    },
    fruits: {
      type: [{ type: String, trim: true, maxlength: 80 }],
      default: [],
      index: true,
    },
    city: {
      type: String,
      trim: true,
      maxlength: [120, "City cannot exceed 120 characters"],
      index: true,
    },
    state: {
      type: String,
      trim: true,
      maxlength: [120, "State cannot exceed 120 characters"],
      index: true,
    },
    address: {
      type: String,
      trim: true,
      maxlength: [1000, "Address cannot exceed 1000 characters"],
    },
    phone: {
      type: String,
      trim: true,
      maxlength: [40, "Phone cannot exceed 40 characters"],
      validate: {
        validator: isPhone,
        message: "Phone must contain between 7 and 15 digits",
      },
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: [254, "Email cannot exceed 254 characters"],
      validate: {
        validator: isEmail,
        message: "Email is invalid",
      },
    },
    whatsapp: {
      type: String,
      trim: true,
      maxlength: [40, "WhatsApp number cannot exceed 40 characters"],
      validate: {
        validator: isPhone,
        message: "WhatsApp number must contain between 7 and 15 digits",
      },
    },
    website: {
      type: String,
      trim: true,
      maxlength: [500, "Website cannot exceed 500 characters"],
      validate: {
        validator: isWebUrl,
        message: "Website must be a valid HTTP or HTTPS URL",
      },
    },
    sourceUrl: {
      type: String,
      trim: true,
      maxlength: [1000, "Source URL cannot exceed 1000 characters"],
      validate: {
        validator: isWebUrl,
        message: "Source URL must be a valid HTTP or HTTPS URL",
      },
    },
    sourcePlatform: {
      type: String,
      trim: true,
      maxlength: [80, "Source platform cannot exceed 80 characters"],
    },
    score: {
      type: Number,
      min: [0, "Score cannot be less than 0"],
      max: [100, "Score cannot exceed 100"],
      default: 0,
      validate: {
        validator: Number.isInteger,
        message: "Score must be an integer",
      },
    },
    priority: {
      type: String,
      enum: LEAD_PRIORITIES,
      default: "Medium",
      index: true,
    },
    status: {
      type: String,
      enum: LEAD_STATUSES,
      default: "New",
      index: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [5000, "Notes cannot exceed 5000 characters"],
    },
    tags: {
      type: [{ type: String, trim: true, maxlength: 60 }],
      default: [],
    },
    lastContactedAt: {
      type: Date,
      default: null,
    },
    nextFollowUpAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
      immutable: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
    normalizedPhone: {
      type: String,
      select: false,
    },
    normalizedEmail: {
      type: String,
      select: false,
    },
    normalizedWebsite: {
      type: String,
      select: false,
    },
  },
  {
    timestamps: true,
    collection: "orchard_ai_leads",
    toJSON: {
      transform: (_document, result) => {
        delete result.normalizedPhone;
        delete result.normalizedEmail;
        delete result.normalizedWebsite;
        return result;
      },
    },
    toObject: {
      transform: (_document, result) => {
        delete result.normalizedPhone;
        delete result.normalizedEmail;
        delete result.normalizedWebsite;
        return result;
      },
    },
  }
);

leadSchema.pre("validate", function setDuplicateDetectionFields(next) {
  this.normalizedPhone = normalizeLeadPhone(this.phone) || undefined;
  this.normalizedEmail = normalizeLeadEmail(this.email) || undefined;
  this.normalizedWebsite = normalizeLeadWebsite(this.website) || undefined;
  next();
});

leadSchema.index(
  { normalizedPhone: 1 },
  { unique: true, sparse: true, name: "unique_orchard_ai_lead_phone" }
);
leadSchema.index(
  { normalizedEmail: 1 },
  { unique: true, sparse: true, name: "unique_orchard_ai_lead_email" }
);
leadSchema.index(
  { normalizedWebsite: 1 },
  { unique: true, sparse: true, name: "unique_orchard_ai_lead_website" }
);
leadSchema.index({ createdAt: -1 }, { name: "orchard_ai_leads_created_at" });

export default mongoose.model("Lead", leadSchema);
