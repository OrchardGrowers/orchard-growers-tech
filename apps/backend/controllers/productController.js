import Product from "../models/Product.js";
import Auction from "../models/Auction.js";
import Quotation from "../models/Quotation.js";
import User from "../models/User.js";
import {
  getResourceType,
  uploadBufferToCloudinary,
  uploadBuffersToCloudinary,
} from "../services/cloudinaryService.js";

const AUCTION_DELAY_MS = 5 * 60 * 1000;
const AUCTION_DURATION_MS = 24 * 60 * 60 * 1000;

const canSeeBasePrice = (product, user) =>
  (user?.role === "grower" ||
    (Array.isArray(user?.profileTypes) && user.profileTypes.includes("grower"))) &&
  product?.createdBy &&
  (product.createdBy._id || product.createdBy)?.toString() === user.id?.toString();

const serializeProduct = (product, user) => {
  const data = product.toObject ? product.toObject() : { ...product };

  if (!canSeeBasePrice(data, user) && data.createdSource !== "admin-panel") {
    delete data.basePrice;
  }

  return data;
};

const makeFirmPrefix = (user) => {
  const source =
    user?.orchardName || user?.businessName || user?.name || "Grower Firm";
  const words = source
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, "")
    .split(/\s+/)
    .filter(Boolean);

  if (words.length > 1) {
    return words.map((word) => word[0]).join("").slice(0, 5);
  }

  return (words[0] || "LOT").slice(0, 3);
};

const generateLotNo = async (userId) => {
  const user = await User.findById(userId).select(
    "name orchardName businessName"
  );
  const year = new Date().getFullYear();
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year + 1, 0, 1);
  const firmLotCount = await Product.countDocuments({
    createdBy: userId,
    createdAt: { $gte: yearStart, $lt: yearEnd },
  });
  const sequence = String(firmLotCount + 1).padStart(3, "0");

  return `${makeFirmPrefix(user)}/${year}/${sequence}`;
};

const uploadLotFile = async (file, resourceType = "image") => {
  if (!file) return null;

  const folder =
    resourceType === "raw"
      ? "efruitmandi/kyc"
      : process.env.CLOUDINARY_LOT_FOLDER || "efruitmandi/lots";
  const uploaded = await uploadBufferToCloudinary(file, {
    folder,
    resourceType: resourceType || getResourceType(file),
  });

  return {
    url: uploaded.secure_url,
    secure_url: uploaded.secure_url,
    publicId: uploaded.publicId,
    folder: uploaded.folder,
    resourceType: uploaded.resourceType,
  };
};

const uploadLotFiles = async (files = [], resourceType = "image") => {
  const uploaded = await uploadBuffersToCloudinary(files, {
    folder: process.env.CLOUDINARY_LOT_FOLDER || "efruitmandi/lots",
    resourceType,
  });
  return uploaded.map((file) => ({
    url: file.secure_url,
    secure_url: file.secure_url,
    publicId: file.publicId,
    folder: file.folder,
    resourceType: file.resourceType,
  }));
};

const ORGANIC_CERTIFIED_QUALITIES = new Set([
  "premium certified organic export quality",
  "certified organic",
]);

const requiresOrganicCertificate = (quality = "") =>
  ORGANIC_CERTIFIED_QUALITIES.has(String(quality || "").trim().toLowerCase());

const hasCompletedKyc = (user = {}, roleType = "") => {
  const role = String(roleType || "").toLowerCase();
  const roleKyc = user?.kycByRole?.[role] || {};
  const legacyKyc = String(user?.kyc?.roleType || "").toLowerCase() === role ? user.kyc : {};
  return String(roleKyc.status || legacyKyc.status || "").toUpperCase() === "APPROVED";
};

const requireCompletedKyc = async (userId) => {
  const user = await User.findById(userId).select("kyc kycByRole growerVerified");
  return Boolean(user?.growerVerified) || hasCompletedKyc(user, "grower");
};

export const getNextLotNo = async (req, res) => {
  try {
    const lotNo = await generateLotNo(req.user.id);
    res.json({ lotNo });
  } catch (err) {
    res.status(500).json({ msg: err.message || "Could not generate lot number" });
  }
};

