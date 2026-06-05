const secureContextMessage =
  "Camera, microphone, image capture, and live location permissions work only on HTTPS or localhost.";

export const isSecurePermissionContext = () =>
  window.isSecureContext ||
  ["localhost", "127.0.0.1"].includes(window.location.hostname);

const ensureSecurePermissionContext = () => {
  if (isSecurePermissionContext()) return true;
  window.alert(secureContextMessage);
  return false;
};

export const confirmImageCaptureConsent = () =>
  window.confirm(
    "eFruitMandi will open your camera or image picker only for the lot image you choose to upload. Continue?"
  );

export const confirmVideoCaptureConsent = () =>
  window.confirm(
    "eFruitMandi may use your camera and microphone for fruit lot packing video evidence when you choose to record or upload video. Continue?"
  );

export const requestPackingVideoPermission = async () => {
  if (!ensureSecurePermissionContext() || !confirmVideoCaptureConsent()) return false;
  if (!navigator.mediaDevices?.getUserMedia) return true;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    stream.getTracks().forEach((track) => track.stop());
    return true;
  } catch {
    window.alert("Camera or microphone permission was denied or unavailable.");
    return false;
  }
};

export const requestCameraPermission = async () => {
  if (!ensureSecurePermissionContext() || !confirmImageCaptureConsent()) return false;
  if (!navigator.mediaDevices?.getUserMedia) return true;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach((track) => track.stop());
    return true;
  } catch {
    window.alert("Camera permission was denied or unavailable.");
    return false;
  }
};

export const requestLocationPermission = ({ onSuccess, onError, options } = {}) => {
  if (!ensureSecurePermissionContext()) {
    onError?.();
    return;
  }

  const allowed = window.confirm(
    "eFruitMandi will request your location only for lot, premises, delivery, or real-time tracking actions you choose. Continue?"
  );

  if (!allowed) {
    onError?.();
    return;
  }

  if (!navigator.geolocation) {
    onError?.();
    return;
  }

  navigator.geolocation.getCurrentPosition(onSuccess, onError, options);
};
