import axios from "axios";

const normalizeBaseUrl = (value: string) => value.trim().replace(/\/+$/, "");
const normalizeApiUrl = (value: string) => {
  const normalized = normalizeBaseUrl(value);
  if (!normalized) return "";
  return /\/api$/i.test(normalized) ? normalized : `${normalized}/api`;
};

const API_ORIGIN = normalizeBaseUrl(
  import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL?.replace(/\/api\/?$/i, "") || ""
);
if (!API_ORIGIN) {
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

API.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");

  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export default API;
