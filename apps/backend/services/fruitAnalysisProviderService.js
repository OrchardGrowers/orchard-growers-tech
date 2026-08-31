import axios from "axios";
import ScanRecord from "../models/ScanRecord.js";

export const FRUIT_ANALYSIS_VERSION = "fruit-object-analysis-v1";
const VALID_CATEGORIES = new Set(["FRUIT", "OBSTRUCTION", "NON_FRUIT"]);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const normalizeBox = (box = {}) => {
  const values = [box.x, box.y, box.width, box.height].map(Number);
  if (!values.every(Number.isFinite)) return null;
  const [x, y, width, height] = values;
  if (width <= 0 || height <= 0 || x < 0 || y < 0 || x >= 1 || y >= 1) return null;
  return {
    x: clamp(x, 0, 1),
    y: clamp(y, 0, 1),
    width: clamp(width, 0, 1 - x),
    height: clamp(height, 0, 1 - y),
  };
};

const intersectionOverUnion = (left, right) => {
  const x1 = Math.max(left.x, right.x);
  const y1 = Math.max(left.y, right.y);
  const x2 = Math.min(left.x + left.width, right.x + right.width);
  const y2 = Math.min(left.y + left.height, right.y + right.height);
  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = left.width * left.height + right.width * right.height - intersection;
  return union > 0 ? intersection / union : 0;
};

export const normalizeProviderDetections = (detections = []) => {
  const normalized = (Array.isArray(detections) ? detections : []).slice(0, 500)
    .map((item = {}) => {
      const category = String(item.category || "").trim().toUpperCase();
      const boundingBox = normalizeBox(item.boundingBox);
      const confidence = Number(item.confidence);
      if (!VALID_CATEGORIES.has(category) || !boundingBox || !Number.isFinite(confidence)) return null;
      return {
        category,
        label: String(item.label || category).trim().slice(0, 80),
        confidence: clamp(confidence, 0, 1),
        boundingBox,
        obstruction: category === "OBSTRUCTION",
      };
    })
    .filter(Boolean)
    .sort((left, right) => right.confidence - left.confidence);

  return normalized.filter((candidate, index) => {
    if (candidate.category !== "FRUIT") return true;
    return !normalized.slice(0, index).some((kept) =>
      kept.category === "FRUIT" &&
      kept.label.toLowerCase() === candidate.label.toLowerCase() &&
      intersectionOverUnion(kept.boundingBox, candidate.boundingBox) >= 0.55
    );
  });
};

export const normalizeProviderResult = (result = {}) => {
  const detections = normalizeProviderDetections(result.detections);
  const fruitDetections = detections.filter((item) => item.category === "FRUIT");
  const significantObstruction = detections.some((item) =>
    item.category === "OBSTRUCTION" &&
    item.confidence >= 0.5 &&
    item.boundingBox.width * item.boundingBox.height >= 0.12
  );
  const requestedStatus = String(result.status || "COMPLETED").trim().toUpperCase();
  const modelProvider = String(result.modelProvider || "").trim().slice(0, 100);
  const modelVersion = String(result.modelVersion || "").trim().slice(0, 100);
  if (!modelProvider || !modelVersion) throw new Error("Analysis provider and model version are required");

  const reviewCode = significantObstruction
    ? "TOO_MUCH_OBSTRUCTION"
    : fruitDetections.length === 0
      ? "FRUIT_NOT_DETECTED"
      : "";
  const status = reviewCode
    ? "REVIEW_REQUIRED"
    : ["COMPLETED", "FAILED", "REVIEW_REQUIRED"].includes(requestedStatus)
      ? requestedStatus
      : "REVIEW_REQUIRED";

  return {
    status,
    analysisVersion: FRUIT_ANALYSIS_VERSION,
    modelProvider,
    modelVersion,
    analyzedAt: new Date(),
    imagesAnalyzed: 1,
    fruitCount: fruitDetections.length,
    detections,
    colour: status === "COMPLETED" ? result.colour || null : null,
    size: status === "COMPLETED" ? result.size || null : null,
    shape: status === "COMPLETED" ? result.shape || null : null,
    surface: status === "COMPLETED" ? result.surface || null : null,
    maturity: status === "COMPLETED" ? result.maturity || null : null,
    russetingPercent: status === "COMPLETED" ? result.russetingPercent ?? null : null,
    decayPercent: status === "COMPLETED" ? result.decayPercent ?? null : null,
    defectPercent: status === "COMPLETED" ? result.defectPercent ?? null : null,
    uniformityScore: status === "COMPLETED" ? result.uniformityScore ?? null : null,
    imageQuality: result.imageQuality || null,
    warningCodes: Array.from(new Set([
      ...(Array.isArray(result.warningCodes) ? result.warningCodes : []),
      ...(reviewCode ? [reviewCode] : []),
    ])).map((code) => String(code).trim().slice(0, 100)).filter(Boolean).slice(0, 50),
    failureCode: reviewCode || (status === "FAILED" ? String(result.failureCode || "ANALYSIS_FAILED") : ""),
    aiStatus: status,
    aiVersion: FRUIT_ANALYSIS_VERSION,
  };
};

