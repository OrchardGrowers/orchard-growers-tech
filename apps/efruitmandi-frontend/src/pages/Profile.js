import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  FaCheck,
  FaEnvelope,
  FaEye,
  FaEyeSlash,
  FaFacebookF,
  FaGoogle,
  FaLock,
  FaPaperPlane,
  FaPhoneAlt,
  FaUser,
} from "react-icons/fa";
import API from "../services/api";
import EscrowSecurityIcon from "../components/EscrowSecurityIcon";
import { hasBuyerProfile, hasGrowerProfile } from "../utils/auth";
import { openEFruitInstallPrompt } from "../utils/installPrompt";
import {
  consumedProfileRouteState,
  readProfileRouteState,
} from "../utils/profileRouteState";
import {
  getEfruitMandiWidgetId,
  getEfruitMandiTokenAuth,
  normalizeIndianMobile,
  sendMsg91WidgetOtp,
  verifyMsg91WidgetOtp,
} from "../utils/msg91OtpWidget";
import useOtpVerificationCooldown from "../hooks/useOtpVerificationCooldown";

const logoUrl = `${process.env.PUBLIC_URL || ""}/logo-240.webp`;
const stripApiSuffix = (value = "") =>
  value
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/api$/i, "");
const EFRUIT_APP_NAME = process.env.VITE_APP_NAME || "efruitmandi";
const OTP_RESEND_SECONDS = 60;
const OTP_EXPIRY_SECONDS = Number(process.env.VITE_OTP_EXPIRY_SECONDS || 300);
const OTP_MAX_ATTEMPTS = 5;
const defaultApiOrigin =
  typeof window !== "undefined" && ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname)
    ? "http://localhost:5000"
    : "https://api.efruitmandi.live";
