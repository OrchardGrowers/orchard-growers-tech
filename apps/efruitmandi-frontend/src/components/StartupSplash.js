import { useEffect, useState } from "react";

const logoUrl = `${process.env.PUBLIC_URL || ""}/logo.png`;

export default function StartupSplash() {
  const [visible, setVisible] = useState(
    () => sessionStorage.getItem("startupSplashSeen") !== "true"
  );

  useEffect(() => {
    if (!visible) return undefined;

    const timer = window.setTimeout(() => {
      sessionStorage.setItem("startupSplashSeen", "true");
      setVisible(false);
    }, 1600);

    return () => window.clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="startup-splash-timeout fixed inset-0 z-[2000] flex items-center justify-center bg-[#0B6B2F] px-8">
      <div className="flex flex-col items-center justify-center gap-3 text-center text-white">
        <img
          src={logoUrl}
          alt="E-Fruit Mandi"
          className="startup-logo-zoom w-[240px] max-w-[72vw] md:w-[320px]"
        />
        <span className="text-sm font-semibold tracking-[0.24em] text-white/90 sm:text-base">
          E-FRUIT MANDI
        </span>
      </div>
    </div>
  );
}
