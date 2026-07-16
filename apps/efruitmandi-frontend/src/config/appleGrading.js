export const QUALITY_OPTIONS = [
  "Ungraded / Farm Fresh",
  "Grade A+ Premium Certified Organic / Natural Quality",
  "Grade A Premium Certified Organic / Natural Quality",
  "Grade B+ Certified Organic / Natural Quality",
  "Grade B Certified Organic / Natural Quality",
  "Grade C Certified Organic / Natural Quality",
  "Grade A+ Premium Quality",
  "Grade A Premium Quality",
  "Grade B+ Quality",
  "Grade B Quality",
  "Grade C Quality",
];

export const ORGANIC_CERTIFIED_QUALITIES = new Set([
  "Grade A+ Premium Certified Organic / Natural Quality",
  "Grade A Premium Certified Organic / Natural Quality",
  "Grade B+ Certified Organic / Natural Quality",
  "Grade B Certified Organic / Natural Quality",
  "Grade C Certified Organic / Natural Quality",
]);

export const SIZE_OPTIONS = [
  { label: "Extra Large", value: "EXTRA_LARGE" },
  { label: "Large", value: "LARGE" },
  { label: "Medium", value: "MEDIUM" },
  { label: "Small", value: "SMALL" },
];

export const OTHER_CUSTOM_SIZE_CODE = "OTHER_CUSTOM";

export const APPLE_SIZE_GRADING = [
  { code: "EXTRA_LARGE", label: "Extra Large", diameterMinMm: 80, diameterMaxMm: null },
  { code: "LARGE", label: "Large", diameterMinMm: 75, diameterMaxMm: 80 },
  { code: "MEDIUM", label: "Medium", diameterMinMm: 70, diameterMaxMm: 75 },
  { code: "SMALL", label: "Small", diameterMinMm: 65, diameterMaxMm: 70 },
  { code: OTHER_CUSTOM_SIZE_CODE, label: "Other / Custom", diameterMinMm: null, diameterMaxMm: null },
];

export const APPLE_TRAY_PIECE_COUNT_OPTIONS = [16, 18, 20, 22, 24, 25, 28, 30, 32, 36, 40];
export const APPLE_LOOSE_PACKAGE_COUNT_OPTIONS = [
  40, 48, 56, 64, 72, 80, 88, 96, 100, 113, 125, 138, 150, 163, 175,
];

export const isAppleFruitValue = (fruitName = "") =>
  String(fruitName || "").trim().toLowerCase() === "apple";

export const getAppleSizePreset = (sizeCode = "") =>
  APPLE_SIZE_GRADING.find((preset) => preset.code === sizeCode) || null;

export const getAppleSizeFromDiameter = (diameterMm) => {
  const diameter = Number(diameterMm);
  if (!Number.isFinite(diameter) || diameter <= 0) return null;
  const preset = APPLE_SIZE_GRADING.find(
    (item) =>
      item.code !== OTHER_CUSTOM_SIZE_CODE &&
      diameter >= item.diameterMinMm &&
      (item.diameterMaxMm === null || diameter < item.diameterMaxMm)
  );
  return preset?.code || OTHER_CUSTOM_SIZE_CODE;
};

export const formatAppleDiameterRange = ({
  diameterPresetCode = "",
  diameterMinMm,
  diameterMaxMm,
} = {}) => {
  const preset = getAppleSizePreset(diameterPresetCode);
  const minimum = Number(diameterMinMm);
  const maximum = diameterMaxMm === null || diameterMaxMm === undefined || diameterMaxMm === ""
    ? null
    : Number(diameterMaxMm);
  if (!Number.isFinite(minimum) || minimum <= 0) return "";
  const prefix = preset?.code === OTHER_CUSTOM_SIZE_CODE ? "Custom: " : "";
  const displayedMaximum = preset?.code === OTHER_CUSTOM_SIZE_CODE
    ? maximum
    : maximum === null
      ? null
      : Number((maximum - 0.01).toFixed(2));
  return displayedMaximum !== null && Number.isFinite(displayedMaximum)
    ? `${prefix}${minimum}–${displayedMaximum} mm`
    : `${prefix}${minimum} mm and above`;
};

export const getQualityLabel = (quality = "") =>
  QUALITY_OPTIONS.includes(quality) ? quality : String(quality || "").trim();

export const getSizeLabel = (size = "") =>
  APPLE_SIZE_GRADING.find((option) => option.code === size)?.label ||
  String(size || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

export const isCertifiedQuality = (quality = "") =>
  ORGANIC_CERTIFIED_QUALITIES.has(String(quality || "").trim());
