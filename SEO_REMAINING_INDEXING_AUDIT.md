# eFruitMandi Remaining Indexing Audit

Audit date: 2026-07-27 (Asia/Calcutta)  
Production site: `https://www.efruitmandi.live`  
Scope: repository review, production HTTP/redirect checks, raw HTML inspection, sitemap-wide metadata checks, and internal-link validation.

## Executive summary

- No server-side redirect loop exists on any investigated route.
- `/register-buyer` and `/register-grower` are private account workflow pages. An unauthenticated browser is intentionally redirected by React to `/profile`. Their Google Search Console classifications are consistent with that authentication behavior and with historical duplicate homepage metadata.
- `/delivery` is a private application workspace, not a public landing page. It should remain excluded from search.
- Production already sends `X-Robots-Tag: noindex, nofollow` for the registration and delivery routes, and they are absent from the sitemap.
- The raw HTML for non-prerendered private routes is the homepage application shell. It contains homepage title, canonical, body, and schema until React renders. This mismatch is a likely contributor to the duplicate and soft-404 classifications.
- Safe client metadata was added for the two registration pages and `/delivery`. No authentication, routing, API, business logic, or UI behavior was changed.
- `/logistics-partner-guide` is technically crawlable and has correct core metadata, but its unique content is thin and its raw HTML has no page-specific structured data. Content expansion should be editorially reviewed rather than generated automatically.
- The production sitemap currently contains 62 unique HTTPS URLs. All 62 returned HTTP 200, had one matching canonical, one H1, a unique title, and a unique meta description during this audit.
- No broken raw-HTML internal link was found. One legacy internal link target, `/contact`, redirected to `/contact-us`; repository references were safely normalized while the compatibility route and redirect remain.

## Safe changes implemented

| Change | Reason | Affected files |
|---|---|---|
| Added unique `noindex` SEO metadata to the authenticated buyer registration render | Prevent inherited homepage metadata after React renders; preserve intentional login redirect | `apps/efruitmandi-frontend/src/pages/RegisterBuyer.js` |
| Added unique `noindex` SEO metadata to the authenticated grower registration render | Prevent inherited homepage metadata after React renders; preserve intentional login redirect | `apps/efruitmandi-frontend/src/pages/RegisterGrower.js` |
| Added unique `noindex` SEO metadata to the delivery workspace | Make the private page's indexing intent explicit after React renders | `apps/efruitmandi-frontend/src/pages/Delivery.js` |
| Normalized current internal Contact links and the hydrated canonical from `/contact` to `/contact-us` | Remove an avoidable internal 308 hop and canonical instability while retaining backward compatibility | `apps/efruitmandi-frontend/index.html`, `apps/efruitmandi-frontend/public/llms.txt`, `apps/efruitmandi-frontend/src/data/staticPages.js`, `apps/efruitmandi-frontend/src/pages/Home.js`, `apps/efruitmandi-frontend/src/pages/MediaPage.js` |

## Issue 1: `/register-buyer` — Page with Redirect

### Redirect report

| Requested URL or event | Result | Next URL | Assessment |
|---|---:|---|---|
| `https://www.efruitmandi.live/register-buyer` | 200 | None at HTTP layer | Canonical production host |
| `https://efruitmandi.live/register-buyer` | 308 | `https://www.efruitmandi.live/register-buyer` | Intentional host normalization |
| `http://www.efruitmandi.live/register-buyer` | 308 | `https://www.efruitmandi.live/register-buyer` | Intentional HTTPS normalization |
| `http://efruitmandi.live/register-buyer` | 308, then 308 | HTTPS apex, then HTTPS `www` | Intentional, but a two-hop chain |
| `https://www.efruitmandi.live/register-buyer/` | 200 | None | Duplicate trailing-slash form; no server redirect |
| Unauthenticated React render | Client navigation with `replace: true` | `/profile` | Intentional login requirement |
| Authenticated React render | No redirect | `/register-buyer` | Intentional registration/update workflow |

