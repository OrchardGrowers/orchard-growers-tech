import { describe, expect, it } from "vitest";
import { getFruitLotListingAccess } from "../utils/auth";
import { getLotListingRedirectState } from "./LotListingRoute";

const directLocation = { pathname: "/list-new-lot", search: "", hash: "" };
const grower = { role: "grower", activeRole: "grower", profileTypes: ["grower"] };

const directRouteResult = (user, options) => {
  const access = getFruitLotListingAccess(user, options);
  return {
    access,
    redirect: getLotListingRedirectState(access, directLocation),
  };
};

describe("direct /list-new-lot route decisions", () => {
  it("redirects a visitor to the login/signup profile flow", () => {
    expect(directRouteResult({}, { authenticated: false })).toMatchObject({
      access: { allowed: false },
      redirect: {
        mode: "login",
        from: "/list-new-lot",
        requiredProfile: "grower",
        message: "Please login or Sign up first to continue.",
      },
    });
  });

  it.each([
    ["generic user", { role: "user", profileTypes: [] }],
    ["buyer", { role: "buyer", activeRole: "buyer", profileTypes: ["buyer"] }],
    ["verified buyer with grower profile", {
      role: "buyer",
      activeRole: "buyer",
      profileTypes: ["buyer", "grower"],
      growerVerified: true,
    }],
  ])("denies %s", (_label, user) => {
    expect(directRouteResult(user, { authenticated: true })).toMatchObject({
      access: { allowed: false, code: "GROWER_REQUIRED" },
      redirect: { message: "Only verified growers can list fruit lots." },
    });
  });

  it.each([
    ["incomplete", "NOT_SUBMITTED", "Please complete your KYC to list a fruit lot."],
    ["rejected", "REJECTED", "Please complete your KYC to list a fruit lot."],
    ["pending", "PENDING", "Your KYC must be approved before you can list a fruit lot."],
    ["under review", "UNDER_REVIEW", "Your KYC must be approved before you can list a fruit lot."],
  ])("denies a grower whose KYC is %s", (_label, canonicalStatus, message) => {
    expect(directRouteResult(grower, {
      authenticated: true,
      canonicalStatus,
      canonicalEligible: false,
    })).toMatchObject({ access: { allowed: false }, redirect: { message } });
  });

  it("allows an approved, canonically eligible grower without a redirect", () => {
    expect(directRouteResult(grower, {
      authenticated: true,
      canonicalStatus: "APPROVED",
      canonicalEligible: true,
    })).toEqual({
      access: { allowed: true, code: "AUTHORIZED", message: "" },
      redirect: null,
    });
  });
});