export const hasCurrentCompletedFruitAnalysis = (analysis = {}, imageContentHash = "") =>
  Boolean(
    imageContentHash &&
    analysis.status === "COMPLETED" &&
    analysis.analysisVersion === FRUIT_ANALYSIS_VERSION &&
    analysis.imageContentHash === imageContentHash
  );

export const runConfiguredFruitAnalysis = async (scanRecordId) => {
  const providerUrl = String(process.env.FRUIT_ANALYSIS_PROVIDER_URL || "").trim();
  if (!providerUrl) return null;
  const scan = await ScanRecord.findById(scanRecordId)
    .select("+image.contentHash scanId fruitLotId fruitType fruitVariety scanMode image analysis")
    .lean();
  if (!scan || scan.status === "SUPERSEDED") return null;
  if (hasCurrentCompletedFruitAnalysis(scan.analysis, scan.image?.contentHash)) return scan.analysis;

  await ScanRecord.updateOne({ _id: scan._id }, {
    $set: { "analysis.status": "PROCESSING", "analysis.aiStatus": "PROCESSING" },
  });
  try {
    const response = await axios.post(providerUrl, {
      scanId: scan.scanId,
      lotId: scan.fruitLotId,
      fruitType: scan.fruitType,
      fruitVariety: scan.fruitVariety,
      scanMode: scan.scanMode,
      imageUrl: scan.image?.processed?.secureUrl || scan.image?.secureUrl,
      imageContentHash: scan.image?.contentHash,
      analysisVersion: FRUIT_ANALYSIS_VERSION,
    }, {
      timeout: Number(process.env.FRUIT_ANALYSIS_PROVIDER_TIMEOUT_MS || 30000),
      maxBodyLength: 1024 * 1024,
      maxContentLength: 1024 * 1024,
      headers: {
        ...(process.env.FRUIT_ANALYSIS_PROVIDER_TOKEN
          ? { Authorization: `Bearer ${process.env.FRUIT_ANALYSIS_PROVIDER_TOKEN}` }
          : {}),
        "Idempotency-Key": `${scan.image?.contentHash || scan.scanId}:${FRUIT_ANALYSIS_VERSION}`,
      },
    });
    const analysis = normalizeProviderResult(response.data);
    analysis.grade = scan.analysis?.grade || "";
    analysis.imageContentHash = scan.image?.contentHash || "";
    await ScanRecord.updateOne({ _id: scan._id, status: { $ne: "SUPERSEDED" } }, { $set: { analysis } });
    return analysis;
  } catch (error) {
    await ScanRecord.updateOne({ _id: scan._id, status: { $ne: "SUPERSEDED" } }, { $set: {
      "analysis.status": "FAILED",
      "analysis.aiStatus": "FAILED",
      "analysis.failureCode": error?.code === "ECONNABORTED" ? "ANALYSIS_TIMEOUT" : "ANALYSIS_PROVIDER_UNAVAILABLE",
      "analysis.warningCodes": ["ANALYSIS_PROVIDER_UNAVAILABLE"],
      "analysis.analyzedAt": new Date(),
    } });
    return null;
  }
};
