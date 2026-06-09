import React from 'react';
import ReactDOM from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import AppErrorBoundary from './components/AppErrorBoundary';

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <React.StrictMode>
    <HelmetProvider>
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    </HelmetProvider>
  </React.StrictMode>
);

reportWebVitals();

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/pwa-service-worker.js", { scope: "/" })
      .catch(() => undefined);
  });
}