import { describe, expect, it } from "vitest";
import {
  canListFruitLot,
  getFruitLotListingAccess,
  LOT_LISTING_ACCESS_MESSAGES,
} from "./auth";

const approvedGrower = {
  role: "grower",
  profileTypes: ["grower"],
  kycByRole: {
    grower: {
      status: "APPROVED",
      panNumber: "ABCDE1234F",
      panImage: "/uploads/pan-proof.jpg",
    },
  },
};

describe("fruit lot listing access", () => {
  it("rejects visitors and generic users", () => {
    expect(canListFruitLot({})).toBe(false);
    expect(canListFruitLot({ role: "user", profileTypes: ["user"] })).toBe(false);
    expect(getFruitLotListingAccess({}, { authenticated: false })).toMatchObject({
      allowed: false,
      message: LOT_LISTING_ACCESS_MESSAGES.VISITOR,
    });
    expect(getFruitLotListingAccess({ role: "user" }, { authenticated: true })).toMatchObject({
      allowed: false,
      message: LOT_LISTING_ACCESS_MESSAGES.GROWER_REQUIRED,
    });
  });

  it("rejects buyers and growers without completed KYC", () => {
    expect(canListFruitLot({ role: "buyer", profileTypes: ["buyer"] })).toBe(false);
    expect(canListFruitLot({ role: "grower", profileTypes: ["grower"] })).toBe(false);
    expect(canListFruitLot({
      ...approvedGrower,
      kycByRole: { grower: { ...approvedGrower.kycByRole.grower, status: "PENDING" } },
    })).toBe(false);
    expect(getFruitLotListingAccess({
      ...approvedGrower,
      activeRole: "buyer",
      profileTypes: ["buyer", "grower"],
    }, { authenticated: true, canonicalEligible: true })).toMatchObject({
      allowed: false,
      message: LOT_LISTING_ACCESS_MESSAGES.GROWER_REQUIRED,
    });
  });

  it("uses separate incomplete and pending KYC messages", () => {
    expect(getFruitLotListingAccess(approvedGrower, {
      authenticated: true,
      canonicalEligible: false,
      canonicalStatus: "NOT_SUBMITTED",
    }).message).toBe(LOT_LISTING_ACCESS_MESSAGES.KYC_INCOMPLETE);
    expect(getFruitLotListingAccess(approvedGrower, {
      authenticated: true,
      canonicalEligible: false,
      canonicalStatus: "PENDING",
    }).message).toBe(LOT_LISTING_ACCESS_MESSAGES.KYC_APPROVAL_REQUIRED);
  });

  it("allows only a grower with approved KYC and complete PAN proof", () => {
    expect(canListFruitLot(approvedGrower)).toBe(true);
    expect(canListFruitLot({
      ...approvedGrower,
      kycByRole: { grower: { status: "APPROVED", panNumber: "ABCDE1234F" } },
    })).toBe(false);
  });

  it("keeps legacy verified-grower compatibility when PAN proof is complete", () => {
    expect(canListFruitLot({
      role: "grower",
      profileTypes: ["grower"],
      growerVerified: true,
      kyc: {
        roleType: "grower",
        panNumber: "ABCDE1234F",
        panImage: "/uploads/legacy-pan.jpg",
      },
    })).toBe(true);
  });
});
