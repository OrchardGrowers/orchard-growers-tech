# Technical indexing fixes

Implemented locally; nothing staged, committed, pushed or deployed.
Live evidence timestamp: 2026-09-09T09:13:20.858Z.

## Confirmed causes

- Missing fruit, variety and mandi slugs fell through the SPA rewrite to HTTP 200 homepage HTML/canonical. Existing lot/Grower/Buyer 404 behavior was already correct.
- Prerendering swallowed fruit-discovery failures and treated failed mandi availability requests as empty data. These failures could publish incomplete or noindex HTML. Failed/malformed responses now fail the build; successful empty data retains its intentional exclusion.
- Initial tags lacked consistent Helmet ownership, allowing duplicate/stale canonical and robots tags. Loading defaults could replace valid metadata. Matching initial metadata is now retained while loading.
- Three WebSite schema producers generated the literal SearchAction placeholder. Search now consistently remains noindex,follow without a canonical.
- Alternate legacy URLs pointed at an unrelated homepage. They now redirect to existing equivalent directory/editorial destinations; original content is reused.
- API root had no indexing header and API robots.txt returned 404. API-only exclusions now enforce the requested policy without changing authentication.

## Correct behavior preserved

- /contact already permanently redirects to /contact-us. It is not a standalone public page; the redirect and final canonical are retained.
- Reported Bharat Grower, Chatrapati Buyer and Apple mandi pages are already indexable in production.
- Public fruit discovery currently returns an empty fruits array. The four reported fruit URLs are not eligible under existing rules. They use the existing 404 mechanism after this fix, rather than homepage fallback. No records or content were manufactured.
- Pear is absent from available mandi slugs. Its existing 200/noindex,follow/self-canonical/no-sitemap policy remains intentional and unchanged.
- Private dashboard/notification exclusions, Buyer registration, authorization, Lot History/Closed Deals, Hybrid Mode and Grower badges are preserved.

## Exact files and changes

| File | Change |
|---|---|
| apps/backend/routes/sitemapRoutes.js | Add three existing editorial landing pages; preserve dynamic eligibility and all existing valid public URLs. |
| apps/backend/server.js | Install API robots policy without changing authorization. |
| apps/backend/middleware/apiRobotsPolicy.js | Serve API robots.txt and noindex headers; exempt website sitemap proxy. |
| apps/backend/middleware/apiRobotsPolicy.test.js | Four HTTP regressions for API root/robots/authentication/sitemap. |
| apps/efruitmandi-frontend/index.html | Mark initial SEO tags as Helmet-owned to prevent duplicate/stale tags during hydration/navigation. |
| apps/efruitmandi-frontend/package.json | Expose test:seo and validate:seo commands. |
| apps/efruitmandi-frontend/scripts/prerender-seo.cjs | Reuse existing renderer; remove SearchAction; render original editorial content; fail on failed/malformed eligibility data; preserve intentional noindex; mark metadata for Helmet; validate backend sitemap against generated HTML; expose generators for tests. |
| apps/efruitmandi-frontend/scripts/validate-seo.cjs | Complete live sitemap/raw HTML/header/robots validator and reported-URL audit; exits nonzero on failure. |
| apps/efruitmandi-frontend/scripts/validate-seo-build.cjs | Validate every backend sitemap URL against generated files, configured redirects/headers, robots and metadata. |
| apps/efruitmandi-frontend/scripts/seo-indexing.test.cjs | 21 HTTP/generated-HTML regressions covering public route families, exclusions and validation failures. |
| apps/efruitmandi-frontend/src/components/SEO.jsx | Preserve matching initial metadata while loading; reject homepage or previous-route snapshots. |
| apps/efruitmandi-frontend/src/components/SEO.test.js | Nine focused metadata/Helmet SSR/invalid-mandi regressions. |
| apps/efruitmandi-frontend/src/App.js | Align client /contact navigation with existing /contact-us redirect. |
| apps/efruitmandi-frontend/src/pages/Home.js | Remove only obsolete homepage SearchAction. |
| apps/efruitmandi-frontend/src/utils/schemaGenerators.js | Remove shared SearchAction; preserve WebSite/Organization. |
| apps/efruitmandi-frontend/src/pages/SearchResults.js | Use noindex,follow and omit canonical/og:url. |
| apps/efruitmandi-frontend/src/pages/MandiRates.js | Preserve initial metadata on loading/network failure; unknown commodities have unavailable metadata and no canonical. |
| apps/efruitmandi-frontend/src/pages/PublicBusinessProfile.js | Preserve initial profile metadata during loading. |
| apps/efruitmandi-frontend/src/pages/PublicProfileDirectory.js | Preserve initial directory metadata during loading. |
| apps/efruitmandi-frontend/src/pages/PublicProfileLocation.js | Preserve state/district metadata during loading. |
| apps/efruitmandi-frontend/src/pages/PublicFruitDiscovery.js | Preserve initial metadata during loading; unavailable pages have no canonical; thresholds unchanged. |
| apps/efruitmandi-frontend/src/pages/FruitSeoPage.js | Self-canonical for existing editorial pages; no canonical for unavailable pages. |
| apps/efruitmandi-frontend/src/pages/FruitLotsPage.js | Use final /buyers and /growers directory links. |
| apps/efruitmandi-frontend/src/pages/BlogPage.js | Use final editorial links; original Buyer registration links retained after the follow-up review below. |
| apps/efruitmandi-frontend/vercel.json | Exclude missing dynamic families from homepage fallback; preserve contact redirect; correct grower alias and Apple-only buyer alias; add editorial rewrites and search noindex header. |
| docs/seo/indexing-live-audit.json | Live audit evidence for all 106 sitemap URLs and reported routes. |
| docs/seo/INDEXING_FIX_REPORT.md | This implementation and validation report. |