const withOAuthAppParam = (url, appName) => {
  try {
    const nextUrl = new URL(url);
    nextUrl.searchParams.set("app", appName);
    nextUrl.searchParams.delete("platform");
    return nextUrl.toString();
  } catch {
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}app=${encodeURIComponent(appName)}`;
  }
};
const addOAuthParams = (url, mode, termsAccepted) => {
  try {
    const nextUrl = new URL(url);
    nextUrl.searchParams.set("mode", mode);
    if (termsAccepted) nextUrl.searchParams.set("termsAccepted", "true");
    else nextUrl.searchParams.delete("termsAccepted");
    return nextUrl.toString();
  } catch {
    const separator = url.includes("?") ? "&" : "?";
    const termsParam = termsAccepted ? "&termsAccepted=true" : "";
    return `${url}${separator}mode=${encodeURIComponent(mode)}${termsParam}`;
  }
};
const getEfruitOAuthUrl = (provider, mode, termsAccepted) => {
  const apiOrigin = stripApiSuffix(
    process.env.VITE_API_BASE_URL ||
      process.env.REACT_APP_API_BASE_URL ||
      process.env.VITE_API_URL ||
      process.env.REACT_APP_API_URL ||
      defaultApiOrigin,
  );
  if (apiOrigin) {
    const configuredUrl =
      provider === "google"
        ? process.env.VITE_GOOGLE_AUTH_URL ||
          process.env.REACT_APP_GOOGLE_AUTH_URL
        : process.env.VITE_FACEBOOK_AUTH_URL ||
          process.env.REACT_APP_FACEBOOK_AUTH_URL;
    const baseUrl =
      configuredUrl || `${apiOrigin}/api/auth/efruitmandi/${provider}`;
    return addOAuthParams(
      withOAuthAppParam(baseUrl, EFRUIT_APP_NAME),
      mode,
      termsAccepted,
    );
  }

  return "";
};
const readOAuthUser = (encodedUser) => {
  if (!encodedUser) return null;
  try {
    const normalized = encodedUser.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "=",
    );
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
};

const socialLinks = [
  {
    label: "Continue with Facebook",
    icon: <FaFacebookF />,
    provider: "facebook",
    className: "text-[#1877f2]",
  },
  {
    label: "Continue with Google",
    icon: <FaGoogle />,
    provider: "google",
    className: "text-[#ea4335]",
  },
];

const trustBadges = [
  {
    title: "Secure Buyer Payments",
    detail: "eFruitMandi Escrow Protected",
    mark: "SAFE",
    markClass: "text-[#18a64b]",
  },
  {
    title: "eFruitMandi Escrow Protected",
    detail: "Secure - Trusted - Transparent",
    icon: <EscrowSecurityIcon />,
  },
  {
    title: "Orchard Growers",
    detail: "Trusted Growers and Buyers",
    logo: logoUrl,
    logoClass: "h-9 w-auto object-contain",
    mobileLogoClass: "h-5 w-auto object-contain lg:h-9",
  },
];

const initialLogin = {
  identifier: "",
  otp: "",
  password: "",
  confirmPassword: "",
};

const initialSignup = {
  name: "",
  identifier: "",
  otp: "",
  password: "",
};

const getPasswordStrength = (password) => {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  const score = checks.filter(Boolean).length;

  if (!password) return { score: 0, label: "Start", color: "bg-gray-200" };
  if (score <= 1) return { score, label: "Weak", color: "bg-red-500" };
  if (score === 2) return { score, label: "Fair", color: "bg-yellow-500" };
  if (score === 3) return { score, label: "Good", color: "bg-green-500" };
  return { score, label: "Strong", color: "bg-emerald-600" };
};

export default function Profile() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialRouteState = readProfileRouteState(location.state);
  const [mode, setMode] = useState(initialRouteState.mode);
  const [authRedirect, setAuthRedirect] = useState(initialRouteState.redirect);
  const [loginForm, setLoginForm] = useState(initialLogin);
  const [signupForm, setSignupForm] = useState(initialSignup);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [pendingSocialProvider, setPendingSocialProvider] = useState(null);
  const [verifiedContact, setVerifiedContact] = useState({
    login: "",
    signup: "",
  });
  const [otpVerificationToken, setOtpVerificationToken] = useState({
    login: "",
    signup: "",
  });
  const [mobileOtpReqId, setMobileOtpReqId] = useState({
    login: "",
    signup: "",
  });
  const [mobileOtpFlow, setMobileOtpFlow] = useState({
    login: "",
    signup: "",
  });
  const [mobileOtpSent, setMobileOtpSent] = useState({
    login: false,
    signup: false,
  });
  const [otpExpiresAt, setOtpExpiresAt] = useState({
    login: 0,
    signup: 0,
  });
  const [otpAttemptCount, setOtpAttemptCount] = useState({
    login: 0,
    signup: 0,
  });
  const [otpCooldown, setOtpCooldown] = useState({
    login: 0,
    signup: 0,
  });
  const [resetMode, setResetMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(initialRouteState.notice);
  const loginPhoneCooldown = useOtpVerificationCooldown();
  const signupPhoneCooldown = useOtpVerificationCooldown();
  const otpActionInFlightRef = useRef(false);
  const routeNoticeTextRef = useRef("");
  const awaitingConsumedRouteStateRef = useRef(false);

  useEffect(() => {
    if (!otpCooldown.login && !otpCooldown.signup) return undefined;
    const timer = window.setTimeout(() => {
      setOtpCooldown((current) => ({
        login: Math.max(0, current.login - 1),
        signup: Math.max(0, current.signup - 1),
      }));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [otpCooldown]);

  const strength = useMemo(
    () => getPasswordStrength(signupForm.password),
    [signupForm.password],
  );

  const normalizeContact = (value) => value.trim().toLowerCase();
  const isPhoneIdentifier = (value) => Boolean(normalizeIndianMobile(value));
  const isOtpExpired = (targetMode) =>
    Boolean(otpExpiresAt[targetMode] && otpExpiresAt[targetMode] <= Date.now());
  const hasOtpRequest = (targetMode) =>
    Boolean(mobileOtpSent[targetMode] || otpExpiresAt[targetMode]);
  const sanitizeAuthMessage = (err, fallback) => {
    const status = err?.response?.status;
    const serverMessage = String(
      err?.response?.data?.msg || err?.response?.data?.message || "",
    ).trim();
    const clientMessage = String(err?.message || "").trim();
    if (
      !status &&
      /failed to fetch|network\s*error|networkerror|load failed/i.test(
        serverMessage || clientMessage,
      )
    ) {
      return "Could not connect to eFruitMandi server. Please check your internet connection and try again.";
    }
    if (
      status === 404 ||
      /user\s+not\s+found|account.*not.*exist|does\s+not\s+exist/i.test(
        serverMessage,
      )
    ) {
      return "This Number or Email Does Not Found Please Signup First.";
    }
    if (status === 429)
      return "Too many invalid OTP attempts. Please request a new OTP.";
    if (/expired/i.test(serverMessage)) return "Invalid or expired OTP.";
    if (/request.*otp|otp.*first/i.test(serverMessage))
      return "Please request OTP first.";
    if (/invalid.*otp|otp verification failed/i.test(serverMessage))
      return "Invalid or expired OTP.";
    if (/could not send|unable to send/i.test(serverMessage))
      return "Could not send OTP. Please try again.";
    return serverMessage || fallback;
  };

  useEffect(() => {
    if (!otpExpiresAt.login && !otpExpiresAt.signup) return undefined;
    const timer = window.setInterval(() => {
      const now = Date.now();
      const expiredLogin = Boolean(
        otpExpiresAt.login && otpExpiresAt.login <= now,
      );
      const expiredSignup = Boolean(
        otpExpiresAt.signup && otpExpiresAt.signup <= now,
      );
      if (!expiredLogin && !expiredSignup) return;

      setOtpExpiresAt((current) => ({
        login: expiredLogin ? 0 : current.login,
        signup: expiredSignup ? 0 : current.signup,
      }));
      setVerifiedContact((current) => ({
        login: expiredLogin ? "" : current.login,
        signup: expiredSignup ? "" : current.signup,
      }));
      setOtpVerificationToken((current) => ({
        login: expiredLogin ? "" : current.login,
        signup: expiredSignup ? "" : current.signup,
      }));
      setMobileOtpSent((current) => ({
        login: expiredLogin ? false : current.login,
        signup: expiredSignup ? false : current.signup,
      }));
      setMobileOtpReqId((current) => ({
        login: expiredLogin ? "" : current.login,
        signup: expiredSignup ? "" : current.signup,
      }));
      setMobileOtpFlow((current) => ({
        login: expiredLogin ? "" : current.login,
        signup: expiredSignup ? "" : current.signup,
      }));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [otpExpiresAt]);

  const updateIdentifier = (targetMode, value) => {
    const setForm = targetMode === "login" ? setLoginForm : setSignupForm;
    setForm((current) => ({ ...current, identifier: value, otp: "" }));
    if (targetMode === "login") setResetMode(false);
    setVerifiedContact((current) => ({ ...current, [targetMode]: "" }));
    setOtpVerificationToken((current) => ({ ...current, [targetMode]: "" }));
    setMobileOtpReqId((current) => ({ ...current, [targetMode]: "" }));
    setMobileOtpFlow((current) => ({ ...current, [targetMode]: "" }));
    setMobileOtpSent((current) => ({ ...current, [targetMode]: false }));
    setOtpExpiresAt((current) => ({ ...current, [targetMode]: 0 }));
    setOtpAttemptCount((current) => ({ ...current, [targetMode]: 0 }));
    setOtpCooldown((current) => ({ ...current, [targetMode]: 0 }));
    setMessage({ type: "", text: "" });
  };

  const saveSession = (data) => {
    localStorage.setItem("accessToken", data.accessToken);
    localStorage.setItem("refreshToken", data.refreshToken);
    localStorage.setItem("user", JSON.stringify(data.user));
  };
  const triggerPostAuthInstallPrompt = () => {
    window.setTimeout(() => openEFruitInstallPrompt({ source: "login" }), 900);
  };
  const loadAuthenticatedUser = async (fallbackUser = {}) => {
    try {
      const res = await API.get("/user/profile");
      const freshUser = res.data || fallbackUser;
      localStorage.setItem("user", JSON.stringify(freshUser));
      return freshUser;
    } catch {
      return fallbackUser;
    }
  };

  const showError = (text) => setMessage({ type: "error", text });
  const showSuccess = (text) => setMessage({ type: "success", text });
  const getAuthIdentifier = (value) =>
    normalizeIndianMobile(value) || normalizeContact(value);
  const getPendingAuthRedirect = () => {
    try {
      return JSON.parse(
        sessionStorage.getItem("efruitmandiPendingAuthRedirect") || "{}",
      );
    } catch {
      return {};
    }
  };
  const clearPendingAuthRedirect = () => {
    sessionStorage.removeItem("efruitmandiPendingAuthRedirect");
  };
  const navigateAfterAuth = (authUser, override = {}) => {
    const targetPath = override.from || authRedirect.from;
    const targetProfile = override.requiredProfile || authRedirect.requiredProfile;

    if (targetProfile === "buyer" && !hasBuyerProfile(authUser)) {
      navigate("/register-buyer", {
        replace: true,
        state: { from: targetPath },
      });
      return;
    }

    if (targetProfile === "grower" && !hasGrowerProfile(authUser)) {
      navigate("/register-grower", {
        replace: true,
        state: { from: targetPath },
      });
      return;
    }

    navigate(targetPath, { replace: true });
  };

  useEffect(() => {
    const routeState = readProfileRouteState(location.state);

    if (routeState.hasExplicitMode) {
      setMode(routeState.mode);
    }
    if (routeState.hasRedirectTarget) {
      setAuthRedirect(routeState.redirect);
    }
    if (routeState.shouldConsume) {
      routeNoticeTextRef.current = routeState.notice.text;
      awaitingConsumedRouteStateRef.current = true;
      setMessage(routeState.notice);
      navigate(
        `${location.pathname}${location.search || ""}${location.hash || ""}`,
        { replace: true, state: consumedProfileRouteState },
      );
      return;
    }

    if (awaitingConsumedRouteStateRef.current) {
      awaitingConsumedRouteStateRef.current = false;
      return;
    }

    if (routeNoticeTextRef.current) {
      const staleRouteNotice = routeNoticeTextRef.current;
      routeNoticeTextRef.current = "";
      setMessage((current) =>
        current.type === "error" && current.text === staleRouteNotice
          ? { type: "", text: "" }
          : current,
      );
    }
  }, [location.hash, location.key, location.pathname, location.search, location.state, navigate]);

  useEffect(() => {
    const hashParams = new URLSearchParams(
      window.location.hash.replace(/^#/, ""),
    );
    const queryParams = new URLSearchParams(location.search);
    const oauthError = queryParams.get("oauthError");
    const oauthSignup = queryParams.get("oauthSignup");

    if (oauthError) {
      showError(oauthError);
      if (oauthSignup === "google" || oauthSignup === "facebook") {
        setMode("signup");
        setAcceptedTerms(false);
      }
      window.history.replaceState({}, document.title, location.pathname);
      return;
    }

    if (hashParams.get("oauth") !== "success") return;

    const accessToken = hashParams.get("accessToken");
    const refreshToken = hashParams.get("refreshToken");
    const user = readOAuthUser(hashParams.get("user"));

    if (!accessToken || !refreshToken || !user) {
      showError("Social login response was incomplete. Please try again.");
      window.history.replaceState({}, document.title, location.pathname);
      return;
    }

    const finishOAuthLogin = async () => {
      saveSession({ accessToken, refreshToken, user });
      triggerPostAuthInstallPrompt();
      const freshUser = await loadAuthenticatedUser(user);
      const pendingRedirect = getPendingAuthRedirect();
      clearPendingAuthRedirect();
      window.history.replaceState({}, document.title, location.pathname);
      navigateAfterAuth(freshUser, pendingRedirect);
    };

    finishOAuthLogin();
  }, [location.pathname, location.search, navigate]);

  const changeMode = (nextMode) => {
    setMode(nextMode);
    setResetMode(false);
    if (nextMode === "signup") {
      setSignupForm(initialSignup);
    }
    setMessage({ type: "", text: "" });
    setVerifiedContact((current) => ({ ...current, [nextMode]: "" }));
    setOtpVerificationToken((current) => ({ ...current, [nextMode]: "" }));
    setMobileOtpReqId((current) => ({ ...current, [nextMode]: "" }));
    setMobileOtpFlow((current) => ({ ...current, [nextMode]: "" }));
    setMobileOtpSent((current) => ({ ...current, [nextMode]: false }));
    setOtpExpiresAt((current) => ({ ...current, [nextMode]: 0 }));
    setOtpAttemptCount((current) => ({ ...current, [nextMode]: 0 }));
    setOtpCooldown((current) => ({ ...current, [nextMode]: 0 }));
  };

  const requestPasswordResetOtp = async () => {
    const identifier = getAuthIdentifier(loginForm.identifier);
    if (
      otpActionInFlightRef.current ||
      (isPhoneIdentifier(identifier) && loginPhoneCooldown.isLocked)
    ) return;
    if (!identifier) {
      showError("Enter email or phone number first.");
      return;
    }

    try {
      otpActionInFlightRef.current = true;
      setLoading(true);
      const res = await API.post("/auth/forgot-password", {
        identifier,
        platform: "efruitmandi",
      });
      setResetMode(true);
      setVerifiedContact((current) => ({ ...current, login: "" }));
      setOtpVerificationToken((current) => ({ ...current, login: "" }));
      setMobileOtpReqId((current) => ({
        ...current,
        login: res.data?.reqId || res.data?.requestId || "",
      }));
      setMobileOtpFlow((current) => ({
        ...current,
        login: res.data?.otpFlow || "",
      }));
      setMobileOtpSent((current) => ({ ...current, login: true }));
      setOtpExpiresAt((current) => ({
        ...current,
        login: Date.now() + OTP_EXPIRY_SECONDS * 1000,
      }));
      setOtpAttemptCount((current) => ({ ...current, login: 0 }));
      setOtpCooldown((current) => ({ ...current, login: OTP_RESEND_SECONDS }));
      showSuccess(res.data?.message || "OTP sent successfully.");
    } catch (err) {
      showError(
        sanitizeAuthMessage(err, "Could not send OTP. Please try again."),
      );
    } finally {
      otpActionInFlightRef.current = false;
      setLoading(false);
    }
  };

  const handleSendOtp = async (targetMode) => {
    const form = targetMode === "login" ? loginForm : signupForm;
    const identifier = getAuthIdentifier(form.identifier);

    const phoneCooldown = targetMode === "login" ? loginPhoneCooldown : signupPhoneCooldown;
    if (otpActionInFlightRef.current || (isPhoneIdentifier(identifier) && phoneCooldown.isLocked)) return;
    if (otpCooldown[targetMode] > 0) return;

    if (targetMode === "signup" && !signupForm.name.trim()) {
      showError("Enter full name before requesting OTP.");
      return;
    }

    if (!identifier) {
      showError("Enter email or phone number first.");
      return;
    }

    try {
      otpActionInFlightRef.current = true;
      setLoading(true);
      const setForm = targetMode === "login" ? setLoginForm : setSignupForm;
      setForm((current) => ({ ...current, otp: "" }));
      if (isPhoneIdentifier(identifier)) {
        const widgetId = getEfruitMandiWidgetId();
        const tokenAuth = getEfruitMandiTokenAuth();
        const phone = normalizeIndianMobile(identifier);
        const result = await sendMsg91WidgetOtp({
          widgetId,
          tokenAuth,
          phone,
          mode: targetMode,
        });
        setMobileOtpReqId((current) => ({
          ...current,
          [targetMode]: result.reqId || "",
        }));
        setMobileOtpFlow((current) => ({
          ...current,
          [targetMode]: result.data?.otpFlow || "",
        }));
        setMobileOtpSent((current) => ({ ...current, [targetMode]: true }));
        setOtpCooldown((current) => ({
          ...current,
          [targetMode]: OTP_RESEND_SECONDS,
        }));
        setVerifiedContact((current) => ({ ...current, [targetMode]: "" }));
        setOtpVerificationToken((current) => ({
          ...current,
          [targetMode]: "",
        }));
        setOtpExpiresAt((current) => ({
          ...current,
          [targetMode]: Date.now() + OTP_EXPIRY_SECONDS * 1000,
        }));
        setOtpAttemptCount((current) => ({ ...current, [targetMode]: 0 }));
        showSuccess("OTP sent successfully.");
        return;
      }

      const res = await API.post("/auth/send-otp", {
        identifier,
        platform: "efruitmandi",
        mode: targetMode,
      });
      setVerifiedContact((current) => ({ ...current, [targetMode]: "" }));
      setOtpVerificationToken((current) => ({ ...current, [targetMode]: "" }));
      setMobileOtpSent((current) => ({ ...current, [targetMode]: false }));
      setMobileOtpFlow((current) => ({
        ...current,
        [targetMode]: res.data?.otpFlow || "",
      }));
      setOtpCooldown((current) => ({
        ...current,
        [targetMode]: OTP_RESEND_SECONDS,
      }));
      setOtpExpiresAt((current) => ({
        ...current,
        [targetMode]: Date.now() + OTP_EXPIRY_SECONDS * 1000,
      }));
      setOtpAttemptCount((current) => ({ ...current, [targetMode]: 0 }));
      showSuccess(res.data?.message || "OTP sent successfully.");
    } catch (err) {
      showError(
        sanitizeAuthMessage(err, "Could not send OTP. Please try again."),
      );
    } finally {
      otpActionInFlightRef.current = false;
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (targetMode) => {
    const form = targetMode === "login" ? loginForm : signupForm;
    const identifier = getAuthIdentifier(form.identifier);
    const otpPurpose =
      resetMode && targetMode === "login" ? "forgot-password" : "auth";
    const phoneCooldown = targetMode === "login" ? loginPhoneCooldown : signupPhoneCooldown;

    if (otpActionInFlightRef.current || (isPhoneIdentifier(identifier) && phoneCooldown.isLocked)) return;

    if (!identifier || !form.otp.trim()) {
      showError("Enter email/phone and OTP.");
      return;
    }

    if (!hasOtpRequest(targetMode)) {
      showError("Please request OTP first.");
      return;
    }

    if (isOtpExpired(targetMode)) {
      setVerifiedContact((current) => ({ ...current, [targetMode]: "" }));
      setOtpVerificationToken((current) => ({ ...current, [targetMode]: "" }));
      showError("Invalid or expired OTP.");
      return;
    }

    if (otpAttemptCount[targetMode] >= OTP_MAX_ATTEMPTS) {
      showError("Too many invalid OTP attempts. Please request a new OTP.");
      return;
    }

    try {
      otpActionInFlightRef.current = true;
      setLoading(true);
      if (
        isPhoneIdentifier(identifier) &&
        (otpPurpose === "auth" || mobileOtpFlow[targetMode] === "widget")
      ) {
        const widgetId = getEfruitMandiWidgetId();
        const tokenAuth = getEfruitMandiTokenAuth();
        const reqId = mobileOtpReqId[targetMode];
        if (!widgetId || !tokenAuth || !mobileOtpSent[targetMode]) {
          showError("Request phone OTP first.");
          return;
        }

        const result = await verifyMsg91WidgetOtp({
          widgetId,
          tokenAuth,
          otp: form.otp.trim(),
          reqId,
          phone: identifier,
          mode:
            otpPurpose === "forgot-password" ? "forgot-password" : targetMode,
        });
        if (!result.data?.otpVerificationToken) {
          throw new Error("OTP verification failed.");
        }
        setVerifiedContact((current) => ({
          ...current,
          [targetMode]: identifier,
        }));
        setOtpVerificationToken((current) => ({
          ...current,
          [targetMode]: result.data?.otpVerificationToken || "",
        }));
        setOtpAttemptCount((current) => ({ ...current, [targetMode]: 0 }));
        phoneCooldown.startCooldown(60);
        showSuccess("OTP verified successfully.");
        return;
      }

      const res = await API.post("/auth/verify-otp", {
        identifier,
        otp: form.otp.trim(),
        platform: "efruitmandi",
        purpose: otpPurpose,
      });
      if (!res.data?.otpVerificationToken) {
        throw new Error("OTP verification failed.");
      }
      setVerifiedContact((current) => ({
        ...current,
        [targetMode]: identifier,
      }));
      setOtpVerificationToken((current) => ({
        ...current,
        [targetMode]: res.data?.otpVerificationToken || "",
      }));
      setOtpAttemptCount((current) => ({ ...current, [targetMode]: 0 }));
      if (isPhoneIdentifier(identifier)) phoneCooldown.startCooldown(60);
      showSuccess("OTP verified successfully.");
    } catch (err) {
      setVerifiedContact((current) => ({ ...current, [targetMode]: "" }));
      setOtpVerificationToken((current) => ({ ...current, [targetMode]: "" }));
      setOtpAttemptCount((current) => ({
        ...current,
        [targetMode]: current[targetMode] + 1,
      }));
      showError(sanitizeAuthMessage(err, "Invalid or expired OTP."));
    } finally {
      otpActionInFlightRef.current = false;
      setLoading(false);
    }
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setMessage({ type: "", text: "" });

    const identifier = getAuthIdentifier(loginForm.identifier);

    if (resetMode) {
      if (!identifier || !loginForm.otp.trim() || !loginForm.password) {
        showError("Enter email/phone, OTP, and new password.");
        return;
      }
      if (loginForm.password !== loginForm.confirmPassword) {
        showError("Passwords do not match.");
        return;
      }
      if (
        loginForm.password.length < 8 ||
        !/[A-Za-z]/.test(loginForm.password) ||
        !/\d/.test(loginForm.password)
      ) {
        showError(
          "Password must be at least 8 characters and include a letter and a number.",
        );
        return;
      }

      try {
        setLoading(true);
        const res = await API.post("/auth/reset-password", {
          identifier,
          otp: loginForm.otp.trim(),
          password: loginForm.password,
          platform: "efruitmandi",
          otpVerificationToken: otpVerificationToken.login,
        });
        setResetMode(false);
        setLoginForm(initialLogin);
        setVerifiedContact((current) => ({ ...current, login: "" }));
        setOtpVerificationToken((current) => ({ ...current, login: "" }));
        setOtpExpiresAt((current) => ({ ...current, login: 0 }));
        showSuccess(
          res.data?.message || "Password reset successful. Please login.",
        );
      } catch (err) {
        showError(sanitizeAuthMessage(err, "Could not reset password."));
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!identifier || !loginForm.password) {
      showError("Enter email/phone and password.");
      return;
    }

    if (verifiedContact.login !== identifier || !otpVerificationToken.login) {
      showError("Verify OTP before login.");
      return;
    }

    try {
      setLoading(true);
      const res = await API.post("/auth/login", {
        identifier,
        password: loginForm.password,
        platform: "efruitmandi",
        otpVerificationToken: otpVerificationToken.login,
      });

      saveSession(res.data);
      triggerPostAuthInstallPrompt();
      const freshUser = await loadAuthenticatedUser(res.data.user || {});
      navigateAfterAuth(freshUser);
    } catch (err) {
      showError(err.response?.data?.msg || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (event) => {
    event.preventDefault();
    setMessage({ type: "", text: "" });

    const identifier = getAuthIdentifier(signupForm.identifier);

    if (!signupForm.name.trim() || !identifier) {
      showError("Enter name and email/phone.");
      return;
    }

    if (verifiedContact.signup !== identifier || !otpVerificationToken.signup) {
      showError("Verify OTP before signup.");
      return;
    }

    if (signupForm.password.length < 8 || strength.score < 2) {
      showError("Use a stronger password.");
      return;
    }

    if (!acceptedTerms) {
      showError(
        "Accept Terms of Service and Privacy Policy before continuing.",
      );
      return;
    }

    try {
      setLoading(true);

      const registerRes = await API.post("/auth/register", {
        name: signupForm.name.trim(),
        identifier,
        password: signupForm.password,
        platform: "efruitmandi",
        otpVerificationToken: otpVerificationToken.signup,
      });

      saveSession(registerRes.data);
      triggerPostAuthInstallPrompt();
      const freshUser = await loadAuthenticatedUser(
        registerRes.data.user || {},
      );
      navigateAfterAuth(freshUser);
    } catch (err) {
      showError(err.response?.data?.msg || "Signup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const startOAuth = (provider) => {
    sessionStorage.setItem(
      "efruitmandiPendingAuthRedirect",
      JSON.stringify({ from: returnTo, requiredProfile }),
    );

    if (mode === "signup") {
      setPendingSocialProvider(provider);
      return;
    }

    const url = getEfruitOAuthUrl(
      provider,
      mode,
      mode === "signup" && acceptedTerms,
    );
    if (!url) {
      showError(
        `${provider === "google" ? "Google" : "Facebook"} login is not configured.`,
      );
      return;
    }
    window.location.href = url;
  };

  const activeForm = mode === "login" ? loginForm : signupForm;
  const activeVerified =
    verifiedContact[mode] === getAuthIdentifier(activeForm.identifier) &&
    Boolean(otpVerificationToken[mode]);
  const loginIdentifier = getAuthIdentifier(loginForm.identifier);
  const signupIdentifier = getAuthIdentifier(signupForm.identifier);
  const loginCanSubmit = resetMode
    ? Boolean(
        loginIdentifier &&
        loginForm.otp.trim() &&
        loginForm.password &&
        loginForm.confirmPassword,
      )
    : Boolean(loginIdentifier && loginForm.password && activeVerified);
  const signupCanSubmit = Boolean(
    signupForm.name.trim() &&
    signupIdentifier &&
    signupForm.password &&
    activeVerified &&
    acceptedTerms,
  );

  return (
    <div className="fixed inset-0 z-[999] bg-[#18a64b] p-2 sm:p-3">
      <div className="grid h-full grid-rows-[minmax(150px,30vh)_minmax(0,1fr)] overflow-hidden rounded-lg bg-white shadow-2xl sm:grid-rows-[minmax(180px,32vh)_minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_430px] lg:grid-rows-1 xl:grid-cols-[minmax(0,1fr)_460px]">
        <section className="relative flex min-h-0 flex-col justify-center bg-[#18a64b] px-6 py-5 text-white sm:px-8 lg:px-8 lg:py-8 xl:px-12">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="absolute left-6 top-4 rounded-md p-1 sm:left-8 lg:left-8 lg:top-7"
            aria-label="Go to home"
          >
            <img
              src={logoUrl}
              alt="E-Fruit Mandi"
              width="240"
              height="160"
              className="h-8 w-auto sm:h-10 lg:h-16 xl:h-20"
            />
          </button>

          <div className="max-w-2xl pt-12 sm:pt-14 lg:pt-0">
            <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.2em] sm:text-[10px] lg:mb-6 lg:text-xs">
              INDIA'S FIRST
            </p>
            <h1 className="text-[19px] font-black leading-[1.08] sm:text-2xl lg:text-3xl xl:text-4xl 2xl:text-5xl">
              Innovative, Trusted, and Authentic Fruit Trading Platform
            </h1>
            <p className="mt-2 max-w-xl text-[10px] font-medium leading-4 sm:text-xs lg:mt-5 lg:text-sm lg:leading-6 xl:text-base">
              Sell, Buy, Manage Horticulture Produce Payments and Logestics All
              at One place.
            </p>
            <div className="mt-3 grid max-w-xl grid-cols-3 gap-1.5 lg:mt-8 lg:gap-3">
              {trustBadges.map((item) => (
                <div
                  key={item.title}
                  className="rounded-md border border-white/15 bg-white/10 p-1.5 shadow-sm backdrop-blur lg:rounded-lg lg:p-3"
                >
                  <div className="flex h-5 items-center lg:h-10">
                    {item.icon ? (
                      item.icon
                    ) : item.logo ? (
                      <img
                        src={item.logo}
                        alt={item.title}
                        className={item.mobileLogoClass || item.logoClass}
                      />
                    ) : (
                      <span
                        className={`rounded-sm bg-white px-1 py-0.5 text-[7px] font-black lg:rounded-md lg:px-2 lg:py-1 lg:text-sm ${item.markClass}`}
                      >
                        {item.mark}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[8px] font-black leading-tight lg:mt-3 lg:text-sm">
                    {item.title}
                  </p>
                  <p className="hidden lg:mt-1 lg:block lg:text-xs lg:font-semibold lg:text-white/80">
                    {item.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <main className="flex h-full min-h-0 justify-center overflow-y-auto bg-white px-4 py-3 sm:px-7 lg:overflow-hidden lg:px-6 lg:py-2">
          <div className="flex min-h-full w-full max-w-[390px] flex-col lg:max-w-[360px]">
            <div className="grid grid-cols-2 rounded-lg bg-gray-100 p-1">
              <button
                type="button"
                onClick={() => changeMode("login")}
                className={`rounded-md py-1.5 text-sm font-bold lg:text-base ${
                  mode === "login"
                    ? "bg-white text-blue-700 shadow-sm"
                    : "text-blue-600 hover:text-blue-800"
                }`}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => changeMode("signup")}
                className={`rounded-md py-1.5 text-sm font-bold lg:text-base ${
                  mode === "signup"
                    ? "bg-white text-blue-700 shadow-sm"
                    : "text-blue-600 hover:text-blue-800"
                }`}
              >
                Signup
              </button>
            </div>

            <div className="pt-3 lg:pt-2">
              <p className="text-xs font-bold text-green-700">E-Fruit Mandi</p>
              <h2 className="mt-1 text-xl font-black leading-tight text-gray-950 sm:text-2xl lg:text-xl">
                {resetMode
                  ? "Reset your password"
                  : mode === "login"
                    ? "Welcome back"
                    : "Create your account"}
              </h2>
              {mode === "login" && (
                <p className="mt-1 text-xs text-gray-500 sm:text-sm lg:text-xs">
                  Login with your registered email or phone number.
                </p>
              )}

              {message.text && (
                <div
                  className={`mt-2 rounded-md px-3 py-1.5 text-xs ${
                    message.type === "error"
                      ? "bg-red-50 text-red-700"
                      : "bg-green-50 text-green-700"
                  }`}
                >
                  {message.text}
                </div>
              )}
            </div>

            <div className="shrink-0 pt-3 lg:pt-2">
              {mode === "login" ? (
                <form onSubmit={handleLogin} autoComplete="off">
                  <ContactOtpFields
                    mode="login"
                    form={loginForm}
                    setForm={(updater) => setLoginForm(updater)}
                    onIdentifierChange={(value) =>
                      updateIdentifier("login", value)
                    }
                    verified={activeVerified}
                    loading={loading}
                    otpCooldown={otpCooldown.login}
                    phoneCooldown={loginPhoneCooldown}
                    otpSent={hasOtpRequest("login")}
                    onSendOtp={() =>
                      resetMode
                        ? requestPasswordResetOtp()
                        : handleSendOtp("login")
                    }
                    onVerifyOtp={() => handleVerifyOtp("login")}
                    disableAutofill
                  />

                  <PasswordField
                    label={resetMode ? "New Password" : "Password"}
                    value={loginForm.password}
                    onChange={(value) =>
                      setLoginForm({ ...loginForm, password: value })
                    }
                    visible={showLoginPassword}
                    onToggle={() => setShowLoginPassword((value) => !value)}
                    autoComplete="new-password"
                    name="efruitmandi-login-passcode"
                  />

                  {resetMode && (
                    <PasswordField
                      label="Confirm Password"
                      value={loginForm.confirmPassword}
                      onChange={(value) =>
                        setLoginForm({ ...loginForm, confirmPassword: value })
                      }
                      visible={showLoginPassword}
                      onToggle={() => setShowLoginPassword((value) => !value)}
                      autoComplete="new-password"
                      name="efruitmandi-reset-confirm-passcode"
                    />
                  )}

                  <button
                    type="button"
                    onClick={
                      resetMode
                        ? () => {
                            setResetMode(false);
                            setLoginForm(initialLogin);
                            setMessage({ type: "", text: "" });
                          }
                        : requestPasswordResetOtp
                    }
                    className="mb-3 block w-full text-left text-xs font-semibold text-green-700 lg:mb-2"
                  >
                    {resetMode ? "Back to login" : "Forgot password?"}
                  </button>

                  <SubmitButton
                    loading={loading}
                    disabled={!loginCanSubmit}
                    label={resetMode ? "Reset password" : "Login"}
                    loadingLabel="Please wait..."
                  />
                </form>
              ) : (
                <form onSubmit={handleSignup} autoComplete="off">
                  <Field
                    icon={<FaUser />}
                    label="Full Name"
                    inputProps={{
                      value: signupForm.name,
                      onChange: (e) =>
                        setSignupForm({ ...signupForm, name: e.target.value }),
                      placeholder: "Type your name",
                      autoComplete: "name",
                    }}
                  />

                  <ContactOtpFields
                    mode="signup"
                    form={signupForm}
                    setForm={(updater) => setSignupForm(updater)}
                    onIdentifierChange={(value) =>
                      updateIdentifier("signup", value)
                    }
                    verified={activeVerified}
                    loading={loading}
                    otpCooldown={otpCooldown.signup}
                    phoneCooldown={signupPhoneCooldown}
                    otpSent={hasOtpRequest("signup")}
                    onSendOtp={() => handleSendOtp("signup")}
                    onVerifyOtp={() => handleVerifyOtp("signup")}
                  />

                  <PasswordField
                    label="Create Password"
                    value={signupForm.password}
                    onChange={(value) =>
                      setSignupForm({ ...signupForm, password: value })
                    }
                    visible={showSignupPassword}
                    onToggle={() => setShowSignupPassword((value) => !value)}
                    autoComplete="new-password"
                  />

                  <PasswordStrength strength={strength} />

                  <TermsAcceptance
                    checked={acceptedTerms}
                    onChange={setAcceptedTerms}
                  />

                  <SubmitButton
                    loading={loading}
                    disabled={!signupCanSubmit}
                    label="Signup"
                    loadingLabel="Creating..."
                  />
                </form>
              )}
            </div>

            <div className="shrink-0 pb-2 pt-3">
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span className="h-px flex-1 bg-gray-200" />
                <span className="shrink-0">or continue using</span>
                <span className="h-px flex-1 bg-gray-200" />
              </div>

              <div className="mt-2 flex justify-center gap-3 lg:mt-1.5">
                {socialLinks.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() =>
                      item.provider
                        ? startOAuth(item.provider)
                        : window.open(
                            item.href,
                            "_blank",
                            "noopener,noreferrer",
                          )
                    }
                    aria-label={item.label}
                    title={item.label}
                    className={`flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 text-lg ${item.className}`}
                  >
                    {item.icon}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() =>
                  changeMode(mode === "login" ? "signup" : "login")
                }
                className="mt-2 block w-full text-center text-xs text-gray-500 lg:mt-1.5"
              >
                {mode === "login" ? (
                  <>
                    New to E-Fruit Mandi?{" "}
                    <span className="font-bold text-green-700">
                      Create account
                    </span>
                  </>
                ) : (
                  <>
                    Already registered?{" "}
                    <span className="font-bold text-green-700">Signin</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </main>
      </div>

      {pendingSocialProvider && (
        <TermsSignupModal
          onCancel={() => setPendingSocialProvider(null)}
          onAccept={() => {
            const provider = pendingSocialProvider;
            setAcceptedTerms(true);
            setPendingSocialProvider(null);
            const url = getEfruitOAuthUrl(provider, "signup", true);
            if (!url) {
              showError(
                `${provider === "google" ? "Google" : "Facebook"} signup is not configured.`,
              );
              return;
            }
            window.location.href = url;
          }}
        />
      )}
    </div>
  );
}

function TermsAcceptance({ checked, onChange }) {
  return (
    <label className="mb-2 flex items-start gap-2 rounded-md bg-gray-50 px-2 py-1.5 text-xs lg:py-1">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1"
      />
      <span>
        I agree to the{" "}
        <Link
          to="/terms-of-service"
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-green-700 underline"
        >
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link
          to="/privacy-policy"
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-green-700 underline"
        >
          Privacy Policy
        </Link>
      </span>
    </label>
  );
}

function ContactOtpFields({
  mode,
  form,
  setForm,
  onIdentifierChange,
  verified,
  loading,
  otpCooldown,
  otpSent,
  phoneCooldown,
  onSendOtp,
  onVerifyOtp,
  disableAutofill = false,
}) {
  const contactType = /^\+?\d[\d\s-]{5,}$/.test(form.identifier.trim())
    ? "phone"
    : "email";
  const phoneLocked = contactType === "phone" && phoneCooldown?.isLocked;
  const phoneCooldownLabel = phoneCooldown
    ? `00:${String(phoneCooldown.remainingSeconds).padStart(2, "0")}`
    : "";

  return (
    <>
      <Field
        icon={contactType === "phone" ? <FaPhoneAlt /> : <FaEnvelope />}
        label="Email / Phone number"
        inputProps={{
          value: form.identifier,
          onChange: (e) => onIdentifierChange(e.target.value),
          placeholder: "Enter email or phone number",
          autoComplete: disableAutofill
            ? "off"
            : mode === "login"
              ? "username"
              : "email",
          name: disableAutofill
            ? "efruitmandi-login-contact"
            : `${mode}-identifier`,
        }}
      />

      <div className="mb-2 lg:mb-1.5">
        <div className="mb-1 flex items-center justify-between">
          <label className="text-xs font-semibold text-gray-700">
            OTP verification
          </label>
          {verified && (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-green-700">
              <FaCheck /> Verified
            </span>
          )}
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-1.5 sm:gap-2">
          <input
            value={form.otp}
            onChange={(e) => setForm({ ...form, otp: e.target.value })}
            placeholder={otpSent ? "Enter OTP" : "Request OTP first"}
            inputMode="numeric"
            disabled={loading || verified}
            className="min-w-0 rounded-md border border-gray-200 px-2.5 py-1.5 text-sm outline-none focus:border-green-600 lg:py-1"
          />
          <button
            type="button"
            disabled={loading || otpCooldown > 0 || phoneLocked}
            onClick={onSendOtp}
            className="rounded-md bg-green-50 px-2 py-1.5 text-[11px] font-bold text-green-700 disabled:opacity-50 sm:px-3 sm:text-xs lg:py-1"
          >
            <FaPaperPlane className="inline-block" />{" "}
            {phoneLocked ? <><FaLock className="inline-block" /> Request OTP ({phoneCooldownLabel})</> : otpCooldown > 0 ? `${otpCooldown}s` : "Request OTP"}
          </button>
          <button
            type="button"
            disabled={loading || verified || !otpSent || !form.otp.trim() || phoneLocked}
            onClick={onVerifyOtp}
            className="rounded-md bg-[#15883f] px-2 py-1.5 text-[11px] font-bold text-white disabled:opacity-50 sm:px-3 sm:text-xs lg:py-1"
          >
            {phoneLocked ? <><FaLock className="inline-block" /> Verified — Locked ({phoneCooldownLabel})</> : verified ? "Verified" : "Verify"}
          </button>
        </div>
      </div>
    </>
  );
}

function Field({ icon, label, inputProps }) {
  return (
    <div className="mb-2 lg:mb-1.5">
      <label className="text-xs font-semibold text-gray-700">{label}</label>
      <div className="mt-1 flex items-center rounded-md border border-gray-200 bg-white px-3 py-1.5 focus-within:border-green-600 lg:py-1">
        <span className="mr-3 text-gray-400">{icon}</span>
        <input
          {...inputProps}
          className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
        />
      </div>
    </div>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  visible,
  onToggle,
  autoComplete,
  name,
}) {
  return (
    <div className="mb-2 lg:mb-1.5">
      <label className="text-xs font-semibold text-gray-700">{label}</label>
      <div className="mt-1 flex items-center rounded-md border border-gray-200 bg-white px-3 py-1.5 focus-within:border-green-600 lg:py-1">
        <FaLock className="mr-3 text-gray-400" />
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Type your password"
          autoComplete={autoComplete}
          name={name || "password"}
          className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={visible ? "Hide password" : "Show password"}
          title={visible ? "Hide password" : "Show password"}
          className="p-1 text-gray-400"
        >
          {visible ? <FaEyeSlash /> : <FaEye />}
        </button>
      </div>
    </div>
  );
}

function TermsSignupModal({ onCancel, onAccept }) {
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/45 px-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl">
        <h2 className="text-lg font-black text-gray-950">
          Accept Terms of Service and Privacy Policy
        </h2>
        <p className="mt-2 text-sm leading-6 text-gray-600">
          Please accept the Terms of Service and Privacy Policy to create your
          account with social signup.
        </p>
        <Link
          to="/terms-of-service"
          className="mt-3 inline-flex text-sm font-bold text-green-700 underline"
        >
          Read Terms of Service
        </Link>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md bg-gray-100 px-4 py-2 text-sm font-bold text-gray-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="rounded-md bg-green-700 px-4 py-2 text-sm font-bold text-white"
          >
            Accept & Continue
          </button>
        </div>
      </div>
    </div>
  );
}

function PasswordStrength({ strength }) {
  return (
    <div className="mb-2 lg:mb-1.5">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-xs">Strength</p>
        <p className="text-xs font-semibold text-gray-600">{strength.label}</p>
      </div>
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((step) => (
          <div
            key={step}
            className={`h-1 w-1/4 rounded-full ${
              strength.score >= step ? strength.color : "bg-gray-200"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function SubmitButton({ loading, disabled, label, loadingLabel }) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      className="w-full rounded-md bg-[#15883f] py-2.5 text-sm font-bold text-white disabled:opacity-60 lg:py-2"
    >
      {loading ? loadingLabel : label}
    </button>
  );
}

