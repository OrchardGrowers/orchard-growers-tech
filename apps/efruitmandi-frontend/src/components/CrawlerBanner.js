export default function CrawlerBanner() {
  const items = [
    "🔴 Live Fruit Lots",
    "Upcoming Lots",
    "Trusted Growers",
    "Organic Farms",
    "Top Buyers",
  ];

  return (
    <div className="bg-gray-100 px-2 py-2 overflow-x-auto no-scrollbar">

      <div className="flex gap-2 min-w-max">
        {items.map((item, index) => (
          <div
            key={index}
            className={`px-3 py-1 rounded text-sm whitespace-nowrap ${
              index === 0
                ? "bg-red-500 text-white"
                : "bg-gray-200 text-gray-700"
            }`}
          >
            {item}
          </div>
        ))}
      </div>

    </div>
  );
}