const getUploadedFiles = (req, fieldName) => {
  if (Array.isArray(req.files)) {
    return req.files.filter((file) => file.fieldname === fieldName);
  }

  return req.files?.[fieldName] || [];
};

const SKU_CATEGORY_CODES = {
  plant: "PLT",
  plants: "PLT",
  "live plants": "PLT",
  "fruit plants": "PLT",
  seed: "SED",
  seeds: "SED",
  tool: "TOOL",
  tools: "TOOL",
  "gardening tools": "TOOL",
  fertilizer: "FRT",
  fertilizers: "FRT",
  manure: "MAN",
  "organic manure": "MAN",
  cocopeat: "COCO",
  pot: "POT",
  pots: "POT",
  "nursery pots": "POT",
  "shade net": "NET",
  irrigation: "IRR",
};
const SKU_UNIT_CODES = {
  kg: "U1",
  piece: "U2",
  plant: "U1",
  box: "U3",
  litre: "U4",
  liter: "U4",
};
const toSkuPart = (value = "", maxLength = 8) => {
  const cleaned = String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");
  return (cleaned || "ITEM").slice(0, maxLength);
};
const getCategoryCode = (category = "") => {
  const normalized = String(category || "").trim().toLowerCase();
  return SKU_CATEGORY_CODES[normalized] || toSkuPart(normalized, 4);
};
const getUnitCode = (unitId = "") => {
  const normalized = String(unitId || "").trim().toLowerCase();
  if (/^u\d+$/i.test(normalized)) return normalized.toUpperCase();
  return SKU_UNIT_CODES[normalized] || toSkuPart(normalized || "U1", 3);
};

export const generateSku = async (req, res) => {
  try {
    const category = String(req.query.category || "").trim();
    const productName = String(req.query.productName || "").trim();
    const unitId = String(req.query.unitId || "").trim();

    if (!category || !productName || !unitId) {
      return res.status(400).json({ msg: "Category, product name, and unit are required" });
    }

    const categoryCode = getCategoryCode(category);
    const productShort = toSkuPart(productName.split(/\s+/)[0] || productName, 8);
    const unitCode = getUnitCode(unitId);
    const familyPattern = new RegExp(`^OG-${categoryCode}-[A-Z0-9]+-${unitCode}-(\\d{4})$`);
    const existing = await Product.find({ sku: familyPattern }).select("sku").lean();
    const maxSerial = existing.reduce((max, product) => {
      const match = String(product.sku || "").match(familyPattern);
      return match ? Math.max(max, Number(match[1] || 0)) : max;
    }, 0);

    let serial = maxSerial + 1;
    let sku = "";
    while (serial < 10000) {
      sku = `OG-${categoryCode}-${productShort}-${unitCode}-${String(serial).padStart(4, "0")}`;
      const duplicate = await Product.exists({ sku });
      if (!duplicate) break;
      serial += 1;
    }

    if (!sku || serial >= 10000) {
      return res.status(500).json({ msg: "Could not generate SKU" });
    }

    res.json({ sku });
  } catch (err) {
    console.error("SKU generation failed:", err.message || err);
    res.status(500).json({ msg: "Could not generate SKU" });
  }
};

