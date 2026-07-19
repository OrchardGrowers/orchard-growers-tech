export const MEASUREMENT_ESTIMATOR_VERSION = "1";

export const MEASUREMENT_MODE_RULES = Object.freeze({
  SINGLE_FRUIT: Object.freeze({
    minimumCandidateConfidence: 0.55,
    maximumBorderContact: 0.08,
    minimumStableSamples: 2,
    maximumAspectRatio: 3.5,
    measureDominantOnly: true,
    enabled: true,
  }),
  FRUIT_GROUP: Object.freeze({
    minimumCandidateConfidence: 0.5,
    maximumBorderContact: 0.1,
    minimumStableSamples: 2,
    maximumAspectRatio: 4.5,
    measureDominantOnly: false,
    enabled: true,
  }),
  TRAY_PACKED: Object.freeze({
    minimumCandidateConfidence: 0.52,
    maximumBorderContact: 0.08,
    minimumStableSamples: 3,
    maximumAspectRatio: 3.5,
    measureDominantOnly: false,
    enabled: true,
  }),
  PACKAGE_VIEW: Object.freeze({
    minimumCandidateConfidence: 1,
    maximumBorderContact: 0,
    minimumStableSamples: 3,
    maximumAspectRatio: 1,
    measureDominantOnly: false,
    enabled: false,
  }),
});

export const MEASUREMENT_THRESHOLDS = Object.freeze({
  minimumCalibrationConfidence: 0.6,
  minimumReferenceWidthPixels: 12,
  highConfidenceReferenceWidthPixels: 24,
  maximumHistory: 5,
  maximumStableDiameterChangeRatio: 0.08,
  maximumStableDiameterChangeMm: 1.5,
});

const clamp = (value, minimum = 0, maximum = 1) =>
  Math.min(maximum, Math.max(minimum, value));
const finitePositive = (value) => Number.isFinite(Number(value)) && Number(value) > 0;
const roundDisplay = (value) => Math.round(value * 10) / 10;
const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
};
const confidenceLevel = (confidence) =>
  confidence >= 0.78 ? "HIGH" : confidence >= 0.52 ? "MEDIUM" : "LOW";

const frameQualityAcceptable = (frameQuality) =>
  frameQuality?.brightnessState === "GOOD" &&
  frameQuality?.sharpnessState === "ACCEPTABLE" &&
  frameQuality?.contrastState === "GOOD" &&
  frameQuality?.motionState === "STABLE";

const boxesOverlap = (candidateBox, referenceBox) => {
  if (!candidateBox || !referenceBox) return false;
  const left = Math.max(Number(candidateBox.xRatio), Number(referenceBox.xRatio));
  const top = Math.max(Number(candidateBox.yRatio), Number(referenceBox.yRatio));
  const right = Math.min(
    Number(candidateBox.xRatio) + Number(candidateBox.widthRatio),
    Number(referenceBox.xRatio) + Number(referenceBox.widthRatio)
  );
  const bottom = Math.min(
    Number(candidateBox.yRatio) + Number(candidateBox.heightRatio),
    Number(referenceBox.yRatio) + Number(referenceBox.heightRatio)
  );
  const intersection = Math.max(0, right - left) * Math.max(0, bottom - top);
  const candidateArea = Number(candidateBox.widthRatio) * Number(candidateBox.heightRatio);
  const referenceArea = Number(referenceBox.widthRatio) * Number(referenceBox.heightRatio);
  const union = candidateArea + referenceArea - intersection;
  return union > 0 && intersection / union >= 0.5;
};

const createMeasurement = (candidate, reasons = []) => ({
  candidateId: candidate?.id || null,
  center: candidate?.center
    ? { xRatio: candidate.center.xRatio, yRatio: candidate.center.yRatio }
    : null,
  widthPixels: finitePositive(candidate?.widthPixels) ? Number(candidate.widthPixels) : null,
  heightPixels: finitePositive(candidate?.heightPixels) ? Number(candidate.heightPixels) : null,
  equivalentDiameterPixels:
    finitePositive(candidate?.widthPixels) && finitePositive(candidate?.heightPixels)
      ? Math.sqrt(Number(candidate.widthPixels) * Number(candidate.heightPixels))
      : null,
  estimatedWidthMm: null,
  estimatedHeightMm: null,
  estimatedEquivalentDiameterMm: null,
  confidence: 0,
  confidenceLevel: "LOW",
  validForMeasurement: false,
  tiltWarning: false,
  reasons,
});

