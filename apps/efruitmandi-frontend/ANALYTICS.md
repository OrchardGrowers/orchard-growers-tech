# Analytics architecture

## Production policy and delivery mode

`src/config/analytics.js` is the single application analytics configuration source. Analytics runs only in a production build on an allowed public hostname. The measurement ID, hostname allowlist, page-view switches, and delivery mode remain centralized there.

`VITE_ANALYTICS_DELIVERY_MODE` supports `direct`, `dual`, and `gtm`. Missing or invalid values default to `gtm`, making Google Tag Manager the production owner of GA4. The existing measurement ID is unchanged.

| Mode | Application loads/configures `gtag.js` | Application pushes `dataLayer` events | Intended use |
| --- | --- | --- | --- |
| `gtm` | No | Yes | Production default |
| `direct` | Yes | No | Rollback |
| `dual` | Yes | Yes | Short-lived migration diagnostics only; it can duplicate GA4 data if GTM tags are active |

The GTM bootstrap in `index.html` owns loading container `GTM-N85CGPXP` and is not modified by the application analytics service. The direct Microsoft Clarity loader and all existing Clarity calls remain independent of GA4 delivery mode.

## Event ownership

| Signal | Application responsibility | Delivery/owner in `gtm` mode |
| --- | --- | --- |
| Initial page view | None after GTM initialization; the first matching router callback is suppressed | GTM Google Tag |
| SPA page view | Push one `virtual_page_view` after a route change | GTM maps the data-layer event to GA4 |
| Marketplace event | Preserve its existing name, normalize permitted parameters, and push one object | GTM maps the same event name to GA4 |
| Clarity event | Call `clarity("event", name)` and set the same permitted properties as before | Application/direct Clarity integration |

Existing analytics exports, signatures, imports, and page callers remain unchanged. Event names are unchanged: `lot_view`, `lot_contact`, `buyer_registration`, `grower_registration`, `logistics_registration`, `kyc_submitted`, `lot_created`, `deal_created`, `payment_initiated`, `payment_success`, `payment_failed`, `search_performed`, `registration_started`, and `auth_step`. `trackUserAction` continues to use its caller-supplied event name.

Analytics parameters whose keys indicate email, phone/mobile, address, identity documents, payment credentials, OTP/password/PIN, access or refresh tokens, authorization, cookies, or sessions are discarded before any GA4/dataLayer or Clarity delivery. Callers must continue to pass only non-sensitive business metadata.

## dataLayer event contract

Marketplace events are plain objects. The `event` property is the existing analytics event name; the remaining properties are the existing normalized, non-empty, non-sensitive event parameters.

```js
window.dataLayer.push({
  event: "payment_success",
  payment_status: "success",
  value: 1200,
  currency: "INR",
});
```

SPA navigation uses exactly this contract and no additional fields:

```js
window.dataLayer.push({
  event: "virtual_page_view",
  page_path: "/auctions?fruit=apple",
  page_location: window.location.href,
  page_title: document.title,
});
```

`page_path` is the React Router pathname plus query string. `page_location` is the current absolute URL. `page_title` is the current document title. The application suppresses the initial router callback in `gtm` mode so the GTM-owned initial page view and application-owned SPA page views do not overlap.

## Rollback

1. Set `VITE_ANALYTICS_DELIVERY_MODE=direct` in the production build environment.
2. Build and deploy the frontend. Direct mode restores dynamic `gtag.js` loading, `gtag("config")`, direct custom events, and the prior SPA config calls.
3. In GTM, pause the GA4 Google Tag/page-view/custom-event tags before or at the same release boundary to prevent duplicate tracking. Keep the GTM container bootstrap installed.
4. Verify one initial page view, one page view per SPA navigation, unchanged marketplace event names, and active Clarity events.

Do not use `dual` as a steady-state rollback mode. It intentionally emits through both application delivery paths and is only safe when the corresponding GTM GA4 event tags are disabled or isolated for diagnostics.

## Validation checklist

- Build with the production environment and confirm `npm run build` succeeds.
- Confirm `git diff --check` succeeds.
- Confirm the GTM bootstrap and measurement ID values are unchanged.
- In GTM Preview, confirm the Google Tag owns the initial page view.
- Navigate between routes and confirm exactly one `virtual_page_view` object per SPA navigation, containing only `page_path`, `page_location`, and `page_title` in addition to `event`.
- Trigger every marketplace flow and confirm its existing event name appears once in `dataLayer` and once in GA4 DebugView.
- Confirm no application request loads `gtag/js`, and no application `gtag("config")` or `gtag("event")` call runs in `gtm` mode.
- Confirm `email`, phone/mobile, address, identity documents, payment credentials, OTP, tokens, authorization values, and cookies are absent from Preview and DebugView.
- Confirm Microsoft Clarity loads and receives the existing event names and page-path updates.
- Confirm SEO output, routing, APIs, and application business flows are unchanged.
