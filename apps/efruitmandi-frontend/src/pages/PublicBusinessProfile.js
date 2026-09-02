import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import {
  FaArrowLeft,
  FaBoxes,
  FaBuilding,
  FaCheckCircle,
  FaHandshake,
  FaMapMarkerAlt,
  FaPlayCircle,
  FaRupeeSign,
  FaSeedling,
} from "react-icons/fa";
import API, { FILE_BASE_URL } from "../services/api";
import SEO, { getInitialRobotsDirective } from "../components/SEO";
import ProfileShareButton from "../components/ProfileShareButton";
import { buildBreadcrumbSchema, buildBusinessOrganizationSchema, buildLocalBusinessSchema } from "../utils/schemaGenerators";

const BUSINESS_TYPE_LABELS = {
  grower: "Grower",
  buyer: "Buyer",
  exporter: "Exporter",
  "commission-agent": "Commission Agent",
  "cold-storage": "Cold Storage",
  logistics: "Logistics",
};

const BUYER_SEO_ROLE_LABELS = {
  buyer: "Fruit Buyer",
  exporter: "Fruit Exporter",
  "commission-agent": "Fruit Commission Agent",
  commission_agent: "Fruit Commission Agent",
  "cold-storage": "Cold Storage Business",
  cold_storage: "Cold Storage Business",
};

const fallbackLogo = "/logo-original.png";
const siteUrl = "https://www.efruitmandi.live";

const resolveProfileMediaUrl = (value = "") => {
  const normalized = String(value || "").trim().replace(/\\/g, "/");
  if (!normalized) return "";
  if (/^(https?:|data:|blob:)/i.test(normalized)) return normalized;
  if (normalized.startsWith("/uploads/")) return `${FILE_BASE_URL}${normalized}`;
  if (normalized.startsWith("/")) return normalized;
  return `${FILE_BASE_URL}/${normalized}`;
};

