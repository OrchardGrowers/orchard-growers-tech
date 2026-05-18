import { useEffect, useRef, useState } from "react";

const INSTALL_PROMPT_EVENT = "orchardgrowers-install-app";
const INSTALL_DISMISSED_KEY = "orchardgrowersInstallPromptDismissed";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const isStandaloneApp = () =>
  window.matchMedia?.("(display-mode: standalone)").matches ||
  (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

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

export const openOrchardInstallPrompt = () => {
  window.dispatchEvent(new Event(INSTALL_PROMPT_EVENT));
};

export default function InstallAppPrompt() {
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    if (isStandaloneApp()) return;

    const openPrompt = () => setShowPrompt(true);
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      deferredPromptRef.current = event as BeforeInstallPromptEvent;
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
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/30 px-4 pb-5 sm:items-center sm:pb-0">
      <section className="w-full max-w-sm rounded-lg border border-green-200 bg-white p-5 text-slate-900 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-base font-bold text-green-900">For Better Experience Download the App</p>
            <p className="mt-2 text-sm font-medium text-slate-600">
              {canInstall
                ? "Install Orchard Growers on this device for quick access."
                : "On iPhone/iPad, tap Share, then Add to Home Screen."}
            </p>
            {!isIosDevice() && !canInstall && (
              <p className="mt-1 text-xs font-medium text-slate-500">
                If the install prompt is unavailable, use your browser menu and choose install app.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={closePrompt}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-2xl leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close install app popup"
          >
            x
          </button>
        </div>
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={installApp}
            className="flex-1 rounded-full bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!canInstall}
          >
            Download App
          </button>
          <button
            type="button"
            onClick={closePrompt}
            className="rounded-full border border-green-700 px-4 py-2 text-sm font-semibold text-green-700 hover:bg-green-50"
          >
            Close
          </button>
        </div>
      </section>
    </div>
  );
}
