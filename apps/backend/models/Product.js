import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    title: String, // Apple, Mango
    slug: { type: String, index: true },
    sku: { type: String, trim: true },
    hsnCode: String,
    hsnDescription: String,
    gstRate: { type: Number, default: 0 },
    cgst: { type: Number, default: 0 },
    sgst: { type: Number, default: 0 },
    fruitName: String,
    variety: String,
    quality: String,
    organicCertificationNo: String,
    organicCertificateUrl: String,
    organicCertificatePublicId: String,
    productCategory: String,
    seasonalCategory: String,
    productType: String,
    inventoryType: {
      type: String,
      enum: ["finished_product", "raw_material"],
      default: "finished_product",
      index: true,
    },
    unit: String,
    description: String,
    seoMetaTitle: String,
    seoMetaDescription: String,
    seoKeywords: [{ type: String, trim: true, lowercase: true }],
    featured: { type: Boolean, default: false },
    active: { type: Boolean, default: true },

    images: [String], // image URLs
    imagePublicIds: [String],
    imageObjects: [
      {
        url: { type: String, trim: true, default: "" },
        publicId: { type: String, trim: true, default: "" },
        alt: { type: String, trim: true, default: "" },
        isPrimary: { type: Boolean, default: false },
      },
    ],
    createdSource: {
      type: String,
      enum: ["grower", "admin-panel"],
      default: "grower",
    },
    gradeLots: [
      {
        grade: String,
        boxes: Number,
        weightKg: Number,
        images: [String],
        imageObjects: [
          {
            url: { type: String, trim: true, default: "" },
            publicId: { type: String, trim: true, default: "" },
            alt: { type: String, trim: true, default: "" },
            isPrimary: { type: Boolean, default: false },
          },
        ],
      },
    ],
    sampleVideo: String,

    quantity: { type: Number, min: 0 }, // in boxes
    lotNo: String,
    packingType: String,
    packingWeightKg: Number,
    totalWeightKg: Number,
    basePrice: Number,
    discountPercent: { type: Number, default: 0 },
    auctionStartTime: Date,

    location: String,
    packShape: {
      type: String,
      enum: ["box", "cylinder", "flyer"],
      default: "box",
    },
    packLengthCm: Number,
    packWidthCm: Number,
    packHeightCm: Number,
    packRadiusCm: Number,
    packThicknessCm: Number,
    actualWeightKg: Number,
    dimensionWeightKg: Number,
    chargeableWeightKg: Number,

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    status: {
      type: String,
      enum: ["AVAILABLE", "IN_AUCTION", "SOLD"],
      default: "AVAILABLE",
    },
  },
  { timestamps: true }
);

productSchema.index(
  { sku: 1 },
  {
    unique: true,
    partialFilterExpression: { sku: { $type: "string", $gt: "" } },
  }
);
productSchema.index({
  title: "text",
  fruitName: "text",
  variety: "text",
  productCategory: "text",
  description: "text",
  seoMetaTitle: "text",
  seoMetaDescription: "text",
  seoKeywords: "text",
});

export default mongoose.model("Product", productSchema);
