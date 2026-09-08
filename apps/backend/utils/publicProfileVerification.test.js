import { describe, expect, it } from "vitest";
import {
  getGrowerVerificationLevel,
  getPublicGrowerKycEligibility,
  isRoleOgPubliclyVerified,
} from "./publicProfileVerification.js";

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

describe("normalized public Grower verification level", () => {
  it.each(["NOT_SUBMITTED", "INCOMPLETE", "PENDING", "UNDER_REVIEW", "REJECTED", "unexpected"])(
    "maps non-approved canonical KYC (%s) to REGISTERED",
    (kycStatus) => {
      expect(getGrowerVerificationLevel({ kycStatus, isKycEligible: false })).toBe("REGISTERED");
    }
  );

  it("maps canonical approved and eligible Grower KYC to VERIFIED", () => {
    expect(getGrowerVerificationLevel({ kycStatus: "APPROVED", isKycEligible: true })).toBe("VERIFIED");
  });

  it.each(["SUBMITTED", "REJECTED"])("keeps approved KYC at VERIFIED when OG is %s", (status) => {
    expect(getGrowerVerificationLevel({
      kycStatus: "APPROVED",
      isKycEligible: true,
      roleOg: { ...approvedOg, status },
    })).toBe("VERIFIED");
  });

  it("returns OG_VERIFIED only for strict final role-specific OG approval", () => {
    expect(getGrowerVerificationLevel({
      kycStatus: "APPROVED",
      isKycEligible: true,
      roleOg: approvedOg,
    })).toBe("OG_VERIFIED");
  });

  it("does not promote stale legacy Grower or OG booleans", () => {
    expect(getGrowerVerificationLevel({
      kycStatus: "NOT_SUBMITTED",
      isKycEligible: true,
      growerVerified: true,
      growerOgVerified: true,
    })).toBe("REGISTERED");
    expect(getGrowerVerificationLevel({
      kycStatus: "APPROVED",
      isKycEligible: true,
      growerOgVerified: true,
    })).toBe("VERIFIED");
  });
});

describe("public Grower KYC ownership", () => {
  const approved = { status: "APPROVED", panNumber: "ABCDE1234F", panImage: "private-pan" };
  it.each([undefined, "buyer"])("rejects legacy KYC tagged %s", (roleType) => {
    expect(getPublicGrowerKycEligibility({ kyc: { ...approved, roleType } }).eligible).toBe(false);
  });
  it("accepts explicitly Grower-owned legacy KYC", () => {
    expect(getPublicGrowerKycEligibility({ kyc: { ...approved, roleType: "grower" } }).eligible).toBe(true);
  });
});
