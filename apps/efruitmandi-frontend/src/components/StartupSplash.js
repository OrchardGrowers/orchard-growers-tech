import { useEffect, useState } from "react";

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
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-[#18a64b]">
      <img
        src="/logo.png"
        alt="E-Fruit Mandi"
        className="startup-logo-zoom w-[150px] max-w-[58vw]"
      />
    </div>
  );
}
