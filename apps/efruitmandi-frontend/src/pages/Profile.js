import { useEffect, useMemo, useState } from "react";
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
import {
  getEfruitMandiWidgetId,
  getEfruitMandiTokenAuth,
  normalizeIndianMobile,
  retryMsg91WidgetOtp,
  sendMsg91WidgetOtp,
  verifyMsg91WidgetOtp,
} from "../utils/msg91OtpWidget";

const logoUrl = `${process.env.PUBLIC_URL || ""}/logo.png`;
const stripApiSuffix = (value = "") => value.trim().replace(/\/+$/, "").replace(/\/api$/i, "");
const EFRUIT_APP_NAME = process.env.VITE_APP_NAME || "efruitmandi";
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
    process.env.VITE_API_URL ||
      process.env.VITE_API_BASE_URL ||
      "https://orchard-growers-backend.onrender.com"
  );
  if (apiOrigin) {
    return addOAuthParams(`${apiOrigin}/api/auth/${provider}?app=${encodeURIComponent(EFRUIT_APP_NAME)}`, mode, termsAccepted);
  }

  return "";
};
const readOAuthUser = (encodedUser) => {
  if (!encodedUser) return null;
  try {
    const normalized = encodedUser.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
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
    title: "Escrow Enabled",
    detail: "Secure Payments",
    mark: "Escrow.com",
    markClass: "text-[#01426a]",
  },
  {
    title: "BillDesk",
    detail: "Payment Gateway",
    logo: "https://www.billdesk.com/web/billdesk-1.png",
    logoClass: "h-9 w-9 rounded-md bg-white object-contain p-1",
    mobileLogoClass: "h-5 w-5 rounded-sm bg-white object-contain p-0.5 lg:h-9 lg:w-9 lg:rounded-md lg:p-1",
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
  const initialMode = location.state?.mode === "signup" ? "signup" : "login";
  const [mode, setMode] = useState(initialMode);
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
  const [mobileOtpReqId, setMobileOtpReqId] = useState({
    login: "",
    signup: "",
  });
  const [mobileOtpSent, setMobileOtpSent] = useState({
    login: false,
    signup: false,
  });
  const [otpCooldown, setOtpCooldown] = useState({
    login: 0,
    signup: 0,
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

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
    [signupForm.password]
  );

  const normalizeContact = (value) => value.trim().toLowerCase();
  const isPhoneIdentifier = (value) => Boolean(normalizeIndianMobile(value));

  const updateIdentifier = (targetMode, value) => {
    const setForm = targetMode === "login" ? setLoginForm : setSignupForm;
    setForm((current) => ({ ...current, identifier: value, otp: "" }));
    setVerifiedContact((current) => ({ ...current, [targetMode]: "" }));
    setMobileOtpReqId((current) => ({ ...current, [targetMode]: "" }));
    setMobileOtpSent((current) => ({ ...current, [targetMode]: false }));
    setOtpCooldown((current) => ({ ...current, [targetMode]: 0 }));
    setMessage({ type: "", text: "" });
  };

  const saveSession = (data) => {
    localStorage.setItem("accessToken", data.accessToken);
    localStorage.setItem("refreshToken", data.refreshToken);
    localStorage.setItem("user", JSON.stringify(data.user));
  };

  const showError = (text) => setMessage({ type: "error", text });
  const showSuccess = (text) => setMessage({ type: "success", text });

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
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

    saveSession({ accessToken, refreshToken, user });
    window.history.replaceState({}, document.title, location.pathname);
    navigate("/profile-dashboard", { replace: true });
  }, [location.pathname, location.search, navigate]);

  const changeMode = (nextMode) => {
    setMode(nextMode);
    if (nextMode === "signup") {
      setSignupForm(initialSignup);
    }
    setMessage({ type: "", text: "" });
    setVerifiedContact((current) => ({ ...current, [nextMode]: "" }));
    setMobileOtpReqId((current) => ({ ...current, [nextMode]: "" }));
    setMobileOtpSent((current) => ({ ...current, [nextMode]: false }));
    setOtpCooldown((current) => ({ ...current, [nextMode]: 0 }));
  };

  const handleSendOtp = async (targetMode) => {
    const form = targetMode === "login" ? loginForm : signupForm;
    const identifier = normalizeContact(form.identifier);

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
      setLoading(true);
      if (isPhoneIdentifier(identifier)) {
        const widgetId = getEfruitMandiWidgetId();
        const tokenAuth = getEfruitMandiTokenAuth();
        const phone = normalizeIndianMobile(identifier);
        const result = mobileOtpSent[targetMode]
          ? await retryMsg91WidgetOtp({ widgetId, tokenAuth, reqId: mobileOtpReqId[targetMode] })
          : await sendMsg91WidgetOtp({ widgetId, tokenAuth, phone });
        setMobileOtpReqId((current) => ({ ...current, [targetMode]: result.reqId || "" }));
        setMobileOtpSent((current) => ({ ...current, [targetMode]: true }));
        setOtpCooldown((current) => ({ ...current, [targetMode]: 60 }));
        setVerifiedContact((current) => ({ ...current, [targetMode]: "" }));
        showSuccess(result.reqId ? "OTP sent to phone." : "OTP sent. Enter the OTP received.");
        return;
      }

      const res = await API.post("/auth/send-otp", { identifier, platform: "efruitmandi", mode: targetMode });
      setVerifiedContact((current) => ({ ...current, [targetMode]: "" }));
      setOtpCooldown((current) => ({ ...current, [targetMode]: 60 }));
      showSuccess(res.data?.message || "OTP sent.");
    } catch (err) {
      showError(err.response?.data?.msg || err.message || "Unable to send OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (targetMode) => {
    const form = targetMode === "login" ? loginForm : signupForm;
    const identifier = normalizeContact(form.identifier);

    if (!identifier || !form.otp.trim()) {
      showError("Enter email/phone and OTP.");
      return;
    }

    try {
      setLoading(true);
      if (isPhoneIdentifier(identifier)) {
        const widgetId = getEfruitMandiWidgetId();
        const tokenAuth = getEfruitMandiTokenAuth();
        const reqId = mobileOtpReqId[targetMode];
        if (!widgetId || !tokenAuth || !mobileOtpSent[targetMode]) {
          showError("Request phone OTP first.");
          return;
        }

        const result = await verifyMsg91WidgetOtp({ widgetId, tokenAuth, otp: form.otp.trim(), reqId });
        await API.post("/auth/verify-mobile-widget-otp", {
          identifier,
          platform: "efruitmandi",
          reqId: result.reqId || reqId,
          msg91: result.data,
        });
        setVerifiedContact((current) => ({
          ...current,
          [targetMode]: identifier,
        }));
        showSuccess("OTP verified.");
        return;
      }

      await API.post("/auth/verify-otp", {
        identifier,
        otp: form.otp.trim(),
        platform: "efruitmandi",
      });
      setVerifiedContact((current) => ({
        ...current,
        [targetMode]: identifier,
      }));
      showSuccess("OTP verified.");
    } catch (err) {
      showError(err.response?.data?.msg || err.message || "OTP verification failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setMessage({ type: "", text: "" });

    const identifier = normalizeContact(loginForm.identifier);

    if (!identifier || !loginForm.password) {
      showError("Enter email/phone and password.");
      return;
    }

    if (verifiedContact.login !== identifier) {
      showError("Verify OTP before login.");
      return;
    }

    try {
      setLoading(true);
      const res = await API.post("/auth/login", {
        identifier,
        password: loginForm.password,
        platform: "efruitmandi",
      });

      saveSession(res.data);

      if (!res.data.user?.role) {
        navigate("/profile-dashboard");
        return;
      }

      navigate("/profile-dashboard");
    } catch (err) {
      showError(err.response?.data?.msg || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (event) => {
    event.preventDefault();
    setMessage({ type: "", text: "" });

    const identifier = normalizeContact(signupForm.identifier);

    if (!signupForm.name.trim() || !identifier) {
      showError("Enter name and email/phone.");
      return;
    }

    if (verifiedContact.signup !== identifier) {
      showError("Verify OTP before signup.");
      return;
    }

    if (signupForm.password.length < 8 || strength.score < 2) {
      showError("Use a stronger password.");
      return;
    }

    if (!acceptedTerms) {
      showError("Accept Terms & Conditions before continuing.");
      return;
    }

    try {
      setLoading(true);

      await API.post("/auth/register", {
        name: signupForm.name.trim(),
        identifier,
        password: signupForm.password,
        platform: "efruitmandi",
      });

      const loginRes = await API.post("/auth/login", {
        identifier,
        password: signupForm.password,
        platform: "efruitmandi",
      });

      saveSession(loginRes.data);
      navigate("/profile-dashboard");
    } catch (err) {
      showError(err.response?.data?.msg || "Signup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const startOAuth = (provider) => {
    if (mode === "signup") {
      setPendingSocialProvider(provider);
      return;
    }

    const url = getEfruitOAuthUrl(provider, mode, mode === "signup" && acceptedTerms);
    if (!url) {
      showError(`${provider === "google" ? "Google" : "Facebook"} login is not configured.`);
      return;
    }
    window.location.href = url;
  };

  const activeForm = mode === "login" ? loginForm : signupForm;
  const activeVerified = verifiedContact[mode] === normalizeContact(activeForm.identifier);

  return (
    <div className="fixed inset-0 z-[999] bg-[#18a64b] p-2 sm:p-3">
      <div className="grid h-full grid-rows-[minmax(150px,30vh)_minmax(0,1fr)] overflow-hidden rounded-lg bg-white shadow-2xl sm:grid-rows-[minmax(180px,32vh)_minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_430px] lg:grid-rows-1 xl:grid-cols-[minmax(0,1fr)_460px]">
        <section className="relative flex min-h-0 flex-col justify-center bg-[#18a64b] px-6 py-5 text-white sm:px-8 lg:px-8 lg:py-8 xl:px-12">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="absolute left-6 top-5 rounded-md p-1 sm:left-8 lg:left-8 lg:top-7"
            aria-label="Go to home"
          >
            <img src={logoUrl} alt="E-Fruit Mandi" className="h-10 w-auto sm:h-11 lg:h-16 xl:h-20" />
          </button>

          <div className="max-w-2xl pt-5 sm:pt-6 lg:pt-0">
            <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.2em] sm:text-[10px] lg:mb-6 lg:text-xs">
              INDIA'S FIRST
            </p>
            <h1 className="text-[19px] font-black leading-[1.08] sm:text-2xl lg:text-3xl xl:text-4xl 2xl:text-5xl">
              Innovative, Trusted, and Authentic Fruit Trading Platform
            </h1>
            <p className="mt-2 max-w-xl text-[10px] font-medium leading-4 sm:text-xs lg:mt-5 lg:text-sm lg:leading-6 xl:text-base">
              Sell, Buy, Manage Horticulture Produce Payments and Logestics All at One place.
            </p>
            <div className="mt-3 grid max-w-xl grid-cols-3 gap-1.5 lg:mt-8 lg:gap-3">
              {trustBadges.map((item) => (
                <div
                  key={item.title}
                  className="rounded-md border border-white/15 bg-white/10 p-1.5 shadow-sm backdrop-blur lg:rounded-lg lg:p-3"
                >
                  <div className="flex h-5 items-center lg:h-10">
                    {item.logo ? (
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

        <main className="flex h-full min-h-0 justify-center overflow-y-auto bg-white px-5 py-3 sm:px-7 lg:overflow-hidden lg:px-6 lg:py-2">
          <div className="grid h-full w-full max-w-[390px] grid-rows-[auto_auto_minmax(0,1fr)_auto] lg:max-w-[360px]">
            <div className="grid grid-cols-2 rounded-lg bg-gray-100 p-1">
            <button
              type="button"
              onClick={() => changeMode("login")}
              className={`rounded-md py-1.5 text-xs font-semibold ${
                mode === "login"
                  ? "bg-white text-green-800 shadow-sm"
                  : "text-gray-500"
              }`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => changeMode("signup")}
              className={`rounded-md py-1.5 text-xs font-semibold ${
                mode === "signup"
                  ? "bg-white text-green-800 shadow-sm"
                  : "text-gray-500"
              }`}
            >
              Signup
            </button>
          </div>

            <div className="pt-3 lg:pt-2">
              <p className="text-xs font-bold text-green-700">E-Fruit Mandi</p>
              <h2 className="mt-1 text-xl font-black leading-tight text-gray-950 sm:text-2xl lg:text-xl">
                {mode === "login" ? "Welcome back" : "Create your account"}
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

            <div className="min-h-0 pt-3 lg:pt-2">
              {mode === "login" ? (
                <form onSubmit={handleLogin} autoComplete="off">
                  <ContactOtpFields
                    mode="login"
                    form={loginForm}
                    setForm={(updater) => setLoginForm(updater)}
                    onIdentifierChange={(value) => updateIdentifier("login", value)}
                    verified={activeVerified}
                    loading={loading}
                    otpCooldown={otpCooldown.login}
                    onSendOtp={() => handleSendOtp("login")}
                    onVerifyOtp={() => handleVerifyOtp("login")}
                    disableAutofill
                  />

                  <PasswordField
                    label="Password"
                    value={loginForm.password}
                    onChange={(value) =>
                      setLoginForm({ ...loginForm, password: value })
                    }
                    visible={showLoginPassword}
                    onToggle={() => setShowLoginPassword((value) => !value)}
                    autoComplete="new-password"
                    name="efruitmandi-login-passcode"
                  />

                  <button
                    type="button"
                    onClick={() => showError("Password reset is not connected yet.")}
                    className="mb-3 block w-full text-left text-xs font-semibold text-green-700 lg:mb-2"
                  >
                    Forgot password?
                  </button>

                  <SubmitButton loading={loading} label="Login" loadingLabel="Signing in..." />
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
                    onIdentifierChange={(value) => updateIdentifier("signup", value)}
                    verified={activeVerified}
                    loading={loading}
                    otpCooldown={otpCooldown.signup}
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

                  <TermsAcceptance checked={acceptedTerms} onChange={setAcceptedTerms} />

                  <SubmitButton loading={loading} label="Signup" loadingLabel="Creating..." />
                </form>
              )}
            </div>

            <div className="pb-1">
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span className="h-px flex-1 bg-gray-200" />
                <span>or continue using</span>
                <span className="h-px flex-1 bg-gray-200" />
              </div>

              <div className="mt-2 flex justify-center gap-3 lg:mt-1.5">
                {socialLinks.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => (item.provider ? startOAuth(item.provider) : window.open(item.href, "_blank", "noopener,noreferrer"))}
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
                onClick={() => changeMode(mode === "login" ? "signup" : "login")}
                className="mt-2 block w-full text-center text-xs text-gray-500 lg:mt-1.5"
              >
                {mode === "login" ? (
                  <>
                    New to E-Fruit Mandi?{" "}
                    <span className="font-bold text-green-700">Create account</span>
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
              showError(`${provider === "google" ? "Google" : "Facebook"} signup is not configured.`);
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
        I accept the{" "}
        <Link to="/terms-and-conditions" className="font-semibold text-green-700 underline">
          Terms & Conditions
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
  onSendOtp,
  onVerifyOtp,
  disableAutofill = false,
}) {
  const contactType = /^\+?\d[\d\s-]{5,}$/.test(form.identifier.trim())
    ? "phone"
    : "email";

  return (
    <>
      <Field
        icon={contactType === "phone" ? <FaPhoneAlt /> : <FaEnvelope />}
        label="Email / Phone number"
        inputProps={{
          value: form.identifier,
          onChange: (e) => onIdentifierChange(e.target.value),
          placeholder: "Enter email or phone number",
          autoComplete: disableAutofill ? "off" : mode === "login" ? "username" : "email",
          name: disableAutofill ? "efruitmandi-login-contact" : `${mode}-identifier`,
        }}
      />

      <div className="mb-2 lg:mb-1.5">
        <div className="mb-1 flex items-center justify-between">
          <label className="text-xs font-semibold text-gray-700">OTP verification</label>
          {verified && (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-green-700">
              <FaCheck /> Verified
            </span>
          )}
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2">
          <input
            value={form.otp}
            onChange={(e) => setForm({ ...form, otp: e.target.value })}
            placeholder="Enter OTP"
            inputMode="numeric"
            className="min-w-0 rounded-md border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-green-600 lg:py-1"
          />
          <button
            type="button"
            disabled={loading || otpCooldown > 0}
            onClick={onSendOtp}
            className="rounded-md bg-green-50 px-3 py-1.5 text-xs font-bold text-green-700 disabled:opacity-50 lg:py-1"
          >
            <FaPaperPlane className="inline-block" /> {otpCooldown > 0 ? `${otpCooldown}s` : "Send"}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onVerifyOtp}
            className="rounded-md bg-[#15883f] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50 lg:py-1"
          >
            Verify
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
        <h2 className="text-lg font-black text-gray-950">Accept Terms & Conditions</h2>
        <p className="mt-2 text-sm leading-6 text-gray-600">
          Please accept the Terms & Conditions to create your account with social signup.
        </p>
        <Link to="/terms-and-conditions" className="mt-3 inline-flex text-sm font-bold text-green-700 underline">
          Read Terms & Conditions
        </Link>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button type="button" onClick={onCancel} className="rounded-md bg-gray-100 px-4 py-2 text-sm font-bold text-gray-700">
            Cancel
          </button>
          <button type="button" onClick={onAccept} className="rounded-md bg-green-700 px-4 py-2 text-sm font-bold text-white">
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

function SubmitButton({ loading, label, loadingLabel }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full rounded-md bg-[#15883f] py-2.5 text-sm font-bold text-white disabled:opacity-60 lg:py-2"
    >
      {loading ? loadingLabel : label}
    </button>
  );
}
