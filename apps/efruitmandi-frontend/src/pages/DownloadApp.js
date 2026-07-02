import { useEffect, useMemo, useState } from "react";
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

export default function DownloadApp() {
  const platform = useMemo(() => getInstallPlatform(), []);
  const nativeLink = useMemo(() => getNativeAppDownloadLink(platform), [platform]);
  const installLink = useMemo(() => getEFruitInstallLink(), []);
  const meta = platformMeta[platform] || platformMeta.desktop;
  const [redirecting, setRedirecting] = useState(Boolean(nativeLink));

  useEffect(() => {
    if (nativeLink) {
      const timer = window.setTimeout(() => {
        window.location.replace(nativeLink);
      }, 350);
      return () => window.clearTimeout(timer);
    }

    setRedirecting(false);
    const timer = window.setTimeout(() => {
      openEFruitInstallPrompt({ source: "download-link" });
    }, 450);
    return () => window.clearTimeout(timer);
  }, [nativeLink]);

  const startDownload = () => {
    if (nativeLink) {
      window.location.href = nativeLink;
      return;
    }
    openEFruitInstallPrompt({ source: "download-link-button" });
  };

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
          onClick={startDownload}
          className="min-h-12 rounded-full bg-green-700 px-5 text-sm font-black text-white hover:bg-green-800"
        >
          {redirecting ? "Starting..." : meta.button}
        </button>
        <a
          href={nativeLink || installLink}
          className="inline-flex min-h-12 items-center justify-center rounded-full border border-green-700 px-5 text-sm font-black text-green-800 hover:bg-green-50"
        >
          <FaExternalLinkAlt className="mr-2 text-xs" />
          Open Link
        </a>
      </div>

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
