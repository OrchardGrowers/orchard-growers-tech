import { useEffect, useState } from "react";
import { FaBell, FaSeedling } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import API from "../services/api";
import { getEfruitMandiProducts } from "../utils/marketProducts";

export default function Notifications() {
  const navigate = useNavigate();
  const [lots, setLots] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLots = async () => {
      try {
        const res = await API.get("/products");
        const latestLots = getEfruitMandiProducts(res.data)
          .slice()
          .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
          .slice(0, 12);

        setLots(latestLots);
      } catch (err) {
        console.error(err);
        setLots([]);
      } finally {
        setLoading(false);
      }
    };

    loadLots();
  }, []);

  return (
    <div className="pb-20">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-extrabold text-black">Notifications</h2>
        <span className="rounded-full bg-green-100 px-3 py-1 text-[10px] font-extrabold text-green-800">
          {lots.length} lots
        </span>
      </div>

      {loading && (
        <p className="py-3 text-sm font-semibold text-green-700">
          Checking latest lot updates...
        </p>
      )}

      {!loading && !lots.length ? (
        <EmptyNotification />
      ) : (
        <div className="space-y-2">
          {lots.map((lot) => (
            <article
              key={lot._id}
              className="rounded-md border border-green-100 bg-white px-3 py-3"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700">
                  <FaSeedling />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-xs font-extrabold text-black">
                        New lot listed: {lot.title || "Fruit Lot"}
                      </h3>
                      <p className="truncate text-[10px] font-bold text-gray-600">
                        {lot.location || "Fruit Mandi"} | {lot.quantity || 0} boxes
                      </p>
                    </div>
                    <span className="shrink-0 rounded bg-green-100 px-2 py-0.5 text-[8px] font-extrabold text-green-800">
                      {lot.status || "AVAILABLE"}
                    </span>
                  </div>

                  <p className="mt-1 text-[10px] font-semibold text-gray-500">
                    {formatNotificationTime(lot.createdAt)}
                  </p>

                  <button
                    type="button"
                    onClick={() => navigate(`/lots/${lot._id}`)}
                    className="mt-2 rounded-full bg-gray-200 px-3 py-1 text-[9px] font-bold text-gray-700"
                  >
                    View Listing
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyNotification() {
  return (
    <div className="flex items-center gap-3 rounded-md border border-dashed border-green-200 bg-green-50 px-3 py-4 text-green-800">
      <FaBell className="text-lg" />
      <p className="text-xs font-bold">No new lot notifications yet.</p>
    </div>
  );
}

function formatNotificationTime(value) {
  if (!value) return "Just now";

  return new Date(value).toLocaleString([], {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
