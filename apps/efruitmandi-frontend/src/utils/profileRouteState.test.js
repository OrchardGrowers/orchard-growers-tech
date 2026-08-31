import { describe, expect, it } from "vitest";
import { getLotListingRedirectState } from "../components/LotListingRoute";
import {
  getFruitLotListingAccess,
  LOT_LISTING_ACCESS_MESSAGES,
} from "./auth";
import {
  consumedProfileRouteState,
  readProfileRouteState,
} from "./profileRouteState";

const listLotLocation = { pathname: "/list-new-lot", search: "", hash: "" };
const grower = { role: "grower", activeRole: "grower", profileTypes: ["grower"] };

const getProfileNotice = (user, options) => {
  const access = getFruitLotListingAccess(user, options);
  const redirectState = getLotListingRedirectState(access, listLotLocation);
  return readProfileRouteState(redirectState).notice;
};

describe("profile List Lot redirect notices", () => {
  it("shows the login/signup message when a visitor clicks List Lot", () => {
    expect(getProfileNotice({}, { authenticated: false })).toEqual({
      type: "error",
      text: LOT_LISTING_ACCESS_MESSAGES.VISITOR,
    });
  });

  it("shows no List Lot error for a direct /profile visit", () => {
    expect(readProfileRouteState(null).notice).toEqual({ type: "", text: "" });
  });

  it("shows the KYC completion message for an incomplete grower", () => {
    expect(getProfileNotice(grower, {
      authenticated: true,
      canonicalStatus: "NOT_SUBMITTED",
      canonicalEligible: false,
    }).text).toBe(LOT_LISTING_ACCESS_MESSAGES.KYC_INCOMPLETE);
  });

  it("shows the approval-pending message for a pending grower", () => {
    expect(getProfileNotice(grower, {
      authenticated: true,
      canonicalStatus: "PENDING",
      canonicalEligible: false,
    }).text).toBe(LOT_LISTING_ACCESS_MESSAGES.KYC_APPROVAL_REQUIRED);
  });

  it("does not restore a consumed redirect notice on refresh or a new direct visit", () => {
    const firstVisit = readProfileRouteState({
      mode: "login",
      from: "/list-new-lot",
      requiredProfile: "grower",
      message: LOT_LISTING_ACCESS_MESSAGES.VISITOR,
    });
    const laterVisit = readProfileRouteState(consumedProfileRouteState);

    expect(firstVisit.shouldConsume).toBe(true);
    expect(laterVisit).toMatchObject({
      shouldConsume: false,
      notice: { type: "", text: "" },
    });
  });
});
