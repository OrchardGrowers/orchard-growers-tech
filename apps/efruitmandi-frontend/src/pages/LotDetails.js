import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  FaArrowLeft,
  FaCertificate,
  FaMapMarkerAlt,
  FaSearchMinus,
  FaSearchPlus,
  FaSeedling,
  FaStar,
  FaTimes,
  FaVideo,
} from "react-icons/fa";
import API, { FILE_BASE_URL } from "../services/api";
import CountdownTimer from "../components/CountdownTimer";
import SEO from "../components/SEO";
import { buildProductSchema, publisherReference } from "../utils/schemaGenerators";
import LimitedPublicProfileCard from "../components/LimitedPublicProfileCard";
import { canQuote, getCurrentUser, hasBuyerProfile } from "../utils/auth";
import { trackLotContact, trackLotView } from "../services/analytics";
import { saveUserToStorage } from "../utils/userStorage";
import { getSafePublicProfile, isClosedDeal } from "../utils/marketplaceVisibility";

const LOGIN_REQUIRED_MESSAGE = "Please login first to continue.";
const isDevelopment = process.env.NODE_ENV !== "production";
const LOT_DETAILS_CACHE_LIMIT = 20;
const lotDetailsCache = new Map();

function rememberLotDetails(key, value) {
  if (!key || !value?.product) return;
  lotDetailsCache.set(key, value);
  if (lotDetailsCache.size > LOT_DETAILS_CACHE_LIMIT) {
    lotDetailsCache.delete(lotDetailsCache.keys().next().value);
  }
}

