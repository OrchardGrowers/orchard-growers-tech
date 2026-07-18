const ANALYSIS_VERSION = "fruit-analysis-v1";
const NOT_RUN = "NOT_RUN";

const createValidationError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const assertOptionalObject = (value, fieldName) => {
  if (value !== undefined && !isPlainObject(value)) {
    throw createValidationError(`${fieldName} must be an object`);
  }
};

const optionalText = (value, maxLength = 256) =>
  String(value ?? "").trim().slice(0, maxLength);

const optionalNumber = (value) => {
  if (value === null || value === undefined || value === "") return 0;
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const optionalDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
};

const normalizeImageMetadata = (value = {}) => ({
  format: optionalText(value.format, 30),
  width: optionalNumber(value.width),
  height: optionalNumber(value.height),
  orientation: optionalNumber(value.orientation),
  space: optionalText(value.space, 30),
  channels: optionalNumber(value.channels),
  byteSize: optionalNumber(value.byteSize),
  mimeType: optionalText(value.mimeType, 100),
});

const normalizeCapture = (input) => {
  const capture = input.capture || {};
  return {
    scanId: optionalText(capture.scanId || input.scanId, 128),
    captureSessionId: optionalText(
      capture.captureSessionId || input.captureSessionId,
      128
    ),
    fruitLotId: optionalText(capture.fruitLotId, 128),
    growerId: optionalText(capture.growerId, 128),
    fruitType: optionalText(capture.fruitType, 100),
    fruitVariety: optionalText(capture.fruitVariety, 100),
    scanMode: optionalText(capture.scanMode, 50),
    captureSource: optionalText(capture.captureSource, 30),
    capturedAt: optionalDate(capture.capturedAt),
    uploadedAt: optionalDate(capture.uploadedAt),
  };
};

const normalizeProcessingAudit = (value = {}) => ({
  processingVersion: optionalText(value.processingVersion, 100),
  processingSteps: Array.isArray(value.processingSteps)
    ? value.processingSteps
        .map((step) => optionalText(step, 100))
        .filter(Boolean)
        .slice(0, 50)
    : [],
  processingDurationMs: Math.max(0, Math.round(optionalNumber(value.processingDurationMs))),
  originalChecksum: optionalText(value.originalChecksum, 128),
  processedChecksum: optionalText(value.processedChecksum, 128),
});

const normalizeCalibration = (value = {}) => ({
  status: optionalText(value.status, 50),
  method: optionalText(value.method, 50),
  pixelsPerMm: Math.max(0, optionalNumber(value.pixelsPerMm)),
  confidence: Math.max(0, Math.min(1, optionalNumber(value.confidence))),
  calibrationVersion: optionalText(value.calibrationVersion, 100),
});

const normalizeOptions = (value = {}) => ({
  profile: optionalText(value.profile, 100),
  requestedModules: Array.isArray(value.requestedModules)
    ? Array.from(
        new Set(
          value.requestedModules
            .map((moduleName) => optionalText(moduleName, 100))
            .filter(Boolean)
        )
      ).slice(0, 20)
    : [],
});

export const analyzeFruitCapture = async (input) => {
  const startedAtMs = Date.now();
  const analysisStartedAt = new Date(startedAtMs).toISOString();

  if (!isPlainObject(input)) {
    throw createValidationError("Fruit analysis input must be an object");
  }

  assertOptionalObject(input.capture, "capture");
  assertOptionalObject(input.originalImage, "originalImage");
  assertOptionalObject(input.processedImage, "processedImage");
  assertOptionalObject(input.processingAudit, "processingAudit");
  assertOptionalObject(input.calibration, "calibration");
  assertOptionalObject(input.options, "options");

  const capture = normalizeCapture(input);
  if (!capture.scanId && !capture.captureSessionId) {
    throw createValidationError(
      "A scanId or captureSessionId is required for fruit analysis"
    );
  }

  const context = {
    capture,
    originalImage: normalizeImageMetadata(input.originalImage),
    processedImage: normalizeImageMetadata(input.processedImage),
    processingAudit: normalizeProcessingAudit(input.processingAudit),
    calibration: normalizeCalibration(input.calibration),
    options: normalizeOptions(input.options),
  };

  const completedAtMs = Date.now();
  return {
    analysisVersion: ANALYSIS_VERSION,
    analysisStartedAt,
    analysisCompletedAt: new Date(completedAtMs).toISOString(),
    analysisDurationMs: Math.max(0, completedAtMs - startedAtMs),
    status: "PLACEHOLDER",
    context,
    segmentation: {
      status: NOT_RUN,
      regions: [],
      masks: [],
    },
    detection: {
      status: NOT_RUN,
      objects: [],
      objectCount: 0,
    },
    colorAnalysis: {
      status: NOT_RUN,
      dominantColors: [],
      metrics: {},
    },
    diameterEstimation: {
      status: NOT_RUN,
      measurements: [],
      calibrated: false,
      unit: "",
    },
    surfaceInspection: {
      status: NOT_RUN,
      findings: [],
    },
    textureAnalysis: {
      status: NOT_RUN,
      metrics: {},
    },
    grading: {
      status: NOT_RUN,
      grade: "",
      recommendations: [],
      reasons: [],
    },
    confidence: {
      status: NOT_RUN,
      overall: 0,
      moduleScores: {},
    },
    diagnostics: {
      status: "PLACEHOLDER",
      warnings: [],
      errors: [],
      timings: {},
      messages: ["No fruit analysis modules were executed"],
    },
  };
};
