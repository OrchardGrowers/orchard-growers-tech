export const DEFAULT_PROFILE_MEDIA = {
  grower: {
    banner: "/assets/defaults/grower-profile-banner.webp",
    logo: "/assets/defaults/grower-profile-logo.svg",
  },
  buyer: {
    banner: "/assets/defaults/buyer-profile-banner.webp",
    logo: "/assets/defaults/buyer-profile-logo.svg",
  },
};

const BUYER_TYPES = new Set(["buyer", "exporter", "commission-agent", "cold-storage"]);

export const normalizeProfileRole = (role = "") =>
  BUYER_TYPES.has(String(role).trim().toLowerCase().replace(/_/g, "-")) ? "buyer" : "grower";

const firstImage = (...values) => values.find((value) => typeof value === "string" && value.trim()) || "";

// Public endpoints project role-specific media to logoUrl/bannerUrl. Legacy
// records and search results still expose their original fields.
export const getProfileMedia = (profile = {}, role) => {
  const source = profile || {};
  const profileRole = normalizeProfileRole(role || source.role || source.activeRole || source.businessType || source.type);
  return {
    logo: profileRole === "buyer"
      ? firstImage(source.logoUrl, source.buyerCompanyLogoUrl, source.companyLogoUrl, source.buyerAvatarUrl, source.avatarUrl, source.profileImage, source.avatar, source.image)
      : firstImage(source.logoUrl, source.companyLogoUrl, source.avatarUrl, source.profileImage, source.avatar, source.image),
    banner: profileRole === "buyer"
      ? firstImage(source.buyerBannerUrl, source.bannerUrl)
      : firstImage(source.bannerUrl),
  };
};

export const resolveProfileMediaUrl = (value, baseUrl = "") => {
  if (typeof value !== "string") return "";
  const image = value.trim().replace(/\\/g, "/");
  if (!image || /[\u0000-\u001f\u007f]/.test(image)) return "";

  try {
    if (/^(https?:\/\/|\/\/)/i.test(image)) {
      const url = new URL(image.startsWith("//") ? `https:${image}` : image);
      return url.hostname && !url.username && !url.password ? url.href : "";
    }
    // Other protocols, incomplete schemes, and plain placeholder text are not
    // remote images. Actual relative uploads must resolve against the backend.
    if (/^[a-z][a-z\d+.-]*:/i.test(image) || image.startsWith("//")) return "";
    const path = image.replace(/^\/+/, "");
    if (!/^(uploads|assets|profile-banners)\//i.test(path) && !/\.(avif|webp|png|jpe?g|gif|svg)(?:[?#]|$)/i.test(path)) return "";
    if (/^(assets|profile-banners)\//i.test(path)) return `/${path}`;
    const url = new URL(path, `${String(baseUrl).replace(/\/+$/, "")}/`);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
};
