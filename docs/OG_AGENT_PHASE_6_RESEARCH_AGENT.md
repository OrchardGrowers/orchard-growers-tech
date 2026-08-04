# OG Agent Phase 6: Public Website and Approved API Research Agent

## Purpose and boundary

Phase 6 collects bounded, business-relevant information from sources that Orchard Growers has explicitly reviewed and activated. It preserves provenance and prepares temporary records, candidates, and reports for human review. Public availability is not treated as marketing consent. No automatic outreach, account creation, external form submission, private-profile access, CAPTCHA/login/paywall bypass, proxy evasion, or permanent import occurs.

## Architecture

Phase 6 reuses OG Agent tasks, approvals, conditional feedback, permissions, settings, audits, tools, Phase 2 lead candidates/normalization/import provenance, BusinessLead duplicate constraints, and Phase 5 reviewed guidance. Research-specific models hold source policy, plans, fetch decisions, temporary records, reports, and reviews. Services under `services/og-agent/research` keep policy, transport, extraction, normalization, duplicates, candidate conversion, import, and reporting separate.

## Supported sources and lifecycle

Supported registry types include public/government/company websites, public directories and datasets, and explicitly approved partner/search/commercial APIs. A source progresses through draft, current legal/terms/privacy/security review, exact activation approval, active use, pause/block, expiry, and archive. Only `ACTIVE` sources with current non-prohibited review may execute. Editing policy increments its version and invalidates older task snapshots.

Actual API secrets are never stored in MongoDB or sent to the browser. Sources store only a connector key and environment-variable reference. An unavailable credential or connector produces a clear unavailable state.

## Website adapter

The adapter accepts only a URL already attached to an active source plan. It validates protocol, credentials, port, domain/subdomain, allowed/denied paths, DNS results, redirects, robots, response type, response size, timeout, and blocking responses. Requests use `OrchardGrowersResearchAgent/1.0`; they do not spoof a browser. HTML/JSON/XML/CSV text is bounded and sanitized. Recursive unrestricted crawling, media, executables, OCR, and PDF ingestion are absent.

## API adapter

The backend selects a fixed base URL and allowlisted endpoint. Only GET, allowlisted query parameters, backend-created headers, fixed timeout, response limits, and configured credentials are possible. Users/providers cannot override URL, endpoint, method, headers, body, GraphQL, or credential selection. The adapter does not silently fall back to scraping.

## URL, SSRF, robots, and access safety

`file:`, `ftp:`, `data:`, `javascript:`, embedded credentials, non-standard ports, localhost/internal names, private/reserved/link-local addresses, cloud metadata endpoints, unsafe DNS results, unapproved domains, denied paths, and cross-domain redirects are rejected before useful content processing. Every redirect is revalidated. DNS-approved addresses are pinned for website transport.

Robots rules are cached for six hours, choose the specific Research Agent or wildcard group, honor allow/disallow precedence and crawl delay, and combine it with the source minimum delay. Required robots that cannot be retrieved default to deny. CAPTCHA, login/password pages, 401, repeated 403, and access denials stop collection without asking for credentials or circumvention.

## Research workflow

1. Super Admin creates and reviews a source draft, requests exact approval, and activates it.
2. An authorized admin creates a research task using only active sources and bounded scope.
3. Planning performs no external request. It records source reliability, operations, paths/endpoints, geography, fruit/category, contact policy, benefits/harms, limits, and policy versions.
4. Contact collection, multiple sources, larger plans, or low/unknown reliability require approval.
5. Execution claims an idempotent run lock and normalized URL keys, then performs controlled source batches with real counters.
6. Extracted records remain temporary and retain source URL, title, snippet, fetch/publication dates, reliability, confidence, freshness, privacy warnings, and applied guidance references.
7. Reviewers correct/reject records, run duplicate checks, and select eligible records.
8. Candidate creation preserves business-contact context and creates no BusinessLead.
9. A separate immutable candidate snapshot is approved before import.

## Extraction, contacts, reliability, and freshness