const unavailableResult = ({ candidates, status, reason, options }) => ({
  status,
  measurements: candidates.map((candidate) => createMeasurement(candidate, [reason])),
  measuredCandidateCount: 0,
  skippedCandidateCount: candidates.length,
  averageDiameterMm: null,
  minimumDiameterMm: null,
  maximumDiameterMm: null,
  confidence: 0,
  confidenceLevel: "LOW",
  advisories: [reason],
  evaluatedAt: options.evaluatedAt ?? null,
  estimatorVersion: MEASUREMENT_ESTIMATOR_VERSION,
  calibrationVersion: options.calibrationVersion || null,
});

export const estimateCandidateMeasurements = ({
  candidates = [],
  calibration = {},
  scanMode = "SINGLE_FRUIT",
  options = {},
} = {}) => {
  const source = Array.isArray(candidates) ? candidates : [];
  const mode = MEASUREMENT_MODE_RULES[scanMode] ? scanMode : "SINGLE_FRUIT";
  const rules = { ...MEASUREMENT_MODE_RULES[mode], ...(options.modeRules || {}) };
  const thresholds = { ...MEASUREMENT_THRESHOLDS, ...(options.thresholds || {}) };
  const referenceBox = calibration.referenceBoundingBox;
  const referenceInsideRoi = Boolean(
    referenceBox &&
      Number(referenceBox.xRatio) >= 0 &&
      Number(referenceBox.yRatio) >= 0 &&
      Number(referenceBox.xRatio) + Number(referenceBox.widthRatio) <= 1 &&
      Number(referenceBox.yRatio) + Number(referenceBox.heightRatio) <= 1
  );
  const calibrationValid =
    calibration.status === "READY" &&
    finitePositive(calibration.pixelsPerMm) &&
    finitePositive(calibration.referenceWidthMm) &&
    finitePositive(calibration.referenceWidthPixels) &&
    Number(calibration.confidence) >= thresholds.minimumCalibrationConfidence &&
    referenceInsideRoi;

  if (!rules.enabled) {
    return unavailableResult({
      candidates: source,
      status: "PACKAGE_UNAVAILABLE",
      reason: "Individual diameter is unavailable in Package View.",
      options: { ...options, calibrationVersion: calibration.calibrationVersion },
    });
  }
  if (!calibrationValid) {
    return unavailableResult({
      candidates: source,
      status: "WAITING_FOR_CALIBRATION",
      reason: "Calibrate a known-size reference to estimate fruit diameter.",
      options: { ...options, calibrationVersion: calibration.calibrationVersion },
    });
  }

  const acceptableFrame = frameQualityAcceptable(options.frameQuality);
  const pixelsPerMm = Number(calibration.pixelsPerMm);
  const advisories = [];
  const measurementCandidates = source.filter(
    (candidate) => !boxesOverlap(candidate.boundingBox, referenceBox)
  );
  if (mode === "SINGLE_FRUIT" && measurementCandidates.length > 1) {
    advisories.push("Use Single Fruit mode with one fruit for a clearer measurement.");
  }

  const measurements = source.map((candidate) => {
    const reasons = [];
    const widthPixels = Number(candidate?.widthPixels);
    const heightPixels = Number(candidate?.heightPixels);
    const borderContact = clamp(Number(candidate?.borderContact) || 0);
    const aspectRatio = Math.max(
      Number(candidate?.aspectRatio || 1),
      1 / Math.max(Number(candidate?.aspectRatio || 1), 0.001)
    );
    const candidateBox = candidate?.boundingBox;
    const candidateInsideRoi = Boolean(
      candidateBox &&
        Number(candidateBox.xRatio) >= 0 &&
        Number(candidateBox.yRatio) >= 0 &&
        Number(candidateBox.xRatio) + Number(candidateBox.widthRatio) <= 1 &&
        Number(candidateBox.yRatio) + Number(candidateBox.heightRatio) <= 1
    );
    const selectedReference = boxesOverlap(candidateBox, referenceBox);
    const measurementIndex = measurementCandidates.indexOf(candidate);
    if (selectedReference) {
      reasons.push("The selected reference region is not measured as fruit.");
    }
    if (rules.measureDominantOnly && measurementIndex > 0) {
      reasons.push("Single Fruit mode measures only the dominant candidate.");
    }
    if (Number(candidate?.confidence) < rules.minimumCandidateConfidence) {
      reasons.push("Candidate confidence is too low.");
    }
    if (candidate?.partialCandidate || borderContact > rules.maximumBorderContact) {
      reasons.push("Candidate is partial or too close to the ROI border.");
    }
    if (!candidateInsideRoi) {
      reasons.push("Candidate and reference must remain inside the same ROI.");
    }
    if (candidate?.possibleMergedRegion) {
      reasons.push("Merged candidate regions are not measured.");
    }
    if (!finitePositive(widthPixels) || !finitePositive(heightPixels)) {
      reasons.push("Candidate pixel dimensions are unavailable.");
    }
    if (Number(candidate?.stabilitySamples || 0) < rules.minimumStableSamples) {
      reasons.push("Candidate geometry is not stable yet.");
    }
    if (!acceptableFrame) {
      reasons.push("Frame quality or camera stability is insufficient.");
    }
    if (aspectRatio > rules.maximumAspectRatio) {
      reasons.push("Candidate shape is too elongated for a reliable generic estimate.");
    }

    const measurement = createMeasurement(candidate, reasons);
    if (reasons.length) return measurement;

    const equivalentDiameterPixels = Math.sqrt(widthPixels * heightPixels);
    const estimatedWidthMm = widthPixels / pixelsPerMm;
    const estimatedHeightMm = heightPixels / pixelsPerMm;
    const estimatedEquivalentDiameterMm = equivalentDiameterPixels / pixelsPerMm;
    if (
      !finitePositive(estimatedWidthMm) ||
      !finitePositive(estimatedHeightMm) ||
      !finitePositive(estimatedEquivalentDiameterMm)
    ) {
      return createMeasurement(candidate, ["Physical conversion produced an invalid result."]);
    }

    const borderScore = clamp(1 - borderContact / Math.max(rules.maximumBorderContact, 0.001));
    const aspectScore = clamp(1 - Math.max(0, aspectRatio - 1.4) / 3.2);
    const stabilityScore = clamp(
      Number(candidate.stabilitySamples || 0) / Math.max(1, rules.minimumStableSamples)
    );
    const referenceSizeScore = clamp(
      Number(calibration.referenceWidthPixels) /
        thresholds.highConfidenceReferenceWidthPixels
    );
    const frameScore = clamp(Number(options.frameQuality?.overallScore || 0) / 100);
    let confidence = clamp(
      Number(calibration.confidence) * 0.3 +
        Number(candidate.confidence) * 0.25 +
        borderScore * 0.1 +
        aspectScore * 0.1 +
        stabilityScore * 0.1 +
        referenceSizeScore * 0.05 +
        frameScore * 0.1
    );
    const scaleRatio = widthPixels / Number(calibration.referenceWidthPixels);
    const possibleTilt = aspectRatio > 2.2 || scaleRatio < 0.08 || scaleRatio > 12;
    const measurementReasons = [];
    if (possibleTilt) {
      confidence = Math.min(confidence, 0.69);
      measurementReasons.push("Fruit or reference may be tilted. Keep both parallel to the camera.");
    }
    if (
      Number(calibration.confidence) < 0.82 ||
      borderContact > 0.03 ||
      Number(calibration.referenceWidthPixels) < thresholds.highConfidenceReferenceWidthPixels ||
      aspectRatio > 2.2
    ) {
      confidence = Math.min(confidence, 0.77);
    }

    return {
      ...measurement,
      equivalentDiameterPixels,
      estimatedWidthMm,
      estimatedHeightMm,
      estimatedEquivalentDiameterMm,
      confidence: Math.round(confidence * 1000) / 1000,
      confidenceLevel: confidenceLevel(confidence),
      validForMeasurement: true,
      tiltWarning: possibleTilt,
      reasons: measurementReasons,
    };
  });

  const validMeasurements = measurements.filter((measurement) => measurement.validForMeasurement);
  const diameters = validMeasurements.map(
    (measurement) => measurement.estimatedEquivalentDiameterMm
  );
  const confidence = validMeasurements.length
    ? validMeasurements.reduce((total, measurement) => total + measurement.confidence, 0) /
      validMeasurements.length
    : 0;
  const status = !validMeasurements.length
    ? "NO_MEASURABLE_CANDIDATE"
    : confidence < 0.52
      ? "LOW_CONFIDENCE"
      : "READY";

  return {
    status,
    measurements,
    measuredCandidateCount: validMeasurements.length,
    skippedCandidateCount: measurements.length - validMeasurements.length,
    averageDiameterMm: diameters.length
      ? roundDisplay(diameters.reduce((total, value) => total + value, 0) / diameters.length)
      : null,
    minimumDiameterMm: diameters.length ? roundDisplay(Math.min(...diameters)) : null,
    maximumDiameterMm: diameters.length ? roundDisplay(Math.max(...diameters)) : null,
    confidence: Math.round(confidence * 1000) / 1000,
    confidenceLevel: confidenceLevel(confidence),
    advisories,
    evaluatedAt: options.evaluatedAt ?? null,
    estimatorVersion: MEASUREMENT_ESTIMATOR_VERSION,
    calibrationVersion: calibration.calibrationVersion || null,
  };
};

