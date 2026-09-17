import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import SafeProfileImage from "./SafeProfileImage";
import { DEFAULT_PROFILE_MEDIA } from "../utils/profileMedia";
import { PublicProfileCard } from "../pages/Home";

const renderImage = (props) => renderToStaticMarkup(
  <SafeProfileImage businessName="Valley Fruit" baseUrl="https://api.example.test" {...props} />
);

describe("SafeProfileImage", () => {
  it.each(["grower", "buyer"])("keeps a valid uploaded %s logo", (role) => {
    const html = renderImage({ role, src: "https://cdn.example.test/logo.png" });
    expect(html).toContain('src="https://cdn.example.test/logo.png"');
    expect(html).toContain('data-default-media="false"');
    expect(html).toContain(`alt="Valley Fruit ${role} profile logo"`);
    expect(html).not.toContain(DEFAULT_PROFILE_MEDIA[role].logo);
  });

  it.each(["grower", "buyer"])("renders local %s logo and banner defaults for absent or invalid values", (role) => {
    for (const kind of ["logo", "banner"]) {
      for (const src of [undefined, null, "", "   ", "not a URL", "https://"]) {
        const html = renderImage({ role, kind, src });
        expect(html).toContain(`src="${DEFAULT_PROFILE_MEDIA[role][kind]}"`);
        expect(html).toContain('data-default-media="true"');
        expect(html).toContain(`alt="Valley Fruit ${role} profile ${kind}"`);
      }
    }
  });

  it("resolves relative uploaded media against the backend", () => {
    expect(renderImage({ role: "buyer", src: "/uploads/buyer-logo.png" }))
      .toContain('src="https://api.example.test/uploads/buyer-logo.png"');
  });

  it("preserves uploaded banner srcSet and reserves its dimensions", () => {
    const html = renderImage({
      role: "grower",
      kind: "banner",
      src: "https://cdn.example.test/banner.webp",
      srcSet: "https://cdn.example.test/banner-small.webp 640w, https://cdn.example.test/banner.webp 1600w",
      sizes: "100vw",
    });
    expect(html).toContain('data-default-media="false"');
    expect(html).toContain('srcSet="https://cdn.example.test/banner-small.webp 640w, https://cdn.example.test/banner.webp 1600w"');
    expect(html).toContain('sizes="100vw"');
    expect(html).toContain('style="aspect-ratio:16 / 5"');
    expect(html).toContain('width="1600" height="500"');
    expect(html).toContain("object-cover");
  });

  it("does not let uploaded srcSet override a default banner", () => {
    const html = renderImage({ role: "buyer", kind: "banner", srcSet: "https://cdn.example.test/broken.webp 640w", sizes: "100vw" });
    expect(html).not.toContain("srcSet=");
    expect(html).not.toContain("sizes=");
    expect(html).toContain("bg-gradient-to-t");
  });

  it("reserves circular logo space and allows local aspect ratio overrides", () => {
    const logo = renderImage({ role: "grower" });
    expect(logo).toContain('style="aspect-ratio:1 / 1"');
    expect(logo).toContain('width="96" height="96"');
    expect(logo).toContain("rounded-full");
    expect(renderImage({ kind: "banner", style: { aspectRatio: "16 / 6" } }))
      .toContain('style="aspect-ratio:16 / 6"');
  });
});

describe("homepage profile card banner", () => {
  it.each([
    ["grower", "VERIFIED GROWER", "Rate Grower"],
    ["buyer", "REGISTERED BUYER", "Rate Buyer"],
  ])("places the %s identity over the banner and preserves profile buttons", (role, badge, rateLabel) => {
    const html = renderToStaticMarkup(<PublicProfileCard role={role} profile={{
      _id: "profile-123",
      companyName: "Valley Fruit",
      mainLocation: "Barmer, Rajasthan",
      growerVerificationLevel: "VERIFIED",
    }} />);
    const [banner, footer] = html.split('<div class="border-t border-gray-100 p-3">');
    expect(banner).toContain('data-profile-media="banner"');
    expect(banner).toContain("absolute inset-x-0 top-0");
    expect(banner).toContain(">Valley Fruit</h3>");
    expect(banner).toContain(">Barmer, Rajasthan</p>");
    expect(banner).toContain(badge);
    expect(banner).toContain('data-profile-media="logo"');
    expect(footer).toContain(`aria-label="View ${role} profile: Valley Fruit"`);
    expect(footer).toContain(`aria-label="Rate ${role}: Valley Fruit"`);
    expect(footer).toContain(">View Profile</button>");
    expect(footer).toContain(`>${rateLabel}</button>`);
  });
});