Record types cover growers, buyers/traders, FPOs/cooperatives, APMC/mandi, market prices/reports, logistics/cold storage/pack houses/processing, organizations/departments/associations, and business-directory entries. Types are not merged.

Only source-approved public business, organization, or public-office contacts are eligible. Personal or uncertain contacts require privacy review and are ineligible by default. Government IDs, financial data, family details, hidden metadata contacts, and private social profiles are not collected. BusinessLead consent remains `UNKNOWN` or `BUSINESS_CONTACT` and outreach remains manual.

Reliability comes from the reviewed registry (`OFFICIAL`, `HIGH`, `MEDIUM`, `LOW`, `UNKNOWN`), not model confidence. Freshness distinguishes source/market/publication dates from fetch date; old data receives warnings. Phase 2 email/phone/business normalization and conservative duplicate review are reused.

## Reports, human impact, and retention

Reports include methodology, sources/reliability, data dates, findings, geographic/fruit/category/market summaries, data quality, risks, limitations, and recommendations. Uncertainty is not presented as verified fact. Plans and import previews consider contact expectations, scale, unwanted-contact risk, stale/misclassified data, telecaller burden, small-grower fairness, language/accessibility, retention, and do-not-contact handling.

Fetch records store a bounded safe preview and hash, never authorization headers or full secrets. Source retention fields govern evidence and temporary records; imported leads retain provenance. Destructive retention automation is deliberately not included until legal retention policy is finalized.

## Rate controls, failure handling, and audit

Limits combine source and global per-minute/day counts, concurrency, minimum delay, task page/record bounds, response bytes, timeout, no duplicate URL processing, and repeated 403/429 stop rules. CAPTCHA, robots denial, explicit denial, invalid credentials, and policy blocks are not retried. Fetch records persist every allow/block decision. Source creation/review/approval/activation, tasks/plans/runs/cancellation, candidates, imports, reports, and unauthorized permission attempts use the shared audit service without raw sensitive content.

## Permissions and settings

`ADMIN` may create/plan/run tasks, review results, create candidates, request import, generate reports, and submit feedback. `SUPER_ADMIN` additionally manages/reviews/activates sources, views sensitive contacts, approves imports, and manages settings. Backend permissions—not hidden UI—are authoritative.

Locked false: personal-contact extraction, PDF/private-profile collection, CAPTCHA/login bypass, proxy evasion, arbitrary URL fetch, external form submission, automatic outreach, automatic account creation, unapproved API calls, and Agent source-policy override.

## Testing and troubleshooting

Run:

```powershell
npm test --workspace @efruitmandi/backend -- services/og-agent/research/ogAgentResearchPhase6.test.js
npm run build --workspace @efruitmandi/admin-panel
```

Common safe failures include `RESEARCH_SOURCE_INACTIVE`, `SOURCE_REVIEW_EXPIRED`, `UNAPPROVED_DOMAIN`, `SSRF_BLOCKED`, `ROBOTS_DISALLOWED`, `CAPTCHA_DETECTED`, `LOGIN_REQUIRED`, `SOURCE_RATE_LIMITED`, `RESPONSE_TOO_LARGE`, `CONNECTOR_CREDENTIAL_UNAVAILABLE`, `SOURCE_POLICY_CHANGED`, and `APPROVAL_SNAPSHOT_CHANGED`. Correct the source review/configuration or create a fresh plan/approval; do not weaken policy.

## Rollback and limitations

Pause/block sources to stop new work, cancel active tasks, and retain fetch/audit evidence. Disabling Research Agent settings prevents new activity without deleting history. Phase 6 has no unrestricted search crawling, headless browser, browser automation, PDF/OCR, JavaScript rendering, CAPTCHA solving, login automation, paid-plan purchase, source monitoring scheduler, automatic outreach, or autonomous source activation.

Phase 7 may add separately reviewed connector plugins, explicit scheduling approvals, stronger taxonomy/location validation, safe CSV export, richer structured-data extractors, and retention workers—without weakening source policy.
