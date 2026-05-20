import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    title: String, // Apple, Mango
    slug: { type: String, index: true },
    sku: { type: String, index: true },
    hsnCode: String,
    cgst: { type: Number, default: 0 },
    sgst: { type: Number, default: 0 },
    fruitName: String,
    variety: String,
    productCategory: String,
    productType: String,
    unit: String,
    description: String,
    seoMetaTitle: String,
    seoMetaDescription: String,
    featured: { type: Boolean, default: false },
    active: { type: Boolean, default: true },

    images: [String], // image URLs
    gradeLots: [
      {
        grade: String,
        boxes: Number,
        weightKg: Number,
        images: [String],
      },
    ],
    sampleVideo: String,

    quantity: Number, // in boxes
    lotNo: String,
    packingType: String,
    packingWeightKg: Number,
    totalWeightKg: Number,
    basePrice: Number,
    auctionStartTime: Date,

    location: String,

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

export default mongoose.model("Product", productSchema);