export default function LotDetails() {
  const { lotId } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [auction, setAuction] = useState(null);
  const [closedDeal, setClosedDeal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState("");
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [imageZoom, setImageZoom] = useState(1);
  const [user, setUser] = useState(() => getCurrentUser());
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const loadLot = async () => {
      try {
        setErrorMessage("");
        setLoading(true);
        if (!lotId || !/^[a-f0-9]{24}$/i.test(String(lotId))) {
          setProduct(null);
          setAuction(null);
          setClosedDeal(null);
          setErrorMessage("Lot not found");
          return;
        }
        const cacheUser = localStorage.getItem("accessToken")
          ? getCurrentUser()?._id || getCurrentUser()?.id || "auth"
          : "public";
        const cacheKey = `${lotId}:${cacheUser}`;
        const cachedLot = lotDetailsCache.get(cacheKey);
        const [res, profileRes] = await Promise.all([
          cachedLot
            ? Promise.resolve({ data: cachedLot })
            : API.get(`/products/${lotId}?platform=efruitmandi`),
          localStorage.getItem("accessToken")
            ? API.get("/user/profile").catch(() => ({ data: getCurrentUser() }))
            : Promise.resolve({ data: getCurrentUser() }),
        ]);
        const freshUser = profileRes.data || getCurrentUser() || {};
        setUser(freshUser);
        saveUserToStorage(freshUser);
        const lot = res.data?.product || null;
        const linkedAuction = res.data?.auction || null;
        const linkedClosedDeal = res.data?.closedDeal || null;

        if (!lot) {
          setErrorMessage("Lot not found");
        } else if (!cachedLot) {
          rememberLotDetails(cacheKey, res.data);
        }

        setProduct(lot);
        setAuction(linkedAuction);
        setClosedDeal(linkedClosedDeal);
        setActiveImage(getAllImages(lot)[0] || "");
      } catch (err) {
        if (isDevelopment) {
          console.error("Failed to load lot", err);
        }
        setErrorMessage("Failed to load lot");
        setProduct(null);
        setAuction(null);
        setClosedDeal(null);
      } finally {
        setLoading(false);
      }
    };

    loadLot();
  }, [lotId]);

  const images = useMemo(() => getAllImages(product), [product]);
  const hasActiveImage = Boolean(activeImage);
  const createdBy = product?.createdBy || {};
  const ownerId = createdBy._id || createdBy.id;
  const currentUserId = user?._id || user?.id;
  const canSeeBasePrice = ownerId && currentUserId && ownerId === currentUserId;
  const isOrganicCertified = isOrganicCertifiedProduct(product);
  const growerName = createdBy.orchardName || createdBy.businessName || createdBy.name || "Grower's Orchard";
  const growerRating = Number(createdBy.growerRatingAverage || createdBy.rating || product?.growerRating || 0);
  const growerRatingCount = Number(createdBy.growerRatingCount || 0);
  const activeGradeLabel = getImageGradeLabel(product, activeImage);
  const growerPublicProfile = useMemo(
    () =>
      getSafePublicProfile(createdBy, {
        companyName: growerName,
        businessType: "grower",
      }),
    [createdBy, growerName]
  );
  const isClosedLot = isClosedLotStatus(product, auction, closedDeal);
  const detailProductId = product?._id || product?.id || lotId;
  const closedBuyer = closedDeal?.purchasedBy || product?.acceptedBuyerId || auction?.highestBidder || null;
  const closedSeller = closedDeal?.soldBy || product?.createdBy || null;
  const buildLoginState = (from, requiredProfile) => ({
    mode: "login",
    from,
    requiredProfile,
    message: LOGIN_REQUIRED_MESSAGE,
  });
  const openQuoteFlow = () => {
    if (!detailProductId || isClosedLot) return;
    trackLotContact(product || {});
    const quotePath = `/lots/${detailProductId}/quote`;
    if (!localStorage.getItem("accessToken")) {
      navigate("/profile", { state: buildLoginState(quotePath, "buyer") });
      return;
    }

    if (!hasBuyerProfile(user)) {
      navigate("/register-buyer", { state: { from: quotePath } });
      return;
    }

    if (!canQuote(user)) {
      navigate("/kyc", {
        state: {
          from: quotePath,
          roleType: "buyer",
          intent: "quote",
          message:
            "To keep eFruitMandi safe and trusted, KYC verification is required before placing an offer or deal. Please complete your KYC and wait for admin approval.",
        },
      });
      return;
    }

    navigate(quotePath);
  };
  const openRateGrowerFlow = () => {
    if (!detailProductId) return;
    const ratingPath = `/lots/${detailProductId}/rating`;
    if (!localStorage.getItem("accessToken")) {
      navigate("/profile", { state: buildLoginState(ratingPath, "buyer") });
      return;
    }

    if (!hasBuyerProfile(user)) {
      navigate("/register-buyer", { state: { from: ratingPath } });
      return;
    }

    navigate(ratingPath);
  };

  if (loading) {
    return (
      <>
        <SEO
          title="Fresh Fruit Lot Details | eFruitMandi"
          description="View fresh fruit lot details, grade, packing, quantity and grower information on eFruitMandi."
          canonical={`/lots/${lotId || ""}`}
          noIndex
        />
        <div className="w-full max-w-full overflow-x-hidden pb-[calc(160px+env(safe-area-inset-bottom))]">
          <p className="py-3 text-sm font-semibold text-green-700">
            Loading lot...
          </p>
        </div>
      </>
    );
  }

  if (!product) {
    return (
      <>
        <SEO
          title="Lot Not Found | eFruitMandi"
          description="The requested eFruitMandi fruit lot could not be found or is no longer available."
          canonical={`/lots/${lotId || ""}`}
          noIndex
        />
        <div className="w-full max-w-full overflow-x-hidden pb-[calc(160px+env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mb-3 inline-flex items-center gap-2 rounded-full bg-gray-200 px-3 py-1 text-xs font-bold text-gray-700"
          >
            <FaArrowLeft />
            Back
          </button>
          <EmptyState text={errorMessage || "Lot not found"} />
        </div>
      </>
    );
  }

    const fruitName =
    product?.fruitName ||
    product?.name ||
    product?.title ||
    product?.category ||
    "Fresh Fruit";

  const variety =
    product?.variety ||
    product?.fruitVariety ||
    product?.grade ||
    "";

  const district =
    product?.district ||
    product?.location?.district ||
    createdBy?.district ||
    "";

  const state =
    product?.state ||
    product?.location?.state ||
    createdBy?.state ||
    "India";

  const lotTitleParts = [variety, fruitName].filter(Boolean).join(" ");
  const seoLocation = [district, state].filter(Boolean).join(", ");

  const seoTitle = `${lotTitleParts} Lot in ${seoLocation} | eFruitMandi`;

  const seoDescription = `Buy fresh ${lotTitleParts} directly from verified growers in ${seoLocation}. View quantity, grade, packing, harvest date and logistics details on eFruitMandi.`;

  const seoImage = activeImage || images?.[0] || "/og-efruitmandi.jpg";

  const productSchema = buildProductSchema({
    name: lotTitleParts,
    description: seoDescription,
    image: seoImage,
    brand: {
      "@type": "Brand",
      name: "eFruitMandi",
    },
    category: fruitName,
    areaServed: seoLocation,
    seller: {
      "@type": "Organization",
      name: growerName,
    },
    subjectOf: {
      "@type": "WebPage",
      publisher: publisherReference(),
    },
  });

  return (
  <>
    <SEO
      title={seoTitle}
      description={seoDescription}
      canonical={`/lots/${lotId}`}
      image={seoImage}
      type="product"
      schema={productSchema}
    />

    <div className="w-full max-w-full overflow-x-hidden pb-[calc(160px+env(safe-area-inset-bottom))]">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-3 inline-flex items-center gap-2 rounded-full bg-gray-200 px-3 py-1 text-xs font-bold text-gray-700"
      >
        <FaArrowLeft />
        Back
      </button>

      <section className="gallery-section section w-full max-w-full rounded-md border border-gray-200 bg-white p-2">
        <div className={`relative flex w-full max-w-full items-center justify-center overflow-hidden rounded-md bg-white ${
          hasActiveImage
            ? "h-[58vh] max-h-[680px] min-h-[240px] md:h-[70vh] md:min-h-[320px]"
            : "min-h-[150px] py-6"
        }`}>
          {activeImage ? (
            <button
              type="button"
              onClick={() => {
                setImageZoom(1);
                setImagePreviewOpen(true);
              }}
              className="flex h-full w-full max-w-full items-center justify-center"
              aria-label="Open image preview"
            >
              <span className="relative inline-flex max-h-full max-w-full min-w-0">
                <img
                  src={getOptimizedAssetUrl(activeImage, 900)}
                  alt={product.title || "Fruit Lot"}
                  width="900"
                  height="675"
                  onError={() => setActiveImage(images.find((image) => toAssetUrl(image) !== toAssetUrl(activeImage)) || "")}
                  className="h-auto max-h-full w-full max-w-full object-contain object-center"
                  decoding="async"
                />
                {activeGradeLabel && <FruitGradeBadge label={activeGradeLabel} />}
              </span>
            </button>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 text-green-700">
              <FaSeedling className="text-3xl" />
              <p className="text-xs font-extrabold text-green-900">Lot media not available</p>
            </div>
          )}
        </div>

        {images.length > 1 && (
          <div className="mt-2 flex w-full max-w-full gap-2 overflow-x-auto pb-1 no-scrollbar">
            {images.map((image) => (
              <button
                key={getAssetKey(image)}
                type="button"
                onClick={() => setActiveImage(image)}
                className={`h-14 w-16 max-w-[4rem] shrink-0 overflow-hidden rounded border ${
                  activeImage === image ? "border-green-700" : "border-gray-200"
                }`}
              >
                <img
  src={getOptimizedAssetUrl(image, 160)}
  alt="Fruit lot image"
  width="96"
  height="80"
  onError={(event) => {
    event.currentTarget.style.display = "none";
  }}
  className="h-full w-full max-w-full object-contain"
  loading="lazy"
  decoding="async"
/>
              </button>
            ))}
          </div>
        )}
        <div className="mt-3 grid w-full max-w-full gap-2 rounded-md bg-green-50 px-3 py-3 text-xs sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="min-w-0">
            <p className="font-extrabold text-gray-950">{growerName}</p>
            <p className="mt-1 flex flex-wrap items-center gap-2 font-bold text-gray-600">
              <span className="inline-flex items-center gap-1 text-amber-600">
                <FaStar />
                {growerRating ? `${growerRating.toFixed(1)} (${growerRatingCount})` : "No rating yet"}
              </span>
              <span>{product.location || "Fruit Mandi"}</span>
            </p>
          </div>
          <div className="flex min-w-0 flex-wrap gap-2">
            <button
              type="button"
              onClick={openRateGrowerFlow}
              className="rounded-full bg-white px-3 py-2 text-[11px] font-extrabold text-green-800 ring-1 ring-green-200"
            >
              Rate Grower
            </button>
            {isClosedLot ? (
              <span className="inline-flex items-center rounded-full bg-gray-900 px-3 py-2 text-[11px] font-extrabold text-white">
                Deal Closed
              </span>
            ) : (
              <button
                type="button"
                onClick={openQuoteFlow}
                className="rounded-full bg-green-700 px-3 py-2 text-[11px] font-extrabold text-white"
              >
               Offer Your Price
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="section mt-3 w-full max-w-full rounded-md border border-gray-200 bg-white p-3">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-base font-extrabold text-black">
              {product.title || "Fruit Lot"}
            </h1>
            <p className="mt-1 flex items-center gap-1 text-xs font-bold text-gray-600">
              <FaMapMarkerAlt className="text-green-700" />
              {product.location || "Fruit Mandi"}
            </p>
          </div>
          <span className={`shrink-0 rounded px-2 py-1 text-[9px] font-extrabold ${getStatusBadgeClass(isClosedLot)}`}>
            {isClosedLot ? "Deal Closed" : formatDealStatus(product.status)}
          </span>
        </div>
        {isOrganicCertified && (
          <div className="mt-3 rounded-md border border-green-200 bg-green-50 p-3">
            <div className="flex items-center gap-2 text-xs font-extrabold text-green-900">
              <FaCertificate />
              <span>Organic Certified</span>
            </div>
            {product.organicCertificationNo && (
              <p className="mt-1 text-[10px] font-bold text-green-800">
                Certificate No: {product.organicCertificationNo}
              </p>
            )}
            {product.organicCertificateUrl && (
              <a
                href={toAssetUrl(product.organicCertificateUrl)}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex rounded-full bg-green-700 px-3 py-1 text-[10px] font-extrabold text-white"
              >
                View Certificate
              </a>
            )}
          </div>
        )}

        {isClosedLot && (
          <ClosedDealSummary
            product={product}
            auction={auction}
            closedDeal={closedDeal}
            seller={closedSeller}
            buyer={closedBuyer}
            resolveImageUrl={(url) => getOptimizedAssetUrl(url, 160)}
          />
        )}

        <div className="mt-3 grid w-full max-w-full grid-cols-2 gap-2">
          <InfoTile label="Fruit" value={product.fruitName || product.title} />
          <InfoTile label="Variety" value={product.variety || "Not set"} />
          <InfoTile label="Quality" value={product.quality || "Not set"} />
          <InfoTile label="Lot No." value={product.lotNo || "Not set"} />
          <InfoTile label="Total boxes" value={product.quantity || 0} />
          <InfoTile label="Packing" value={product.packingType || "Not set"} />
          <InfoTile label="Total weight" value={formatWeight(product.totalWeightKg)} />
          <InfoTile label="Deal status" value={isClosedLot ? "Deal Closed" : formatDealStatus(auction?.status || "Not started")} />
          {canSeeBasePrice && (
            <InfoTile label="Base price" value={`Rs. ${product.basePrice || 0}`} />
          )}
          <InfoTile
            label={isClosedLot ? "Closed at" : "Live at"}
            value={formatDate(isClosedLot ? getClosedDate(product, auction, closedDeal) : product.auctionStartTime || auction?.startTime)}
          />
        </div>

        {product.description && (
          <p className="mt-3 text-xs font-semibold leading-relaxed text-gray-700">
            {product.description}
          </p>
        )}
      </section>

      <AuctionPanel auction={auction} product={product} closedDeal={closedDeal} isClosed={isClosedLot} />
      <GradeLots lots={product.gradeLots || []} />
      <SampleVideo video={product.sampleVideo} />

      <div className="mt-3">
        <LimitedPublicProfileCard
          title="Grower / Seller Profile"
          profile={growerPublicProfile}
          emptyName="Grower"
          trustedLabel="OG Verified"
          resolveImageUrl={(url) => getOptimizedAssetUrl(url, 160)}
        />
      </div>
      {imagePreviewOpen && (
        <ImageZoomModal
          imageUrl={toAssetUrl(activeImage)}
          title={product.title || "Fruit Lot"}
          zoom={imageZoom}
          onZoomIn={() => setImageZoom((value) => Math.min(3, Number((value + 0.25).toFixed(2))))}
          onZoomOut={() => setImageZoom((value) => Math.max(0.5, Number((value - 0.25).toFixed(2))))}
          onReset={() => setImageZoom(1)}
          onClose={() => setImagePreviewOpen(false)}
        />
            )}
    </div>
  </>
);
}

function ClosedDealSummary({ product, auction, closedDeal, seller, buyer, resolveImageUrl }) {
  const closedRate = getClosedRate(product, auction, closedDeal);
  const finalValue = getFinalDealValue(product, auction, closedDeal);
  const closedAt = getClosedDate(product, auction, closedDeal);
  const grade = getClosedGrade(product, auction, closedDeal);

  return (
    <div className="mt-3 rounded-md border border-gray-200 bg-gray-50 p-3">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <span className="rounded bg-gray-900 px-2.5 py-1 text-[10px] font-extrabold uppercase text-white">
          Deal Closed
        </span>
        <span className="text-[10px] font-bold text-gray-600">
          {formatDate(closedAt)}
        </span>
      </div>

      <div className="mt-3 grid w-full max-w-full grid-cols-2 gap-2">
        <InfoTile label="Closed Rate" value={formatMoney(closedRate)} />
        <InfoTile label="Final Value" value={formatMoney(finalValue)} />
        <InfoTile label="Fruit" value={product?.fruitName || product?.title || "Fruit Lot"} />
        <InfoTile label="Grade" value={grade || product?.quality || "Not set"} />
        <InfoTile label="Quantity" value={`${product?.quantity || 0} boxes`} />
        <InfoTile label="Location" value={product?.location || "Fruit Mandi"} />
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <ClosedPartyCard
          label="Sold by"
          profile={seller}
          fallbackName="Grower"
          businessType="grower"
          resolveImageUrl={resolveImageUrl}
        />
        <ClosedPartyCard
          label="Purchased by"
          profile={buyer}
          fallbackName="Buyer"
          businessType="buyer"
          resolveImageUrl={resolveImageUrl}
        />
      </div>
    </div>
  );
}

function ClosedPartyCard({ label, profile, fallbackName, businessType, resolveImageUrl }) {
  const safeProfile = getSafePublicProfile(profile, {
    businessType,
    companyName: fallbackName,
  });
  const displayName = safeProfile.companyName || safeProfile.name || fallbackName;
  const logoUrl = safeProfile.logoUrl && resolveImageUrl
    ? resolveImageUrl(safeProfile.logoUrl)
    : safeProfile.logoUrl;

  return (
    <div className="min-w-0 rounded-md bg-white p-3 ring-1 ring-gray-200">
      <p className="text-[9px] font-extrabold uppercase text-gray-500">{label}</p>
      <div className="mt-2 flex min-w-0 items-center gap-2">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={`${displayName} logo`}
            width="40"
            height="40"
            className="h-10 w-10 shrink-0 rounded-md object-cover ring-1 ring-green-100"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-green-50 text-sm font-black text-green-800 ring-1 ring-green-100">
            {displayName.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-xs font-extrabold text-gray-950">{displayName}</p>
          <p className="truncate text-[10px] font-bold text-gray-600">
            {safeProfile.mainLocation || "City not available"}
          </p>
        </div>
      </div>
    </div>
  );
}

function ImageZoomModal({ imageUrl, title, zoom, onZoomIn, onZoomOut, onReset, onClose }) {
  return (
    <div className="fixed inset-0 z-[1000] flex max-w-full flex-col overflow-x-hidden bg-black/90 p-3">
      <div className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-extrabold text-white">{title}</p>
        <div className="flex shrink-0 items-center gap-1.5">
          <button type="button" onClick={onZoomOut} className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-gray-900" aria-label="Zoom out">
            <FaSearchMinus />
          </button>
          <button type="button" onClick={onReset} className="rounded-full bg-white px-3 py-2 text-xs font-extrabold text-gray-900">
            {Math.round(zoom * 100)}%
          </button>
          <button type="button" onClick={onZoomIn} className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-gray-900" aria-label="Zoom in">
            <FaSearchPlus />
          </button>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-gray-900" aria-label="Close image preview">
            <FaTimes />
          </button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto rounded-md bg-black">
        <img
          src={optimizeImageUrl(imageUrl, 1200)}
          alt={title}
          width="1200"
          height="900"
          className="max-h-full max-w-full object-contain transition-transform"
          style={{ transform: `scale(${zoom})` }}
          decoding="async"
        />
      </div>
    </div>
  );
}

function FruitGradeBadge({ label }) {
  return (
    <span className="absolute left-3 top-3 rounded bg-green-800 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-white shadow">
      {label}
    </span>
  );
}

function AuctionPanel({ auction, product, closedDeal, isClosed }) {
  if (!auction) {
    return (
    <section className="section mt-3 w-full max-w-full rounded-md border border-green-100 bg-green-50 p-3">
        <h2 className="text-xs font-extrabold text-green-900">Deal Details</h2>
        <p className="mt-1 text-xs font-bold text-green-800">
          This lot is listed, but deal details are not confirmed yet.
        </p>
      </section>
    );
  }

  return (
    <section className="section mt-3 w-full max-w-full rounded-md border border-gray-200 bg-white p-3">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <h2 className="text-xs font-extrabold text-black">Deal Details</h2>
        <span className={`rounded px-2 py-1 text-[9px] font-extrabold ${getStatusBadgeClass(isClosed)}`}>
          {isClosed ? "Deal Closed" : formatDealStatus(auction.status)}
        </span>
      </div>

      <div className="mt-2 grid w-full max-w-full grid-cols-2 gap-2">
        <InfoTile
          label={isClosed ? "Closed Rate" : "Current deal price"}
          value={formatMoney(isClosed ? getClosedRate(product, auction, closedDeal) : auction.currentBid)}
        />
        {auction.startingPrice !== undefined && (
          <InfoTile label="Starting price" value={`Rs. ${auction.startingPrice || 0}`} />
        )}
        <InfoTile label="Start time" value={formatDate(auction.startTime)} />
        <InfoTile label="End time" value={formatDate(auction.endTime)} />
      </div>

      {!isClosed && auction.status === "ACTIVE" && auction.endTime && (
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
    <section className="gallery-section section mt-3 w-full max-w-full rounded-md border border-gray-200 bg-white p-3">
      <h2 className="mb-2 text-xs font-extrabold text-black">
        Grade-wise Lot Samples
      </h2>
      <div className="space-y-3">
        {lots.map((lot) => (
          <div key={lot.grade} className="w-full max-w-full rounded-md bg-gray-50 p-2">
            <div className="mb-2 flex min-w-0 items-center justify-between gap-2">
              <span className="min-w-0 truncate text-xs font-extrabold text-black">
                Grade {lot.grade}
              </span>
              <span className="shrink-0 rounded bg-white px-2 py-1 text-[9px] font-extrabold text-gray-700">
                {lot.boxes || 0} boxes | {formatWeight(lot.weightKg)}
              </span>
            </div>
            {getLotImages(lot).length ? (
              <div className="flex w-full max-w-full gap-2 overflow-x-auto pb-1 no-scrollbar">
                {getLotImages(lot).map((image) => (
                  <img
                    key={getAssetKey(image)}
                    src={getOptimizedAssetUrl(image, 180)}
                    alt={`${lot.grade || "Grade"} fruit sample`}
                    width="96"
                    height="80"
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                    className="h-20 w-24 max-w-[6rem] shrink-0 rounded bg-white object-cover"
                    loading="lazy"
                    decoding="async"
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
    <section className="video-section section mt-3 w-full max-w-full rounded-md border border-gray-200 bg-white p-3">
      <h2 className="mb-2 flex items-center gap-2 text-xs font-extrabold text-black">
        <FaVideo className="text-green-700" />
        Sample Lot Video
      </h2>
      <div className="aspect-video w-full max-w-full overflow-hidden rounded-md bg-black">
        <video
          src={toAssetUrl(video)}
          controls
          className="block h-full w-full max-w-full bg-black object-contain"
        />
      </div>
    </section>
  );
}

function InfoTile({ label, value }) {
  return (
    <div className="min-w-0 rounded-md bg-green-50 px-3 py-2">
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

function getAssetUrlValue(asset) {
  if (!asset) return "";
  if (typeof asset === "string") return asset;
  if (typeof asset === "object") {
    return asset.url || asset.secure_url || asset.path || asset.src || "";
  }
  return String(asset || "");
}

function getAssetKey(asset) {
  return getAssetUrlValue(asset) || JSON.stringify(asset);
}

function getLotImages(lot = {}) {
  const images = Array.isArray(lot.images) ? lot.images : [];
  const objectImages = Array.isArray(lot.imageObjects)
    ? lot.imageObjects.map((image) => image?.url || image?.secure_url || image?.path || "")
    : [];
  return Array.from(new Set([...images, ...objectImages].map(getAssetUrlValue).filter(Boolean)));
}

function getAllImages(product) {
  if (!product) return [];

  const topImages = Array.isArray(product.images) ? product.images : [];
  const topImageObjects = Array.isArray(product.imageObjects)
    ? product.imageObjects.map((image) => image?.url || image?.secure_url || image?.path || "")
    : [];
  const gradeImages = Array.isArray(product.gradeLots)
    ? product.gradeLots.flatMap((lot) => getLotImages(lot))
    : [];

  return Array.from(new Set([...topImages, ...topImageObjects, ...gradeImages].map(getAssetUrlValue).filter(Boolean)));
}

function toAssetUrl(path) {
  const rawPath = getAssetUrlValue(path);
  const normalizedPath = rawPath ? rawPath.replace(/\\/g, "/") : "";
  if (/^https?:\/\//i.test(normalizedPath)) return normalizedPath;
  return normalizedPath ? `${FILE_BASE_URL}/${normalizedPath}` : "";
}

function optimizeImageUrl(url = "", width = 720) {
  if (!url || !url.includes("res.cloudinary.com") || !url.includes("/image/upload/")) {
    return url;
  }
  if (/\/image\/upload\/[^/]*(?:f_auto|q_auto|w_)/.test(url)) {
    return url;
  }
  return url.replace("/image/upload/", `/image/upload/f_auto,q_auto,dpr_auto,c_limit,w_${width}/`);
}

function getOptimizedAssetUrl(path, width) {
  return optimizeImageUrl(toAssetUrl(path), width);
}

function getImageGradeLabel(product = {}, imageUrl = "") {
  if (!imageUrl) return "";
  const normalizedActive = toAssetUrl(imageUrl);
  const gradeLot = Array.isArray(product.gradeLots)
    ? product.gradeLots.find((lot) =>
        getLotImages(lot).some((image) => toAssetUrl(image) === normalizedActive)
      )
    : null;
  const grade = gradeLot?.grade || product.grade || "";
  return grade ? `Grade ${grade}` : "";
}

function isOrganicCertifiedProduct(product = {}) {
  product = product || {};
  const quality = String(product.quality || "").toLowerCase();
  return (
    quality.includes("certified organic") ||
    Boolean(product.organicCertificationNo || product.organicCertificateUrl)
  );
}

function isClosedLotStatus(product = {}, auction = {}, closedDeal = null) {
  if (closedDeal) return true;
  return isClosedDeal(product) || isClosedDeal(auction);
}

function getStatusBadgeClass(isClosed) {
  return isClosed ? "bg-gray-900 text-white" : "bg-green-100 text-green-800";
}

function firstNumber(...values) {
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue;
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return undefined;
}

function getClosedRate(product = {}, auction = {}, closedDeal = {}) {
  return firstNumber(
    closedDeal?.closedRate,
    auction?.highestGradeRate,
    closedDeal?.finalDealValue,
    product?.finalPrice,
    product?.finalDealValue,
    auction?.currentBid
  );
}

function getFinalDealValue(product = {}, auction = {}, closedDeal = {}) {
  return firstNumber(
    closedDeal?.finalDealValue,
    product?.finalDealValue,
    product?.finalPrice,
    auction?.dealBreakdown?.dealAmount,
    auction?.currentBid,
    closedDeal?.closedRate
  );
}

function getClosedDate(product = {}, auction = {}, closedDeal = {}) {
  return (
    closedDeal?.closedAt ||
    auction?.updatedAt ||
    auction?.endTime ||
    product?.updatedAt ||
    product?.createdAt ||
    ""
  );
}

function getClosedGrade(product = {}, auction = {}, closedDeal = {}) {
  return (
    closedDeal?.grade ||
    auction?.highestGrade ||
    product?.grade ||
    product?.gradeLots?.find((lot) => lot?.grade)?.grade ||
    ""
  );
}

function formatMoney(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "Not set";
  return `Rs. ${number.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: number % 1 ? 2 : 0,
  })}`;
}

function formatDate(value) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
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

function formatDealStatus(status = "") {
  const normalized = String(status || "").trim().toUpperCase();
  const labels = {
    IN_AUCTION: "Deal Open",
    ACTIVE: "Deal Open",
    AVAILABLE: "Available",
    SCHEDULED: "Upcoming Deal",
    UPCOMING: "Upcoming Deal",
    EXPIRED: "Deal Ended",
    CANCELLED: "Cancelled",
    DELETED: "Removed",
    "NOT STARTED": "Not started",
  };
  return labels[normalized] || String(status || "Available").replace(/_/g, " ");
}

