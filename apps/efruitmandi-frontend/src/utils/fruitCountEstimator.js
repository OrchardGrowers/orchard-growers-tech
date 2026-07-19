export const COUNT_ESTIMATOR_VERSION = "1";

export const COUNT_MODE_RULES = Object.freeze({
  SINGLE_FRUIT: Object.freeze({
    minimumConfidence: 0.55,
    maximumBorderContact: 0.08,
    minimumAreaRatio: 0.02,
    maximumAreaRatio: 0.74,
    minimumStableSamples: 2,
    suitableForIndividualCount: true,
  }),
  FRUIT_GROUP: Object.freeze({
    minimumConfidence: 0.48,
    maximumBorderContact: 0.12,
    minimumAreaRatio: 0.003,
    maximumAreaRatio: 0.78,
    minimumStableSamples: 2,
    suitableForIndividualCount: true,
  }),
  TRAY_PACKED: Object.freeze({
    minimumConfidence: 0.46,
    maximumBorderContact: 0.14,
    minimumAreaRatio: 0.0015,
    maximumAreaRatio: 0.7,
    minimumStableSamples: 3,
    suitableForIndividualCount: true,
  }),
  PACKAGE_VIEW: Object.freeze({
    minimumConfidence: 1,
    maximumBorderContact: 0,
    minimumAreaRatio: 0,
    maximumAreaRatio: 0,
    minimumStableSamples: 2,
    suitableForIndividualCount: false,
  }),
});

export const COUNT_THRESHOLDS = Object.freeze({
  minimumEdgeStrength: 8,
  minimumFillRatio: 0.12,
  partialMaximumConfidence: 0.5,
  maximumMergedEstimate: 4,
  maximumHistory: 5,
});

const clamp = (value, minimum = 0, maximum = 1) =>
  Math.min(maximum, Math.max(minimum, value));
const round = (value) => Math.round(value * 1000) / 1000;
const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
};

const candidateAreaRatio = (candidate) =>
  Number(candidate?.boundingBox?.widthRatio || 0) *
  Number(candidate?.boundingBox?.heightRatio || 0) *
  Number(candidate?.fillRatio || 0);

const confidenceLevel = (confidence) =>
  confidence >= 0.75 ? "HIGH" : confidence >= 0.5 ? "MEDIUM" : "LOW";

const emptyResult = (status, reason, options = {}) => ({
  clearCandidateCount: 0,
  partialCandidateCount: 0,
  mergedRegionCount: 0,
  estimatedMinimumCount: status === "NO_CANDIDATES" ? 0 : null,
  estimatedMaximumCount: status === "NO_CANDIDATES" ? 0 : null,
  estimatedCount: status === "NO_CANDIDATES" ? 0 : null,
  confidence: 0,
  confidenceLevel: "LOW",
  status,
  reasons: [reason],
  evaluatedAt: options.evaluatedAt ?? null,
  estimatorVersion: COUNT_ESTIMATOR_VERSION,
  detectorVersion: options.detectorVersion || null,
});

