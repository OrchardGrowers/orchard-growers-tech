import { lazy } from "react";

export const APP_BUILD_ID =
  typeof __EFRUITMANDI_BUILD_ID__ !== "undefined"
    ? __EFRUITMANDI_BUILD_ID__
    : "development";

const RELOAD_GUARD_PREFIX = "efruitmandi:reload:";
const CHUNK_ERROR_PATTERNS = [
  /failed to fetch dynamically imported module/i,
  /error loading a dynamically imported module/i,
  /importing a module script failed/i,
  /loading (?:css )?chunk [\w-]+ failed/i,
  /chunkloaderror/i,
  /failed to load module script/i,
  /unable to preload css/i,
  /module script.*mime/i,
  /mime type.*module script/i,
];

let reloadRequested = false;

const errorText = (error) =>
  [
    error?.name,
    error?.message,
    error?.reason?.name,
    error?.reason?.message,
    error?.cause?.name,
    error?.cause?.message,
  ]
    .filter(Boolean)
    .join(" ");

export const isChunkLoadError = (error) =>
  CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(errorText(error)));

export function prepareBuildRecovery(buildId = APP_BUILD_ID) {
  if (typeof window === "undefined") return;
  try {
    Object.keys(window.sessionStorage)
      .filter((key) => key.startsWith(RELOAD_GUARD_PREFIX))
      .forEach((key) => {
        if (window.sessionStorage.getItem(key) !== buildId) {
          window.sessionStorage.removeItem(key);
        }
      });
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}

export function reloadOnceForBuild(reason, buildId = APP_BUILD_ID) {
  if (reloadRequested || typeof window === "undefined") return false;

  const guardKey = `${RELOAD_GUARD_PREFIX}${reason}`;
  try {
    if (window.sessionStorage.getItem(guardKey) === buildId) return false;
    window.sessionStorage.setItem(guardKey, buildId);
  } catch {
    return false;
  }

  reloadRequested = true;
  if (import.meta.env.DEV) {
    console.warn(`eFruitMandi ${reason} recovery`, buildId);
  } else {
    console.warn(`eFruitMandi recovery requested (${reason}, build ${buildId})`);
  }
  window.location.reload();
  return true;
}

export function attemptChunkLoadRecovery(error) {
  return isChunkLoadError(error)
    ? reloadOnceForBuild("chunk")
    : false;
}

export function lazyWithRecovery(loader, timeoutMs = 30000) {
  return lazy(() => {
    let timeoutId;
    const timeout = new Promise((_, reject) => {
      timeoutId = window.setTimeout(() => {
        const error = new Error("Loading chunk timed out");
        error.name = "ChunkLoadError";
        reject(error);
      }, timeoutMs);
    });

    return Promise.race([loader(), timeout])
      .catch((error) => {
        attemptChunkLoadRecovery(error);
        throw error;
      })
      .finally(() => window.clearTimeout(timeoutId));
  });
}
