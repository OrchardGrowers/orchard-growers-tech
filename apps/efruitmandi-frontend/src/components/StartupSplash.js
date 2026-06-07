import { useEffect, useState } from "react";

const logoUrl = `${process.env.PUBLIC_URL || ""}/logo.png`;

export default function StartupSplash() {
  const [visible, setVisible] = useState(
    () => sessionStorage.getItem("startupSplashSeen") !== "true"
  );

  useEffect(() => {
    if (!visible) return undefined;

    const timer = setTimeout(() => {
      sessionStorage.setItem("startupSplashSeen", "true");
      setVisible(false);
    }, 1600);

    return () => clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="startup-splash-timeout fixed inset-0 z-[2000] flex items-center justify-center bg-[#0B6B2F] px-8">
      <img
        src={logoUrl}
        alt="E-Fruit Mandi"
        className="startup-logo-zoom w-[280px] max-w-[76vw] md:w-[360px]"
      />
    </div>
  );
}
