import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { getSafePublicProfile } from "../utils/marketplaceVisibility";
import LimitedPublicProfileCard from "./LimitedPublicProfileCard";
import { DirectoryCard } from "../pages/PublicProfileDirectory";
import GrowerVerificationBadge from "./GrowerVerificationBadge";

describe("GrowerVerificationBadge", () => {
  it.each([
    ["REGISTERED", "REGISTERED GROWER", "badge--registered"],
    ["VERIFIED", "VERIFIED GROWER", "badge--verified"],
    ["OG_VERIFIED", "OG VERIFIED GROWER", "badge--og_verified"],
  ])("renders only the %s design", (level, title, tierClass) => {
    const html = renderToStaticMarkup(<GrowerVerificationBadge level={level} size="compact" />);
    expect(html).toContain(`data-grower-verification-level="${level}"`);
    expect(html).toContain(title);
    expect(html).toContain(tierClass);
    expect((html.match(/data-grower-verification-level=/g) || [])).toHaveLength(1);
  });

  it("retains tier identity in compact mode and hides no title in markup", () => {
    const html = renderToStaticMarkup(<GrowerVerificationBadge level="OG_VERIFIED" size="compact" />);
    expect(html).toContain("badge--compact");
    expect(html).toContain("badge-icon-og-text");
    expect(html).toContain("OG VERIFIED GROWER");
  });

  it("renders the rich supporting copy in full mode", () => {
    const html = renderToStaticMarkup(<GrowerVerificationBadge level="VERIFIED" size="full" />);
    expect(html).toContain("EFRUITMANDI.LIVE");
    expect(html).toContain("TRUSTED • AUTHENTIC • KYC APPROVED");
  });

  it.each([undefined, null, "", "UNKNOWN"])("fails safely for %s", (level) => {
    expect(renderToStaticMarkup(<GrowerVerificationBadge level={level} />)).toBe("");
  });
});

describe("public profile verification isolation", () => {
  const staleFlags = { isKycVerified: true, isOgVerified: true, growerVerified: true, growerOgVerified: true, isTrusted: true, buyerVerified: true, buyerOgVerified: true };
  it.each(["REGISTERED", "VERIFIED", "OG_VERIFIED"])("keeps %s as the sole Grower signal", (level) => {
    const profile = getSafePublicProfile({ businessType: "grower", growerVerificationLevel: level, ...staleFlags });
    expect(profile.growerVerificationLevel).toBe(level);
    expect(profile).not.toHaveProperty("isKycVerified");
    expect(profile).not.toHaveProperty("isOgVerified");
    expect(profile).not.toHaveProperty("isTrusted");
    const html = renderToStaticMarkup(<LimitedPublicProfileCard profile={profile} />);
    expect((html.match(/data-grower-verification-level=/g) || [])).toHaveLength(1);
    expect(html).toContain(`data-grower-verification-level="${level}"`);
    expect(html).not.toContain("KYC Verified");
  });
  it.each([undefined, "UNKNOWN", "verified", " OG_VERIFIED "])("does not invent a Grower level for %s", (level) => {
    const profile = getSafePublicProfile({ businessType: "grower", growerVerificationLevel: level, ...staleFlags });
    expect(profile.growerVerificationLevel).toBe("");
    expect(renderToStaticMarkup(<GrowerVerificationBadge level={level} />)).toBe("");
  });
  it("preserves Buyer normalization and existing card badges", () => {
    const profile = getSafePublicProfile({ businessType: "buyer", buyerVerified: true, buyerOgVerified: true, growerVerificationLevel: "OG_VERIFIED" });
    expect(profile).toMatchObject({ isKycVerified: true, isOgVerified: true, isTrusted: true });
    expect(profile).not.toHaveProperty("growerVerificationLevel");
    const html = renderToStaticMarkup(<LimitedPublicProfileCard profile={profile} />);
    expect(html).toContain("KYC Verified");
    expect(html).toContain("OG Verified");
    expect(html).not.toContain("data-grower-verification-level");
    const directory = renderToStaticMarkup(<MemoryRouter><DirectoryCard profile={profile} role="buyer" label="Buyer" /></MemoryRouter>);
    expect(directory).toContain("Verified profile");
    expect(directory).not.toContain("data-grower-verification-level");
  });
});
