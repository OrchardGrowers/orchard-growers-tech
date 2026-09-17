import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import BuyerVerificationBadge, { getBuyerVerificationLevel } from "./BuyerVerificationBadge";
import { PublicProfileCard } from "../pages/Home";

describe("Buyer verification badges", () => {
  it.each([
    [{}, "REGISTERED"],
    [{ isKycVerified: false, isOgVerified: false }, "REGISTERED"],
    [{ isKycVerified: true, isOgVerified: false }, "VERIFIED"],
    [{ isKycVerified: true, isOgVerified: true }, "OG_VERIFIED"],
    [{ isKycVerified: false, isOgVerified: true }, "REGISTERED"],
    [{ isKycVerified: "true", isOgVerified: "true" }, "REGISTERED"],
    [{ isKycVerified: true, isOgVerified: "true" }, "VERIFIED"],
    [{ buyerVerified: true, buyerOgVerified: true }, "REGISTERED"],
    [{ growerVerificationLevel: "OG_VERIFIED" }, "REGISTERED"],
    [{ isKycVerified: false, kycByRole: { buyer: { status: "PENDING" } } }, "REGISTERED"],
    [{ isKycVerified: true, isOgVerified: false, ogVerificationByRole: { buyer: { status: "PENDING", requestId: "paid-request" } } }, "VERIFIED"],
    [{ isKycVerified: true, isOgVerified: false, ogVerificationByRole: { buyer: { status: "REJECTED", requestId: "paid-request" } } }, "VERIFIED"],
  ])("uses backend Buyer approval flags for %j", (profile, expected) => {
    expect(getBuyerVerificationLevel(profile)).toBe(expected);
  });

  it.each([
    ["REGISTERED", "REGISTERED BUYER"],
    ["VERIFIED", "VERIFIED BUYER"],
    ["OG_VERIFIED", "OG VERIFIED BUYER"],
  ])("renders the matching %s artwork with Buyer copy", (level, title) => {
    const html = renderToStaticMarkup(<BuyerVerificationBadge level={level} />);
    expect(html).toContain(`data-buyer-verification-level="${level}"`);
    expect(html).toContain(`aria-label="${title}"`);
    expect(html).toContain(`grower-verification-badge--${level.toLowerCase()}`);
    expect(html).not.toContain("data-grower-verification-level");
    expect(html).not.toContain("GROWER");
  });

  it.each([undefined, null, "", "UNKNOWN"])("does not invent a level for %s", (level) => {
    expect(renderToStaticMarkup(<BuyerVerificationBadge level={level} />)).toBe("");
  });

  it.each([
    [false, false, "REGISTERED"],
    [true, false, "VERIFIED"],
    [true, true, "OG_VERIFIED"],
  ])("shows exactly one homepage Buyer badge for KYC=%s, OG=%s", (isKycVerified, isOgVerified, level) => {
    const html = renderToStaticMarkup(<PublicProfileCard role="buyer" profile={{
      _id: "buyer-123", companyName: "Valley Fruit", isKycVerified, isOgVerified,
    }} />);
    expect((html.match(/data-buyer-verification-level=/g) || [])).toHaveLength(1);
    expect(html).toContain(`data-buyer-verification-level="${level}"`);
    expect(html).not.toContain("data-grower-verification-level");
    expect(html).toContain("View Profile");
    expect(html).toContain("Rate Buyer");
  });
});
