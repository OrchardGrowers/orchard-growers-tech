import { useEffect, useState } from "react";

const logoUrl = `${process.env.PUBLIC_URL || ""}/splash-logo.png`;

export default function StartupSplash({ autoHide = true }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!autoHide) return undefined;

    const timer = window.setTimeout(() => {
      setVisible(false);
    }, 1700);

    return () => window.clearTimeout(timer);
  }, [autoHide]);

  if (!visible) return null;

  return (
    <div
      className={`${autoHide ? "startup-splash" : ""} fixed inset-0 z-[2000] flex items-center justify-center bg-[#0B6B2F] px-8`}
      aria-label="Loading eFruitMandi"
    >
      <img
        src={logoUrl}
        alt="eFruitMandi logo"
        className="startup-logo-zoom w-[250px] max-w-[72vw] object-contain md:w-[330px]"
      />
    </div>
  );
}
