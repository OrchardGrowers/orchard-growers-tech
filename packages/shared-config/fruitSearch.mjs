const DEFINITIONS = [
  ["Apple", "apple", ["apples", "seb", "सेब"]],
  ["Pear", "pear", ["pears", "nashpati", "नाशपाती"]],
  ["Persimmon", "persimmon", ["persimmons", "japani phal"]],
  ["Plum", "plum", ["plums", "aloo bukhara", "alu bukhara"]],
  ["Peach", "peach", ["peaches", "aadu", "आड़ू"]],
  ["Apricot", "apricot", ["apricots", "khubani", "खुबानी"]],
  ["Cherry", "cherry", ["cherries"]],
  ["Kiwi", "kiwi", ["kiwis", "kiwi fruit"]],
  ["Pomegranate", "pomegranate", ["pomegranates", "anar", "अनार"]],
  ["Mango", "mango", ["mangoes", "aam", "आम"]],
  ["Banana", "banana", ["bananas", "kela", "केला"]],
  ["Orange", "orange", ["oranges", "santra", "संतरा"]],
  ["Kinnow", "kinnow", ["kinnows", "kinnoo", "किन्नू"]],
  ["Guava", "guava", ["guavas", "amrood", "अमरूद"]],
  ["Grapes", "grapes", ["grape", "angoor", "अंगूर"]],
  ["Papaya", "papaya", ["papayas", "papita", "पपीता"]],
  ["Watermelon", "watermelon", ["water melon", "watermelons", "tarbooz", "तरबूज"], ["Watermelon", "Water Melon"]],
  ["Muskmelon", "muskmelon", ["musk melon", "muskmelons", "kharbuja", "खरबूजा"], ["Muskmelon", "Musk Melon"]],
  ["Pineapple", "pineapple", ["pineapples", "ananas", "अनानास"]],
  ["Litchi", "litchi", ["lychee", "lichi", "लीची"]],
  ["Strawberry", "strawberry", ["strawberries"]],
  ["Dragon Fruit", "dragonfruit", ["dragon fruit", "dragon-fruit", "pitaya"], ["Dragon Fruit", "Dragonfruit"]],
  ["Fig", "fig", ["figs", "anjeer", "अंजीर"]],
  ["Jamun", "jamun", ["java plum", "black plum", "जामुन"]],
  ["Custard Apple", "custardapple", ["custard apple", "sitaphal", "sharifa", "सीताफल"], ["Custard Apple", "Custardapple", "Sitaphal", "Seetaphal"]],
  ["Sapota", "sapota", ["sapodilla", "chikoo", "chiku", "चीकू"]],
  ["Amla", "amla", ["indian gooseberry", "gooseberry", "आंवला"]],
];

export const FRUIT_ENTITIES = Object.freeze(
  DEFINITIONS.map(([name, slug, aliases, commodityAliases = [name]]) =>
    Object.freeze({
      name,
      slug,
      normalizedName: normalizeSearchText(name),
      aliases: Object.freeze([...new Set([name, slug, ...aliases].map(normalizeSearchText))]),
      commodityAliases: Object.freeze(
        commodityAliases.filter(
          (alias, index, values) =>
            values.findIndex(
              (candidate) => normalizeSearchText(candidate) === normalizeSearchText(alias)
            ) === index
        )
      ),
    })
  )
);

const INTENT_PATTERNS = Object.freeze({
  mandi_price: [
    "market price", "mandi price", "mandi rate", "apmc price", "apmc rate",
    "today price", "today rate", "live rate", "wholesale price", "wholesale rate",
    "mandi bhav", "mandi bhaav", "aaj ka rate", "aaj ka bhav", "aaj ka bhaav",
    "price", "prices", "rate", "rates", "apmc", "bhav", "bhaav",
    "मंडी भाव", "आज का भाव", "कीमत", "रेट",
  ],
  fruit_lot: ["fruit lot", "fruit lots", "live lot", "live lots", "buy lot", "buy fruit lot", "buy", "auction"],
  grower: ["grower", "growers", "farmer", "farmers", "producer", "producers"],
  buyer: ["buyer", "buyers", "trader", "traders", "wholesaler", "wholesalers"],
  informational: ["guide", "guides", "grading", "packing", "how to", "information", "blog"],
});

