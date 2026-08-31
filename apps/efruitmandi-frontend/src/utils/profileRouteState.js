const DEFAULT_AUTH_REDIRECT = Object.freeze({
  from: "/profile-dashboard",
  requiredProfile: "",
});

export const readProfileRouteState = (state) => {
  const routeState = state && typeof state === "object" ? state : {};
  const message = typeof routeState.message === "string"
    ? routeState.message.trim()
    : "";

  return {
    mode: routeState.mode === "signup" ? "signup" : "login",
    hasExplicitMode: routeState.mode === "signup" || routeState.mode === "login",
    redirect: {
      from: routeState.from || DEFAULT_AUTH_REDIRECT.from,
      requiredProfile:
        routeState.requiredProfile || DEFAULT_AUTH_REDIRECT.requiredProfile,
    },
    hasRedirectTarget: Boolean(routeState.from || routeState.requiredProfile),
    notice: {
      type: message ? "error" : "",
      text: message,
    },
    shouldConsume: Boolean(message),
  };
};

export const consumedProfileRouteState = null;
