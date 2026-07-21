const DEFAULT_PRODUCTION_HOSTS = ["efruitmandi.live", "www.efruitmandi.live"];
const ANALYTICS_DELIVERY_MODES = new Set(["direct", "dual", "gtm"]);

const parseBoolean = (value, fallback) => {
  if (value === undefined || value === null || value === "") return fallback;
  return String(value).trim().toLowerCase() === "true";
};

const parseProductionHosts = (value) => {
  const hosts = String(value || "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);

  return hosts.length ? hosts : DEFAULT_PRODUCTION_HOSTS;
};

const parseDeliveryMode = (value) => {
  const mode = String(value || "")
    .trim()
    .toLowerCase();

  return ANALYTICS_DELIVERY_MODES.has(mode) ? mode : "gtm";
};

const isPrivateIpv4 = (hostname) => {
  const octets = hostname.split(".").map(Number);
  if (
    octets.length !== 4 ||
    octets.some(
      (octet) => !Number.isInteger(octet) || octet < 0 || octet > 255
    )
  ) {
    return false;
  }

  return (
    octets[0] === 0 ||
    octets[0] === 10 ||
    octets[0] === 127 ||
    (octets[0] === 169 && octets[1] === 254) ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168)
  );
};

export const analyticsConfig = Object.freeze({
  gaMeasurementId: import.meta.env.VITE_GA_MEASUREMENT_ID,
  deliveryMode: parseDeliveryMode(
    import.meta.env.VITE_ANALYTICS_DELIVERY_MODE
  ),
  automaticPageViews: parseBoolean(
    import.meta.env.VITE_GA_AUTOMATIC_PAGE_VIEWS,
    true
  ),
  spaPageViews: parseBoolean(import.meta.env.VITE_GA_SPA_PAGE_VIEWS, true),
  productionHosts: Object.freeze(
    parseProductionHosts(import.meta.env.VITE_ANALYTICS_PRODUCTION_HOSTS)
  ),
});

export const isLocalAnalyticsHost = (hostname = "") => {
  const normalizedHost = String(hostname).trim().toLowerCase();

  return (
    !normalizedHost ||
    normalizedHost === "localhost" ||
    normalizedHost === "::1" ||
    normalizedHost.endsWith(".localhost") ||
    normalizedHost.endsWith(".local") ||
    (normalizedHost.includes(":") &&
      (normalizedHost.startsWith("fc") ||
        normalizedHost.startsWith("fd") ||
        normalizedHost.startsWith("fe80:") ||
        normalizedHost.includes("127.0.0.1") ||
        normalizedHost.includes("192.168."))) ||
    isPrivateIpv4(normalizedHost)
  );
};

const matchesProductionHost = (hostname, configuredHost) => {
  if (configuredHost.startsWith("*.")) {
    const baseHost = configuredHost.slice(2);
    return hostname === baseHost || hostname.endsWith(`.${baseHost}`);
  }

  return hostname === configuredHost;
};

export const canUseAnalytics = () => {
  if (typeof window === "undefined" || !import.meta.env.PROD) return false;

  const hostname = window.location.hostname.toLowerCase();
  if (isLocalAnalyticsHost(hostname)) return false;

  return analyticsConfig.productionHosts.some((host) =>
    matchesProductionHost(hostname, host)
  );
};
