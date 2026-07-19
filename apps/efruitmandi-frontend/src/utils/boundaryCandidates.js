export const BOUNDARY_DETECTOR_VERSION = "1";

export const BOUNDARY_THRESHOLDS = Object.freeze({
  edgeThreshold: 18,
  strongEdgeThreshold: 30,
  backgroundDeviationThreshold: 22,
  colourActivityThreshold: 18,
  borderBandRatio: 0.08,
  minimumWidth: 4,
  minimumHeight: 4,
  minimumFillRatio: 0.12,
  minimumEdgeStrength: 8,
  maximumProcessedRegions: 80,
  maximumCandidates: 50,
});

export const BOUNDARY_MODE_RULES = Object.freeze({
  SINGLE_FRUIT: Object.freeze({
    minimumAreaRatio: 0.02,
    maximumAreaRatio: 0.74,
    maximumAspectRatio: 3.5,
    maximumBorderContact: 0.55,
    preferredAreaRatio: 0.28,
    confidenceFloor: 0.34,
    allowMultiple: false,
  }),
  FRUIT_GROUP: Object.freeze({
    minimumAreaRatio: 0.004,
    maximumAreaRatio: 0.78,
    maximumAspectRatio: 4.5,
    maximumBorderContact: 0.7,
    preferredAreaRatio: 0.12,
    confidenceFloor: 0.26,
    allowMultiple: true,
  }),
  TRAY_PACKED: Object.freeze({
    minimumAreaRatio: 0.002,
    maximumAreaRatio: 0.7,
    maximumAspectRatio: 4.5,
    maximumBorderContact: 0.78,
    preferredAreaRatio: 0.06,
    confidenceFloor: 0.24,
    allowMultiple: true,
  }),
  PACKAGE_VIEW: Object.freeze({
    minimumAreaRatio: 0.04,
    maximumAreaRatio: 0.9,
    maximumAspectRatio: 6,
    maximumBorderContact: 0.82,
    preferredAreaRatio: 0.35,
    confidenceFloor: 0.3,
    allowMultiple: false,
    confidenceMultiplier: 0.72,
  }),
});

const clamp = (value, minimum = 0, maximum = 1) =>
  Math.min(maximum, Math.max(minimum, value));
const round = (value) => Math.round(value * 1000) / 1000;
const luminance = (red, green, blue) => red * 0.299 + green * 0.587 + blue * 0.114;

const confidenceLevel = (confidence) =>
  confidence >= 0.68 ? "HIGH" : confidence >= 0.42 ? "MEDIUM" : confidence > 0 ? "LOW" : "NONE";

