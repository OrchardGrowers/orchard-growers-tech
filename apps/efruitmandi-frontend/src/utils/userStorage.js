export const sanitizeUserForStorage = (user = {}) => {
  const safeUser = { ...user };

  if (typeof safeUser.avatarUrl === "string" && safeUser.avatarUrl.startsWith("data:")) {
    delete safeUser.avatarUrl;
  }

  if (typeof safeUser.bannerUrl === "string" && safeUser.bannerUrl.startsWith("data:")) {
    delete safeUser.bannerUrl;
  }

  if (typeof safeUser.companyLogoUrl === "string" && safeUser.companyLogoUrl.startsWith("data:")) {
    delete safeUser.companyLogoUrl;
  }

  if (typeof safeUser.buyerAvatarUrl === "string" && safeUser.buyerAvatarUrl.startsWith("data:")) {
    delete safeUser.buyerAvatarUrl;
  }

  if (typeof safeUser.buyerBannerUrl === "string" && safeUser.buyerBannerUrl.startsWith("data:")) {
    delete safeUser.buyerBannerUrl;
  }

  if (
    typeof safeUser.buyerCompanyLogoUrl === "string" &&
    safeUser.buyerCompanyLogoUrl.startsWith("data:")
  ) {
    delete safeUser.buyerCompanyLogoUrl;
  }

  return safeUser;
};

export const saveUserToStorage = (user = {}) => {
  const safeUser = sanitizeUserForStorage(user);
  localStorage.setItem("user", JSON.stringify(safeUser));
  return safeUser;
};
