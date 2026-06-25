const fs = require("fs");
const path = "src/pages/Home.js";
let s = fs.readFileSync(path, "utf8");

// import
s = s.replace(
  'import { useEffect, useMemo, useState } from "react";',
  'import { useEffect, useLayoutEffect, useMemo, useState } from "react";'
);

// hook after optimizeImageUrl
s = s.replace(
  /(const optimizeImageUrl = \(url = "", width = 640\) => \{[\s\S]*?\n\};)/,
  `$1

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(min-width: 768px)").matches;
  });

  useLayoutEffect(() => {
    if (typeof window === "undefined") return undefined;
    const mediaQuery = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(mediaQuery.matches);
    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  return isDesktop;
}`
);

// add inside Home
s = s.replace(
  /(function Home\(\) \{\r?\n)/,
  `$1  const isDesktop = useIsDesktop();
`
);

// mobile open
s = s.replace(
  '<div className="pb-32 md:hidden">',
  '{!isDesktop && (\n      <div className="pb-32 md:hidden">'
);

// mobile close + desktop open
s = s.replace(
  /(\s*<div className="pb-32 md:hidden">[\s\S]*?\n\s*<\/div>)(\s*\n\s*<div className="hidden md:block">)/,
  `$1
      )}

    {isDesktop && (
      <>
$2`
);

// desktop close before final fragment close
s = s.replace(
  /(\n\s*<\/aside>\s*\n\s*<\/div>)(\s*\n\s*<\/>\s*\n\s*\);)/,
  `$1
      </>
    )}$2`
);

fs.writeFileSync(path, s);
console.log("Clean desktop/mobile conditional patch applied");
