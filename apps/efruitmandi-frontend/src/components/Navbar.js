import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  FaBell,
  FaChartLine,
  FaDownload,
  FaHandshake,
  FaHome,
  FaMicrophone,
  FaSearch,
  FaTruck,
  FaUser,
  FaYoutube,
} from "react-icons/fa";
import { getCurrentUser, hasAccessToken, logoutUser } from "../utils/auth";
import { openEFruitInstallPrompt } from "../utils/installPrompt";
import { isStandalonePwa } from "../utils/mobilePermissions";

const logoUrl = `${process.env.PUBLIC_URL || ""}/logo-240.png`;
const ProfileAccountMenu = lazy(() => import("./ProfileAccountMenu"));
const READ_NOTIFICATIONS_KEY = "efruitmandiReadNotifications";
const NOTIFICATION_STATE_EVENT = "efruitmandi-notifications-updated";
let apiClientPromise = null;
const getApiClient = () => {
  if (!apiClientPromise) {
    apiClientPromise = import("../services/api").then((module) => module.default);
  }
  return apiClientPromise;
};

const loadReadNotificationIds = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(READ_NOTIFICATIONS_KEY) || "[]"));
  } catch {
    return new Set();
  }
};

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const hasUser = hasAccessToken();
  const profileMenuRef = useRef(null);
  const currentUser = getCurrentUser();
  const [countries, setCountries] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
  const [isInstalledApp, setIsInstalledApp] = useState(() => isStandalonePwa());
  const [selected, setSelected] = useState({
    code: "IN",
    flag: "https://flagcdn.com/w40/in.png",
  });

  useEffect(() => {
    let active = true;

    import("../services/countryService")
      .then(({ getCountries }) => getCountries())
      .then((list) => {
        if (!active) return;
        setCountries(list);

        const saved = localStorage.getItem("selectedCountry");
        if (saved) {
          setSelected(JSON.parse(saved));
          return;
        }

        const india = list.find((country) => country.code === "IN");
        if (india) setSelected(india);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const syncInstalledAppStatus = () => setIsInstalledApp(isStandalonePwa());
    const mediaQuery = window.matchMedia?.("(display-mode: standalone)");

    syncInstalledAppStatus();
    mediaQuery?.addEventListener?.("change", syncInstalledAppStatus);
    window.addEventListener("appinstalled", syncInstalledAppStatus);

    return () => {
      mediaQuery?.removeEventListener?.("change", syncInstalledAppStatus);
      window.removeEventListener("appinstalled", syncInstalledAppStatus);
    };
  }, []);

  useEffect(() => {
    setProfileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    let cancelled = false;
    let idleId;
    let timerId;

    const refreshUnreadNotifications = async () => {
      if (!hasAccessToken()) {
        if (!cancelled) setHasUnreadNotifications(false);
        return;
      }

      try {
        const API = await getApiClient();
        const [lotRes, quoteRes] = await Promise.all([
          API.get("/products?platform=efruitmandi"),
          API.get("/quotes/buyer").catch(() => ({ data: { quotes: [] } })),
        ]);
        if (cancelled) return;
        const { getEfruitMandiProducts } = await import("../utils/marketProducts");
        if (cancelled) return;
        const latestLotIds = getEfruitMandiProducts(lotRes.data)
          .slice()
          .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
          .slice(0, 24)
          .map((lot) => lot._id)
          .filter(Boolean);
        const wonQuoteIds = (quoteRes.data?.quotes || [])
          .filter((quote) => String(quote.status || "").toLowerCase() === "accepted")
          .map((quote) => `quote-${quote._id}`)
          .filter(Boolean);
        const readIds = loadReadNotificationIds();

        setHasUnreadNotifications([...wonQuoteIds, ...latestLotIds].some((id) => !readIds.has(id)));
      } catch {
        if (!cancelled) setHasUnreadNotifications(false);
      }
    };

    const scheduleInitialRefresh = () => {
      if ("requestIdleCallback" in window) {
        idleId = window.requestIdleCallback(refreshUnreadNotifications, { timeout: 2500 });
        return;
      }
      timerId = window.setTimeout(refreshUnreadNotifications, 1400);
    };

    scheduleInitialRefresh();

    const handleNotificationUpdate = () => refreshUnreadNotifications();
    const handleStorage = (event) => {
      if (!event.key || event.key === READ_NOTIFICATIONS_KEY) refreshUnreadNotifications();
    };

    window.addEventListener(NOTIFICATION_STATE_EVENT, handleNotificationUpdate);
    window.addEventListener("storage", handleStorage);
    window.addEventListener("focus", handleNotificationUpdate);

    return () => {
      cancelled = true;
      if (idleId) window.cancelIdleCallback(idleId);
      if (timerId) window.clearTimeout(timerId);
      window.removeEventListener(NOTIFICATION_STATE_EVENT, handleNotificationUpdate);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", handleNotificationUpdate);
    };
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target)
      ) {
        setProfileMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const handleChange = (code) => {
    const selectedCountry = countries.find((country) => country.code === code);
    setSelected(selectedCountry);
    localStorage.setItem("selectedCountry", JSON.stringify(selectedCountry));
  };

  const desktopNavItems = [
    { path: "/", icon: <FaHome />, label: "Home" },
    { path: "/profile-dashboard", icon: <FaChartLine />, label: "Profile Dashboard" },
    { path: "/auctions", icon: <FaHandshake />, label: "Live Lots", isLiveLots: true },
    { path: "/delivery", icon: <FaTruck />, label: "Delivery" },
    {
      path: hasUser ? "/profile-dashboard" : "/profile",
      icon: <FaUser />,
      label: "Profile",
      isProfile: true,
    },
  ];

  const openProfileAction = (path) => {
    setProfileMenuOpen(false);
    navigate(path);
  };

  const runSearch = (query = searchQuery) => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;
    navigate(`/search?q=${encodeURIComponent(trimmedQuery)}`);
  };

  const startVoiceSearch = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Voice search not supported on this device/browser");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    setIsListening(true);
    recognition.start();

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setSearchQuery(transcript);
      runSearch(transcript);
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
  };

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-50 w-full max-w-full overflow-x-hidden bg-green-700 px-1.5 pb-2 pt-2 shadow-sm md:hidden">
        <div className="grid w-full max-w-full grid-cols-[60px_minmax(0,1fr)_auto] items-center gap-1">
          <Link
            to="/"
            aria-label="Go to home"
            className="flex h-10 min-w-0 items-center justify-start overflow-hidden"
          >
            <img src={logoUrl} width="60" height="40" className="max-h-10 w-[60px] object-contain" alt="Orchard Growers" />
          </Link>

          <SearchForm
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            runSearch={runSearch}
            isListening={isListening}
            startVoiceSearch={startVoiceSearch}
            mobile
          />

          <div className="flex min-w-0 items-center justify-end gap-1">
            <div className="flex h-8 w-[44px] shrink-0 items-center gap-0.5 rounded-full bg-white px-1">
              <img
  src={selected.flag}
  width="16"
  height="12"
  className="h-3 w-4 rounded-[2px]"
  alt={`${selected.code || "Country"} flag`}
/>
              <select
                aria-label="Select country"
                value={selected.code}
                onChange={(event) => handleChange(event.target.value)}
                className="min-w-0 flex-1 bg-white text-[10px] font-semibold outline-none"
              >
                {countries.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.code}
                  </option>
                ))}
              </select>
            </div>

            {!isInstalledApp && (
              <button
                type="button"
                onClick={() => openEFruitInstallPrompt({ source: "navbar-mobile" })}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-green-700"
                aria-label="Download eFruitMandi app"
                title="Download App"
              >
                <FaDownload className="text-sm" />
              </button>
            )}

            <a
              href="https://www.youtube.com/results?search_query=Efruit+Mandi"
              target="_blank"
              rel="noreferrer"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-red-600"
              aria-label="Learn us on YouTube"
              title="YouTube"
            >
              <FaYoutube className="text-base" />
            </a>

            <Link
              to="/notifications"
              aria-label="Notifications"
              title="Notifications"
              className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-green-700"
            >
              <FaBell className="text-sm" />
              {hasUnreadNotifications && (
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
              )}
            </Link>
          </div>
        </div>
      </div>

      <header className="fixed left-0 right-0 top-0 z-50 hidden bg-green-700 shadow-sm md:block">
        <div className="flex h-14 w-full items-center gap-3 px-4">
          <Link to="/" aria-label="Go to home" className="shrink-0">
            <img src={logoUrl} width="120" height="44" className="h-11 w-auto object-contain" alt="Orchard Growers" />
          </Link>

          <SearchForm
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            runSearch={runSearch}
            isListening={isListening}
            startVoiceSearch={startVoiceSearch}
          />

          <div className="ml-auto flex h-full items-center gap-3">
            <div className="flex items-center gap-1 rounded bg-white px-2 py-1">
              <img
  src={selected.flag}
  width="16"
  height="12"
  className="h-3 w-4"
  alt={`${selected.code || "Country"} flag`}
