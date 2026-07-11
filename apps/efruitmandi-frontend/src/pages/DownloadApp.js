import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FaAndroid, FaApple, FaDownload, FaExternalLinkAlt, FaWindows } from "react-icons/fa";
import {
  getEFruitInstallLink,
  getInstallPlatform,
  getNativeAppDownloadLink,
  openEFruitInstallPrompt,
} from "../utils/installPrompt";

const platformMeta = {
  android: {
    icon: <FaAndroid />,
    title: "Downloading eFruitMandi Android App",
    text: "Your Android app download will start automatically when the configured APK or Play Store link is available.",
    button: "Download Android App",
  },
  ios: {
    icon: <FaApple />,
    title: "Opening eFruitMandi iOS App",
    text: "iPhone and iPad app downloads must open through the App Store or TestFlight.",
    button: "Open iOS App Link",
  },
  windows: {
    icon: <FaWindows />,
    title: "Downloading eFruitMandi Windows App",
    text: "Your Windows app download will start automatically when the configured installer or Microsoft Store link is available.",
    button: "Download Windows App",
  },
  desktop: {
    icon: <FaDownload />,
    title: "Install eFruitMandi App",
    text: "This device can install eFruitMandi as a secure browser app.",
    button: "Install App",
  },
};

const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";
  const megabytes = bytes / (1024 * 1024);
  return `${megabytes >= 10 ? megabytes.toFixed(1) : megabytes.toFixed(2)} MB`;
};

const getDownloadFilename = (response, downloadUrl) => {
  const disposition = response.headers.get("Content-Disposition") || "";
  const encodedMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  const filenameMatch = disposition.match(/filename=["']?([^"';]+)["']?/i);
  const headerFilename = encodedMatch?.[1]
    ? decodeURIComponent(encodedMatch[1])
    : filenameMatch?.[1];

  if (headerFilename) return headerFilename.trim();

  try {
    return decodeURIComponent(new URL(downloadUrl, window.location.href).pathname.split("/").pop()) || "eFruitMandi-app";
  } catch {
    return "eFruitMandi-app";
  }
};

