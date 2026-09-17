# Lot HTTP status and SEO correction

Implemented locally on 2026-09-17. Not deployed, committed or pushed.

## Findings and request flow

The live audit of the four reported IDs found HTTP 404 already, but generic `Page Not Found | eFruitMandi` HTML. The public product API also returned 404 for all four. This does not establish when Google last crawled them or prove the historical Search Console response was identical. Live `/delivery` still returned 200 with a self canonical and noindex,nofollow while robots.txt blocked crawling. Live Mango returned 200 with index,follow and the correct canonical.

Before this change, Vercel served build-time `/lots/:id/index.html` snapshots. Static files take precedence over rewrites, so an old successful snapshot could outlive its product. Missing snapshots fell through to generic 404 HTML. That document booted React, whose LotDetails loading branch introduced `Fresh Fruit Lot Details`, a self canonical and noindex,nofollow before the API completed. The indefinite client lot cache could also retain deleted records during later SPA visits.

The request flow now is:

1. Vercel rewrites `/lots/:id` to the single `api/lot.js` HTTP adapter. The existing SPA fallback continues to exclude lot detail documents and now also excludes API paths.
2. The adapter validates the complete ID and makes an anonymous request to the existing `/api/products/:id?platform=efruitmandi` endpoint. It does not forward authentication, cookies or user-controlled upstream URLs.
3. Backend `server.js` mounts productRoutes, whose existing `getProductById` supports product and legacy auction IDs. Existing eligibility and public visibility services decide access. Deleted tombstones remain indistinguishable from missing records in the public API, so both use 404, not 410. No database or API contract change was made.
4. The adapter reuses the existing prerender metadata and HTML renderers: public lot 200; missing/malformed/deleted lot 404; upstream outage or malformed successful payload 503 with Retry-After. Lot responses prohibit browser/CDN caching. GET and HEAD preserve status.
5. Successful HTML boots the existing React route and preserves server metadata while loading. Definitive error HTML contains no executable scripts, has the exact lot-not-found title and heading, no canonical, noindex,follow and a marketplace link. React navigation to a missing lot also removes its canonical and offers that link. Lot detail visits revalidate the API instead of using the indefinite cache.
6. The existing prerender process continues for other pages, including Mango. It no longer creates lot or delivery documents and refuses stale output directories. Existing build validation checks sitemap lot URLs through the same live handler.
7. The existing backend sitemap retains its eligibility filtering; only a no-store response header was added. The service worker already uses network-first document requests without HTML caching and needed no change.

