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
  for (const url of urls) {
    const route = new URL(url).pathname;
    const file = require("node:path").join(buildDir, route, "index.html");
    const isLot = /^\/lots\/[^/]+$/.test(route);
    const dynamic = isLot && dynamicPages.get(route);
    if (isLot && (existsSync(file) || !config.rewrites.some((r) => r.source === "/lots/:id" && r.destination === "/api/lot?id=:id"))) failures.push({url, errors:["Lot must use live HTTP handler without a static snapshot"]});
    const redirect = config.redirects.find((r) => r.source === route);
    const headers = config.headers.filter((r) => {
      try { return new RegExp("^" + r.source + "$").test(route); } catch { return false; }
    }).flatMap((r) => r.headers);
    const result = {
      url, status: redirect ? (redirect.permanent ? 308 : 307) : isLot ? (dynamic?.status || 404) : existsSync(file) ? 200 : 404,
      location: redirect?.destination,
      xRobots: [dynamic?.headers?.["X-Robots-Tag"], ...headers.filter((h) => h.key.toLowerCase() === "x-robots-tag").map((h) => h.value)].filter(Boolean).join(","),
      meta: inspectHtml(isLot ? dynamic?.html || "" : existsSync(file) ? readFileSync(file, "utf8") : ""),
    };
    const errors = validateIndexable(result, robots);
    if (errors.length) failures.push({url, errors});
  }
  if (failures.length) throw new Error("Prerender/sitemap mismatch:\n" + JSON.stringify(failures, null, 2));
  return urls.length;
}
module.exports = { validateBuild, loadDynamicLotPages };
