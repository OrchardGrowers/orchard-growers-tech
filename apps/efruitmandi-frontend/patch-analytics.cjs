const fs = require("fs");

const file = "src/services/analytics.js";
let code = fs.readFileSync(file, "utf8");

code = code.replace(
`export const initAnalytics = () => {
  if (!GA_ID) return;

  const script = document.createElement("script");
  script.async = true;
  script.src = \`https://www.googletagmanager.com/gtag/js?id=\${GA_ID}\`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];

  function gtag() {
    window.dataLayer.push(arguments);
  }

  window.gtag = gtag;

  gtag("js", new Date());
  gtag("config", GA_ID, {
    send_page_view: true,
  });
};`,
`export const initAnalytics = () => {
  if (!GA_ID || typeof window === "undefined") return;

  const loadAnalytics = () => {
    if (window.gtag) return;

    const script = document.createElement("script");
    script.async = true;
    script.src = \`https://www.googletagmanager.com/gtag/js?id=\${GA_ID}\`;
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];

    function gtag() {
      window.dataLayer.push(arguments);
    }

    window.gtag = gtag;

    gtag("js", new Date());
    gtag("config", GA_ID, {
      send_page_view: true,
    });
  };

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(loadAnalytics, { timeout: 3000 });
  } else {
    window.setTimeout(loadAnalytics, 2000);
  }
};`
);

fs.writeFileSync(file, code);
console.log("Analytics deferred.");
