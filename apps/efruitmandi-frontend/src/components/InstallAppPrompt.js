import { useEffect, useRef, useState } from "react";
import { FaBell, FaMapMarkerAlt, FaMicrophone, FaMobileAlt, FaVideo } from "react-icons/fa";
import { trackInstallEvent } from "../utils/installAnalytics";
import { isStandalonePwa } from "../utils/mobilePermissions";

const INSTALL_PROMPT_EVENT = "efruitmandi-install-app";
const INSTALL_DISMISSED_KEY = "efruitmandiInstallPromptDismissed";

const installChannels = {
  pwa: { enabled: true, label: "Install App" },
  apk: { enabled: false, label: "Download APK" },
  playStore: { enabled: false, label: "Open on Play Store" },
};

const isStandaloneApp = () => isStandalonePwa();

const isIosDevice = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent);
const isAndroidDevice = () => /android/i.test(window.navigator.userAgent);
const isMobileDevice = () => /android|iphone|ipad|ipod|mobile/i.test(window.navigator.userAgent);

const wasDismissed = () => {
  try {
    return window.localStorage.getItem(INSTALL_DISMISSED_KEY) === "true";
  } catch {
    return false;
  }
};

const rememberDismissal = () => {
  try {
    window.localStorage.setItem(INSTALL_DISMISSED_KEY, "true");
  } catch {
    // Ignore private browsing storage failures.
  }
};

export const openEFruitInstallPrompt = () => {
  window.dispatchEvent(new Event(INSTALL_PROMPT_EVENT));
};

export default function InstallAppPrompt() {
  const deferredPromptRef = useRef(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [installed, setInstalled] = useState(() => isStandaloneApp());
  const [manualOpen, setManualOpen] = useState(false);

  const closePrompt = () => {
    rememberDismissal();
    setManualOpen(false);
    setShowPrompt(false);
  };

  const installApp = async () => {
    const promptEvent = deferredPromptRef.current;
    if (!promptEvent) {
      setManualOpen(true);
      setShowPrompt(true);
      return;
    }

    trackInstallEvent("install_prompt_shown", { channel: "pwa" });
    deferredPromptRef.current = null;
    setCanInstall(false);
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice.catch(() => ({ outcome: "dismissed" }));
    trackInstallEvent(choice?.outcome === "accepted" ? "install_accepted" : "install_dismissed", {
      channel: "pwa",
    });
    rememberDismissal();
    setShowPrompt(false);
  };

  useEffect(() => {
    const openPrompt = () => {
      trackInstallEvent("download_app_menu_click", { channel: installChannels.pwa.label });

      if (isStandaloneApp() || installed) {
        setInstalled(true);
        setShowPrompt(false);
        return;
      }

      if (deferredPromptRef.current) {
        installApp();
        return;
      }

      setManualOpen(true);
      setShowPrompt(true);
    };

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      deferredPromptRef.current = event;
      setCanInstall(true);
      trackInstallEvent("install_prompt_available", { channel: "pwa" });
      if (!wasDismissed()) setShowPrompt(true);
    };

    const handleInstalled = () => {
      trackInstallEvent("install_completed", { channel: "pwa" });
      setInstalled(true);
      setShowPrompt(false);
    };

    const shouldAutoShowPrompt = !installed && !wasDismissed() && isMobileDevice() && !isStandaloneApp();
    const autoTimer = shouldAutoShowPrompt
      ? window.setTimeout(() => {
          setManualOpen(true);
          setShowPrompt(true);
        }, 1800)
      : null;

    window.addEventListener(INSTALL_PROMPT_EVENT, openPrompt);
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      if (autoTimer) window.clearTimeout(autoTimer);
      window.removeEventListener(INSTALL_PROMPT_EVENT, openPrompt);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, [installed]);

  if (!showPrompt || isStandaloneApp()) return null;

  const showInstallButton = canInstall && installChannels.pwa.enabled && !installed;
  const guideText = isIosDevice()
    ? "On iPhone/iPad, tap Share, then Add to Home Screen."
    : isAndroidDevice()
      ? "Open Chrome or Edge menu, tap Install App when available. If Install App is unavailable, tap Add to Home Screen."
      : "Use Chrome or Edge and choose Install App from the browser menu.";

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/40 px-4 pb-5 sm:items-center sm:pb-0">
      <section className="w-full max-w-sm rounded-2xl border border-green-200 bg-white p-5 text-gray-950 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <img src="/icon-192.png" alt="" className="h-12 w-12 rounded-xl" />
            <div>
              <p className="text-base font-extrabold text-green-900">Install E-Fruit Mandi</p>
              <p className="mt-1 text-sm font-semibold text-gray-600">
                {installed
                  ? "E-Fruit Mandi is already installed on this device."
                  : canInstall
                    ? "Install the app for a faster marketplace experience."
                    : manualOpen
                      ? "Please install from Chrome/Edge for full app experience."
                      : "For Better Experience Download the App"}
              </p>
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
          <Benefit icon={<FaMobileAlt />} label="Faster loading" />
          <Benefit icon={<FaVideo />} label="Fruit lot videos" />
          <Benefit icon={<FaMicrophone />} label="Microphone access" />
          <Benefit icon={<FaMapMarkerAlt />} label="Location tracking" />
          <Benefit icon={<FaBell />} label="Push notifications" />
          <Benefit icon={<FaMobileAlt />} label="Offline ready" />
        </div>

        {!showInstallButton && !installed && (
          <div className="mt-4 rounded-lg bg-green-50 p-3 text-xs font-semibold leading-5 text-gray-700">
            <p className="font-extrabold text-green-900">Install from browser menu</p>
            <ol className="mt-1 list-decimal space-y-1 pl-4">
              <li>Open browser menu.</li>
              <li>Tap Install App, preferred.</li>
              <li>If Install App is unavailable, tap Add to Home Screen.</li>
            </ol>
            <p className="mt-2">{guideText}</p>
          </div>
        )}

        <div className="mt-4 flex gap-3">
          {showInstallButton ? (
            <button
              type="button"
              onClick={installApp}
              className="flex-1 rounded-full bg-green-700 px-4 py-2 text-sm font-bold text-white hover:bg-green-800"
            >
              Install E-Fruit Mandi
            </button>
          ) : (
            <span className="flex-1 rounded-full bg-green-50 px-4 py-2 text-center text-sm font-extrabold text-green-800">
              {installed ? "✓ App Installed" : "Install guide"}
            </span>
          )}
          <button
            type="button"
            onClick={closePrompt}
            className="rounded-full border border-green-700 px-4 py-2 text-sm font-bold text-green-700 hover:bg-green-50"
          >
            Close
          </button>
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
