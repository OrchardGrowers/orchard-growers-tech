import { analyticsConfig, canUseAnalytics } from "../config/analytics";

export const GA_ID = analyticsConfig.gaMeasurementId;

const usesDirectGa = () =>
  analyticsConfig.deliveryMode === "direct" ||
  analyticsConfig.deliveryMode === "dual";

const usesGtm = () =>
  analyticsConfig.deliveryMode === "gtm" ||
  analyticsConfig.deliveryMode === "dual";

const SENSITIVE_PARAM_FRAGMENTS = [
  "email",
  "phone",
  "mobile",
  "telephone",
  "address",
  "aadhaar",
  "aadhar",
  "passport",
  "license",
  "licence",
  "identity",
  "document",
  "otp",
  "password",
  "passcode",
  "cvv",
  "cardnumber",
  "accountnumber",
  "paymentcredential",
  "accesstoken",
  "refreshtoken",
  "authorization",
  "cookie",
  "sessionid",
  "sessiontoken",
];

const isSensitiveParam = (key) => {
  const normalizedKey = String(key).replace(/[^a-z0-9]/gi, "").toLowerCase();

  return (
    ["pan", "pin", "card", "session"].includes(normalizedKey) ||
    SENSITIVE_PARAM_FRAGMENTS.some((fragment) =>
      normalizedKey.includes(fragment)
    )
  );
};

const serializeSafeObject = (value) =>
  JSON.stringify(value, (key, nestedValue) =>
    key && isSensitiveParam(key) ? undefined : nestedValue
  );

let initialGtmPagePath = null;
let initialGtmPageViewPending = false;

const getInitialDocumentPath = () => {
  try {
    const navigationEntry = window.performance?.getEntriesByType?.(
      "navigation"
    )?.[0];

    if (navigationEntry?.name) {
      const initialUrl = new URL(navigationEntry.name);
      return initialUrl.pathname + initialUrl.search;
    }
  } catch {
    // Fall back to the current URL when navigation timing is unavailable.
  }

  return window.location.pathname + window.location.search;
};

const normalizeEventParams = (params = {}) => {
  const safeParams = {};

  Object.entries(params).forEach(([key, value]) => {
    if (key === "event") return;
    if (isSensitiveParam(key)) return;
    if (value === undefined || value === null || value === "") return;
    if (typeof value === "object") {
      const serializedValue = serializeSafeObject(value);
      if (serializedValue !== undefined) safeParams[key] = serializedValue;
      return;
    }
    safeParams[key] = value;
  });

  return safeParams;
};

const trackMarketplaceEvent = (eventName, params = {}) => {
  if (!canUseAnalytics()) return;

  const safeParams = normalizeEventParams(params);

  try {
    if (usesGtm()) {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event: eventName, ...safeParams });
    }

    if (usesDirectGa() && GA_ID && typeof window.gtag === "function") {
      window.gtag("event", eventName, safeParams);
    }

    if (typeof window.clarity === "function") {
      window.clarity("event", eventName);
      Object.entries(safeParams).forEach(([key, value]) => {
        window.clarity("set", key, String(value));
      });
    }
  } catch {
    // Ignore analytics failures so the app remains unaffected.
  }
};

export const initAnalytics = (options = {}) => {
  if (!canUseAnalytics()) return;

  if (usesGtm()) {
    window.dataLayer = window.dataLayer || [];
  }

  if (analyticsConfig.deliveryMode === "gtm") {
    initialGtmPagePath = getInitialDocumentPath();
    initialGtmPageViewPending = true;
    return;
  }

  if (!GA_ID) return;

  const sendPageView =
    options.sendPageView ?? analyticsConfig.automaticPageViews;

  const existingScript = document.querySelector(
    `script[src*="googletagmanager.com/gtag/js?id=${GA_ID}"]`
  );

  if (!existingScript) {
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
    document.head.appendChild(script);
  }

  window.dataLayer = window.dataLayer || [];

  function gtag() {
    window.dataLayer.push(arguments);
  }

  window.gtag = window.gtag || gtag;

  window.gtag("js", new Date());
  window.gtag("config", GA_ID, {
    send_page_view: sendPageView,
  });
};

