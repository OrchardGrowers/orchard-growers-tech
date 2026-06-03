import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaArrowLeft, FaCalculator, FaMapMarkerAlt, FaSeedling, FaVideo } from "react-icons/fa";
import API, { FILE_BASE_URL } from "../services/api";
import { getCurrentUser, hasBuyerProfile } from "../utils/auth";

export default function QuotePrice() {
  const { lotId } = useParams();
  const navigate = useNavigate();
  const user = getCurrentUser();
  const isBuyer = hasBuyerProfile(user);
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState("");
  const [price, setPrice] = useState("");
  const [distanceKm, setDistanceKm] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const loadLot = async () => {
      try {
        const res = await API.get(`/products/${lotId}?platform=efruitmandi`);
        const lot = res.data?.product || null;
        setProduct(lot);
        setActiveImage(getLotImages(lot)[0] || "");
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
  const images = useMemo(() => getLotImages(product), [product]);
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
    <div className="mx-auto max-w-6xl pb-20">
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
      ) : !isBuyer ? (
        <section className="mt-3 rounded-md border border-green-200 bg-white p-4">
          <h2 className="text-lg font-extrabold text-gray-950">Register as Fruit Buyer first</h2>
          <p className="mt-2 text-sm font-bold leading-6 text-gray-600">
            Only registered fruit buyers can quote prices for grower lots. Create or update your buyer profile, then return to this lot.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate("/register-buyer", { state: { from: `/lots/${lotId}/quote` } })}
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
        <section className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
          <LotMediaPanel
            product={product}
            images={images}
            activeImage={activeImage}
            onSelectImage={setActiveImage}
          />

          <form onSubmit={submitQuote} className="rounded-md border border-gray-200 bg-white p-4 lg:sticky lg:top-20 lg:self-start">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
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
        </section>
      )}
    </div>
  );
}

function LotMediaPanel({ product, images, activeImage, onSelectImage }) {
  return (
    <section className="rounded-md border border-gray-200 bg-white p-3">
      <h2 className="mb-3 text-sm font-extrabold text-gray-950">Lot media</h2>
      <div className="flex min-h-[320px] items-center justify-center rounded-md bg-white">
        {activeImage ? (
          <img
            src={toAssetUrl(activeImage)}
            alt={product?.title || "Fruit Lot"}
            className="max-h-[560px] max-w-full object-contain"
          />
        ) : (
          <div className="flex h-56 w-full items-center justify-center rounded-md bg-green-50 text-4xl text-green-700">
            <FaSeedling />
          </div>
        )}
      </div>

      {images.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {images.map((image) => (
            <button
              key={image}
              type="button"
              onClick={() => onSelectImage(image)}
              className={`h-16 w-20 shrink-0 rounded border bg-white ${
                activeImage === image ? "border-green-700" : "border-gray-200"
              }`}
            >
              <img src={toAssetUrl(image)} alt="" className="h-full w-full object-contain" />
            </button>
          ))}
        </div>
      )}

      {product?.sampleVideo && (
        <div className="mt-4">
          <h3 className="mb-2 flex items-center gap-2 text-xs font-extrabold text-gray-800">
            <FaVideo className="text-green-700" />
            Sample lot video
          </h3>
          <video src={toAssetUrl(product.sampleVideo)} controls className="aspect-video w-full rounded-md bg-black" />
        </div>
      )}
    </section>
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

function getLotImages(product) {
  if (!product) return [];
  const topImages = Array.isArray(product.images) ? product.images : [];
  const gradeImages = Array.isArray(product.gradeLots)
    ? product.gradeLots.flatMap((lot) => lot.images || [])
    : [];
  return Array.from(new Set([...topImages, ...gradeImages].filter(Boolean)));
}

function toAssetUrl(path = "") {
  const normalized = String(path || "").replace(/\\/g, "/");
  if (/^https?:\/\//i.test(normalized)) return normalized;
  return normalized ? `${FILE_BASE_URL}/${normalized}` : "";
}