### Findings

**Issue**  
Search Console reports “Page with Redirect.”

**Cause**  
`RegisterBuyer.js` checks `localStorage.accessToken`. If it is absent, a `useEffect` intentionally navigates to `/profile` with login state and `replace: true`. Googlebot has no authenticated browser state, so it observes or infers this redirect. Canonical host and HTTPS redirects also exist but terminate correctly.

**Risk**  
Low for the private workflow itself. The classification is expected if the URL is not intended to be indexed. The greater SEO inconsistency is that the initial raw response is a 200 homepage shell with a homepage canonical while the response header says `noindex`.

**Recommended Fix**  

1. Keep the authentication redirect; changing it would alter the required authentication flow.
2. Keep the `X-Robots-Tag: noindex, nofollow` response header and the newly added route-local `noindex`.
3. Do not submit `/register-buyer` in the sitemap.
4. If Google must reliably process the `noindex`, consider allowing the URL to be crawled in `robots.txt` while retaining the HTTP `X-Robots-Tag`. A URL blocked by `robots.txt` may not be recrawled sufficiently to process page-level directives. This should be released as a deliberate crawl-policy change, not automatically.
5. Consider a route-specific 308 from `/register-buyer/` to `/register-buyer` to enforce one server URL. This is a routing change and was not implemented.
6. Consider configuring the HTTP apex domain to redirect directly to HTTPS `www` to remove the two-hop chain. This is normally a hosting/domain setting.

**Affected Files**

- `apps/efruitmandi-frontend/src/pages/RegisterBuyer.js`
- `apps/efruitmandi-frontend/src/App.js`
- `apps/efruitmandi-frontend/vercel.json`
- `apps/efruitmandi-frontend/public/robots.txt`
- `apps/efruitmandi-frontend/index.html`

**Priority**  
P2 for Search Console cleanup; P3 for the apex and trailing-slash normalization.

**Loop status**  
No HTTP or client redirect loop was found.

**Canonical status**  
After the safe change, an authenticated rendered page selects `https://www.efruitmandi.live/register-buyer`. The raw app-shell response still contains the homepage canonical until React runs; changing that server response requires route-specific prerendering or hosting rewrites and was not applied.

## Issue 2: `/register-grower` — Duplicate without user-selected canonical

### Metadata verification

| Check | Production/raw response before deployment of this patch | Repository after safe change | Assessment |
|---|---|---|---|
| Canonical | Homepage canonical in raw app shell | `/register-grower` after authenticated React render | Unique client canonical added |
| Title | Homepage title in raw app shell | `Grower Profile Registration \| eFruitMandi` | Unique |
| Meta description | Homepage description in raw app shell | `Create or update a private eFruitMandi grower profile.` | Unique |
| OpenGraph URL | Homepage URL in raw app shell | `https://www.efruitmandi.live/register-grower` | Unique |
| Robots | Header: `noindex, nofollow`; raw meta: `index, follow` | Header remains `noindex`; rendered meta becomes `noindex,nofollow` | Header is authoritative; mismatch reduced after render |
| hreflang | None | None | Appropriate for this private, single-language workflow |
| Structured data | Homepage Organization/WebSite/WebPage in raw shell | No route-specific schema added | Private transactional page does not need schema |
| HTTP status | 200 | Unchanged | Expected app route |
| Unauthenticated behavior | Client redirect to `/profile` | Unchanged | Intentional |

**Issue**  
Search Console reports “Duplicate without user-selected canonical.”

**Cause**  
The route is not prerendered. Its initial response is the shared homepage HTML, including homepage title, description, canonical, OpenGraph URL, H1, and homepage schema. The registration component previously did not add route-specific SEO metadata. Google also cannot access the authenticated form and may be blocked by `robots.txt`.

**Risk**  
Low if the page is intentionally private and excluded from search. Medium diagnostic noise in Search Console because Google receives conflicting signals.

**Recommended Fix**  

