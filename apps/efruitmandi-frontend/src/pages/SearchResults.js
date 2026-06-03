import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FaEye, FaSearch, FaSeedling } from "react-icons/fa";
import API, { FILE_BASE_URL } from "../services/api";
import { getEfruitMandiProducts } from "../utils/marketProducts";

export default function SearchResults() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q") || "";
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const res = await API.get("/products?platform=efruitmandi");
        setProducts(getEfruitMandiProducts(res.data));
      } catch (err) {
        console.error(err);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    loadProducts();
  }, []);

  const results = useMemo(() => {
    const words = query
      .toLowerCase()
      .split(/\s+/)
      .map((word) => word.trim())
      .filter(Boolean);

    if (!words.length) return [];

    return products.filter((product) => {
      const gradeText = (product.gradeLots || [])
        .map((lot) => `${lot.grade} ${lot.boxes}`)
        .join(" ");
      const grower = product.createdBy || {};
      const haystack = [
        product.title,
        product.description,
        product.location,
        product.status,
        gradeText,
        grower.name,
        grower.orchardName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return words.every((word) => haystack.includes(word));
    });
  }, [products, query]);

  return (
    <div className="pb-20">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-extrabold text-black">Search Results</h2>
          <p className="text-[10px] font-bold text-gray-500">
            {query ? `For "${query}"` : "Search fruit lots by fruit, mandi, grade, or grower"}
          </p>
        </div>
        <span className="rounded-full bg-green-100 px-3 py-1 text-[10px] font-extrabold text-green-800">
          {results.length} found
        </span>
      </div>

      {loading && (
        <p className="py-3 text-sm font-semibold text-green-700">
          Searching fruit lots...
        </p>
      )}

      {!loading && !results.length ? (
        <EmptySearch query={query} />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {results.map((product) => (
            <article
              key={product._id}
              className="rounded-md border border-gray-200 bg-white p-2"
            >
              <div className="mb-2 aspect-[4/3] w-full overflow-hidden rounded-md bg-green-100">
                {getImageUrl(product) ? (
                  <img
                    src={getImageUrl(product)}
                    alt={product.title || "Fruit Lot"}
                    className="h-full w-full object-contain object-center"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-2xl text-green-700">
                    <FaSeedling />
                  </div>
                )}
              </div>

              <div className="mb-1 flex items-center justify-between gap-2">
                <h3 className="line-clamp-1 text-xs font-extrabold text-black">
                  {product.title || "Fruit Lot"}
                </h3>
                <span className="rounded bg-green-100 px-2 py-0.5 text-[8px] font-extrabold text-green-800">
                  {formatDealStatus(product.status)}
                </span>
              </div>

              <p className="truncate text-[10px] font-bold text-gray-600">
                {product.location || "Fruit Mandi"}
              </p>
              <p className="text-[10px] font-bold text-black">
                {product.quantity || 0} Box Lot
              </p>

              <button
                type="button"
                onClick={() => navigate(`/lots/${product._id}`)}
                className="mt-2 inline-flex items-center gap-1 rounded-full bg-gray-200 px-3 py-1 text-[9px] font-bold text-gray-700"
              >
                <FaEye />
                View Listing
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptySearch({ query }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-dashed border-green-200 bg-green-50 px-3 py-4 text-green-800">
      <FaSearch className="text-lg" />
      <p className="text-xs font-bold">
        {query ? "No matching fruit lots found." : "Speak or type a search from the top bar."}
      </p>
    </div>
  );
}

function getImageUrl(product) {
  const gradeImage = Array.isArray(product.gradeLots)
    ? product.gradeLots.find((gradeLot) => gradeLot?.images?.[0])?.images?.[0]
    : "";
  const image = Array.isArray(product.images) && product.images[0]
    ? product.images[0]
    : gradeImage;
  const normalizedImage = image ? image.replace(/\\/g, "/") : "";

  if (/^https?:\/\//i.test(normalizedImage)) return normalizedImage;
  return normalizedImage ? `${FILE_BASE_URL}/${normalizedImage}` : "";
}

function formatDealStatus(status = "") {
  const normalized = String(status || "AVAILABLE").trim().toUpperCase();
  const labels = {
    IN_AUCTION: "Deal Open",
    ACTIVE: "Deal Open",
    AVAILABLE: "Available",
    SCHEDULED: "Upcoming Deal",
    UPCOMING: "Upcoming Deal",
    SOLD: "Deal Closed",
    ENDED: "Deal Closed",
  };
  return labels[normalized] || normalized.replace(/_/g, " ");
}
