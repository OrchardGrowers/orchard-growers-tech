# Orchard Growers PWA Testing Checklist

Use this checklist after building and deploying `apps/orchardgrowers-frontend`.

## Local Production Build

- Run `npm run build --workspace @efruitmandi/orchardgrowers-frontend`.
- Run `npm run preview --workspace @efruitmandi/orchardgrowers-frontend`.
- Open the preview URL in Chrome.
- Confirm the service worker is registered only in preview/production, not during `npm run dev`.

## Chrome DevTools Application Tab

- Open DevTools > Application.
- Manifest:
  - Confirm `name` is `Orchard Growers`.
  - Confirm `short_name` is `Orchard`.
  - Confirm `start_url` is `/`.
  - Confirm `scope` is `/`.
  - Confirm `display` is `standalone`.
  - Confirm icons load without 404.
- Service Workers:
  - Confirm `/pwa-service-worker.js` is active.
  - Confirm there are no old workers controlling the page.
- Storage > Cache Storage:
  - Confirm `orchard-growers-pwa-v1-static` exists.
  - Confirm `offline.html`, `logo.png`, `logo512.png`, and `maskable-icon-512.png` are cached.

## Lighthouse PWA Check

- Run Lighthouse in Chrome DevTools.
- Select Progressive Web App checks.
- Confirm installability checks pass.
- Confirm manifest and service worker checks pass.

## Android Install Test

- Open the deployed HTTPS site in Chrome for Android.
- Confirm the browser offers Install/Add to Home Screen.
- Install the app.
- Open it from the app drawer/home screen.
- Confirm it opens standalone without the browser address bar.
- Navigate to products, cart, account/login, and a deep link.

## iPhone Safari Add to Home Screen Test

- Open the deployed HTTPS site in Safari.
- Tap Share > Add to Home Screen.
- Confirm the title appears as `Orchard`.
- Open the installed icon from the home screen.
- Confirm it opens without Safari browser chrome where iOS supports standalone mode.
- Confirm the status bar color/style is acceptable.

## Offline Mode Test

- Open the installed app or production site while online.
- Visit home and at least one product/deep-link page.
- In Chrome DevTools, switch Network to Offline.
- Refresh the app.
- Confirm the app does not show a browser network error.
- Confirm `/offline.html` appears for uncached navigation.
- Return online and refresh.
- Confirm normal app behavior resumes and API data is fetched from the network.

## Refresh And Deep Link Routing Test

- Open a direct URL such as `/products`, a product detail route, account/settings, or cart.
- Refresh the browser.
- Confirm Vercel rewrites serve the React app instead of a 404.
- Install the PWA and open the same direct links where possible.

## Clear Old Service Worker And Cache Test

- Open DevTools > Application > Service Workers.
- Click Unregister for old service workers.
- Open Application > Storage.
- Click Clear site data.
- Hard refresh.
- Confirm only the latest `orchard-growers-pwa-v1-*` caches are recreated.

## Production Domain Validation

- Confirm production uses HTTPS.
- Confirm `https://<domain>/manifest.webmanifest` returns HTTP 200.
- Confirm `https://<domain>/pwa-service-worker.js` returns HTTP 200.
- Confirm `https://<domain>/logo.png`, `/logo512.png`, and `/maskable-icon-512.png` return HTTP 200.
- Confirm `start_url` `/` is inside manifest scope `/`.
