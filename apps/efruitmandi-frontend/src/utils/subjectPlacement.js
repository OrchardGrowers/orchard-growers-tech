export const SUBJECT_HEURISTIC_DEFAULTS = Object.freeze({
  luminanceDeviationThreshold: 18,
  edgeThreshold: 14,
  borderBandRatio: 0.1,
  centerInsetRatio: 0.2,
  minimumCoverage: 0.1,
  maximumCoverage: 0.7,
  cropBorderContact: 0.65,
  minimumEdgeDensity: 0.025,
  minimumCentralActivity: 0.1,
  presentScore: 48,
  lowConfidenceScore: 28,
  horizontalDeadZone: 0.1,
  verticalDeadZone: 0.12,
});

const clamp = (value, minimum = 0, maximum = 1) =>
  Math.min(maximum, Math.max(minimum, value));
const round = (value) => Math.round(value * 1000) / 1000;
const luminanceAt = (data, index) =>
  data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;

const classifyPlacement = ({
  presenceState,
  sizeState,
  centroidXRatio,
  centroidYRatio,
  horizontalDeadZone,
  verticalDeadZone,
}) => {
  const confident = ["SUBJECT_PRESENT", "OVERFILLED_OR_CROPPED"].includes(presenceState);
  if (!confident || centroidXRatio === null || centroidYRatio === null) {
    return {
      horizontalGuidance: null,
      verticalGuidance: null,
      distanceGuidance: null,
      alignmentState: "POSITION_SUBJECT",
      guidance: "Position the fruit or package clearly inside the guide.",
    };
  }

  const horizontalGuidance = centroidXRatio < 0.5 - horizontalDeadZone
    ? "Move slightly right"
    : centroidXRatio > 0.5 + horizontalDeadZone
      ? "Move slightly left"
      : "Centered";
  const verticalGuidance = centroidYRatio < 0.5 - verticalDeadZone
    ? "Move slightly down"
    : centroidYRatio > 0.5 + verticalDeadZone
      ? "Move slightly up"
      : "Vertical position acceptable";
  const distanceGuidance = sizeState === "TOO_SMALL"
    ? "Move slightly closer."
    : sizeState === "TOO_LARGE_OR_CROPPED"
      ? "Move slightly farther away and keep the full subject inside the guide."
      : "Subject size looks suitable.";

  if (sizeState === "TOO_LARGE_OR_CROPPED") {
    return {
      horizontalGuidance,
      verticalGuidance,
      distanceGuidance,
      alignmentState: "MOVE_FARTHER",
      guidance: distanceGuidance,
    };
  }
  if (sizeState === "TOO_SMALL") {
    return {
      horizontalGuidance,
      verticalGuidance,
      distanceGuidance,
      alignmentState: "MOVE_CLOSER",
      guidance: distanceGuidance,
    };
  }
  if (horizontalGuidance === "Move slightly right") {
    return { horizontalGuidance, verticalGuidance, distanceGuidance, alignmentState: "MOVE_RIGHT", guidance: horizontalGuidance };
  }
  if (horizontalGuidance === "Move slightly left") {
    return { horizontalGuidance, verticalGuidance, distanceGuidance, alignmentState: "MOVE_LEFT", guidance: horizontalGuidance };
  }
  if (verticalGuidance === "Move slightly down") {
    return { horizontalGuidance, verticalGuidance, distanceGuidance, alignmentState: "MOVE_DOWN", guidance: verticalGuidance };
  }
  if (verticalGuidance === "Move slightly up") {
    return { horizontalGuidance, verticalGuidance, distanceGuidance, alignmentState: "MOVE_UP", guidance: verticalGuidance };
  }

  return {
    horizontalGuidance,
    verticalGuidance,
    distanceGuidance,
    alignmentState: "ALIGNMENT_ACCEPTABLE",
    guidance: "Guide coverage acceptable.",
  };
};

