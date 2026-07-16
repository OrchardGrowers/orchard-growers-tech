export const CUSTOM_OPTION_CODE = "OTHER_CUSTOM";

const option = (code, label, valueKg) => ({ code, label, valueKg });
const customOption = option(CUSTOM_OPTION_CODE, "Other / Custom");

const genericSizes = [
  option("SMALL", "Small"),
  option("MEDIUM", "Medium"),
  option("LARGE", "Large"),
  option("EXTRA_LARGE", "Extra Large"),
  customOption,
];

const capacities = (values) => [
  ...values.map((value) => option(`${String(value).replace(".", "_")}_KG`, `${value} kg`, value)),
  customOption,
];

export const PACKING_SPECIFICATIONS = {
  CRATE: {
    label: "Crate",
    capacityLabel: "Capacity per Crate",
    customCapacityLabel: "Custom Capacity per Crate (kg)",
    capacityOptions: capacities([5, 10, 12, 15, 18, 20, 22, 25, 30]),
    sizeLabel: "Crate Size",
    customSizeLabel: "Custom Crate Size / Specification",
    sizeOptions: genericSizes,
  },
  LOOSE_CARTON: {
    label: "Loose Carton",
    capacityLabel: "Capacity per Carton",
    customCapacityLabel: "Custom Capacity per Carton (kg)",
    capacityOptions: capacities([2, 3, 4, 5, 7, 10, 12, 15, 18, 20, 22]),
    typeLabel: "Carton Type",
    customTypeLabel: "Custom Carton Type / Specification",
    typeOptions: [
      option("CORRUGATED_CARTON", "Corrugated Carton"),
      option("STANDARD_FRUIT_CARTON", "Standard Fruit Carton"),
      option("VENTILATED_FRUIT_CARTON", "Ventilated Fruit Carton"),
      customOption,
    ],
    sizeLabel: "Carton Size",
    customSizeLabel: "Custom Carton Size / Specification",
    sizeOptions: genericSizes,
  },
  LOOSE_WOODEN_BOX: {
    label: "Loose Wooden Box",
    capacityLabel: "Capacity per Wooden Box",
    customCapacityLabel: "Custom Capacity per Wooden Box (kg)",
    capacityOptions: capacities([5, 10, 12, 15, 18, 20, 22, 25, 30]),
    typeLabel: "Wooden Box Type",
    customTypeLabel: "Custom Wooden Box Type / Specification",
    typeOptions: [
      option("STANDARD_WOODEN_FRUIT_BOX", "Standard Wooden Fruit Box"),
      option("VENTILATED_WOODEN_FRUIT_BOX", "Ventilated Wooden Fruit Box"),
      option("LIGHTWEIGHT_WOODEN_BOX", "Lightweight Wooden Box"),
      option("HEAVY_DUTY_WOODEN_BOX", "Heavy-Duty Wooden Box"),
      customOption,
    ],
    sizeLabel: "Wooden Box Size",
    customSizeLabel: "Custom Wooden Box Size / Specification",
    sizeOptions: genericSizes,
  },
  TRAY_PACKED_CARTON: {
    label: "Tray Packed Carton",
    capacityLabel: "Carton Capacity",
    customCapacityLabel: "Custom Capacity per Carton (kg)",
    capacityOptions: capacities([4, 5, 7, 10, 12, 15, 18, 20]),
    typeLabel: "Tray Carton Type",
    customTypeLabel: "Custom Tray Carton Type / Specification",
    typeOptions: [
      option("SINGLE_LAYER_TRAY_CARTON", "Single-Layer Tray Carton"),
      option("DOUBLE_LAYER_TRAY_CARTON", "Double-Layer Tray Carton"),
      option("MULTI_LAYER_TRAY_CARTON", "Multi-Layer Tray Carton"),
      option("TELESCOPIC_TRAY_CARTON", "Telescopic Tray Carton"),
      customOption,
    ],
    trayCountLabel: "Trays per Carton",
    customTrayCountLabel: "Custom Tray Count",
    trayCountOptions: [1, 2, 3, 4, 5, 6].map((value) => option(String(value), String(value), value)).concat(customOption),
  },
  PUNNET: {
    label: "Punnet",
    capacityOptions: [
      option("125_G", "125 g", 0.125),
      option("200_G", "200 g", 0.2),
      option("250_G", "250 g", 0.25),
      option("500_G", "500 g", 0.5),
      option("750_G", "750 g", 0.75),
      option("1_KG", "1 kg", 1),
      option("2_KG", "2 kg", 2),
      customOption,
    ],
  },
  GIFT_PACK: {
    label: "Gift Pack",
    capacityOptions: capacities([1, 2, 3, 4, 5, 7, 10]),
    typeOptions: [
      option("STANDARD_GIFT_PACK", "Standard Gift Pack"),
      option("PREMIUM_GIFT_PACK", "Premium Gift Pack"),
      option("WINDOW_GIFT_PACK", "Window Gift Pack"),
      option("HANDLE_GIFT_PACK", "Handle Gift Pack"),
      customOption,
    ],
  },
};

const PACKING_TYPE_TO_SPECIFICATION = {
  Crate: "CRATE",
  "Loose Crate": "CRATE",
  "Loose Carton": "LOOSE_CARTON",
  "Loose Wooden Box": "LOOSE_WOODEN_BOX",
  "Tray Packed Carton": "TRAY_PACKED_CARTON",
  Punnet: "PUNNET",
  "Gift Pack": "GIFT_PACK",
};

export const getPackingSpecification = (packingType = "") =>
  PACKING_SPECIFICATIONS[PACKING_TYPE_TO_SPECIFICATION[packingType]] || null;

export const getPackingTypeLabel = (packingType = "") =>
  getPackingSpecification(packingType)?.label ||
  PACKING_SPECIFICATIONS[packingType]?.label ||
  (/^[A-Z0-9_]+$/.test(String(packingType || "").trim())
    ? String(packingType || "")
        .trim()
        .toLowerCase()
        .replace(/_/g, " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase())
    : String(packingType || "").trim());
