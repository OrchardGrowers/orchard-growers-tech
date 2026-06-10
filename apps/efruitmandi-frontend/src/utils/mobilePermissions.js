export const isStandalonePwa = () => {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.navigator.standalone === true ||
    document.referrer.startsWith("android-app://")
  );
};

export const requestMediaPermission = async ({ kind = "camera", audio = false } = {}) => {
  if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return {
      granted: false,
      reason: "unsupported",
      message: "This browser does not support camera or microphone access.",
    };
  }

  const video = kind === "camera" || kind === "video";

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video,
      audio: kind === "microphone" || kind === "video" || audio,
    });
    stream.getTracks().forEach((track) => track.stop());
    return { granted: true, reason: "granted" };
  } catch (error) {
    const denied = /notallowed|permission|denied/i.test(String(error?.message || error || ""));
    return {
      granted: false,
      reason: denied ? "denied" : "blocked",
      message:
        denied
          ? "Camera or microphone access was blocked. You can still continue by choosing a file from your gallery."
          : "This device could not start the camera or microphone right now. Please try again in a moment.",
    };
  }
};

export const requestLocationPermission = async () => {
  if (typeof window === "undefined" || !navigator.geolocation) {
    return {
      granted: false,
      reason: "unsupported",
      message: "Location access is not available in this browser.",
    };
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      () => resolve({ granted: true, reason: "granted" }),
      (error) => {
        const denied = error?.code === 1;
        resolve({
          granted: false,
          reason: denied ? "denied" : "blocked",
          message: denied
            ? "Location access was blocked. You can still continue without it."
            : "Location could not be resolved right now.",
        });
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
    );
  });
};
