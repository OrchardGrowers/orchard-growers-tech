export const SCALE_CALIBRATION_VERSION = "1";

export const SCALE_CALIBRATION_METHODS = Object.freeze({
  NONE: Object.freeze({
    label: "No Reference",
    defaultWidthMm: null,
  }),
  EFM_REFERENCE_CARD: Object.freeze({
    label: "eFruitMandi Reference Card",
    defaultWidthMm: 50,
  }),
  CUSTOM_REFERENCE: Object.freeze({
    label: "Custom Known-Size Reference",
    defaultWidthMm: null,
  }),
});

export const SCALE_CALIBRATION_STATUS = Object.freeze({
  NOT_REQUIRED: "NOT_REQUIRED",
  WAITING_FOR_REFERENCE: "WAITING_FOR_REFERENCE",
  REFERENCE_CANDIDATE: "REFERENCE_CANDIDATE",
  CALIBRATING: "CALIBRATING",
  READY: "READY",
  LOW_CONFIDENCE: "LOW_CONFIDENCE",
  INVALID: "INVALID",
  UNAVAILABLE: "UNAVAILABLE",
});

const STATUS_VALUES = Object.freeze(Object.values(SCALE_CALIBRATION_STATUS));
const METHOD_VALUES = Object.freeze(Object.keys(SCALE_CALIBRATION_METHODS));
const clamp = (value, minimum = 0, maximum = 1) =>
  Math.min(maximum, Math.max(minimum, value));
const finitePositive = (value) => Number.isFinite(Number(value)) && Number(value) > 0;
const optionalNumber = (value) => (finitePositive(value) ? Number(value) : null);

const confidenceLevel = (confidence) =>
  confidence >= 0.82 ? "HIGH" : confidence >= 0.6 ? "MEDIUM" : "LOW";

export const createScaleCalibrationState = (values = {}) => {
  const method = METHOD_VALUES.includes(values.method) ? values.method : "NONE";
  const defaultStatus = method === "NONE"
    ? SCALE_CALIBRATION_STATUS.NOT_REQUIRED
    : SCALE_CALIBRATION_STATUS.WAITING_FOR_REFERENCE;

  return {
    method,
    status: STATUS_VALUES.includes(values.status) ? values.status : defaultStatus,
    referenceWidthMm: optionalNumber(values.referenceWidthMm),
    referenceWidthPixels: optionalNumber(values.referenceWidthPixels),
    pixelsPerMm: optionalNumber(values.pixelsPerMm),
    confidence: clamp(Number(values.confidence) || 0),
    confidenceLevel: ["LOW", "MEDIUM", "HIGH"].includes(values.confidenceLevel)
      ? values.confidenceLevel
      : "LOW",
    referenceBoundingBox: values.referenceBoundingBox
      ? { ...values.referenceBoundingBox }
      : null,
    evaluatedAt: values.evaluatedAt ?? null,
    calibrationVersion: values.calibrationVersion || SCALE_CALIBRATION_VERSION,
    failureReason: values.failureReason || null,
  };
};

export const evaluateReferenceConfidence = ({
  candidate,
  frameQuality = {},
  userConfirmed = false,
} = {}) => {
  if (!candidate || !userConfirmed) return 0;

  const widthPixels = Number(candidate.widthPixels || candidate.boundingBox?.width || 0);
  const borderContact = clamp(Number(candidate.borderContact) || 0);
  const normalizedAspect = Math.max(
    Number(candidate.aspectRatio || 1),
    1 / Math.max(Number(candidate.aspectRatio || 1), 0.001)
  );
  const fullyInside = !candidate.partialCandidate && borderContact <= 0.08;
  const sizeScore = clamp(widthPixels / 40);
  const borderScore = fullyInside ? clamp(1 - borderContact / 0.08) : 0;
  const frameScore =
    (frameQuality.brightnessState === "GOOD" ? 1 : 0) * 0.3 +
    (frameQuality.sharpnessState === "ACCEPTABLE" ? 1 : 0) * 0.3 +
    (frameQuality.contrastState === "GOOD" ? 1 : 0) * 0.2 +
    (frameQuality.motionState === "STABLE" ? 1 : 0) * 0.2;
  const distortionScore = clamp(1 - Math.max(0, normalizedAspect - 2.5) / 3.5);
  let confidence = clamp(
    0.1 + sizeScore * 0.18 + borderScore * 0.22 + frameScore * 0.4 + distortionScore * 0.1
  );
  if (!fullyInside || widthPixels < 12 || normalizedAspect > 6) {
    confidence = Math.min(confidence, 0.49);
  }
  return Math.round(confidence * 1000) / 1000;
};

export const calculateScaleCalibration = ({
  referenceWidthMm,
  referenceWidthPixels,
  confidence = 0,
  options = {},
} = {}) => {
  const method = METHOD_VALUES.includes(options.method) ? options.method : "NONE";
  const base = {
    method,
    referenceWidthMm: optionalNumber(referenceWidthMm),
    referenceWidthPixels: optionalNumber(referenceWidthPixels),
    confidence: clamp(Number(confidence) || 0),
    referenceBoundingBox: options.referenceBoundingBox || null,
    evaluatedAt: options.evaluatedAt ?? null,
    calibrationVersion: options.calibrationVersion || SCALE_CALIBRATION_VERSION,
  };

  if (method === "NONE") {
    return createScaleCalibrationState({
      ...base,
      status: SCALE_CALIBRATION_STATUS.NOT_REQUIRED,
    });
  }
  if (!finitePositive(referenceWidthMm) || !finitePositive(referenceWidthPixels)) {
    return createScaleCalibrationState({
      ...base,
      status: SCALE_CALIBRATION_STATUS.INVALID,
      pixelsPerMm: null,
      failureReason: "A valid reference width and selected reference region are required.",
    });
  }
  if (Number(referenceWidthPixels) < Number(options.minimumReferencePixels || 12)) {
    return createScaleCalibrationState({
      ...base,
      status: SCALE_CALIBRATION_STATUS.INVALID,
      pixelsPerMm: null,
      failureReason: "The selected reference region is too small.",
    });
  }

  const pixelsPerMm = Number(referenceWidthPixels) / Number(referenceWidthMm);
  if (!Number.isFinite(pixelsPerMm) || pixelsPerMm <= 0) {
    return createScaleCalibrationState({
      ...base,
      status: SCALE_CALIBRATION_STATUS.INVALID,
      pixelsPerMm: null,
      failureReason: "Scale calibration could not be calculated.",
    });
  }

  const normalizedConfidence = clamp(Number(confidence) || 0);
  return createScaleCalibrationState({
    ...base,
    status:
      normalizedConfidence >= 0.6
        ? SCALE_CALIBRATION_STATUS.READY
        : SCALE_CALIBRATION_STATUS.LOW_CONFIDENCE,
    pixelsPerMm,
    confidenceLevel: confidenceLevel(normalizedConfidence),
    failureReason:
      normalizedConfidence >= 0.6
        ? null
        : "Reference conditions are not reliable enough for physical measurement.",
  });
};
