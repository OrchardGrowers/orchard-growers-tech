import { sanitizeUserForStorage } from "./userStorage";

export const logoutUser = () => {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("user");

  window.location.href = "/";
};

export const getCurrentUser = () => {
  try {
    const user = JSON.parse(localStorage.getItem("user")) || {};
    return sanitizeUserForStorage(user);
  } catch {
    return {};
  }
};

export const getProfileTypes = (user = getCurrentUser()) => {
  const profiles = new Set(Array.isArray(user.profileTypes) ? user.profileTypes : []);

  if (user.role) profiles.add(user.role);
  if (user.orchardName) profiles.add("grower");
  if (user.businessName || user.buyerContactPerson) profiles.add("buyer");
  if (user.logisticsName || user.vehicleNumber || user.driverName) profiles.add("driver");

  return profiles;
};

export const hasGrowerProfile = (user = getCurrentUser()) =>
  getProfileTypes(user).has("grower");

export const hasBuyerProfile = (user = getCurrentUser()) =>
  getProfileTypes(user).has("buyer");

export const hasDriverProfile = (user = getCurrentUser()) =>
  getProfileTypes(user).has("driver");

export const hasCompletedKyc = (user = getCurrentUser()) =>
  ["COMPLETED", "APPROVED"].includes(String(user?.kyc?.status || "").toUpperCase());

export const isGrowerAccount = (user = getCurrentUser()) =>
  hasGrowerProfile(user);

export const isBuyerAccount = (user = getCurrentUser()) =>
  hasBuyerProfile(user);
