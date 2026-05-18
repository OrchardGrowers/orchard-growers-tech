import { useEffect, useMemo, useState } from "react";

const BANNER_COUNT = 6;
const assetUrl = (path) => `${process.env.PUBLIC_URL || ""}${path}`;

export default function BannerSlider() {
  const banners = useMemo(
    () =>
      Array.from({ length: BANNER_COUNT }, (_, index) => ({
        src: assetUrl(`/ad-banners/banner-${index + 1}.png`),
        alt: `Orchard Growers ad banner ${index + 1}`,
      })),
    []
  );

  const [index, setIndex] = useState(0);
  const [failedBanners, setFailedBanners] = useState([]);
  const visibleBanners = banners.filter(
    (banner) => !failedBanners.includes(banner.src)
  );

  useEffect(() => {
    if (visibleBanners.length <= 1) return undefined;

    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % visibleBanners.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [visibleBanners.length]);

  useEffect(() => {
    if (index >= visibleBanners.length) {
      setIndex(0);
    }
  }, [index, visibleBanners.length]);

  const hideMissingBanner = (src) => {
    setFailedBanners((failed) =>
      failed.includes(src) ? failed : [...failed, src]
    );
  };

  if (!visibleBanners.length) {
    return null;
  }

  return (
    <div className="relative overflow-hidden rounded-xl bg-black">
      <div
        className="flex aspect-[1230/461] transition-transform duration-700"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {visibleBanners.map((banner, i) => (
          <img
            key={banner.src}
            src={banner.src}
            alt={banner.alt}
            loading={i === 0 ? "eager" : "lazy"}
            decoding="async"
            onError={() => hideMissingBanner(banner.src)}
            className="h-full w-full flex-shrink-0 object-contain"
          />
        ))}
      </div>

      <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-2">
        {visibleBanners.map((_, i) => (
          <div
            key={i}
            className={`h-2 w-2 rounded-full ${
              i === index ? "bg-white" : "bg-white/45"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
