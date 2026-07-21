# Analytics architecture

## Configuration and production policy

`src/config/analytics.js` is the application analytics configuration source. It owns the GA measurement ID, the automatic-page-view switch, the SPA-page-view switch, and the production hostname allowlist.

The application analytics service is enabled only when all of the following are true:

- Vite built the application in production mode.
- The browser hostname is not localhost, a loopback address, a private/link-local IP address, or a `.local` hostname.
- The browser hostname matches `VITE_ANALYTICS_PRODUCTION_HOSTS`.

The hostname variable is a comma-separated list and supports exact names or entries such as `*.example.com`. When it is omitted, the current eFruitMandi production hostnames are used. This policy controls the application-owned GA initialization, page views, custom GA/Clarity event calls, and the existing direct Clarity loader. The GTM bootstrap remains unchanged in this preparation phase and must not contain analytics tags until the migration phase.

## Initialization flow

1. `AnalyticsTracker` in `src/App.js` waits for the existing idle/mobile-home delay.
2. It dynamically imports `src/services/analytics.js`.
3. `initAnalytics()` checks the centralized production policy.
4. When allowed and a measurement ID is configured, it reuses or loads `gtag.js`, initializes `dataLayer`, and runs the GA config command.
5. `VITE_GA_AUTOMATIC_PAGE_VIEWS` independently controls `send_page_view`. Its default is `true`, preserving current production behavior.

`initAnalytics()` remains callable without arguments. A caller may also temporarily override the configured automatic-page-view setting with `initAnalytics({ sendPageView: false })` during migration validation.

## Page-view flow

`AnalyticsTracker` observes React Router's `location` and calls `trackPageView(pathname + search)`. `VITE_GA_SPA_PAGE_VIEWS` independently controls whether that call sends the GA config command. Clarity continues to receive its existing `page_path` property update while application analytics are enabled.

Both page-view switches default to `true`, so the known initial-page duplication is intentionally preserved in this phase. During migration, disable one owner before enabling an equivalent GTM page-view tag.

## Event flow

Existing page components continue to import the same functions from `src/services/analytics.js`. The service normalizes parameters once and sends the unchanged event name and parameters to direct GA4 and the unchanged event name/properties to Clarity. Calls become safe no-ops when the centralized production policy rejects the current environment or GA/Clarity is unavailable.

The install-prompt telemetry in `src/utils/installAnalytics.js` remains separate and local-storage-only.

## GTM migration points

- Set `VITE_GA_AUTOMATIC_PAGE_VIEWS=false` before GTM becomes the initial page-view owner.
- Set `VITE_GA_SPA_PAGE_VIEWS=false` before GTM becomes the React Router/history page-view owner.
- Move custom events behind the internal `trackMarketplaceEvent` boundary, preserving every existing exported function and event name.
- Remove direct `gtag.js` initialization only after GTM Preview and GA4 DebugView confirm equivalent single-fire behavior.
- Keep direct Clarity until its GTM replacement is independently validated.
- Do not enable overlapping GA4 configuration, page-view, or custom-event tags in GTM while the corresponding direct switch/path remains active.
