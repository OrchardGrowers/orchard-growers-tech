export default function TopTabs() {
  const tabs = [
    "🔴 Live Fruit Lots",
    "Upcoming Deals",
    "Trusted Growers",
    "Organic Farms",
  ];

  return (
    <div className="sticky top-14 z-40 bg-white px-2 py-2 border-b overflow-x-auto no-scrollbar">

      <div className="flex gap-2 min-w-max">
        {tabs.map((tab, i) => (
          <button
            key={i}
            className={`px-3 py-1 rounded-full border text-sm whitespace-nowrap ${
              i === 0
                ? "bg-red-500 text-white"
                : "bg-gray-100 text-gray-700"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

    </div>
  );
}
