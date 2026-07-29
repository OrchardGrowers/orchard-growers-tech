import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  buildExactCommodityMatchers,
  getCommodityFilterValues,
} from "./mandiRates.js";
import { buildMandiRateSitemapEntries } from "./sitemapRoutes.js";

describe("mandi-rate commodity aliases and sitemap indexing", () => {
  const categories = [
    {
      commodity: "Water Melon",
      displayName: "Water Melon",
      aliases: [],
    },
    {
      commodity: "Musk Melon",
      displayName: "Musk Melon",
      aliases: [],
    },
  ];

  it("matches Watermelon to the exact Water Melon commodity aliases", () => {
    const values = getCommodityFilterValues(categories, "Watermelon");
    expect(values).toEqual(["Watermelon", "Water Melon"]);

    const matchers = buildExactCommodityMatchers(values);
    expect(matchers.some((matcher) => matcher.test("Water Melon"))).toBe(true);
    expect(matchers.some((matcher) => matcher.test("Watermelon"))).toBe(true);
    expect(matchers.some((matcher) => matcher.test("Bitter Melon"))).toBe(false);
    expect(matchers.some((matcher) => matcher.test("Water Melon Seeds"))).toBe(false);
  });

  it("includes only data-backed fruit routes while preserving the mandi index", () => {
    const entries = buildMandiRateSitemapEntries(["apple", "watermelon"]);
    expect(entries.map((entry) => entry.loc)).toEqual([
      "/mandi-rates",
      "/mandi-rates/apple",
      "/mandi-rates/watermelon",
    ]);
    expect(entries.some((entry) => entry.loc === "/mandi-rates/pear")).toBe(false);
  });

  it("keeps existing public profile sitemap sources intact", () => {
    const source = readFileSync(new URL("./sitemapRoutes.js", import.meta.url), "utf8");
    expect(source).toContain('{ loc: "/growers"');
    expect(source).toContain('{ loc: "/buyers"');
    expect(source).toContain("growerProfiles");
    expect(source).toContain("buyerProfiles");
  });
});
