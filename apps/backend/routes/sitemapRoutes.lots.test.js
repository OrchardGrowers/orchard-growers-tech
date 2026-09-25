import { afterEach, expect, it, vi } from "vitest";
import express from "express";
import { once } from "node:events";
import User from "../models/User.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import * as users from "../controllers/userController.js";
import * as mandi from "../services/mandiRateService.js";
import router from "./sitemapRoutes.js";

const query = (rows) => ({select(){return this;},sort(){return this;},limit(){return this;},lean:async()=>rows});
afterEach(()=>vi.restoreAllMocks());
it("the existing sitemap excludes deleted, unavailable and nonexistent lots and delivery", async () => {
  const available={_id:"6a0000000000000000000001",createdSource:"grower",inventoryType:"finished_product",status:"AVAILABLE",active:true};
  const deleted={...available,_id:"6a0000000000000000000002",status:"DELETED",active:false};
  const privateLot={...available,_id:"6a0000000000000000000003",inventoryType:"raw_material"};
  vi.spyOn(User,"find").mockImplementation(()=>query([]));
  vi.spyOn(Product,"find").mockImplementation(()=>query([available,deleted,privateLot]));
  vi.spyOn(Order,"find").mockImplementation(()=>query([]));
  vi.spyOn(users,"buildPublicFruitDiscovery").mockResolvedValue({fruits:[]});
  vi.spyOn(mandi,"getAvailableMandiFruitSlugs").mockResolvedValue(["mango"]);
  const res={header:vi.fn().mockReturnThis(),send:vi.fn(),status:vi.fn().mockReturnThis(),type:vi.fn().mockReturnThis()};
  await router.stack.find((layer)=>layer.route?.path==="/sitemap.xml").route.stack[0].handle({},res);
  expect(res.status).not.toHaveBeenCalled();
  const xml=res.send.mock.calls[0][0];
  expect(xml).toContain(`/lots/${available._id}`);
  for (const id of [deleted._id,privateLot._id,"6a1a888824c3a406bc961a3a"]) expect(xml).not.toContain(`/lots/${id}`);
  expect(xml).not.toContain("/delivery");
  expect(xml).toContain("/mandi-rates/mango");
});

it("serves canonical sitemap XML without search, redirected fruit overviews, or unavailable routes", async () => {
  const grower = { slug: "public-grower", kycByRole: {}, updatedAt: "2026-09-22T00:00:00Z" };
  const buyer = { slug: "public-buyer", kycByRole: {} };
  vi.spyOn(User, "find")
    .mockImplementationOnce(() => query([grower, grower, { slug: "{search_term_string}" }]))
    .mockImplementationOnce(() => query([buyer]));
  vi.spyOn(Product, "find").mockImplementation(() => query([]));
  vi.spyOn(mandi, "getAvailableMandiFruitSlugs").mockResolvedValue(["guava", "pear", "pear", "avocado"]);
  const fruit = (slug, overrides = {}) => ({
    slug, lotCount: 1, growerCount: 0, buyerCount: 0, growers: [], buyers: [], varieties: [], ...overrides,
  });
  vi.spyOn(users, "buildPublicFruitDiscovery").mockResolvedValue({ fruits: [
    fruit("guava", {
      growerCount: 2, growers: [grower, { ...grower, slug: "second-grower" }],
      varieties: [
        { slug: "allahabad-safeda", lotCount: 2, growerCount: 0, buyerCount: 0 },
        { slug: "unavailable", lotCount: 1, growerCount: 0, buyerCount: 0 },
        { slug: "{search_term_string}", lotCount: 2, growerCount: 0, buyerCount: 0 },
      ],
    }),
    fruit("pear"), fruit("avocado", {
      growerCount: 2, growers: [grower, { ...grower, slug: "second-grower" }],
    }), fruit("{search_term_string}", { growerCount: 2 }),
  ] });

  const app = express();
  app.use(router);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/sitemap.xml`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toMatch(/^application\/xml/);
    const xml = await response.text();
    const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
    const paths = urls.map((url) => new URL(url).pathname);
    expect(urls.length).toBe(new Set(urls).size);
    expect(urls.every((url) => {
      const parsed = new URL(url);
      return parsed.origin === "https://www.efruitmandi.live" && !parsed.search && !parsed.hash;
    })).toBe(true);
    for (const path of [
      "/fruit-lots/guava", "/fruit-lots/pear", "/growers/public-grower", "/buyers/public-buyer",
      "/mandi-rates/guava", "/mandi-rates/pear", "/fruits/guava/growers", "/fruits/guava/varieties/allahabad-safeda",
      "/fruits", "/fruits/avocado/growers",
    ]) expect(paths).toContain(path);
    for (const path of [
      "/fruits/guava", "/fruits/pear", "/fruits/avocado", "/fruit-lots/avocado",
      "/mandi-rates/avocado", "/fruits/guava/varieties/unavailable", "/search", "/404",
      "/contact", "/delivery", "/fruit-growers", "/fruit-buyers/apple",
    ]) expect(paths).not.toContain(path);
    expect(paths.some((path) => /^\/fruits\/[^/]+$/.test(path))).toBe(false);
    expect(xml).not.toMatch(/search_term_string|[{}]|\/search(?:[/?<]|$)/);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