// CREATE PRODUCT WITH IMAGE
export const createProduct = async (req, res) => {
  try {
    if (!(await requireCompletedKyc(req.user.id))) {
      return res.status(403).json({ msg: "Complete KYC before listing fruit lots" });
    }

    const title = String(req.body.title || "").trim();
    const fruitName = String(req.body.fruitName || "").trim();
    const variety = String(req.body.variety || "").trim();
    const quality = String(req.body.quality || "").trim();
    const organicCertificationNo = String(req.body.organicCertificationNo || "").trim();
    const description = String(req.body.description || "").trim();
    const packingType = String(req.body.packingType || "").trim();
    const location = String(req.body.location || "").trim();
    const quantity = Number(req.body.quantity || 0);
    const packingWeightKg = Number(req.body.packingWeightKg || 0);
    const totalWeightKg = Number(req.body.totalWeightKg || 0);
    const basePrice = Number(req.body.basePrice || 0);

    if (!title || !fruitName || !variety || !quality || !packingType || !location) {
      return res.status(400).json({ msg: "Title, fruit, variety, quality, packing, and location are required" });
    }

    if (!Number.isFinite(basePrice) || basePrice <= 0) {
      return res.status(400).json({ msg: "Base price must be greater than zero" });
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return res.status(400).json({ msg: "Quantity must be greater than zero" });
    }

    if (!Number.isFinite(totalWeightKg) || totalWeightKg <= 0) {
      return res.status(400).json({ msg: "Total weight must be greater than zero" });
    }

    const organicCertificateFile = getUploadedFiles(req, "organicCertificate")[0];
    if (requiresOrganicCertificate(quality)) {
      if (!organicCertificationNo) {
        return res.status(400).json({ msg: "Organic certification number is required for certified organic lots" });
      }

      if (!organicCertificateFile) {
        return res.status(400).json({ msg: "Organic certificate upload is required for certified organic lots" });
      }
    }

    let requestedGradeLots = [];

    try {
      requestedGradeLots = req.body.gradeLots ? JSON.parse(req.body.gradeLots) : [];
    } catch {
      return res.status(400).json({ msg: "Invalid grade lot details" });
    }
    if (!Array.isArray(requestedGradeLots)) {
      return res.status(400).json({ msg: "Invalid grade lot details" });
    }

    const gradeLotFiles = requestedGradeLots.map((lot) => ({
      lot,
      files: getUploadedFiles(req, lot.fieldName).slice(0, 5),
    }));

    const uploadedGradeLots = await Promise.all(
      gradeLotFiles.map(async ({ lot, files }) => ({
        lot,
        uploadedFiles: await uploadLotFiles(files, "image"),
      }))
    );

    const uploadedPublicIds = [];
    const uploadedOrganicCertificate = organicCertificateFile
      ? await uploadLotFile(
          organicCertificateFile,
          organicCertificateFile.mimetype === "application/pdf" ? "raw" : "image"
        )
      : null;
    if (uploadedOrganicCertificate?.publicId) {
      uploadedPublicIds.push(uploadedOrganicCertificate.publicId);
    }

    const gradeLots = uploadedGradeLots.map(({ lot, uploadedFiles }) => {
      const boxes = Number(lot.boxes || 0);
      const weightKg = Number(lot.weightKg || 0);
      uploadedPublicIds.push(...uploadedFiles.map((file) => file.publicId).filter(Boolean));

      return {
        grade: lot.grade,
        boxes,
        weightKg,
        images: uploadedFiles.map((file) => file.url),
        imageObjects: uploadedFiles.map((file, index) => ({
          url: file.url,
          publicId: file.publicId,
          alt: `${title} ${lot.grade || "grade"} image ${index + 1}`,
          isPrimary: index === 0,
        })),
      };
    });

    const totalGradeBoxes = gradeLots.reduce(
      (sum, lot) => sum + Number(lot.boxes || 0),
      0
    );

    if (totalGradeBoxes <= 0) {
      return res.status(400).json({ msg: "At least one grade lot with boxes is required" });
    }

    const imagePaths = gradeLots.flatMap((lot) => lot.images);
    const imageObjects = gradeLots.flatMap((lot) => lot.imageObjects || []);
    const sampleVideoFile = getUploadedFiles(req, "sampleVideo")[0];
    const uploadedSampleVideo = sampleVideoFile
      ? await uploadLotFile(sampleVideoFile, "video")
      : null;
    const sampleVideo = uploadedSampleVideo?.url || "";
    if (uploadedSampleVideo?.publicId) uploadedPublicIds.push(uploadedSampleVideo.publicId);
    const auctionStartAt = new Date(Date.now() + AUCTION_DELAY_MS);
    const auctionEndAt = new Date(auctionStartAt.getTime() + AUCTION_DURATION_MS);

    const generatedLotNo = await generateLotNo(req.user.id);

    const product = await Product.create({
      title,
      fruitName,
      variety,
      quality,
      organicCertificationNo,
      organicCertificateUrl: uploadedOrganicCertificate?.url || "",
      organicCertificatePublicId: uploadedOrganicCertificate?.publicId || "",
      description,
      quantity,
      lotNo: generatedLotNo,
      packingType,
      packingWeightKg,
      totalWeightKg,
      basePrice,
      auctionStartTime: auctionStartAt,
      location,
      images: imagePaths,
      imageObjects,
      imagePublicIds: uploadedPublicIds,
      gradeLots,
      sampleVideo,
      createdBy: req.user.id,
      status: "IN_AUCTION",
    });

    const auction = await Auction.create({
      product: product._id,
      startingPrice: Number(basePrice || 0),
      currentBid: Number(basePrice || 0),
      status: "SCHEDULED",
      startTime: auctionStartAt,
      endTime: auctionEndAt,
    });

    res.json({
      message: "Product created",
      product,
      auction,
    });
  } catch (err) {
    console.error("Product creation failed:", err.message || err);
    res.status(500).json({ msg: err.message });
  }
};

