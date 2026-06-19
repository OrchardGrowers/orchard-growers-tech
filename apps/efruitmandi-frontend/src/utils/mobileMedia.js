const DEFAULT_MAX_DIMENSION = 1200;
const DEFAULT_QUALITY = 0.7;
const MOBILE_MAX_BYTES = 700_000;
const DESKTOP_MAX_BYTES = 1_200_000;
const LOW_MEMORY_ANDROID_MAX_GB = 2;
const LEGACY_ANDROID_LOW_MEMORY_PATTERN = /Android (8|9|10)\b/i;

const getUserAgent = () => (typeof navigator === "undefined" ? "" : navigator.userAgent || "");

const getDeviceMemoryGb = () => {
  if (typeof navigator === "undefined") return null;

  const memory = Number(navigator.deviceMemory);
  return Number.isFinite(memory) && memory > 0 ? memory : null;
};

export const isMobileDevice = () => /android|iphone|ipad|ipod|mobile/i.test(getUserAgent());
export const isAndroidDevice = () => /android/i.test(getUserAgent());
export const isLikelyLowMemoryDevice = () => {
  const userAgent = getUserAgent();

  if (!/android/i.test(userAgent)) {
    return false;
  }

  const deviceMemoryGb = getDeviceMemoryGb();
  if (deviceMemoryGb !== null) {
    return deviceMemoryGb <= LOW_MEMORY_ANDROID_MAX_GB;
  }

  return LEGACY_ANDROID_LOW_MEMORY_PATTERN.test(userAgent);
};

export const prepareUploadFile = (file, options = {}) =>
  new Promise((resolve) => {
    if (!file) {
      resolve(file);
      return;
    }

    if (!file.type?.startsWith("image/")) {
      resolve(file);
      return;
    }

    // Low-RAM Android browsers can be killed by native image decode/canvas work
    // before JS can catch an error. Bypass compression before object URLs,
    // Image(), canvas allocation, drawImage(), or toBlob() touch the file.
    if (isLikelyLowMemoryDevice()) {
      resolve(file);
      return;
    }

    const maxBytes = options.maxBytes ?? (isMobileDevice() ? MOBILE_MAX_BYTES : DESKTOP_MAX_BYTES);
    const maxDimension = options.maxDimension ?? (isMobileDevice() ? 960 : DEFAULT_MAX_DIMENSION);
    const quality = options.quality ?? DEFAULT_QUALITY;
    const forceResize = Boolean(options.forceResize);

    if (!forceResize && file.size <= maxBytes && !isMobileDevice()) {
      resolve(file);
      return;
    }

    let objectUrl = "";
    const image = new Image();
    let canvas = null;

    const releaseResources = () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = "";
      }

      image.onload = null;
      image.onerror = null;
      image.src = "";

      if (canvas) {
        canvas.width = 0;
        canvas.height = 0;
        canvas = null;
      }
    };

    image.onload = () => {
      try {
        const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");

        if (!context) {
          releaseResources();
          resolve(file);
          return;
        }

        context.drawImage(image, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            releaseResources();
            if (!blob) {
              resolve(file);
              return;
            }

            resolve(
              new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
                type: "image/jpeg",
                lastModified: Date.now(),
              })
            );
          },
          "image/jpeg",
          quality
        );
      } catch {
        releaseResources();
        resolve(file);
      }
    };

    image.onerror = () => {
      releaseResources();
      resolve(file);
    };

    try {
      objectUrl = URL.createObjectURL(file);
      image.src = objectUrl;
    } catch {
      releaseResources();
      resolve(file);
    }
  });

export const getMobileUploadErrorMessage = (message = "") => {
  const normalized = String(message || "").toLowerCase();

  if (normalized.includes("memory") || normalized.includes("not enough")) {
    return "This photo is too large for the current browser memory. Please choose a smaller image or try again.";
  }

  if (normalized.includes("network") || normalized.includes("failed") || normalized.includes("upload")) {
    return "The upload could not finish on this device. Please try again with a smaller image.";
  }

  return message || "The upload could not be completed. Please try again.";
};
