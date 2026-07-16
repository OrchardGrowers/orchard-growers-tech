import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import QRCode from "qrcode";
import {
  FaTimes,
  FaCertificate,
  FaImage,
  FaMapMarkerAlt,
  FaMoneyBillWave,
  FaPlus,
  FaSpinner,
  FaVideo,
  FaWarehouse,
  FaWeightHanging,
} from "react-icons/fa";
import API, { getApiErrorMessage } from "../services/api";
import { trackLotCreated } from "../services/analytics";
import {
  CUSTOM_OPTION_CODE,
  getPackingSpecification,
} from "../config/packingSpecifications";
import {
  APPLE_LOOSE_PACKAGE_COUNT_OPTIONS,
  APPLE_SIZE_GRADING,
  APPLE_TRAY_PIECE_COUNT_OPTIONS,
  ORGANIC_CERTIFIED_QUALITIES,
  OTHER_CUSTOM_SIZE_CODE,
  QUALITY_OPTIONS,
  SIZE_OPTIONS,
  formatAppleDiameterRange,
  getAppleSizeFromDiameter,
  getAppleSizePreset,
  getSizeLabel,
  isAppleFruitValue,
} from "../config/appleGrading";
import {
  getCurrentUser,
  hasCompletedKycForRole,
  hasGrowerProfile,
} from "../utils/auth";
import { isMobileDevice, prepareUploadFile } from "../utils/mobileMedia";
import { requestMediaPermission } from "../utils/mobilePermissions";
import { calculatePackingTotals } from "../utils/packingCalculations";

let fruitRecognitionModulePromise;

const loadFruitRecognition = () => {
  if (!fruitRecognitionModulePromise) {
    fruitRecognitionModulePromise = import("../utils/fruitRecognition");
  }

  return fruitRecognitionModulePromise;
};

const withTimeout = (promise, ms = 15000) => {
  let timeoutId;

  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("recognition-timeout")), ms);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
};

const isLowMemoryRecognitionError = (error) => {
  const message = String(error?.message || error || "").toLowerCase();

  return (
    message.includes("memory") ||
    message.includes("not enough") ||
    message.includes("allocation") ||
    message.includes("canvas") ||
    message.includes("timeout") ||
    message.includes("recognition-timeout") ||
    message.includes("webgl") ||
    message.includes("context lost")
  );
};

const DEFAULT_FRUITS = [
  "Almond",
  "Amla",
  "Anjeer",
  "Apple",
  "Apricot",
  "Avocado",
  "Banana",
  "Bael",
  "Barberry",
  "Ber",
  "Bilberry",
  "Black Raisin",
  "Blackberries",
  "Blackcurrant",
  "Blueberries",
  "Boysenberry",
  "Brazil Nut",
  "Breadfruit",
  "Cactus Pear",
  "Cantaloupe",
  "Cape Gooseberry",
  "Carambola",
  "Cashew",
  "Cashew Apple",
  "Cherry",
  "Chestnut",
  "Chikoo",
  "Citron",
  "Clementine",
  "Cloudberry",
  "Coconut",
  "Cranberry",
  "Currants",
  "Custard Apple",
  "Dates",
  "Dried Apricot",
  "Dried Berries",
  "Dried Fig",
  "Dried Kiwi",
  "Dried Mango",
  "Dried Papaya",
  "Dried Pineapple",
  "Dried Plum",
  "Dragon Fruit",
  "Durian",
  "Elderberries",
  "Fig",
  "Fox Nut",
  "Golden Raisin",
  "Gooseberry",
  "Grapefruit",
  "Grapes",
  "Guava",
  "Hazelnut",
  "Honeydew Melon",
  "Indian Fig",
  "Indian Gooseberry",
  "Jackfruit",
  "Jamun",
  "Jujube",
  "Kafal",
  "Kinnow",
  "Kiwi",
  "Kishmish",
  "Kumquat",
  "Langsat",
  "Lemon",
  "Lime",
  "Litchi",
  "Longan",
  "Loquat",
  "Lotus Seed",
  "Mandarin",
  "Mango",
  "Mangosteen",
  "Makhana",
  "Melon",
  "Mulberry",
  "Muskmelon",
  "Nance",
  "Nectarine",
  "Orange",
  "Papaya",
  "Passion Fruit",
  "Peach",
  "Peanut",
  "Pear",
  "Pecan",
  "Persimmon",
  "Pine Nut",
  "Pineapple",
  "Plantain",
  "Pomegranate",
  "Plum",
  "Pomelo",
  "Prickly Pear",
  "Prune",
  "Pistachio",
  "Quince",
  "Raisin",
  "Rambutan",
  "Raspberry",
  "Redcurrant",
  "Rose Apple",
  "Sapodilla",
  "Satsuma",
  "Soursop",
  "Star Fruit",
  "Strawberry",
  "Sugar Apple",
  "Surinam Cherry",
  "Sweet Lime",
  "Tamarillo",
  "Tamarind",
  "Tangerine",
  "Ugli Fruit",
  "Walnut",
  "Watermelon",
  "White Raisin",
  "Wood Apple",
];

const DEFAULT_VARIETIES = [
  "Local",
  "Desi",
  "Hybrid",
  "Imported",
  "Other",
];

const FRUIT_VARIETY_OPTIONS = {
  Almond: [
    "Nonpareil",
    "Carmel",
    "Monterey",
    "Sonora",
    "Butte",
    "Padre",
    "Independence",
    "California",
    "Mamra",
    "Gurbandi",
    "Kashmiri",
  ],
  Apple: [
    "Red Delicious",
    "Royal Delicious",
    "Golden Delicious",
    "Gala",
    "Fuji",
    "Granny Smith",
    "Honeycrisp",
    "Kinnaur Apple",
    "McIntosh",
    "Pink Lady",
    "Ambri",
    "Spur",
  ],
  Apricot: ["Halman", "Rakchaikarpo", "Moorpark", "Tilton", "Royal", "Blenheim"],
  Banana: ["Cavendish", "Robusta", "Grand Naine", "Dwarf Cavendish", "Nendran", "Rasthali"],
  Cashew: ["W-180", "W-210", "W-240", "W-320", "JH", "SW", "Splits", "Butts"],
  Cherry: ["Bing", "Rainier", "Lapins", "Sweetheart", "Stella", "Van"],
  Coconut: ["Tender Coconut", "Mature Coconut", "Tall", "Dwarf", "Hybrid"],
  Dates: ["Medjool", "Ajwa", "Safawi", "Mabroom", "Sukkari", "Deglet Noor", "Zahidi", "Kimia"],
  Fig: ["Brown Turkey", "Black Mission", "Kadota", "Calimyrna", "Anjeer"],
  "Dried Fig": ["Anjeer", "Iranian", "Afghan", "Turkish", "Premium Dried"],
  Grapes: ["Thompson Seedless", "Sonaka", "Sharad Seedless", "Flame Seedless", "Black Grapes", "Red Globe"],
  Guava: ["Allahabad Safeda", "Lalit", "Lucknow 49", "Thai Guava", "Pink Guava"],
  Hazelnut: ["Barcelona", "Tonda Gentile", "Ennis", "Jefferson"],
  "Kishmish": ["Golden", "Black", "Green", "Afghan", "Indian"],
  Litchi: ["Shahi", "China", "Bombai", "Early Bedana", "Late Bedana"],
  Mango: ["Alphonso", "Kesar", "Dasheri", "Langra", "Banganapalli", "Totapuri", "Chaunsa", "Himsagar"],
  Orange: ["Nagpur", "Kinnow", "Valencia", "Navel", "Blood Orange", "Mandarin"],
  Papaya: ["Red Lady", "Pusa Delicious", "Pusa Nanha", "Taiwan", "Solo"],
  Peach: ["July Elberta", "Redhaven", "Flordasun", "Shan-e-Punjab", "Prabhat"],
  Peanut: ["Bold", "Java", "TJ", "Spanish", "Runner", "Virginia"],
  Pear: ["Bartlett", "William", "Bosc", "Anjou", "Comice", "Patharnakh"],
  Pecan: ["Western Schley", "Pawnee", "Wichita", "Desirable"],
  Persimmon: ["Fuyu", "Hachiya", "Jiro", "Triumph"],
  "Pine Nut": ["Chilgoza", "Korean Pine", "Italian Stone Pine"],
  Pineapple: ["Queen", "Kew", "Mauritius", "MD2", "Jaldhup"],
  Pistachio: ["Kerman", "Ahmad Aghaei", "Akbari", "Fandoghi", "Kaleh Ghouchi"],
  Plum: ["Santa Rosa", "Black Amber", "Stanley", "Mariposa", "Kala Amritsari"],
  Pomegranate: ["Bhagwa", "Ganesh", "Arakta", "Mridula", "Ruby"],
  Prune: ["Dried Plum", "French Prune", "California Prune"],
  Quince: ["Smyrna", "Champion", "Pineapple"],
  Raisin: ["Golden", "Black", "Green", "Sultana", "Munakka"],
  "Black Raisin": ["Black", "Seedless", "Munakka", "Afghan"],
  "Golden Raisin": ["Golden", "Sultana", "Seedless", "Afghan"],
  "White Raisin": ["White", "Green", "Seedless", "Sultana"],
  Strawberry: ["Chandler", "Sweet Charlie", "Camarosa", "Festival", "Winter Dawn"],
  Walnut: ["Chandler", "Franquette", "Hartley", "Kashmiri", "Chilgoza Type", "Tulare"],
  Watermelon: ["Sugar Baby", "Kiran", "Arka Manik", "Crimson Sweet", "Charleston Gray"],
};

