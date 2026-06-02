import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaImage,
  FaMapMarkerAlt,
  FaMoneyBillWave,
  FaPlus,
  FaVideo,
  FaWarehouse,
  FaWeightHanging,
} from "react-icons/fa";
import API from "../services/api";
import {
  recognizeFruitImage,
  recognizeFruitVideo,
} from "../utils/fruitRecognition";
import { getCurrentUser } from "../utils/auth";

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

const QUALITY_OPTIONS = [
  "Premium Certified Organic Export Quality",
  "Premium Export Quality",
  "Export Quality",
  "Certified Organic",
  "Premium Quality",
  "A Grade Fresh",
  "Natural / Farm Fresh",
];

const PACKING_TYPES = [
  { label: "Unpacked / Crates / 18KG", kg: 18, unpacked: true, unit: "crates" },
  { label: "Unpacked / Crates / 20KG", kg: 20, unpacked: true, unit: "crates" },
  { label: "Unpacked / Crates / 25KG", kg: 25, unpacked: true, unit: "crates" },
  { label: "400gms carton", kg: 0.4, unit: "cartons" },
  { label: "500gms carton", kg: 0.5, unit: "cartons" },
  { label: "800gms carton", kg: 0.8, unit: "cartons" },
  { label: "1 KG carton", kg: 1, unit: "cartons" },
  { label: "4 KG carton", kg: 4, unit: "cartons" },
  { label: "5 KG carton", kg: 5, unit: "cartons" },
  { label: "10 KG carton", kg: 10, unit: "cartons" },
  { label: "15 KG carton", kg: 15, unit: "cartons" },
  { label: "Universal Carton 20KG Aprox", kg: 20, unit: "cartons" },
  { label: "25 KG Carton Aprox", kg: 25, unit: "cartons" },
  { label: "30 KG Carton Aprox", kg: 30, unit: "cartons" },
  { label: "28 KG Carton Aprox", kg: 28, unit: "cartons" },
  { label: "14 KG Crates Aprox", kg: 14, unit: "crates" },
  { label: "18 KG Crates Aprox", kg: 18, unit: "crates" },
  { label: "20 KG Crates Aprox", kg: 20, unit: "crates" },
  { label: "22 KG Crate Aprox", kg: 22, unit: "crates" },
  { label: "25 KG Crate Aprox", kg: 25, unit: "crates" },
  { label: "28 KG Crate Aprox", kg: 28, unit: "crates" },
  { label: "30 KG Crate Aprox", kg: 30, unit: "crates" },
  { label: "32 KG Crate Aprox", kg: 32, unit: "crates" },
  { label: "35 KG Crate Aprox", kg: 35, unit: "crates" },
];

const GRADES = [
  { label: "A+", key: "A_PLUS" },
  { label: "A", key: "A" },
  { label: "B+", key: "B_PLUS" },
  { label: "B", key: "B" },
  { label: "C+", key: "C_PLUS" },
  { label: "C", key: "C" },
  { label: "D", key: "D" },
  { label: "Ungraded", key: "UN_GRADED", unpackedOnly: true },
];

const initialGradeLots = GRADES.reduce((lots, grade) => {
  lots[grade.key] = { boxes: "", images: Array(5).fill(null) };
  return lots;
}, {});

const SAMPLE_IMAGE_SLOTS = [0, 1, 2, 3, 4];

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

const getVarietiesForFruit = (fruitName) => {
  const mappedOptions = FRUIT_VARIETY_OPTIONS[fruitName] || [];
  const fallbackOptions = DRY_FRUIT_NAMES.has(fruitName)
    ? DRY_FRUIT_VARIETIES
    : DEFAULT_VARIETIES;

  return Array.from(new Set([...mappedOptions, ...fallbackOptions]));
};

