import mongoose from "mongoose";

const hsnMasterSchema = new mongoose.Schema(
  {
    hsnCode: { type: String, required: true, trim: true, index: true },
    description: { type: String, required: true, trim: true },
    gstRate: { type: Number, required: true },
    category: { type: String, required: true, trim: true, index: true },
    keywords: [{ type: String, trim: true, lowercase: true }],
    isActive: { type: Boolean, default: true, index: true },
    needsVerification: { type: Boolean, default: true },
  },
  { timestamps: true }
);

hsnMasterSchema.index({ hsnCode: 1, category: 1 }, { unique: true });
hsnMasterSchema.index({ description: "text", category: "text", keywords: "text", hsnCode: "text" });

const HsnMaster = mongoose.model("HsnMaster", hsnMasterSchema, "hsn_master");

const basicHsnRecords = [
  {
    hsnCode: "060290",
    description: "Live plants and nursery plants - needs CA/GST verification",
    gstRate: 5,
    category: "Live plants",
    keywords: ["live plants", "plant", "nursery", "sapling"],
  },
  {
    hsnCode: "060220",
    description: "Fruit plants, trees and grafted saplings - needs CA/GST verification",
    gstRate: 5,
    category: "Fruit plants",
    keywords: ["fruit plants", "apple", "mango", "grafted", "tree"],
  },
  {
    hsnCode: "120999",
    description: "Seeds for sowing - needs CA/GST verification",
    gstRate: 5,
    category: "Seeds",
    keywords: ["seeds", "sowing", "seed"],
  },
  {
    hsnCode: "310100",
    description: "Organic manure and compost - needs CA/GST verification",
    gstRate: 5,
    category: "Organic manure",
    keywords: ["organic manure", "compost", "vermicompost", "manure"],
  },
  {
    hsnCode: "310590",
    description: "Fertilizers and plant nutrients - needs CA/GST verification",
    gstRate: 5,
    category: "Fertilizers",
    keywords: ["fertilizer", "fertilizers", "nutrient", "plant food"],
  },
  {
    hsnCode: "530500",
    description: "Cocopeat and coir growing media - needs CA/GST verification",
    gstRate: 5,
    category: "Cocopeat",
    keywords: ["cocopeat", "coir", "growing media", "potting"],
  },
  {
    hsnCode: "820190",
    description: "Gardening hand tools - needs CA/GST verification",
    gstRate: 18,
    category: "Gardening tools",
    keywords: ["gardening tools", "tool", "auger", "spade", "pruner"],
  },
  {
    hsnCode: "392690",
    description: "Nursery pots and plastic garden articles - needs CA/GST verification",
    gstRate: 18,
    category: "Nursery pots",
    keywords: ["nursery pots", "pots", "plastic pot", "grow bag"],
  },
  {
    hsnCode: "560819",
    description: "Shade net and protective netting - needs CA/GST verification",
    gstRate: 12,
    category: "Shade net",
    keywords: ["shade net", "net", "greenhouse", "protective net"],
  },
  {
    hsnCode: "391739",
    description: "Irrigation pipes and watering items - needs CA/GST verification",
    gstRate: 18,
    category: "Irrigation pipes/items",
    keywords: ["irrigation", "pipe", "drip", "sprinkler", "watering"],
  },
];

export const seedHsnMaster = async () => {
  const existingCount = await HsnMaster.estimatedDocumentCount();
  if (existingCount > 0) return;

  await HsnMaster.insertMany(
    basicHsnRecords.map((record) => ({
      ...record,
      isActive: true,
      needsVerification: true,
    })),
    { ordered: false }
  );
};

export default HsnMaster;