1. Keep the unique route-local metadata added in this patch.
2. Keep the page out of the sitemap.
3. Keep route-specific structured data absent; there is no eligible public entity or rich-result use case.
4. Do not add hreflang to a private page.
5. If Search Console cleanup is important, review the `robots.txt` disallow/noindex combination as a controlled crawl-policy change.
6. A route-specific noindex prerender would make raw HTML consistent, but it requires a new rewrite/prerender path and was not implemented automatically.

**Affected Files**

- `apps/efruitmandi-frontend/src/pages/RegisterGrower.js`
- `apps/efruitmandi-frontend/src/App.js`
- `apps/efruitmandi-frontend/vercel.json`
- `apps/efruitmandi-frontend/public/robots.txt`
- `apps/efruitmandi-frontend/index.html`

**Priority**  
P2.

## Issue 3: `/logistics-partner-guide` — Crawled, currently not indexed

### Audit results

| Check | Result | Assessment |
|---|---|---|
| HTTP status | 200 | Pass |
| Indexability | `index, follow`; no blocking `X-Robots-Tag` | Pass |
| Sitemap | Present once in the sitemap | Pass |
| Canonical | Exactly `https://www.efruitmandi.live/logistics-partner-guide` | Pass |
| Title | `Logistics Partner Guide \| eFruitMandi` | Unique; pass |
| Meta description | Unique and route-specific | Pass |
| OpenGraph/Twitter | Title, description, URL, card, and image present | Pass |
| H1 | One `Logistics Partner Guide` H1 | Pass |
| Heading hierarchy | One H1 followed by H2 section headings; no skipped level found | Pass |
| HTML structure | Prerendered fallback uses `<main>`, H1, H2, paragraphs, and `<nav>`; React view uses `<main>`, sections/articles, H1, and H2 | Good |
| Structured data | No JSON-LD in raw prerendered HTML; no FAQ data exists for this guide | Improvement available |
| Internal links | Linked from the homepage information links and includes marketplace/registration/related-reading links after render | Acceptable, but could be more contextually linked |
| Raw visible word count | Approximately 232 total words including repeated global/fallback copy and navigation | Borderline |
| Route-specific source content | Approximately 113 words including title, headings, and metadata; less in substantive body copy | Thin |
| Trailing slash | Both slash and non-slash forms return 200; both select the non-slash canonical | Canonicalized but not consolidated by redirect |

**Issue**  
Google crawled the page but did not select it for indexing.

**Cause**  
No technical blocking directive was found. The most likely causes are:

- limited unique, substantive guide content;
- substantial overlap in theme and terminology with the shipping/logistics policy and the private delivery workspace;
- generic prerender fallback copy shared across many static pages;
- no page-specific WebPage or Breadcrumb structured data in the raw HTML;
- limited contextual internal-link signals compared with stronger marketplace and policy pages.

Google is not required to index every technically valid URL, so a correct canonical and 200 response do not guarantee selection.

**Risk**  
Medium. The page is eligible for indexing but may remain excluded because it offers limited standalone value.

**Recommended Fix**  

Do not automatically rewrite the guide. Have a subject-matter owner expand and approve original content covering:

1. logistics partner eligibility and onboarding;
2. KYC and document requirements;
3. vehicle, driver, route, and contact record expectations;
4. pickup, loading, transit, station update, unloading, and delivery-confirmation steps;
5. damage, delay, dispute, and failed-delivery handling;
6. tracking permissions and privacy;
7. settlement boundaries and platform responsibilities;
8. visible FAQs based on real support questions;
9. links to shipping/logistics policy, KYC policy, buyer guide, grower guide, and contact support.

Aim for a useful, editorially reviewed guide rather than a word-count target. As a practical benchmark, 500–800 genuinely useful words would provide substantially more standalone value than the current content.

After visible content is approved:

- add accurate `WebPage` and `BreadcrumbList` JSON-LD;
- add `FAQPage` schema only when the same questions and answers are visibly present;
- add contextual links from the shipping policy, buyer guide, grower guide, and relevant public logistics copy;
- request reindexing after deployment.

**Affected Files**

- `apps/efruitmandi-frontend/src/data/staticPages.js`
- `apps/efruitmandi-frontend/src/pages/PolicyPage.js`
- `apps/efruitmandi-frontend/scripts/prerender-seo.cjs`
- `apps/efruitmandi-frontend/vercel.json`
- `apps/efruitmandi-frontend/src/pages/Home.js`

**Priority**  
P1 content quality; P2 structured data and contextual internal links.

## Issue 4: `/delivery` — Soft 404

### Findings

| Possible cause | Result |
|---|---|
| Empty component | No. The component contains a delivery dashboard, H1, order list, tracking panel, actions, and empty states. |
| Login redirect | No explicit login redirect was found in `Delivery.js`. An unauthenticated visitor sees a role/login message and API-dependent empty state. |
| Placeholder page | Not a placeholder for authenticated users; it is a private operational workspace. |
| Missing content | Raw HTTP content is the homepage app shell, not delivery-specific content. Unauthenticated rendered content has little standalone public value. |
| HTTP status mismatch | The route returns 200 even though it is not a public indexable resource. This is normal for an SPA workspace but can resemble a soft 404 to Google. |
| Canonical mismatch | Raw HTML initially selects the homepage. The safe client change selects `/delivery` after React renders. |
| Indexing directives | Production sends `X-Robots-Tag: noindex, nofollow` and `robots.txt` disallows `/delivery`. |

**Issue**  
Search Console reports a soft 404.

**Cause**  
Google receives a 200 application shell whose raw body and canonical describe the homepage. After rendering without account data, the route offers a private dashboard shell or empty state rather than a public content page. This is a classic soft-404 signal even though the authenticated product page is functional.

**Risk**  
Low to the product because the page should not rank. Medium Search Console noise and wasted crawl diagnostics.

**Recommended Fix**  

The page should never be indexed. The appropriate implementation is:

1. retain `X-Robots-Tag: noindex, nofollow` on `/delivery` and subpaths;
2. retain the newly added client `<meta name="robots" content="noindex,nofollow">`;
3. keep `/delivery` out of the sitemap;
4. consider removing only the `/delivery` `robots.txt` disallow so Google can crawl and process the HTTP `noindex`, while keeping the noindex header in place;
5. optionally serve route-specific noindex shell metadata at the edge without changing the React route;
6. do not convert this authenticated workspace to a 404 or redirect without a product decision.

No delivery routing change was made.

**Affected Files**

- `apps/efruitmandi-frontend/src/pages/Delivery.js`
- `apps/efruitmandi-frontend/src/App.js`
- `apps/efruitmandi-frontend/vercel.json`
- `apps/efruitmandi-frontend/public/robots.txt`
- `apps/efruitmandi-frontend/index.html`

**Priority**  
P2.

## Full SEO audit

### Canonicals

**Result**

- All 62 sitemap URLs had exactly one raw canonical matching the requested URL.
- The homepage uses the preferred HTTPS `www` host.
- Non-prerendered private routes initially inherit the homepage canonical.
- `/contact` is a retained compatibility alias that redirects to `/contact-us`. Current internal links and the hydrated Contact canonical were normalized to `/contact-us`.
- Checked trailing-slash variants returned 200 rather than redirecting. Canonicals point to non-slash URLs.

**Risk**  
Medium for private-route diagnostics; low for indexed sitemap URLs.

**Recommended Fix**  
Adopt explicit trailing-slash redirects only after route-by-route regression testing. A global change may affect static rewrites and was not made.

**Affected Files**

- `apps/efruitmandi-frontend/index.html`
- `apps/efruitmandi-frontend/src/components/SEO.jsx`
- `apps/efruitmandi-frontend/scripts/prerender-seo.cjs`
- `apps/efruitmandi-frontend/vercel.json`