## Tests and build results

Follow-up navigation review: direct anonymous `/profile` links improved ordinary clicks but lost Buyer intent on new-tab, middle-click or copied-link navigation because the intent existed only in React Router state. Restored only the five original `/register-buyer` CTA links and removed their unused auth imports in BlogPage, NewsUpdatesPage, PolicyPage and PressReleasePage. Blog's corrected editorial links remain. No redirect loop or SEO regression was found in the ordinary-click path. Only Apple has an existing buyer editorial page, so the legacy buyer redirect is now explicitly `/fruit-buyers/apple` to `/blog/fruit-buyers/apple`; unsupported slugs retain the existing 404 behavior. A focused regression reproduced Mango's incorrect 308 before narrowing and now verifies Apple plus unsupported Mango, Pear and missing slugs. The four selected redirect/editorial/private HTTP tests passed. The full-suite/build results below are from the original implementation run; that completed work was not repeated.

- Node SEO integration tests: **21 passed**. These serve fixture HTML from the existing renderer over local HTTP using checked-in routing/headers rules. They are not a live Vercel deployment.
- Frontend: **60 passed / 6 files**, including **9 new SEO tests**, badge/profile/history and registration-route-state regressions.
- Backend regressions: **27 passed / 5 files**. Additional API/mandi run: **8 passed / 2 files**, with 4 repeated mandi tests and 4 new API tests.
- Final Vite production compilation: **passed**, 1491 modules. Existing deprecation, chunk-size and ineffective-dynamic-import warnings remain.
- Final prerender with network access: **passed**; all **106 current backend sitemap URLs** validated against generated HTML.
- Generated HTML including the three added existing editorial sitemap destinations: **109 candidates passed**.
- Full live scan: all **106 sitemap URLs** returned 200, were robots-allowed, had no noindex directive and one matching canonical plus initial title/description/H1. The live validator exits **1** because the undeployed homepage still contains SearchAction's placeholder. The prepared build contains no placeholder.
- Raw generated search, contact-us, reported profiles, Apple/Pear mandi, Apple buyer editorial and 404 HTML inspected. Single canonicals or no canonical, as required.
- git diff --check: **passed**.

## Reported URL observations before deployment

