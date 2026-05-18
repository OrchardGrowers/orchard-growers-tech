import type { Product } from "./types";

const publicAssetUrl = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;

type DemoProductSpec = {
  slug: string;
  title: string;
  fruitName: string;
  variety: string;
  description: string;
  quantity: number;
  basePrice: number;
  imageQuery: string;
};

const demoProductSpecs: DemoProductSpec[] = [
  {
    slug: "all-products-showcase",
    title: "All Products Orchard Starter Pack",
    fruitName: "All Products",
    variety: "Plants Tools Seeds Inputs",
    description: "All products showcase with plants, tools, planters, seeds, organic inputs, and orchard care essentials.",
    quantity: 75,
    basePrice: 499,
    imageQuery: "orchard plants gardening supplies",
  },
  {
    slug: "seasonal-plants",
    title: "Seasonal Plants Collection",
    fruitName: "Seasonal Plants",
    variety: "Spring Summer Monsoon Autumn Winter",
    description: "Seasonal plants for spring, summer, monsoon, autumn, and winter garden planning.",
    quantity: 120,
    basePrice: 349,
    imageQuery: "seasonal flowering plants nursery",
  },
  {
    slug: "all-season-plants",
    title: "All Season Perennial Plants",
    fruitName: "All Season Plants",
    variety: "Perennial All Season",
    description: "All season perennial plants for year round homes, balconies, farms, and orchard borders.",
    quantity: 90,
    basePrice: 699,
    imageQuery: "perennial garden plants",
  },
  {
    slug: "tools-equipments",
    title: "Tools & Equipments Garden Kit",
    fruitName: "Tools & Equipments",
    variety: "Hand Tools Equipment",
    description: "Tools and equipment kit with garden tool, pruning tool, sprayer, cutter, and hand equipment.",
    quantity: 55,
    basePrice: 1299,
    imageQuery: "garden tools equipment",
  },
  {
    slug: "ornamental-plants",
    title: "Ornamental Plants Mix",
    fruitName: "Ornamental Plants",
    variety: "Flower Decorative",
    description: "Ornamental, flower, and decorative plants for entrances, patios, and landscape corners.",
    quantity: 85,
    basePrice: 549,
    imageQuery: "ornamental plants flowers",
  },
  {
    slug: "plant-seeds",
    title: "Plant Seeds Variety Box",
    fruitName: "Plant Seeds",
    variety: "Vegetable Flower Herb Seeds",
    description: "Plant seed box with vegetable seeds, flower seeds, herb seeds, and nursery seed trays.",
    quantity: 180,
    basePrice: 249,
    imageQuery: "plant seeds gardening",
  },
  {
    slug: "organic-natural-products",
    title: "Organic and Natural Products Pack",
    fruitName: "Organic and Natural Products",
    variety: "Organic Natural Bio",
    description: "Organic, natural, and bio garden care products for healthier soil and safer plant growth.",
    quantity: 70,
    basePrice: 899,
    imageQuery: "organic gardening products",
  },
  {
    slug: "planters-pots",
    title: "Planters & Pots Combo",
    fruitName: "Planters & Pots",
    variety: "Planter Pot Grow Bag",
    description: "Planter, pot, and grow bag combo for terrace gardens, nurseries, and indoor plants.",
    quantity: 110,
    basePrice: 999,
    imageQuery: "planters pots garden",
  },
  {
    slug: "tools",
    title: "Professional Orchard Tools",
    fruitName: "Tools",
    variety: "Tool Pruner Cutter",
    description: "Professional orchard tool set with pruning tool, grafting tool, cutter, and measuring tool.",
    quantity: 45,
    basePrice: 1599,
    imageQuery: "orchard pruning tools",
  },
  {
    slug: "live-fruit-plants",
    title: "Live Fruit Plants Bundle",
    fruitName: "Live Fruit Plants",
    variety: "Mango Apple Pear Plum Peach Citrus",
    description: "Live fruit plants including mango, apple, pear, plum, peach, and citrus nursery plants.",
    quantity: 140,
    basePrice: 749,
    imageQuery: "fruit plant nursery",
  },
  {
    slug: "live-forest-plants",
    title: "Live Forest Plant Saplings",
    fruitName: "Live Forest Plants",
    variety: "Forest Native Tree Timber Shade Tree",
    description: "Live forest plants with native tree, timber tree, and shade tree saplings for plantations.",
    quantity: 200,
    basePrice: 649,
    imageQuery: "forest saplings native trees",
  },
  {
    slug: "machineries",
    title: "Machineries Sprayer and Tiller",
    fruitName: "Machineries",
    variety: "Machine Sprayer Tiller Pump Cutter",
    description: "Machinery and machine options including sprayer, tiller, pump, cutter, and orchard equipment.",
    quantity: 18,
    basePrice: 7499,
    imageQuery: "agriculture machinery sprayer tiller",
  },
  {
    slug: "gardening-inputs",
    title: "Gardening Inputs Soil Kit",
    fruitName: "Gardening Inputs",
    variety: "Fertilizer Soil Mulch Cocopeat",
    description: "Gardening input kit with fertilizer, soil mix, mulch, cocopeat, and nursery media.",
    quantity: 95,
    basePrice: 1199,
    imageQuery: "gardening soil fertilizer",
  },
  {
    slug: "manure",
    title: "Organic Manure Compost",
    fruitName: "Manure",
    variety: "Manure Compost Vermicompost",
    description: "Manure, compost, and vermicompost for fruit plants, vegetables, and ornamental plants.",
    quantity: 160,
    basePrice: 599,
    imageQuery: "organic compost manure",
  },
  {
    slug: "growth-tonic",
    title: "Growth Tonic Booster",
    fruitName: "Growth Tonic",
    variety: "Growth Tonic Booster Bio Stimulant",
    description: "Growth tonic, booster, bio stimulant, and biostimulant support for healthy plant growth.",
    quantity: 130,
    basePrice: 799,
    imageQuery: "plant growth tonic fertilizer",
  },
  {
    slug: "price-under-500",
    title: "Price Under Rs. 500 Starter Seeds",
    fruitName: "Budget Seeds",
    variety: "Price Under 500",
    description: "Affordable product for price under Rs. 500 filter and starter garden use.",
    quantity: 210,
    basePrice: 299,
    imageQuery: "seed packets garden",
  },
  {
    slug: "price-500-1000",
    title: "Price Rs. 500 - Rs. 1,000 Plant Pack",
    fruitName: "Budget Plant Pack",
    variety: "Price 500 1000",
    description: "Value product for price Rs. 500 to Rs. 1,000 filter and small garden orders.",
    quantity: 100,
    basePrice: 799,
    imageQuery: "small nursery plants",
  },
  {
    slug: "price-1000-2500",
    title: "Price Rs. 1,000 - Rs. 2,500 Orchard Kit",
    fruitName: "Orchard Kit",
    variety: "Price 1000 2500",
    description: "Mid range product for price Rs. 1,000 to Rs. 2,500 filter and orchard planning.",
    quantity: 52,
    basePrice: 1599,
    imageQuery: "orchard garden kit",
  },
  {
    slug: "price-2500-5000",
    title: "Price Rs. 2,500 - Rs. 5,000 Premium Combo",
    fruitName: "Premium Combo",
    variety: "Price 2500 5000",
    description: "Premium product for price Rs. 2,500 to Rs. 5,000 filter and nursery bulk order.",
    quantity: 34,
    basePrice: 3499,
    imageQuery: "premium nursery plants",
  },
  {
    slug: "price-above-5000",
    title: "Price Above Rs. 5,000 Machinery Pack",
    fruitName: "Machinery Pack",
    variety: "Price Above 5000",
    description: "High value product for price above Rs. 5,000 filter with orchard machinery support.",
    quantity: 16,
    basePrice: 8499,
    imageQuery: "farm machinery orchard",
  },
  {
    slug: "season-spring",
    title: "Season Spring Flowering Plants",
    fruitName: "Season Spring",
    variety: "Spring",
    description: "Spring season plants for fresh garden beds, flowering borders, and orchard edges.",
    quantity: 115,
    basePrice: 699,
    imageQuery: "spring flowering plants",
  },
  {
    slug: "season-summer",
    title: "Season Summer Heat Ready Plants",
    fruitName: "Season Summer",
    variety: "Summer",
    description: "Summer season plants selected for heat, sun, terrace gardens, and outdoor landscapes.",
    quantity: 105,
    basePrice: 749,
    imageQuery: "summer garden plants",
  },
  {
    slug: "season-monsoon",
    title: "Season Monsoon Rainy Plants",
    fruitName: "Season Monsoon",
    variety: "Monsoon Rainy",
    description: "Monsoon season and rainy season plants for fast establishment and plantation drives.",
    quantity: 150,
    basePrice: 649,
    imageQuery: "monsoon plants rain garden",
  },
  {
    slug: "season-autumn",
    title: "Season Autumn Garden Plants",
    fruitName: "Season Autumn",
    variety: "Autumn Fall",
    description: "Autumn season and fall garden plants for colorful borders and orchard preparation.",
    quantity: 80,
    basePrice: 899,
    imageQuery: "autumn garden plants",
  },
  {
    slug: "season-winter",
    title: "Season Winter Hardy Plants",
    fruitName: "Season Winter",
    variety: "Winter",
    description: "Winter season hardy plants for cool weather gardens, orchards, and nursery displays.",
    quantity: 95,
    basePrice: 999,
    imageQuery: "winter hardy plants",
  },
];

