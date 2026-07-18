const SCAN_VERSION = "camera-fruit-scan-result-v1";
const SUPPORTED_SCAN_PURPOSES = Object.freeze([
  "GROWER_LOT_SCAN",
  "BUYER_RECEIVING_SCAN",
]);

const createValidationError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export const createFruitScanResult = async (context, moduleResults = {}) => {
  if (!isPlainObject(context)) {
    throw createValidationError("Scan result context must be an object");
  }

  if (!isPlainObject(moduleResults)) {
    throw createValidationError("Scan result module results must be an object");
  }

  const capture = isPlainObject(context.capture) ? context.capture : context;
  if (!capture.scanId && !capture.captureSessionId) {
    throw createValidationError(
      "Scan result context requires a scanId or captureSessionId"
    );
  }

  if (
    moduleResults.segmentation !== undefined &&
    !isPlainObject(moduleResults.segmentation)
  ) {
    throw createValidationError("Segmentation result must be an object");
  }

  const scanPurpose = String(capture.scanPurpose || "").trim();
  if (!scanPurpose) {
    throw createValidationError("Scan purpose is required");
  }
  if (!SUPPORTED_SCAN_PURPOSES.includes(scanPurpose)) {
    throw createValidationError("Unsupported scan purpose");
  }

  return {
    status: "NOT_RUN",
    scanPurpose,
    scanVersion: SCAN_VERSION,
    fruitType: String(capture.fruitType || "").trim().slice(0, 100),
    visibleFruitCount: 0,
    detectedFruitRegions: [],
    colorSummary: {
      available: false,
      colors: [],
    },
    approximateSize: {
      available: false,
      value: null,
      unit: "",
    },
    visibleDefectIndicators: [],
    imageQuality: {
      status: "NOT_ASSESSED",
      score: null,
      warnings: [],
    },
    confidence: {
      overall: null,
      level: "NOT_ASSESSED",
    },
    warnings: [],
    diagnostics: {
      messages: ["Camera fruit scan analysis has not been run"],
      metrics: {},
      errors: [],
    },
    execution: {
      invoked: true,
      performed: false,
      startedAt: "",
      completedAt: "",
      durationMs: 0,
    },
  };
};