const DRY_FRUIT_VARIETIES = [
  "Premium",
  "Regular",
  "Whole",
  "Split",
  "Raw",
  "Roasted",
  "Salted",
  "Unsalted",
  "Seedless",
  "With Seed",
];

const DRY_FRUIT_NAMES = new Set([
  "Almond",
  "Anjeer",
  "Black Raisin",
  "Brazil Nut",
  "Cashew",
  "Chestnut",
  "Dates",
  "Dried Apricot",
  "Dried Berries",
  "Dried Fig",
  "Dried Kiwi",
  "Dried Mango",
  "Dried Papaya",
  "Dried Pineapple",
  "Dried Plum",
  "Fox Nut",
  "Golden Raisin",
  "Hazelnut",
  "Kishmish",
  "Lotus Seed",
  "Makhana",
  "Peanut",
  "Pecan",
  "Pine Nut",
  "Pistachio",
  "Prune",
  "Raisin",
  "Walnut",
  "White Raisin",
]);

const requiresQualityCertificate = (quality = "") =>
  ORGANIC_CERTIFIED_QUALITIES.has(String(quality || "").trim());

const UNGRADED_QUALITY = "Ungraded / Farm Fresh";

const getQualityPackingGroup = (quality = "") => {
  if (!quality) return "";
  return quality === UNGRADED_QUALITY ? "ungraded" : "graded";
};

const PACKING_TYPES_BY_QUALITY = {
  ungraded: [
    { label: "Crate", value: "Crate", kg: 18, unpacked: true, unit: "crates" },
    { label: "Loose Carton", value: "Loose Carton", kg: 20, unit: "cartons" },
    { label: "Loose Wooden Box", value: "Loose Wooden Box", kg: 20, unit: "boxes" },
  ],
  graded: [
    { label: "Loose Crate", value: "Loose Crate", kg: 18, unit: "crates" },
    { label: "Loose Carton", value: "Loose Carton", kg: 20, unit: "cartons" },
    { label: "Loose Wooden Box", value: "Loose Wooden Box", kg: 20, unit: "boxes" },
    { label: "Tray Packed Carton", value: "Tray Packed Carton", kg: 20, unit: "cartons" },
  ],
};

const getPackingTypesForQuality = (quality = "") =>
  PACKING_TYPES_BY_QUALITY[getQualityPackingGroup(quality)] || [];

const PACKING_MEDIA_ROWS = [
  ...SIZE_OPTIONS.map((size) => ({ label: size.label, key: size.value })),
  { label: "Other / Custom", key: OTHER_CUSTOM_SIZE_CODE },
  { label: "Ungraded", key: "UN_GRADED" },
];

const initialGradeLots = PACKING_MEDIA_ROWS.reduce((lots, row) => {
  lots[row.key] = { images: Array(5).fill(null) };
  return lots;
}, {});

let packingRowSequence = 0;
const createPackingRow = () => ({
  id: `packing-row-${++packingRowSequence}`,
  size: "",
  packageCount: "",
  piecesPerPackage: "",
  traysPerPackage: "",
  piecesPerTray: "",
  weightPerPackageKg: "",
  packageCapacityCode: "",
  packageTypeCode: "",
  packageSizeCode: "",
  trayCountCode: "",
  customPackageTypeSpecification: "",
  customPackageSizeSpecification: "",
  diameterPresetCode: "",
  diameterMinMm: "",
  diameterMaxMm: "",
  countPreset: "",
});

const EMPTY_UNGRADED_PACKING = {
  packageCount: "",
  weightPerPackageKg: "",
  packageCapacityCode: "",
  packageTypeCode: "",
  packageSizeCode: "",
  trayCountCode: "",
  customPackageTypeSpecification: "",
  customPackageSizeSpecification: "",
};

const applyPackingSpecificationChange = (current, specification, field, value) => {
  if (field === "packageCapacityCode") {
    const capacity = specification?.capacityOptions?.find((item) => item.code === value);
    return {
      ...current,
      packageCapacityCode: value,
      weightPerPackageKg:
        value === CUSTOM_OPTION_CODE ? "" : String(capacity?.valueKg ?? ""),
    };
  }
  if (field === "packageTypeCode") {
    return {
      ...current,
      packageTypeCode: value,
      customPackageTypeSpecification:
        value === CUSTOM_OPTION_CODE ? current.customPackageTypeSpecification : "",
    };
  }
  if (field === "packageSizeCode") {
    return {
      ...current,
      packageSizeCode: value,
      customPackageSizeSpecification:
        value === CUSTOM_OPTION_CODE ? current.customPackageSizeSpecification : "",
    };
  }
  if (field === "trayCountCode") {
    const trayCount = specification?.trayCountOptions?.find((item) => item.code === value);
    return {
      ...current,
      trayCountCode: value,
      traysPerPackage:
        value === CUSTOM_OPTION_CODE ? "" : String(trayCount?.valueKg ?? ""),
    };
  }
  return { ...current, [field]: value };
};

const getPackingSpecificationError = (details, specification) => {
  if (!details.packageCapacityCode || Number(details.weightPerPackageKg) <= 0) {
    return "Select a Package Capacity greater than 0.";
  }
  if (specification?.typeOptions && !details.packageTypeCode) {
    return `Select ${specification.typeLabel}.`;
  }
  if (
    details.packageTypeCode === CUSTOM_OPTION_CODE &&
    !details.customPackageTypeSpecification.trim()
  ) {
    return `Enter ${specification.customTypeLabel}.`;
  }
  if (specification?.sizeOptions && !details.packageSizeCode) {
    return `Select ${specification.sizeLabel}.`;
  }
  if (
    details.packageSizeCode === CUSTOM_OPTION_CODE &&
    !details.customPackageSizeSpecification.trim()
  ) {
    return `Enter ${specification.customSizeLabel}.`;
  }
  if (specification?.trayCountOptions && !details.trayCountCode) {
    return `Select ${specification.trayCountLabel}.`;
  }
  if (details.trayCountCode === CUSTOM_OPTION_CODE && Number(details.traysPerPackage) <= 0) {
    return `${specification.customTrayCountLabel} must be greater than 0.`;
  }
  return "";
};

const getPackageCountLabel = (packingType = "") => ({
  Crate: "Number of Crates",
  "Loose Crate": "Number of Crates",
  "Loose Carton": "Number of Cartons",
  "Loose Wooden Box": "Number of Wooden Boxes",
  "Tray Packed Carton": "Number of Cartons",
}[packingType] || "Number of Packages");

const getPackageUnitLabel = (packingType = "") => ({
  Crate: "Crates",
  "Loose Crate": "Crates",
  "Loose Carton": "Cartons",
  "Loose Wooden Box": "Wooden Boxes",
  "Tray Packed Carton": "Cartons",
}[packingType] || "Packages");

const formatCalculatedValue = (value) =>
  Number.isFinite(Number(value))
    ? Number(Number(value).toFixed(2)).toLocaleString("en-IN")
    : "0";

const SAMPLE_IMAGE_SLOTS = [0, 1, 2, 3, 4];
const SAMPLE_IMAGE_WIDTH = 720;
const SAMPLE_IMAGE_HEIGHT = 540;
const SAMPLE_IMAGE_QUALITY = 0.65;
const CAPTURE_POLL_MS = 2500;

const getCaptureTargetKey = ({ mediaType, gradeKey = "", slotIndex = "" }) =>
  mediaType === "image" ? `image-${gradeKey}-${slotIndex}` : "video-sample";

const isFileUpload = (value) => typeof File !== "undefined" && value instanceof File;

const isRemoteCaptureMedia = (value) =>
  Boolean(value?.source === "mobile-capture" && value?.captureSessionId);

const isLotMobileCaptureDevice = () => {
  if (typeof navigator === "undefined") return false;

  const userAgent = navigator.userAgent || "";
  const platform = navigator.platform || "";

  return (
    /android|iphone|ipad|ipod/i.test(userAgent) ||
    (platform === "MacIntel" && Number(navigator.maxTouchPoints || 0) > 1) ||
    (isMobileDevice() && !/windows|macintosh|cros|x11/i.test(userAgent))
  );
};

const createRemoteCaptureMedia = (payload = {}) => ({
  source: "mobile-capture",
  captureSessionId: payload.sessionId,
  mediaType: payload.mediaType,
  gradeKey: payload.gradeKey || "",
  slotIndex: payload.slotIndex,
  url: payload.media?.url || payload.media?.secure_url || "",
  publicId: payload.media?.publicId || "",
  name:
    payload.media?.originalName ||
    (payload.mediaType === "video" ? "Mobile captured video" : "Mobile captured photo"),
});

const makeFirmPrefix = (user) => {
  const source =
    user?.orchardName || user?.businessName || user?.name || "Grower Firm";
  const words = source
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, "")
    .split(/\s+/)
    .filter(Boolean);

  if (words.length > 1) {
    return words.map((word) => word[0]).join("").slice(0, 5);
  }

  return (words[0] || "LOT").slice(0, 3);
};

