import { describe, expect, it } from "vitest";
import { isRoleOgPubliclyVerified } from "./publicProfileVerification.js";

const approvedOg = {
  status: "APPROVED",
  requestId: "request-1",
  decidedAt: new Date(),
};

describe("public OG verification state", () => {
  it("accepts only an approved and decided role-specific request with eligible KYC", () => {
    expect(isRoleOgPubliclyVerified({ isKycVerified: true, roleOg: approvedOg })).toBe(true);
  });

  it("rejects pending requests, incomplete approval records, and ineligible KYC", () => {
    expect(
      isRoleOgPubliclyVerified({
        isKycVerified: true,
        roleOg: { ...approvedOg, status: "SUBMITTED" },
      })
    ).toBe(false);
    expect(
      isRoleOgPubliclyVerified({
        isKycVerified: true,
        roleOg: { status: "APPROVED", requestId: "request-1" },
      })
    ).toBe(false);
    expect(isRoleOgPubliclyVerified({ isKycVerified: false, roleOg: approvedOg })).toBe(false);
  });

  it("does not accept a legacy boolean in place of the role approval record", () => {
    expect(
      isRoleOgPubliclyVerified({
        isKycVerified: true,
        roleOg: {},
        growerOgVerified: true,
      })
    ).toBe(false);
  });
});
