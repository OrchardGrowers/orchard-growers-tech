import { useEffect, useRef, useState } from "react";

const INSTALL_PROMPT_EVENT = "efruitmandi-install-app";
const INSTALL_DISMISSED_KEY = "efruitmandiInstallPromptDismissed";

const isStandaloneApp = () =>
  window.matchMedia?.("(display-mode: standalone)").matches ||
  window.navigator.standalone === true;

const isIosDevice = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent);

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

  useEffect(() => {
    if (isStandaloneApp()) return undefined;

    const openPrompt = () => setShowPrompt(true);
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      deferredPromptRef.current = event;
      setCanInstall(true);
      if (!wasDismissed()) setShowPrompt(true);
    };

    window.addEventListener(INSTALL_PROMPT_EVENT, openPrompt);
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    const timer = window.setTimeout(() => {
      if (!wasDismissed()) setShowPrompt(true);
    }, 1400);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(INSTALL_PROMPT_EVENT, openPrompt);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const closePrompt = () => {
    rememberDismissal();
    setShowPrompt(false);
  };

  const installApp = async () => {
    const promptEvent = deferredPromptRef.current;
    if (!promptEvent) return;

    deferredPromptRef.current = null;
    setCanInstall(false);
    await promptEvent.prompt();
    await promptEvent.userChoice.catch(() => undefined);
    rememberDismissal();
    setShowPrompt(false);
  };

  if (!showPrompt || isStandaloneApp()) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/40 px-4 pb-5 sm:items-center sm:pb-0">
      <section className="w-full max-w-sm rounded-2xl border border-green-200 bg-white p-5 text-gray-950 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-base font-extrabold text-green-900">For Better Experience Download the App</p>
            <p className="mt-2 text-sm font-semibold text-gray-600">
              {canInstall
                ? "Install eFruitMandi on this device for quick access."
                : "On iPhone/iPad, tap Share, then Add to Home Screen."}
            </p>
            {!isIosDevice() && !canInstall && (
              <p className="mt-1 text-xs font-semibold text-gray-500">
                If the install prompt is unavailable, use your browser menu and choose install app.
              </p>
            )}
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
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={installApp}
            className="flex-1 rounded-full bg-green-700 px-4 py-2 text-sm font-bold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!canInstall}
          >
            Download App
          </button>
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
