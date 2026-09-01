export const LOCAL_PRIVATE_API_ORIGIN = "http://localhost:5000";
export const PRODUCTION_API_ORIGIN = "https://api.efruitmandi.live";

export const normalizeBaseUrl = (value = "") => String(value || "").trim().replace(/\/+$/, "");
export const stripApiSuffix = (value = "") => normalizeBaseUrl(value).replace(/\/api$/i, "");
export const normalizeApiUrl = (value = "") => {
  const normalized = normalizeBaseUrl(value);
  if (!normalized) return "";
  return /\/api$/i.test(normalized) ? normalized : `${normalized}/api`;
};

export const isLoopbackHostname = (hostname = "") =>
  ["localhost", "127.0.0.1", "::1"].includes(String(hostname || "").toLowerCase());

export const isLoopbackUrl = (value = "") => {
  try {
    return isLoopbackHostname(new URL(normalizeApiUrl(value)).hostname);
  } catch {
    return false;
  }
};

export const resolvePrivateApiUrls = ({ hostname = "", configuredUrl = "" } = {}) => {
  const localBrowser = isLoopbackHostname(hostname);
  const normalizedConfiguredUrl = normalizeApiUrl(configuredUrl);
  let apiBaseUrl;

  if (localBrowser) {
    apiBaseUrl = isLoopbackUrl(normalizedConfiguredUrl)
      ? normalizedConfiguredUrl
      : normalizeApiUrl(LOCAL_PRIVATE_API_ORIGIN);
  } else {
    apiBaseUrl = normalizedConfiguredUrl && !isLoopbackUrl(normalizedConfiguredUrl)
      ? normalizedConfiguredUrl
      : normalizeApiUrl(PRODUCTION_API_ORIGIN);
  }

  return {
    apiBaseUrl,
    apiOrigin: stripApiSuffix(apiBaseUrl),
    localBrowser,
  };
};
