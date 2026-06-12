const buildFruit = ({
  name,
  varieties = [],
  regions = [],
  season = "Seasonal availability depends on region, weather and harvest conditions.",
}) => ({
  name,
  title: `${name} Fruit Lots for Bulk Buyers | eFruitMandi`,
  description: `Discover ${name.toLowerCase()} fruit lots from verified growers. Explore Fruit Lot No., Lot Size, grade, packing details, orchard location and buyer quotation options on eFruitMandi.`,
  h1: `${name} Fruit Lots for Bulk Buyers`,
  intro: `eFruitMandi helps ${name.toLowerCase()} growers list their ${name} Fruit Lots online and connect with bulk fruit buyers across India.`,
  varieties,
  regions,
  season,
});

export const fruitLotsContent = {
  apple: buildFruit({
    name: "Apple",
    varieties: [
      "Royal Delicious",
      "Red Delicious",
      "Golden Delicious",
      "Gala",
      "Fuji",
      "Granny Smith",
      "Ambri",
      "Red Chief",
      "Scarlet Spur",
      "Oregon Spur",
    ],
    regions: ["Himachal Pradesh", "Jammu & Kashmir", "Uttarakhand", "Arunachal Pradesh", "Sikkim"],
  }),

  pear: buildFruit({
    name: "Pear",
    varieties: ["Bartlett", "Bosc", "Green Pear", "Red Pear", "Nashpati", "Patharnakh"],
    regions: ["Himachal Pradesh", "Punjab", "Uttarakhand", "Jammu & Kashmir"],
  }),

  persimmon: buildFruit({
    name: "Persimmon",
    varieties: ["Fuyu", "Hachiya", "Jiro", "Japanese Persimmon"],
    regions: ["Himachal Pradesh", "Uttarakhand", "Jammu & Kashmir", "North East India"],
  }),

  plum: buildFruit({
    name: "Plum",
    varieties: ["Santa Rosa", "Kala Amritsari", "Alu Bukhara", "Mariposa", "Satsuma"],
    regions: ["Himachal Pradesh", "Punjab", "Uttarakhand", "Jammu & Kashmir"],
  }),

  peach: buildFruit({
    name: "Peach",
    varieties: ["Flordaprince", "Shan-e-Punjab", "Pratap", "July Elberta", "Redhaven"],
    regions: ["Himachal Pradesh", "Punjab", "Uttarakhand", "Jammu & Kashmir"],
  }),

  apricot: buildFruit({
    name: "Apricot",
    varieties: ["New Castle", "Moorpark", "Charmagz", "Halman", "Rakchaikarpo"],
    regions: ["Himachal Pradesh", "Ladakh", "Jammu & Kashmir", "Uttarakhand"],
  }),

  cherry: buildFruit({
    name: "Cherry",
    varieties: ["Sweet Cherry", "Sour Cherry", "Bing", "Rainier", "Lapins"],
    regions: ["Himachal Pradesh", "Jammu & Kashmir", "Uttarakhand"],
  }),

  kiwi: buildFruit({
    name: "Kiwi",
    varieties: ["Hayward", "Allison", "Bruno", "Monty", "Abbott"],
    regions: ["Himachal Pradesh", "Arunachal Pradesh", "Sikkim", "Uttarakhand", "Meghalaya"],
  }),

  pomegranate: buildFruit({
    name: "Pomegranate",
    varieties: ["Bhagwa", "Ganesh", "Arakta", "Mridula", "Ruby"],
    regions: ["Maharashtra", "Karnataka", "Gujarat", "Rajasthan", "Andhra Pradesh"],
  }),

  mango: buildFruit({
    name: "Mango",
    varieties: ["Alphonso", "Dasheri", "Langra", "Kesar", "Totapuri", "Banganapalli", "Chausa", "Safeda"],
    regions: ["Uttar Pradesh", "Maharashtra", "Gujarat", "Andhra Pradesh", "Karnataka", "Bihar", "West Bengal"],
  }),

  banana: buildFruit({
    name: "Banana",
    varieties: ["Grand Naine", "Robusta", "Dwarf Cavendish", "Rasthali", "Nendran", "Red Banana"],
    regions: ["Maharashtra", "Tamil Nadu", "Gujarat", "Andhra Pradesh", "Karnataka", "Kerala"],
  }),

  orange: buildFruit({
    name: "Orange",
    varieties: ["Nagpur Orange", "Kinnow", "Mandarin", "Sweet Orange", "Valencia"],
    regions: ["Maharashtra", "Punjab", "Rajasthan", "Madhya Pradesh", "North East India"],
  }),

  kinnow: buildFruit({
    name: "Kinnow",
    varieties: ["Kinnow Mandarin", "Seedless Kinnow"],
    regions: ["Punjab", "Haryana", "Rajasthan", "Himachal Pradesh"],
  }),

  guava: buildFruit({
    name: "Guava",
    varieties: ["Allahabad Safeda", "Lalit", "Shweta", "Lucknow 49", "Red Guava"],
    regions: ["Uttar Pradesh", "Maharashtra", "Bihar", "Madhya Pradesh", "Punjab"],
  }),

  grapes: buildFruit({
    name: "Grapes",
    varieties: ["Thompson Seedless", "Flame Seedless", "Sonaka", "Sharad Seedless", "Black Grapes"],
    regions: ["Maharashtra", "Karnataka", "Telangana", "Tamil Nadu"],
  }),

  papaya: buildFruit({
    name: "Papaya",
    varieties: ["Red Lady", "Pusa Delicious", "Pusa Nanha", "Coorg Honey Dew", "Taiwan Papaya"],
    regions: ["Maharashtra", "Karnataka", "Andhra Pradesh", "Tamil Nadu", "Gujarat"],
  }),

  watermelon: buildFruit({
    name: "Watermelon",
    varieties: ["Sugar Baby", "Arka Manik", "Kiran", "Black Diamond", "Seedless Watermelon"],
    regions: ["Maharashtra", "Karnataka", "Rajasthan", "Uttar Pradesh", "Andhra Pradesh"],
  }),

  muskmelon: buildFruit({
    name: "Muskmelon",
    varieties: ["Punjab Sunehri", "Hara Madhu", "Pusa Sharbati", "Cantaloupe"],
    regions: ["Punjab", "Haryana", "Rajasthan", "Uttar Pradesh", "Maharashtra"],
  }),

  pineapple: buildFruit({
    name: "Pineapple",
    varieties: ["Queen", "Kew", "Mauritius", "Giant Kew"],
    regions: ["Assam", "Meghalaya", "Tripura", "West Bengal", "Kerala", "Karnataka"],
  }),

  litchi: buildFruit({
    name: "Litchi",
    varieties: ["Shahi", "China", "Bedana", "Bombai", "Rose Scented"],
    regions: ["Bihar", "Uttarakhand", "West Bengal", "Jharkhand", "Uttar Pradesh"],
  }),

  strawberry: buildFruit({
    name: "Strawberry",
    varieties: ["Chandler", "Sweet Charlie", "Camarosa", "Winter Dawn", "Festival"],
    regions: ["Maharashtra", "Himachal Pradesh", "Uttarakhand", "Jammu & Kashmir"],
  }),

  dragonfruit: buildFruit({
    name: "Dragon Fruit",
    varieties: ["Red Flesh", "White Flesh", "Pink Flesh", "Yellow Dragon Fruit"],
    regions: ["Gujarat", "Maharashtra", "Karnataka", "Telangana", "Tamil Nadu"],
  }),

  fig: buildFruit({
    name: "Fig",
    varieties: ["Poona Fig", "Brown Turkey", "Dinkar", "Daulatabad"],
    regions: ["Maharashtra", "Gujarat", "Karnataka", "Tamil Nadu"],
  }),

  jamun: buildFruit({
    name: "Jamun",
    varieties: ["Rajamun", "Goma Priyanka", "Local Jamun"],
    regions: ["Uttar Pradesh", "Maharashtra", "Madhya Pradesh", "Bihar", "West Bengal"],
  }),

  custardapple: buildFruit({
    name: "Custard Apple",
    varieties: ["Balanagar", "Arka Sahan", "Red Sitaphal", "Local Sitaphal"],
    regions: ["Maharashtra", "Gujarat", "Rajasthan", "Madhya Pradesh", "Telangana"],
  }),

  sapota: buildFruit({
    name: "Sapota",
    varieties: ["Kalipatti", "Cricket Ball", "Pala", "CO-1", "CO-2"],
    regions: ["Gujarat", "Maharashtra", "Karnataka", "Tamil Nadu", "Andhra Pradesh"],
  }),

  amla: buildFruit({
    name: "Amla",
    varieties: ["NA-7", "Krishna", "Kanchan", "Chakaiya", "Banarasi"],
    regions: ["Uttar Pradesh", "Rajasthan", "Madhya Pradesh", "Gujarat", "Maharashtra"],
  }),
};

export const fruitLotSlugs = Object.keys(fruitLotsContent);