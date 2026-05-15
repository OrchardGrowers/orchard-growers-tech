export default function HorizontalSection({ title }) {
  const items = [1, 2, 3, 4, 5];

  const isTrusted =
    title.includes("Trusted") ||
    title.includes("Organic") ||
    title.includes("Happy");

  return (
    <div className="mt-5">

      {/* 🔥 TITLE */}
      <h2 className="text-md font-semibold mb-2">
        {title}
      </h2>

      {/* 👉 HORIZONTAL SCROLL */}
      <div className="flex gap-3 overflow-x-auto no-scrollbar">

        {items.map((i) => (
          <div
            key={i}
            className="min-w-[160px] bg-white rounded-xl shadow p-2"
          >

            {/* 🖼 IMAGE */}
            <div className="bg-green-400 h-24 rounded-lg mb-2"></div>

            {/* 👤 NAME (GROWER / SELLER) */}
            <p className="text-sm font-semibold">
              Pawan Kumar
            </p>

            {/* 📦 PRODUCT DETAILS */}
            <p className="text-xs font-medium">
              Premium Quality
            </p>

            <p className="text-xs">
              100 Box Lot
            </p>

            {/* ⭐ RATING LABEL */}
            <p className="text-xs text-gray-500 mt-1">
              Rating By Buyer
            </p>

            {/* ⭐ RATING + TRUST ICON */}
            <div className="flex items-center gap-1 mt-1 text-xs">

              {/* 🟢 TRUST BADGE (ICON STYLE) */}
              {isTrusted && (
                <span className="text-green-600 text-sm">🛡️</span>
              )}

              {/* ⭐ STARS */}
              <span>★ ★ ★ ★ ☆</span>
            </div>

            {/* 🔘 BUTTON */}
            <button className="mt-2 bg-gray-200 text-xs px-3 py-1 rounded-full">
              View Deal
            </button>

          </div>
        ))}

      </div>

    </div>
  );
}