export const detectBoundaryCandidates = (imageData, options = {}) => {
  const width = Number(imageData?.width || 0);
  const height = Number(imageData?.height || 0);
  const pixels = imageData?.data;
  if (!pixels || width < 5 || height < 5 || pixels.length < width * height * 4) {
    throw new Error("Invalid boundary candidate frame data");
  }

  const thresholds = { ...BOUNDARY_THRESHOLDS, ...(options.thresholds || {}) };
  const scanMode = BOUNDARY_MODE_RULES[options.scanMode]
    ? options.scanMode
    : "SINGLE_FRUIT";
  const rules = { ...BOUNDARY_MODE_RULES[scanMode], ...(options.modeRules || {}) };
  const pixelCount = width * height;
  const luma = new Float32Array(pixelCount);
  const colourActivity = new Float32Array(pixelCount);
  const edgeEnergy = new Float32Array(pixelCount);
  const activity = new Uint8Array(pixelCount);
  const mask = new Uint8Array(pixelCount);
  const visited = new Uint8Array(pixelCount);
  const borderX = Math.max(1, Math.round(width * thresholds.borderBandRatio));
  const borderY = Math.max(1, Math.round(height * thresholds.borderBandRatio));
  let borderRed = 0;
  let borderGreen = 0;
  let borderBlue = 0;
  let borderSamples = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixelIndex = y * width + x;
      const dataIndex = pixelIndex * 4;
      const red = pixels[dataIndex];
      const green = pixels[dataIndex + 1];
      const blue = pixels[dataIndex + 2];
      luma[pixelIndex] = luminance(red, green, blue);
      colourActivity[pixelIndex] = Math.max(red, green, blue) - Math.min(red, green, blue);
      if (x < borderX || x >= width - borderX || y < borderY || y >= height - borderY) {
        borderRed += red;
        borderGreen += green;
        borderBlue += blue;
        borderSamples += 1;
      }
    }
  }

  const backgroundRed = borderRed / Math.max(1, borderSamples);
  const backgroundGreen = borderGreen / Math.max(1, borderSamples);
  const backgroundBlue = borderBlue / Math.max(1, borderSamples);

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      const dataIndex = index * 4;
      const horizontal = Math.abs(luma[index + 1] - luma[index - 1]);
      const vertical = Math.abs(luma[index + width] - luma[index - width]);
      const edge = (horizontal + vertical) / 2;
      edgeEnergy[index] = edge;
      const backgroundDeviation =
        (Math.abs(pixels[dataIndex] - backgroundRed) +
          Math.abs(pixels[dataIndex + 1] - backgroundGreen) +
          Math.abs(pixels[dataIndex + 2] - backgroundBlue)) /
        3;
      const hasEdge = edge >= thresholds.edgeThreshold;
      const differsFromBorder = backgroundDeviation >= thresholds.backgroundDeviationThreshold;
      const hasColourActivity = colourActivity[index] >= thresholds.colourActivityThreshold;
      if ((differsFromBorder && (hasEdge || hasColourActivity)) || (hasEdge && hasColourActivity)) {
        activity[index] = 1;
      }
    }
  }

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      let activeNeighbours = 0;
      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          activeNeighbours += activity[index + offsetY * width + offsetX];
        }
      }
      mask[index] = activity[index] || activeNeighbours >= 3 ? 1 : 0;
    }
  }

  const candidates = [];
  let processedRegions = 0;
  let processingLimited = false;

  outer: for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const start = y * width + x;
      if (!mask[start] || visited[start]) continue;
      if (processedRegions >= thresholds.maximumProcessedRegions) {
        processingLimited = true;
        break outer;
      }
      processedRegions += 1;

      const stack = [start];
      visited[start] = 1;
      let area = 0;
      let perimeter = 0;
      let edgeTotal = 0;
      let strongEdges = 0;
      let sumX = 0;
      let sumY = 0;
      let minX = width;
      let minY = height;
      let maxX = 0;
      let maxY = 0;
      let borderPixels = 0;

      while (stack.length) {
        const index = stack.pop();
        const currentY = Math.floor(index / width);
        const currentX = index - currentY * width;
        area += 1;
        sumX += currentX;
        sumY += currentY;
        minX = Math.min(minX, currentX);
        minY = Math.min(minY, currentY);
        maxX = Math.max(maxX, currentX);
        maxY = Math.max(maxY, currentY);
        edgeTotal += edgeEnergy[index];
        if (edgeEnergy[index] >= thresholds.strongEdgeThreshold) strongEdges += 1;
        if (currentX <= 1 || currentX >= width - 2 || currentY <= 1 || currentY >= height - 2) {
          borderPixels += 1;
        }

        const neighbours = [index - 1, index + 1, index - width, index + width];
        neighbours.forEach((neighbour) => {
          if (!mask[neighbour]) {
            perimeter += 1;
          } else if (!visited[neighbour]) {
            visited[neighbour] = 1;
            stack.push(neighbour);
          }
        });
      }

      const regionWidth = maxX - minX + 1;
      const regionHeight = maxY - minY + 1;
      const areaRatio = area / pixelCount;
      const aspectRatio = regionWidth / Math.max(1, regionHeight);
      const normalizedAspect = Math.max(aspectRatio, 1 / Math.max(aspectRatio, 0.001));
      const fillRatio = area / Math.max(1, regionWidth * regionHeight);
      const averageEdge = edgeTotal / Math.max(1, area);
      const borderContact = borderPixels / Math.max(1, perimeter);
      if (
        areaRatio < rules.minimumAreaRatio ||
        areaRatio > rules.maximumAreaRatio ||
        regionWidth < thresholds.minimumWidth ||
        regionHeight < thresholds.minimumHeight ||
        normalizedAspect > rules.maximumAspectRatio ||
        fillRatio < thresholds.minimumFillRatio ||
        averageEdge < thresholds.minimumEdgeStrength ||
        borderContact > rules.maximumBorderContact
      ) {
        continue;
      }

      const circularity = clamp((4 * Math.PI * area) / Math.max(1, perimeter * perimeter));
      const centerXRatio = sumX / Math.max(1, area) / Math.max(1, width - 1);
      const centerYRatio = sumY / Math.max(1, area) / Math.max(1, height - 1);
      const centerDistance = Math.hypot(centerXRatio - 0.5, centerYRatio - 0.5) / Math.SQRT1_2;
      const areaScore = clamp(areaRatio / Math.max(rules.preferredAreaRatio, 0.001));
      const edgeScore = clamp(averageEdge / Math.max(thresholds.strongEdgeThreshold, 1));
      const fillScore = clamp((fillRatio - thresholds.minimumFillRatio) / 0.6);
      const borderScore = clamp(1 - borderContact / Math.max(rules.maximumBorderContact, 0.01));
      const centerScore = scanMode === "SINGLE_FRUIT" ? clamp(1 - centerDistance) : 0.65;
      const confidence = clamp(
        (areaScore * 0.24 + edgeScore * 0.24 + fillScore * 0.18 + borderScore * 0.18 +
          circularity * 0.08 + centerScore * 0.08) *
          (rules.confidenceMultiplier || 1)
      );
      if (confidence < rules.confidenceFloor) continue;

      const partialCandidate = borderPixels > 0;
      const possibleMergedRegion =
        areaRatio > rules.preferredAreaRatio * 2.25 &&
        (circularity < 0.42 || normalizedAspect > 1.7 || strongEdges / Math.max(1, area) > 0.24);

      candidates.push({
        id: "",
        boundingBox: {
          x: minX,
          y: minY,
          width: regionWidth,
          height: regionHeight,
          xRatio: round(minX / width),
          yRatio: round(minY / height),
          widthRatio: round(regionWidth / width),
          heightRatio: round(regionHeight / height),
        },
        center: {
          x: round(sumX / Math.max(1, area)),
          y: round(sumY / Math.max(1, area)),
          xRatio: round(centerXRatio),
          yRatio: round(centerYRatio),
        },
        areaPixels: area,
        perimeterEstimate: perimeter,
        widthPixels: regionWidth,
        heightPixels: regionHeight,
        aspectRatio: round(aspectRatio),
        circularityScore: round(circularity),
        edgeStrength: round(averageEdge),
        fillRatio: round(fillRatio),
        borderContact: round(borderContact),
        partialCandidate,
        possibleMergedRegion,
        confidence: round(confidence),
      });
    }
  }

  const selected = candidates
    .sort((left, right) => right.confidence - left.confidence || right.areaPixels - left.areaPixels)
    .slice(0, thresholds.maximumCandidates)
    .map((candidate, index) => ({ ...candidate, id: `candidate-${index + 1}` }));
  const maximumConfidence = selected[0]?.confidence || 0;
  const calibrationReady = options.calibration?.status === "READY";

  return {
    candidates: selected,
    candidateCount: selected.length,
    processingStatus: processingLimited ? "LIMITED" : selected.length ? "COMPLETE" : "NO_CANDIDATES",
    confidenceLevel: confidenceLevel(maximumConfidence),
    coordinateSpace: calibrationReady ? "CALIBRATED_PIXEL_RATIO" : "PIXEL_RATIO",
    orientation: options.calibration?.orientation || null,
    evaluatedAt: options.evaluatedAt ?? null,
  };
};