**Priority**  
P2.

### Robots directives

**Result**

- `robots.txt` is reachable.
- Private account, payment, order, delivery, tracking, registration, and workflow routes are disallowed.
- Vercel also sends `X-Robots-Tag: noindex, nofollow` for those route families.
- Raw SPA fallback HTML contains `index, follow`, creating a visible contradiction, although the HTTP header is authoritative.

**Risk**  
Google may retain older URL classifications when crawling is prohibited before it can process noindex signals.

**Recommended Fix**  
Review whether selected private URLs should be crawlable-but-noindex. Keep sensitive APIs and parameterized private content blocked. Make this a deliberate policy change with log monitoring.

**Affected Files**

- `apps/efruitmandi-frontend/public/robots.txt`
- `apps/efruitmandi-frontend/vercel.json`
- `apps/efruitmandi-frontend/index.html`

**Priority**  
P2.

### Sitemap

**Result**

- `/sitemap.xml` is rewritten to the API-generated sitemap.
- 62 unique URLs were present.
- Every submitted URL used HTTPS and the `www` host.
- All 62 returned 200 during the audit.
- No duplicate `<loc>` values were found.
- `/logistics-partner-guide` is included.
- `/register-buyer`, `/register-grower`, and `/delivery` are correctly excluded.

**Risk**  
Low.

**Recommended Fix**  
Continue automated validation that sitemap URLs return 200, are canonical, and are indexable.

**Affected Files**

- `apps/efruitmandi-frontend/vercel.json`
- Backend sitemap generator serving `https://api.efruitmandi.live/sitemap.xml`

**Priority**  
P3 maintenance.

### JSON-LD and Organization schema

**Result**

- Homepage raw HTML contains Organization, WebSite, and WebPage schema.
- Public fruit-lot pages contain CollectionPage and BreadcrumbList schema.
- Public directory/profile pages contain appropriate CollectionPage/ItemList/BreadcrumbList or ProfilePage/LocalBusiness/BreadcrumbList schema where data is available.
- The static prerendered guides, policies, About pages, blog pages, auctions, fruits, and mandi-rate pages currently have no raw JSON-LD.
- The schema generator references the canonical Organization and WebSite IDs consistently.

**Risk**  
Low for indexing; medium missed enhancement opportunity.

**Recommended Fix**  
Add accurate WebPage or CollectionPage plus BreadcrumbList schema to static prerenders. Validate generated JSON-LD in CI. Do not add unsupported ratings, offers, or business facts.

**Affected Files**

- `apps/efruitmandi-frontend/index.html`
- `apps/efruitmandi-frontend/scripts/prerender-seo.cjs`
- `apps/efruitmandi-frontend/src/utils/schemaGenerators.js`
- `apps/efruitmandi-frontend/src/components/SEO.jsx`

**Priority**  
P2.

### Breadcrumb schema

**Result**

- Present on public fruit-lot, directory, location, and profile prerenders.
- Missing from static guide/policy/company/blog/mandi-rate raw HTML, including `/logistics-partner-guide`.

**Risk**  
Low.

**Recommended Fix**  
Add breadcrumb schema only where the hierarchy is also reflected in navigation or page context.

**Affected Files**

- `apps/efruitmandi-frontend/scripts/prerender-seo.cjs`
- `apps/efruitmandi-frontend/src/pages/PolicyPage.js`

**Priority**  
P2.

### FAQ schema

**Result**

- `PolicyPage.js` generates FAQPage schema when a page has visible FAQ groups.
- The logistics guide has no FAQ content and therefore correctly emits no FAQ schema.
- FAQ schema is not present in the raw prerendered `/faqs` HTML; it depends on React rendering.

**Risk**  
Low to medium for rich-result discovery.

**Recommended Fix**  
Prerender FAQ schema from the same visible FAQ source data. Never add FAQ schema without matching visible content.

**Affected Files**

