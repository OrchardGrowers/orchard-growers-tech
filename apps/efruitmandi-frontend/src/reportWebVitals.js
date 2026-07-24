const REGISTRATION_KEY = "__EFRUITMANDI_WEB_VITALS_REGISTERED__";

const defaultReporter = ({ name, value, rating }) => {
  if (
    import.meta.env.DEV ||
    window.__EFRUITMANDI_DEBUG_WEB_VITALS__ === true
  ) {
    console.info(`[Web Vital] ${name}`, {
      value: Math.round(value * 100) / 100,
      rating,
    });
  }
};

const reportWebVitals = (onPerfEntry = defaultReporter) => {
  if (typeof onPerfEntry !== "function" || window[REGISTRATION_KEY]) return;

  window[REGISTRATION_KEY] = true;
  import("web-vitals")
    .then(({ onCLS, onINP, onLCP }) => {
      onCLS(onPerfEntry);
      onLCP(onPerfEntry);
      onINP(onPerfEntry);
    })
    .catch(() => {
      window[REGISTRATION_KEY] = false;
      if (import.meta.env.DEV) {
        console.warn("Web Vitals observers could not be registered.");
      }
    });
};

export default reportWebVitals;
