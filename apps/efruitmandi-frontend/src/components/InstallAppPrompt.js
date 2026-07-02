import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FaAndroid,
  FaApple,
  FaBell,
  FaCopy,
  FaExternalLinkAlt,
  FaMapMarkerAlt,
  FaMicrophone,
  FaMobileAlt,
  FaShareAlt,
  FaVideo,
  FaWindows,
} from "react-icons/fa";
import { trackInstallEvent } from "../utils/installAnalytics";
import {
  consumePendingInstallPrompt,
  getEFruitInstallLink,
  getInstallPlatform,
  getNativeAppDownloadLink,
  INSTALL_PROMPT_EVENT,
  INSTALL_QUERY_PARAM,
} from "../utils/installPrompt";
import { isStandalonePwa } from "../utils/mobilePermissions";

const AUTO_LOGIN_PROMPT_SESSION_KEY = "efruitmandiInstallPromptAfterLoginShown";

const isStandaloneApp = () => isStandalonePwa();

const platformContent = {
  android: {
    icon: <FaAndroid />,
    title: "Install eFruitMandi Android App",
    action: "Install Android App",
    guideTitle: "Install on Android",
    guideSteps: [
      "Open this link in Chrome or Edge.",
      "Tap Install App when the prompt appears.",
      "If the prompt is unavailable, open browser menu and tap Add to Home Screen.",
    ],
  },
  ios: {
    icon: <FaApple />,
    title: "Install eFruitMandi iOS App",
    action: "Install iOS App",
    guideTitle: "Install on iPhone",
    guideSteps: [
      "Open this link in Safari.",
      "Tap the Share button.",
      "Choose Add to Home Screen, then tap Add.",
    ],
  },
  windows: {
    icon: <FaWindows />,
    title: "Install eFruitMandi Windows App",
    action: "Install Windows App",
    guideTitle: "Install on Windows",
    guideSteps: [
      "Open this link in Chrome or Edge.",
      "Click Install App in the address bar or browser menu.",
      "Pin the installed app to Start or taskbar.",
    ],
  },
  desktop: {
    icon: <FaMobileAlt />,
    title: "Install eFruitMandi App",
    action: "Install App",
    guideTitle: "Install on this device",
    guideSteps: [
      "Open this link in Chrome, Edge, or Safari.",
      "Use the browser menu and choose Install App.",
      "If Install App is unavailable, choose Add to Home Screen.",
    ],
  },
};

