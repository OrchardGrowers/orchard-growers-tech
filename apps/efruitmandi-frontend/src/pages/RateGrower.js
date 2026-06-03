import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaArrowLeft, FaMapMarkerAlt, FaStar } from "react-icons/fa";
import API from "../services/api";
import { getCurrentUser, hasBuyerProfile } from "../utils/auth";

export default function RateGrower() {
  const { lotId } = useParams();
  const navigate = useNavigate();
  const user = getCurrentUser();
  const isBuyer = hasBuyerProfile(user);
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

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
  const currentRating = Number(product?.createdBy?.growerRatingAverage || 0);
  const currentRatingCount = Number(product?.createdBy?.growerRatingCount || 0);

  const submitRating = async (event) => {
    event.preventDefault();
    if (saving) return;

    try {
      setSaving(true);
      setMessage("");
      const res = await API.post(`/user/grower-rating/${lotId}`, {
        rating,
        comment,
      });

      const updatedGrower = res.data?.grower;
      if (updatedGrower) {
        setProduct((current) => ({
          ...current,
          createdBy: {
            ...(current?.createdBy || {}),
            ...updatedGrower,
          },
        }));
      }

      setMessage(res.data?.message || "Rating submitted.");
    } catch (err) {
      setMessage(
        err.response?.data?.msg ||
          err.response?.data?.message ||
          "Rating could not be submitted. Please login and try again."
      );
    } finally {
      setSaving(false);
    }
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
        <p className="mt-2 flex items-center gap-2 text-sm font-bold text-amber-600">
          <FaStar />
          {currentRating ? `${currentRating.toFixed(1)} from ${currentRatingCount} ratings` : "No rating yet"}
        </p>
      </section>

      {!loading && !product ? (
        <div className="mt-3 rounded-md border border-dashed border-green-200 bg-green-50 p-4 text-sm font-bold text-green-800">
          This grower rating page is not available.
        </div>
      ) : !isBuyer ? (
        <section className="mt-3 rounded-md border border-green-200 bg-white p-4">
          <h2 className="text-lg font-extrabold text-gray-950">Register as Fruit Buyer first</h2>
          <p className="mt-2 text-sm font-bold leading-6 text-gray-600">
            Only registered fruit buyers can rate a grower. Create or update your buyer profile, then return to this grower rating page.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate("/register-buyer", { state: { from: `/lots/${lotId}/rating` } })}
              className="rounded-full bg-green-700 px-5 py-2 text-sm font-extrabold text-white hover:bg-green-800"
            >
              Register as Fruit Buyer
            </button>
            <button
              type="button"
              onClick={() => navigate(`/lots/${lotId}`)}
              className="rounded-full bg-gray-100 px-5 py-2 text-sm font-extrabold text-gray-700 hover:bg-gray-200"
            >
              View Lot
            </button>
          </div>
        </section>
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
            disabled={saving}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-green-700 px-4 py-3 text-sm font-extrabold text-white"
          >
            <FaStar />
            {saving ? "Submitting..." : "Submit Rating"}
          </button>
        </form>
      )}
    </div>
  );
}
