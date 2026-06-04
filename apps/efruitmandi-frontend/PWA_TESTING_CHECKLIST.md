# eFruitMandi PWA Testing Checklist

Use a production build or deployed Vercel URL for these checks. Development mode does not register the service worker.

## Local Production Smoke Test

1. Run `npm.cmd --workspace @efruitmandi/efruitsmandi-frontend run build`.
2. Run `npm.cmd --workspace @efruitmandi/efruitsmandi-frontend run preview`.
3. Open the preview URL in Chrome.

## Chrome DevTools Application - Manifest

1. Open DevTools, then Application, then Manifest.
2. Confirm the manifest URL is `/manifest.json`.
3. Confirm `name` is `E-Fruit Mandi` and `short_name` is `E-Fruit`.
4. Confirm `start_url` and `scope` are both `/`.
5. Confirm `display` is `standalone`.
6. Confirm icons load without 404:
   - `/favicon.ico` as `32x32`
   - `/logo192.png` as `192x192`
   - `/logo512.png` as `512x512`
   - `/maskable-icon-512.png` as `512x512 maskable`
7. Confirm screenshots load:
   - `/pwa-screenshot-wide-1280x720.png`
   - `/pwa-screenshot-mobile-390x844.png`
8. Confirm there are no richer install UI screenshot warnings.

## Lighthouse PWA Test

1. Open DevTools, then Lighthouse.
2. Select Progressive Web App checks.
3. Run against the deployed HTTPS URL.
4. Confirm manifest, service worker, installability, icon, and screenshot checks pass.

## Android Install Test

1. Open the deployed HTTPS URL in Chrome on Android.
2. Clear old site data first if this app was previously installed.
3. Confirm the install prompt or browser install menu is available.
4. Install the app.
5. Open it from the home screen or app drawer.
6. Confirm it opens as a standalone app without the browser address bar.
7. Confirm buyer, grower, driver, lot, quote, KYC, logistics, and profile navigation still work online.

## iPhone Safari Add to Home Screen Test

1. Open the deployed HTTPS URL in Safari.
2. Tap Share.
3. Tap Add to Home Screen.
4. Confirm the app name and icon appear correctly.
5. Open it from the home screen.
6. Confirm it opens in standalone mode where iOS supports it.

## Offline Test

1. Open the deployed app online first so the service worker can install.
2. In Chrome DevTools, go to Application, then Service Workers, and confirm `/pwa-service-worker.js` is activated.
3. Switch Network to Offline.
4. Refresh the page.
5. Confirm the app shows the cached shell or `/offline.html`, not a browser network error.
6. Confirm API-driven live data is not falsely shown as fresh while offline.

## Icon and Screenshot Validation

1. Directly open each asset URL in the browser:
   - `/logo192.png`
   - `/logo512.png`
   - `/maskable-icon-512.png`
   - `/apple-touch-icon.png`
   - `/pwa-screenshot-wide-1280x720.png`
   - `/pwa-screenshot-mobile-390x844.png`
2. Confirm every asset returns `200`.
3. Confirm the old React icon is no longer displayed in the manifest panel.

## Clear Old Service Worker and Cache Before Retesting

1. Open DevTools, then Application.
2. Open Service Workers and click Unregister for old eFruitMandi workers.
3. Open Storage and click Clear site data.
4. Close all tabs for the app.
5. Reopen the deployed URL and retest installability.

## Refresh and Deep Link Routing Test

1. Open a deep route such as a lot, profile, notification, KYC, or delivery page.
2. Refresh the page.
3. Confirm Vercel rewrites route back to the React app and the page does not 404.
4. Repeat after installing the PWA.
