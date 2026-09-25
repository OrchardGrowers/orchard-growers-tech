const fs = require("node:fs");
const path = require("node:path");
const {
  API_BASE_URL, routes, getPublicProfileMeta, getPublicMandiMeta,
  replaceProfileHeadTags, replaceRootContent, renderFallback,
  renderPublicProfileFallback, renderPublicMandiFallback, renderNotFoundPage,
} = require("../scripts/prerender-seo.cjs");
const { inspectHtml, validateIndexable } = require("../scripts/validate-seo.cjs");

const SITE_URL = "https://www.efruitmandi.live";
const defaultBuildDir = path.join(__dirname, "../build");
const safeSlug = (slug) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
const headers = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "private, no-store, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
};

// Use the same metadata and HTML renderer as prerendering and the lot adapter.
// Resolve changing public data before returning the first byte of the document.
async function getPublicPageResponse(route, {
  fetchImpl = fetch,
  buildDir = defaultBuildDir,
  template = fs.readFileSync(path.join(buildDir, "index.html"), "utf8"),
} = {}) {
  const unavailable = (status = 404) => ({
    status,
    headers: { ...headers, "X-Robots-Tag": "noindex, follow", ...(status === 503 ? { "Retry-After": "60" } : {}) },
    html: renderNotFoundPage(template, { temporary: status === 503 }),
  });
  const render = (meta, content) => ({
    status: 200,
    headers: { ...headers, "X-Robots-Tag": meta.robots === "noindex,follow" ? "noindex, follow" : "index, follow" },
    html: replaceRootContent(replaceProfileHeadTags(template, meta), content),
  });
  const redirect = (destination) => ({ status: 308, headers: { ...headers, Location: destination }, html: "" });
  let url;
  try {
    if (typeof route !== "string" || !route.startsWith("/") || route.startsWith("//")) return unavailable();
    url = new URL(route, SITE_URL);
    if (url.origin !== SITE_URL) return unavailable();
  } catch {
    return unavailable(400);
  }
  const pathname = url.pathname.replace(/\/$/, "");

  if (pathname === "/search") {
    // Reject the literal obsolete SearchAction token, including escaped underscores
    // and a missing closing brace. Never echo it into HTML or structured data.
    const placeholder = url.searchParams.getAll("q").some((query) =>
      /^\{?\s*search_term_string\s*\}?$/i.test(query.replace(/\\/g, "").trim())
    );
    if (placeholder) return unavailable(400);
    const meta = routes.find((entry) => entry.path === "/search");
    return render(meta, renderFallback(meta));
  }

  const fruit = /^\/fruits\/([^/]+)$/.exec(pathname);
  if (fruit) {
    const slug = fruit[1];
    if (!safeSlug(slug)) return unavailable();
    const destination = `/fruit-lots/${slug}`;
    const replacement = routes.find((entry) => entry.path === destination && !entry.noIndex);
    if (!replacement) return unavailable();
    try {
      // A category name alone is not enough: the exact deployed replacement must
      // exist, be indexable and be its own canonical. No destination is /fruits.
      const html = fs.readFileSync(path.join(buildDir, "fruit-lots", slug, "index.html"), "utf8");
      if (validateIndexable({ url: SITE_URL + destination, status: 200, meta: inspectHtml(html) }).length) return unavailable();
      return redirect(destination);
    } catch {
      return unavailable();
    }
  }

  const profile = /^\/(growers|buyers)\/([^/]+)$/.exec(pathname);
  const mandi = /^\/mandi-rates\/([^/]+)$/.exec(pathname);
  if (!profile && !mandi) return unavailable();
  const slug = profile ? profile[2] : mandi[1];
  if (!safeSlug(slug)) return unavailable();
  const role = profile?.[1] === "growers" ? "grower" : "buyer";
  const mandiRoute = mandi && routes.find((entry) => entry.mandiFruit && entry.fruitSlug === slug);
  if (mandi && !mandiRoute) return unavailable();
  const endpoint = profile
    ? `${API_BASE_URL}/user/public-profiles/by-slug/${role}/${encodeURIComponent(slug)}`
    : `${API_BASE_URL}/mandi-rates?commodity=${encodeURIComponent(mandiRoute.fruitName)}`;
  try {
    const response = await fetchImpl(endpoint, {
      headers: { Accept: "application/json" }, cache: "no-store", redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
    if (response.status === 404 || response.status === 410) return unavailable();
    if (!response.ok) return unavailable(503);
    const payload = await response.json();
    if (profile) {
      if (payload?.profile?.role !== role || payload.profile.slug !== slug) return unavailable(503);
      const meta = getPublicProfileMeta(payload.profile, role);
      if (!meta) return unavailable(503);
      return render(meta, renderPublicProfileFallback(meta));
    }
    if (!Array.isArray(payload?.records)) return unavailable(503);
    if (!payload.records.length) return unavailable();
    const meta = getPublicMandiMeta(slug, payload.records);
    if (!meta) return unavailable(503);
    return render(meta, renderPublicMandiFallback(meta));
  } catch {
    // An outage is temporary, and must never become a cacheable missing page.
    return unavailable(503);
  }
}

async function handler(req, res) {
  const route = req.query?.path;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query || {})) {
    if (key === "path") continue;
    for (const item of Array.isArray(value) ? value : [value]) query.append(key, item);
  }
  const result = await getPublicPageResponse(typeof route === "string"
    ? route + (query.size ? `?${query}` : "") : route);
  res.statusCode = result.status;
  for (const [key, value] of Object.entries(result.headers)) res.setHeader(key, value);
  res.end(req.method === "HEAD" ? undefined : result.html);
}

module.exports = handler;
module.exports.getPublicPageResponse = getPublicPageResponse;
