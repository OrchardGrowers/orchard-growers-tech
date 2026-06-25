const fs = require("fs");
const path = "src/pages/Home.js";
let s = fs.readFileSync(path, "utf8");

s = s.replace(
  'import { useEffect, useMemo, useState } from "react";',
  'import { useEffect, useLayoutEffect, useMemo, useState } from "react";'
);

s = s.replace(
  /const optimizeImageUrl = \(url = "", width = 640\) => \{[\s\S]*?\n\};/,
  (m) => `${m}

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

s = s.replace(
  /function Home\(\) \{([\s\S]*?)(\n\s*const profilePath = profileId \?)/,
  (m, body, rest) => {
    if (body.includes("const isDesktop = useIsDesktop();")) return m;
    return `function Home() {${body}\n  const isDesktop = useIsDesktop();${rest}`;
  }
);

s = s.replace(
  '<div className="pb-32 md:hidden">',
  '{!isDesktop && (\n      <div className="pb-32 md:hidden">'
);

s = s.replace(
  '        />\n      </div>\n\n    <div className="hidden md:block">',
  '        />\n      </div>\n      )}\n\n    {isDesktop && (\n      <>\n    <div className="hidden md:block">'
);

s = s.replace(
  /(\n\s*<\/div>\s*\n\s*<\/>\s*\n\s*\);?\s*\n\s*\})/,
  "$1"
);

s = s.replace(
  '      </aside>\n    </div>\n  </>\n);',
  '      </aside>\n    </div>\n      </>\n    )}\n  </>\n);'
);

fs.writeFileSync(path, s);
console.log("Patched Home.js");
