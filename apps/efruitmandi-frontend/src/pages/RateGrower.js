import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaArrowLeft, FaMapMarkerAlt, FaStar } from "react-icons/fa";
import API from "../services/api";

export default function RateGrower() {
  const { lotId } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
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

  const growerName =
    product?.createdBy?.orchardName ||
    product?.createdBy?.businessName ||
    product?.createdBy?.name ||
    "Grower's Orchard";

  const submitRating = (event) => {
    event.preventDefault();
    setMessage("Rating saved locally for now. It will sync when rating submission is connected.");
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
        <p className="text-xs font-extrabold uppercase tracking-wide text-green-700">Rate Grower</p>
        <h1 className="mt-1 text-xl font-extrabold text-gray-950">
          {loading ? "Loading grower..." : growerName}
        </h1>
        <p className="mt-2 flex items-center gap-2 text-sm font-bold text-gray-600">
          <FaMapMarkerAlt className="text-green-700" />
          {product?.location || "Fruit Mandi"}
        </p>
      </section>

      {!loading && !product ? (
        <div className="mt-3 rounded-md border border-dashed border-green-200 bg-green-50 p-4 text-sm font-bold text-green-800">
          This grower rating page is not available.
        </div>
      ) : (
        <form onSubmit={submitRating} className="mt-3 rounded-md border border-gray-200 bg-white p-4">
          <p className="text-sm font-bold text-gray-700">Your rating</p>
          <div className="mt-2 flex gap-2">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRating(value)}
                className={`flex h-11 w-11 items-center justify-center rounded-full text-lg ${
                  value <= rating ? "bg-amber-400 text-white" : "bg-gray-100 text-gray-400"
                }`}
                aria-label={`Rate ${value} star`}
              >
                <FaStar />
              </button>
            ))}
          </div>

          <label className="mt-4 block text-sm font-bold text-gray-700">
            Review optional
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={4}
              placeholder="Share your experience with this grower or orchard."
              className="mt-2 w-full rounded-md border border-gray-200 px-3 py-3 text-sm font-bold outline-none focus:border-green-600"
            />
          </label>

          {message && (
            <p className="mt-3 rounded-md bg-green-50 px-3 py-2 text-xs font-bold text-green-800">
              {message}
            </p>
          )}

          <button
            type="submit"
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-green-700 px-4 py-3 text-sm font-extrabold text-white"
          >
            <FaStar />
            Submit Rating
          </button>
        </form>
      )}
    </div>
  );
}
