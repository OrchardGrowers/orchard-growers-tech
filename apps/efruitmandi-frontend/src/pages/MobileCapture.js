import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { FaCamera, FaCheckCircle, FaExclamationTriangle, FaImage, FaSpinner, FaVideo } from "react-icons/fa";
import API, { getApiErrorMessage } from "../services/api";
import { isMobileDevice, prepareUploadFile } from "../utils/mobileMedia";

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
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [message, setMessage] = useState("");

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

  const handleCapture = async (file) => {
    if (!file || !session) return;

    if (!isMobile) {
      setMessage("Lot photos and video must be captured live from a mobile camera.");
      return;
    }

    if (session.mediaType === "image" && !file.type?.startsWith("image/")) {
      setMessage("Only a live lot photo can be uploaded for this capture link.");
      return;
    }

    if (session.mediaType === "video" && !file.type?.startsWith("video/")) {
      setMessage("Only a live lot video can be uploaded for this capture link.");
      return;
    }

    try {
      setMessage("");
      setUploading(true);
      let mediaFile = file;

      if (session.mediaType === "image") {
        try {
          setMessage("Recognizing image...");
          const { recognizeFruitImage } = await loadFruitRecognition();
          const recognition = await withTimeout(recognizeFruitImage(file), 15000);

          if (!recognition?.accepted) {
            setMessage("Image not recognized. Take image again.");
            return;
          }
        } catch (error) {
          setMessage(
            isLowMemoryRecognitionError(error)
              ? "Low phone memory. Clean up some space and try again."
              : "Image not recognized. Take image again."
          );
          return;
        }

        mediaFile = await prepareUploadFile(file, {
          forceResize: true,
          maxDimension: 1200,
          quality: 0.75,
        });
      }

      setMessage("Uploading captured media...");
      const data = new FormData();
      data.append("media", mediaFile || file);

      await API.post(`/capture-sessions/${sessionId}/media`, data, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setUploaded(true);
      setMessage("Captured media uploaded. You can return to the laptop lot form.");
    } catch (error) {
      setMessage(getApiErrorMessage(error, "Could not upload captured media. Please try again."));
    } finally {
      setUploading(false);
    }
  };

  const isImage = session?.mediaType === "image";
  const captureInputId = `captureInput-${sessionId || "new"}`;
  const isStatusMessage =
    message === "Recognizing image..." || message === "Uploading captured media...";

  return (
    <div className="mx-auto max-w-md bg-white px-4 py-6">
      <div className="mb-5 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border-2 border-green-700 text-xl text-green-700">
          {isImage ? <FaImage /> : <FaVideo />}
        </div>
        <h1 className="mt-3 text-lg font-extrabold text-black">Live lot capture</h1>
        <p className="mt-1 text-xs font-semibold text-gray-500">
          Lot photos and video must be captured live from a mobile camera.
        </p>
        {!loading && isMobile && session && !uploaded && (
          <p className="mt-2 text-xs font-bold text-green-800">
            Tap the button below to open your mobile camera.
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
        </div>
      )}

      {!loading && isMobile && session && !uploaded && (
        <div className="mt-4">
          <input
            id={captureInputId}
            type="file"
            accept={isImage ? "image/*" : "video/*"}
            capture="environment"
            disabled={uploading}
            onChange={(event) => handleCapture(event.target.files?.[0] || null)}
            className="sr-only"
          />
          <label
            htmlFor={captureInputId}
            className="flex cursor-pointer items-center justify-center gap-3 rounded-md border border-dashed border-green-400 bg-green-50 px-4 py-5 text-sm font-extrabold text-green-800"
          >
            {uploading ? <FaSpinner className="animate-spin" /> : <FaCamera />}
            <span>
              {uploading
                ? message === "Recognizing image..."
                  ? "Recognizing image..."
                  : "Uploading..."
                : isImage
                ? "Take Live Fruit Photo"
                : "Record Live Lot Video"}
            </span>
          </label>
        </div>
      )}

      {uploaded && (
        <div className="mt-4 flex items-center gap-2 rounded-md bg-green-700 px-4 py-3 text-sm font-extrabold text-white">
          <FaCheckCircle />
          <span>Upload complete</span>
        </div>
      )}
    </div>
  );
}
