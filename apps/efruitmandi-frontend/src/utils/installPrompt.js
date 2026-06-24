export const INSTALL_PROMPT_EVENT = "efruitmandi-install-app";

export const openEFruitInstallPrompt = () => {
  if (typeof window === "undefined") return;
  window.__efruitMandiInstallPromptRequested = true;
  window.dispatchEvent(new Event(INSTALL_PROMPT_EVENT));
};

export const consumePendingInstallPrompt = () => {
  if (typeof window === "undefined") return false;
  const pending = Boolean(window.__efruitMandiInstallPromptRequested);
  window.__efruitMandiInstallPromptRequested = false;
  return pending;
};