Hosting precedence reference: [Vercel project configuration](https://vercel.com/docs/project-configuration/vercel-json).

## Delivery

Vercel temporarily redirects document requests from `/delivery` to `/profile?from=/delivery` with HTTP 307. Authentication currently lives in localStorage, unavailable to the hosting layer. The existing profile page therefore resumes delivery through client navigation for users with a token, or remembers that destination for login. Query redirects are restricted to this exact local path; arbitrary external destinations are ignored. Existing route-state destinations retain precedence.

The chosen deindexing mechanism is a crawlable server redirect. `/delivery` is removed from robots.txt disallows and from static prerender generation, remains absent from the sitemap/public SEO navigation, and uses no-store. The authenticated SPA delivery screen has no canonical and noindex,follow. No authentication or delivery API rules changed.

## Verification

- Existing SEO/HTTP suite: 28 passed.
- Frontend Helmet/loading metadata and profile redirect tests: 18 passed.
- Backend public access/history, mandi SEO and actual sitemap route tests: 29 passed.
- Production Vite build passed. Existing plugin deprecations, mixed dynamic/static imports and large bundle warnings remain.
- Existing prerender/build validation passed against all 110 live sitemap URLs. One invalid buyer profile was skipped by the existing profile validator.
- Syntax checks for the adapter, prerender, build validator and backend sitemap passed; git diff whitespace check passed.
- Additional built-template handler checks passed for GET/HEAD with 200 and 404. Built output has no lots or delivery directories.

| Case | Tested status | Metadata |
| --- | --- | --- |
| Public fixture lot | 200 | Actual Alphonso Mango title/content, index,follow, one self canonical |
| Each of four reported missing IDs | 404 | Fruit Lot Not Found title/H1, noindex,follow, no canonical, marketplace link |
| Malformed ID | 404 | Same definitive not-found document |
| Permanently deleted fixture | 404 | Same definitive not-found document |
| Public lot subsequently deleted | 200 then 404 | Fresh availability lookup; no cached successful page |
| Upstream outage | 503 | No canonical; retry supported |
| Mango mandi rates | 200 | Mango Mandi Rates Today title, meaningful H1/content, index,follow, self canonical |
| Delivery document | 307 | Location /profile?from=/delivery; crawl allowed |
| Sitemap | 200 route behavior | Deleted/private/missing lots and delivery excluded; Mango retained |

HTTP routing tests emulate the checked-in hosting configuration locally and use controlled API fixtures. Built-template tests exercise the exported HTTP handler itself. They are not a claim that the new Vercel deployment has been tested. The current live sitemap contains no lot-detail URLs; successful-lot behavior is covered with fixtures.

Commands (from the corresponding app directory):

```text
node --test scripts/seo-indexing.test.cjs
node ../../node_modules/vitest/vitest.mjs run src/components/SEO.test.js src/utils/profileRouteState.test.js
node ../../node_modules/vitest/vitest.mjs run routes/sitemapRoutes.lots.test.js routes/mandiRatesSeo.test.js controllers/productController.publicAccess.test.js services/publicLotAccessService.test.js services/publicLotHistoryService.test.js
node node_modules/vite/bin/vite.js build
node scripts/prerender-seo.cjs
```

The backend test command runs from apps/backend; the other commands run from apps/efruitmandi-frontend. Prerender requires public API network access.

## Deployment and manual checks

1. Deploy the complete frontend Vercel project with its existing app root and build/postbuild commands. Deploy `vercel.json` and `api/lot.js` together, not only the static build folder. The function configuration explicitly bundles build/index.html and the existing fruitLotsContent source used by the renderer. Retain the existing API-base environment configuration and Node runtime with fetch support.
2. Deploy the backend sitemap no-store header separately with the backend. No migration is required.
3. Purge any external CDN cached lot documents, delivery document and sitemap, and remove any external rule forcing these responses into a cached SPA 200. Vercel's new lot response headers disable caching; old static lot files must not survive deployment.
4. Inspect the initial GET response without following redirects: all four reported IDs plus a malformed ID must be 404 with the exact not-found metadata, no canonical and a visible marketplace link. HEAD must return the same status.
5. Check a current public lot for 200, its actual title/content, index,follow and its own canonical. Delete a test lot through the normal authorized workflow and repeat the request to verify 404 without rebuilding.
6. Check Mango for 200/index,follow/self canonical. Confirm sitemap excludes the deleted lot and delivery.
7. Open delivery logged out: the network document response must be 307 to profile and login must return to delivery. Repeat while logged in to verify the profile bridge resumes the workspace. Check robots.txt permits crawling delivery.
8. After deployment, run Search Console URL Inspection and request validation/recrawling. Google classification changes only after recrawling; local implementation cannot update Search Console directly.

## Exact changed files

Created:
- apps/efruitmandi-frontend/api/lot.js
- apps/backend/routes/sitemapRoutes.lots.test.js
- docs/LOT_SOFT_404_FIX.md

Modified:
- apps/efruitmandi-frontend/vercel.json
- apps/efruitmandi-frontend/public/robots.txt
- apps/efruitmandi-frontend/scripts/prerender-seo.cjs
- apps/efruitmandi-frontend/scripts/validate-seo-build.cjs
- apps/efruitmandi-frontend/scripts/seo-indexing.test.cjs
- apps/efruitmandi-frontend/src/pages/LotDetails.js
- apps/efruitmandi-frontend/src/pages/Delivery.js
- apps/efruitmandi-frontend/src/pages/Profile.js
- apps/efruitmandi-frontend/src/utils/profileRouteState.js
- apps/efruitmandi-frontend/src/utils/profileRouteState.test.js
- apps/efruitmandi-frontend/src/components/SEO.test.js
- apps/backend/routes/sitemapRoutes.js