// GET PRODUCTS
export const getProducts = async (req, res) => {
  try {
    const platform = String(req.query.platform || "").trim().toLowerCase();
    const filters = { active: { $ne: false }, inventoryType: { $ne: "raw_material" } };

    if (["orchard", "orchardgrowers", "orchard-growers"].includes(platform)) {
      filters.$or = [
        { createdSource: "admin-panel" },
        {
          createdSource: { $exists: false },
          "gradeLots.0": { $exists: false },
        },
      ];
    }

    if (["efruitmandi", "efruit", "mandi"].includes(platform)) {
      filters.$or = [
        { createdSource: "grower" },
        { "gradeLots.0": { $exists: true } },
      ];
    }

    const products = await Product.find(filters)
      .populate("createdBy", "name orchardName businessName companyLogoUrl avatarUrl bannerUrl role location growerRatingAverage growerRatingCount growerOgVerified buyerOgVerified driverOgVerified ogVerificationByRole")
      .sort({ createdAt: -1 });
    res.json(products.map((product) => serializeProduct(product, req.user)));
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// GET SINGLE PRODUCT WITH AUCTION DETAIL
export const getProductById = async (req, res) => {
  try {
    const platform = String(req.query.platform || "").trim().toLowerCase();
    const product = await Product.findById(req.params.id).populate(
      "createdBy",
      "name orchardName businessName companyLogoUrl avatarUrl bannerUrl role location growerRatingAverage growerRatingCount"
    );

    const isOrchardPlatform = ["orchard", "orchardgrowers", "orchard-growers"].includes(platform);
    const isEfruitPlatform = ["efruitmandi", "efruit", "mandi"].includes(platform);
    const hasGradeLots = Array.isArray(product?.gradeLots) && product.gradeLots.length > 0;
    const isWrongPlatform =
      (isOrchardPlatform && product?.createdSource !== "admin-panel" && hasGradeLots) ||
      (isEfruitPlatform && product?.createdSource === "admin-panel");

    if (!product || product.inventoryType === "raw_material" || isWrongPlatform) {
      return res.status(404).json({ msg: "Product not found" });
    }

    const auction = await Auction.findOne({ product: product._id })
      .sort({ createdAt: -1 })
      .populate("highestBidder", "name businessName role");

    const serializedProduct = serializeProduct(product, req.user);
    const serializedAuction = auction?.toObject ? auction.toObject() : auction;

    if (serializedAuction && !canSeeBasePrice(serializedProduct, req.user)) {
      delete serializedAuction.startingPrice;
    }

    res.json({ product: serializedProduct, auction: serializedAuction });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// UPDATE GROWER LOT DETAILS
export const updateProduct = async (req, res) => {
  try {
    if (!(await requireCompletedKyc(req.user.id))) {
      return res.status(403).json({ msg: "Complete KYC before updating fruit lots" });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ msg: "Product not found" });
    }

    if (product.createdBy?.toString() !== req.user.id?.toString()) {
      return res.status(403).json({ msg: "You can update only your own listing" });
    }

    if (product.createdSource === "admin-panel" || product.inventoryType === "raw_material") {
      return res.status(400).json({ msg: "This listing cannot be updated from grower dashboard" });
    }

    const title = String(req.body.title || product.title || "").trim();
    const fruitName = String(req.body.fruitName || product.fruitName || "").trim();
    const variety = String(req.body.variety || product.variety || "").trim();
    const quality = String(req.body.quality || product.quality || "").trim();
    const organicCertificationNo = String(req.body.organicCertificationNo || product.organicCertificationNo || "").trim();
    const description = String(req.body.description ?? product.description ?? "").trim();
    const packingType = String(req.body.packingType || product.packingType || "").trim();
    const location = String(req.body.location || product.location || "").trim();
    const quantity = Number(req.body.quantity ?? product.quantity ?? 0);
    const packingWeightKg = Number(req.body.packingWeightKg ?? product.packingWeightKg ?? 0);
    const totalWeightKg = Number(req.body.totalWeightKg ?? product.totalWeightKg ?? 0);
    const basePrice = Number(req.body.basePrice ?? product.basePrice ?? 0);

    if (!title || !fruitName || !variety || !quality || !packingType || !location) {
      return res.status(400).json({ msg: "Title, fruit, variety, quality, packing, and location are required" });
    }

    if (!Number.isFinite(basePrice) || basePrice <= 0) {
      return res.status(400).json({ msg: "Base price must be greater than zero" });
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return res.status(400).json({ msg: "Quantity must be greater than zero" });
    }

    if (!Number.isFinite(totalWeightKg) || totalWeightKg <= 0) {
      return res.status(400).json({ msg: "Total weight must be greater than zero" });
    }

    if (requiresOrganicCertificate(quality) && !organicCertificationNo) {
      return res.status(400).json({ msg: "Organic certification number is required for certified organic lots" });
    }

    let requestedGradeLots = [];
    try {
      requestedGradeLots = Array.isArray(req.body.gradeLots)
        ? req.body.gradeLots
        : typeof req.body.gradeLots === "string"
          ? JSON.parse(req.body.gradeLots || "[]")
          : [];
    } catch {
      return res.status(400).json({ msg: "Invalid grade lot details" });
    }

    if (!Array.isArray(requestedGradeLots)) {
      return res.status(400).json({ msg: "Invalid grade lot details" });
    }

    const gradeLots = requestedGradeLots.map((lot) => {
      const existingLot = (product.gradeLots || []).find((item) => item.grade === lot.grade) || {};
      const boxes = Number(lot.boxes || 0);
      const weightKg = Number(lot.weightKg || 0);
      return {
        grade: lot.grade,
        boxes,
        weightKg,
        images: existingLot.images || [],
        imageObjects: existingLot.imageObjects || [],
      };
    });

    const totalGradeBoxes = gradeLots.reduce((sum, lot) => sum + Number(lot.boxes || 0), 0);
    if (totalGradeBoxes <= 0) {
      return res.status(400).json({ msg: "At least one grade lot with boxes is required" });
    }

    product.title = title;
    product.fruitName = fruitName;
    product.variety = variety;
    product.quality = quality;
    product.organicCertificationNo = organicCertificationNo;
    product.description = description;
    product.packingType = packingType;
    product.packingWeightKg = packingWeightKg;
    product.totalWeightKg = totalWeightKg;
    product.quantity = quantity;
    product.basePrice = basePrice;
    product.location = location;
    product.gradeLots = gradeLots;

    await product.save();

    const linkedAuction = await Auction.findOne({ product: product._id, status: "SCHEDULED" });
    if (linkedAuction) {
      linkedAuction.startingPrice = basePrice;
      linkedAuction.currentBid = basePrice;
      await linkedAuction.save();
    }

    res.json({ message: "Product updated", product });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// DELETE PRODUCT BEFORE IT GOES TO MARKET
export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ msg: "Product not found" });
    }

    if (product.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ msg: "You can delete only your own listing" });
    }

    if (product.status === "SOLD") {
      return res.status(400).json({
        msg: "This lot cannot be deleted after deal confirmation",
      });
    }

    await Auction.deleteMany({ product: product._id });
    await Quotation.deleteMany({ lot: product._id });
    await product.deleteOne();

    res.json({ msg: "Listing deleted successfully" });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};
