export default function TopFilters({ tabs, active, onChange }) {
  const filterTabs = tabs || [
    { key: "liveLots", label: "Live Fruit Lots" },
    { key: "upcomingLots", label: "Upcoming Lots" },
    { key: "trustedGrowers", label: "Trusted Growers" },
    { key: "organicFarms", label: "Organic Farms" },
    { key: "exportQuality", label: "Export Quality" },
  ];

  return (
    <div className="sticky top-[72px] z-40 border-b border-gray-200 bg-white/95 px-2 py-2 backdrop-blur md:hidden">
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange?.(tab.key)}
            className={`h-8 whitespace-nowrap rounded-full px-3 text-xs font-semibold transition ${
              active === tab.key
                ? "bg-green-700 text-white"
                : "bg-gray-200 text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
