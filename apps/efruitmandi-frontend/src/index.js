import React from "react";
import ReactDOM from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import "./index.css";
import App from "./App";
import AppErrorBoundary from "./components/AppErrorBoundary";
import AutoRefreshOnResume from "./components/AutoRefreshOnResume";

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
        <AutoRefreshOnResume />
        <StartupOverlayCleanup />
      </AppErrorBoundary>
    </HelmetProvider>
  </React.StrictMode>
);

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    window.setTimeout(() => {
      navigator.serviceWorker
        .register("/pwa-service-worker.js", { scope: "/" })
        .catch(() => undefined);
    }, 4000);
  });
}
