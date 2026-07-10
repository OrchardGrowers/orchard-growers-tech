import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  FaBoxes,
  FaBuilding,
  FaCheckCircle,
  FaHandshake,
  FaMapMarkerAlt,
  FaRupeeSign,
  FaSeedling,
} from "react-icons/fa";
import API, { FILE_BASE_URL } from "../services/api";
import SEO from "../components/SEO";

const BUSINESS_TYPE_LABELS = {
  grower: "Grower",
  buyer: "Buyer",
  exporter: "Exporter",
  "commission-agent": "Commission Agent",
  "cold-storage": "Cold Storage",
  logistics: "Logistics",
};

const fallbackLogo = "/logo-original.png";

const resolveProfileMediaUrl = (value = "") => {
  const normalized = String(value || "").trim().replace(/\\/g, "/");
  if (!normalized) return "";
  if (/^(https?:|data:|blob:)/i.test(normalized)) return normalized;
  if (normalized.startsWith("/uploads/")) return `${FILE_BASE_URL}${normalized}`;
  if (normalized.startsWith("/")) return normalized;
  return `${FILE_BASE_URL}/${normalized}`;
};

const formatPrice = (value) => {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return "";
  return amount.toLocaleString("en-IN");
};

export default function PublicBusinessProfile() {
  const navigate = useNavigate();
  const { businessType = "", userId = "" } = useParams();
  const [profile, setProfile] = useState(null);
  const [liveLots, setLiveLots] = useState([]);
  const [closedDeals, setClosedDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    API.get(
      `/user/public-profiles/${encodeURIComponent(businessType)}/${encodeURIComponent(userId)}`
    )
      .then((response) => {
        if (!active) return;
        setProfile(response.data?.profile || null);
        setLiveLots(Array.isArray(response.data?.liveLots) ? response.data.liveLots : []);
        setClosedDeals(Array.isArray(response.data?.closedDeals) ? response.data.closedDeals : []);
      })
      .catch((requestError) => {
        if (active) {
          setError(
            requestError.response?.status === 404
              ? "This public profile is not available."
              : "The public profile could not be loaded."
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [businessType, userId]);

  const typeLabel =
    BUSINESS_TYPE_LABELS[businessType] ||
    profile?.businessType
      ?.split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ") ||
    "Business";
  const firmName = profile?.companyName || "eFruitMandi Business";
  const canonical = `/profiles/${businessType}/${userId}`;
  const publicProfileImage =
    resolveProfileMediaUrl(
      profile?.logoUrl ||
        profile?.profileImage ||
        profile?.profilePic ||
        profile?.avatar ||
        profile?.avatarUrl ||
        profile?.photoURL
    ) || fallbackLogo;
  const publicBannerImage = resolveProfileMediaUrl(profile?.bannerUrl);

  if (loading) {
    return (
      <main className="mx-auto min-h-[60vh] max-w-3xl px-4 py-14">
        <p className="text-center text-sm font-semibold text-gray-500">Loading public profile...</p>
      </main>
    );
  }

  if (error || !profile) {
    return (
      <main className="mx-auto min-h-[60vh] max-w-3xl px-4 py-14 text-center">
        <h1 className="text-2xl font-bold text-gray-950">Public profile unavailable</h1>
        <p className="mt-3 text-gray-600">{error}</p>
        <button
          type="button"
          onClick={() => navigate("/")}
          className="mt-6 rounded-md bg-green-700 px-5 py-3 text-sm font-bold text-white"
        >
          Visit eFruitMandi
        </button>
      </main>
    );
  }

  return (
    <>
      <SEO
        title={`${firmName} - ${typeLabel} on eFruitMandi`}
        description={`${firmName} is a public ${typeLabel.toLowerCase()} profile in ${profile.mainLocation || "India"} on eFruitMandi.`}
        canonical={canonical}
        image={publicProfileImage}
      />
      <main className="mx-auto min-h-[65vh] max-w-7xl px-4 py-10">
        <article className="overflow-hidden rounded-2xl border border-green-100 bg-white shadow-sm">
          <div
            className="h-36 bg-gradient-to-r from-green-800 via-green-700 to-emerald-500 bg-cover bg-center sm:h-44"
            style={publicBannerImage ? { backgroundImage: `url(${publicBannerImage})` } : undefined}
          />
          <div className="px-5 pb-7 sm:px-8">
            <img
              src={publicProfileImage}
              alt={`${firmName} official firm logo`}
              onError={(event) => {
                event.currentTarget.src = fallbackLogo;
              }}
              className="-mt-16 h-28 w-28 rounded-xl border-4 border-white bg-white object-contain shadow"
            />

            <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="inline-flex items-center gap-2 text-sm font-bold text-green-700">
                  <FaSeedling /> {typeLabel}
                </p>
                <h1 className="mt-2 text-2xl font-extrabold text-gray-950 sm:text-3xl">
                  {firmName}
                </h1>
                {profile.mainLocation && (
                  <p className="mt-3 inline-flex items-center gap-2 text-gray-600">
                    <FaMapMarkerAlt className="text-green-700" />
                    {profile.mainLocation}
                  </p>
                )}
              </div>

              {(profile.isKycVerified || profile.isOgVerified) && (
                <div className="rounded-lg bg-green-50 px-4 py-3 text-sm font-bold text-green-800">
                  <span className="inline-flex items-center gap-2">
                    <FaCheckCircle /> Verified profile
                  </span>
                </div>
              )}
            </div>

            <div className="mt-7 rounded-xl border border-gray-100 bg-gray-50 p-5">
              <p className="flex items-center gap-2 font-bold text-gray-950">
                <FaBuilding className="text-green-700" />
                Connect through eFruitMandi
              </p>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                Contact information and private business details are not displayed publicly.
                Use eFruitMandi's marketplace connection flow and public listings below.
              </p>
            </div>
          </div>
        </article>

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <PublicMarketSection
            title="Live Fruit Lots"
            icon={<FaSeedling />}
            items={liveLots}
            emptyText="No live public lots are available from this profile right now."
            onOpenLot={(lotId) => navigate(`/lots/${lotId}`)}
          />
          <PublicMarketSection
            title="Closed Deals"
            icon={<FaHandshake />}
            items={closedDeals}
            emptyText="No completed public deals are visible for this profile yet."
            onOpenLot={(lotId) => navigate(`/lots/${lotId}`)}
          />
        </div>
      </main>
    </>
  );
}

function PublicMarketSection({ title, icon, items = [], emptyText, onOpenLot }) {
  return (
    <section className="rounded-2xl border border-green-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="inline-flex items-center gap-2 text-base font-black text-gray-950">
          <span className="text-green-700">{icon}</span>
          {title}
        </h2>
        <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-extrabold text-green-800">
          {items.length}
        </span>
      </div>

      {items.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((item) => (
            <PublicMarketLotCard
              key={item._id}
              item={item}
              onOpen={() => item._id && onOpenLot?.(item._id)}
            />
          ))}
        </div>
      ) : (
        <p className="rounded-xl bg-green-50 px-4 py-5 text-sm font-semibold text-green-900">
          {emptyText}
        </p>
      )}
    </section>
  );
}

function PublicMarketLotCard({ item, onOpen }) {
  const imageUrl = resolveProfileMediaUrl(item.imageUrl);
  const title = item.title || item.fruitName || "Fruit Lot";
  const detailLine = [item.variety, item.grade].filter(Boolean).join(" / ");
  const price = formatPrice(item.price);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="overflow-hidden rounded-xl border border-gray-100 bg-white text-left shadow-sm transition hover:border-green-200 hover:shadow-md"
    >
      <div className="h-32 bg-green-50">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl text-green-700">
            <FaSeedling />
          </div>
        )}
      </div>

      <div className="space-y-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-sm font-black text-gray-950">
            {title}
          </h3>
          <span className="shrink-0 rounded-full bg-green-50 px-2 py-1 text-[10px] font-extrabold uppercase text-green-800">
            {item.status || "Live"}
          </span>
        </div>

        {detailLine && (
          <p className="line-clamp-1 text-xs font-bold text-gray-600">{detailLine}</p>
        )}

        <div className="space-y-1 text-xs font-bold text-gray-600">
          {item.location && (
            <p className="flex items-center gap-1">
              <FaMapMarkerAlt className="text-green-700" />
              <span className="truncate">{item.location}</span>
            </p>
          )}
          <p className="flex items-center gap-1">
            <FaBoxes className="text-green-700" />
            <span>
              {item.quantity || 0} {item.unit || "boxes"}
            </span>
          </p>
          {price && (
            <p className="flex items-center gap-1 text-green-800">
              <FaRupeeSign />
              <span>{price}</span>
            </p>
          )}
        </div>
      </div>
    </button>
  );
}