export const trackPageView = (path) => {
  if (!canUseAnalytics()) return;

  try {
    if (analyticsConfig.spaPageViews && usesGtm()) {
      const isInitialGtmPageView =
        initialGtmPageViewPending && path === initialGtmPagePath;

      initialGtmPageViewPending = false;

      if (!isInitialGtmPageView) {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
          event: "virtual_page_view",
          page_path: path,
          page_location: window.location.href,
          page_title: document.title,
        });
      }
    }

    if (
      analyticsConfig.spaPageViews &&
      usesDirectGa() &&
      GA_ID &&
      typeof window.gtag === "function"
    ) {
      window.gtag("config", GA_ID, {
        page_path: path,
      });
    }

    if (typeof window.clarity === "function") {
      window.clarity("set", "page_path", path);
    }
  } catch {
    // Ignore analytics failures so the app remains unaffected.
  }
};

export const trackLotView = (lot = {}) => {
  trackMarketplaceEvent("lot_view", {
    lot_id: lot._id || lot.id || lot.lotId || "",
    fruit_name: lot.fruitName || lot.title || lot.name || "",
    category: lot.category || lot.fruitCategory || lot.type || "",
  });
};

export const trackLotContact = (lot = {}) => {
  trackMarketplaceEvent("lot_contact", {
    lot_id: lot._id || lot.id || lot.lotId || "",
    fruit_name: lot.fruitName || lot.title || lot.name || "",
    category: lot.category || lot.fruitCategory || lot.type || "",
  });
};

export const trackBuyerRegistration = () => {
  trackMarketplaceEvent("buyer_registration", {
    user_role: "buyer",
  });
};

export const trackGrowerRegistration = () => {
  trackMarketplaceEvent("grower_registration", {
    user_role: "grower",
  });
};

export const trackLogisticsRegistration = () => {
  trackMarketplaceEvent("logistics_registration", {
    user_role: "logistics",
  });
};

export const trackKycSubmitted = (role = "buyer") => {
  trackMarketplaceEvent("kyc_submitted", {
    user_role: role,
  });
};

export const trackLotCreated = (lot = {}) => {
  trackMarketplaceEvent("lot_created", {
    lot_id: lot._id || lot.id || lot.lotId || "",
    fruit_name: lot.fruitName || lot.title || lot.name || "",
    category: lot.category || lot.fruitCategory || lot.type || "",
  });
};

export const trackDealCreated = (deal = {}) => {
  trackMarketplaceEvent("deal_created", {
    deal_id: deal._id || deal.id || deal.dealId || "",
    lot_id: deal.lotId || deal.lot_id || deal.lot || "",
    fruit_name: deal.fruitName || deal.title || deal.name || "",
    category: deal.category || deal.fruitCategory || deal.type || "",
    value: deal.value || deal.amount || deal.quotedPrice || "",
    currency: "INR",
  });
};

export const trackPaymentInitiated = (payment = {}) => {
  trackMarketplaceEvent("payment_initiated", {
    payment_status: "initiated",
    value: payment.value || payment.amount || payment.totalAmount || "",
    currency: "INR",
  });
};

export const trackPaymentSuccess = (payment = {}) => {
  trackMarketplaceEvent("payment_success", {
    payment_status: "success",
    value: payment.value || payment.amount || payment.totalAmount || "",
    currency: "INR",
  });
};

export const trackPaymentFailed = (payment = {}) => {
  trackMarketplaceEvent("payment_failed", {
    payment_status: "failed",
    value: payment.value || payment.amount || payment.totalAmount || "",
    currency: "INR",
  });
};

export const trackSearchPerformed = (query = "", source = "site_search") => {
  trackMarketplaceEvent("search_performed", {
    search_term: query,
    source,
  });
};

export const trackRegistrationStarted = (role = "unknown", source = "unknown") => {
  trackMarketplaceEvent("registration_started", {
    user_role: role,
    source,
  });
};

export const trackAuthStep = (step = "unknown", role = "unknown") => {
  trackMarketplaceEvent("auth_step", {
    step,
    user_role: role,
  });
};

export const trackUserAction = (actionName = "unknown", params = {}) => {
  trackMarketplaceEvent(actionName, params);
};