export const DEMO_PRODUCTS: Product[] = demoProductSpecs.map((spec, index) => ({
  _id: `demo-${spec.slug}`,
  title: spec.title,
  fruitName: spec.fruitName,
  variety: spec.variety,
  description: spec.description,
  location: "Orchard Growers",
  quantity: spec.quantity,
  lotNo: `OG-DEMO-${String(index + 1).padStart(3, "0")}`,
  packingType: "Demo listing",
  packingWeightKg: 1,
  totalWeightKg: spec.quantity,
  basePrice: spec.basePrice,
  images: Array.from({ length: 5 }, (_, imageIndex) =>
    spec.slug === "season-winter" && imageIndex === 0
      ? publicAssetUrl("/product-images/orchard-growers-winter-hardy-plants-ai.png")
      : `https://source.unsplash.com/640x480/?${encodeURIComponent(spec.imageQuery)}&sig=${spec.slug}-${imageIndex + 1}`
  ),
  status: "AVAILABLE",
  createdAt: new Date(Date.UTC(2026, 4, 12, 10, index)).toISOString(),
  updatedAt: new Date(Date.UTC(2026, 4, 12, 12, index)).toISOString(),
  createdBy: {
    name: "Orchard Growers",
    orchardName: "Orchard Growers",
    businessName: "Orchard Growers",
  },
}));

export function withDemoProducts(products: Product[]) {
  const merged = [...products];
  DEMO_PRODUCTS.forEach((demoProduct) => {
    const existingIndex = merged.findIndex(
      (product) => product._id === demoProduct._id || product.title?.toLowerCase() === demoProduct.title.toLowerCase()
    );

    if (existingIndex === -1) {
      merged.push(demoProduct);
      return;
    }

    const existing = merged[existingIndex];
    merged[existingIndex] = {
      ...demoProduct,
      ...existing,
      basePrice: existing.basePrice ?? demoProduct.basePrice,
      images: existing.images?.length ? existing.images : demoProduct.images,
      description: existing.description || demoProduct.description,
      fruitName: existing.fruitName || demoProduct.fruitName,
      variety: existing.variety || demoProduct.variety,
      location: "Orchard Growers",
      quantity: existing.quantity || demoProduct.quantity,
      createdAt: existing.createdAt || demoProduct.createdAt,
      updatedAt: existing.updatedAt || demoProduct.updatedAt,
    };
  });

  return merged;
}
