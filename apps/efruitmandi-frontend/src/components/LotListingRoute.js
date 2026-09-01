import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import API from "../services/api";
import {
  getCurrentUser,
  getFruitLotListingAccess,
  hasAccessToken,
  LOT_LISTING_ACCESS_MESSAGES,
  LOT_LISTING_ACCESS_STATES,
} from "../utils/auth";

export const getCanonicalLotListingOptions = (payload = {}) => {
  const authorization = payload?.lotListingAuthorization;
  const eligibility = payload?.eligibility;
  const authorizationResolved = typeof authorization?.allowed === "boolean";
  const eligibilityResolved = typeof eligibility?.eligible === "boolean";
  const canonicalStatus = String(eligibility?.status || "").trim().toUpperCase();

  return {
    canonicalResolved:
      Boolean(canonicalStatus) && (authorizationResolved || eligibilityResolved),
    canonicalStatus,
    canonicalEligible: authorizationResolved
      ? authorization.allowed
      : eligibility?.eligible,
  };
};

export const getLotListingDebugSnapshot = (user = {}, payload = {}) => {
  return {
    user: {
      identityRef: user?.identityRef || null,
      role: user?.role || null,
      activeRole: user?.activeRole || null,
      profileTypes: Array.isArray(user?.profileTypes) ? user.profileTypes : [],
    },
    canonical: {
      identityRef: payload?.user?.identityRef || null,
      status: payload?.eligibility?.status || null,
      approved: payload?.eligibility?.approved,
      panComplete: payload?.eligibility?.panComplete,
      eligible: payload?.eligibility?.eligible,
      authorizationCode: payload?.lotListingAuthorization?.code || null,
      authorizationAllowed: payload?.lotListingAuthorization?.allowed,
    },
  };
};

export const isSameAuthorizationIdentity = (profile = {}, kycPayload = {}) =>
  Boolean(
    profile?.identityRef &&
    kycPayload?.user?.identityRef &&
    profile.identityRef === kycPayload.user.identityRef
  );

export const getLotListingRedirectState = (access, location = {}) => {
  if (access?.allowed || access?.state === LOT_LISTING_ACCESS_STATES.LOADING) return null;

  const messageByCode = {
    UNAUTHENTICATED: LOT_LISTING_ACCESS_MESSAGES.VISITOR,
    NOT_GROWER: LOT_LISTING_ACCESS_MESSAGES.GROWER_REQUIRED,
    KYC_PENDING: LOT_LISTING_ACCESS_MESSAGES.KYC_APPROVAL_REQUIRED,
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

export const getLotListingRedirect = (access, location = {}) => {
  const state = getLotListingRedirectState(access, location);
  if (!state) return null;

  if (
    access?.state === LOT_LISTING_ACCESS_STATES.KYC_INCOMPLETE ||
    access?.state === LOT_LISTING_ACCESS_STATES.KYC_PENDING
  ) {
    return {
      to: "/kyc",
      state: {
        from: state.from,
        roleType: "grower",
        intent: "list-lot",
        message: state.message,
      },
    };
  }

  if (access?.state === LOT_LISTING_ACCESS_STATES.NOT_GROWER) {
    return {
      to: "/profile-dashboard",
      state: { from: state.from, message: state.message },
    };
  }

  return { to: "/profile", state };
};

export default function LotListingRoute({ children }) {
  const location = useLocation();
  const [access, setAccess] = useState(() => {
    const authenticated = hasAccessToken();
    return getFruitLotListingAccess(getCurrentUser(), {
      authResolved: true,
      authenticated,
      userResolved: !authenticated,
      canonicalResolved: false,
    });
  });

  useEffect(() => {
    let active = true;

    const resolveAccess = async () => {
      const authenticated = hasAccessToken();
      if (!authenticated) {
        if (active) {
          setAccess(getFruitLotListingAccess({}, {
            authResolved: true,
            authenticated: false,
          }));
        }
        return;
      }

      setAccess(getFruitLotListingAccess({}, {
        authResolved: true,
        authenticated: true,
        userResolved: false,
        canonicalResolved: false,
      }));

      try {
        const profileResponse = await API.get("/user/profile", {
          params: { authorizationOnly: 1 },
        });
        if (!active) return;
        const freshUser = profileResponse.data || {};

        const profileAccess = getFruitLotListingAccess(freshUser, {
          authResolved: true,
          authenticated: true,
          userResolved: true,
          canonicalResolved: false,
        });
        if (profileAccess.state === LOT_LISTING_ACCESS_STATES.NOT_GROWER) {
          setAccess(profileAccess);
          return;
        }

        const kycResponse = await API.get("/kyc/me", {
          params: { roleType: "grower", authorizationOnly: 1 },
        });
        if (!active) return;

        const canonicalOptions = getCanonicalLotListingOptions(kycResponse.data);
        if (!isSameAuthorizationIdentity(freshUser, kycResponse.data)) {
          console.warn("[ListLot] profile and KYC identity did not resolve together");
          setAccess({
            ...getFruitLotListingAccess({}, {
              authResolved: false,
              authenticated: true,
            }),
            message: "Unable to verify Grower KYC. Please try again.",
          });
          return;
        }
        if (process.env.NODE_ENV === "development") {
          console.debug(
            "[ListLot] hydrated authorization inputs",
            getLotListingDebugSnapshot(freshUser, kycResponse.data)
          );
        }
        setAccess(getFruitLotListingAccess(freshUser, {
          authResolved: true,
          authenticated: true,
          userResolved: true,
          ...canonicalOptions,
        }));
      } catch (error) {
        if (!active) return;
        const unauthenticated = error?.response?.status === 401 || !hasAccessToken();
        if (unauthenticated) {
          setAccess(getFruitLotListingAccess({}, {
            authResolved: true,
            authenticated: false,
          }));
          return;
        }

        console.warn("[ListLot] authorization remains unresolved", {
          status: error?.response?.status || null,
          code: error?.response?.data?.code || null,
        });
        setAccess({
          ...getFruitLotListingAccess({}, {
            authResolved: false,
            authenticated: true,
          }),
          message: "Unable to verify Grower KYC. Please try again.",
        });
      }
    };

    resolveAccess();

    return () => {
      active = false;
    };
  }, []);

  if (access.state === LOT_LISTING_ACCESS_STATES.LOADING) {
    return (
      <div className="mx-auto min-h-[calc(100vh-132px)] w-full max-w-4xl bg-white px-4 py-8 text-center text-sm font-bold text-green-800 md:min-h-[calc(100vh-94px)]">
        {access.message || "Checking Grower KYC..."}
      </div>
    );
  }

  if (!access.allowed) {
    const redirect = getLotListingRedirect(access, location);
    return (
      <Navigate
        to={redirect.to}
        replace
        state={redirect.state}
      />
    );
  }

  return children;
}
