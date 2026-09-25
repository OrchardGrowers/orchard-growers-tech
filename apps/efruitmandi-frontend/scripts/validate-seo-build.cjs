const { readFileSync, existsSync } = require("node:fs");
const { inspectHtml, validateIndexable } = require("./validate-seo.cjs");
const SITE_URL = "https://www.efruitmandi.live";
async function loadDynamicLotPages(sitemapXml, template, options = {}) {
  const { getLotPageResponse } = require("../api/lot.js");
  const pages = new Map();
  for (const match of sitemapXml.matchAll(/<loc>(.*?)<\/loc>/g)) {
    const url = new URL(match[1].replace(/&amp;/g, "&"));
    const lot = /^\/lots\/([^/]+)$/.exec(url.pathname);
    if (url.origin === SITE_URL && lot) pages.set(url.pathname, await getLotPageResponse(lot[1], { template, ...options }));
  }
  return pages;
}
function validateBuild(buildDir, sitemapXml, config, robots, dynamicPages = new Map()) {
  const urls = [...sitemapXml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, "&"));
  if (!urls.length) throw new Error("Empty sitemap");
  const failures = [];
  if (new Set(urls).size !== urls.length) failures.push({ errors: ["Duplicate sitemap URL"] });
  for (const url of urls) {
    const route = new URL(url).pathname;
    const file = require("node:path").join(buildDir, route, "index.html");
    const isLot = /^\/lots\/[^/]+$/.test(route);
    const publicRoute = /^\/(growers|buyers|mandi-rates)\/[^/]+$/.test(route);
    const isDynamic = isLot || publicRoute;
    const dynamic = isDynamic && dynamicPages.get(route);
    const rule = isLot ? ["/lots/:id", "/api/lot?id=:id"] : publicRoute ? {
      growers: ["/growers/:slug", "/api/public-page?path=/growers/:slug"],
      buyers: ["/buyers/:slug", "/api/public-page?path=/buyers/:slug"],
      "mandi-rates": ["/mandi-rates/:commoditySlug", "/api/public-page?path=/mandi-rates/:commoditySlug"],
    }[route.split("/")[1]] : null;
    if (isDynamic && (existsSync(file) || !config.rewrites.some((r) => r.source === rule[0] && r.destination === rule[1]))) failures.push({url, errors:["Public page must use live HTTP handler without a static snapshot"]});
    if (route === "/search" || /^\/fruits\/[^/]+$/.test(route)) failures.push({url, errors:["Search and legacy fruit routes must not be in the sitemap"]});
    const redirect = config.redirects.find((r) => r.source === route);
    const headers = config.headers.filter((r) => {
      try { return new RegExp("^" + r.source + "$").test(route); } catch { return false; }
    }).flatMap((r) => r.headers);
    const result = {
      url, status: redirect ? (redirect.permanent ? 308 : 307) : isDynamic ? (dynamic?.status || 404) : existsSync(file) ? 200 : 404,
      location: redirect?.destination,
      xRobots: [dynamic?.headers?.["X-Robots-Tag"], ...headers.filter((h) => h.key.toLowerCase() === "x-robots-tag").map((h) => h.value)].filter(Boolean).join(","),
      meta: inspectHtml(isDynamic ? dynamic?.html || "" : existsSync(file) ? readFileSync(file, "utf8") : ""),
    };
    const errors = validateIndexable(result, robots);
    if (errors.length) failures.push({url, errors});
  }
  if (failures.length) throw new Error("Prerender/sitemap mismatch:\n" + JSON.stringify(failures, null, 2));
  return urls.length;
}
async function loadDynamicPublicPages(sitemapXml, template, options = {}) {
  const { getPublicPageResponse } = require("../api/public-page.js");
  const pages = await loadDynamicLotPages(sitemapXml, template, options);
  const urls = [...sitemapXml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => new URL(match[1].replace(/&amp;/g, "&")));
  // Bounded parallel lookups keep the build gate practical for large directories.
  let next = 0;
  await Promise.all(Array.from({ length: 5 }, async () => {
    while (next < urls.length) {
      const url = urls[next++];
      if (url.origin === SITE_URL && /^\/(growers|buyers|mandi-rates)\/[^/]+$/.test(url.pathname)) {
        pages.set(url.pathname, await getPublicPageResponse(url.pathname, { template, ...options }));
      }
    }
  }));
  return pages;
}
module.exports = { validateBuild, loadDynamicLotPages, loadDynamicPublicPages };