export function normalizeSearchText(value = "") {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("en-IN")
    .replace(/[_-]+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasPhrase(text, phrase) {
  const normalizedPhrase = normalizeSearchText(phrase);
  if (!normalizedPhrase) return false;
  return ` ${text} `.includes(` ${normalizedPhrase} `);
}

export function classifySearchIntent(query = "") {
  const normalizedQuery = normalizeSearchText(query);
  for (const intent of ["mandi_price", "fruit_lot", "grower", "buyer", "informational"]) {
    if (INTENT_PATTERNS[intent].some((phrase) => hasPhrase(normalizedQuery, phrase))) return intent;
  }
  return "general";
}

export function findFruitEntity(query = "") {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return null;

  const matches = FRUIT_ENTITIES.flatMap((fruit) =>
    fruit.aliases
      .filter((alias) => hasPhrase(normalizedQuery, alias))
      .map((alias) => ({ fruit, alias, exact: normalizedQuery === alias }))
  ).sort((a, b) => Number(b.exact) - Number(a.exact) || b.alias.length - a.alias.length);

  return matches[0]?.fruit || null;
}

export function getFruitCommodityAliases(fruitOrSlug = "") {
  const fruit =
    fruitOrSlug && typeof fruitOrSlug === "object" && fruitOrSlug.slug
      ? fruitOrSlug
      : findFruitEntity(fruitOrSlug);
  if (!fruit) return [];

  return [...new Map(
    [fruit.name, ...(fruit.commodityAliases || [])]
      .map((alias) => String(alias || "").trim())
      .filter(Boolean)
      .map((alias) => [normalizeSearchText(alias), alias])
  ).values()];
}

export function findFruitByCommodityName(commodity = "") {
  const normalizedCommodity = normalizeSearchText(commodity);
  if (!normalizedCommodity) return null;
  return (
    FRUIT_ENTITIES.find((fruit) =>
      getFruitCommodityAliases(fruit).some(
        (alias) => normalizeSearchText(alias) === normalizedCommodity
      )
    ) || null
  );
}

export function getDataBackedMandiSlugs(commodities = []) {
  const available = new Set(
    (Array.isArray(commodities) ? commodities : [])
      .map(findFruitByCommodityName)
      .filter(Boolean)
      .map((fruit) => fruit.slug)
  );
  return FRUIT_ENTITIES.filter((fruit) => available.has(fruit.slug)).map(
    (fruit) => fruit.slug
  );
}

export function getMandiPageRobots({
  isFruitPage = false,
  loading = false,
  recordCount = 0,
} = {}) {
  if (!isFruitPage) return "index,follow";
  return !loading && Number(recordCount) > 0 ? "index,follow" : "noindex,follow";
}

export function getSearchContext(query = "") {
  const normalizedQuery = normalizeSearchText(query);
  const fruit = findFruitEntity(normalizedQuery);
  const intent = classifySearchIntent(normalizedQuery);
  const intentPhrases = Object.values(INTENT_PATTERNS).flat().sort((a, b) => b.length - a.length);
  let subjectQuery = normalizedQuery;
  for (const phrase of intentPhrases) {
    const normalizedPhrase = normalizeSearchText(phrase);
    subjectQuery = ` ${subjectQuery} `.replace(` ${normalizedPhrase} `, " ").trim();
  }
  subjectQuery = subjectQuery.replace(/\b(ka|ki|ke|today|live)\b/gi, " ").replace(/\s+/g, " ").trim();

  return { query: normalizedQuery, subjectQuery: subjectQuery || fruit?.normalizedName || normalizedQuery, fruit, intent };
}

export function scoreSearchResult(result = {}, contextOrQuery = "") {
  const context = typeof contextOrQuery === "string" ? getSearchContext(contextOrQuery) : contextOrQuery;
  const title = normalizeSearchText(result.title || result.name || result.fruitName || result.commodity);
  const slug = normalizeSearchText(result.slug || "");
  const haystack = normalizeSearchText([
    title, result.fruitName, result.commodity, result.variety, result.description,
    result.location, result.market, result.district, result.state,
  ].filter(Boolean).join(" "));
  const fruit = context.fruit;
  const resultType = normalizeSearchText(result.resultType || result.category || result.type).replace(/\s/g, "_");
  let score = 0;
  let matchType = "none";

  if (fruit) {
    if (title === fruit.normalizedName) { score = 1000; matchType = "exact_fruit_name"; }
    else if (fruit.aliases.includes(title)) { score = 980; matchType = "exact_fruit_alias"; }
    else if (slug === fruit.slug) { score = 960; matchType = "exact_fruit_slug"; }
    else if (fruit.aliases.some((alias) => hasPhrase(title, alias))) { score = 800; matchType = "whole_word"; }
    else if (fruit.aliases.some((alias) => title.startsWith(alias))) { score = 720; matchType = "prefix"; }
    else if (fruit.aliases.some((alias) => hasPhrase(haystack, alias))) { score = 620; matchType = "token"; }
    else if (fruit.aliases.some((alias) => haystack.includes(alias))) { score = 120; matchType = "partial"; }
  } else if (title === context.query) {
    score = 900;
    matchType = "exact_title";
  } else if (hasPhrase(title, context.subjectQuery)) {
    score = 650;
    matchType = "whole_word";
  } else if (haystack.includes(context.subjectQuery)) {
    score = 150;
    matchType = "partial";
  }

  const typeBoosts = context.intent === "mandi_price"
    ? { mandi_rate: 600, fruit_lot: 180, fruit: 150, grower: 80, buyer: 70, guide: 20, blog: 10 }
    : context.intent === "fruit_lot"
      ? { fruit_lot: 500, fruit: 250, mandi_rate: 150 }
      : context.intent === "grower"
        ? { grower: 500, fruit_lot: 100 }
        : context.intent === "buyer"
          ? { buyer: 500, fruit_lot: 100 }
          : { fruit: 500, fruit_lot: 350, mandi_rate: 250, grower: 150, buyer: 140, guide: 80, blog: 60 };

  score += typeBoosts[resultType] || 0;
  if (result.isDirectResult) score += 300;
  return { score, matchType };
}

export function rankSearchResults(results = [], query = "") {
  const context = typeof query === "string" ? getSearchContext(query) : query;
  return results
    .map((result, index) => {
      const { score, matchType } = scoreSearchResult(result, context);
      return {
        ...result,
        relevanceScore: score,
        matchType,
        matchedFruit: context.fruit?.name || null,
        matchedIntent: context.intent,
        __searchIndex: index,
      };
    })
    .sort((a, b) => b.relevanceScore - a.relevanceScore || a.__searchIndex - b.__searchIndex)
    .map(({ __searchIndex, ...result }) => result);
}

export function fruitPathSlug(value = "") {
  const entity = findFruitEntity(value);
  return entity?.slug || normalizeSearchText(value).replace(/\s+/g, "");
}
