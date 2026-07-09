import Product from "../models/Product.js";
import Auction from "../models/Auction.js";
import Quotation from "../models/Quotation.js";
import Order from "../models/Order.js";
import User from "../models/User.js";
import CaptureSession from "../models/CaptureSession.js";
import {
  getResourceType,
  uploadBufferToCloudinary,
  uploadBuffersToCloudinary,
} from "../services/cloudinaryService.js";
import {
  buildMarketplaceLifecycle,
  getCompletedMarketplaceOrder,
  isOrderCompletedForMarketplace,
  isOrderProtectedFromGrowerDelete,
  isPublicLotVisible,
  resolveDealSchedule,
} from "../services/dealLifecycleService.js";

const PUBLIC_PROFILE_SELECT =
  "name orchardName businessName buyerContactPerson companyLogoUrl avatarUrl bannerUrl buyerAvatarUrl buyerCompanyLogoUrl role profileTypes growerVerified buyerVerified growerOgVerified buyerOgVerified driverOgVerified ogVerificationByRole growerRatingAverage growerRatingCount mapLatitude mapLongitude createdAt";
const CLOSED_PRODUCT_STATUSES = new Set(["SOLD", "QUOTE_ACCEPTED", "DEAL_CONFIRMED", "quote_accepted", "deal_confirmed"]);
const CLOSED_AUCTION_STATUSES = new Set(["ENDED", "CLOSED", "COMPLETED"]);
const ACCEPTED_QUOTE_STATUSES = ["accepted", "ACCEPTED"];

const createRequestError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const emitEfruitMandiMarketUpdate = (req, action, payload = {}) => {
  const io = req.app?.get("io");
  if (!io) return;

  io.emit("efruitmandiMarketUpdated", {
    platform: "efruitmandi",
    action,
    updatedAt: new Date().toISOString(),
    ...payload,
  });
};

const canSeeBasePrice = (product, user) =>
  (user?.role === "grower" ||
    (Array.isArray(user?.profileTypes) && user.profileTypes.includes("grower"))) &&
  product?.createdBy &&
  (product.createdBy._id || product.createdBy)?.toString() === user.id?.toString();

const serializeProduct = (product, user, completedOrder = null) => {
  const data = product.toObject ? product.toObject() : { ...product };
  if (completedOrder) {
    Object.assign(data, buildMarketplaceLifecycle(completedOrder));
  }

  if (!canSeeBasePrice(data, user) && data.createdSource !== "admin-panel") {
    delete data.basePrice;
  }

  return data;
};

const firstFiniteNumber = (...values) => {
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue;
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return undefined;
};

const isClosedProductStatus = (status = "") =>
  CLOSED_PRODUCT_STATUSES.has(String(status || "").trim().toUpperCase()) ||
  CLOSED_PRODUCT_STATUSES.has(String(status || "").trim());

const isClosedAuctionStatus = (status = "") =>
  CLOSED_AUCTION_STATUSES.has(String(status || "").trim().toUpperCase());

const isWrongProductPlatform = (product, platform = "") => {
  const isOrchardPlatform = ["orchard", "orchardgrowers", "orchard-growers"].includes(platform);
  const isEfruitPlatform = ["efruitmandi", "efruit", "mandi"].includes(platform);
  const hasGradeLots = Array.isArray(product?.gradeLots) && product.gradeLots.length > 0;

  return (
    (isOrchardPlatform && product?.createdSource !== "admin-panel" && hasGradeLots) ||
    (isEfruitPlatform && product?.createdSource === "admin-panel")
  );
};