// Social platforms display one `og:image`.  When both business assets are
// stored on Cloudinary, request a share-safe 1200x630 banner with the firm
// logo layered onto it so the preview represents the actual business.
const buildProfileShareImage = (bannerUrl = "", logoUrl = "") => {
  if (!bannerUrl) return logoUrl;
  if (!logoUrl) return bannerUrl;

  const cloudinaryBanner = bannerUrl.match(/^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/i);
  if (!cloudinaryBanner) return bannerUrl;

  try {
    const encodedLogo = window
      .btoa(unescape(encodeURIComponent(logoUrl)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
    return `${cloudinaryBanner[1]}c_fill,w_1200,h_630,g_auto,q_auto,f_jpg/l_fetch:${encodedLogo},w_180,h_180,c_fit,g_south_west,x_42,y_42,r_16,fl_layer_apply/${cloudinaryBanner[2]}`;
  } catch {
    return bannerUrl;
  }
};

const formatPrice = (value) => {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return "";
  return amount.toLocaleString("en-IN");
};

const isCompletedPublicRecord = (item = {}) =>
  String(item.historyOutcome || "").trim().toLowerCase() === "deal completed" ||
  String(item.finalLifecycleStatus || "").trim().toUpperCase() === "COMPLETED";

const dedupePublicRecords = (items = []) => {
  const seen = new Set();
  return (Array.isArray(items) ? items : []).filter((item) => {
    const key = String(item?.publicHistoryKey || item?._id || "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const partitionPublicProfileMarketActivity = (data = {}) => {
  const liveLots = Array.isArray(data.liveLots) ? data.liveLots : [];
  const legacyClosedDeals = Array.isArray(data.closedDeals) ? data.closedDeals : [];
  const hasDistinctHistory = Array.isArray(data.lotHistory) || Array.isArray(data.historicalLots);
  const historySource = Array.isArray(data.lotHistory)
    ? data.lotHistory
    : Array.isArray(data.historicalLots)
      ? data.historicalLots
      : legacyClosedDeals.filter((item) => !isCompletedPublicRecord(item));
  const closedSource = hasDistinctHistory
    ? legacyClosedDeals
    : legacyClosedDeals.filter(isCompletedPublicRecord);
  const closedDeals = dedupePublicRecords(closedSource.filter(isCompletedPublicRecord));
  const closedKeys = new Set(closedDeals.map((item) => item.publicHistoryKey));
  const lotHistory = dedupePublicRecords(
    historySource.filter(
      (item) => !isCompletedPublicRecord(item) && !closedKeys.has(item.publicHistoryKey)
    )
  );
  return { liveLots, lotHistory, closedDeals };
};

export const getPublicRecordPath = (profilePath = "", publicHistoryKey = "") =>
  `${String(profilePath || "").replace(/\/$/, "")}/records/${encodeURIComponent(publicHistoryKey)}`;

export const getPublicLotMedia = (item = {}) => {
  const imageObjectUrls = Array.isArray(item.imageObjects)
    ? item.imageObjects.map((image) => image?.url || image?.secure_url || image?.path || "")
    : [];
  const gradeImages = Array.isArray(item.gradeLots)
    ? item.gradeLots.flatMap((gradeLot) => [
        ...(Array.isArray(gradeLot?.images) ? gradeLot.images : []),
        ...(Array.isArray(gradeLot?.imageObjects)
          ? gradeLot.imageObjects.map((image) => image?.url || image?.secure_url || image?.path || "")
          : []),
      ])
    : [];
  const images = Array.from(new Set([
    item.imageUrl,
    ...(Array.isArray(item.images) ? item.images : []),
    ...imageObjectUrls,
    ...gradeImages,
  ].map(resolveProfileMediaUrl).filter(Boolean)));
  const videos = Array.from(new Set([
    item.sampleVideo,
    ...(Array.isArray(item.videos) ? item.videos : []),
  ].map(resolveProfileMediaUrl).filter(Boolean)));
  return { images, videos, primaryImage: images[0] || "" };
};

export default function PublicBusinessProfile({ publicBusinessType = "" }) {
  const navigate = useNavigate();
  const {
    businessType: routeBusinessType = "",
    userId = "",
    slug = "",
    publicHistoryKey = "",
  } = useParams();
  const businessType = publicBusinessType || routeBusinessType;
  const [profile, setProfile] = useState(null);
  const [liveLots, setLiveLots] = useState([]);
  const [lotHistory, setLotHistory] = useState([]);
  const [closedDeals, setClosedDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setProfile(null);
    setLiveLots([]);
    setLotHistory([]);
    setClosedDeals([]);

    const profileEndpoint = slug
      ? `/user/public-profiles/by-slug/${encodeURIComponent(businessType)}/${encodeURIComponent(slug)}?devPublicMarketplace=1`
      : `/user/public-profiles/${encodeURIComponent(businessType)}/${encodeURIComponent(userId)}?devPublicMarketplace=1`;

    API.get(profileEndpoint)
      .then((response) => {
        if (!active) return;
        const activity = partitionPublicProfileMarketActivity(response.data);
        setProfile(response.data?.profile || null);
        setLiveLots(activity.liveLots);
        setLotHistory(activity.lotHistory);
        setClosedDeals(activity.closedDeals);
      })
      .catch((requestError) => {
        if (active) {
          setProfile(null);
          setLiveLots([]);
          setLotHistory([]);
          setClosedDeals([]);
          setError(
            [400, 404].includes(requestError.response?.status)
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
  }, [businessType, slug, userId]);

  const typeLabel =
    BUSINESS_TYPE_LABELS[businessType] ||
    profile?.businessType
      ?.split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ") ||
    "Business";
  const profileRole = profile?.role === "grower" ? "grower" : "buyer";
  const expectedRole = businessType === "grower" ? "grower" : "buyer";
  const profileTypeMatches = Boolean(profile && profileRole === expectedRole);
  const publicName = String(
    profileRole === "grower"
      ? profile?.orchardName || profile?.companyName || ""
      : profile?.businessName || profile?.companyName || profile?.buyerContactPerson || ""
  ).trim();
  const firmName = publicName || "eFruitMandi Business";
  const routeCanonical = slug
    ? `/${businessType === "grower" ? "growers" : "buyers"}/${slug}`
    : `/profiles/${businessType}/${userId}`;
  const [initialRobots] = useState(() =>
    getInitialRobotsDirective(routeCanonical, "noindex,nofollow")
  );
  const canonicalSlug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(profile?.slug || ""))
    ? profile.slug
    : "";
  const canonical = canonicalSlug
    ? `${profile.role === "grower" ? "/growers" : "/buyers"}/${canonicalSlug}`
    : routeCanonical;
  const canonicalProfilePath = canonicalSlug
    ? `/${profileRole === "grower" ? "growers" : "buyers"}/${canonicalSlug}`
    : "";
  const canonicalRouteTarget = publicHistoryKey
    ? getPublicRecordPath(canonicalProfilePath, publicHistoryKey)
    : canonicalProfilePath;
  const shouldReplaceRoute = Boolean(
    profileTypeMatches &&
      publicName &&
      canonicalProfilePath &&
      (userId || (slug && slug !== canonicalSlug))
  );
  const publicLocation = String(profile?.mainLocation || "").trim();
  const profileImage = resolveProfileMediaUrl(
    profile?.logoUrl ||
      profile?.buyerCompanyLogoUrl ||
      profile?.companyLogoUrl
  );
  const publicProfileImage = profileImage || fallbackLogo;
  const publicBannerImage = resolveProfileMediaUrl(profile?.bannerUrl);
  const profileShareImage = buildProfileShareImage(publicBannerImage, profileImage);
  const schemaImage = profileImage
    ? /^https?:/i.test(profileImage)
      ? profileImage
      : `${siteUrl}${profileImage.startsWith("/") ? "" : "/"}${profileImage}`
    : "";

  const seoRoleLabel = profileRole === "grower"
    ? "Fruit Grower"
    : BUYER_SEO_ROLE_LABELS[String(profile?.businessType || "").toLowerCase()] || "Fruit Buyer";
  const seoTitle = publicName
    ? `${publicName} – ${seoRoleLabel}${publicLocation ? ` in ${publicLocation}` : ""} | eFruitMandi`
    : "Public Profile | eFruitMandi";
  const seoDescription = publicName
    ? profileRole === "grower"
      ? `View the public fruit grower profile for ${publicName}${publicLocation ? ` in ${publicLocation}` : ""} on eFruitMandi.`
      : `View the public ${seoRoleLabel.toLowerCase()} profile for ${publicName}${publicLocation ? ` in ${publicLocation}` : ""} on eFruitMandi.`
    : "This public business profile is not available for search indexing.";
  const canonicalUrl = `${siteUrl}${canonical}`;
  const publicAddress = profile?.district || profile?.state
    ? {
        "@type": "PostalAddress",
        ...(profile?.district ? { addressLocality: profile.district } : {}),
        ...(profile?.state ? { addressRegion: profile.state } : {}),
      }
    : null;
  const businessSchema = publicName
    ? (profileRole === "grower" ? buildLocalBusinessSchema : buildBusinessOrganizationSchema)({
        "@id": `${canonicalUrl}#${profileRole === "grower" ? "business" : "organization"}`,
        name: publicName,
        url: canonicalUrl,
        description: seoDescription,
        mainEntityOfPage: { "@id": `${canonicalUrl}#webpage` },
        ...(schemaImage ? { image: schemaImage } : {}),
        ...(publicAddress ? { address: publicAddress } : {}),
        ...(publicLocation ? { areaServed: publicLocation } : {}),
      })
    : null;
  const profilePageSchema = publicName
    ? {
        "@context": "https://schema.org",
        "@type": "ProfilePage",
        "@id": `${canonicalUrl}#webpage`,
        url: canonicalUrl,
        name: seoTitle,
        description: seoDescription,
        isPartOf: { "@id": `${siteUrl}/#website` },
        publisher: { "@id": `${siteUrl}/#organization` },
        mainEntity: { "@id": `${canonicalUrl}#${profileRole === "grower" ? "business" : "organization"}` },
      }
    : null;
  const breadcrumbSchema = publicName
    ? buildBreadcrumbSchema([
          {
            name: "Home",
            url: `${siteUrl}/`,
          },
          {
            name: profileRole === "grower" ? "Growers" : "Buyers",
            url: `${siteUrl}/${profileRole === "grower" ? "growers" : "buyers"}`,
          },
          {
            name: publicName,
            url: canonicalUrl,
          },
        ])
    : null;
  const publicFruits = Array.from(new Map(
    [...liveLots, ...lotHistory, ...closedDeals].map((lot) => {
      const name = String(lot.fruitName || lot.title || "").trim().replace(/\s+fruit$/i, "");
      const fruitSlug = name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      return [fruitSlug, { name, slug: fruitSlug }];
    }).filter(([fruitSlug, fruit]) => fruitSlug && fruit.name)
  ).values());
  const selectedPublicRecord = publicHistoryKey
    ? [...lotHistory, ...closedDeals].find(
        (item) => item.publicHistoryKey === publicHistoryKey
      )
    : null;

  if (loading) {
    return (
      <>
        <SEO canonical={routeCanonical} robots={initialRobots} image={null} />
        <main className="mx-auto min-h-[60vh] max-w-3xl px-4 py-14">
          <p className="text-center text-sm font-semibold text-gray-500">Loading public profile...</p>
        </main>
      </>
    );
  }

  if (shouldReplaceRoute) {
    return <Navigate to={canonicalRouteTarget} replace />;
  }

  if (error || !profile || !profileTypeMatches || !publicName) {
    const directoryPath = expectedRole === "grower" ? "/growers" : "/buyers";
    return (
      <>
        <SEO title="Public Profile Not Found | eFruitMandi" canonical={null} robots="noindex,follow" image={null} />
        <main className="mx-auto min-h-[60vh] max-w-3xl px-4 py-14 text-center">
          <h1 className="text-2xl font-bold text-gray-950">Public Profile Not Found</h1>
          <p className="mt-3 text-gray-600">This public profile is unavailable or is no longer publicly listed.</p>
          <Link
            to={directoryPath}
            className="mt-6 inline-flex rounded-md bg-green-700 px-5 py-3 text-sm font-bold text-white"
          >
            Browse public {expectedRole === "grower" ? "growers" : "buyers"}
          </Link>
        </main>
      </>
    );
  }

  if (publicHistoryKey) {
    return (
      <>
        <SEO
          title={`${selectedPublicRecord?.fruitName || "Historical Fruit Lot"} | ${firmName} | eFruitMandi`}
          description="Read-only public fruit lot history with sanitized listing details."
          canonical={null}
          robots="noindex,follow"
          image={getPublicLotMedia(selectedPublicRecord || {}).primaryImage || null}
        />
        <main className="mx-auto min-h-[65vh] max-w-5xl px-4 py-8">
          <button
            type="button"
            onClick={() => navigate(canonical)}
            className="mb-5 inline-flex items-center gap-2 text-sm font-extrabold text-green-800 hover:text-green-950"
          >
            <FaArrowLeft /> Back to {firmName}
          </button>
          {selectedPublicRecord ? (
            <PublicReadOnlyLotDetails item={selectedPublicRecord} />
          ) : (
            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
              <h1 className="text-xl font-black text-gray-950">Historical record not found</h1>
              <p className="mt-2 text-sm font-semibold text-gray-700">
                This opaque public record is unavailable on the selected business profile.
              </p>
            </section>
          )}
        </main>
      </>
    );
  }

  return (
    <>
      <SEO
        title={seoTitle}
        description={seoDescription}
        canonical={canonical}
        image={profileShareImage || null}
        type="website"
        noIndex={!publicName}
        schema={publicName ? [profilePageSchema, businessSchema, breadcrumbSchema] : undefined}
      />
      <main className="mx-auto min-h-[65vh] max-w-7xl px-4 py-10">
        <article className="overflow-hidden rounded-2xl border border-green-100 bg-white shadow-sm">
          <div
            className="h-48 bg-gradient-to-r from-green-800 via-green-700 to-emerald-500 bg-cover bg-center sm:h-64"
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

              <div className="flex flex-col items-start gap-2 sm:items-end">
                <ProfileShareButton
                  profileType={profileRole}
                  profileName={firmName}
                  slug={canonicalSlug}
                  canonicalUrl={canonicalUrl}
                />
                {(profile.isKycVerified || profile.isOgVerified) && (
                  <div className="rounded-lg bg-green-50 px-4 py-3 text-sm font-bold text-green-800">
                    <span className="inline-flex items-center gap-2">
                      <FaCheckCircle /> Verified profile
                    </span>
                  </div>
                )}
              </div>
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

        <div className="mt-6 grid gap-5 lg:grid-cols-3">
          <PublicMarketSection
            title="Live Fruit Lots"
            icon={<FaSeedling />}
            items={liveLots}
            emptyText="No live public lots are available from this profile right now."
            onOpenLot={(lotId) => navigate(`/lots/${lotId}`)}
          />
          <PublicMarketSection
            title="Lot History"
            icon={<FaHandshake />}
            items={lotHistory}
            emptyText="No public historical lots are visible for this profile yet."
            onOpenLot={(recordKey) => navigate(getPublicRecordPath(canonical, recordKey))}
          />
          <PublicMarketSection
            title="Closed Deals"
            icon={<FaCheckCircle />}
            items={closedDeals}
            emptyText="No completed public deals are visible for this profile yet."
            onOpenLot={(recordKey) => navigate(getPublicRecordPath(canonical, recordKey))}
          />
        </div>
        {publicFruits.length > 0 && (
          <nav className="mt-5 flex flex-wrap gap-3" aria-label={`Fruits associated with ${firmName}`}>
            {publicFruits.map((fruit) => (
              <Link key={fruit.slug} to={`/fruits/${fruit.slug}`} className="text-sm font-bold text-green-800 hover:text-green-900">
                View {fruit.name}
              </Link>
            ))}
          </nav>
        )}
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
          {items.map((item, index) => (
            <PublicMarketLotCard
              key={item._id || item.publicHistoryKey || `${item.fruitName || "lot"}-${item.listingDate || index}`}
              item={item}
              onOpen={() => {
                const identifier = item.readOnly || item.historical || item.tradable === false
                  ? item.publicHistoryKey
                  : item._id;
                if (identifier) onOpenLot?.(identifier);
              }}
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

export function PublicMarketLotCard({ item, onOpen }) {
  const { primaryImage } = getPublicLotMedia(item);
  const title = item.title || item.fruitName || "Fruit Lot";
  const detailLine = [item.variety, item.grade || item.quality].filter(Boolean).join(" / ");
  const price = formatPrice(item.price);
  const readOnly = item.readOnly === true || item.historical === true || item.tradable === false;
  const CardElement = readOnly ? "article" : "button";
  const historyDate = item.tradingDate || item.closedAt || item.listingDate;

  return (
    <CardElement
      type={readOnly ? undefined : "button"}
      onClick={readOnly ? undefined : onOpen}
      className="overflow-hidden rounded-xl border border-gray-100 bg-white text-left shadow-sm transition hover:border-green-200 hover:shadow-md"
    >
      <div className="h-32 bg-green-50">
        {primaryImage ? (
          <img
            src={primaryImage}
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
            {item.historyOutcome || item.finalLifecycleStatus || item.status || "Live"}
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
          {readOnly && (
            <>
              <p>{Number(item.offerCount || 0)} interested buyer offer(s)</p>
              {historyDate && <p>{new Date(historyDate).toLocaleDateString("en-IN")}</p>}
              <p className="font-extrabold text-gray-700">Historical record · Read only</p>
            </>
          )}
          {price && !readOnly && (
            <p className="flex items-center gap-1 text-green-800">
              <FaRupeeSign />
              <span>{price}</span>
            </p>
          )}
        </div>

        {readOnly && item.publicHistoryKey && (
          <button
            type="button"
            onClick={onOpen}
            className="mt-2 inline-flex w-full items-center justify-center rounded-lg bg-green-700 px-3 py-2 text-xs font-extrabold text-white hover:bg-green-800"
          >
            View Details
          </button>
        )}
      </div>
    </CardElement>
  );
}

const formatPublicDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("en-IN");
};

const getPackingSummaryText = (item = {}) => [
  item.packingType,
  Number(item.packingWeightKg) > 0 ? `${item.packingWeightKg} kg per package` : "",
  Number(item.packingSummary?.totalPackages) > 0
    ? `${item.packingSummary.totalPackages} packages`
    : "",
  Number(item.packingSummary?.totalWeightKg) > 0
    ? `${item.packingSummary.totalWeightKg} kg total`
    : "",
].filter(Boolean).join(" · ");

export function PublicReadOnlyLotDetails({ item = {} }) {
  const { images, videos } = getPublicLotMedia(item);
  const title = item.title || item.fruitName || "Historical Fruit Lot";
  const packingSummary = getPackingSummaryText(item);
  const isCompleted = isCompletedPublicRecord(item);
  const packingBreakdown = Array.isArray(item.packingBreakdown)
    ? item.packingBreakdown.filter((row) => row && typeof row === "object")
    : [];
  const details = [
    ["Fruit", item.fruitName || item.title],
    ["Variety", item.variety],
    ["Quantity", `${Number(item.quantity || 0)} ${item.unit || "boxes"}`],
    ["Grade / Quality", item.grade || item.quality],
    ["Packing", packingSummary],
    ["Location", item.location],
    ["Listing date", formatPublicDate(item.listingDate)],
    ["Trading / end date", formatPublicDate(item.tradingDate)],
    ["Closed date", formatPublicDate(item.closedAt)],
    ["Interested buyers", `${Number(item.offerCount || 0)} offer(s)`],
    ["Outcome", item.historyOutcome],
    ["Final status", item.finalLifecycleStatus],
  ].filter(([, value]) => value !== undefined && value !== null && value !== "");

  return (
    <article className="overflow-hidden rounded-2xl border border-green-100 bg-white shadow-sm">
      <header className="border-b border-green-100 bg-green-50 px-5 py-5 sm:px-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wide text-green-800">
              {isCompleted ? "Closed Deal" : "Lot History"}
            </p>
            <h1 className="mt-1 text-2xl font-black text-gray-950">{title}</h1>
          </div>
          <span className="rounded-full bg-white px-3 py-2 text-xs font-extrabold uppercase text-green-800 ring-1 ring-green-200">
            {item.historyOutcome || item.finalLifecycleStatus || "Read only"}
          </span>
        </div>
        <p className="mt-3 text-sm font-extrabold text-gray-700">
          Public historical record · Read only · Trading disabled
        </p>
      </header>

      {(images.length > 0 || videos.length > 0) && (
        <section className="p-5 sm:p-7" aria-label="Public lot media">
          <h2 className="mb-3 text-base font-black text-gray-950">Listing media</h2>
          {images.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {images.map((image, index) => (
                <img
                  key={image}
                  src={image}
                  alt={`${title} public listing ${index + 1}`}
                  className="h-52 w-full rounded-xl bg-green-50 object-cover"
                  loading={index === 0 ? "eager" : "lazy"}
                  decoding="async"
                />
              ))}
            </div>
          )}
          {videos.length > 0 && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {videos.map((video) => (
                <div key={video} className="overflow-hidden rounded-xl bg-black">
                  <p className="flex items-center gap-2 bg-gray-950 px-3 py-2 text-xs font-bold text-white">
                    <FaPlayCircle /> Public listing video
                  </p>
                  <video controls preload="metadata" className="aspect-video w-full" src={video} />
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="border-t border-gray-100 p-5 sm:p-7">
        <h2 className="text-base font-black text-gray-950">Public listing details</h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {details.map(([label, value]) => (
            <div key={label} className="rounded-xl bg-gray-50 px-4 py-3">
              <dt className="text-[10px] font-extrabold uppercase text-gray-500">{label}</dt>
              <dd className="mt-1 text-sm font-bold text-gray-900">{value}</dd>
            </div>
          ))}
        </dl>

        {packingBreakdown.length > 0 && (
          <div className="mt-5 rounded-xl border border-gray-100 p-4">
            <h3 className="text-sm font-black text-gray-950">Packaging breakdown</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {packingBreakdown.map((row, index) => {
                const label = row.size || row.packageTypeCode || row.packageSizeCode || `Package ${index + 1}`;
                const values = [
                  Number(row.packageCount) > 0 ? `${row.packageCount} package(s)` : "",
                  Number(row.piecesPerPackage) > 0 ? `${row.piecesPerPackage} pieces/package` : "",
                  Number(row.weightPerPackageKg) > 0 ? `${row.weightPerPackageKg} kg/package` : "",
                ].filter(Boolean).join(" · ");
                return (
                  <p key={`${label}-${index}`} className="rounded-lg bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-700">
                    <span className="font-extrabold text-gray-950">{label}</span>
                    {values ? ` · ${values}` : ""}
                  </p>
                );
              })}
            </div>
          </div>
        )}

        {item.hasOrganicCertificateProof && (
          <p className="mt-4 inline-flex rounded-full bg-green-100 px-3 py-2 text-xs font-extrabold text-green-900">
            Public organic/certificate proof indicator available
          </p>
        )}
        {item.description && (
          <div className="mt-5 rounded-xl border border-gray-100 p-4">
            <h3 className="text-sm font-black text-gray-950">Public lot description</h3>
            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-gray-700">{item.description}</p>
          </div>
        )}
      </section>
    </article>
  );
}
