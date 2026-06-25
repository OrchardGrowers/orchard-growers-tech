const fs = require("fs");

const file = "src/components/BannerSlider.js";
let code = fs.readFileSync(file, "utf8");

code = code.replace(
  'const RESPONSIVE_BANNER_WIDTHS = [360, 480, 690, 1035, 1230];',
  'const RESPONSIVE_BANNER_WIDTHS = [360, 480, 690];'
);

code = code.replace(
  '`f_auto,q_auto,c_scale,w_${width},h_${getBannerHeight(width)}`',
  '`f_auto,q_auto:eco,c_fill,w_${width},h_${getBannerHeight(width)}`'
);

code = code.replace(
  'const [renderAllSlides, setRenderAllSlides] = useState(false);',
  'const [renderAllSlides, setRenderAllSlides] = useState(false);'
);

code = code.replace(
`  useEffect(() => {
    const showRest = () => setRenderAllSlides(true);
    if ("requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(showRest, { timeout: 1200 });
      return () => window.cancelIdleCallback(idleId);
    }

    const timer = window.setTimeout(showRest, 1800);
    return () => window.clearTimeout(timer);
  }, []);`,
`  useEffect(() => {
    const timer = window.setTimeout(() => {
      setRenderAllSlides(true);
    }, 10000);

    return () => window.clearTimeout(timer);
  }, []);`
);

code = code.replace(
  '<div className="relative overflow-hidden rounded-xl bg-black">',
  '<div className="relative overflow-hidden rounded-xl bg-black" style={{ aspectRatio: "690 / 200" }}>'
);

code = code.replace(
  'className="flex aspect-[3.45/1] transition-transform duration-700"',
  'className="flex h-full w-full transition-transform duration-700"'
);

code = code.replace(
  'src={addCloudinaryTransform(banner.src, buildBannerTransform(480))}',
  'src={addCloudinaryTransform(banner.src, buildBannerTransform(690))}'
);

code = code.replace(
  'sizes="(max-width: 767px) calc(100vw - 24px), (max-width: 1199px) 60vw, 790px"',
  'sizes="(max-width: 767px) calc(100vw - 24px), 690px"'
);

fs.writeFileSync(file, code);
console.log("Banner LCP and CLS optimized.");