export default function DownloadApp() {
  const platform = useMemo(() => getInstallPlatform(), []);
  const nativeLink = useMemo(() => getNativeAppDownloadLink(platform), [platform]);
  const installLink = useMemo(() => getEFruitInstallLink(), []);
  const meta = platformMeta[platform] || platformMeta.desktop;
  const [downloadState, setDownloadState] = useState("idle");
  const [downloadedBytes, setDownloadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const abortControllerRef = useRef(null);
  const objectUrlRef = useRef("");
  const isDownloadingRef = useRef(false);

  const startDownload = useCallback(async (source = "download-link-button") => {
    if (!nativeLink) {
      openEFruitInstallPrompt({ source });
      return;
    }

    if (isDownloadingRef.current) return;
    isDownloadingRef.current = true;
    setDownloadState("downloading");
    setDownloadedBytes(0);
    setTotalBytes(0);
    setErrorMessage("");

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch(nativeLink, { signal: controller.signal });
      if (!response.ok) throw new Error(`Download failed with status ${response.status}`);
      if (!response.body) throw new Error("Streaming downloads are not supported by this browser");

      const contentLength = Number(response.headers.get("Content-Length")) || 0;
      const reader = response.body.getReader();
      const chunks = [];
      let receivedLength = 0;
      setTotalBytes(contentLength);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        receivedLength += value.length;
        setDownloadedBytes(receivedLength);
      }

      const blob = new Blob(chunks, {
        type: response.headers.get("Content-Type") || "application/octet-stream",
      });
      const objectUrl = URL.createObjectURL(blob);
      objectUrlRef.current = objectUrl;

      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = getDownloadFilename(response, nativeLink);
      document.body.appendChild(link);
      link.click();
      link.remove();

      setDownloadedBytes(receivedLength);
      setDownloadState("complete");
      window.setTimeout(() => {
        if (objectUrlRef.current === objectUrl) {
          URL.revokeObjectURL(objectUrl);
          objectUrlRef.current = "";
        }
      }, 1000);
    } catch (error) {
      if (error.name !== "AbortError") {
        setErrorMessage("We couldn't download the app. Please check your connection and try again.");
        setDownloadState("error");
      }
    } finally {
      isDownloadingRef.current = false;
      abortControllerRef.current = null;
    }
  }, [nativeLink]);

  useEffect(() => {
    if (nativeLink) {
      const timer = window.setTimeout(() => {
        startDownload("download-link");
      }, 350);
      return () => window.clearTimeout(timer);
    }

    const timer = window.setTimeout(() => {
      openEFruitInstallPrompt({ source: "download-link" });
    }, 450);
    return () => window.clearTimeout(timer);
  }, [nativeLink, startDownload]);

  useEffect(() => () => {
    abortControllerRef.current?.abort();
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
  }, []);

  const percentage = totalBytes > 0
    ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100))
    : 0;
  const isDownloading = downloadState === "downloading";
  const isComplete = downloadState === "complete";

  return (
    <section className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-4 py-10 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-green-700 text-3xl text-white shadow-lg">
        {meta.icon}
      </div>
      <h1 className="mt-5 text-2xl font-black text-gray-950">{meta.title}</h1>
      <p className="mt-3 text-sm font-semibold leading-6 text-gray-600">{meta.text}</p>
      <p className="mt-2 text-xs font-bold uppercase tracking-wide text-green-800">
        Detected device: {platform}
      </p>

      <div className="mt-6 grid w-full gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <button
          type="button"
          onClick={() => isComplete ? window.location.assign(nativeLink) : startDownload()}
          disabled={isDownloading}
          className="min-h-12 rounded-full bg-green-700 px-5 text-sm font-black text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isComplete ? "Open App" : downloadState === "error" ? "Retry Download" : isDownloading ? "Downloading..." : meta.button}
        </button>
        <a
          href={nativeLink || installLink}
          onClick={(event) => {
            if (isDownloading) event.preventDefault();
          }}
          aria-disabled={isDownloading}
          tabIndex={isDownloading ? -1 : undefined}
          className={`inline-flex min-h-12 items-center justify-center rounded-full border border-green-700 px-5 text-sm font-black text-green-800 hover:bg-green-50 ${isDownloading ? "pointer-events-none cursor-not-allowed opacity-60" : ""}`}
        >
          <FaExternalLinkAlt className="mr-2 text-xs" />
          Open Link
        </a>
      </div>

      {nativeLink && downloadState !== "idle" && (
        <div
          className="mt-5 w-full rounded-xl border border-green-100 bg-green-50 p-4 text-left"
          aria-live="polite"
          aria-atomic="true"
        >
          {isDownloading && (
            <>
              <div className="flex items-center justify-between text-sm font-black text-green-900">
                <span>Downloading...</span>
                {totalBytes > 0 && <span>{percentage}%</span>}
              </div>
              <div
                className="mt-3 h-2.5 overflow-hidden rounded-full bg-green-100"
                role="progressbar"
                aria-label="App download progress"
                aria-valuemin={0}
                aria-valuemax={totalBytes > 0 ? 100 : undefined}
                aria-valuenow={totalBytes > 0 ? percentage : undefined}
                aria-valuetext={totalBytes > 0 ? `${percentage}% downloaded` : "Downloading"}
              >
                <div
                  className={`h-full rounded-full bg-green-700 transition-all duration-300 ${totalBytes > 0 ? "" : "w-1/3 animate-pulse"}`}
                  style={totalBytes > 0 ? { width: `${percentage}%` } : undefined}
                />
              </div>
              <p className="mt-2 text-xs font-semibold text-gray-600">
                {formatBytes(downloadedBytes)}{totalBytes > 0 ? ` / ${formatBytes(totalBytes)}` : " downloaded"}
              </p>
            </>
          )}

          {isComplete && (
            <p className="text-sm font-black text-green-900">Download Complete</p>
          )}

          {downloadState === "error" && (
            <p className="text-sm font-bold text-red-700" role="alert">{errorMessage}</p>
          )}
        </div>
      )}

      {!nativeLink && (
        <div className="mt-6 rounded-xl border border-green-100 bg-green-50 p-4 text-left text-sm font-semibold leading-6 text-gray-700">
          <p className="font-black text-green-900">Native download link is not configured yet.</p>
          <p className="mt-1">
            Add APK, App Store/TestFlight, and Windows installer links in environment variables to make this URL start the native download automatically.
          </p>
        </div>
      )}
    </section>
  );
}