- `apps/efruitmandi-frontend/src/pages/PolicyPage.js`
- `apps/efruitmandi-frontend/src/data/staticPages.js`
- `apps/efruitmandi-frontend/scripts/prerender-seo.cjs`

**Priority**  
P2.

### Meta tags, OpenGraph, and Twitter cards

**Result**

- Every sitemap URL had one title, description, OpenGraph title, OpenGraph description, OpenGraph URL, Twitter card, Twitter title, and Twitter description in raw HTML.
- Titles and descriptions were unique across all 62 sitemap URLs.
- OG/Twitter images were absent on 30 routes, mainly public directories, fruit-lot pages, and one profile without an eligible image. Their Twitter card is still valid but less visually rich.
- Private non-prerendered routes inherit homepage metadata until React runs; safe route-local metadata was added to the three investigated private pages.

**Risk**  
Low for ranking; medium for social share quality.

**Recommended Fix**  
Provide a stable, representative default share image for public pages that lack a valid entity image. Keep private pages image-free.

**Affected Files**

- `apps/efruitmandi-frontend/index.html`
- `apps/efruitmandi-frontend/src/components/SEO.jsx`
- `apps/efruitmandi-frontend/scripts/prerender-seo.cjs`

**Priority**  
P3.

### hreflang

**Result**  
No hreflang tags were found. The audited site exposes one English canonical version and no confirmed alternate localized URL set.

**Risk**  
None under the current single-language URL model.

**Recommended Fix**  
Do not add hreflang until genuine alternate-language or regional URLs exist. If introduced, use reciprocal tags and an `x-default`.

**Affected Files**  
None currently.

**Priority**  
P3/not required.

### H1 and heading structure

**Result**

- All 62 sitemap URLs had exactly one H1 in raw HTML.
- The logistics guide has one H1 and H2 section headings.
- The two authenticated registration forms use styled H2 headings rather than H1, but they are intentionally noindex.
- `/delivery` has one H1 in the rendered workspace.

**Risk**  
Low.

**Recommended Fix**  
No indexability-driven heading change is required for private pages. Preserve UI semantics unless a broader accessibility review approves a change.

**Affected Files**

- `apps/efruitmandi-frontend/src/pages/PolicyPage.js`
- `apps/efruitmandi-frontend/src/pages/RegisterBuyer.js`
- `apps/efruitmandi-frontend/src/pages/RegisterGrower.js`
- `apps/efruitmandi-frontend/src/pages/Delivery.js`

**Priority**  
P3.

### Broken and redirecting internal links

**Result**

- 41 distinct internal links exposed in sitemap-page raw HTML were checked.
- No broken link was found.
- `/contact` was the only redirecting internal target; active references were normalized to `/contact-us`.
- The `/contact` route and 308 redirect remain for backward compatibility.

**Risk**  
Low after the safe normalization.

**Recommended Fix**  
Add a build-time internal-link check that understands static routes and intentional aliases.

**Affected Files**

- `apps/efruitmandi-frontend/index.html`
- `apps/efruitmandi-frontend/public/llms.txt`
- `apps/efruitmandi-frontend/src/data/staticPages.js`
- `apps/efruitmandi-frontend/src/pages/Home.js`
- `apps/efruitmandi-frontend/src/pages/MediaPage.js`
- `apps/efruitmandi-frontend/vercel.json`

**Priority**  
P3.

### Redirect chains

**Result**

- HTTPS apex to HTTPS `www`: one 308.
- HTTP `www` to HTTPS `www`: one 308.
- HTTP apex to HTTPS apex to HTTPS `www`: two 308 hops.
- `/contact` to `/contact-us`: one intentional 308.
- No loop was found.

**Risk**  
Low.

**Recommended Fix**  
Configure the apex HTTP host to redirect directly to the final HTTPS `www` URL if supported by the hosting/domain configuration.

**Affected Files**  
Primarily Vercel project/domain configuration; the Contact alias is declared in `apps/efruitmandi-frontend/vercel.json`.

**Priority**  
P3.

