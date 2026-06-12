const DEFAULT_MAX_DIMENSION = 1200;
const DEFAULT_QUALITY = 0.7;
const MOBILE_MAX_BYTES = 700_000;
const DESKTOP_MAX_BYTES = 1_200_000;

export const isMobileDevice = () => /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent || "");
export const isAndroidDevice = () => /android/i.test(navigator.userAgent || "");
export const isLikelyLowMemoryDevice = () =>
  isAndroidDevice() && /Android (8|9|10|11|12)\b/i.test(navigator.userAgent || "");

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

    const maxBytes = options.maxBytes ?? (isLikelyLowMemoryDevice() ? MOBILE_MAX_BYTES : DESKTOP_MAX_BYTES);
    const maxDimension = options.maxDimension ?? (isMobileDevice() ? 960 : DEFAULT_MAX_DIMENSION);
    const quality = options.quality ?? DEFAULT_QUALITY;
    const forceResize = Boolean(options.forceResize);

    if (!forceResize && file.size <= maxBytes && !isMobileDevice()) {
      resolve(file);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");

      if (!context) {
        URL.revokeObjectURL(objectUrl);
        resolve(file);
        return;
      }

      context.drawImage(image, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(objectUrl);
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
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };

    image.src = objectUrl;
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
