export const SCAN_MODE_GUIDES = Object.freeze({
  SINGLE_FRUIT: Object.freeze({
    label: "Single Fruit",
    shape: "circle",
    xRatio: 0.2,
    yRatio: 0.26,
    widthRatio: 0.6,
    heightRatio: 0.48,
    helperText: "Place one fruit inside the guide and fill most of the area.",
    heuristics: Object.freeze({
      minimumCoverage: 0.1,
      maximumCoverage: 0.58,
      cropBorderContact: 0.56,
      minimumEdgeDensity: 0.025,
      minimumCentralActivity: 0.1,
      presentScore: 48,
      lowConfidenceScore: 28,
      horizontalDeadZone: 0.1,
      verticalDeadZone: 0.12,
    }),
  }),
  FRUIT_GROUP: Object.freeze({
    label: "Fruit Group",
    shape: "roundedRect",
    xRatio: 0.1,
    yRatio: 0.28,
    widthRatio: 0.8,
    heightRatio: 0.44,
    helperText: "Keep the complete fruit group inside the guide.",
    heuristics: Object.freeze({
      minimumCoverage: 0.14,
      maximumCoverage: 0.76,
      cropBorderContact: 0.68,
      minimumEdgeDensity: 0.022,
      minimumCentralActivity: 0.09,
      presentScore: 44,
      lowConfidenceScore: 26,
      horizontalDeadZone: 0.12,
      verticalDeadZone: 0.13,
    }),
  }),
  TRAY_PACKED: Object.freeze({
    label: "Tray / Packed Fruit",
    shape: "rect",
    xRatio: 0.08,
    yRatio: 0.3,
    widthRatio: 0.84,
    heightRatio: 0.4,
    helperText: "Align the tray edges with the guide without cutting them off.",
    heuristics: Object.freeze({
      minimumCoverage: 0.2,
      maximumCoverage: 0.86,
      cropBorderContact: 0.78,
      minimumEdgeDensity: 0.018,
      minimumCentralActivity: 0.08,
      presentScore: 40,
      lowConfidenceScore: 24,
      horizontalDeadZone: 0.12,
      verticalDeadZone: 0.14,
    }),
  }),
  PACKAGE_VIEW: Object.freeze({
    label: "Crate / Carton View",
    shape: "rect",
    xRatio: 0.07,
    yRatio: 0.07,
    widthRatio: 0.86,
    heightRatio: 0.86,
    helperText: "Keep the full crate or carton visible inside the guide.",
    heuristics: Object.freeze({
      minimumCoverage: 0.18,
      maximumCoverage: 0.82,
      cropBorderContact: 0.72,
      minimumEdgeDensity: 0.018,
      minimumCentralActivity: 0.08,
      presentScore: 40,
      lowConfidenceScore: 24,
      horizontalDeadZone: 0.12,
      verticalDeadZone: 0.13,
    }),
  }),
});

const finitePositive = (value) => Number.isFinite(Number(value)) && Number(value) > 0;
const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

export const getGuideRoi = ({
  videoWidth,
  videoHeight,
  displayedWidth,
  displayedHeight,
  guide,
  objectFit = "cover",
}) => {
  if (
    !finitePositive(videoWidth) ||
    !finitePositive(videoHeight) ||
    !finitePositive(displayedWidth) ||
    !finitePositive(displayedHeight) ||
    !guide
  ) {
    return null;
  }

  const sourceWidth = Number(videoWidth);
  const sourceHeight = Number(videoHeight);
  const previewWidth = Number(displayedWidth);
  const previewHeight = Number(displayedHeight);
  const xRatio = Number(guide.xRatio);
  const yRatio = Number(guide.yRatio);
  const widthRatio = Number(guide.widthRatio);
  const heightRatio = Number(guide.heightRatio);

  if (
    !Number.isFinite(xRatio) ||
    !Number.isFinite(yRatio) ||
    !finitePositive(widthRatio) ||
    !finitePositive(heightRatio)
  ) {
    return null;
  }

  const scale = objectFit === "contain"
    ? Math.min(previewWidth / sourceWidth, previewHeight / sourceHeight)
    : Math.max(previewWidth / sourceWidth, previewHeight / sourceHeight);
  if (!finitePositive(scale)) return null;

  const renderedWidth = sourceWidth * scale;
  const renderedHeight = sourceHeight * scale;
  const renderedX = (previewWidth - renderedWidth) / 2;
  const renderedY = (previewHeight - renderedHeight) / 2;
  const guideLeft = previewWidth * xRatio;
  const guideTop = previewHeight * yRatio;
  const guideRight = guideLeft + previewWidth * widthRatio;
  const guideBottom = guideTop + previewHeight * heightRatio;

  const visibleLeft = clamp(guideLeft, renderedX, renderedX + renderedWidth);
  const visibleTop = clamp(guideTop, renderedY, renderedY + renderedHeight);
  const visibleRight = clamp(guideRight, renderedX, renderedX + renderedWidth);
  const visibleBottom = clamp(guideBottom, renderedY, renderedY + renderedHeight);
  if (visibleRight <= visibleLeft || visibleBottom <= visibleTop) return null;

  const sourceX = clamp((visibleLeft - renderedX) / scale, 0, sourceWidth);
  const sourceY = clamp((visibleTop - renderedY) / scale, 0, sourceHeight);
  const mappedWidth = clamp((visibleRight - visibleLeft) / scale, 0, sourceWidth - sourceX);
  const mappedHeight = clamp((visibleBottom - visibleTop) / scale, 0, sourceHeight - sourceY);
  if (mappedWidth < 1 || mappedHeight < 1) return null;

  return {
    sourceX,
    sourceY,
    sourceWidth: mappedWidth,
    sourceHeight: mappedHeight,
  };
};
