const fs = require("fs");

const file = "src/pages/Home.js";
let code = fs.readFileSync(file, "utf8");

code = code.replaceAll(
  'src={optimizeImageUrl(images[activeImage], priorityImage ? 520 : 420)}',
  'src={optimizeImageUrl(images[activeImage], priorityImage ? 420 : 420)}'
);

code = code.replaceAll(
  'src={optimizeImageUrl(images[activeImage], 900)}',
  'src={optimizeImageUrl(images[activeImage], 420)}'
);

code = code.replaceAll(
  'width="900"',
  'width="420"'
);

code = code.replaceAll(
  'height="675"',
  'height="315"'
);

code = code.replaceAll(
  'loading={priorityImage ? "eager" : "lazy"}',
  'loading="eager"'
);

code = code.replaceAll(
  'fetchPriority={priorityImage ? "high" : "auto"}',
  'fetchPriority="high"'
);

code = code.replaceAll(
  'loading="lazy"\n            decoding="async"',
  'loading="eager"\n            fetchPriority="high"\n            decoding="async"'
);

fs.writeFileSync(file, code);
console.log("Fixed LCP lot image priority and size.");
