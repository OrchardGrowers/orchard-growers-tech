import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  FaArrowLeft,
  FaMapMarkerAlt,
  FaSeedling,
  FaUser,
  FaVideo,
} from "react-icons/fa";
import API, { FILE_BASE_URL } from "../services/api";
import CountdownTimer from "../components/CountdownTimer";
import { getCurrentUser } from "../utils/auth";

export default function LotDetails() {
  const { lotId } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [auction, setAuction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState("");
  const user = getCurrentUser();

  useEffect(() => {
    const loadLot = async () => {
      try {
        const res = await API.get(`/products/${lotId}`);
        const lot = res.data?.product || null;
        const linkedAuction = res.data?.auction || null;

        setProduct(lot);
        setAuction(linkedAuction);
        setActiveImage(getAllImages(lot)[0] || "");
      } catch (err) {
        console.error(err);
        setProduct(null);
      } finally {
        setLoading(false);
      }
    };

    loadLot();
  }, [lotId]);

  const images = useMemo(() => getAllImages(product), [product]);
  const createdBy = product?.createdBy || {};
  const ownerId = createdBy._id || createdBy.id;
  const currentUserId = user._id || user.id;
  const canSeeBasePrice = ownerId && currentUserId && ownerId === currentUserId;

  if (loading) {
    return (
      <div className="pb-20">
        <p className="py-3 text-sm font-semibold text-green-700">
          Loading lot details...
        </p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="pb-20">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-3 inline-flex items-center gap-2 rounded-full bg-gray-200 px-3 py-1 text-xs font-bold text-gray-700"
        >
          <FaArrowLeft />
          Back
        </button>
        <EmptyState text="This fruit lot is not available." />
      </div>
    );
  }

  return (
    <div className="pb-20">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-3 inline-flex items-center gap-2 rounded-full bg-gray-200 px-3 py-1 text-xs font-bold text-gray-700"
      >
        <FaArrowLeft />
        Back
      </button>

      <section className="rounded-md border border-gray-200 bg-white p-2">
        <div className="aspect-[4/3] w-full overflow-hidden rounded-md bg-green-100">
          {activeImage ? (
            <img
              src={toAssetUrl(activeImage)}
              alt={product.title || "Fruit Lot"}
              className="h-full w-full object-cover object-center"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-4xl text-green-700">
              <FaSeedling />
            </div>
          )}
        </div>

        {images.length > 1 && (
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {images.map((image) => (
              <button
                key={image}
                type="button"
                onClick={() => setActiveImage(image)}
                className={`h-14 w-16 shrink-0 overflow-hidden rounded border ${
                  activeImage === image ? "border-green-700" : "border-gray-200"
                }`}
              >
                <img
                  src={toAssetUrl(image)}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="mt-3 rounded-md border border-gray-200 bg-white p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-base font-extrabold text-black">
              {product.title || "Fruit Lot"}
            </h1>
            <p className="mt-1 flex items-center gap-1 text-xs font-bold text-gray-600">
              <FaMapMarkerAlt className="text-green-700" />
              {product.location || "Fruit Mandi"}
            </p>
          </div>
          <span className="shrink-0 rounded bg-green-100 px-2 py-1 text-[9px] font-extrabold text-green-800">
            {product.status || "AVAILABLE"}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <InfoTile label="Fruit" value={product.fruitName || product.title} />
          <InfoTile label="Variety" value={product.variety || "Not set"} />
          <InfoTile label="Lot No." value={product.lotNo || "Not set"} />
          <InfoTile label="Total boxes" value={product.quantity || 0} />
          <InfoTile label="Packing" value={product.packingType || "Not set"} />
          <InfoTile label="Total weight" value={formatWeight(product.totalWeightKg)} />
          <InfoTile label="Deal status" value={auction?.status || "Not started"} />
          {canSeeBasePrice && (
            <InfoTile label="Base price" value={`Rs. ${product.basePrice || 0}`} />
          )}
          <InfoTile
            label="Live at"
            value={formatDate(product.auctionStartTime || auction?.startTime)}
          />
        </div>

        {product.description && (
          <p className="mt-3 text-xs font-semibold leading-relaxed text-gray-700">
            {product.description}
          </p>
        )}
      </section>

      <AuctionPanel auction={auction} />
      <GradeLots lots={product.gradeLots || []} />
      <SampleVideo video={product.sampleVideo} />

      <section className="mt-3 rounded-md border border-gray-200 bg-white p-3">
        <h2 className="mb-2 text-xs font-extrabold text-black">Grower Information</h2>
        <div className="flex items-center gap-2 text-xs font-bold text-gray-700">
          <FaUser className="text-green-700" />
          <span>
            {createdBy.orchardName || createdBy.name || "Grower"}
          </span>
        </div>
      </section>
    </div>
  );
}

function AuctionPanel({ auction }) {
  if (!auction) {
    return (
      <section className="mt-3 rounded-md border border-green-100 bg-green-50 p-3">
        <h2 className="text-xs font-extrabold text-green-900">Deal Details</h2>
        <p className="mt-1 text-xs font-bold text-green-800">
          This lot is listed, but deal details are not confirmed yet.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-3 rounded-md border border-gray-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-extrabold text-black">Deal Details</h2>
        <span className="rounded bg-green-100 px-2 py-1 text-[9px] font-extrabold text-green-800">
          {auction.status}
        </span>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <InfoTile label="Current deal price" value={`Rs. ${auction.currentBid || 0}`} />
        {auction.startingPrice !== undefined && (
          <InfoTile label="Starting price" value={`Rs. ${auction.startingPrice || 0}`} />
        )}
        <InfoTile label="Start time" value={formatDate(auction.startTime)} />
        <InfoTile label="End time" value={formatDate(auction.endTime)} />
      </div>

      {auction.status === "ACTIVE" && auction.endTime && (
        <div className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs font-extrabold text-red-700">
          <CountdownTimer endTime={auction.endTime} />
        </div>
      )}
    </section>
  );
}

function GradeLots({ lots }) {
  if (!lots.length) return null;

  return (
    <section className="mt-3 rounded-md border border-gray-200 bg-white p-3">
      <h2 className="mb-2 text-xs font-extrabold text-black">
        Grade-wise Lot Samples
      </h2>
      <div className="space-y-3">
        {lots.map((lot) => (
          <div key={lot.grade} className="rounded-md bg-gray-50 p-2">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-extrabold text-black">
                Grade {lot.grade}
              </span>
              <span className="rounded bg-white px-2 py-1 text-[9px] font-extrabold text-gray-700">
                {lot.boxes || 0} boxes | {formatWeight(lot.weightKg)}
              </span>
            </div>
            {lot.images?.length ? (
              <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                {lot.images.map((image) => (
                  <img
                    key={image}
                    src={toAssetUrl(image)}
                    alt={`Grade ${lot.grade}`}
                    className="h-20 w-24 shrink-0 rounded object-cover"
                  />
                ))}
              </div>
            ) : (
              <p className="text-[10px] font-bold text-gray-500">
                No sample image for this grade.
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function SampleVideo({ video }) {
  if (!video) return null;

  return (
    <section className="mt-3 rounded-md border border-gray-200 bg-white p-3">
      <h2 className="mb-2 flex items-center gap-2 text-xs font-extrabold text-black">
        <FaVideo className="text-green-700" />
        Sample Lot Video
      </h2>
      <video
        src={toAssetUrl(video)}
        controls
        className="aspect-video w-full rounded-md bg-black"
      />
    </section>
  );
}

function InfoTile({ label, value }) {
  return (
    <div className="rounded-md bg-green-50 px-3 py-2">
      <p className="text-[9px] font-extrabold text-gray-500">{label}</p>
      <p className="mt-1 truncate text-xs font-extrabold text-black">
        {value || "Not set"}
      </p>
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-dashed border-green-200 bg-green-50 px-3 py-4 text-green-800">
      <FaSeedling className="text-lg" />
      <p className="text-xs font-bold">{text}</p>
    </div>
  );
}

function getAllImages(product) {
  if (!product) return [];

  const topImages = Array.isArray(product.images) ? product.images : [];
  const gradeImages = Array.isArray(product.gradeLots)
    ? product.gradeLots.flatMap((lot) => lot.images || [])
    : [];

  return Array.from(new Set([...topImages, ...gradeImages].filter(Boolean)));
}

function toAssetUrl(path) {
  const normalizedPath = path ? path.replace(/\\/g, "/") : "";
  return normalizedPath ? `${FILE_BASE_URL}/${normalizedPath}` : "";
}

function formatDate(value) {
  if (!value) return "Not set";

  return new Date(value).toLocaleString([], {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatWeight(value) {
  const number = Number(value || 0);
  if (!number) return "0 KG";
  if (number < 1) return `${number.toFixed(1)} KG`;
  return `${Math.round(number * 10) / 10} KG`;
}