const measurementsMatch = (current, previous) => {
  if (!current.center || !previous.center) return false;
  return Math.hypot(
    current.center.xRatio - previous.center.xRatio,
    current.center.yRatio - previous.center.yRatio
  ) <= 0.13;
};

export const stabilizeCandidateMeasurements = (history, options = {}) => {
  const mode = MEASUREMENT_MODE_RULES[options.scanMode] ? options.scanMode : "SINGLE_FRUIT";
  const requiredSamples = MEASUREMENT_MODE_RULES[mode].minimumStableSamples;
  const samples = Array.isArray(history)
    ? history.slice(-MEASUREMENT_THRESHOLDS.maximumHistory)
    : [];
  const latest = samples[samples.length - 1];
  if (!latest) return null;
  if (["WAITING_FOR_CALIBRATION", "PACKAGE_UNAVAILABLE", "UNAVAILABLE"].includes(latest.status)) {
    return latest;
  }
  if (samples.length < requiredSamples) {
    return {
      ...latest,
      status: "STABILIZING",
      measurements: [],
      measuredCandidateCount: 0,
      averageDiameterMm: null,
      minimumDiameterMm: null,
      maximumDiameterMm: null,
    };
  }

  const recent = samples.slice(-requiredSamples);
  const stableMeasurements = latest.measurements
    .filter((measurement) => measurement.validForMeasurement)
    .map((measurement) => {
      const matching = recent
        .map((sample) =>
          sample.measurements.find(
            (candidateMeasurement) =>
              candidateMeasurement.validForMeasurement &&
              measurementsMatch(measurement, candidateMeasurement)
          )
        )
        .filter(Boolean);
      if (matching.length < requiredSamples) return null;
      const diameters = matching.map(
        (candidateMeasurement) => candidateMeasurement.estimatedEquivalentDiameterMm
      );
      const centralDiameter = median(diameters);
      const allowedChange = Math.max(
        MEASUREMENT_THRESHOLDS.maximumStableDiameterChangeMm,
        centralDiameter * MEASUREMENT_THRESHOLDS.maximumStableDiameterChangeRatio
      );
      if (Math.max(...diameters) - Math.min(...diameters) > allowedChange) return null;
      return {
        ...measurement,
        estimatedEquivalentDiameterMm: roundDisplay(centralDiameter),
        estimatedWidthMm: roundDisplay(median(matching.map((item) => item.estimatedWidthMm))),
        estimatedHeightMm: roundDisplay(median(matching.map((item) => item.estimatedHeightMm))),
      };
    })
    .filter(Boolean);

  if (!stableMeasurements.length) {
    return {
      ...latest,
      status: "STABILIZING",
      measurements: [],
      measuredCandidateCount: 0,
      skippedCandidateCount: latest.measurements.length,
      averageDiameterMm: null,
      minimumDiameterMm: null,
      maximumDiameterMm: null,
    };
  }

  const diameters = stableMeasurements.map(
    (measurement) => measurement.estimatedEquivalentDiameterMm
  );
  const confidence = stableMeasurements.reduce(
    (total, measurement) => total + measurement.confidence,
    0
  ) / stableMeasurements.length;
  return {
    ...latest,
    status: confidence < 0.52 ? "LOW_CONFIDENCE" : "READY",
    measurements: stableMeasurements,
    measuredCandidateCount: stableMeasurements.length,
    skippedCandidateCount: latest.measurements.length - stableMeasurements.length,
    averageDiameterMm: roundDisplay(
      diameters.reduce((total, value) => total + value, 0) / diameters.length
    ),
    minimumDiameterMm: roundDisplay(Math.min(...diameters)),
    maximumDiameterMm: roundDisplay(Math.max(...diameters)),
    confidence: Math.round(confidence * 1000) / 1000,
    confidenceLevel: confidenceLevel(confidence),
  };
};
