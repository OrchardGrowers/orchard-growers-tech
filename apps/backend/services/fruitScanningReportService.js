import ScanRecord from "../models/ScanRecord.js";

const FINAL_SCAN_STATUSES = new Set(["COMPLETED", "REVIEW_REQUIRED", "FAILED"]);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const publicBoundingBox = (box = {}) => {
  const x = Number(box.x);
  const y = Number(box.y);
  const width = Number(box.width);
  const height = Number(box.height);
  if (![x, y, width, height].every(Number.isFinite)) return null;
  if (x < 0 || y < 0 || x >= 1 || y >= 1 || width <= 0 || height <= 0) return null;
  return {
    x: clamp(x, 0, 1),
    y: clamp(y, 0, 1),
    width: clamp(width, 0, 1 - x),
    height: clamp(height, 0, 1 - y),
  };
};
const publicDetection = (detection = {}) => ({
  category: String(detection.category || ""),
  label: String(detection.label || ""),
  confidence: Number.isFinite(Number(detection.confidence)) ? Number(detection.confidence) : null,
  boundingBox: publicBoundingBox(detection.boundingBox),
  obstruction: Boolean(detection.obstruction),
});

export const toPublicScanAnalysis = (scan = {}) => {
  const analysis = scan.analysis || {};
  return {
    scanId: scan.scanId,
    grade: analysis.grade || "",
    status: analysis.status || analysis.aiStatus || "NOT_AVAILABLE",
    analysisVersion: analysis.analysisVersion || analysis.aiVersion || "",
    modelProvider: analysis.modelProvider || "",
    modelVersion: analysis.modelVersion || "",
    analyzedAt: analysis.analyzedAt || null,
    capturedAt: scan.capturedAt || scan.createdAt || null,
    imagesAnalyzed: Number(analysis.imagesAnalyzed || 0),
    fruitCount: analysis.fruitCount ?? null,
    detections: Array.isArray(analysis.detections)
      ? analysis.detections.map(publicDetection)
      : [],
    colour: analysis.colour || null,
    size: analysis.size || null,
    shape: analysis.shape || null,
    surface: analysis.surface || null,
    maturity: analysis.maturity || null,
    russetingPercent: analysis.russetingPercent ?? null,
    decayPercent: analysis.decayPercent ?? null,
    defectPercent: analysis.defectPercent ?? null,
    uniformityScore: analysis.uniformityScore ?? null,
    imageQuality: analysis.imageQuality || null,
    warningCodes: Array.isArray(analysis.warningCodes) ? analysis.warningCodes : [],
    failureCode: analysis.failureCode || "",
    imageUrl: scan.image?.processed?.thumbnailUrl || scan.image?.thumbnailUrl || scan.image?.secureUrl || "",
  };
};

export const buildFruitScanningReport = (scans = []) => {
  const items = scans.map(toPublicScanAnalysis);
  const completed = items.filter((item) => item.status === "COMPLETED");
  const reviewRequired = items.filter((item) => item.status === "REVIEW_REQUIRED");
  const failed = items.filter((item) => item.status === "FAILED");
  const pending = items.filter((item) => item.status === "PENDING");
  const processing = items.filter((item) => item.status === "PROCESSING");
  const allFinal = items.length > 0 && items.every((item) => FINAL_SCAN_STATUSES.has(item.status));
  const status = !items.length
    ? "NOT_AVAILABLE"
    : processing.length
      ? "PROCESSING"
      : pending.length
        ? "PENDING"
        : reviewRequired.length
          ? "REVIEW_REQUIRED"
          : failed.length
            ? "FAILED"
            : allFinal && completed.length === items.length
              ? "COMPLETED"
              : "PENDING";
  const byGrade = Object.values(items.reduce((groups, item) => {
    const key = item.grade || "Ungraded";
    if (!groups[key]) groups[key] = { grade: key, analyses: [] };
    groups[key].analyses.push(item);
    return groups;
  }, {}));
  return {
    available: status === "COMPLETED",
    status,
    imagesCaptured: items.length,
    imagesAnalyzed: items.reduce((total, item) => total + item.imagesAnalyzed, 0),
    imagesCompleted: completed.length,
    imagesReviewRequired: reviewRequired.length,
    imagesFailed: failed.length,
    totalFruitCount: completed.reduce(
      (total, item) => total + (Number.isFinite(Number(item.fruitCount)) ? Number(item.fruitCount) : 0),
      0
    ),
    startedAt: items.map((item) => item.capturedAt).filter(Boolean).sort()[0] || null,
    completedAt: status === "COMPLETED"
      ? items.map((item) => item.analyzedAt).filter(Boolean).sort().at(-1) || null
      : null,
    warningCodes: Array.from(new Set(items.flatMap((item) => item.warningCodes || []))),
    analyses: items,
    byGrade,
  };
};

export const getFruitScanningReportForLot = async (lotId) => {
  const scans = await ScanRecord.find({
    fruitLotId: lotId,
    status: { $ne: "SUPERSEDED" },
  })
    .select("scanId capturedAt image.secureUrl image.thumbnailUrl image.processed.thumbnailUrl analysis createdAt")
    .sort({ createdAt: 1 })
    .lean();
  return buildFruitScanningReport(scans);
};
