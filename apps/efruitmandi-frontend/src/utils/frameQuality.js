export const FRAME_QUALITY_THRESHOLDS = Object.freeze({
  brightnessMin: 22,
  brightnessMax: 88,
  contrastMin: 18,
  sharpnessMin: 12,
  stableMotionMax: 2.2,
  settlingMotionMax: 6.5,
  stableDurationMs: 1000,
});

const clampScore = (value) => Math.max(0, Math.min(100, value));
const roundScore = (value) => Math.round(value * 10) / 10;
const luminanceAt = (data, index) =>
  Math.round(data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114);

export const analyzeFrameQuality = (
  imageData,
  previousFrameData = null,
  options = {}
) => {
  const thresholds = { ...FRAME_QUALITY_THRESHOLDS, ...(options.thresholds || {}) };
  const width = Number(imageData?.width || 0);
  const height = Number(imageData?.height || 0);
  const pixels = imageData?.data;

  if (!pixels || width <= 1 || height <= 1 || pixels.length < width * height * 4) {
    throw new Error("Invalid frame data");
  }

  const pixelCount = width * height;
  const luminance = new Uint8Array(pixelCount);
  let luminanceTotal = 0;

  for (let pixelIndex = 0, dataIndex = 0; pixelIndex < pixelCount; pixelIndex += 1, dataIndex += 4) {
    const value = luminanceAt(pixels, dataIndex);
    luminance[pixelIndex] = value;
    luminanceTotal += value;
  }

  const meanLuminance = luminanceTotal / pixelCount;
  let varianceTotal = 0;
  let gradientTotal = 0;
  let gradientSamples = 0;

  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * width;
    for (let x = 0; x < width; x += 1) {
      const index = rowOffset + x;
      const value = luminance[index];
      const deviation = value - meanLuminance;
      varianceTotal += deviation * deviation;

      if (x > 0) {
        gradientTotal += Math.abs(value - luminance[index - 1]);
        gradientSamples += 1;
      }
      if (y > 0) {
        gradientTotal += Math.abs(value - luminance[index - width]);
        gradientSamples += 1;
      }
    }
  }

  const brightnessScore = clampScore((meanLuminance / 255) * 100);
  const contrastScore = clampScore((Math.sqrt(varianceTotal / pixelCount) / 64) * 100);
  const sharpnessScore = clampScore(((gradientTotal / Math.max(1, gradientSamples)) / 32) * 100);
  const hasPreviousFrame = Boolean(
    previousFrameData?.luminance &&
      previousFrameData.width === width &&
      previousFrameData.height === height &&
      previousFrameData.luminance.length === luminance.length
  );

  let motionScore = null;
  if (hasPreviousFrame) {
    let differenceTotal = 0;
    for (let index = 0; index < pixelCount; index += 1) {
      differenceTotal += Math.abs(luminance[index] - previousFrameData.luminance[index]);
    }
    motionScore = clampScore((differenceTotal / pixelCount / 255) * 100);
  }

  const brightnessState =
    brightnessScore < thresholds.brightnessMin
      ? "TOO_DARK"
      : brightnessScore > thresholds.brightnessMax
        ? "TOO_BRIGHT"
        : "GOOD";
  const contrastState = contrastScore < thresholds.contrastMin ? "LOW" : "GOOD";
  const sharpnessState = sharpnessScore < thresholds.sharpnessMin ? "BLURRY" : "ACCEPTABLE";
  const motionState = !hasPreviousFrame
    ? "CHECKING"
    : motionScore > thresholds.settlingMotionMax
      ? "MOVING"
      : motionScore > thresholds.stableMotionMax
        ? "SETTLING"
        : "STABLE";
  const stabilityScore = hasPreviousFrame
    ? clampScore(100 - (motionScore / thresholds.settlingMotionMax) * 100)
    : 0;
  const sampleAcceptable =
    hasPreviousFrame &&
    brightnessState === "GOOD" &&
    contrastState === "GOOD" &&
    sharpnessState === "ACCEPTABLE" &&
    motionState === "STABLE";
  const stableForMs = sampleAcceptable ? Math.max(0, Number(options.stableForMs || 0)) : 0;

  let readiness = "CHECKING";
  let instruction = "Keep the fruit inside the guide";
  if (brightnessState === "TOO_DARK") {
    readiness = "TOO_DARK";
    instruction = "Add more light";
  } else if (brightnessState === "TOO_BRIGHT") {
    readiness = "TOO_BRIGHT";
    instruction = "Reduce direct glare";
  } else if (motionState === "MOVING" || motionState === "SETTLING") {
    readiness = "MOVING";
    instruction = "Hold the camera steady";
  } else if (sharpnessState === "BLURRY") {
    readiness = "BLURRY";
    instruction = "Move slightly closer and improve focus";
  } else if (contrastState === "LOW") {
    readiness = "LOW_CONTRAST";
    instruction = "Improve lighting or background contrast";
  } else if (sampleAcceptable && stableForMs >= thresholds.stableDurationMs) {
    readiness = "READY";
    instruction = "Ready to Capture";
  }

  const brightnessQuality = brightnessState === "GOOD"
    ? 100
    : brightnessState === "TOO_DARK"
      ? clampScore((brightnessScore / thresholds.brightnessMin) * 100)
      : clampScore(((100 - brightnessScore) / (100 - thresholds.brightnessMax)) * 100);
  const overallScore =
    brightnessQuality * 0.25 +
    clampScore((contrastScore / thresholds.contrastMin) * 100) * 0.15 +
    clampScore((sharpnessScore / thresholds.sharpnessMin) * 100) * 0.25 +
    stabilityScore * 0.35;
  const reasons = readiness === "READY" ? [] : [instruction];

  return {
    brightnessScore: roundScore(brightnessScore),
    contrastScore: roundScore(contrastScore),
    sharpnessScore: roundScore(sharpnessScore),
    motionScore: motionScore === null ? null : roundScore(motionScore),
    stabilityScore: roundScore(stabilityScore),
    overallScore: roundScore(overallScore),
    readiness,
    reasons,
    instruction,
    brightnessState,
    contrastState,
    sharpnessState,
    motionState,
    sampleAcceptable,
    frameData: { width, height, luminance },
  };
};