const cropImageToPlatformFrame = (file) => {
  if (!file || !file.type?.startsWith("image/")) {
    return Promise.resolve(file);
  }

  return new Promise((resolve) => {
    const image = new Image();
    const url = URL.createObjectURL(file);

    image.onload = () => {
      const targetWidth = 1200;
      const targetHeight = 900;
      const targetRatio = targetWidth / targetHeight;
      const sourceRatio = image.width / image.height;
      let sourceWidth = image.width;
      let sourceHeight = image.height;
      let sourceX = 0;
      let sourceY = 0;

      if (sourceRatio > targetRatio) {
        sourceWidth = image.height * targetRatio;
        sourceX = (image.width - sourceWidth) / 2;
      } else {
        sourceHeight = image.width / targetRatio;
        sourceY = (image.height - sourceHeight) / 2;
      }

      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const context = canvas.getContext("2d");
      context.drawImage(
        image,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        targetWidth,
        targetHeight
      );

      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          if (!blob) {
            resolve(file);
            return;
          }

          resolve(
            new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
              type: "image/jpeg",
              lastModified: Date.now(),
            })
          );
        },
        "image/jpeg",
        0.9
      );
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };

    image.src = url;
  });
};

export default function ListNewLot() {
  const navigate = useNavigate();
  const [fruits, setFruits] = useState(DEFAULT_FRUITS);
  const [varieties, setVarieties] = useState(DEFAULT_VARIETIES);
  const [customPanel, setCustomPanel] = useState(null);
  const [customValue, setCustomValue] = useState("");
  const [form, setForm] = useState({
    fruitName: "",
    variety: "",
    quality: "",
    description: "",
    basePrice: "",
    location: "",
    packingIndex: "0",
  });
  const [gradeLots, setGradeLots] = useState(initialGradeLots);
  const [sampleVideo, setSampleVideo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const [message, setMessage] = useState("");
  const lotNoPreview = useMemo(() => getLotNoPreview(), []);

  const selectedPacking = PACKING_TYPES[Number(form.packingIndex)] || PACKING_TYPES[0];
  const packingUnit = selectedPacking.unit || "units";
  const visibleGrades = useMemo(
    () =>
      GRADES.filter(
        (grade) => !grade.unpackedOnly || selectedPacking.unpacked
      ),
    [selectedPacking]
  );
  const calculations = useMemo(() => {
    const gradeRows = visibleGrades.map((grade) => {
      const boxes = Number(gradeLots[grade.key].boxes || 0);
      return {
        ...grade,
        boxes,
        weightKg: boxes * selectedPacking.kg,
      };
    });

    return {
      gradeRows,
      totalBoxes: gradeRows.reduce((total, row) => total + row.boxes, 0),
      totalWeightKg: gradeRows.reduce((total, row) => total + row.weightKg, 0),
    };
  }, [gradeLots, selectedPacking, visibleGrades]);

  const updateForm = (field, value) => {
    setForm({ ...form, [field]: value });
  };

  const updateFruit = (value) => {
    setVarieties(getVarietiesForFruit(value));
    setForm((current) => ({
      ...current,
      fruitName: value,
      variety: "",
    }));
  };

  const updateGradeBoxes = (gradeKey, boxes) => {
    setGradeLots({
      ...gradeLots,
      [gradeKey]: { ...gradeLots[gradeKey], boxes },
    });
  };

  const updateGradeImage = async (gradeKey, index, file) => {
    if (!file) return;

    setMessage("");
    setRecognizing(true);
    const recognition = await recognizeFruitImage(file).catch(() => ({
      accepted: false,
      label: "unrecognized image",
    }));
    setRecognizing(false);

    if (!recognition.accepted) {
      setMessage(
        `Image rejected. Fruit was not recognized. Detected: ${recognition.label}.`
      );
      return;
    }

    const platformFile = await cropImageToPlatformFrame(file);
    const images = [...(gradeLots[gradeKey].images || Array(5).fill(null))];
    while (images.length < 5) images.push(null);
    images[index] = platformFile || null;

    setGradeLots({
      ...gradeLots,
      [gradeKey]: {
        ...gradeLots[gradeKey],
        images,
      },
    });
  };

  const updateSampleVideo = async (file) => {
    if (!file) {
      setSampleVideo(null);
      return;
    }

    setMessage("");
    setRecognizing(true);
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

    const preparedGradeLots = visibleGrades.map((grade) => ({
      grade: grade.label,
      fieldName: `gradeImages_${grade.key}`,
      boxes: Number(gradeLots[grade.key].boxes || 0),
      weightKg: Number(gradeLots[grade.key].boxes || 0) * selectedPacking.kg,
    }));

    if (!form.fruitName || !form.variety || !form.quality || !form.basePrice) {
      setMessage("Fruit, variety, quality, and base price are required.");
      return;
    }

    if (calculations.totalBoxes <= 0) {
      setMessage(`Add ${packingUnit} for at least one grade.`);
      return;
    }

    try {
      setLoading(true);

      const title = `${form.fruitName} ${form.variety}`.trim();
      const data = new FormData();
      data.append("title", title);
      data.append("fruitName", form.fruitName);
      data.append("variety", form.variety);
      data.append("quality", form.quality);
      data.append("description", form.description);
      data.append("basePrice", form.basePrice);
      data.append("location", form.location);
      data.append("packingType", selectedPacking.label);
      data.append("packingWeightKg", selectedPacking.kg);
      data.append("totalWeightKg", calculations.totalWeightKg);
      data.append("quantity", calculations.totalBoxes);
      data.append("gradeLots", JSON.stringify(preparedGradeLots));

      visibleGrades.forEach((grade) => {
        gradeLots[grade.key].images.forEach((image) => {
          if (image) data.append(`gradeImages_${grade.key}`, image);
        });
      });

      if (sampleVideo) data.append("sampleVideo", sampleVideo);

      await API.post("/products", data, {
        headers: { "Content-Type": "multipart/form-data" },
      });

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
    }
  };

  return (
    <div className="mx-auto max-w-md border-t-4 border-green-600 bg-white pb-20">
      <form onSubmit={handleSubmit} className="px-4 py-5">
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
            Checking media for fruit recognition...
          </div>
        )}

        <div className="space-y-4">
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
            />
          )}

          <SimpleSelect
            label="Quality"
            value={form.quality}
            placeholder="Select quality"
            options={QUALITY_OPTIONS}
            onChange={(value) => updateForm("quality", value)}
          />

          <ReadOnlyInfo
            icon={<FaWarehouse />}
            label="Lot No."
            value={lotNoPreview}
            note="Final sequence is confirmed when the lot is saved."
          />

          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-gray-700">
              <FaWeightHanging className="text-gray-400" />
              Packing type and weight calculation
            </div>
            <div className="rounded-md border border-gray-200 bg-white p-3">
              <div className="grid max-h-56 grid-cols-1 gap-2 overflow-y-auto pr-1">
                {PACKING_TYPES.map((packing, index) => (
                  <label
                    key={packing.label}
                    className="flex items-center gap-2 text-xs font-semibold text-gray-700"
                  >
                    <input
                      type="radio"
                      name="packingType"
                      checked={form.packingIndex === String(index)}
                      onChange={() => updateForm("packingIndex", String(index))}
                    />
                    <span>{packing.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-md border border-green-100 bg-green-50 p-3">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-black">Grades</h2>
              <span className="text-[10px] font-bold text-gray-500">Qty</span>
            </div>
            <div className="space-y-2">
              {calculations.gradeRows.map((grade) => (
                <div
                  key={grade.key}
                  className="grid grid-cols-[1fr_76px_72px] items-center gap-2 text-xs"
                >
                  <label className="font-bold text-gray-700">{grade.label}</label>
                  <input
                    value={gradeLots[grade.key].boxes}
                    inputMode="numeric"
                    placeholder={`0 ${singularizeUnit(packingUnit)}`}
                    onChange={(e) => updateGradeBoxes(grade.key, e.target.value)}
                    className="rounded bg-white px-2 py-1 text-right text-[10px] font-bold outline-none"
                  />
                  <span className="truncate rounded bg-white px-2 py-1 text-right text-[10px] font-bold text-gray-500">
                    {formatWeight(grade.weightKg)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <SummaryTile label="Total Qty" value={`${calculations.totalBoxes} ${packingUnit}`} />
              <SummaryTile label="Total Weight" value={formatWeight(calculations.totalWeightKg)} />
            </div>
          </div>

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
              Grade-wise sample pictures
            </div>
            <div className="space-y-2">
              {visibleGrades.map((grade) => {
                const boxes = Number(gradeLots[grade.key].boxes || 0);
                if (boxes <= 0) return null;
                const selectedCount = gradeLots[grade.key].images.filter(Boolean).length;

                return (
                  <div key={grade.key} className="rounded-md border border-gray-200 bg-white p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-xs font-extrabold text-black">
                        Grade {grade.label}
                      </span>
                      <span className="text-[10px] font-bold text-gray-500">
                        {selectedCount}/5 pics
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {SAMPLE_IMAGE_SLOTS.map((index) => {
                        const image = gradeLots[grade.key].images?.[index];

                        return (
                        <label key={`${grade.key}-${index}`} className="block">
                          <span className="flex min-h-[44px] items-center gap-3 rounded-md border border-dashed border-green-300 bg-green-50 px-3 py-3 text-green-700">
                            <FaImage />
                            <span className="text-xs font-semibold">
                              {image
                                ? `Sample ${grade.label} pic ${index + 1} selected`
                                : `Take live sample pic ${grade.label} ${index + 1}`}
                            </span>
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              multiple={false}
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

          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-gray-700">
              Sample lot video
            </span>
            <span className="flex items-center gap-3 rounded-md border border-dashed border-green-300 bg-green-50 px-3 py-4 text-green-700">
              <FaVideo />
              <span className="text-xs font-semibold">
                {sampleVideo ? sampleVideo.name : "Upload one sample video"}
              </span>
              <input
                type="file"
                accept="video/*"
                multiple={false}
                onChange={(e) => updateSampleVideo(e.target.files?.[0] || null)}
                className="hidden"
              />
            </span>
          </label>
        </div>

        <button
          type="submit"
          disabled={loading || recognizing}
          className="mt-6 w-full rounded-md bg-green-700 py-3 text-sm font-bold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {loading ? "Listing..." : recognizing ? "Checking media..." : "List Lot"}
        </button>
      </form>
    </div>
  );
}

function SelectorWithAdd({ label, value, placeholder, options, onChange, onAdd }) {
  const addNewValue = "__ADD_NEW__";

  return (
    <div>
      <label className="block text-sm font-bold text-gray-700">{label}</label>
      <div className="mt-1 grid grid-cols-[1fr_64px] gap-1">
        <select
          value={value}
          onChange={(e) => {
            if (e.target.value === addNewValue) {
              onAdd();
              return;
            }
            onChange(e.target.value);
          }}
          className="rounded bg-gray-100 px-3 py-2 text-sm font-semibold outline-none"
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
          <option value={addNewValue}>+ New</option>
        </select>
        <button
          type="button"
          onClick={onAdd}
          className="rounded bg-green-100 text-xs font-extrabold text-green-800"
          aria-label={`Add new ${label}`}
        >
          + New
        </button>
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
        className="mt-1 w-full rounded bg-gray-100 px-3 py-2 text-sm font-semibold outline-none"
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

function CustomEntryPanel({ title, value, placeholder, onChange, onSave }) {
  return (
    <div className="rounded-md bg-green-800 px-4 py-5 text-white">
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
          onChange={(e) => onChange?.(e.target.value)}
          className="w-full bg-transparent text-sm text-gray-950 outline-none placeholder:text-gray-400 read-only:text-gray-500"
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
