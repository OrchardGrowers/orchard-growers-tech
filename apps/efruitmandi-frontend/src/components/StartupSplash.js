import { useEffect, useState } from "react";

const logoUrl = `${process.env.PUBLIC_URL || ""}/logo.png`;
const MIN_SPLASH_MS = 1200;
const MAX_SPLASH_MS = 2400;

export default function StartupSplash({ autoHide = true }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!autoHide) return undefined;

    let minimumElapsed = false;
    let pageLoaded = document.readyState === "complete";

    const hideWhenReady = () => {
      if (minimumElapsed && pageLoaded) {
        setVisible(false);
      }
    };

    const handleLoad = () => {
      pageLoaded = true;
      hideWhenReady();
    };

    const minimumTimer = window.setTimeout(() => {
      minimumElapsed = true;
      hideWhenReady();
    }, MIN_SPLASH_MS);
    const fallbackTimer = window.setTimeout(() => {
      setVisible(false);
    }, MAX_SPLASH_MS);

    if (pageLoaded) {
      hideWhenReady();
    } else {
      window.addEventListener("load", handleLoad, { once: true });
    }

    return () => {
      window.clearTimeout(minimumTimer);
      window.clearTimeout(fallbackTimer);
      window.removeEventListener("load", handleLoad);
    };
  }, [autoHide]);

  if (!visible) return null;

  return (
    <div
      className={`${autoHide ? "startup-splash" : ""} fixed inset-0 z-[2000] flex items-center justify-center bg-[#0B6B2F] px-8`}
      aria-label="Loading eFruitMandi"
    >
      <span className="startup-logo-shine">
        <img
          src={logoUrl}
          alt="eFruitMandi logo"
          className="startup-logo w-[250px] max-w-[72vw] object-contain md:w-[330px]"
        />
      </span>
    </div>
  );
}