export const estimateFruitCount = ({
  candidates = [],
  scanMode = "SINGLE_FRUIT",
  roi = null,
  options = {},
} = {}) => {
  const mode = COUNT_MODE_RULES[scanMode] ? scanMode : "SINGLE_FRUIT";
  const rules = { ...COUNT_MODE_RULES[mode], ...(options.modeRules || {}) };
  const thresholds = { ...COUNT_THRESHOLDS, ...(options.thresholds || {}) };
  const boundaryStatus = options.boundaryStatus || "WAITING";

  if (!rules.suitableForIndividualCount) {
    return emptyResult(
      "NOT_AVAILABLE",
      "Individual count is unavailable in Package View.",
      options
    );
  }
  if (boundaryStatus === "UNAVAILABLE") {
    return emptyResult("UNAVAILABLE", "Boundary candidates are unavailable.", options);
  }
  if (["WAITING", "EVALUATING"].includes(boundaryStatus)) {
    return emptyResult("WAITING", "Waiting for stable boundary candidates.", options);
  }

  const source = Array.isArray(candidates) ? candidates : [];
  const partialCandidates = source.filter(
    (candidate) => candidate.partialCandidate || candidate.borderContact > rules.maximumBorderContact
  );
  const mergedCandidates = source.filter(
    (candidate) =>
      candidate.possibleMergedRegion &&
      !candidate.partialCandidate &&
      candidate.borderContact <= rules.maximumBorderContact
  );
  const clearCandidates = source.filter((candidate) => {
    const areaRatio = candidateAreaRatio(candidate);
    return (
      candidate.confidence >= rules.minimumConfidence &&
      !candidate.partialCandidate &&
      !candidate.possibleMergedRegion &&
      candidate.borderContact <= rules.maximumBorderContact &&
      areaRatio >= rules.minimumAreaRatio &&
      areaRatio <= rules.maximumAreaRatio &&
      candidate.edgeStrength >= thresholds.minimumEdgeStrength &&
      candidate.fillRatio >= thresholds.minimumFillRatio
    );
  });

  if (!source.length) {
    return emptyResult("NO_CANDIDATES", "No stable candidate is available.", options);
  }

  const clearAreas = clearCandidates.map((candidate) => candidate.areaPixels).filter(Number.isFinite);
  const medianClearArea = median(clearAreas);
  const mergedRegions = mergedCandidates.map((candidate) => {
    const normalizedAspect = Math.max(
      Number(candidate.aspectRatio || 1),
      1 / Math.max(Number(candidate.aspectRatio || 1), 0.001)
    );
    const areaEstimate = medianClearArea
      ? candidate.areaPixels / Math.max(1, medianClearArea)
      : normalizedAspect;
    const maximumCount = Math.max(
      2,
      Math.min(thresholds.maximumMergedEstimate, Math.ceil(Math.max(areaEstimate, normalizedAspect)))
    );
    const estimatedCount = Math.max(1, Math.min(maximumCount, Math.round(areaEstimate) || 1));
    return {
      candidateId: candidate.id,
      minimumCount: 1,
      maximumCount,
      estimatedCount,
      confidence: round(candidate.confidence * (medianClearArea ? 0.72 : 0.5)),
    };
  });

  const eligiblePartialCount = partialCandidates.filter(
    (candidate) => candidate.confidence >= thresholds.partialMaximumConfidence
  ).length;
  const mergedMinimum = mergedRegions.length;
  const mergedMaximum = mergedRegions.reduce(
    (total, region) => total + region.maximumCount,
    0
  );
  const mergedCentral = mergedRegions.reduce(
    (total, region) => total + region.estimatedCount,
    0
  );
  const estimatedMinimumCount = clearCandidates.length + mergedMinimum;
  const estimatedMaximumCount =
    clearCandidates.length + mergedMaximum + eligiblePartialCount;
  const estimatedCount = clearCandidates.length + mergedCentral;
  const countableCandidates = [...clearCandidates, ...mergedCandidates];
  const meanCandidateConfidence = countableCandidates.length
    ? countableCandidates.reduce((total, candidate) => total + candidate.confidence, 0) /
      countableCandidates.length
    : 0;
  const partialRatio = partialCandidates.length / Math.max(1, source.length);
  const mergedRatio = mergedCandidates.length / Math.max(1, source.length);
  const stabilityScore = source.length
    ? source.reduce(
        (total, candidate) =>
          total + clamp(Number(candidate.stabilitySamples || 0) / rules.minimumStableSamples),
        0
      ) / source.length
    : 0;
  const sizeConsistency = clearAreas.length > 1 && medianClearArea
    ? clamp(
        1 -
          clearAreas.reduce(
            (total, area) => total + Math.abs(area - medianClearArea) / medianClearArea,
            0
          ) /
            clearAreas.length
      )
    : clearAreas.length ? 0.7 : 0.35;
  const frameScore = clamp(Number(options.frameQuality?.overallScore || 0) / 100);
  let confidence = clamp(
    meanCandidateConfidence * 0.4 +
      stabilityScore * 0.2 +
      sizeConsistency * 0.15 +
      frameScore * 0.25 -
      partialRatio * 0.3 -
      mergedRatio * 0.22
  );
  if (mergedCandidates.length || partialCandidates.length || frameScore < 0.55) {
    confidence = Math.min(confidence, 0.69);
  }

  const reasons = [];
  if (partialCandidates.length) reasons.push("Keep all fruits fully inside the guide for a better count.");
  if (mergedCandidates.length) reasons.push("One or more candidate regions may contain overlapping subjects.");
  if (frameScore < 0.55) reasons.push("Frame quality reduces count confidence.");

  const multipleInSingleMode = mode === "SINGLE_FRUIT" && source.length > 1;
  const stableEnough = source.every(
    (candidate) => Number(candidate.stabilitySamples || 0) >= rules.minimumStableSamples
  );
  if (!stableEnough || multipleInSingleMode) {
    confidence = Math.min(confidence, 0.69);
  }
  const status = multipleInSingleMode
    ? "MULTIPLE_SUBJECTS"
    : !stableEnough
      ? "WAITING"
      : confidence < 0.5
        ? "LOW_CONFIDENCE"
        : "READY";
  if (multipleInSingleMode) reasons.unshift("Multiple subjects appear inside the guide.");

  return {
    clearCandidateCount: clearCandidates.length,
    partialCandidateCount: partialCandidates.length,
    mergedRegionCount: mergedCandidates.length,
    estimatedMinimumCount,
    estimatedMaximumCount,
    estimatedCount,
    confidence: round(confidence),
    confidenceLevel: confidenceLevel(confidence),
    status,
    reasons,
    mergedRegions,
    roiAvailable: Boolean(roi),
    evaluatedAt: options.evaluatedAt ?? null,
    estimatorVersion: COUNT_ESTIMATOR_VERSION,
    detectorVersion: options.detectorVersion || null,
  };
};

