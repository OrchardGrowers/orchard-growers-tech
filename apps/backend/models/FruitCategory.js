import mongoose from "mongoose";

export const normalizeCommodityName = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const fruitCategorySchema = new mongoose.Schema(
  {
    commodity: { type: String, required: true, trim: true },
    normalizedCommodity: { type: String, required: true, trim: true },
    displayName: { type: String, trim: true, default: "" },
    aliases: [{ type: String, trim: true }],
    category: {
      type: String,
      enum: ["fruit", "non-fruit", "uncategorized"],
      default: "uncategorized",
      index: true,
    },
    isFruit: { type: Boolean, default: false, index: true },
    source: { type: String, default: "data.gov.in-agmarknet", trim: true },
    firstSeenAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now, index: true },
    seenCount: { type: Number, default: 0 },
    mappedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    mappedAt: Date,
    adminNotes: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

fruitCategorySchema.index({ normalizedCommodity: 1 }, { unique: true });
fruitCategorySchema.index({ commodity: "text", displayName: "text", aliases: "text", category: "text" });

fruitCategorySchema.pre("validate", function normalizeCategory(next) {
  this.commodity = String(this.commodity || "").trim();
  this.normalizedCommodity = normalizeCommodityName(this.normalizedCommodity || this.commodity);
  if (!this.displayName) this.displayName = this.commodity;

  if (this.isFruit) this.category = "fruit";
  if (this.category === "fruit") this.isFruit = true;
  if (this.category === "non-fruit") this.isFruit = false;

  next();
});

export default mongoose.model("FruitCategory", fruitCategorySchema);
