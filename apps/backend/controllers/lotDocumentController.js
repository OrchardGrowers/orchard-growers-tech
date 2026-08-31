import Product from "../models/Product.js";
import Auction from "../models/Auction.js";
import Order from "../models/Order.js";
import { canAccessNonPublicLot } from "./productController.js";
import { canAccessLotDetail, isValidLotLookupId } from "../services/publicLotAccessService.js";
import { getCompletedMarketplaceOrder } from "../services/dealLifecycleService.js";
import { canViewPrivateLotPrice, sanitizeLotPricing } from "../services/lotPricePrivacyService.js";
import { getFruitScanningReportForLot } from "../services/fruitScanningReportService.js";
import { createLotPdf, loadLotPdfImages } from "../services/lotPdfService.js";

export const downloadLotPdf = async (req, res) => {
  try {
    if (!isValidLotLookupId(req.params.id)) return res.status(404).json({ msg: "Product not found" });
    const product = await Product.findById(req.params.id)
      .populate("createdBy", "name orchardName businessName role")
      .lean();
    const order = product
      ? await Order.findOne({ product: product._id })
        .select("paymentStatus deliveryStatus")
        .sort({ updatedAt: -1, createdAt: -1 })
        .lean()
      : null;
    const completedOrder = getCompletedMarketplaceOrder(order);
    if (!product || !canAccessLotDetail({
      product,
      platform: String(req.query.platform || "efruitmandi"),
      completedOrder,
      allowNonPublic: canAccessNonPublicLot(product, req.user),
    })) return res.status(404).json({ msg: "Product not found" });

    const auction = await Auction.findOne({ product: product._id }).sort({ createdAt: -1 }).lean();
    const fruitScanningReport = await getFruitScanningReportForLot(product._id);
    const sampleImages = await loadLotPdfImages(product);
    const includePrivatePrice = canViewPrivateLotPrice(product, req.user);
    const safeProduct = sanitizeLotPricing(product, { product, viewer: req.user });
    const safeAuction = sanitizeLotPricing(auction || {}, { product, viewer: req.user });
    const fileName = String(product.lotNo || product._id).replace(/[^A-Za-z0-9._-]/g, "-");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="eFruitMandi-lot-${fileName}.pdf"`);
    res.setHeader("Cache-Control", "private, no-store");
    createLotPdf({
      product: safeProduct,
      auction: safeAuction,
      fruitScanningReport,
      includePrivatePrice,
      sampleImages,
    }).pipe(res);
  } catch (error) {
    if (!res.headersSent) return res.status(500).json({ msg: "Lot PDF could not be generated" });
    res.destroy(error);
  }
};
