import {
  getCurrentUser,
  hasBuyerProfile,
  hasDriverProfile,
  hasGrowerProfile,
} from "./auth";

const INSTALL_ANALYTICS_KEY = "efruitmandiInstallAnalytics";

const resolveInstallRole = () => {
  const user = getCurrentUser();
  if (hasBuyerProfile(user)) return "buyer";
  if (hasGrowerProfile(user)) return "grower";
  if (hasDriverProfile(user)) return "driver";
  return "guest";
};

export const trackInstallEvent = (eventName, details = {}) => {
  try {
    const role = resolveInstallRole();
    const current = JSON.parse(window.localStorage.getItem(INSTALL_ANALYTICS_KEY) || "{}");
    const events = Array.isArray(current[role]) ? current[role] : [];
    events.push({
      event: eventName,
      at: new Date().toISOString(),
      details,
    });
    current[role] = events.slice(-100);
    window.localStorage.setItem(INSTALL_ANALYTICS_KEY, JSON.stringify(current));
  } catch {
    // Analytics must never block install or app navigation.
  }
};
