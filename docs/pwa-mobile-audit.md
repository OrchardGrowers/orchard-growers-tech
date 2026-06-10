# eFruitMandi PWA / Mobile Audit

## Files inspected
- apps/efruitmandi-frontend/index.html
- apps/efruitmandi-frontend/public/manifest.json
- apps/efruitmandi-frontend/public/pwa-service-worker.js
- apps/efruitmandi-frontend/src/App.js
- apps/efruitmandi-frontend/src/components/StartupSplash.js
- apps/efruitmandi-frontend/src/components/InstallAppPrompt.js
- apps/efruitmandi-frontend/src/index.js
- apps/efruitmandi-frontend/src/pages/Kyc.js
- apps/efruitmandi-frontend/src/pages/ListNewLot.js

## Problems found
1. The browser shell rendered a boot splash before React mounted, then the React splash rendered again, creating a duplicate startup experience.
2. The install prompt was available but not surfaced consistently for mobile PWA users.
3. Mobile uploads were handled without a shared memory-safe image resizing path, which can trigger browser memory pressure on Android.
4. The PWA shell had no explicit install guidance and weak mobile-only install handling.
5. The service worker cache needed a refresh and more explicit offline shell coverage.

## Root causes
- The initial HTML shell in index.html contained a visible splash image that overlapped with the React startup component.
- The upload flows used direct image processing without a shared mobile-safe compression pipeline.
- The install experience relied on browser events and did not proactively present a clear install entry point for Android users.

## Proposed fixes
- Remove the duplicate HTML boot splash and keep a single React-driven splash experience.
- Introduce a shared mobile-safe image preparation helper for Android uploads.
- Add a clearer install prompt and install guidance for installed and browser modes.
- Refresh the PWA cache manifest and service worker assets.