const candidatesMatch = (current, previous) => {
  const centerDistance = Math.hypot(
    current.center.xRatio - previous.center.xRatio,
    current.center.yRatio - previous.center.yRatio
  );
  const areaRatio = current.areaPixels / Math.max(1, previous.areaPixels);
  return centerDistance <= 0.13 && areaRatio >= 0.5 && areaRatio <= 2;
};

export const stabilizeBoundaryCandidates = (history, options = {}) => {
  const samples = Array.isArray(history) ? history.slice(-3) : [];
  const latest = samples[samples.length - 1];
  const scanMode = BOUNDARY_MODE_RULES[options.scanMode] ? options.scanMode : "SINGLE_FRUIT";
  if (!latest) return null;

  const stableCandidates = latest.candidates
    .map((candidate) => ({
      ...candidate,
      stabilitySamples: samples.reduce(
        (total, sample) => total + (sample.candidates.some((item) => candidatesMatch(candidate, item)) ? 1 : 0),
        0
      ),
    }))
    .filter((candidate) => candidate.stabilitySamples >= 2);
  const dominantCandidate = stableCandidates[0] || null;
  const lowConfidence = stableCandidates.length > 0 && dominantCandidate.confidence < 0.5;
  const status = samples.length < 2
    ? "EVALUATING"
    : !stableCandidates.length
      ? latest.candidateCount ? "EVALUATING" : "NO_CANDIDATE"
      : lowConfidence
        ? "LOW_CONFIDENCE"
        : stableCandidates.length > 1 && scanMode !== "PACKAGE_VIEW"
          ? "MULTIPLE_CANDIDATES"
          : "CANDIDATE_FOUND";

  return {
    status,
    candidateCount: stableCandidates.length,
    dominantCandidate,
    candidates: stableCandidates,
    confidenceLevel: dominantCandidate ? confidenceLevel(dominantCandidate.confidence) : "NONE",
    possibleMergedRegions: stableCandidates.filter((candidate) => candidate.possibleMergedRegion).length,
    partialCandidateCount: stableCandidates.filter((candidate) => candidate.partialCandidate).length,
    coordinateSpace: latest.coordinateSpace || "PIXEL_RATIO",
    orientation: latest.orientation || null,
    evaluatedAt: latest.evaluatedAt,
    detectorVersion: BOUNDARY_DETECTOR_VERSION,
  };
};
