import axios from "axios";

const normalizeBaseUrl = (value: string) => value.trim().replace(/\/+$/, "");
const stripApiSuffix = (value: string) => normalizeBaseUrl(value).replace(/\/api$/i, "");
const normalizeApiUrl = (value: string) => {
  const normalized = normalizeBaseUrl(value);
  if (!normalized) return "";
  return /\/api$/i.test(normalized) ? normalized : `${normalized}/api`;
};

const DEFAULT_API_ORIGIN = "https://orchard-growers-backend.onrender.com";
const API_ORIGIN = normalizeBaseUrl(
  import.meta.env.VITE_API_BASE_URL || stripApiSuffix(import.meta.env.VITE_API_URL || "") || DEFAULT_API_ORIGIN
);
if (!import.meta.env.VITE_API_BASE_URL) {
  console.warn("Missing VITE_API_BASE_URL for OrchardGrowers frontend.");
}

export const FILE_BASE_URL = normalizeBaseUrl(
  import.meta.env.VITE_FILE_BASE_URL || import.meta.env.VITE_FILE_URL || API_ORIGIN
);

const API = axios.create({
  baseURL: normalizeApiUrl(import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || API_ORIGIN),
  headers: {
    "Content-Type": "application/json",
  },
});

const ORCHARD_PLATFORM = "orchardgrowers";
const PLATFORM_TAGGED_AUTH_PATHS = /^\/?auth\/(send-otp|resend-otp|verify-otp|forgot-password|reset-password|login|register|verify-mobile-widget-otp)$/i;

const shouldTagAuthPlatform = (url = "") => {
  const path = String(url).replace(/^https?:\/\/[^/]+\/api\/?/i, "").replace(/^\/api\/?/i, "");
  return PLATFORM_TAGGED_AUTH_PATHS.test(path);
};

const addOrchardPlatform = (data: unknown) => {
  if (!data) return { platform: ORCHARD_PLATFORM };
  if (typeof FormData !== "undefined" && data instanceof FormData) {
    if (!data.has("platform")) data.append("platform", ORCHARD_PLATFORM);
    return data;
  }
  if (typeof data === "object" && !(data instanceof URLSearchParams)) {
    return { ...(data as Record<string, unknown>), platform: (data as Record<string, unknown>).platform || ORCHARD_PLATFORM };
  }
  return data;
};

API.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");

  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (shouldTagAuthPlatform(config.url)) {
    config.data = addOrchardPlatform(config.data);
  }

  return config;
});

export default API;
