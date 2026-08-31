import { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import API from "../services/api";
import {
  getCurrentUser,
  getFruitLotListingAccess,
  hasAccessToken,
  LOT_LISTING_ACCESS_MESSAGES,
} from "../utils/auth";

export const getLotListingRedirectState = (access, location = {}) => {
  if (access?.allowed) return null;

  const messageByCode = {
    VISITOR: LOT_LISTING_ACCESS_MESSAGES.VISITOR,
    GROWER_REQUIRED: LOT_LISTING_ACCESS_MESSAGES.GROWER_REQUIRED,
    KYC_INCOMPLETE: LOT_LISTING_ACCESS_MESSAGES.KYC_INCOMPLETE,
    KYC_APPROVAL_REQUIRED: LOT_LISTING_ACCESS_MESSAGES.KYC_APPROVAL_REQUIRED,
  };

  return {
    mode: "login",
    from: `${location.pathname || "/list-new-lot"}${location.search || ""}${location.hash || ""}`,
    requiredProfile: "grower",
    message:
      messageByCode[access?.code] ||
      access?.message ||
      LOT_LISTING_ACCESS_MESSAGES.KYC_INCOMPLETE,
  };
};

export default function LotListingRoute({ children }) {
  const location = useLocation();
  const user = useMemo(() => getCurrentUser(), []);
  const authenticated = hasAccessToken();
  const localAccess = getFruitLotListingAccess(user, { authenticated });
  const requiresCanonicalCheck = authenticated && localAccess.code !== "GROWER_REQUIRED";
  const [canonicalAccess, setCanonicalAccess] = useState(
    requiresCanonicalCheck ? null : localAccess
  );

  useEffect(() => {
    if (!requiresCanonicalCheck) return undefined;

    let active = true;
    API.get("/kyc/me", { params: { roleType: "grower" } })
      .then((response) => {
        if (!active) return;
        setCanonicalAccess(getFruitLotListingAccess(user, {
          authenticated: true,
          canonicalStatus: response.data?.eligibility?.status || response.data?.kyc?.status,
          canonicalEligible: response.data?.eligibility?.eligible === true,
        }));
      })
      .catch((error) => {
        if (!active) return;
        setCanonicalAccess({
          allowed: false,
          code: error?.response?.data?.code || "KYC_INCOMPLETE",
          message:
            error?.response?.data?.msg || LOT_LISTING_ACCESS_MESSAGES.KYC_INCOMPLETE,
        });
      });

    return () => {
      active = false;
    };
  }, [localAccess.code, localAccess.message, requiresCanonicalCheck, user]);

  if (!canonicalAccess) {
    return (
      <div className="mx-auto min-h-[calc(100vh-132px)] w-full max-w-4xl bg-white px-4 py-8 text-center text-sm font-bold text-green-800 md:min-h-[calc(100vh-94px)]">
        Checking Grower KYC...
      </div>
    );
  }

  if (!canonicalAccess.allowed) {
    const redirectState = getLotListingRedirectState(canonicalAccess, location);
    return (
      <Navigate
        to="/profile"
        replace
        state={redirectState}
      />
    );
  }

  return children;
}