export const stabilizeFruitCountEstimates = (history, options = {}) => {
  const mode = COUNT_MODE_RULES[options.scanMode] ? options.scanMode : "SINGLE_FRUIT";
  const requiredSamples = COUNT_MODE_RULES[mode].minimumStableSamples;
  const samples = Array.isArray(history)
    ? history.slice(-COUNT_THRESHOLDS.maximumHistory)
    : [];
  const latest = samples[samples.length - 1];
  if (!latest) return null;
  if (["NOT_AVAILABLE", "UNAVAILABLE"].includes(latest.status)) return latest;
  if (latest.status === "MULTIPLE_SUBJECTS") return latest;

  const comparable = samples
    .filter(
      (sample) =>
        Number.isFinite(sample.estimatedCount) &&
        sample.estimatorVersion === latest.estimatorVersion &&
        sample.detectorVersion === latest.detectorVersion
    )
    .slice(-requiredSamples);
  if (comparable.length < requiredSamples) {
    return { ...latest, status: "WAITING", estimatedCount: null };
  }

  const minimums = comparable.map((sample) => sample.estimatedMinimumCount);
  const maximums = comparable.map((sample) => sample.estimatedMaximumCount);
  const central = comparable.map((sample) => sample.estimatedCount);
  const rangesOverlap = Math.max(...minimums) <= Math.min(...maximums);
  const centralSpread = Math.max(...central) - Math.min(...central);
  if (!rangesOverlap || centralSpread > 1) {
    return {
      ...latest,
      status: "LOW_CONFIDENCE",
      confidence: Math.min(latest.confidence, 0.49),
      confidenceLevel: "LOW",
      estimatedCount: Math.round(median(central)),
    };
  }

  const estimatedMinimumCount = Math.round(median(minimums));
  const estimatedMaximumCount = Math.max(
    estimatedMinimumCount,
    Math.round(median(maximums))
  );
  const confidence =
    comparable.reduce((total, sample) => total + sample.confidence, 0) /
    comparable.length;
  return {
    ...latest,
    estimatedMinimumCount,
    estimatedMaximumCount,
    estimatedCount: Math.round(median(central)),
    confidence: round(confidence),
    confidenceLevel: confidenceLevel(confidence),
    status: confidence < 0.5 ? "LOW_CONFIDENCE" : "READY",
  };
};
