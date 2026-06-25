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
`  useEffect(() => scheduleAfterPaint(() => setDeferredSectionsReady(true), 1800), []);`,
`  useEffect(() => scheduleAfterPaint(() => setDeferredSectionsReady(true), 15000), []);`,
"defer non critical home sections longer"
);

replaceOrFail(
`          showProfiles={deferredSectionsReady}
          showRates={deferredSectionsReady}`,
`          showProfiles={deferredSectionsReady}
          showRates={deferredSectionsReady}
          showClosedDeals={deferredSectionsReady}`,
"mobile feed closed deals prop"
);

replaceOrFail(
`          showProfiles={deferredSectionsReady}
          onOpenLotById={openLotDetails}`,
`          showProfiles={deferredSectionsReady}
          showClosedDeals={deferredSectionsReady}
          onOpenLotById={openLotDetails}`,
"desktop feed closed deals prop"
);

replaceOrFail(
`  showProfiles = true,
  showRates = false,`,
`  showProfiles = true,
  showRates = false,
  showClosedDeals = true,`,
"PublicHomeFeed showClosedDeals prop"
);

replaceOrFail(
`      <PublicDealList
        title="Recently Closed Deals"
        emptyText="No recently closed deals yet. Closed deals will appear here."
        deals={closedLots}
        loading={dealLoading}
        onOpenLotById={onOpenLotById}
        onQuoteLot={onQuoteLot}
        onRateLot={onRateLot}
        canQuoteLot={canQuoteLot}
        canRateLot={canRateLot}
        currentUserId={currentUserId}
      />`,
`      {showClosedDeals && (
        <PublicDealList
          title="Recently Closed Deals"
          emptyText="No recently closed deals yet. Closed deals will appear here."
          deals={closedLots}
          loading={dealLoading}
          onOpenLotById={onOpenLotById}
          onQuoteLot={onQuoteLot}
          onRateLot={onRateLot}
          canQuoteLot={canQuoteLot}
          canRateLot={canRateLot}
          currentUserId={currentUserId}
        />
      )}`,
"defer closed deals render"
);

fs.writeFileSync(file, code);
console.log("Deferred non-critical home feed sections.");
