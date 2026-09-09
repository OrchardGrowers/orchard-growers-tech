const { readFileSync, existsSync } = require("node:fs");
const { inspectHtml, validateIndexable } = require("./validate-seo.cjs");
const SITE_URL = "https://www.efruitmandi.live";
function validateBuild(buildDir, sitemapXml, config, robots) {
  const urls = [...sitemapXml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, "&"));
  if (!urls.length) throw new Error("Empty sitemap");
  const failures = [];
  for (const url of urls) {
    const route = new URL(url).pathname;
    const file = require("node:path").join(buildDir, route, "index.html");
    const redirect = config.redirects.find((r) => r.source === route);
    const headers = config.headers.filter((r) => {
      try { return new RegExp("^" + r.source + "$").test(route); } catch { return false; }
    }).flatMap((r) => r.headers);
    const result = {
      url, status: redirect ? 308 : existsSync(file) ? 200 : 404,
      location: redirect?.destination,
      xRobots: headers.filter((h) => h.key.toLowerCase() === "x-robots-tag").map((h) => h.value).join(","),
      meta: inspectHtml(existsSync(file) ? readFileSync(file, "utf8") : ""),
    };
    const errors = validateIndexable(result, robots);
    if (errors.length) failures.push({url, errors});
  }
  if (failures.length) throw new Error("Prerender/sitemap mismatch:\n" + JSON.stringify(failures, null, 2));
  return urls.length;
}
module.exports = { validateBuild };
