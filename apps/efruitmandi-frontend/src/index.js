import React from "react";
import ReactDOM from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import "./index.css";
import App from "./App";
import AppErrorBoundary from "./components/AppErrorBoundary";
import reportWebVitals from "./reportWebVitals";
import {
  APP_BUILD_ID,
  attemptChunkLoadRecovery,
  prepareBuildRecovery,
  reloadOnceForBuild,
} from "./utils/chunkLoadRecovery";

prepareBuildRecovery();
window.__EFRUITMANDI_BUILD_ID__ = APP_BUILD_ID;

window.addEventListener("error", (event) => {
  attemptChunkLoadRecovery(event.error || event);
});
window.addEventListener("unhandledrejection", (event) => {
  attemptChunkLoadRecovery(event.reason || event);
});

function StartupOverlayCleanup() {
  React.useLayoutEffect(() => {
    document.getElementById("efruitmandi-startup-overlay")?.remove();
  }, []);

  return null;
}

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <React.StrictMode>
    <HelmetProvider>
      <AppErrorBoundary>
        <App />
        <StartupOverlayCleanup />
      </AppErrorBoundary>
    </HelmetProvider>
  </React.StrictMode>
);

reportWebVitals();

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  const hadServiceWorkerController = Boolean(navigator.serviceWorker.controller);

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (hadServiceWorkerController) {
      reloadOnceForBuild("service-worker");
    }
  });

  window.addEventListener("load", () => {
    window.setTimeout(() => {
      navigator.serviceWorker
        .register("/pwa-service-worker.js", { scope: "/" })
        .then((registration) => {
          registration.waiting?.postMessage({ type: "SKIP_WAITING" });
          return registration.update();
        })
        .catch(() => undefined);
    }, 4000);
  });
}