const getLotNoPreview = () => {
  const year = new Date().getFullYear();
  return `${makeFirmPrefix(getCurrentUser())}/${year}/001`;
};

const isLocalKycTestAccount = (user = {}) => {
  if (process.env.NODE_ENV === "production") return false;

  const email = String(user.email || "").trim().toLowerCase();
  const phone = String(user.phone || user.contact || "").trim();

  return (
    ["testbuyer@efruitmandi.live", "testgrower@efruitmandi.live", "testdriver@efruitmandi.live"].includes(email) ||
    ["1234567890", "1234567891", "1234567892"].includes(phone)
  );
};

const getVarietiesForFruit = (fruitName) => {
  const mappedOptions = FRUIT_VARIETY_OPTIONS[fruitName] || [];
  const fallbackOptions = DRY_FRUIT_NAMES.has(fruitName)
    ? DRY_FRUIT_VARIETIES
    : DEFAULT_VARIETIES;

  return Array.from(new Set([...mappedOptions, ...fallbackOptions]));
};

const cropImageToPlatformFrame = async (file) => {
  if (!file || !file.type?.startsWith("image/")) {
    return file;
  }

  const preparedFile = await prepareUploadFile(file, {
    forceResize: true,
    maxDimension: SAMPLE_IMAGE_WIDTH,
    quality: SAMPLE_IMAGE_QUALITY,
    maxBytes: 650_000,
  });

  return preparedFile;
};

