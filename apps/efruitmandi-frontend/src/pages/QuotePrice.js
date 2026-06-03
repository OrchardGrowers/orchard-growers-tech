import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaArrowLeft, FaCalculator, FaMapMarkerAlt, FaSeedling } from "react-icons/fa";
import API from "../services/api";

export default function QuotePrice() {
  const { lotId } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [price, setPrice] = useState("");
  const [distanceKm, setDistanceKm] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const loadLot = async () => {
      try {
        const res = await API.get(`/products/${lotId}?platform=efruitmandi`);
        setProduct(res.data?.product || null);
      } catch {
        setProduct(null);
      } finally {
        setLoading(false);
      }
    };

    loadLot();
  }, [lotId]);

  const quantity = Number(product?.quantity || 0);
  const quotedPrice = Number(price || 0);
  const quoteTotal = useMemo(
    () => (quantity && quotedPrice ? quantity * quotedPrice : 0),
    [quantity, quotedPrice]
  );

  const submitQuote = (event) => {
    event.preventDefault();
    if (!quotedPrice || quotedPrice <= 0) {
      setMessage("Enter your price per box.");
      return;
    }

    setMessage("Quote saved for review. The grower will be informed when deal processing is available.");
  };

  return (
    <div className="mx-auto max-w-2xl pb-20">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-3 inline-flex items-center gap-2 rounded-full bg-gray-200 px-3 py-1 text-xs font-bold text-gray-700"
      >
        <FaArrowLeft />
        Back
      </button>

      <section className="rounded-md border border-gray-200 bg-white p-4">
        <p className="text-xs font-extrabold uppercase tracking-wide text-green-700">Quote Your Price</p>
        <h1 className="mt-1 text-xl font-extrabold text-gray-950">
          {loading ? "Loading lot..." : product?.title || "Fruit Lot"}
        </h1>
        <p className="mt-2 flex items-center gap-2 text-sm font-bold text-gray-600">
          <FaMapMarkerAlt className="text-green-700" />
          {product?.location || "Fruit Mandi"}
        </p>
      </section>

      {!loading && !product ? (
        <div className="mt-3 rounded-md border border-dashed border-green-200 bg-green-50 p-4 text-sm font-bold text-green-800">
          This fruit lot is not available.
        </div>
      ) : (
        <form onSubmit={submitQuote} className="mt-3 rounded-md border border-gray-200 bg-white p-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <InfoTile label="Quantity" value={`${quantity || 0} boxes`} />
            <InfoTile label="Packing" value={product?.packingType || "Not set"} />
            <InfoTile label="Variety" value={product?.variety || "Not set"} />
            <InfoTile label="Quality" value={product?.quality || "Not set"} />
          </div>

          <label className="mt-4 block text-sm font-bold text-gray-700">
            Your price per box
            <input
              value={price}
              inputMode="numeric"
              type="number"
              min="1"
              onChange={(event) => setPrice(event.target.value)}
              placeholder="Enter quote amount"
              className="mt-2 w-full rounded-md border border-gray-200 px-3 py-3 text-sm font-bold outline-none focus:border-green-600"
            />
          </label>

          <label className="mt-3 block text-sm font-bold text-gray-700">
            Delivery distance in km optional
            <input
              value={distanceKm}
              inputMode="numeric"
              type="number"
              min="0"
              onChange={(event) => setDistanceKm(event.target.value)}
              placeholder="Distance from orchard to destination"
              className="mt-2 w-full rounded-md border border-gray-200 px-3 py-3 text-sm font-bold outline-none focus:border-green-600"
            />
          </label>

          <div className="mt-4 rounded-md bg-green-50 p-3 text-sm font-bold text-green-900">
            <div className="flex items-center gap-2">
              <FaCalculator />
              <span>Total quote preview</span>
            </div>
            <p className="mt-2 text-lg font-extrabold">Rs. {quoteTotal || 0}</p>
            {distanceKm && <p className="text-xs text-green-800">Distance noted: {distanceKm} km</p>}
          </div>

          {message && (
            <p className="mt-3 rounded-md bg-green-50 px-3 py-2 text-xs font-bold text-green-800">
              {message}
            </p>
          )}

          <button
            type="submit"
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-green-700 px-4 py-3 text-sm font-extrabold text-white"
          >
            <FaSeedling />
            Submit Quote
          </button>
        </form>
      )}
    </div>
  );
}

function InfoTile({ label, value }) {
  return (
    <div className="rounded-md bg-green-50 px-3 py-2">
      <p className="text-[10px] font-extrabold text-gray-500">{label}</p>
      <p className="mt-1 text-xs font-extrabold text-gray-950">{value}</p>
    </div>
  );
}