const buildClosedDealSummary = ({ product, auction, acceptedQuote, order }) => {
  const completedOrder = getCompletedMarketplaceOrder(order);
  if (!completedOrder) return null;

  const buyer = completedOrder?.buyer || acceptedQuote?.buyer || product?.acceptedBuyerId || auction?.highestBidder || null;
  const grower = completedOrder?.grower || acceptedQuote?.grower || product?.createdBy || null;
  const primaryQuoteGrade = Array.isArray(acceptedQuote?.grades) ? acceptedQuote.grades[0] : null;
  const finalValue = firstFiniteNumber(
    product?.finalDealValue,
    product?.finalPrice,
    completedOrder?.finalPrice,
    completedOrder?.totalAmount,
    completedOrder?.auctionPrice,
    acceptedQuote?.dealAmount,
    acceptedQuote?.buyerPayableThroughPlatform,
    acceptedQuote?.buyerPayable,
    acceptedQuote?.quotedTotalValue,
    auction?.dealBreakdown?.dealAmount,
    auction?.currentBid
  );
  const closedRate = firstFiniteNumber(
    auction?.highestGradeRate,
    completedOrder?.highestGradeRate,
    acceptedQuote?.quotedPrice,
    primaryQuoteGrade?.price,
    primaryQuoteGrade?.quotedRatePerUnit,
    finalValue
  );

  return {
    status: "Deal Closed",
    closedRate,
    finalDealValue: finalValue,
    soldBy: grower,
    purchasedBy: buyer,
    grade: auction?.highestGrade || completedOrder?.highestGrade || primaryQuoteGrade?.grade || "",
    closedAt:
      acceptedQuote?.acceptedAt ||
      completedOrder?.updatedAt ||
      auction?.updatedAt ||
      auction?.endTime ||
      product?.updatedAt ||
      null,
    source: acceptedQuote ? "quote" : auction ? "deal" : "lot",
  };
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

const isLocalTestAccount = (user = {}) => {
  if (process.env.NODE_ENV === "production") return false;
  if (process.env.ALLOW_TEST_OTP !== "true") return false;

  const email = String(user.email || "").trim().toLowerCase();
  const phone = String(user.phone || user.contact || "").trim();

  return (
    email === "testbuyer@efruitmandi.live" ||
    email === "testgrower@efruitmandi.live" ||
    email === "testdriver@efruitmandi.live" ||
    phone === "1234567890" ||
    phone === "1234567891" ||
    phone === "1234567892"
  );
};

const hasCompletedKyc = (user = {}, roleType = "") => {
  const role = String(roleType || "").toLowerCase();
  const roleKyc = user?.kycByRole?.[role] || {};
  const legacyKyc = String(user?.kyc?.roleType || "").toLowerCase() === role ? user.kyc : {};
  return String(roleKyc.status || legacyKyc.status || "").toUpperCase() === "APPROVED";
};

const requireCompletedKyc = async (userId) => {
  const user = await User.findById(userId).select("email phone contact kyc kycByRole growerVerified");

  if (isLocalTestAccount(user)) {
    return true;
  }

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

const parseCaptureMediaRefs = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") return JSON.parse(value || "[]");
  return [];
};

const getGradeKeyFromLot = (lot = {}) => {
  if (lot.gradeKey) return String(lot.gradeKey);
  const fieldName = String(lot.fieldName || "");
  return fieldName.startsWith("gradeImages_")
    ? fieldName.replace("gradeImages_", "")
    : "";
};

const isCaptureSessionExpired = (session) =>
  !session?.expiresAt || new Date(session.expiresAt).getTime() <= Date.now();

const toCapturedMedia = (session, slotIndex = null) => ({
  url: session.media.url,
  secure_url: session.media.secure_url || session.media.url,
  publicId: session.media.publicId,
  folder: session.media.folder,
  resourceType: session.media.resourceType,
  slotIndex,
});

const resolveCaptureMediaRefs = async (refs = [], userId) => {
  const normalizedRefs = refs
    .map((ref) => ({
      sessionId: String(ref?.sessionId || ref?.captureSessionId || "").trim(),
      mediaType: String(ref?.mediaType || "").trim().toLowerCase(),
    }))
    .filter((ref) => ref.sessionId);

  const result = {
    imagesByGradeKey: new Map(),
    sampleVideo: null,
    sessionIds: [],
  };

  if (!normalizedRefs.length) {
    return result;
  }

  const sessionIds = Array.from(new Set(normalizedRefs.map((ref) => ref.sessionId)));
  const sessions = await CaptureSession.find({
    sessionId: { $in: sessionIds },
    userId,
  });
  const sessionById = new Map(sessions.map((session) => [session.sessionId, session]));

  for (const ref of normalizedRefs) {
    const session = sessionById.get(ref.sessionId);

    if (!session) {
      throw createRequestError(400, "Invalid mobile capture session");
    }

    if (isCaptureSessionExpired(session)) {
      throw createRequestError(410, "Mobile capture session expired");
    }

    if (!session.media?.url) {
      throw createRequestError(400, "Mobile capture media is not uploaded yet");
    }

    if (ref.mediaType && ref.mediaType !== session.mediaType) {
      throw createRequestError(400, "Mobile capture media type mismatch");
    }

    result.sessionIds.push(session.sessionId);

    if (session.mediaType === "video") {
      result.sampleVideo = toCapturedMedia(session);
      continue;
    }

    const gradeKey = String(session.gradeKey || "").trim();
    const slotIndex = Number(session.slotIndex);
    if (!gradeKey || !Number.isInteger(slotIndex)) {
      throw createRequestError(400, "Mobile capture image slot is invalid");
    }

    const capturedImages = result.imagesByGradeKey.get(gradeKey) || [];
    capturedImages.push(toCapturedMedia(session, slotIndex));
    capturedImages.sort((a, b) => Number(a.slotIndex || 0) - Number(b.slotIndex || 0));
    result.imagesByGradeKey.set(gradeKey, capturedImages);
  }

  result.sessionIds = Array.from(new Set(result.sessionIds));
  return result;
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

    let captureMediaRefs = [];
    try {
      captureMediaRefs = parseCaptureMediaRefs(req.body.captureMediaRefs);
    } catch {
      return res.status(400).json({ msg: "Invalid mobile capture media details" });
    }

    if (!Array.isArray(captureMediaRefs)) {
      return res.status(400).json({ msg: "Invalid mobile capture media details" });
    }

    const resolvedCaptureMedia = await resolveCaptureMediaRefs(captureMediaRefs, req.user.id);

    const gradeLotFiles = requestedGradeLots.map((lot) => ({
      lot,
      gradeKey: getGradeKeyFromLot(lot),
      files: getUploadedFiles(req, lot.fieldName).slice(0, 5),
    }));

    const uploadedGradeLots = await Promise.all(
      gradeLotFiles.map(async ({ lot, gradeKey, files }) => {
        const uploadedFiles = await uploadLotFiles(files, "image");
        const capturedImages = resolvedCaptureMedia.imagesByGradeKey.get(gradeKey) || [];

        return {
          lot,
          uploadedFiles: [...capturedImages, ...uploadedFiles].slice(0, 5),
        };
      })
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
      : resolvedCaptureMedia.sampleVideo;
    const sampleVideo = uploadedSampleVideo?.url || "";
    if (uploadedSampleVideo?.publicId) uploadedPublicIds.push(uploadedSampleVideo.publicId);
    const dealSchedule = resolveDealSchedule(new Date());
    const auctionStartAt = dealSchedule.startTime;
    const auctionEndAt = dealSchedule.endTime;

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
      auctionEndTime: auctionEndAt,
      location,
      images: imagePaths,
      imageObjects,
      imagePublicIds: uploadedPublicIds,
      gradeLots,
      sampleVideo,
      createdBy: req.user.id,
      status: dealSchedule.isLiveNow ? "IN_AUCTION" : "SCHEDULED",
    });

    const auction = await Auction.create({
      product: product._id,
      startingPrice: Number(basePrice || 0),
      currentBid: Number(basePrice || 0),
      status: dealSchedule.isLiveNow ? "ACTIVE" : "SCHEDULED",
      startTime: auctionStartAt,
      endTime: auctionEndAt,
    });

    if (resolvedCaptureMedia.sessionIds.length) {
      await CaptureSession.updateMany(
        { sessionId: { $in: resolvedCaptureMedia.sessionIds }, userId: req.user.id },
        { $set: { status: "attached", attachedProduct: product._id } }
      );
    }

    emitEfruitMandiMarketUpdate(req, "lot-created", {
      productId: product._id,
      auctionId: auction._id,
    });

    res.json({
      message: "Product created",
      product,
      auction,
    });
  } catch (err) {
    console.error("Product creation failed:", err.message || err);
    res.status(err.statusCode || 500).json({ msg: err.message });
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
    const productIds = products.map((product) => product._id).filter(Boolean);
    const completedOrders = productIds.length
      ? await Order.find({ product: { $in: productIds } })
          .select("_id product paymentStatus deliveryStatus")
          .lean()
      : [];
    const completedOrderByProductId = completedOrders.filter(Boolean).reduce((map, order) => {
      if (isOrderCompletedForMarketplace(order)) {
        map.set(String(order.product), order);
      }
      return map;
    }, new Map());

    const requesterId = req.user?.id?.toString();
    const now = new Date();
    const visibleProducts = products.filter((product) => {
      const productObject = product.toObject ? product.toObject() : product;
      const status = String(productObject.status || "").trim().toUpperCase();
      if (productObject.active === false || ["EXPIRED", "CANCELLED", "DELETED"].includes(status)) {
        return false;
      }
      const creator = productObject.createdBy?._id || productObject.createdBy;
      if (requesterId && creator?.toString() === requesterId) return true;
      return isPublicLotVisible(productObject, completedOrderByProductId.get(String(productObject._id)) || null, now);
    });

    res.json(
      visibleProducts.map((product) =>
        serializeProduct(product, req.user, completedOrderByProductId.get(String(product._id)))
      )
    );
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// GET SINGLE PRODUCT WITH AUCTION DETAIL
export const getProductById = async (req, res) => {
  try {
    const platform = String(req.query.platform || "").trim().toLowerCase();
    let product = await Product.findById(req.params.id)
      .populate("createdBy", PUBLIC_PROFILE_SELECT)
      .populate("acceptedBuyerId", PUBLIC_PROFILE_SELECT);
    let auction = null;

    if (!product) {
      auction = await Auction.findById(req.params.id)
        .populate({
          path: "product",
          populate: [
            { path: "createdBy", select: PUBLIC_PROFILE_SELECT },
            { path: "acceptedBuyerId", select: PUBLIC_PROFILE_SELECT },
          ],
        })
        .populate("highestBidder", PUBLIC_PROFILE_SELECT);
      product = auction?.product || null;
    }

    if (!product || product.inventoryType === "raw_material" || isWrongProductPlatform(product, platform)) {
      return res.status(404).json({ msg: "Product not found" });
    }

    if (!auction) {
      auction = await Auction.findOne({ product: product._id })
        .sort({ createdAt: -1 })
        .populate("highestBidder", PUBLIC_PROFILE_SELECT);
    }

    const acceptedQuoteId = product.acceptedQuoteId?._id || product.acceptedQuoteId;
    const acceptedQuoteFilters = [{ lot: product._id, status: { $in: ACCEPTED_QUOTE_STATUSES } }];
    if (acceptedQuoteId) acceptedQuoteFilters.unshift({ _id: acceptedQuoteId });
    const acceptedQuote = await Quotation.findOne({ $or: acceptedQuoteFilters })
      .select(
        "_id lot buyer grower grades quotedPrice quotedTotalValue dealAmount buyerPayable buyerPayableThroughPlatform status acceptedAt createdAt updatedAt"
      )
      .populate("buyer", PUBLIC_PROFILE_SELECT)
      .populate("grower", PUBLIC_PROFILE_SELECT)
      .sort({ acceptedAt: -1, updatedAt: -1 })
      .lean();

    const orderFilters = [{ product: product._id }];
    if (auction?._id) orderFilters.unshift({ auction: auction._id });
    if (acceptedQuote?._id) orderFilters.unshift({ quote: acceptedQuote._id });
    const order = await Order.findOne({ $or: orderFilters })
      .select(
        "_id auction quote product buyer grower auctionPrice finalPrice totalAmount highestGrade highestGradeRate dealBreakdown paymentStatus deliveryStatus createdAt updatedAt"
      )
      .populate("buyer", PUBLIC_PROFILE_SELECT)
      .populate("grower", PUBLIC_PROFILE_SELECT)
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean();

    const completedOrder = getCompletedMarketplaceOrder(order);
    const serializedProduct = serializeProduct(product, req.user, completedOrder);
    const serializedAuction = auction?.toObject ? auction.toObject() : auction;
    if (serializedAuction) {
      if (completedOrder) {
        Object.assign(serializedAuction, buildMarketplaceLifecycle(completedOrder));
      }
    }
    const closedDeal = buildClosedDealSummary({
      product: serializedProduct,
      auction: serializedAuction,
      acceptedQuote,
      order,
    });

    if (serializedAuction && !canSeeBasePrice(serializedProduct, req.user)) {
      delete serializedAuction.startingPrice;
    }

    res.json({ product: serializedProduct, auction: serializedAuction, closedDeal });
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

    emitEfruitMandiMarketUpdate(req, "lot-updated", {
      productId: product._id,
      auctionId: linkedAuction?._id,
    });

    res.json({ message: "Product updated", product });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// REMOVE UNCONFIRMED / INCOMPLETE GROWER LOTS
export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ msg: "Product not found" });
    }

    if (product.createdBy?.toString() !== req.user.id?.toString()) {
      return res.status(403).json({ msg: "You can delete only your own listing" });
    }

    const relatedOrders = await Order.find({
      $or: [
        { product: product._id },
        { quote: product.acceptedQuoteId },
      ],
    }).select("_id paymentStatus deliveryStatus").lean();

    const protectedOrder = relatedOrders.find(isOrderProtectedFromGrowerDelete);
    if (protectedOrder) {
      return res.status(400).json({
        msg: "This lot has a confirmed or paid transaction and cannot be deleted from the grower dashboard.",
      });
    }

    const now = new Date();
    await Promise.all([
      Auction.updateMany(
        { product: product._id, status: { $in: ["SCHEDULED", "ACTIVE", "ENDED"] } },
        {
          $set: {
            status: "CANCELLED",
            cancelledAt: now,
            cancelledBy: req.user.id,
            cancellationReason: "Removed by grower before deal completion",
          },
        }
      ),
      Quotation.updateMany(
        { lot: product._id, status: { $in: ["pending", "SUBMITTED", "accepted", "ACCEPTED"] } },
        { $set: { status: "cancelled", rejectedAt: now } }
      ),
      Order.deleteMany({
        product: product._id,
        paymentStatus: { $in: ["PENDING", "FAILED"] },
        deliveryStatus: { $nin: ["IN_TRANSIT", "DELIVERED"] },
      }),
    ]);

    product.active = false;
    product.status = "DELETED";
    product.deletedAt = now;
    product.deletedBy = req.user.id;
    product.deletionReason = "Removed by grower before deal completion";
    await product.save();

    emitEfruitMandiMarketUpdate(req, "lot-deleted", {
      productId: product._id,
    });

    res.json({ msg: "Unconfirmed lot removed successfully" });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};