?none? means no corresponding tag/header. Relative redirects resolve on the same host.

| URL | Live HTTP | Live robots meta / X-Robots-Tag | Live canonical or redirect | Live sitemap |
|---|---:|---|---|---|
| /fruits/avocado | 200 | index, follow / none | https://www.efruitmandi.live/ | no |
| /fruits/orange | 200 | index, follow / none | https://www.efruitmandi.live/ | no |
| /fruits/guava | 200 | index, follow / none | https://www.efruitmandi.live/ | no |
| /fruits/pear | 200 | index, follow / none | https://www.efruitmandi.live/ | no |
| /growers/bharat-fruit-farm | 200 | index,follow / none | https://www.efruitmandi.live/growers/bharat-fruit-farm | yes |
| /buyers/chatrapati-fruit-shop | 200 | index,follow / none | https://www.efruitmandi.live/buyers/chatrapati-fruit-shop | yes |
| /mandi-rates/apple | 200 | index,follow / none | https://www.efruitmandi.live/mandi-rates/apple | yes |
| /mandi-rates/pear | 200 | noindex,follow / none | https://www.efruitmandi.live/mandi-rates/pear | no |
| /mandi-rates | 200 | index,follow / none | https://www.efruitmandi.live/mandi-rates | yes |
| /buyer-guide | 200 | index,follow / none | https://www.efruitmandi.live/buyer-guide | yes |
| /contact | 308 | none / none | redirect: /contact-us | no |
| /contact-us | 200 | index,follow / none | https://www.efruitmandi.live/contact-us | yes |
| /search | 200 | noindex,nofollow / none | https://www.efruitmandi.live/search | no |
| /search?q={search_term_string} | 200 | noindex,nofollow / none | https://www.efruitmandi.live/search | no |
| /register-buyer | 200 | index, follow / noindex, nofollow | https://www.efruitmandi.live/ | no |
| /profile-dashboard | 200 | index, follow / noindex, nofollow | https://www.efruitmandi.live/ | no |
| /notifications | 200 | index, follow / noindex, nofollow | https://www.efruitmandi.live/ | no |
| /fruit-buyers/apple | 200 | index, follow / none | https://www.efruitmandi.live/ | no |
| /fruit-growers | 200 | index, follow / none | https://www.efruitmandi.live/ | no |
| http://efruitmandi.live/ | 308 | none / none | redirect: https://efruitmandi.live/ | no |
| http://www.efruitmandi.live/ | 308 | none / none | redirect: https://www.efruitmandi.live/ | no |
| https://efruitmandi.live/ | 308 | none / none | redirect: https://www.efruitmandi.live/ | no |
| https://api.efruitmandi.live/ | 200 | none / none | none | no |
| https://api.efruitmandi.live/robots.txt | 404 | none / none | none | no |

## Prepared behavior after deployment

| Route/family | HTTP | Robots | Canonical | Sitemap |
|---|---:|---|---|---|
| Eligible fruit/variety/profile/state/district pages | 200 | index,follow | Final HTTPS www self | Existing eligibility retained |
| Four reported fruit slugs, with current empty discovery | 404 | noindex,follow | None | No |
| Reported Grower/Buyer, Apple mandi, mandi index, buyer-guide | 200 | index,follow | Self | Yes |
| Pear mandi, while no rates are available | 200 | noindex,follow | Self | No |
| /contact | 308 | Redirect | /contact-us destination | No |
| /contact-us | 200 | index,follow | https://www.efruitmandi.live/contact-us | Yes |
| Search and query variants | 200 | noindex,follow meta/header | None | No |
| /fruit-growers | 308 | Redirect | /growers destination | No |
| /fruit-buyers/apple | 308 | Redirect | /blog/fruit-buyers/apple destination | No |
| /blog/fruit-buyers/apple | 200 | index,follow | Self | Added |
| Invalid lot/Grower/Buyer/fruit/variety/mandi | 404 | noindex,follow | None | No |
| /register-buyer | Existing auth-dependent client redirect | Existing private block/header | Not public | No |
| /profile-dashboard, /notifications | Existing private behavior | Existing robots block/noindex header | Not public | No |
| API root | 200 | New noindex,nofollow header; robots Disallow: / | None | No |
| API robots.txt | 200 | Disallow: / | None | No |

