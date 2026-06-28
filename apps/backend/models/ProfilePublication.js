import mongoose from "mongoose";

const publicSnapshotSchema = new mongoose.Schema(
  {
    firmName: { type: String, required: true, trim: true },
    businessType: {
      type: String,
      enum: ["grower", "buyer", "exporter", "commission_agent", "cold_storage", "logistics"],
      required: true,
    },
    businessTypeLabel: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    logoUrl: { type: String, required: true, trim: true },
    profileUrl: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const profilePublicationSchema = new mongoose.Schema(
  {
    dedupeKey: { type: String, required: true, unique: true, index: true },
    guid: { type: String, required: true, unique: true, index: true },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    profileRole: {
      type: String,
      enum: ["grower", "buyer", "driver"],
      required: true,
    },
    publicationType: {
      type: String,
      enum: ["registration", "featured"],
      default: "registration",
      required: true,
    },
    snapshot: { type: publicSnapshotSchema, required: true },
    rssPublishedAt: { type: Date, default: Date.now, required: true, index: true },
    linkedinStatus: {
      type: String,
      enum: ["pending", "processing", "published", "retry", "failed", "needs_review", "disabled"],
      default: "pending",
      index: true,
    },
    linkedinPostUrn: { type: String, trim: true, default: "" },
    linkedinPublishedAt: { type: Date },
    attemptCount: { type: Number, default: 0, min: 0 },
    nextAttemptAt: { type: Date, default: Date.now, index: true },
    lockedUntil: { type: Date },
    lastError: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

profilePublicationSchema.index(
  { linkedinStatus: 1, nextAttemptAt: 1, lockedUntil: 1 },
  { name: "profile_publication_worker_queue" }
);
profilePublicationSchema.index(
  { user: 1, profileRole: 1, publicationType: 1, rssPublishedAt: -1 },
  { name: "profile_publication_history" }
);

export default mongoose.model("ProfilePublication", profilePublicationSchema);
