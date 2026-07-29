const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

async function main() {
  const utilityUrl = pathToFileURL(
    path.resolve(__dirname, "../../../packages/shared-config/fruitSearch.mjs")
  ).href;
  const {
    FRUIT_ENTITIES,
    classifySearchIntent,
    findFruitEntity,
    findFruitByCommodityName,
    getDataBackedMandiSlugs,
    getFruitCommodityAliases,
    getMandiPageRobots,
    rankSearchResults,
  } = await import(utilityUrl);

  const catalog = FRUIT_ENTITIES.flatMap((fruit) => [
    {
      _id: `fruit-${fruit.slug}`,
      title: fruit.name,
      slug: fruit.slug,
      url: `/fruit-lots/${fruit.slug}`,
      resultType: "fruit",
    },
    {
      _id: `lot-${fruit.slug}`,
      title: `${fruit.name} Fruit Lots`,
      fruitName: fruit.name,
      url: `/fruit-lots/${fruit.slug}`,
      resultType: "fruit_lot",
    },
    {
      _id: `mandi-${fruit.slug}`,
      title: `${fruit.name} Mandi Price Today`,
      commodity: fruit.name,
      url: `/mandi-rates/${fruit.slug}`,
      resultType: "mandi_rate",
      isDirectResult: true,
    },
  ]);

  const top = (query) => rankSearchResults(catalog, query)[0];
  const expectTopTitle = (query, expected) =>
    assert.equal(top(query).title, expected, `${query} should rank ${expected} first`);
  const expectTopUrl = (query, expected) =>
    assert.equal(top(query).url, expected, `${query} should rank ${expected} first`);

  for (const fruit of FRUIT_ENTITIES) {
    expectTopTitle(fruit.name, fruit.name);
    expectTopUrl(`${fruit.name} price`, `/mandi-rates/${fruit.slug}`);
  }

  ["apple", "mango", "pear", "orange", "pineapple"].forEach((query) =>
    expectTopTitle(query, findFruitEntity(query).name)
  );

  [
    ["apple price", "/mandi-rates/apple"],
    ["mango rate", "/mandi-rates/mango"],
    ["banana mandi bhav", "/mandi-rates/banana"],
    ["pear apmc price", "/mandi-rates/pear"],
    ["kinnow today rate", "/mandi-rates/kinnow"],
    ["seb mandi bhav", "/mandi-rates/apple"],
    ["aam ka bhav", "/mandi-rates/mango"],
    ["kela rate", "/mandi-rates/banana"],
    ["watermelon price", "/mandi-rates/watermelon"],
    ["सेब मंडी भाव", "/mandi-rates/apple"],
  ].forEach(([query, url]) => expectTopUrl(query, url));

  assert.equal(classifySearchIntent("apple growers"), "grower");
  assert.equal(classifySearchIntent("apple buyers"), "buyer");
  assert.equal(classifySearchIntent("buy apple lot"), "fruit_lot");
  assert.equal(classifySearchIntent("apple grading guide"), "informational");
  assert.equal(top("apple").title, "Apple");
  assert.notEqual(top("apple").title, "Pineapple");
  assert.equal(top("plum").title, "Plum");
  assert.equal(top("fig").title, "Fig");
  assert.equal(top("orange").title, "Orange");

  assert.deepEqual(getFruitCommodityAliases("watermelon"), ["Watermelon", "Water Melon"]);
  assert.deepEqual(getFruitCommodityAliases("muskmelon"), ["Muskmelon", "Musk Melon"]);
  assert.equal(findFruitByCommodityName("Water Melon")?.slug, "watermelon");
  assert.equal(findFruitByCommodityName("Bitter Melon"), null);
  assert.deepEqual(
    getDataBackedMandiSlugs(["Apple", "Water Melon", "Bitter Melon"]),
    ["apple", "watermelon"]
  );
  assert.equal(
    getMandiPageRobots({ isFruitPage: true, loading: false, recordCount: 1 }),
    "index,follow"
  );
  assert.equal(
    getMandiPageRobots({ isFruitPage: true, loading: false, recordCount: 0 }),
    "noindex,follow"
  );
  assert.equal(
    getMandiPageRobots({ isFruitPage: true, loading: true, recordCount: 0 }),
    "noindex,follow"
  );
  assert.equal(
    getMandiPageRobots({ isFruitPage: false, loading: false, recordCount: 0 }),
    "index,follow"
  );

  const noDataResult = {
    _id: "mandi-page-apple",
    title: "Apple Mandi Price Today",
    commodity: "Apple",
    url: "/mandi-rates/apple",
    price: "No live rate available",
    resultType: "mandi_rate",
    isDirectResult: true,
  };
  const noDataTop = rankSearchResults([noDataResult, ...catalog], "apple price")[0];
  assert.equal(noDataTop.url, "/mandi-rates/apple");
  assert.equal(noDataTop.price, "No live rate available");

  console.log(
    `Fruit search ranking verification passed: ${FRUIT_ENTITIES.length} fruits, exact matches, price intents, aliases, collision checks, and no-data behavior.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
