export const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;

const normalizeEventParams = (params = {}) => {
  const safeParams = {};

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    if (typeof value === "object") {
      safeParams[key] = JSON.stringify(value);
      return;
    }
    safeParams[key] = value;
  });

  return safeParams;
};

const trackMarketplaceEvent = (eventName, params = {}) => {
  if (typeof window === "undefined" || !GA_ID) return;

  try {
    if (typeof window.gtag === "function") {
      window.gtag("event", eventName, normalizeEventParams(params));
    }
  } catch {
    // Ignore analytics failures so the app remains unaffected.
  }
};

export const initAnalytics = () => {
  if (!GA_ID) return;

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
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

export const trackPageView = (path) => {
  if (!window.gtag || !GA_ID) return;

  window.gtag("config", GA_ID, {
    page_path: path,
  });
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