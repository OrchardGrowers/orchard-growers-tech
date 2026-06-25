const fs = require("fs");

const file = "src/pages/Home.js";
let code = fs.readFileSync(file, "utf8");

code = code.replace(
`  const isGrower = isGrowerAccount(user);
  const isPublicVisitor = !localStorage.getItem("accessToken");`,
`  const [isDesktopHome, setIsDesktopHome] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 768px)").matches : false
  );
  const isGrower = isGrowerAccount(user);
  const isPublicVisitor = !localStorage.getItem("accessToken");`
);

code = code.replace(
`  useEffect(() => {
    return scheduleAfterPaint(() => loadMarketData({ showLoading: true }));
  }, [loadMarketData]);`,
`  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 768px)");
    const updateViewport = () => setIsDesktopHome(mediaQuery.matches);

    updateViewport();

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", updateViewport);
      return () => mediaQuery.removeEventListener("change", updateViewport);
    }

    mediaQuery.addListener(updateViewport);
    return () => mediaQuery.removeListener(updateViewport);
  }, []);

  useEffect(() => {
    return scheduleAfterPaint(() => loadMarketData({ showLoading: true }));
  }, [loadMarketData]);`
);

code = code.replace(
`      <div className="pb-32 pt-2 md:hidden">
        <BannerSlider />`,
`      <div className="pb-32 pt-2 md:hidden">
        {!isDesktopHome && <BannerSlider />}`
);

code = code.replace(
`        <BannerSlider />

        <PublicHomeFeed`,
`        {isDesktopHome && <BannerSlider />}

        <PublicHomeFeed`
);

fs.writeFileSync(file, code);
console.log("Render only active viewport banner.");
