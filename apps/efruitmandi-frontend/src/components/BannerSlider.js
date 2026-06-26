import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

const BANNER_COUNT = 6;
const SLIDE_INTERVAL_MS = 3500;
const BANNER_ASPECT_WIDTH = 690;
const BANNER_ASPECT_HEIGHT = 200;
const RESPONSIVE_BANNER_WIDTHS = [360, 480, 690];

const CLOUDINARY_BANNERS = [
  "https://res.cloudinary.com/doprdp6bi/image/upload/v1782457312/Banner_efruitmandi1_rb7fw2.webp",
  "https://res.cloudinary.com/doprdp6bi/image/upload/v1782457310/Banner_efruitmandi2_wbqxiq.webp",
  "https://res.cloudinary.com/doprdp6bi/image/upload/v1782457310/Banner_efruitmandi_3_drl8yw.webp",
  "https://res.cloudinary.com/doprdp6bi/image/upload/v1782457310/Banner_efruitmandi4_q25vlp.webp",
  "https://res.cloudinary.com/doprdp6bi/image/upload/v1782457802/efruitmandi/banners/home-carousel/banner-5.webp",
  "https://res.cloudinary.com/doprdp6bi/image/upload/v1782457850/Banner_efruitmandi6_rbztfn.webp",
];

const addCloudinaryTransform = (url, transform) =>
  url.replace("/image/upload/", `/image/upload/${transform}/`);

const getBannerHeight = (width) =>
  Math.max(1, Math.round((width * BANNER_ASPECT_HEIGHT) / BANNER_ASPECT_WIDTH));

const buildBannerTransform = (width) =>
  `f_auto,q_auto:eco,c_fill,w_${width},h_${getBannerHeight(width)}`;

const buildSrcSet = (url) =>
  RESPONSIVE_BANNER_WIDTHS
    .map((width) => `${addCloudinaryTransform(url, buildBannerTransform(width))} ${width}w`)
    .join(", ");

export default function BannerSlider() {
  const banners = useMemo(
    () =>
      Array.from({ length: BANNER_COUNT }, (_, index) => ({
        src: CLOUDINARY_BANNERS[index],
        alt: `eFruitMandi ad banner ${index + 1}`,
      })),
    []
  );

  const [index, setIndex] = useState(0);
  const [failedBanners, setFailedBanners] = useState([]);
  const [renderAllSlides, setRenderAllSlides] = useState(false);
  const visibleBanners = banners.filter(
    (banner) => !failedBanners.includes(banner.src)
  );
  const renderedBanners = renderAllSlides ? visibleBanners : visibleBanners.slice(0, 1);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setRenderAllSlides(true);
    }, 10000);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!renderAllSlides || visibleBanners.length <= 1) return undefined;

    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % visibleBanners.length);
    }, SLIDE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [renderAllSlides, visibleBanners.length]);

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
    <div className="relative overflow-hidden rounded-xl bg-black" style={{ aspectRatio: "690 / 200" }}>
      <div
        className="flex h-full w-full transition-transform duration-700"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {renderedBanners.map((banner, i) => (
          <img
            key={banner.src}
            src={addCloudinaryTransform(banner.src, buildBannerTransform(690))}
            srcSet={buildSrcSet(banner.src)}
            sizes="(max-width: 767px) calc(100vw - 24px), 690px"
            width={BANNER_ASPECT_WIDTH}
            height={BANNER_ASPECT_HEIGHT}
            alt={banner.alt}
            loading={i === 0 ? "eager" : "lazy"}
            fetchPriority={i === 0 ? "high" : "low"}
            decoding="async"
            onError={() => hideMissingBanner(banner.src)}
            className="h-full w-full flex-shrink-0 object-fill"
          />
        ))}
      </div>

      <div className="absolute right-2 top-2 flex max-w-[calc(100%-1rem)] flex-wrap justify-end gap-1.5 sm:right-3 sm:top-3 sm:gap-2">
        <Link
          to="/list-new-lot"
          className="rounded-full bg-orange-500/95 px-2 py-1 text-[9px] font-extrabold text-white shadow-sm hover:bg-orange-600 sm:px-3 sm:text-xs"
        >
          List Lot
        </Link>
        <Link
          to="/search"
          className="rounded-full bg-white/95 px-2 py-1 text-[9px] font-extrabold text-green-800 shadow-sm hover:bg-green-50 sm:px-3 sm:text-xs"
        >
          Explore
        </Link>
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
