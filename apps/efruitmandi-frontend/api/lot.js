const fs = require("node:fs");
const path = require("node:path");
const {
  API_BASE_URL, getPublicLotMeta, replaceProfileHeadTags,
  replaceRootContent, renderPublicLotFallback, renderNotFoundPage,
} = require("../scripts/prerender-seo.cjs");

const readTemplate = () => fs.readFileSync(path.join(__dirname, "../build/index.html"), "utf8");

// HTTP adapter for the existing renderer. An anonymous API lookup, rather than
// a build-time snapshot, determines whether this lot is still public.
async function getLotPageResponse(id, { fetchImpl = fetch, template = readTemplate() } = {}) {
  const headers = {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "private, no-store, max-age=0",
    "CDN-Cache-Control": "no-store",
    "Vercel-CDN-Cache-Control": "no-store",
  };
  const unavailable = (status = 404) => ({
    status,
    headers: { ...headers, "X-Robots-Tag": "noindex, follow", ...(status === 503 ? { "Retry-After": "60" } : {}) },
    html: renderNotFoundPage(template, { lot: true, temporary: status === 503 }),
  });
  if (typeof id !== "string" || !/^[a-f0-9]{24}$/i.test(id)) return unavailable();
  try {
    const response = await fetchImpl(`${API_BASE_URL}/products/${id}?platform=efruitmandi`, {
      headers: { Accept: "application/json" }, cache: "no-store", redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
    // The public API does not expose deletion records: preserve its 404 contract.
    if (response.status === 404 || response.status === 410) return unavailable();
    if (!response.ok) return unavailable(503);
    const payload = await response.json();
    const meta = getPublicLotMeta(payload?.product);
    if (!meta) return unavailable(503);
    // Preserve existing legacy auction-ID lookups and React's self canonical.
    meta.path = `/lots/${id}`;
    return {
      status: 200,
      headers: { ...headers, "X-Robots-Tag": "index, follow" },
      html: replaceRootContent(replaceProfileHeadTags(template, { ...meta, schemas: [] }), renderPublicLotFallback(meta)),
    };
  } catch {
    // A temporary API failure is not evidence of deletion.
    return unavailable(503);
  }
}

async function handler(req, res) {
  const result = await getLotPageResponse(req.query?.id);
  res.statusCode = result.status;
  for (const [key, value] of Object.entries(result.headers)) res.setHeader(key, value);
  res.end(req.method === "HEAD" ? undefined : result.html);
}
module.exports = handler;
module.exports.getLotPageResponse = getLotPageResponse;
