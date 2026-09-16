import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROFILE_MEDIA,
  getProfileMedia,
  normalizeProfileRole,
  resolveProfileMediaUrl,
} from "./profileMedia";

const backend = "https://api.example.test";

describe("profile media defaults", () => {
  it.each(["grower", "buyer"])("keeps the %s assets local and role specific", (role) => {
    expect(DEFAULT_PROFILE_MEDIA[role]).toEqual({
      banner: `/assets/defaults/${role}-profile-banner.webp`,
      logo: `/assets/defaults/${role}-profile-logo.svg`,
    });
  });

  it.each(["buyer", "exporter", "commission-agent", "commission_agent", "cold-storage", " COLD_STORAGE "])("recognizes buyer type %s", (role) => {
    expect(normalizeProfileRole(role)).toBe("buyer");
  });

  it.each([undefined, null, "", "grower", "GROWER"])("uses grower defaults for %s", (role) => {
    expect(normalizeProfileRole(role)).toBe("grower");
  });
});

describe("resolveProfileMediaUrl", () => {
  it.each([undefined, null, "", "   ", 0, {}, "not an image", "https://", "javascript:alert(1)", "data:image/png;base64,abc", "ftp://example.test/logo.png", "https://user:password@example.test/logo.png", "logo\n.png"])("rejects missing or invalid media %s", (value) => {
    expect(resolveProfileMediaUrl(value, backend)).toBe("");
  });

  it.each([
    ["https://cdn.example.test/logo.webp", "https://cdn.example.test/logo.webp"],
    [" http://cdn.example.test/banner.jpg ", "http://cdn.example.test/banner.jpg"],
    ["//cdn.example.test/logo.png", "https://cdn.example.test/logo.png"],
    ["/uploads/logo.webp", `${backend}/uploads/logo.webp`],
    ["uploads/banner", `${backend}/uploads/banner`],
    ["uploads\\logo.png", `${backend}/uploads/logo.png`],
    ["media/logo.jpg", `${backend}/media/logo.jpg`],
    ["/assets/defaults/grower-profile-logo.svg", "/assets/defaults/grower-profile-logo.svg"],
    ["/profile-banners/default.png", "/profile-banners/default.png"],
  ])("resolves %s without replacing valid uploads", (source, expected) => {
    expect(resolveProfileMediaUrl(source, `${backend}/`)).toBe(expected);
  });
});

describe("getProfileMedia", () => {
  it.each([undefined, null, {}])("handles a missing profile %s", (profile) => {
    expect(getProfileMedia(profile)).toEqual({ logo: "", banner: "" });
  });

  it("prefers projected grower media and ignores buyer-only fields", () => {
    expect(getProfileMedia({
      logoUrl: "/uploads/public-logo.png",
      companyLogoUrl: "/uploads/company-logo.png",
      bannerUrl: "/uploads/grower-banner.png",
      buyerBannerUrl: "/uploads/buyer-banner.png",
    }, "grower")).toEqual({
      logo: "/uploads/public-logo.png",
      banner: "/uploads/grower-banner.png",
    });
  });

  it("skips blank grower values before using legacy media", () => {
    expect(getProfileMedia({ logoUrl: " ", companyLogoUrl: "", avatarUrl: "/uploads/avatar.png" }, "grower"))
      .toEqual({ logo: "/uploads/avatar.png", banner: "" });
  });

  it("uses buyer banner precedence and projected logo precedence", () => {
    expect(getProfileMedia({
      logoUrl: "/uploads/public-logo.png",
      buyerCompanyLogoUrl: "/uploads/buyer-logo.png",
      buyerBannerUrl: "/uploads/buyer-banner.png",
      bannerUrl: "/uploads/general-banner.png",
    }, "buyer")).toEqual({
      logo: "/uploads/public-logo.png",
      banner: "/uploads/buyer-banner.png",
    });
  });

  it.each(["role", "activeRole", "businessType", "type"])("recognizes buyer media through the %s field", (field) => {
    expect(getProfileMedia({
      [field]: "commission_agent",
      buyerCompanyLogoUrl: "/uploads/buyer-logo.png",
      companyLogoUrl: "/uploads/general-logo.png",
      buyerBannerUrl: "",
      bannerUrl: "/uploads/general-banner.png",
    })).toEqual({
      logo: "/uploads/buyer-logo.png",
      banner: "/uploads/general-banner.png",
    });
  });

  it("uses an explicit profile role before inferred fields", () => {
    expect(getProfileMedia({ role: "buyer", buyerAvatarUrl: "/uploads/buyer.png", avatarUrl: "/uploads/grower.png" }, "grower"))
      .toEqual({ logo: "/uploads/grower.png", banner: "" });
  });
});
