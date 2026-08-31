import { describe, expect, it } from "vitest";
import {
  getFruitLotListingAccess,
  LOT_LISTING_ACCESS_STATES,
} from "../utils/auth";
import {
  getCanonicalLotListingOptions,
  getLotListingDebugSnapshot,
  getLotListingRedirectState,
} from "./LotListingRoute";

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

  it("uses the visitor message by authorization code even if stale KYC text is supplied", () => {
    expect(getLotListingRedirectState({
      allowed: false,
      code: "VISITOR",
      message: "Please complete your KYC to list a fruit lot.",
    }, directLocation).message).toBe("Please login or Sign up first to continue.");
  });

  it("does not redirect while auth hydration is delayed", () => {
    const access = getFruitLotListingAccess({}, {
      authResolved: false,
      authenticated: true,
    });
    expect(access.state).toBe(LOT_LISTING_ACCESS_STATES.LOADING);
    expect(getLotListingRedirectState(access, directLocation)).toBeNull();
  });

  it("does not redirect an approved grower while canonical KYC is delayed", () => {
    const access = getFruitLotListingAccess(grower, {
      authenticated: true,
      userResolved: true,
      canonicalResolved: false,
    });
    expect(access.state).toBe(LOT_LISTING_ACCESS_STATES.LOADING);
    expect(getLotListingRedirectState(access, directLocation)).toBeNull();
  });

  it("keeps a partial canonical response loading instead of treating it as incomplete", () => {
    const canonicalOptions = getCanonicalLotListingOptions({
      lotListingAuthorization: {
        allowed: false,
        code: "KYC_INCOMPLETE",
      },
    });
    const access = getFruitLotListingAccess(grower, {
      authenticated: true,
      userResolved: true,
      ...canonicalOptions,
    });

    expect(canonicalOptions.canonicalResolved).toBe(false);
    expect(access.state).toBe(LOT_LISTING_ACCESS_STATES.LOADING);
    expect(getLotListingRedirectState(access, directLocation)).toBeNull();
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
      access: { allowed: false, code: "NOT_GROWER" },
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
      access: {
        allowed: true,
        state: "AUTHORIZED",
        code: "AUTHORIZED",
        message: "",
      },
      redirect: null,
    });
  });

  it("keeps a direct authenticated refresh loading until profile and KYC resolve", () => {
    const beforeProfile = getFruitLotListingAccess({}, {
      authenticated: true,
      userResolved: false,
      canonicalResolved: false,
    });
    const afterProfile = getFruitLotListingAccess(grower, {
      authenticated: true,
      userResolved: true,
      canonicalResolved: false,
    });
    const afterKyc = getFruitLotListingAccess(grower, {
      authenticated: true,
      userResolved: true,
      canonicalResolved: true,
      canonicalStatus: "APPROVED",
      canonicalEligible: true,
    });

    expect([beforeProfile.state, afterProfile.state, afterKyc.state]).toEqual([
      "LOADING",
      "LOADING",
      "AUTHORIZED",
    ]);
  });

  it("reads the minimal backend authorization payload without receiving PAN values", () => {
    const payload = {
      eligibility: {
        status: "APPROVED",
        approved: true,
        panComplete: true,
        eligible: true,
      },
      lotListingAuthorization: {
        allowed: true,
        code: "AUTHORIZED",
        message: "",
      },
    };

    expect(getCanonicalLotListingOptions(payload)).toEqual({
      canonicalResolved: true,
      canonicalStatus: "APPROVED",
      canonicalEligible: true,
    });
    expect(getLotListingDebugSnapshot({
      role: "grower",
      activeRole: "grower",
      profileTypes: ["grower"],
    }, payload)).toMatchObject({
      user: {
        role: "grower",
        activeRole: "grower",
        profileTypes: ["grower"],
      },
      canonical: {
        status: "APPROVED",
        eligible: true,
        authorizationAllowed: true,
      },
    });
  });
});