/>
              <select
                aria-label="Select country"
                value={selected.code}
                onChange={(event) => handleChange(event.target.value)}
                className="bg-white text-xs outline-none"
              >
                {countries.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.code}
                  </option>
                ))}
              </select>
            </div>

            {!isInstalledApp && (
              <button
                type="button"
                onClick={() => openEFruitInstallPrompt({ source: "navbar-desktop" })}
                className="flex h-9 shrink-0 items-center gap-2 rounded-full bg-white px-3 text-xs font-extrabold text-green-800 transition hover:bg-yellow-100"
                aria-label="Download eFruitMandi app"
                title="Download App"
              >
                <FaDownload className="text-sm" />
                <span>Download App</span>
              </button>
            )}

            <a
              href="https://www.youtube.com/results?search_query=Efruit+Mandi"
              target="_blank"
              rel="noreferrer"
              className="flex h-full flex-col items-center justify-center text-[10px] font-semibold text-white"
              aria-label="Learn us on YouTube"
            >
              <FaYoutube className="text-xl text-red-500" />
              <span>Learn Us</span>
            </a>

            <nav className="flex h-full items-center gap-5 border-l border-green-600 pl-4">
              {desktopNavItems.map((item) => {
                const isActive = location.pathname === item.path;

                if (item.isProfile) {
                  if (!hasUser) {
                    return (
                      <Link
                        key={item.label}
                        to={item.path}
                        aria-label={item.label}
                        title={item.label}
                        className={`relative flex min-w-8 flex-col items-center justify-center text-xl transition ${
                          isActive ? "text-yellow-300" : "text-yellow-400 hover:text-white"
                        }`}
                      >
                        {item.icon}
                      </Link>
                    );
                  }

                  return (
                    <div
                      key={item.label}
                      ref={profileMenuRef}
                      className="relative flex h-full items-center"
                    >
                      <button
                        type="button"
                        aria-label="Profile menu"
                        aria-expanded={profileMenuOpen}
                        title={item.label}
                        onClick={() => setProfileMenuOpen((open) => !open)}
                        className={`relative flex min-w-8 flex-col items-center justify-center text-xl transition ${
                          profileMenuOpen || isActive
                            ? "text-yellow-300"
                            : "text-yellow-400 hover:text-white"
                        }`}
                      >
                        {item.icon}
                      </button>

                      {profileMenuOpen && (
                        <Suspense fallback={null}>
                          <ProfileAccountMenu
                            user={currentUser}
                            onAction={openProfileAction}
                            onLogout={logoutUser}
                          />
                        </Suspense>
                      )}
                    </div>
                  );
                }

                return (
                  <Link
                    key={item.label}
                    to={item.path}
                    aria-label={item.label}
                    title={item.label}
                    className={`relative flex min-w-8 flex-col items-center justify-center text-xl transition ${
                      isActive ? "text-yellow-300" : "text-yellow-400 hover:text-white"
                    }`}
                  >
                    {item.isLiveLots && (
                      <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 text-[11px] font-extrabold leading-none">
                        {"\u20b9"}
                      </span>
                    )}
                    <span className={item.isLiveLots ? "mt-2" : ""}>{item.icon}</span>
                  </Link>
                );
              })}
            </nav>

            <Link
              to="/notifications"
              aria-label="Notifications"
              title="Notifications"
              className="relative flex h-full items-center justify-center text-xl text-yellow-400 hover:text-white"
            >
              <FaBell />
              {hasUnreadNotifications && (
                <span className="absolute right-0 top-3 h-2 w-2 rounded-full bg-red-500" />
              )}
            </Link>
          </div>
        </div>
      </header>
    </>
  );
}