HTTP/non-www redirects remain permanent. HTTP apex currently takes two 308 hops via HTTPS apex to HTTPS www; domain settings were not changed. Contact-specific metadata/H1 remains in initial contact-us HTML. Invalid routes use the existing 404 artifact, not a second rendering system.

## Commands executed

PowerShell .cmd launchers were used because npm.ps1/npx.ps1 execution is blocked.

Repository root:

    node --test apps/efruitmandi-frontend/scripts/seo-indexing.test.cjs
    node apps/efruitmandi-frontend/scripts/validate-seo.cjs --origin https://www.efruitmandi.live --output docs/seo/indexing-live-audit.json
    npm.cmd run build --workspace=apps/efruitmandi-frontend
    git diff --check
    git diff --stat
    git status --short

The initial npm build compiled successfully but sandboxed postbuild network access failed. Final build steps were then run separately:

From apps/efruitmandi-frontend:

    npx.cmd vite build
    node scripts/prerender-seo.cjs
    npx.cmd vitest run src/components/SEO.test.js src/components/GrowerVerificationBadge.test.js src/pages/Home.filters.test.js src/pages/PublicBusinessProfile.history.test.js src/utils/marketplaceVisibility.history.test.js src/utils/profileRouteState.test.js

From apps/backend:

    npx.cmd vitest run routes/mandiRatesSeo.test.js controllers/productController.publicAccess.test.js controllers/userController.publicHistory.test.js services/developmentPublicMarketplaceService.test.js services/publicLotAccessService.test.js
    npx.cmd vitest run middleware/apiRobotsPolicy.test.js routes/mandiRatesSeo.test.js

A read-only Node call to validateBuild() also checked the 106 audited sitemap URLs plus the three new editorial destinations against final generated HTML: 109 passed.

Reusable commands:

    npm.cmd run test:seo --workspace=apps/efruitmandi-frontend
    npm.cmd run validate:seo --workspace=apps/efruitmandi-frontend

## Remaining issues requiring deployment or data

1. Deploy both frontend and backend changes; no live changes were made. Re-run the live validator to confirm actual hosting routing/headers.
2. Eligible fruit-discovery records and Pear rates are absent from current public APIs. This work does not create records, relax eligibility, or guarantee indexing. Eligible data and a new build are needed for those pages to become indexable.
3. Backend sitemap data can change after a static deployment. The new check detects build-time mismatches; subsequent publication/deletion still needs the existing rebuild process and live validation.
4. Coordinate editorial sitemap additions with frontend rollout so destinations exist before the backend advertises them.
5. GSC classifications are historical until recrawl. Technical correctness cannot guarantee Google's indexing or canonical selection.

## Google Search Console steps after deployment

1. Open the efruitmandi.live Domain property or the HTTPS www URL-prefix property.
2. Run the live validator and resolve unexpected HTTP, robots, canonical or initial-metadata failures.
3. In URL inspection, enter each final canonical URL and select Test live URL. Open View tested page > HTML and confirm one canonical, index,follow, route-specific title/description/H1 and no placeholder.
4. Request indexing only for eligible canonical pages that pass. Do not request indexing for search, private/API pages, redirects, unavailable fruit pages or Pear while ineligible.
5. In Sitemaps, submit/resubmit https://www.efruitmandi.live/sitemap.xml and confirm successful processing.
6. In Indexing > Pages, open corrected noindex/soft-404 issues and use Validate fix. Preserve intentional exclusions.
7. After recrawl, compare user-declared and Google-selected canonicals. Redirect sources may correctly remain classified as redirects.

Official documentation: [URL Inspection](https://support.google.com/webmasters/answer/9012289), [Sitemaps report](https://support.google.com/webmasters/answer/7451001), [Page indexing report](https://support.google.com/webmasters/answer/7440203).