export default function InstallAppPrompt() {
  const deferredPromptRef = useRef(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [installed, setInstalled] = useState(() => isStandaloneApp());
  const [source, setSource] = useState("auto");
  const [copied, setCopied] = useState(false);
  const shareableLink = useMemo(() => getEFruitInstallLink(), []);
  const platform = typeof window === "undefined" ? "desktop" : getInstallPlatform();
  const content = platformContent[platform] || platformContent.desktop;
  const nativeLink = getNativeAppDownloadLink(platform);

  const closePrompt = () => {
    setShowPrompt(false);
    setCopied(false);
  };

  const openPrompt = useCallback(
    (detail = {}) => {
      if (isStandaloneApp() || installed) {
        setInstalled(true);
        setShowPrompt(false);
        return;
      }

      const promptSource = detail?.source || "manual";
      if (promptSource === "login") {
        try {
          if (window.sessionStorage.getItem(AUTO_LOGIN_PROMPT_SESSION_KEY) === "true") return;
          window.sessionStorage.setItem(AUTO_LOGIN_PROMPT_SESSION_KEY, "true");
        } catch {
          // Ignore private browsing storage failures.
        }
      }

      setSource(promptSource);
      setCopied(false);
      setShowPrompt(true);
      trackInstallEvent("download_app_prompt_opened", {
        channel: platform,
        source: promptSource,
      });
    },
    [installed, platform]
  );

  const installApp = async () => {
    const promptEvent = deferredPromptRef.current;
    if (promptEvent) {
      trackInstallEvent("install_prompt_shown", { channel: platform, source });
      deferredPromptRef.current = null;
      setCanInstall(false);
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice.catch(() => ({ outcome: "dismissed" }));
      trackInstallEvent(choice?.outcome === "accepted" ? "install_accepted" : "install_dismissed", {
        channel: platform,
        source,
      });
      setShowPrompt(false);
      return;
    }

    if (nativeLink) {
      window.open(nativeLink, "_blank", "noopener,noreferrer");
      return;
    }

    setShowPrompt(true);
  };

  const copyLink = async () => {
    try {
      await window.navigator.clipboard.writeText(shareableLink);
      setCopied(true);
      trackInstallEvent("install_link_copied", { channel: platform, source });
    } catch {
      window.prompt("Copy eFruitMandi app install link", shareableLink);
    }
  };

  useEffect(() => {
    const handleOpenPrompt = (event) => {
      openPrompt(event.detail || { source: "manual" });
    };

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      deferredPromptRef.current = event;
      setCanInstall(true);
      trackInstallEvent("install_prompt_available", { channel: platform });
    };

    const handleInstalled = () => {
      trackInstallEvent("install_completed", { channel: platform, source });
      setInstalled(true);
      setShowPrompt(false);
    };

    window.addEventListener(INSTALL_PROMPT_EVENT, handleOpenPrompt);
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    const pending = consumePendingInstallPrompt();
    if (pending) window.setTimeout(() => openPrompt(pending), 0);

    const queryParams = new URLSearchParams(window.location.search);
    if (queryParams.get(INSTALL_QUERY_PARAM) === "1" || queryParams.get("download_app") === "1") {
      window.setTimeout(() => openPrompt({ source: "share-link" }), 400);
    }

    return () => {
      window.removeEventListener(INSTALL_PROMPT_EVENT, handleOpenPrompt);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, [openPrompt, platform, source]);

  if (!showPrompt || isStandaloneApp()) return null;

  const primaryLabel = nativeLink && !canInstall ? "Open Download Link" : content.action;
  const sourceText =
    source === "login"
      ? "Install the app for faster access after login."
      : "Use this app link on desktop, Android, or iPhone.";

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45 px-4 pb-5 backdrop-blur-sm sm:items-center sm:pb-0">
      <section className="w-full max-w-md rounded-2xl border border-green-200 bg-white p-5 text-gray-950 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <img
              src="/icon-192.png"
              alt="eFruitMandi app icon"
              width="48"
              height="48"
              className="h-12 w-12 shrink-0 rounded-xl"
            />
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-base font-extrabold text-green-900">
                <span className="text-lg text-green-700">{content.icon}</span>
                <span>{content.title}</span>
              </p>
              <p className="mt-1 text-sm font-semibold text-gray-600">{sourceText}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={closePrompt}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xl leading-none text-gray-700 hover:bg-green-50"
            aria-label="Close install app popup"
          >
            x
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-bold text-gray-700">
          <Benefit icon={<FaMobileAlt />} label="App-like access" />
          <Benefit icon={<FaVideo />} label="Fruit lot videos" />
          <Benefit icon={<FaMicrophone />} label="Voice search" />
          <Benefit icon={<FaMapMarkerAlt />} label="Location tools" />
          <Benefit icon={<FaBell />} label="Notifications" />
          <Benefit icon={<FaShareAlt />} label="Sharable link" />
        </div>

        <div className="mt-4 rounded-lg bg-green-50 p-3 text-xs font-semibold leading-5 text-gray-700">
          <p className="font-extrabold text-green-900">{content.guideTitle}</p>
          <ol className="mt-1 list-decimal space-y-1 pl-4">
            {content.guideSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>

        <label className="mt-4 block text-xs font-extrabold text-gray-700">
          Shareable app download link
          <div className="mt-1 flex min-w-0 items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2">
            <input
              readOnly
              value={shareableLink}
              className="min-w-0 flex-1 bg-transparent text-xs font-bold text-green-900 outline-none"
              onFocus={(event) => event.target.select()}
            />
            <button
              type="button"
              onClick={copyLink}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-green-800 ring-1 ring-green-200 hover:bg-green-100"
              aria-label="Copy app download link"
            >
              <FaCopy />
            </button>
          </div>
          {copied && <span className="mt-1 block text-[11px] font-bold text-green-700">Link copied.</span>}
        </label>

        <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] gap-3">
          <button
            type="button"
            onClick={installApp}
            className="min-h-11 rounded-full bg-green-700 px-4 py-2 text-sm font-bold text-white hover:bg-green-800"
          >
            {primaryLabel}
          </button>
          <a
            href={shareableLink}
            className="flex min-h-11 items-center justify-center rounded-full border border-green-700 px-4 py-2 text-sm font-bold text-green-700 hover:bg-green-50"
          >
            <FaExternalLinkAlt className="mr-2 text-xs" />
            Link
          </a>
        </div>
      </section>
    </div>
  );
}

function Benefit({ icon, label }) {
  return (
    <span className="flex items-center gap-2 rounded-lg bg-gray-50 px-2 py-2">
      <span className="text-green-700">{icon}</span>
      <span>{label}</span>
    </span>
  );
}
