const fs = require("node:fs");
const path = require("node:path");
const SITE_URL = "https://www.efruitmandi.live";
const decode = (s = "") => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
function attributes(tag) {
  return Object.fromEntries([...tag.matchAll(/([a-z:-]+)\s*=\s*["']([^"']*)["']/gi)].map((m) => [m[1].toLowerCase(), decode(m[2])]));
}
function inspectHtml(html = "") {
  const metas = [...html.matchAll(/<meta\b[^>]*>/gi)].map((m) => attributes(m[0]));
  return {
    robotsCount: metas.filter((m) => m.name?.toLowerCase() === "robots").length,
    googlebotCount: metas.filter((m) => m.name?.toLowerCase() === "googlebot").length,
    titleCount: [...html.matchAll(/<title\b[^>]*>/gi)].length,
    descriptionCount: metas.filter((m) => m.name?.toLowerCase() === "description").length,
    robots: metas.filter((m) => ["robots", "googlebot"].includes(m.name?.toLowerCase())).map((m) => m.content),
    canonical: [...html.matchAll(/<link\b[^>]*>/gi)].map((m) => attributes(m[0])).filter((a) => a.rel === "canonical").map((a) => a.href),
    title: decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").trim(),
    description: metas.find((m) => m.name === "description")?.content || "",
    h1: [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => decode(m[1].replace(/<[^>]+>/g, "")).trim()),
    placeholder: /search(?:\\?_term)(?:\\?_string)|"@type"\s*:\s*"SearchAction"/.test(html),
  };
}
function robotsBlocked(url, robots) {
  // Longest-match allow/disallow rules for the site's * and Googlebot groups.
  let agents = [], rules = [], inRules = false;
  for (const raw of robots.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    const match = /^(user-agent|allow|disallow):\s*(.*)$/i.exec(line);
    if (!match) continue;
    const key = match[1].toLowerCase(), value = match[2].trim();
    if (key === "user-agent") {
      if (inRules) { agents = []; inRules = false; }
      agents.push(value.toLowerCase());
    } else {
      inRules = true;
      if (value && (agents.includes("*") || agents.includes("googlebot"))) rules.push({ allow: key === "allow", value });
    }
  }
  const route = new URL(url).pathname + new URL(url).search;
  const matches = rules.filter(({value}) => {
    const expression = value.split("*").map((p) => p.replace(/[.+?^{}()|[\]\\]/g, "\\$&")).join(".*");
    return new RegExp("^" + expression).test(route);
  }).sort((a, b) => b.value.length - a.value.length || Number(b.allow) - Number(a.allow));
  return matches.length ? !matches[0].allow : false;
}
function validateIndexable(result, robots = "") {
  const errors = [], url = result.url, meta = result.meta || inspectHtml(result.html);
  if (result.status !== 200) errors.push("HTTP " + result.status);
  if (result.location) errors.push("redirect: " + result.location);
  if (robotsBlocked(url, robots)) errors.push("robots.txt blocked");
  if (/\bnoindex\b|\bnone\b/i.test([...(meta.robots || []), result.xRobots || ""].join(","))) errors.push("noindex");
  if (!meta.robots.some((r) => r.replace(/\s/g, "").toLowerCase() === "index,follow")) errors.push("missing index,follow");
  if (meta.robotsCount !== 1 || meta.googlebotCount > 1) errors.push("duplicate or missing robots meta");
  if (meta.titleCount !== 1 || meta.descriptionCount !== 1) errors.push("duplicate or missing title/description");
  if (meta.canonical.length !== 1 || meta.canonical[0] !== url) errors.push("conflicting canonical");
  if (!meta.title || !meta.description || !meta.h1.length) errors.push("missing initial metadata/H1");
  if (url !== SITE_URL + "/" && /eFruitMandi - (Fruit Buyers|Fresh Fruit Marketplace)/.test(meta.title)) errors.push("homepage title fallback");
  if (meta.placeholder) errors.push("search placeholder");
  if (new URL(url).origin !== SITE_URL || new URL(url).search) errors.push("noncanonical sitemap URL");
  return errors;
}
async function fetchPage(url) {
  const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(30000) });
  const html = await response.text();
  return { url, status: response.status, location: response.headers.get("location"), xRobots: response.headers.get("x-robots-tag"), meta: inspectHtml(html) };
}
async function audit({ origin = SITE_URL, output } = {}) {
  const robotsResponse = await fetch(origin + "/robots.txt");
  if (!robotsResponse.ok) throw new Error("robots.txt HTTP " + robotsResponse.status);
  const robots = await robotsResponse.text();
  const sitemapResponse = await fetch(origin + "/sitemap.xml");
  if (!sitemapResponse.ok) throw new Error("sitemap HTTP " + sitemapResponse.status);
  const xml = await sitemapResponse.text();
  const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => decode(m[1]));
  if (!urls.length) throw new Error("Empty sitemap");
  const reported = ["/fruits/avocado", "/fruits/orange", "/fruits/guava", "/fruits/pear", "/growers/bharat-fruit-farm", "/buyers/chatrapati-fruit-shop", "/mandi-rates/apple", "/mandi-rates/pear", "/mandi-rates", "/buyer-guide", "/contact", "/contact-us", "/search", "/search?q={search_term_string}", "/register-buyer", "/profile-dashboard", "/notifications", "/fruit-buyers/apple", "/fruit-growers", "/lots/not-a-real-lot", "/growers/not-a-real-profile", "/buyers/not-a-real-profile", "/fruits/not-a-real-fruit", "/fruits/apple/varieties/not-a-real-variety", "/mandi-rates/not-a-real-fruit"];
  const queue = [...new Set([...urls, ...reported.map((p) => SITE_URL + p), "http://efruitmandi.live/", "http://www.efruitmandi.live/", "https://efruitmandi.live/", "https://api.efruitmandi.live/", "https://api.efruitmandi.live/robots.txt"])], rows = [];
  let next = 0;
  await Promise.all(Array.from({length: 5}, async () => {
    while (next < queue.length) {
      const url = queue[next++];
      try {
        const row = await fetchPage(url.startsWith(SITE_URL) ? origin + url.slice(SITE_URL.length) : url);
        row.url = url;
        row.inSitemap = urls.includes(url);
        row.robotsBlocked = robotsBlocked(url, robots);
        row.errors = row.inSitemap ? validateIndexable(row, robots) : [];
        rows.push(row);
      } catch (error) { rows.push({ url, inSitemap: urls.includes(url), errors: [error.message] }); }
    }
  }));
  rows.sort((a,b) => a.url.localeCompare(b.url));
  const result = { auditedAt: new Date().toISOString(), origin, sitemapCount: urls.length, failures: rows.filter((r) => r.errors.length), rows };
  if (output) fs.writeFileSync(path.resolve(output), JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify({ sitemapCount: urls.length, failures: result.failures }, null, 2));
  return result;
}
module.exports = { inspectHtml, robotsBlocked, validateIndexable, fetchPage, audit };
if (require.main === module) {
  const args = process.argv.slice(2);
  audit({ origin: args.includes("--origin") ? args[args.indexOf("--origin") + 1] : SITE_URL, output: args.includes("--output") ? args[args.indexOf("--output") + 1] : undefined })
    .then((r) => { if (r.failures.length) process.exitCode = 1; })
    .catch((e) => { console.error(e); process.exitCode = 1; });
}
