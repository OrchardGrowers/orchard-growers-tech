const fs = require("fs");

const file = "src/pages/Home.js";
let code = fs.readFileSync(file, "utf8");

const replaceOrFail = (from, to, label) => {
  if (!code.includes(from)) {
    throw new Error(`Missing target: ${label}`);
  }
  code = code.replace(from, to);
};

replaceOrFail(
`      {loading ? (
        <PublicFeedSkeleton />
      ) : deals.length ? (`,
`      {loading && deals.length ? (
        <PublicFeedSkeleton />
      ) : deals.length ? (`,
"avoid skeleton collapse on empty initial deal lists"
);

replaceOrFail(
`          {deals.map((deal) => (`,
`          {deals.map((deal, dealIndex) => (`,
"deal map index"
);

replaceOrFail(
`              currentUserId={currentUserId}
            />`,
`              currentUserId={currentUserId}
              priorityImage={dealIndex === 0 && title === "Recently Closed Deals"}
            />`,
"priority image prop"
);

replaceOrFail(
`  currentUserId = "",
}) {`,
`  currentUserId = "",
  priorityImage = false,
}) {`,
"DesktopLotPost priority prop"
);

replaceOrFail(
`        onOpen={() => onOpenLot(detailId)}
      />`,
`        onOpen={() => onOpenLot(detailId)}
        priorityImage={priorityImage}
      />`,
"pass priority to carousel"
);

replaceOrFail(
`function DesktopLotImageCarousel({ images, product, title, onOpen }) {`,
`function DesktopLotImageCarousel({ images, product, title, onOpen, priorityImage = false }) {`,
"carousel priority prop"
);

replaceOrFail(
`src={optimizeImageUrl(images[activeImage], 900)}`,
`src={optimizeImageUrl(images[activeImage], priorityImage ? 520 : 420)}`,
"reduce carousel image size"
);

replaceOrFail(
`loading="lazy"
            decoding="async"`,
`loading={priorityImage ? "eager" : "lazy"}
            fetchPriority={priorityImage ? "high" : "auto"}
            decoding="async"`,
"priority image loading"
);

fs.writeFileSync(file, code);
console.log("Public feed CLS/LCP optimized.");
