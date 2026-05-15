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

export const isGrowerAccount = (user = getCurrentUser()) =>
  user.role === "grower" || Boolean(user.orchardName);

export const isBuyerAccount = (user = getCurrentUser()) =>
  user.role === "buyer" || Boolean(user.businessName);