export const analyzeSubjectPlacement = (imageData, options = {}) => {
  const thresholds = { ...SUBJECT_HEURISTIC_DEFAULTS, ...options };
  const width = Number(imageData?.width || 0);
  const height = Number(imageData?.height || 0);
  const pixels = imageData?.data;
  if (!pixels || width < 3 || height < 3 || pixels.length < width * height * 4) {
    throw new Error("Invalid subject heuristic frame data");
  }

  const pixelCount = width * height;
  const luminance = new Float32Array(pixelCount);
  const borderBandX = Math.max(1, Math.round(width * thresholds.borderBandRatio));
  const borderBandY = Math.max(1, Math.round(height * thresholds.borderBandRatio));
  let borderLuminanceTotal = 0;
  let borderPixelCount = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixelIndex = y * width + x;
      const value = luminanceAt(pixels, pixelIndex * 4);
      luminance[pixelIndex] = value;
      if (
        x < borderBandX ||
        x >= width - borderBandX ||
        y < borderBandY ||
        y >= height - borderBandY
      ) {
        borderLuminanceTotal += value;
        borderPixelCount += 1;
      }
    }
  }

  const borderMean = borderLuminanceTotal / Math.max(1, borderPixelCount);
  const centerInsetX = Math.round(width * thresholds.centerInsetRatio);
  const centerInsetY = Math.round(height * thresholds.centerInsetRatio);
  let activeCount = 0;
  let borderActiveCount = 0;
  let edgeCount = 0;
  let centerActiveCount = 0;
  let centerPixelCount = 0;
  let weightTotal = 0;
  let weightedX = 0;
  let weightedY = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const value = luminance[index];
      const horizontalEdge = x > 0 ? Math.abs(value - luminance[index - 1]) : 0;
      const verticalEdge = y > 0 ? Math.abs(value - luminance[index - width]) : 0;
      const edgeEnergy = (horizontalEdge + verticalEdge) / 2;
      const deviation = Math.abs(value - borderMean);
      const isEdge = edgeEnergy >= thresholds.edgeThreshold;
      const isActive = deviation >= thresholds.luminanceDeviationThreshold || isEdge;
      const isBorder =
        x < borderBandX ||
        x >= width - borderBandX ||
        y < borderBandY ||
        y >= height - borderBandY;
      const isCenter =
        x >= centerInsetX &&
        x < width - centerInsetX &&
        y >= centerInsetY &&
        y < height - centerInsetY;

      if (isEdge) edgeCount += 1;
      if (isCenter) centerPixelCount += 1;
      if (!isActive) continue;

      const weight = 1 + Math.min(3, deviation / thresholds.luminanceDeviationThreshold) + Math.min(2, edgeEnergy / thresholds.edgeThreshold);
      activeCount += 1;
      if (isBorder) borderActiveCount += 1;
      if (isCenter) centerActiveCount += 1;
      weightTotal += weight;
      weightedX += x * weight;
      weightedY += y * weight;
    }
  }

  const foregroundCoverage = activeCount / pixelCount;
  const edgeDensity = edgeCount / pixelCount;
  const borderContact = borderActiveCount / Math.max(1, borderPixelCount);
  const centralActivity = centerActiveCount / Math.max(1, centerPixelCount);
  const presenceScore = clamp(
    clamp(foregroundCoverage / thresholds.minimumCoverage) * 0.5 +
      clamp(edgeDensity / thresholds.minimumEdgeDensity) * 0.25 +
      clamp(centralActivity / thresholds.minimumCentralActivity) * 0.25
  ) * 100;
  const likelyCropped =
    foregroundCoverage > thresholds.maximumCoverage ||
    borderContact > thresholds.cropBorderContact;

  const presenceState = likelyCropped && presenceScore >= thresholds.lowConfidenceScore
    ? "OVERFILLED_OR_CROPPED"
    : presenceScore >= thresholds.presentScore
      ? "SUBJECT_PRESENT"
      : presenceScore >= thresholds.lowConfidenceScore
        ? "SUBJECT_PRESENT_LOW_CONFIDENCE"
        : "EMPTY_OR_UNCERTAIN";
  const hasReliableCentroid = ["SUBJECT_PRESENT", "OVERFILLED_OR_CROPPED"].includes(presenceState) && weightTotal > 0;
  const centroidXRatio = hasReliableCentroid ? clamp(weightedX / weightTotal / Math.max(1, width - 1)) : null;
  const centroidYRatio = hasReliableCentroid ? clamp(weightedY / weightTotal / Math.max(1, height - 1)) : null;
  const sizeState = !hasReliableCentroid
    ? "UNKNOWN"
    : likelyCropped
      ? "TOO_LARGE_OR_CROPPED"
      : foregroundCoverage < thresholds.minimumCoverage
        ? "TOO_SMALL"
        : "ACCEPTABLE";
  const placement = classifyPlacement({
    presenceState,
    sizeState,
    centroidXRatio,
    centroidYRatio,
    horizontalDeadZone: thresholds.horizontalDeadZone,
    verticalDeadZone: thresholds.verticalDeadZone,
  });

  return {
    presenceScore: round(presenceScore),
    edgeDensity: round(edgeDensity),
    foregroundCoverage: round(foregroundCoverage),
    centroidXRatio: centroidXRatio === null ? null : round(centroidXRatio),
    centroidYRatio: centroidYRatio === null ? null : round(centroidYRatio),
    borderContact: round(borderContact),
    sizeState,
    presenceState,
    confidenceLevel:
      presenceState === "SUBJECT_PRESENT" ? "HIGH" :
        presenceState === "OVERFILLED_OR_CROPPED" ? "MEDIUM" :
          presenceState === "SUBJECT_PRESENT_LOW_CONFIDENCE" ? "LOW" : "UNCERTAIN",
    ...placement,
  };
};

const averageNullable = (results, key) => {
  const values = results.map((result) => result[key]).filter(Number.isFinite);
  return values.length ? round(values.reduce((total, value) => total + value, 0) / values.length) : null;
};

const stableValue = (results, key) => {
  const counts = new Map();
  let selected = results[0]?.[key] ?? null;
  let selectedCount = 0;
  results.forEach((result) => {
    const value = result[key] ?? null;
    const count = (counts.get(value) || 0) + 1;
    counts.set(value, count);
    if (count > selectedCount) {
      selected = value;
      selectedCount = count;
    }
  });
  return selected;
};

export const smoothSubjectPlacement = (results, maximumSamples = 4) => {
  const samples = Array.isArray(results) ? results.slice(-Math.max(1, maximumSamples)) : [];
  if (!samples.length) return null;
  const latest = samples[samples.length - 1];
  return {
    ...latest,
    sampleCount: samples.length,
    presenceScore: averageNullable(samples, "presenceScore"),
    edgeDensity: averageNullable(samples, "edgeDensity"),
    foregroundCoverage: averageNullable(samples, "foregroundCoverage"),
    centroidXRatio: averageNullable(samples, "centroidXRatio"),
    centroidYRatio: averageNullable(samples, "centroidYRatio"),
    borderContact: averageNullable(samples, "borderContact"),
    presenceState: stableValue(samples, "presenceState"),
    sizeState: stableValue(samples, "sizeState"),
    confidenceLevel: stableValue(samples, "confidenceLevel"),
    horizontalGuidance: stableValue(samples, "horizontalGuidance"),
    verticalGuidance: stableValue(samples, "verticalGuidance"),
    distanceGuidance: stableValue(samples, "distanceGuidance"),
    alignmentState: stableValue(samples, "alignmentState"),
    guidance: stableValue(samples, "guidance"),
  };
};
