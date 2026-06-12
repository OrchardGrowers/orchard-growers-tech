import axios from "axios";
import { logoutUser } from "../utils/auth";
import {
  createPaymentUnavailableError,
  isPaymentPartnerDisabledPath,
} from "../config/payment";

const normalizeBaseUrl = (value = "") => value.trim().replace(/\/+$/, "");
const stripApiSuffix = (value = "") => normalizeBaseUrl(value).replace(/\/api$/i, "");
const normalizeApiUrl = (value = "") => {
  const normalized = normalizeBaseUrl(value);
  if (!normalized) return "";
  return /\/api$/i.test(normalized) ? normalized : `${normalized}/api`;
};

export const API_ORIGIN = normalizeBaseUrl(
  process.env.VITE_API_BASE_URL ||
    process.env.REACT_APP_API_BASE_URL ||
    stripApiSuffix(process.env.VITE_API_URL || "") ||
    stripApiSuffix(process.env.REACT_APP_API_URL || "") ||
    "https://api.efruitmandi.live"
);
export const API_BASE_URL = normalizeApiUrl(
  process.env.VITE_API_BASE_URL ||
    process.env.REACT_APP_API_BASE_URL ||
    process.env.VITE_API_URL ||
    process.env.REACT_APP_API_URL ||
    API_ORIGIN
);
export const FILE_BASE_URL = normalizeBaseUrl(process.env.VITE_FILE_BASE_URL || process.env.REACT_APP_FILE_BASE_URL || API_ORIGIN);
export const SOCKET_URL = normalizeBaseUrl(process.env.VITE_SOCKET_URL || process.env.REACT_APP_SOCKET_URL || API_ORIGIN);
const EFRUITMANDI_PLATFORM = "efruitmandi";
const PLATFORM_TAGGED_AUTH_PATHS = /^\/?auth\/(send-otp|resend-otp|verify-otp|forgot-password|reset-password|login|register)$/i;
const isDevelopment = process.env.NODE_ENV !== "production";
if (isDevelopment && !API_ORIGIN) {
  console.warn("Missing VITE_API_BASE_URL for eFruitMandi frontend.");
}

const shouldTagAuthPlatform = (url = "") => {
  const path = String(url).replace(/^https?:\/\/[^/]+\/api\/?/i, "").replace(/^\/api\/?/i, "");
  return PLATFORM_TAGGED_AUTH_PATHS.test(path);
};

const addEfruitmandiPlatform = (data) => {
  if (!data) return { platform: EFRUITMANDI_PLATFORM };
  if (typeof FormData !== "undefined" && data instanceof FormData) {
    if (!data.has("platform")) data.append("platform", EFRUITMANDI_PLATFORM);
    return data;
  }
  if (typeof data === "object" && !(data instanceof URLSearchParams)) {
    return { ...data, platform: data.platform || EFRUITMANDI_PLATFORM };
  }
  return data;
};

export const getApiFieldErrors = (error) => {
  const data = error?.response?.data;
  if (!data) return {};

  if (data.errors && typeof data.errors === "object" && !Array.isArray(data.errors)) {
    return data.errors;
  }

  if (Array.isArray(data.fieldErrors)) {
    return data.fieldErrors.reduce((acc, item) => {
      if (item?.field) acc[item.field] = item.message || "Invalid value";
      return acc;
    }, {});
  }

  return {};
};

export const getApiErrorMessage = (error, fallback = "Request failed.") => {
  const data = error?.response?.data;
  if (isDevelopment && error?.response) {
    console.error("API request failed", {
      status: error.response.status,
      url: error.config?.url,
      data,
    });
  }

  if (typeof data?.msg === "string" && data.msg.trim()) return data.msg;
  if (typeof data?.message === "string" && data.message.trim()) return data.message;
  if (typeof error?.message === "string" && error.message.trim()) return error.message;
  return fallback;
};

// ================= AXIOS INSTANCE =================
const API = axios.create({
  baseURL: API_BASE_URL,
});

// ================= REQUEST INTERCEPTOR =================
API.interceptors.request.use((config) => {
  if (isPaymentPartnerDisabledPath(config.url)) {
    throw createPaymentUnavailableError();
  }

  const token = localStorage.getItem("accessToken");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (shouldTagAuthPlatform(config.url)) {
    config.data = addEfruitmandiPlatform(config.data);
  }

  return config;
});


// ================= REFRESH TOKEN LOGIC =================
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};


// ================= RESPONSE INTERCEPTOR =================
API.interceptors.response.use(
  (response) => response,

  async (error) => {
    const originalRequest = error.config;

    // ❗ HANDLE TOKEN EXPIRED
    if (
      error.response?.status === 401 &&
      !originalRequest._retry
    ) {
      const hadAccessToken = Boolean(localStorage.getItem("accessToken"));

      if (!hadAccessToken) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return API(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = localStorage.getItem("refreshToken");

        if (!refreshToken) {
          logoutUser();
          return Promise.reject(error);
        }

        // 🔥 USE SAME BASE URL (IMPORTANT)
        const res = await API.post("/auth/refresh", {
          refreshToken,
        });

        const newAccessToken = res.data.accessToken;

        localStorage.setItem("accessToken", newAccessToken);

        // update default header
        API.defaults.headers.common[
          "Authorization"
        ] = `Bearer ${newAccessToken}`;

        processQueue(null, newAccessToken);

        // retry original request
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return API(originalRequest);

      } catch (err) {
        processQueue(err, null);

        // ❌ logout if refresh fails
        logoutUser();

        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default API;
