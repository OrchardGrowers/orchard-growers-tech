import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { FaCamera, FaCheckCircle, FaExclamationTriangle, FaImage, FaSpinner, FaVideo } from "react-icons/fa";
import API, { getApiErrorMessage } from "../services/api";
import { isMobileDevice } from "../utils/mobileMedia";

let fruitRecognitionModulePromise;

const loadFruitRecognition = () => {
  if (!fruitRecognitionModulePromise) {
    fruitRecognitionModulePromise = import("../utils/fruitRecognition");
  }

  return fruitRecognitionModulePromise;
};

const withTimeout = (promise, ms = 15000) => {
  let timeoutId;

  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("recognition-timeout")), ms);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
};

const isLowMemoryRecognitionError = (error) => {
  const message = String(error?.message || error || "").toLowerCase();

  return (
    message.includes("memory") ||
    message.includes("not enough") ||
    message.includes("allocation") ||
    message.includes("canvas") ||
    message.includes("timeout") ||
    message.includes("recognition-timeout") ||
    message.includes("webgl") ||
    message.includes("context lost")
  );
};

export default function MobileCapture() {
  const { sessionId } = useParams();
  const isMobile = useMemo(() => isMobileDevice(), []);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [message, setMessage] = useState("");

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraStream(null);
    setCameraActive(false);
  };

  useEffect(() => {
    let active = true;

    API.get(`/capture-sessions/${sessionId}`)
      .then((res) => {
        if (active) setSession(res.data);
      })
      .catch((error) => {
        if (active) {
          setMessage(getApiErrorMessage(error, "Capture session is unavailable or expired."));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [sessionId]);

  useEffect(() => {
    if (!cameraStream || !videoRef.current) return;

    videoRef.current.srcObject = cameraStream;
    videoRef.current.play().catch(() => undefined);
  }, [cameraStream]);

  useEffect(
    () => () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    },
    []
  );

  const openCamera = async () => {
    if (!session || uploading || cameraStarting) return;

    if (!isMobile) {
      setMessage("Lot photos and video must be captured live from a mobile camera.");
      return;
    }

    if (session.mediaType !== "image") {
      setMessage("Live video capture is coming soon. Please capture photos first.");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setMessage("Camera is not available in this browser. Please open this link in Chrome.");
      return;
    }

    try {
      setMessage("");
      setCameraStarting(true);
      stopCamera();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });

      streamRef.current = stream;
      setCameraStream(stream);
      setCameraActive(true);
    } catch (error) {
      const name = String(error?.name || "").toLowerCase();
      if (name.includes("notallowed") || name.includes("permission")) {
        setMessage("Camera permission is blocked. Open Chrome settings > Site settings > Camera and allow camera for efruitmandi.live.");
      } else if (name.includes("notfound") || name.includes("notreadable") || name.includes("overconstrained")) {
        setMessage("Unable to open camera. Close other camera apps and try again.");
      } else {
        setMessage("Unable to open camera. Close other camera apps and try again.");
      }
    } finally {
      setCameraStarting(false);
    }
  };

  const captureFrameFile = async () => {
    const video = videoRef.current;
    if (!video?.videoWidth || !video?.videoHeight) {
      throw new Error("camera-frame-unavailable");
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("canvas-unavailable");
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.86)
    );

    canvas.width = 0;
    canvas.height = 0;

    if (!blob) {
      throw new Error("canvas-blob-unavailable");
    }

    return new File([blob], `fruit-capture-${Date.now()}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  };

  const uploadCapturedImage = async (file) => {
    if (!file || !session || uploading) return;

    try {
      setUploading(true);
      try {
      setMessage("Checking fruit image...");
        const { recognizeFruitImage } = await loadFruitRecognition();
        const recognition = await withTimeout(recognizeFruitImage(file), 15000);

        if (!recognition?.accepted) {
          setMessage("Fruit not recognized - take again.");
          return;
        }
      } catch (error) {
        setMessage(
          isLowMemoryRecognitionError(error)
            ? "Low phone memory - clean space and try again."
            : "Fruit not recognized - take again."
        );
        return;
      }

      setMessage("Uploading live fruit image...");
      const data = new FormData();
      data.append("media", file);

      await API.post(`/capture-sessions/${sessionId}/media`, data, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setUploaded(true);
      setMessage(`${getUploadProgressLabel(session)} You can return to your laptop.`);
      stopCamera();
    } catch (error) {
      setMessage(getApiErrorMessage(error, "Could not upload captured media. Please try again."));
    } finally {
      setUploading(false);
    }
  };

  const captureFruitPhoto = async () => {
    if (uploading) return;

    try {
      const file = await captureFrameFile();
      await uploadCapturedImage(file);
    } catch (error) {
      setMessage(
        isLowMemoryRecognitionError(error)
          ? "Low phone memory - clean space and try again."
          : "Unable to open camera. Close other camera apps and try again."
      );
    }
  };

  const isImage = session?.mediaType === "image";
  const isStatusMessage =
    message === "Checking fruit image..." || message === "Uploading live fruit image...";
  const uploadProgressLabel = getUploadProgressLabel(session);

  return (
    <div className="mx-auto min-h-screen max-w-md bg-white px-4 py-6">
      <div className="mb-5 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border-2 border-green-700 text-xl text-green-700">
          {isImage ? <FaImage /> : <FaVideo />}
        </div>
        <h1 className="mt-3 text-xl font-extrabold text-black">Take Live Fruit Images</h1>
        <p className="mt-1 text-xs font-semibold text-gray-500">
          Lot photos and video must be captured live from a mobile camera.
        </p>
        {!loading && isMobile && session && !uploaded && (
          <p className="mt-2 text-xs font-bold text-green-800">
            Allow Camera Access to capture this fruit image.
          </p>
        )}
        {!loading && isMobile && session && isImage && (
          <p className="mt-2 rounded-full bg-green-50 px-3 py-1 text-xs font-extrabold text-green-800">
            {uploaded ? uploadProgressLabel : `Slot ${getUploadSlotNumber(session) || 1}/5`}
          </p>
        )}
      </div>

      {loading && (
        <div className="rounded-md bg-green-50 px-3 py-3 text-xs font-bold text-green-800">
          Checking capture link...
        </div>
      )}

      {!loading && !isMobile && (
        <div className="rounded-md bg-orange-50 px-3 py-3 text-xs font-bold text-orange-800">
          <FaExclamationTriangle className="mb-2" />
          Open this link on a mobile phone to capture live lot media.
        </div>
      )}

      {message && (
        <div className={`mt-3 rounded-md px-3 py-3 text-xs font-bold ${
          uploaded || isStatusMessage ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"
        }`}>
          {message}
          {uploading && (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/70">
              <div className="h-full w-2/3 animate-pulse rounded-full bg-green-700" />
            </div>
          )}
        </div>
      )}

      {!loading && isMobile && session && !uploaded && !isImage && (
        <div className="mt-4 rounded-md bg-orange-50 px-3 py-3 text-xs font-bold text-orange-800">
          Live video capture is coming soon. Please capture photos first.
        </div>
      )}

      {!loading && isMobile && session && !uploaded && isImage && (
        <div className="mt-4">
          {!cameraActive ? (
            <button
              type="button"
              onClick={openCamera}
              disabled={cameraStarting || uploading}
              className="flex min-h-14 w-full items-center justify-center gap-3 rounded-md border border-dashed border-green-400 bg-green-50 px-4 py-5 text-sm font-extrabold text-green-800 disabled:cursor-wait disabled:border-orange-300 disabled:bg-orange-50 disabled:text-orange-700"
            >
              {cameraStarting ? <FaSpinner className="animate-spin" /> : <FaCamera />}
              <span>{cameraStarting ? "Opening camera..." : "Allow Camera Access"}</span>
            </button>
          ) : (
            <div className="space-y-3">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="aspect-[3/4] w-full rounded-md bg-black object-cover"
              />
              <button
                type="button"
                onClick={captureFruitPhoto}
                disabled={uploading}
                className="flex min-h-14 w-full items-center justify-center gap-3 rounded-md bg-green-700 px-4 py-4 text-sm font-extrabold text-white disabled:cursor-wait disabled:bg-gray-300"
              >
                {uploading ? <FaSpinner className="animate-spin" /> : <FaCamera />}
                <span>
                  {uploading
                    ? message === "Checking fruit image..."
                      ? "Checking fruit image..."
                      : "Uploading..."
                    : "Take Live Fruit Image"}
                </span>
              </button>
            </div>
          )}
        </div>
      )}

      {uploaded && (
        <div className="mt-4 flex min-h-12 items-center gap-2 rounded-md bg-green-700 px-4 py-3 text-sm font-extrabold text-white">
          <FaCheckCircle />
          <span>{uploadProgressLabel}</span>
        </div>
      )}
    </div>
  );
}

function getUploadSlotNumber(session = {}) {
  const slot = Number(session?.slotIndex);
  return Number.isInteger(slot) && slot >= 0 ? slot + 1 : null;
}

function getUploadProgressLabel(session = {}) {
  const slotNumber = getUploadSlotNumber(session);
  return slotNumber ? `${slotNumber}/5 Uploaded` : "Upload complete";
}