export default function ListNewLot() {
  const navigate = useNavigate();
  const currentUser = useMemo(() => getCurrentUser(), []);
  const isAdminAccount = ["admin", "super_admin"].includes(
    String(currentUser.role || "").trim().toLowerCase()
  );
  const isGrowerKycExempt =
    isAdminAccount || Boolean(currentUser.growerVerified) || isLocalKycTestAccount(currentUser);
  const requiresGrowerKycCheck = hasGrowerProfile(currentUser) && !isGrowerKycExempt;
  const hasStoredGrowerKyc = hasCompletedKycForRole(currentUser, "grower");
  const [kycAccessResolved, setKycAccessResolved] = useState(
    !requiresGrowerKycCheck || hasStoredGrowerKyc
  );
  const [fruits, setFruits] = useState(DEFAULT_FRUITS);
  const [varieties, setVarieties] = useState(DEFAULT_VARIETIES);
  const [customPanel, setCustomPanel] = useState(null);
  const [customValue, setCustomValue] = useState("");
  const [form, setForm] = useState({
    fruitName: "",
    variety: "",
    quality: "",
    organicCertificationNo: "",
    description: "",
    basePrice: "",
    location: "",
    packingType: "",
  });
  const [gradeLots, setGradeLots] = useState(initialGradeLots);
  const [packingRows, setPackingRows] = useState([]);
  const [ungradedPacking, setUngradedPacking] = useState(EMPTY_UNGRADED_PACKING);
  const [sampleVideo, setSampleVideo] = useState(null);
  const [organicCertificate, setOrganicCertificate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [recognizing, setRecognizing] = useState(false);
  const [uploadingImageSlot, setUploadingImageSlot] = useState(null);
  const [isMobileLotDevice, setIsMobileLotDevice] = useState(() => isLotMobileCaptureDevice());
  const [captureModal, setCaptureModal] = useState(null);
  const [captureStartingKey, setCaptureStartingKey] = useState(null);
  const [message, setMessage] = useState("");
  const localLotNoPreview = useMemo(() => getLotNoPreview(), []);
  const [lotNoPreview, setLotNoPreview] = useState(localLotNoPreview);

  const availablePackingTypes = useMemo(
    () => getPackingTypesForQuality(form.quality),
    [form.quality]
  );
  const selectedPacking =
    availablePackingTypes.find((packing) => packing.value === form.packingType) || null;
  const selectedPackingSpecification = getPackingSpecification(form.packingType);
  const packingGroup = getQualityPackingGroup(form.quality);
  const isAppleFruit = isAppleFruitValue(form.fruitName);
  const availableSizeOptions = isAppleFruit
    ? APPLE_SIZE_GRADING.map((preset) => ({ label: preset.label, value: preset.code }))
    : SIZE_OPTIONS;
  const currentPackingBreakdown = useMemo(
    () => packingGroup === "graded"
      ? packingRows.map((row) => ({
          size: row.size,
          packageCount: Number(row.packageCount),
          piecesPerPackage: Number(row.piecesPerPackage),
          traysPerPackage: form.packingType === "Tray Packed Carton"
            ? Number(row.traysPerPackage)
            : undefined,
          piecesPerTray: form.packingType === "Tray Packed Carton"
            ? Number(row.piecesPerTray)
            : undefined,
          weightPerPackageKg: Number(row.weightPerPackageKg),
          packageCapacityCode: row.packageCapacityCode,
          packageTypeCode: row.packageTypeCode || undefined,
          packageSizeCode: row.packageSizeCode || undefined,
          customPackageTypeSpecification:
            row.customPackageTypeSpecification.trim() || undefined,
          customPackageSizeSpecification:
            row.customPackageSizeSpecification.trim() || undefined,
          diameterPresetCode: isAppleFruit ? row.diameterPresetCode || undefined : undefined,
          diameterMinMm: isAppleFruit && row.diameterMinMm !== ""
            ? Number(row.diameterMinMm)
            : undefined,
          diameterMaxMm: isAppleFruit && row.diameterMaxMm !== ""
            ? Number(row.diameterMaxMm)
            : undefined,
          countPreset: isAppleFruit ? row.countPreset || undefined : undefined,
        }))
      : selectedPacking
        ? [{
            packageCount: Number(ungradedPacking.packageCount),
            weightPerPackageKg: Number(ungradedPacking.weightPerPackageKg),
            packageCapacityCode: ungradedPacking.packageCapacityCode,
            packageTypeCode: ungradedPacking.packageTypeCode || undefined,
            packageSizeCode: ungradedPacking.packageSizeCode || undefined,
            customPackageTypeSpecification:
              ungradedPacking.customPackageTypeSpecification.trim() || undefined,
            customPackageSizeSpecification:
              ungradedPacking.customPackageSizeSpecification.trim() || undefined,
          }]
        : [],
    [form.packingType, isAppleFruit, packingGroup, packingRows, selectedPacking, ungradedPacking]
  );
  const isApplePackingFlow =
    isAppleFruit && selectedPacking && currentPackingBreakdown.length > 0;
  const packingTotals = useMemo(
    () => calculatePackingTotals(currentPackingBreakdown, form.packingType),
    [currentPackingBreakdown, form.packingType]
  );
  const calculations = useMemo(() => {
    const rows = packingGroup === "graded"
      ? packingRows
      : selectedPacking
        ? [{ ...ungradedPacking, size: "", piecesPerPackage: "" }]
        : [];

    return {
      totalBoxes: rows.reduce((total, row) => total + Number(row.packageCount || 0), 0),
      totalWeightKg: rows.reduce(
        (total, row) =>
          total + Number(row.packageCount || 0) * Number(row.weightPerPackageKg || 0),
        0
      ),
    };
  }, [packingGroup, packingRows, selectedPacking, ungradedPacking]);
  const activeMediaRows = packingGroup === "graded"
    ? packingRows
        .filter((row) => row.size && Number(row.packageCount) > 0)
        .map((row) => ({
          key: row.size,
          label: getSizeLabel(row.size) || row.size,
          packageCount: Number(row.packageCount),
        }))
    : selectedPacking && Number(ungradedPacking.packageCount) > 0
      ? [{ key: "UN_GRADED", label: "Ungraded", packageCount: Number(ungradedPacking.packageCount) }]
      : [];
  const needsOrganicCertificate = requiresQualityCertificate(form.quality);
  const isDesktopLotDevice = !isMobileLotDevice;

  useEffect(() => {
    setIsMobileLotDevice(isLotMobileCaptureDevice());
  }, []);

  useEffect(() => {
    if (!requiresGrowerKycCheck || hasStoredGrowerKyc) return;

    let active = true;
    const kycMessage =
      "Complete your Grower KYC before listing a Live Fruit Lot and receiving offers from fruit buyers.";

    API.get("/kyc/me", { params: { roleType: "grower" } })
      .then((res) => {
        if (!active) return;
        const user = res.data?.user || {};
        const status = String(res.data?.kyc?.status || "").trim().toUpperCase();
        if (Boolean(user.growerVerified) || status === "APPROVED") {
          setKycAccessResolved(true);
          return;
        }
        navigate("/kyc", {
          replace: true,
          state: { from: "/list-new-lot", roleType: "grower", message: kycMessage },
        });
      })
      .catch(() => {
        if (!active) return;
        navigate("/kyc", {
          replace: true,
          state: { from: "/list-new-lot", roleType: "grower", message: kycMessage },
        });
      });

    return () => {
      active = false;
    };
  }, [hasStoredGrowerKyc, navigate, requiresGrowerKycCheck]);

  useEffect(() => {
    if (!kycAccessResolved) return undefined;

    let active = true;

    API.get("/products/next-lot-no")
      .then((res) => {
        if (active && res.data?.lotNo) {
          setLotNoPreview(res.data.lotNo);
        }
      })
      .catch(() => {
        if (active) setLotNoPreview(localLotNoPreview);
      });

    return () => {
      active = false;
    };
  }, [kycAccessResolved, localLotNoPreview]);

  useEffect(() => {
    if (!captureModal?.sessionId) return undefined;

    let active = true;

    const pollCaptureMedia = async () => {
      try {
        const res = await API.get(`/capture-sessions/${captureModal.sessionId}/media`);
        if (!active || !res.data?.media) return;

        const capturedMedia = createRemoteCaptureMedia(res.data);

        if (res.data.mediaType === "image") {
          setGradeLots((current) => {
            const gradeKey = res.data.gradeKey;
            const images = [...(current[gradeKey]?.images || Array(5).fill(null))];
            while (images.length < 5) images.push(null);
            images[Number(res.data.slotIndex)] = capturedMedia;

            return {
              ...current,
              [gradeKey]: {
                ...current[gradeKey],
                images,
              },
            };
          });
        }

        if (res.data.mediaType === "video") {
          setSampleVideo(capturedMedia);
        }

        setMessage("");
        setCaptureModal(null);
      } catch (error) {
        if (!active) return;
        if (error.response?.status === 410) {
          setMessage("Mobile camera link expired. Create a new link and try again.");
          setCaptureModal(null);
        }
      }
    };

    pollCaptureMedia();
    const intervalId = window.setInterval(pollCaptureMedia, CAPTURE_POLL_MS);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [captureModal?.sessionId]);

  const resetPackingDetails = (quality, packingType) => {
    const group = getQualityPackingGroup(quality);
    setGradeLots(initialGradeLots);
    setUngradedPacking(EMPTY_UNGRADED_PACKING);
    setPackingRows(group === "graded" && packingType ? [createPackingRow()] : []);
  };

  const updateForm = (field, value) => {
    if (field === "quality") {
      const nextPackingTypes = getPackingTypesForQuality(value);
      const keepPackingType = nextPackingTypes.some(
        (packing) => packing.value === form.packingType
      );
      const nextPackingType = keepPackingType ? form.packingType : "";
      const packingGroupChanged =
        getQualityPackingGroup(form.quality) !== getQualityPackingGroup(value);

      if (!keepPackingType || packingGroupChanged) {
        resetPackingDetails(value, nextPackingType);
      }
      if (!requiresQualityCertificate(value)) {
        setOrganicCertificate(null);
      }

      setForm((current) => ({
        ...current,
        quality: value,
        packingType: nextPackingType,
        organicCertificationNo: requiresQualityCertificate(value)
          ? current.organicCertificationNo
          : "",
      }));
      return;
    }

    if (field === "packingType") {
      resetPackingDetails(form.quality, value);
    }

    setForm((current) => {
      return { ...current, [field]: value };
    });
  };

  const updateFruit = (value) => {
    setVarieties(getVarietiesForFruit(value));
    const nextIsApple = isAppleFruitValue(value);
    if (nextIsApple !== isAppleFruit) {
      setPackingRows((current) =>
        current.map((row) => {
          if (!nextIsApple) {
            return {
              ...row,
              size: row.size === OTHER_CUSTOM_SIZE_CODE ? "" : row.size,
              diameterPresetCode: "",
              diameterMinMm: "",
              diameterMaxMm: "",
              countPreset: "",
            };
          }
          const preset = getAppleSizePreset(row.size);
          const countValue = form.packingType === "Tray Packed Carton"
            ? Number(row.piecesPerTray)
            : Number(row.piecesPerPackage);
          const countOptions = form.packingType === "Tray Packed Carton"
            ? APPLE_TRAY_PIECE_COUNT_OPTIONS
            : APPLE_LOOSE_PACKAGE_COUNT_OPTIONS;
          return {
            ...row,
            diameterPresetCode: preset?.code || "",
            diameterMinMm: preset?.diameterMinMm ?? "",
            diameterMaxMm: preset?.diameterMaxMm ?? "",
            countPreset: countValue > 0
              ? countOptions.includes(countValue)
                ? String(countValue)
                : CUSTOM_OPTION_CODE
              : "",
          };
        })
      );
    }
    setForm((current) => ({
      ...current,
      fruitName: value,
      variety: "",
    }));
  };

  const updatePackingRow = (rowId, field, value) => {
    const currentRow = packingRows.find((row) => row.id === rowId);
    if (field === "size" && currentRow?.size !== value) {
      setGradeLots((lots) => ({
        ...lots,
        ...(currentRow?.size ? { [currentRow.size]: { images: Array(5).fill(null) } } : {}),
        ...(value ? { [value]: { images: Array(5).fill(null) } } : {}),
      }));
    }
    setPackingRows((current) =>
      current.map((row) =>
        row.id === rowId
          ? (() => {
              const nextRow = applyPackingSpecificationChange(
                row,
                selectedPackingSpecification,
                field,
                value
              );
              if (field !== "size" || !isAppleFruit) return nextRow;
              const preset = getAppleSizePreset(value);
              return {
                ...nextRow,
                diameterPresetCode: preset?.code || "",
                diameterMinMm: preset?.code === OTHER_CUSTOM_SIZE_CODE
                  ? ""
                  : preset?.diameterMinMm ?? "",
                diameterMaxMm: preset?.code === OTHER_CUSTOM_SIZE_CODE
                  ? ""
                  : preset?.diameterMaxMm ?? "",
              };
            })()
          : row
      )
    );
  };

  const updateAppleCountPreset = (rowId, countPreset, field) => {
    setPackingRows((current) =>
      current.map((row) =>
        row.id === rowId
          ? {
              ...row,
              countPreset,
              [field]: countPreset === CUSTOM_OPTION_CODE ? "" : countPreset,
            }
          : row
      )
    );
  };

  const updateUngradedPacking = (field, value) => {
    setUngradedPacking((current) =>
      applyPackingSpecificationChange(
        current,
        selectedPackingSpecification,
        field,
        value
      )
    );
  };

  const addPackingRow = () => {
    setPackingRows((current) =>
      current.length < availableSizeOptions.length ? [...current, createPackingRow()] : current
    );
  };

  const removePackingRow = (rowId) => {
    if (packingRows.length <= 1) return;
    const removed = packingRows.find((row) => row.id === rowId);
    if (removed?.size) {
      setGradeLots((lots) => ({
        ...lots,
        [removed.size]: { images: Array(5).fill(null) },
      }));
    }
    setPackingRows((current) => current.filter((row) => row.id !== rowId));
  };

  const openMobileCaptureSession = async ({ mediaType, gradeKey = "", slotIndex = null }) => {
    const targetKey = getCaptureTargetKey({ mediaType, gradeKey, slotIndex });

    try {
      setMessage("");
      setCaptureStartingKey(targetKey);

      const res = await API.post("/capture-sessions", {
        mediaType,
        gradeKey,
        slotIndex,
      });
      const captureUrl = `${window.location.origin}/mobile-capture/${res.data.sessionId}`;
      const qrDataUrl = await QRCode.toDataURL(captureUrl, {
        width: 220,
        margin: 1,
      });

      setCaptureModal({
        ...res.data,
        captureUrl,
        qrDataUrl,
      });
    } catch (error) {
      setMessage(
        getApiErrorMessage(
          error,
          "Mobile camera connection is not active yet. Please use mobile device to list lot media."
        )
      );
    } finally {
      setCaptureStartingKey(null);
    }
  };

  const updateGradeImage = async (gradeKey, index, file) => {
    if (!file) return;

    if (isDesktopLotDevice) {
      setMessage("Lot photos and video must be captured live from a mobile camera.");
      return;
    }

    const slotKey = `${gradeKey}-${index}`;
    setMessage("");
    setUploadingImageSlot(slotKey);
    setRecognizing(true);

    try {
      const permissionResult = await requestMediaPermission({ kind: "camera" });
      if (!permissionResult.granted && permissionResult.reason === "denied") {
        setMessage(permissionResult.message);
        return;
      }

      let recognition;

      try {
        recognition = await withTimeout(
          loadFruitRecognition().then(({ recognizeFruitImage }) =>
            recognizeFruitImage(file)
          ),
          15000
        );
      } catch (error) {
        setMessage(
          isLowMemoryRecognitionError(error)
            ? "Low phone memory. Clean up some space and try again."
            : "Image not recognized. Take image again."
        );
        return;
      }

      if (!recognition?.accepted) {
        setMessage("Image not recognized. Take image again.");
        return;
      }

      const platformFile = await cropImageToPlatformFrame(file);

      setGradeLots((current) => {
        const images = [...(current[gradeKey]?.images || Array(5).fill(null))];
        while (images.length < 5) images.push(null);
        images[index] = platformFile || file;

        return {
          ...current,
          [gradeKey]: {
            ...current[gradeKey],
            images,
          },
        };
      });
      setMessage("");
    } finally {
      setRecognizing(false);
      setUploadingImageSlot(null);
    }
  };

  const updateSampleVideo = async (file) => {
    if (!file) {
      setSampleVideo(null);
      return;
    }

    if (isDesktopLotDevice) {
      setMessage("Lot photos and video must be captured live from a mobile camera.");
      return;
    }

    setMessage("");
    setRecognizing(true);
    const permissionResult = await requestMediaPermission({ kind: "video", audio: true });
    if (!permissionResult.granted && permissionResult.reason === "denied") {
      setRecognizing(false);
      setMessage(permissionResult.message);
      return;
    }

    const { recognizeFruitVideo } = await loadFruitRecognition();
    const recognition = await recognizeFruitVideo(file).catch(() => ({
      accepted: false,
      label: "unrecognized video",
    }));
    setRecognizing(false);

    if (!recognition.accepted) {
      setSampleVideo(null);
      setMessage(
        `Video rejected. Fruit was not recognized in the sample. Detected: ${recognition.label}.`
      );
      return;
    }

    setSampleVideo(file);
  };

  const openCustomPanel = (type) => {
    setCustomPanel(type);
    setCustomValue("");
  };

  const saveCustomValue = () => {
    const value = customValue.trim();
    if (!value) return;

    if (customPanel === "fruit") {
      setFruits((current) => Array.from(new Set([...current, value])).sort());
      setVarieties(getVarietiesForFruit(value));
      setForm((current) => ({
        ...current,
        fruitName: value,
        variety: "",
      }));
    }

    if (customPanel === "variety") {
      setVarieties((current) => Array.from(new Set([...current, value])).sort());
      updateForm("variety", value);
    }

    setCustomPanel(null);
    setCustomValue("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage("");

    const captureMediaRefs = [];

    if (!form.fruitName || !form.variety || !form.quality || !form.basePrice) {
      setMessage("Fruit, variety, quality, and base price are required.");
      return;
    }

    if (!selectedPacking) {
      setMessage("Select a Packing Type.");
      return;
    }

    if (packingGroup === "graded") {
      const specificationError = packingRows
        .map((row) => getPackingSpecificationError(row, selectedPackingSpecification))
        .find(Boolean);
      if (specificationError) {
        setMessage(specificationError);
        return;
      }
      const selectedSizes = packingRows.map((row) => row.size).filter(Boolean);
      if (packingRows.some((row) => !row.size) || new Set(selectedSizes).size !== packingRows.length) {
        setMessage("Select a unique Size for every packing row.");
        return;
      }
      if (isAppleFruit) {
        const invalidDiameterRow = packingRows.find((row) => {
          const minimum = Number(row.diameterMinMm);
          const hasMaximum = row.diameterMaxMm !== "" && row.diameterMaxMm !== null;
          const maximum = hasMaximum ? Number(row.diameterMaxMm) : null;
          return (
            !row.diameterPresetCode ||
            !Number.isFinite(minimum) ||
            minimum <= 0 ||
            (hasMaximum && (!Number.isFinite(maximum) || maximum <= minimum))
          );
        });
        if (invalidDiameterRow) {
          setMessage("Enter a valid Apple diameter range for every Size.");
          return;
        }
        const countField = form.packingType === "Tray Packed Carton"
          ? "piecesPerTray"
          : "piecesPerPackage";
        if (
          packingRows.some(
            (row) =>
              !row.countPreset ||
              !Number.isInteger(Number(row[countField])) ||
              Number(row[countField]) <= 0
          )
        ) {
          setMessage(
            form.packingType === "Tray Packed Carton"
              ? "Select a valid whole-number Pieces per Tray option for every Size."
              : "Select a valid whole-number Pieces per Package option for every Size."
          );
          return;
        }
      }
      if (packingRows.some((row) => Number(row.packageCount) <= 0)) {
        setMessage("Number of Packages must be greater than 0 for every Size.");
        return;
      }
      if (packingRows.some((row) => Number(row.weightPerPackageKg) <= 0)) {
        setMessage("Weight per Package must be greater than 0 for every Size.");
        return;
      }
      if (form.packingType === "Tray Packed Carton") {
        if (packingRows.some((row) => Number(row.traysPerPackage) <= 0)) {
          setMessage("Number of Trays per Carton must be greater than 0 for every Size.");
          return;
        }
        if (packingRows.some((row) => Number(row.piecesPerTray) <= 0)) {
          setMessage("Pieces per Tray must be greater than 0 for every Size.");
          return;
        }
      } else if (packingRows.some((row) => Number(row.piecesPerPackage) <= 0)) {
        setMessage("Pieces per Package must be greater than 0 for every Size.");
        return;
      }
    } else {
      const specificationError = getPackingSpecificationError(
        ungradedPacking,
        selectedPackingSpecification
      );
      if (specificationError) {
        setMessage(specificationError);
        return;
      }
      if (Number(ungradedPacking.packageCount) <= 0) {
        setMessage(`${getPackageCountLabel(form.packingType)} must be greater than 0.`);
        return;
      }
      if (Number(ungradedPacking.weightPerPackageKg) <= 0) {
        setMessage("Capacity / Weight per Package must be greater than 0.");
        return;
      }
    }

    if (needsOrganicCertificate && !organicCertificate) {
      setMessage("Upload a valid certificate before listing this certified-quality Fruit Lot.");
      return;
    }

    const latestPackingTotals = calculatePackingTotals(
      currentPackingBreakdown,
      form.packingType
    );
    const packingBreakdown = currentPackingBreakdown.map((row, index) => ({
      ...row,
      piecesPerPackage: latestPackingTotals.rows[index]?.piecesPerPackage ?? undefined,
    }));
    const submittedTotals = isApplePackingFlow ? latestPackingTotals : calculations;
    const preparedGradeLots = packingBreakdown.map((row, rowIndex) => {
      const gradeKey = row.size || "UN_GRADED";
      const gradeLabel = getSizeLabel(row.size) || "Ungraded";
      return {
        grade: gradeLabel,
        gradeKey,
        fieldName: `gradeImages_${gradeKey}`,
        boxes: row.packageCount,
        weightKg: isApplePackingFlow
          ? latestPackingTotals.rows[rowIndex]?.totalWeightKg || 0
          : row.packageCount * row.weightPerPackageKg,
      };
    });

    if (needsOrganicCertificate && !form.organicCertificationNo.trim()) {
      setMessage("Certificate number is required for this quality.");
      return;
    }

    try {
      setLoading(true);
      setUploadProgress(0);

      const title = `${form.fruitName} ${form.variety}`.trim();
      const data = new FormData();
      data.append("title", title);
      data.append("fruitName", form.fruitName);
      data.append("variety", form.variety);
      data.append("quality", form.quality);
      data.append("organicCertificationNo", form.organicCertificationNo);
      data.append("description", form.description);
      data.append("basePrice", form.basePrice);
      data.append("location", form.location);
      data.append("packingType", selectedPacking.value);
      data.append("packingWeightKg", packingBreakdown[0].weightPerPackageKg);
      data.append("totalWeightKg", submittedTotals.totalWeightKg);
      data.append("quantity", submittedTotals.totalPackages ?? submittedTotals.totalBoxes);
      data.append("gradeLots", JSON.stringify(preparedGradeLots));
      data.append("packingBreakdown", JSON.stringify(packingBreakdown));
      if (isApplePackingFlow) {
        data.append("packingSummary", JSON.stringify({
          totalPackages: latestPackingTotals.totalPackages,
          totalPieces: latestPackingTotals.totalPieces ?? undefined,
          totalWeightKg: latestPackingTotals.totalWeightKg,
          averageFruitWeightGrams:
            latestPackingTotals.averageFruitWeightGrams ?? undefined,
        }));
      }

      preparedGradeLots.forEach((grade) => {
        gradeLots[grade.gradeKey].images.forEach((image, slotIndex) => {
          if (isFileUpload(image)) {
            data.append(`gradeImages_${grade.gradeKey}`, image);
          }

          if (isRemoteCaptureMedia(image)) {
            captureMediaRefs.push({
              sessionId: image.captureSessionId,
              mediaType: "image",
              gradeKey: grade.gradeKey,
              slotIndex,
            });
          }
        });
      });

      if (isFileUpload(sampleVideo)) {
        data.append("sampleVideo", sampleVideo);
      }
      if (isRemoteCaptureMedia(sampleVideo)) {
        captureMediaRefs.push({
          sessionId: sampleVideo.captureSessionId,
          mediaType: "video",
        });
      }
      data.append("captureMediaRefs", JSON.stringify(captureMediaRefs));
      if (organicCertificate) data.append("organicCertificate", organicCertificate);

      const res = await API.post("/products", data, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (event) => {
          if (!event.total) return;
          setUploadProgress(Math.min(99, Math.round((event.loaded * 100) / event.total)));
        },
      });

      trackLotCreated(res?.data?.product || {
        _id: res?.data?._id || res?.data?.id || "",
        fruitName: form.fruitName,
        category: form.fruitName,
      });
      setUploadProgress(100);
      navigate("/profile-dashboard");
    } catch (err) {
      setMessage(
        err.response?.data?.msg ||
          err.response?.data?.message ||
          err.message ||
          "Unable to list this lot. Login as a grower and try again."
      );
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  if (!kycAccessResolved) {
    return (
      <div className="mx-auto min-h-[calc(100vh-132px)] w-full max-w-4xl bg-white px-4 py-8 text-center text-sm font-bold text-green-800 md:min-h-[calc(100vh-94px)]">
        Checking Grower KYC...
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl border-t-4 border-green-600 bg-white pb-20 md:my-6 md:rounded-xl md:border md:border-gray-200 md:border-t-4 md:shadow-sm">
      <form onSubmit={handleSubmit} className="px-4 py-5 sm:px-6 md:px-10 md:py-8">
        <div className="mb-5 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border-2 border-black text-2xl font-bold">
            <FaPlus />
          </div>
          <h1 className="mt-2 text-lg font-extrabold text-black">
            List Your Product
          </h1>
          <p className="mt-1 text-xs font-semibold text-gray-500">
            Select fruit, packing, grade quantity, and calculate lot weight.
          </p>
        </div>

        {message && (
          <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
            {message}
          </div>
        )}
        {recognizing && (
          <div className="mb-4 rounded-md bg-green-50 px-3 py-2 text-xs font-semibold text-green-800">
            {uploadingImageSlot ? "Processing image..." : "Checking media for fruit recognition..."}
          </div>
        )}
        {loading && (
          <div className="mb-4 rounded-md bg-green-50 px-3 py-2 text-xs font-semibold text-green-800">
            <div className="flex items-center justify-between gap-3">
              <span>Uploading lot...</span>
              <span>{uploadProgress || 1}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-green-100">
              <div
                className="h-full rounded-full bg-green-700 transition-all"
                style={{ width: `${Math.max(uploadProgress, 5)}%` }}
              />
            </div>
          </div>
        )}

        <div className="space-y-4 md:space-y-5">
          <SelectorWithAdd
            label="Select Fruit"
            value={form.fruitName}
            placeholder="Select fruit to sell"
            options={fruits}
            onChange={updateFruit}
            onAdd={() => openCustomPanel("fruit")}
          />

          {customPanel === "fruit" && (
            <CustomEntryPanel
              title="Name of fruit"
              value={customValue}
              placeholder="Kafal"
              onChange={setCustomValue}
              onSave={saveCustomValue}
              onCancel={() => setCustomPanel(null)}
            />
          )}

          <SelectorWithAdd
            label="Variety"
            value={form.variety}
            placeholder="Enter Variety Name"
            options={varieties}
            onChange={(value) => updateForm("variety", value)}
            onAdd={() => openCustomPanel("variety")}
          />

          {customPanel === "variety" && (
            <CustomEntryPanel
              title="Variety of fruit"
              value={customValue}
              placeholder="Local"
              onChange={setCustomValue}
              onSave={saveCustomValue}
              onCancel={() => setCustomPanel(null)}
            />
          )}

          <SimpleSelect
            label="Quality"
            value={form.quality}
            placeholder="Select quality"
            options={QUALITY_OPTIONS}
            onChange={(value) => updateForm("quality", value)}
          />

          {needsOrganicCertificate && (
            <div className="rounded-md border border-green-200 bg-green-50 p-3">
              <p className="text-sm font-extrabold text-green-900">
                Organic / Natural Quality Certificate
              </p>
              <p className="mt-1 text-xs font-semibold text-gray-600">
                Upload a valid certificate for the selected certified quality.
              </p>
              <div className="mt-3">
                <Field
                  icon={<FaCertificate />}
                  label="Certificate No."
                  value={form.organicCertificationNo}
                  placeholder="Enter certificate number"
                  onChange={(value) => updateForm("organicCertificationNo", value)}
                />
              </div>
              <label className="mt-3 flex cursor-pointer flex-col gap-1 rounded-md border border-dashed border-green-400 bg-white px-3 py-3 text-xs font-bold text-green-800">
                <span>
                  {organicCertificate
                    ? organicCertificate.name
                    : "Upload Certificate"}
                </span>
                <span className="text-[10px] font-semibold text-gray-500">
                  PDF, JPG/JPEG, or PNG accepted
                </span>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                  className="hidden"
                  onChange={(event) =>
                    setOrganicCertificate(event.target.files?.[0] || null)
                  }
                />
              </label>
            </div>
          )}

          <ReadOnlyInfo
            icon={<FaWarehouse />}
            label="Lot No."
            value={lotNoPreview}
            note="Final sequence is confirmed when the lot is saved."
          />

          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-gray-700">
              <FaWeightHanging className="text-gray-400" />
              Packing Type
            </div>
            <div className="rounded-md border border-gray-200 bg-white p-3">
              {!form.quality ? (
                <p className="text-xs font-semibold text-gray-500">
                  Select Quality first to view available Packing Types.
                </p>
              ) : (
                <div className="grid max-h-56 grid-cols-1 gap-2 overflow-y-auto pr-1">
                {availablePackingTypes.map((packing) => (
                  <label
                    key={packing.value}
                    className="flex items-center gap-2 text-xs font-semibold text-gray-700"
                  >
                    <input
                      type="radio"
                      name="packingType"
                      checked={form.packingType === packing.value}
                      onChange={() => updateForm("packingType", packing.value)}
                    />
                    <span>{packing.label}</span>
                  </label>
                ))}
                </div>
              )}
            </div>
          </div>

          {selectedPacking && packingGroup === "ungraded" && (
            <div className="rounded-md border border-green-100 bg-green-50 p-3">
              <h2 className="text-sm font-extrabold text-black">Packing Details</h2>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <NumericPackingField
                  label={getPackageCountLabel(form.packingType)}
                  value={ungradedPacking.packageCount}
                  onChange={(value) => updateUngradedPacking("packageCount", value)}
                />
                <PackingSpecificationFields
                  specification={selectedPackingSpecification}
                  details={ungradedPacking}
                  onChange={updateUngradedPacking}
                />
              </div>
            </div>
          )}

          {selectedPacking && packingGroup === "graded" && (
            <div className="rounded-md border border-green-100 bg-green-50 p-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-extrabold text-black">Size-wise Packing Details</h2>
                {packingRows.length < availableSizeOptions.length && (
                  <button
                    type="button"
                    onClick={addPackingRow}
                    className="text-xs font-extrabold text-green-800"
                  >
                    + Add Another Size
                  </button>
                )}
              </div>
              <div className="mt-3 space-y-3">
                {packingRows.map((row, rowIndex) => {
                  const usedSizes = new Set(
                    packingRows.filter((item) => item.id !== row.id).map((item) => item.size)
                  );
                  const trayPacked = form.packingType === "Tray Packed Carton";
                  const piecesPerCarton =
                    Number(row.traysPerPackage || 0) * Number(row.piecesPerTray || 0);
                  const rowTotals = packingTotals.rows[rowIndex];
                  const suggestedSize = isAppleFruit
                    ? getAppleSizeFromDiameter(row.diameterMinMm)
                    : null;
                  const diameterMismatch =
                    suggestedSize &&
                    suggestedSize !== OTHER_CUSTOM_SIZE_CODE &&
                    row.size &&
                    suggestedSize !== row.size;
                  const trayPieceMismatch =
                    trayPacked &&
                    Number(row.piecesPerPackage) > 0 &&
                    Number(row.piecesPerPackage) !== piecesPerCarton;

                  return (
                    <div key={row.id} className="rounded-md border border-green-200 bg-white p-3">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <label className="block text-xs font-bold text-gray-700">
                          Size
                          <select
                            value={row.size}
                            onChange={(event) => updatePackingRow(row.id, "size", event.target.value)}
                            className="mt-1 w-full rounded-md bg-gray-100 px-3 py-2 text-sm font-semibold outline-none"
                          >
                            <option value="">Select Size</option>
                            {availableSizeOptions.map((size) => (
                              <option
                                key={size.value}
                                value={size.value}
                                disabled={usedSizes.has(size.value)}
                              >
                                {size.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        {isAppleFruit && row.size !== OTHER_CUSTOM_SIZE_CODE && (
                          <div className="rounded-md bg-gray-50 px-3 py-2 text-xs font-bold text-gray-700">
                            <span className="block text-[10px] text-gray-500">Diameter Range</span>
                            {formatAppleDiameterRange(row) || "Select Size"}
                          </div>
                        )}
                        {isAppleFruit && row.size === OTHER_CUSTOM_SIZE_CODE && (
                          <>
                            <NumericPackingField
                              label="Minimum Diameter (mm)"
                              value={row.diameterMinMm}
                              step="0.01"
                              onChange={(value) => updatePackingRow(row.id, "diameterMinMm", value)}
                            />
                            <div>
                              <NumericPackingField
                                label="Maximum Diameter (mm)"
                                value={row.diameterMaxMm}
                                step="0.01"
                                onChange={(value) => updatePackingRow(row.id, "diameterMaxMm", value)}
                              />
                              <p className="mt-1 text-[9px] font-semibold text-gray-500">
                                Leave maximum blank to represent “and above”.
                              </p>
                            </div>
                          </>
                        )}
                        <NumericPackingField
                          label={getPackageCountLabel(form.packingType)}
                          value={row.packageCount}
                          onChange={(value) => updatePackingRow(row.id, "packageCount", value)}
                        />
                        <PackingSpecificationFields
                          specification={selectedPackingSpecification}
                          details={row}
                          onChange={(field, value) => updatePackingRow(row.id, field, value)}
                        />
                        {trayPacked ? (
                          <>
                            {isAppleFruit ? (
                              <AppleCountPresetField
                                label="Pieces per Tray"
                                options={APPLE_TRAY_PIECE_COUNT_OPTIONS}
                                value={row.countPreset}
                                customValue={row.piecesPerTray}
                                customLabel="Custom Pieces per Tray"
                                onPresetChange={(value) =>
                                  updateAppleCountPreset(row.id, value, "piecesPerTray")
                                }
                                onCustomChange={(value) =>
                                  updatePackingRow(row.id, "piecesPerTray", value)
                                }
                              />
                            ) : (
                              <NumericPackingField
                                label="Pieces per Tray"
                                value={row.piecesPerTray}
                                onChange={(value) => updatePackingRow(row.id, "piecesPerTray", value)}
                              />
                            )}
                            <div className="rounded-md bg-gray-50 px-3 py-2 text-xs font-bold text-gray-600">
                              Pieces per Carton: {piecesPerCarton || 0}
                            </div>
                          </>
                        ) : (
                          isAppleFruit ? (
                            <AppleCountPresetField
                              label="Pieces per Package"
                              options={APPLE_LOOSE_PACKAGE_COUNT_OPTIONS}
                              value={row.countPreset}
                              customValue={row.piecesPerPackage}
                              customLabel="Custom Pieces per Package"
                              onPresetChange={(value) =>
                                updateAppleCountPreset(row.id, value, "piecesPerPackage")
                              }
                              onCustomChange={(value) =>
                                updatePackingRow(row.id, "piecesPerPackage", value)
                              }
                            />
                          ) : (
                            <NumericPackingField
                              label="Pieces per Package"
                              value={row.piecesPerPackage}
                              onChange={(value) => updatePackingRow(row.id, "piecesPerPackage", value)}
                            />
                          )
                        )}
                      </div>
                      {diameterMismatch && (
                        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-[10px] font-bold text-amber-800">
                          The entered diameter range normally matches “{getSizeLabel(suggestedSize)}”, while this row is marked “{getSizeLabel(row.size)}”.
                        </p>
                      )}
                      {trayPieceMismatch && (
                        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-[10px] font-bold text-amber-800">
                          The saved pieces-per-carton value differs from trays per carton × pieces per tray; the calculated value will be used.
                        </p>
                      )}
                      {isApplePackingFlow && rowTotals && (
                        <div className="mt-3 rounded-md bg-green-50 px-3 py-2 text-xs font-bold text-green-900">
                          Row Total: {formatCalculatedValue(rowTotals.totalPackages)} {getPackageUnitLabel(form.packingType)}
                          {rowTotals.totalPieces !== null
                            ? ` · ${formatCalculatedValue(rowTotals.totalPieces)} Pieces`
                            : ""}
                          {` · ${formatCalculatedValue(rowTotals.totalWeightKg)} kg`}
                        </div>
                      )}
                      {packingRows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removePackingRow(row.id)}
                          className="mt-3 text-xs font-bold text-red-600"
                        >
                          Remove Size
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {isApplePackingFlow && (
            <div className="rounded-md border border-green-200 bg-green-50 p-3">
              <h2 className="text-sm font-extrabold text-black">Calculated Lot Summary</h2>
              <p className="mt-1 text-[10px] font-semibold text-gray-500">
                Calculated from the current packing details.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <SummaryTile
                  label="Total Packages"
                  value={`${formatCalculatedValue(packingTotals.totalPackages)} Packages`}
                />
                {packingTotals.totalPieces !== null && (
                  <SummaryTile
                    label="Total Fruit Pieces"
                    value={`${formatCalculatedValue(packingTotals.totalPieces)} Pieces`}
                  />
                )}
                <SummaryTile
                  label="Total Net Weight"
                  value={`${formatCalculatedValue(packingTotals.totalWeightKg)} kg`}
                />
                {packingTotals.averageFruitWeightGrams !== null && (
                  <SummaryTile
                    label="Average Fruit Weight"
                    value={`${formatCalculatedValue(packingTotals.averageFruitWeightGrams)} g`}
                  />
                )}
              </div>
            </div>
          )}

          <Field
            icon={<FaMoneyBillWave />}
            label="Base price per box"
            value={form.basePrice}
            placeholder="1200"
            inputMode="numeric"
            onChange={(value) => updateForm("basePrice", value)}
          />
          <Field
            icon={<FaMapMarkerAlt />}
            label="Packing hall / Farm location"
            value={form.location}
            placeholder="Packing hall or farm location"
            onChange={(value) => updateForm("location", value)}
          />
          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-gray-700">
              Description
            </span>
            <textarea
              value={form.description}
              onChange={(e) => updateForm("description", e.target.value)}
              placeholder="Fresh, graded, ready for deal."
              rows={3}
              className="w-full rounded-md border border-gray-200 px-3 py-3 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
            />
          </label>

          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-gray-700">
              <FaImage className="text-gray-400" />
              {packingGroup === "graded" ? "Size-wise sample pictures" : "Fruit Lot sample pictures"}
            </div>
            {isDesktopLotDevice && (
              <div className="mb-2 rounded-md bg-green-50 px-3 py-2 text-xs font-bold text-green-800">
                Lot photos and video must be captured live from a mobile camera.
              </div>
            )}
            <div className="space-y-2">
              {activeMediaRows.map((grade) => {
                const selectedCount = gradeLots[grade.key].images.filter(Boolean).length;

                return (
                  <div key={grade.key} className="rounded-md border border-gray-200 bg-white p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-xs font-extrabold text-black">
                        {grade.label}
                      </span>
                      <span className="text-[10px] font-bold text-gray-500">
                        {selectedCount}/5 pics
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {SAMPLE_IMAGE_SLOTS.map((index) => {
                        const image = gradeLots[grade.key].images?.[index];
                        const slotKey = `${grade.key}-${index}`;
                        const isUploading = uploadingImageSlot === slotKey;
                        const captureTargetKey = getCaptureTargetKey({
                          mediaType: "image",
                          gradeKey: grade.key,
                          slotIndex: index,
                        });
                        const isCreatingCapture = captureStartingKey === captureTargetKey;

                        if (isDesktopLotDevice) {
                          return (
                            <button
                              key={`${grade.key}-${index}`}
                              type="button"
                              disabled={isCreatingCapture}
                              onClick={() =>
                                openMobileCaptureSession({
                                  mediaType: "image",
                                  gradeKey: grade.key,
                                  slotIndex: index,
                                })
                              }
                              className={`flex min-h-[44px] w-full items-center gap-3 rounded-md border border-dashed px-3 py-3 text-left ${
                                isCreatingCapture
                                  ? "cursor-wait border-orange-300 bg-orange-50 text-orange-700"
                                  : "border-green-300 bg-green-50 text-green-700"
                              }`}
                            >
                              {isCreatingCapture ? <FaSpinner className="animate-spin" /> : <FaImage />}
                              <span className="text-xs font-semibold">
                                {isCreatingCapture
                                  ? "Creating camera link..."
                                  : image
                                  ? `Sample ${grade.label} pic ${index + 1} selected`
                                  : `Connect mobile camera for pic ${grade.label} ${index + 1}`}
                              </span>
                            </button>
                          );
                        }

                        return (
                          <label key={`${grade.key}-${index}`} className="block">
                            <span className={`flex min-h-[44px] items-center gap-3 rounded-md border border-dashed px-3 py-3 ${
                              isUploading
                                ? "cursor-wait border-orange-300 bg-orange-50 text-orange-700"
                                : "border-green-300 bg-green-50 text-green-700"
                            }`}>
                              {isUploading ? <FaSpinner className="animate-spin" /> : <FaImage />}
                              <span className="text-xs font-semibold">
                                {isUploading
                                  ? "Processing image..."
                                  : image
                                  ? `Sample ${grade.label} pic ${index + 1} selected`
                                  : `Take live sample pic ${grade.label} ${index + 1}`}
                              </span>
                              <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                multiple={false}
                                disabled={isUploading}
                                onChange={(e) =>
                                  updateGradeImage(
                                    grade.key,
                                    index,
                                    e.target.files?.[0]
                                  )
                                }
                                className="hidden"
                              />
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="block">
            <span className="mb-1.5 block text-sm font-bold text-gray-700">
              Sample lot video
            </span>
            {isDesktopLotDevice ? (
              <button
                type="button"
                disabled={captureStartingKey === getCaptureTargetKey({ mediaType: "video" })}
                onClick={() => openMobileCaptureSession({ mediaType: "video" })}
                className="flex w-full items-center gap-3 rounded-md border border-dashed border-green-300 bg-green-50 px-3 py-4 text-left text-green-700 disabled:cursor-wait disabled:border-orange-300 disabled:bg-orange-50 disabled:text-orange-700"
              >
                {captureStartingKey === getCaptureTargetKey({ mediaType: "video" }) ? (
                  <FaSpinner className="animate-spin" />
                ) : (
                  <FaVideo />
                )}
                <span className="text-xs font-semibold">
                  {captureStartingKey === getCaptureTargetKey({ mediaType: "video" })
                    ? "Creating camera link..."
                    : sampleVideo
                    ? sampleVideo.name
                    : "Connect mobile camera for sample video"}
                </span>
              </button>
            ) : (
              <label className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed border-green-300 bg-green-50 px-3 py-4 text-green-700">
                <FaVideo />
                <span className="text-xs font-semibold">
                  {sampleVideo ? sampleVideo.name : "Capture one sample video"}
                </span>
                <input
                  type="file"
                  accept="video/*"
                  capture="environment"
                  multiple={false}
                  onChange={(e) => updateSampleVideo(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || recognizing}
          className="mt-6 w-full rounded-md bg-green-700 py-3 text-sm font-bold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {loading
            ? "Listing..."
            : recognizing && uploadingImageSlot
            ? "Processing image..."
            : recognizing
            ? "Checking media..."
            : "List Lot"}
        </button>
      </form>
      {captureModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-md bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-extrabold text-black">Connect Mobile Camera</h2>
                <p className="mt-1 text-xs font-semibold text-gray-600">
                  Scan this QR code with your mobile to capture live lot media.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCaptureModal(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-700"
                aria-label="Close mobile camera link"
              >
                <FaTimes />
              </button>
            </div>

            {captureModal.qrDataUrl && (
              <img
                src={captureModal.qrDataUrl}
                alt="Mobile camera capture QR code"
                className="mx-auto h-52 w-52 rounded-md border border-gray-200"
              />
            )}

            <a
              href={captureModal.captureUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 block break-all rounded-md bg-green-50 px-3 py-2 text-center text-xs font-bold text-green-800"
            >
              {captureModal.captureUrl}
            </a>
            <p className="mt-3 text-center text-[11px] font-semibold text-gray-500">
              Waiting for mobile capture. This link expires in 15 minutes.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function SelectorWithAdd({ label, value, placeholder, options, onChange, onAdd }) {
  const addNewValue = "__ADD_NEW__";

  return (
    <div>
      <label className="block text-sm font-bold text-gray-700">{label}</label>
      <div className="mt-1">
        <select
          value={value}
          onChange={(e) => {
            if (e.target.value === addNewValue) {
              onAdd();
              return;
            }
            onChange(e.target.value);
          }}
          className="w-full rounded-md bg-gray-100 px-3 py-3 text-sm font-semibold outline-none transition focus:ring-2 focus:ring-green-100"
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
          <option value={addNewValue}>+ New</option>
        </select>
      </div>
    </div>
  );
}

function SimpleSelect({ label, value, placeholder, options, onChange }) {
  return (
    <label className="block">
      <span className="block text-sm font-bold text-gray-700">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-md bg-gray-100 px-3 py-3 text-sm font-semibold outline-none transition focus:ring-2 focus:ring-green-100"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function PackingSpecificationFields({ specification, details, onChange }) {
  if (!specification) return null;

  return (
    <>
      {specification.typeOptions && (
        <>
          <PackingOptionSelect
            label={specification.typeLabel}
            value={details.packageTypeCode}
            options={specification.typeOptions}
            onChange={(value) => onChange("packageTypeCode", value)}
          />
          {details.packageTypeCode === CUSTOM_OPTION_CODE && (
            <TextPackingField
              label={specification.customTypeLabel}
              value={details.customPackageTypeSpecification}
              onChange={(value) => onChange("customPackageTypeSpecification", value)}
            />
          )}
        </>
      )}

      {specification.sizeOptions && (
        <>
          <PackingOptionSelect
            label={specification.sizeLabel}
            value={details.packageSizeCode}
            options={specification.sizeOptions}
            onChange={(value) => onChange("packageSizeCode", value)}
          />
          {details.packageSizeCode === CUSTOM_OPTION_CODE && (
            <TextPackingField
              label={specification.customSizeLabel}
              value={details.customPackageSizeSpecification}
              onChange={(value) => onChange("customPackageSizeSpecification", value)}
            />
          )}
        </>
      )}

      <PackingOptionSelect
        label={specification.capacityLabel || "Package Capacity"}
        value={details.packageCapacityCode}
        options={specification.capacityOptions}
        onChange={(value) => onChange("packageCapacityCode", value)}
      />
      {details.packageCapacityCode === CUSTOM_OPTION_CODE && (
        <NumericPackingField
          label={specification.customCapacityLabel || "Custom Capacity per Package (kg)"}
          value={details.weightPerPackageKg}
          step="0.01"
          onChange={(value) => onChange("weightPerPackageKg", value)}
        />
      )}

      {specification.trayCountOptions && (
        <>
          <PackingOptionSelect
            label={specification.trayCountLabel}
            value={details.trayCountCode}
            options={specification.trayCountOptions}
            onChange={(value) => onChange("trayCountCode", value)}
          />
          {details.trayCountCode === CUSTOM_OPTION_CODE && (
            <NumericPackingField
              label={specification.customTrayCountLabel}
              value={details.traysPerPackage}
              onChange={(value) => onChange("traysPerPackage", value)}
            />
          )}
        </>
      )}
    </>
  );
}

function PackingOptionSelect({ label, value, options = [], onChange }) {
  return (
    <label className="block text-xs font-bold text-gray-700">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-md bg-gray-100 px-3 py-2 text-sm font-semibold outline-none"
      >
        <option value="">Select {label}</option>
        {options.map((item) => (
          <option key={item.code} value={item.code}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextPackingField({ label, value, onChange }) {
  return (
    <label className="block text-xs font-bold text-gray-700">
      {label}
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-md bg-gray-100 px-3 py-2 text-sm font-semibold outline-none"
      />
    </label>
  );
}

function AppleCountPresetField({
  label,
  options,
  value,
  customValue,
  customLabel,
  onPresetChange,
  onCustomChange,
}) {
  return (
    <>
      <label className="block text-xs font-bold text-gray-700">
        {label}
        <select
          value={value}
          onChange={(event) => onPresetChange(event.target.value)}
          className="mt-1 w-full rounded-md bg-gray-100 px-3 py-2 text-sm font-semibold outline-none"
        >
          <option value="">Select {label}</option>
          {options.map((count) => (
            <option key={count} value={String(count)}>
              {count} pieces
            </option>
          ))}
          <option value={CUSTOM_OPTION_CODE}>Other / Custom</option>
        </select>
      </label>
      {value === CUSTOM_OPTION_CODE && (
        <NumericPackingField
          label={customLabel}
          value={customValue}
          onChange={onCustomChange}
        />
      )}
    </>
  );
}

function NumericPackingField({ label, value, onChange, step = "1" }) {
  return (
    <label className="block text-xs font-bold text-gray-700">
      {label}
      <input
        type="number"
        min="0"
        step={step}
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-md bg-gray-100 px-3 py-2 text-sm font-semibold outline-none"
      />
    </label>
  );
}

function CustomEntryPanel({ title, value, placeholder, onChange, onSave, onCancel }) {
  return (
    <div className="relative rounded-md bg-green-800 px-4 py-5 text-white">
      <button
        type="button"
        onClick={onCancel}
        className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-sm text-green-800"
        aria-label="Cancel"
      >
        <FaTimes />
      </button>
      <label className="block">
        <span className="mb-3 block text-sm font-bold">{title}</span>
        <input
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-950 outline-none"
        />
      </label>
      <button
        type="button"
        onClick={onSave}
        className="mx-auto mt-4 block rounded-full bg-orange-500 px-6 py-1 text-xs font-extrabold text-black"
      >
        Enter
      </button>
    </div>
  );
}

function SummaryTile({ label, value }) {
  return (
    <div className="rounded-md bg-white px-3 py-2">
      <p className="text-[9px] font-bold text-gray-500">{label}</p>
      <p className="text-sm font-extrabold text-black">{value}</p>
    </div>
  );
}

function Field({
  icon,
  label,
  value,
  placeholder,
  onChange,
  inputMode,
  type = "text",
  readOnly = false,
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-bold text-gray-700">
        {label}
      </span>
      <span className="flex items-center gap-3 rounded-md border border-gray-200 bg-white px-3 py-3 text-gray-400 transition focus-within:border-green-600 focus-within:ring-2 focus-within:ring-green-100">
        {icon}
        <input
          type={type}
          value={value}
          placeholder={placeholder}
          inputMode={inputMode}
          readOnly={readOnly}
          onChange={(e) => onChange(e.target.value)}
          className="w-full border-none bg-transparent text-sm font-semibold text-gray-950 outline-none"
        />
      </span>
    </label>
  );
}
function ReadOnlyInfo({ icon, label, value, note }) {
  return (
    <div>
      <span className="mb-1.5 block text-sm font-bold text-gray-700">
        {label}
      </span>
      <div className="flex items-center gap-3 rounded-md border border-gray-200 bg-gray-100 px-3 py-3 text-gray-400">
        {icon}
        <span className="w-full text-sm font-semibold text-gray-600">
          {value}
        </span>
      </div>
      {note && (
        <p className="mt-1 text-[10px] font-semibold text-gray-500">
          {note}
        </p>
      )}
    </div>
  );
}

function formatWeight(value) {
  const number = Number(value || 0);
  if (!number) return "0 KG";
  if (number < 1) return `${number.toFixed(1)} KG`;
  return `${Math.round(number * 10) / 10} KG`;
}

function singularizeUnit(unit = "units") {
  if (unit === "cartons") return "Carton";
  if (unit === "crates") return "Crate";
  return "Unit";
}
