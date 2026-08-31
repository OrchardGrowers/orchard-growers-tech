import PDFDocument from "pdfkit";
import axios from "axios";

const GREEN = "#166534";
const DARK = "#111827";
const MUTED = "#4b5563";
const text = (value, fallback = "Not available") =>
  value === undefined || value === null || value === "" ? fallback : String(value);
const dateTime = (value) => {
  const date = value ? new Date(value) : null;
  return !date || Number.isNaN(date.getTime())
    ? "Not available"
    : date.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
};

const ensureSpace = (doc, space = 55) => {
  if (doc.y + space > doc.page.height - 50) doc.addPage();
};
const section = (doc, title) => {
  ensureSpace(doc, 45);
  doc.moveDown(0.6).fillColor(GREEN).font("Helvetica-Bold").fontSize(12).text(title);
  doc.moveDown(0.25);
};
const rows = (doc, values) => {
  values.filter(([, value]) => value !== undefined && value !== null && value !== "").forEach(([label, value]) => {
    ensureSpace(doc, 24);
    const y = doc.y;
    doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(9).text(label, 50, y, { width: 170 });
    doc.fillColor(DARK).font("Helvetica").fontSize(9).text(text(value), 220, y, { width: 325 });
    doc.y = Math.max(doc.y, y + 18);
  });
};

const analysisRows = (analysis = {}) => [
  ["Grade", analysis.grade || "Ungraded"],
  ["Analysis status", analysis.status],
  ["Fruits detected", analysis.fruitCount],
  ["Colour (visual estimate)", analysis.colour?.dominant || analysis.colour?.label],
  ["Colour distribution", Array.isArray(analysis.colour?.distribution)
    ? analysis.colour.distribution.map((item) => typeof item === "string"
      ? item
      : `${item?.label || item?.colour || item?.color || ""}${item?.percent != null ? ` ${item.percent}%` : ""}`
    ).filter(Boolean).join(", ")
    : analysis.colour?.distribution],
  ["Estimated size", analysis.size?.category],
  ["Estimated diameter", analysis.size?.minimumDiameterMm != null && analysis.size?.maximumDiameterMm != null
    ? `${analysis.size.minimumDiameterMm}-${analysis.size.maximumDiameterMm} mm`
    : analysis.size?.diameterMm != null ? `${analysis.size.diameterMm} mm` : ""],
  ["Shape (visual estimate)", analysis.shape?.label],
  ["Shape uniformity", analysis.shape?.uniformityScore ?? analysis.shape?.uniformity],
  ["Surface condition", analysis.surface?.condition || analysis.surface?.label],
  ["Estimated maturity", analysis.maturity?.label || analysis.maturity?.percent],
  ["Suspected russeting", analysis.russetingPercent != null ? `${analysis.russetingPercent}%` : ""],
  ["Suspected decay", analysis.decayPercent != null ? `${analysis.decayPercent}%` : ""],
  ["Visible defects", analysis.defectPercent != null ? `${analysis.defectPercent}%` : ""],
  ["Uniformity score", analysis.uniformityScore != null ? `${analysis.uniformityScore}%` : ""],
  ["Analysis confidence", analysis.imageQuality?.confidence != null ? `${analysis.imageQuality.confidence}%` : ""],
  ["Images analysed", analysis.imagesAnalyzed],
  ["Analysed at", dateTime(analysis.analyzedAt)],
];

const cloudinaryPdfImageUrl = (value) => {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol !== "https:" || url.hostname !== "res.cloudinary.com") return "";
    if (!url.pathname.includes("/upload/")) return "";
    url.pathname = url.pathname.replace("/upload/", "/upload/f_jpg,q_auto,w_900/");
    return url.toString();
  } catch {
    return "";
  }
};

export const loadLotPdfImages = async (product = {}) => {
  const urls = [
    ...(product.imageObjects || []).map((item) => item?.url || item?.secure_url),
    ...(product.images || []),
  ].map(cloudinaryPdfImageUrl).filter(Boolean).slice(0, 2);
  const results = await Promise.allSettled(urls.map(async (url) => {
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 5000,
      maxContentLength: 3 * 1024 * 1024,
      maxBodyLength: 3 * 1024 * 1024,
    });
    if (!String(response.headers?.["content-type"] || "").toLowerCase().startsWith("image/")) {
      throw new Error("Cloudinary response is not an image");
    }
    return Buffer.from(response.data);
  }));
  return results.filter((result) => result.status === "fulfilled").map((result) => result.value);
};