function SearchForm({
  searchQuery,
  setSearchQuery,
  runSearch,
  isListening = false,
  startVoiceSearch,
  mobile = false,
}) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        runSearch();
      }}
      className={
        mobile
          ? "flex min-w-0 w-full items-center rounded-full bg-white px-2 py-1"
          : "flex h-9 w-full max-w-[760px] flex-1 items-center gap-2 rounded-full border border-green-300 bg-green-50 px-4 text-green-800"
      }
    >
      {!mobile && <FaSearch className="text-sm" />}
      <input
        id={mobile ? "searchInput" : undefined}
        value={searchQuery}
        onChange={(event) => setSearchQuery(event.target.value)}
        placeholder={isListening ? "Listening..." : "Search Live Fruit Lots, APMC Price, and Anything on Web"}
        className={`min-w-0 flex-1 bg-transparent text-sm text-gray-900 outline-none ${
          mobile ? "text-xs placeholder:text-gray-400" : "placeholder:text-green-700/70"
        }`}
      />
      <button
        type="button"
        onClick={startVoiceSearch}
        aria-label="Voice search"
        className={
          mobile
            ? `ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                isListening ? "bg-red-50 text-red-600" : "bg-gray-100 text-black"
              }`
            : `flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                isListening ? "bg-red-50 text-red-600" : "bg-white text-green-800"
              }`
        }
      >
        <FaMicrophone className={mobile ? "" : "text-xs"} />
      </button>
      {mobile ? (
        <button
          type="submit"
          aria-label="Search"
          className="ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-700 text-white"
        >
          <FaSearch className="text-[10px]" />
        </button>
      ) : (
        <button
          type="submit"
          aria-label="Search"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-700 text-white"
        >
          <FaSearch className="text-xs" />
        </button>
      )}
    </form>
  );
}
