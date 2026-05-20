import { useEffect, useRef, useState } from 'react';

const INSTALL_PROMPT_EVENT = 'admin-panel-install-app';
const INSTALL_DISMISSED_KEY = 'adminPanelInstallPromptDismissed';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

const isStandaloneApp = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

const isIosDevice = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent);

const wasDismissed = () => {
  try {
    return window.localStorage.getItem(INSTALL_DISMISSED_KEY) === 'true';
  } catch {
    return false;
  }
};

const rememberDismissal = () => {
  try {
    window.localStorage.setItem(INSTALL_DISMISSED_KEY, 'true');
  } catch {
    // Ignore private browsing storage failures.
  }
};

export const openAdminInstallPrompt = () => {
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
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    const timer = window.setTimeout(() => {
      if (!wasDismissed()) setShowPrompt(true);
    }, 1400);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(INSTALL_PROMPT_EVENT, openPrompt);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
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
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/60 px-4 pb-5 sm:items-center sm:pb-0">
      <section className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-900 p-5 text-slate-100 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-base font-bold text-white">For Better Experience Download the App</p>
            <p className="mt-2 text-sm font-semibold text-slate-300">
              {canInstall
                ? 'Install Admin Panel on this device for quick access.'
                : 'On iPhone/iPad, tap Share, then Add to Home Screen.'}
            </p>
            {!isIosDevice() && !canInstall && (
              <p className="mt-1 text-xs font-semibold text-slate-400">
                If the install prompt is unavailable, use your browser menu and choose install app.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={closePrompt}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-xl leading-none text-slate-950 hover:bg-emerald-100"
            aria-label="Close install app popup"
          >
            ×
          </button>
        </div>
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={installApp}
            className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!canInstall}
          >
            Download App
          </button>
          <button
            type="button"
            onClick={closePrompt}
            className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-100"
          >
            Close
          </button>
        </div>
      </section>
    </div>
  );
}