export const createLotPdf = ({ product = {}, auction = {}, fruitScanningReport = {}, includePrivatePrice = false, sampleImages = [] } = {}) => {
  const doc = new PDFDocument({
    size: "A4",
    compress: false,
    margins: { top: 50, right: 50, bottom: 50, left: 50 },
    info: {
      Title: `eFruitMandi Lot ${product.lotNo || product._id || ""}`,
      Author: "Orchard Growers Private Limited",
      Subject: "eFruitMandi fruit lot information and visual scanning report",
    },
  });
  doc.fillColor(GREEN).font("Helvetica-Bold").fontSize(20).text("eFruitMandi.live");
  doc.fillColor(MUTED).font("Helvetica").fontSize(9).text("Fruit Lot Information & Visual Scanning Report");

  section(doc, "Lot Information");
  rows(doc, [
    ["Lot number", product.lotNo],
    ["Lot identifier", product._id],
    ["Fruit", product.fruitName || product.title],
    ["Variety", product.variety],
    ["Quality / grade", product.quality],
    ["Packing", product.packingType],
    ["Packages / cartons", product.quantity],
    ["Total pieces", product.packingSummary?.totalPieces],
    ["Net weight", product.totalWeightKg ? `${product.totalWeightKg} kg` : ""],
    ["Average fruit weight", product.packingSummary?.averageFruitWeightGrams ? `${product.packingSummary.averageFruitWeightGrams} g` : ""],
    ["Deal status", auction.status || product.status],
    ["Deal start", dateTime(auction.startTime || product.auctionStartTime)],
    ["Deal end", dateTime(auction.endTime || product.auctionEndTime)],
    ["Current public deal price", auction.currentBid],
  ]);

  if (includePrivatePrice && product.basePrice !== undefined) {
    section(doc, "Private Owner / Admin Information");
    rows(doc, [["Grower's private base price", product.basePrice]]);
  }

  section(doc, "Grower / Seller Public Information");
  rows(doc, [
    ["Name", product.createdBy?.name],
    ["Orchard / business", product.createdBy?.orchardName || product.createdBy?.businessName],
    ["Public location", product.location],
  ]);

  section(doc, "Size-wise Packing Details");
  (product.packingBreakdown || []).forEach((item) => rows(doc, [[
    item.size || item.packageSizeCode || "Packing",
    `${text(item.packageCount, "0")} packages, ${text(item.piecesPerPackage, "unknown")} pieces/package`,
  ]]));
  if (!(product.packingBreakdown || []).length) rows(doc, [["Details", "Not available"]]);

  if (sampleImages.length) {
    section(doc, "Fruit Lot Sample Images");
    sampleImages.slice(0, 2).forEach((image, index) => {
      ensureSpace(doc, 175);
      const y = doc.y;
      try {
        doc.image(image, 50, y, { fit: [495, 150], align: "center", valign: "center" });
        doc.y = y + 160;
      } catch {
        rows(doc, [[`Sample image ${index + 1}`, "Image could not be embedded"]]);
      }
    });
  }

  section(doc, "Fruit Scanning Report");
  if (!fruitScanningReport.available) {
    rows(doc, [
      ["Status", fruitScanningReport.status || "NOT_AVAILABLE"],
      ["Images captured", fruitScanningReport.imagesCaptured],
      ["Images analysed", fruitScanningReport.imagesAnalyzed],
      ["Report", fruitScanningReport.status === "REVIEW_REQUIRED"
        ? "Fruit scanning report requires review. No estimated measurements have been fabricated."
        : fruitScanningReport.status === "PENDING" || fruitScanningReport.status === "PROCESSING"
          ? "Fruit scanning report is being prepared."
          : "Fruit scanning report not available for this lot."],
    ]);
  } else {
    rows(doc, [
      ["Scanning status", fruitScanningReport.status],
      ["Images captured", fruitScanningReport.imagesCaptured],
      ["Images analysed", fruitScanningReport.imagesAnalyzed],
      ["Total fruits detected", fruitScanningReport.totalFruitCount],
      ["Scanning started", dateTime(fruitScanningReport.startedAt)],
      ["Scanning completed", dateTime(fruitScanningReport.completedAt)],
    ]);
    fruitScanningReport.analyses.filter((item) => item.status === "COMPLETED").forEach((item) => rows(doc, analysisRows(item)));
  }

  section(doc, "Document Information");
  rows(doc, [["Generated at", dateTime(new Date())], ["Verification reference", `LOT-${product._id || "UNAVAILABLE"}`]]);
  doc.moveDown().fillColor(MUTED).font("Helvetica-Oblique").fontSize(8).text(
    "This report is based on visual/image analysis and should be treated as an estimated quality assessment. It is not laboratory certification. Internal condition, chemicals, sweetness and pesticide residue cannot be determined from these images."
  );
  // Let callers attach their HTTP pipe/data listeners before PDFKit starts
  // flushing the finalized document. This avoids truncating small PDFs.
  queueMicrotask(() => doc.end());
  return doc;
};