### Mixed HTTP/HTTPS

**Result**

- No `http://` internal asset or navigation reference was found in the audited production sitemap pages.
- Sitemap URLs are HTTPS.
- HSTS and `upgrade-insecure-requests` are enabled.

**Risk**  
Low.

**Recommended Fix**  
Continue enforcing HTTPS in deployment validation.

**Affected Files**

- `apps/efruitmandi-frontend/vercel.json`
- `apps/efruitmandi-frontend/index.html`

**Priority**  
P3.

### Trailing-slash behavior

**Result**

- Checked target routes return 200 for both slash and non-slash forms.
- Canonicals consistently select the non-slash form for the public logistics guide.
- Private raw app-shell variants still inherit the homepage canonical until render.

**Risk**  
Low where canonical tags are processed; medium crawl duplication risk for non-prerendered routes.

**Recommended Fix**  
Evaluate explicit per-route 308 normalization before considering a global `trailingSlash` setting. Test static prerender rewrites, service-worker navigation, authentication return paths, and API-independent deep links first.

**Affected Files**

- `apps/efruitmandi-frontend/vercel.json`
- Vercel project configuration

**Priority**  
P2.

## Priority action list

| Priority | Issue | Cause | Risk | Recommended Fix | Affected Files |
|---|---|---|---|---|---|
| P1 | Logistics guide remains unindexed | Thin unique content and weak standalone value | Page may remain excluded | Editorially expand and approve useful logistics guidance; then request indexing | `src/data/staticPages.js`, `src/pages/PolicyPage.js` |
| P2 | Private routes show raw homepage metadata | Shared SPA fallback | Duplicate/soft-404 Search Console noise | Keep implemented client metadata; evaluate route-specific noindex prerenders | `index.html`, three page components, `scripts/prerender-seo.cjs`, `vercel.json` |
| P2 | robots disallow plus noindex | Crawl blocking can prevent directive refresh | Old classifications may persist | Controlled review of crawlable-but-noindex for selected private routes | `public/robots.txt`, `vercel.json` |
| P2 | Missing static-page structured data | Prerender script only emits schemas for selected route types | Missed semantic/rich-result signals | Add accurate WebPage/CollectionPage and BreadcrumbList JSON-LD | `scripts/prerender-seo.cjs`, `src/pages/PolicyPage.js` |
| P2 | Slash and non-slash forms both return 200 | No explicit trailing-slash normalization | Duplicate crawl paths | Add tested route-specific 308 rules | `vercel.json` |
| P3 | HTTP apex has two redirect hops | Host and protocol normalize separately | Small latency/crawl inefficiency | Direct HTTP apex to HTTPS `www` in hosting config | Vercel domain configuration |
| P3 | Some public pages lack share images | Prerender removes unavailable images | Less attractive social previews | Use a stable public fallback image | `scripts/prerender-seo.cjs`, public assets |

## Validation performed

- Production redirect/header checks for canonical host, apex host, HTTP, HTTPS, slash, and non-slash variants.
- Raw metadata inspection for all four reported routes.
- Live sitemap parse and validation of all 62 URLs.
- Duplicate title, duplicate description, canonical count, H1 count, status, final-URL, mixed-content, schema, and internal-link checks.
- Production build completed successfully with Vite and the SEO postbuild prerender script.

## Deployment and Search Console follow-up

1. Deploy the safe repository changes.
2. Confirm the three private routes still return `X-Robots-Tag: noindex, nofollow`.
3. Test buyer and grower unauthenticated redirects and authenticated form access.
4. Test delivery data loading for buyer, grower, and driver roles.
5. Inspect rendered metadata after authentication where feasible.
6. In Search Console, validate the fixes only after production deployment and recrawl.
7. Treat `/register-buyer`, `/register-grower`, and `/delivery` as intentionally excluded URLs, not target indexed pages.
8. Request indexing for `/logistics-partner-guide` only after substantive content improvements are approved and deployed.
