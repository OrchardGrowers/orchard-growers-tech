export const INSTALL_PROMPT_EVENT = "efruitmandi-install-app";
export const INSTALL_QUERY_PARAM = "install_app";

const envValue = (viteKey, reactKey) =>
  (typeof import.meta !== "undefined" && import.meta.env?.[viteKey]) ||
  (typeof process !== "undefined" && process.env?.[reactKey]) ||
  "";

const getPublicInstallOrigin = () => {
  const configured =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_EFRUITMANDI_PUBLIC_URL) ||
    (typeof process !== "undefined" && process.env?.REACT_APP_EFRUITMANDI_PUBLIC_URL) ||
    "";
  if (configured) return configured.replace(/\/+$/, "");

  if (typeof window === "undefined") return "https://www.efruitmandi.live";
  if (/^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname)) {
    return "https://www.efruitmandi.live";
  }
  return window.location.origin;
};

export const getEFruitInstallLink = () => {
  if (typeof window === "undefined") return "https://www.efruitmandi.live/download-app";
  const url = new URL(getPublicInstallOrigin());
  url.pathname = "/download-app";
  url.search = "";
  url.hash = "";
  return url.toString();
};

export const isIosDevice = () => {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent || "";
  return /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && window.navigator.maxTouchPoints > 1);
};

export const getInstallPlatform = () => {
  if (typeof window === "undefined") return "desktop";
  const ua = window.navigator.userAgent || "";
  if (isIosDevice()) return "ios";
  if (/android/i.test(ua)) return "android";
  if (/windows|win32|win64/i.test(ua)) return "windows";
  return "desktop";
};

export const getNativeAppDownloadLink = (platform = getInstallPlatform()) => {
  const links = {
    android: envValue("VITE_ANDROID_APP_URL", "REACT_APP_ANDROID_APP_URL"),
    ios: envValue("VITE_IOS_APP_URL", "REACT_APP_IOS_APP_URL"),
    windows: envValue("VITE_WINDOWS_APP_URL", "REACT_APP_WINDOWS_APP_URL"),
    desktop: envValue("VITE_DESKTOP_APP_URL", "REACT_APP_DESKTOP_APP_URL"),
  };

  return links[platform] || "";
};

export const openEFruitInstallPrompt = (detail = {}) => {
  if (typeof window === "undefined") return;
  window.__efruitMandiInstallPromptRequested = detail || { source: "manual" };
  window.dispatchEvent(new CustomEvent(INSTALL_PROMPT_EVENT, { detail }));
};

export const consumePendingInstallPrompt = () => {
  if (typeof window === "undefined") return null;
  const pending = window.__efruitMandiInstallPromptRequested || null;
  window.__efruitMandiInstallPromptRequested = null;
  return pending;
};
