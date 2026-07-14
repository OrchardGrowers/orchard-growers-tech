import { useEffect } from "react";

const IDLE_REFRESH_MS = 15 * 60 * 1000;
const SLEEP_GAP_MS = 60 * 1000;
const HEARTBEAT_MS = 15 * 1000;
const RELOAD_COOLDOWN_MS = 30 * 1000;
const LAST_RELOAD_KEY = "efruitmandi:last-auto-refresh";

const getLastReloadAt = () => {
  try {
    return Number(window.sessionStorage.getItem(LAST_RELOAD_KEY) || 0);
  } catch {
    return 0;
  }
};

const rememberReload = (timestamp) => {
  try {
    window.sessionStorage.setItem(LAST_RELOAD_KEY, String(timestamp));
  } catch {
    // A refresh should still work when browser storage is unavailable.
  }
};

export default function AutoRefreshOnResume() {
  useEffect(() => {
    let lastActivityAt = Date.now();
    let lastHeartbeatAt = Date.now();
    let hiddenAt = document.hidden ? Date.now() : 0;
    let wasOffline = !navigator.onLine;
    let pendingRefresh = false;
    let reloadStarted = false;

    const refreshPage = () => {
      const now = Date.now();

      if (reloadStarted) return;
      if (document.hidden || !navigator.onLine) {
        pendingRefresh = true;
        return;
      }
      if (now - getLastReloadAt() < RELOAD_COOLDOWN_MS) return;

      reloadStarted = true;
      rememberReload(now);
      window.location.reload();
    };

    const handleActivity = () => {
      const now = Date.now();
      const resumedAfterIdle = now - lastActivityAt >= IDLE_REFRESH_MS;
      lastActivityAt = now;

      if (resumedAfterIdle) refreshPage();
    };

    const handleOffline = () => {
      wasOffline = true;
    };

    const handleOnline = () => {
      if (wasOffline) {
        wasOffline = false;
        refreshPage();
      }
    };

    const handleVisibilityChange = () => {
      const now = Date.now();

      if (document.hidden) {
        hiddenAt = now;
        return;
      }

      const resumedAfterHiddenGap = hiddenAt > 0 && now - hiddenAt >= SLEEP_GAP_MS;
      hiddenAt = 0;
      lastActivityAt = now;

      if (pendingRefresh || resumedAfterHiddenGap || now - lastHeartbeatAt >= SLEEP_GAP_MS) {
        pendingRefresh = false;
        refreshPage();
      }
    };

    const handleFocus = () => {
      const now = Date.now();
      if (pendingRefresh || now - lastHeartbeatAt >= SLEEP_GAP_MS) {
        pendingRefresh = false;
        refreshPage();
      }
    };

    const handlePageShow = (event) => {
      if (event.persisted) refreshPage();
    };

    const heartbeatId = window.setInterval(() => {
      const now = Date.now();
      const resumedAfterSleep = now - lastHeartbeatAt >= SLEEP_GAP_MS;
      lastHeartbeatAt = now;

      if (resumedAfterSleep) refreshPage();
    }, HEARTBEAT_MS);

    const activityEvents = ["pointermove", "pointerdown", "keydown", "touchstart", "wheel"];
    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, handleActivity, { passive: true });
    });
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("pageshow", handlePageShow);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(heartbeatId);
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, handleActivity);
      });
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("pageshow", handlePageShow);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return null;
}
