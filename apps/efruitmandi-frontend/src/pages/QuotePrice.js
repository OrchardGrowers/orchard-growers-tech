import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaCalculator, FaMapMarkerAlt, FaSeedling, FaVideo } from "react-icons/fa";
import API, { FILE_BASE_URL } from "../services/api";
import BackHomeButton from "../components/BackHomeButton";
import { canQuote, getCurrentUser, getKycStatusLabel, hasBuyerProfile } from "../utils/auth";
import { saveUserToStorage } from "../utils/userStorage";

export default function QuotePrice() {
  const { lotId } = useParams();
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [profileUser, setProfileUser] = useState(user);
  const isBuyer = hasBuyerProfile(profileUser);
  const isKycApproved = canQuote(profileUser);
  const kycStatusLabel = getKycStatusLabel(profileUser);
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(null);
  const [gradePrices, setGradePrices] = useState({});
  const [distanceKm, setDistanceKm] = useState("");
  const [autoDistanceKm, setAutoDistanceKm] = useState(null);
  const [quotation, setQuotation] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const loadLot = async () => {
      try {
        if (!localStorage.getItem("accessToken")) {
          navigate("/profile", { state: { mode: "login", from: `/lots/${lotId}/quote` } });
          return;
        }

        const [lotRes, profileRes] = await Promise.all([
          API.get(`/products/${lotId}?platform=efruitmandi`),
          API.get("/user/profile").catch(() => ({ data: user })),
        ]);
        const freshUser = profileRes.data || user;
        setProfileUser(freshUser);
        saveUserToStorage(freshUser);
        const lot = lotRes.data?.product || null;
        setProduct(lot);
        setActiveImage(getLotImages(lot)[0] || null);
        setAutoDistanceKm(calculateDistanceKm(lot?.createdBy, freshUser));
        setGradePrices(
          getAvailableGradeLots(lot).reduce((prices, lotGrade) => {
            prices[lotGrade.grade] = "";
            return prices;
          }, {})
        );
      } catch {
        setProduct(null);
      } finally {
        setLoading(false);
      }
    };

    loadLot();
  }, [lotId]);

  const images = useMemo(() => getLotImages(product), [product]);
  const availableGrades = useMemo(() => getAvailableGradeLots(product), [product]);
  const quoteUnit = getQuoteUnit(product);
  const isOwnLot = useMemo(() => isOwnListedLot(product, profileUser), [product, profileUser]);
  const preview = useMemo(
    () => calculateBuyerPreview(availableGrades, gradePrices, autoDistanceKm ?? distanceKm),
    [availableGrades, gradePrices, autoDistanceKm, distanceKm]
  );
  const effectiveDistanceKm = autoDistanceKm ?? distanceKm;

  const updateGradePrice = (grade, value) => {
    setQuotation(null);
    setGradePrices((current) => ({ ...current, [grade]: value }));
  };

  const submitQuote = async (event) => {
    event.preventDefault();
    if (isOwnLot) {
      setMessage("You cannot quote on your own listed lot.");
      return;
    }

    const missingGrade = availableGrades.find((gradeLot) => Number(gradePrices[gradeLot.grade] || 0) <= 0);
    if (missingGrade) {
      setMessage(`Enter a price greater than 0 for Grade ${missingGrade.grade}.`);
      return;
    }

    try {
      setSaving(true);
      setMessage("");
      const res = await API.post("/quotes", {
        lotId,
        grades: availableGrades.map((gradeLot) => ({
          grade: gradeLot.grade,
          price: Number(gradePrices[gradeLot.grade] || 0),
        })),
        quotedPrice: Number(Object.values(gradePrices).find((value) => Number(value || 0) > 0) || 0),
        distanceKm: effectiveDistanceKm,
      });
      setQuotation(res.data?.quotation || null);
      setMessage("Quote submitted successfully.");
    } catch (err) {
      setMessage(err.response?.data?.message || err.response?.data?.msg || "Quote could not be submitted.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-full overflow-x-hidden pb-[calc(160px+env(safe-area-inset-bottom))] md:max-w-6xl md:pb-20">
      <section className="section w-full max-w-full rounded-md border border-gray-200 bg-white p-3 md:p-4">
        <p className="text-xs font-extrabold uppercase tracking-wide text-green-700">Quote Your Price</p>
        <div className="mt-1 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
          <div className="min-w-0">
            <h1 className="text-lg font-extrabold leading-tight text-gray-950 md:text-xl">
              {loading ? "Loading lot..." : product?.title || "Fruit Lot"}
            </h1>
            <p className="mt-2 flex items-center gap-2 text-sm font-bold text-gray-600">
              <FaMapMarkerAlt className="text-green-700" />
              {product?.location || "Fruit Mandi"}
            </p>
          </div>
          <GrowerIdentity product={product} />
        </div>
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
      ) : !isKycApproved ? (
        <section className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-4">
          <h2 className="text-lg font-extrabold text-amber-950">Complete Your KYC to Quote Your Price</h2>
          <p className="mt-2 text-sm font-bold leading-6 text-amber-800">
            To keep eFruitMandi safe and trusted, KYC verification is required before placing a quote or deal. Please complete your KYC and wait for admin approval.
          </p>
          <p className="mt-2 rounded-md bg-white px-3 py-2 text-sm font-extrabold text-amber-900">
            Current KYC status: {kycStatusLabel}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate("/kyc", { state: { from: `/lots/${lotId}/quote`, roleType: "buyer", intent: "quote" } })}
              className="rounded-full bg-green-700 px-5 py-2 text-sm font-extrabold text-white hover:bg-green-800"
            >
              Complete KYC
            </button>
            <button
              type="button"
              onClick={() => navigate(`/lots/${lotId}`)}
              className="rounded-full bg-white px-5 py-2 text-sm font-extrabold text-amber-800 ring-1 ring-amber-200 hover:bg-amber-100"
            >
              View Lot
            </button>
          </div>
        </section>
      ) : (
        <section className="mt-3 grid w-full max-w-full gap-3 overflow-x-hidden lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-4">
          <LotMediaPanel
            product={product}
            images={images}
            activeImage={activeImage}
            onSelectImage={setActiveImage}
          />

          <form onSubmit={submitQuote} className="quote-panel min-w-0 rounded-md border border-gray-200 bg-white p-3 md:p-4 lg:sticky lg:top-20 lg:self-start">
            <div className="grid w-full max-w-full grid-cols-2 gap-2 lg:grid-cols-1">
              <InfoTile label="Available grades" value={`${availableGrades.length} grades`} />
              <InfoTile label="Packing" value={product?.packingType || "Not set"} />
              <InfoTile label="Variety" value={product?.variety || "Not set"} />
              <InfoTile label="Quality" value={product?.quality || "Not set"} />
            </div>

            <div className="mt-4 space-y-2.5">
              <p className="text-sm font-extrabold text-gray-800">Grade-wise prices</p>
              {availableGrades.map((gradeLot) => {
                const price = Number(gradePrices[gradeLot.grade] || 0);
                const amount = price * gradeLot.quantity;
                return (
                  <label key={gradeLot.grade} className="block w-full max-w-full rounded-md border border-gray-200 bg-white p-2.5 md:p-3">
                    <span className="flex items-start justify-between gap-2 text-sm font-extrabold leading-tight text-gray-800">
                      <span className="min-w-0">{gradeLot.grade} Grade Price <span className="whitespace-nowrap">(Rs. per {quoteUnit.singular})</span></span>
                      <span className="shrink-0 text-xs text-gray-500">
                        {gradeLot.quantity} {gradeLot.quantity === 1 ? quoteUnit.singular : quoteUnit.plural}
                      </span>
                    </span>
                    <input
                      value={gradePrices[gradeLot.grade] || ""}
                      inputMode="numeric"
                      type="number"
                      min="1"
                      onChange={(event) => updateGradePrice(gradeLot.grade, event.target.value)}
                      placeholder={`Enter ${gradeLot.grade} grade price`}
                      className="mt-2 w-full rounded-md border border-gray-200 px-3 py-2.5 text-sm font-bold outline-none focus:border-green-600 md:py-3"
                    />
                    <p className="mt-2 text-xs font-bold text-green-800">
                      Amount: Rs. {amount || 0}
                    </p>
                  </label>
                );
              })}
            </div>

            <div className="mt-3 w-full max-w-full rounded-md border border-green-100 bg-green-50 px-3 py-3 text-sm font-bold text-gray-700">
              <p className="text-gray-900">Delivery distance</p>
              {autoDistanceKm !== null ? (
                <>
                  <p className="mt-1 text-lg font-extrabold text-green-800">{autoDistanceKm} km</p>
                  <p className="mt-1 text-xs font-semibold text-green-700">
                    Auto-calculated from seller premises to buyer premises map points.
                  </p>
                </>
              ) : (
                <label className="mt-2 block">
                  <span className="text-xs font-semibold text-gray-500">
                    Add seller and buyer Google map points for automatic fare calculation. Use fallback only when map points are missing.
                  </span>
                  <input
                    value={distanceKm}
                    inputMode="decimal"
                    type="number"
                    min="0"
                    onChange={(event) => setDistanceKm(event.target.value)}
                    placeholder="Enter fallback distance in km"
                    className="mt-2 w-full rounded-md border border-gray-200 bg-white px-3 py-3 text-sm font-bold outline-none focus:border-green-600"
                  />
                </label>
              )}
            </div>

            <div className="mt-4 w-full max-w-full rounded-md bg-green-50 p-3 text-sm font-bold text-green-900">
              <div className="flex items-center gap-2">
                <FaCalculator />
                <span>Buyer quote preview</span>
              </div>
              <BuyerQuoteSummary breakdown={quotation || preview} />
            </div>

            {message && (
              <p className="mt-3 rounded-md bg-green-50 px-3 py-2 text-xs font-bold text-green-800">
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={saving || isOwnLot}
              className="mt-4 hidden w-full items-center justify-center gap-2 rounded-md bg-green-700 px-4 py-3 text-sm font-extrabold text-white md:inline-flex"
            >
              <FaSeedling />
              {saving ? "Submitting..." : "Submit Quote"}
            </button>
            <div className="mt-3 hidden justify-center md:flex">
              <BackHomeButton />
            </div>
            <MobileQuoteSubmitBar saving={saving} disabled={isOwnLot} preview={quotation || preview} onSubmit={submitQuote} />
          </form>
        </section>
      )}
    </div>
  );
}

function LotMediaPanel({ product, images, activeImage, onSelectImage }) {
  const gradeGroups = getGradeImageGroups(product);

  return (
    <section className="gallery-section section min-w-0 rounded-md border border-gray-200 bg-white p-2.5 md:p-3">
      <div className="mb-2 flex items-center justify-between gap-2 md:mb-3">
        <h2 className="text-sm font-extrabold text-gray-950">Lot media</h2>
        {activeImage?.gradeLabel && (
          <span className="rounded-full bg-green-100 px-2 py-1 text-[10px] font-extrabold text-green-800">
            Viewing {activeImage.gradeLabel}
          </span>
        )}
      </div>
      <div className="relative flex min-h-[220px] w-full max-w-full items-center justify-center overflow-hidden rounded-md bg-white md:min-h-[320px]">
        {activeImage ? (
          <span className="relative inline-flex max-h-[360px] max-w-full min-w-0 md:max-h-[560px]">
            <img
              src={activeImage.url}
              alt={product?.title || "Fruit Lot"}
              className="h-auto max-h-[360px] w-full max-w-full object-contain md:max-h-[560px]"
            />
            {activeImage?.gradeLabel && <FruitGradeBadge label={activeImage.gradeLabel} />}
          </span>
        ) : (
          <div className="flex h-48 w-full items-center justify-center rounded-md bg-green-50 text-4xl text-green-700 md:h-56">
            <FaSeedling />
          </div>
        )}
      </div>

      {gradeGroups.length > 0 ? (
        <div className="mt-3 space-y-3">
          {gradeGroups.map((group) => (
            <div key={group.grade} className="w-full max-w-full rounded-md border border-green-100 bg-green-50 p-2">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="rounded bg-green-800 px-2 py-1 text-[10px] font-extrabold uppercase text-white">
                  Grade {group.grade}
                </span>
                <span className="text-[10px] font-extrabold text-green-900">
                  {group.quantity} {group.quantity === 1 ? "crate" : "crates"}
                </span>
              </div>
              <div className="flex w-full max-w-full gap-2 overflow-x-auto pb-1 no-scrollbar">
                {group.images.map((image) => (
                  <button
                    key={image.url}
                    type="button"
                    onClick={() => onSelectImage(image)}
                    className={`relative h-16 w-20 max-w-[5rem] shrink-0 overflow-hidden rounded border bg-white md:h-20 md:w-24 md:max-w-[6rem] ${
                      activeImage?.url === image.url ? "border-green-700 ring-2 ring-green-200" : "border-gray-200"
                    }`}
                    aria-label={`View Grade ${group.grade} image`}
                  >
                    <img src={image.url} alt={`Grade ${group.grade}`} className="h-full w-full max-w-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : images.length > 1 ? (
        <div className="mt-2 flex w-full max-w-full gap-2 overflow-x-auto pb-1 no-scrollbar md:mt-3">
          {images.map((image) => (
            <button
              key={image.url}
              type="button"
              onClick={() => onSelectImage(image)}
              className={`relative h-14 w-16 max-w-[4rem] shrink-0 overflow-hidden rounded border bg-white md:h-16 md:w-20 md:max-w-[5rem] ${
                activeImage?.url === image.url ? "border-green-700" : "border-gray-200"
              }`}
            >
              <img src={image.url} alt="" className="h-full w-full max-w-full object-cover" />
              {image.gradeLabel && (
                <span className="absolute left-1 top-1 rounded bg-green-800 px-1.5 py-0.5 text-[8px] font-extrabold uppercase text-white shadow">
                  {image.gradeLabel}
                </span>
              )}
            </button>
          ))}
        </div>
      ) : null}

      {product?.sampleVideo && (
        <div className="video-section mt-3 w-full max-w-full md:mt-4">
          <h3 className="mb-2 flex items-center gap-2 text-xs font-extrabold text-gray-800">
            <FaVideo className="text-green-700" />
            Sample lot video
          </h3>
          <div className="aspect-video w-full max-w-full overflow-hidden rounded-md bg-black">
            <video src={toAssetUrl(product.sampleVideo)} controls className="block h-full w-full max-w-full bg-black object-contain" />
          </div>
        </div>
      )}
    </section>
  );
}

function GrowerIdentity({ product }) {
  const grower = product?.createdBy || {};
  const name = grower.orchardName || grower.businessName || grower.name || "Grower's Orchard";
  const logo = resolveProfileMediaUrl(grower.companyLogoUrl || grower.avatarUrl);

  if (!product) return null;

  return (
    <div className="flex w-full min-w-0 items-center gap-2 rounded-md bg-green-50 px-3 py-2 sm:w-auto sm:max-w-[240px] sm:shrink-0">
      {logo ? (
        <img src={logo} alt="" className="h-10 w-10 rounded bg-white object-contain ring-1 ring-green-100" />
      ) : (
        <span className="flex h-10 w-10 items-center justify-center rounded bg-green-800 text-xs font-extrabold text-white">
          {name.slice(0, 1).toUpperCase()}
        </span>
      )}
      <div className="min-w-0 text-left">
        <p className="text-[10px] font-extrabold uppercase tracking-wide text-green-700">Farm</p>
        <p className="truncate text-sm font-extrabold text-gray-950">{name}</p>
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

function InfoTile({ label, value }) {
  return (
    <div className="min-w-0 rounded-md bg-green-50 px-2.5 py-2 md:px-3">
      <p className="text-[10px] font-extrabold text-gray-500">{label}</p>
      <p className="mt-1 truncate text-xs font-extrabold text-gray-950">{value}</p>
    </div>
  );
}

function BuyerQuoteSummary({ breakdown = {} }) {
  const grades = breakdown.grades || [];

  return (
    <div className="mt-2 w-full max-w-full space-y-1.5 md:space-y-2">
      {grades.length > 0 && (
        <div className="space-y-1">
          {grades.map((grade) => (
            <div key={grade.grade} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded bg-white px-2 py-1 text-xs">
              <span className="min-w-0 truncate">
                Grade {grade.grade}: {grade.quantity} x Rs. {grade.price || 0}
              </span>
              <span className="font-extrabold">Rs. {grade.amount || 0}</span>
            </div>
          ))}
        </div>
      )}
      <SummaryRow label="Total deal amount" value={breakdown.dealAmount} />
      <SummaryRow label="Driver charge" value={breakdown.driverCharge} />
      <SummaryRow label="Commission" value={breakdown.commissionAmount} />
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-t border-green-200 pt-2 text-base font-extrabold">
        <span className="min-w-0 truncate">Final payable</span>
        <span className="shrink-0">Rs. {breakdown.buyerPayable || 0}</span>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-xs">
      <span className="min-w-0 truncate">{label}</span>
      <span className="font-extrabold">Rs. {value || 0}</span>
    </div>
  );
}

function MobileQuoteSubmitBar({ saving, disabled = false, preview = {}, onSubmit }) {
  return (
    <div className="fixed left-0 right-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-40 w-full max-w-[100vw] border-t border-green-100 bg-white/95 px-4 pb-[calc(10px+env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-8px_20px_rgba(0,0,0,0.08)] backdrop-blur md:hidden">
      <div className="flex w-full max-w-full items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-extrabold uppercase text-gray-500">Final payable</p>
          <p className="truncate text-base font-extrabold text-green-800">Rs. {preview.buyerPayable || 0}</p>
        </div>
        <button
          type="button"
          disabled={saving || disabled}
          onClick={onSubmit}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-green-700 px-4 py-2.5 text-sm font-extrabold text-white disabled:bg-gray-300"
        >
          <FaSeedling />
          {saving ? "Submitting..." : "Submit"}
        </button>
      </div>
    </div>
  );
}

function normalizeId(value) {
  if (!value) return "";
  return String(value._id || value.id || value.userId || value).trim();
}

function normalizePhone(value = "") {
  return String(value || "").replace(/\D/g, "");
}

function isOwnListedLot(product = {}, user = {}) {
  if (!product || !user) return false;
  const owner = product.createdBy || {};
  const userIds = new Set(
    [normalizeId(user._id), normalizeId(user.id), normalizeId(user.userId)].filter(Boolean)
  );
  const ownerIds = new Set(
    [
      normalizeId(owner),
      normalizeId(product.growerUserId),
      normalizeId(product.growerId),
      normalizeId(product.growerId?.userId),
      normalizeId(product.ownerId),
    ].filter(Boolean)
  );
  const sameId = [...userIds].some((id) => ownerIds.has(id));
  const userPhone = normalizePhone(user.phone);
  const ownerPhone = normalizePhone(owner.phone || product.growerPhone);

  return Boolean(sameId || (userPhone && ownerPhone && userPhone === ownerPhone));
}

function getLotImages(product) {
  if (!product) return [];
  const seen = new Set();
  const addImage = (image, grade = "") => {
    const url = toAssetUrl(image);
    if (!url || seen.has(url)) return null;
    seen.add(url);
    return {
      url,
      gradeLabel: grade ? `Grade ${grade}` : "",
    };
  };
  const hasGradeLots = Array.isArray(product.gradeLots) && product.gradeLots.some((lot) => (lot.images || []).length);
  const topImages = hasGradeLots ? [] : (Array.isArray(product.images) ? product.images : [])
    .map((image) => addImage(image, product.grade || ""))
    .filter(Boolean);
  const gradeImages = Array.isArray(product.gradeLots)
    ? product.gradeLots.flatMap((lot) =>
        (lot.images || []).map((image) => addImage(image, lot.grade || "")).filter(Boolean)
      )
    : [];
  return [...topImages, ...gradeImages];
}

function getGradeImageGroups(product) {
  if (!product || !Array.isArray(product.gradeLots)) return [];
  return product.gradeLots
    .map((lot) => ({
      grade: lot.grade,
      quantity: Number(lot.boxes || 0),
      images: (lot.images || [])
        .map((image) => ({
          url: toAssetUrl(image),
          gradeLabel: lot.grade ? `Grade ${lot.grade}` : "",
        }))
        .filter((image) => image.url),
    }))
    .filter((group) => group.grade && group.images.length);
}

function getAvailableGradeLots(product) {
  if (!product) return [];
  return (product.gradeLots || [])
    .map((lot) => ({
      grade: lot.grade,
      quantity: Number(lot.boxes || 0),
    }))
    .filter((lot) => lot.grade && lot.quantity > 0);
}

function toAssetUrl(path = "") {
  const normalized = String(path || "").replace(/\\/g, "/");
  if (/^https?:\/\//i.test(normalized)) return normalized;
  return normalized ? `${FILE_BASE_URL}/${normalized}` : "";
}

function resolveProfileMediaUrl(value = "") {
  const url = String(value || "").trim();
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  const cleanPath = url.replace(/^\/+/, "");
  if (cleanPath.startsWith("uploads/")) return `${FILE_BASE_URL}/${cleanPath}`;
  return url.startsWith("/") ? url : `/${url}`;
}

function getMapPoint(entity = {}) {
  const latitude = Number(entity?.mapLatitude);
  const longitude = Number(entity?.mapLongitude);
  if (![latitude, longitude].every(Number.isFinite)) return null;
  return { latitude, longitude };
}

function toRadians(value) {
  return (Number(value) * Math.PI) / 180;
}

function calculateDistanceKm(from = {}, to = {}) {
  const sellerPoint = getMapPoint(from);
  const buyerPoint = getMapPoint(to);
  if (!sellerPoint || !buyerPoint) return null;

  const earthRadiusKm = 6371;
  const dLat = toRadians(buyerPoint.latitude - sellerPoint.latitude);
  const dLon = toRadians(buyerPoint.longitude - sellerPoint.longitude);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(sellerPoint.latitude)) *
      Math.cos(toRadians(buyerPoint.latitude)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(earthRadiusKm * c * 10) / 10;
}

function getQuoteUnit(product = {}) {
  product = product || {};
  const packing = String(product.packingType || "").toLowerCase();
  if (packing.includes("crate")) {
    return { singular: "crate", plural: "crates" };
  }

  return { singular: "box", plural: "boxes" };
}

function calculateDriverCharge(distanceKm = 0) {
  const distance = Number(distanceKm || 0);
  if (!Number.isFinite(distance) || distance <= 0) return 0;
  const slabs = [
    { min: 1, max: 5, amount: 300 },
    { min: 6, max: 10, amount: 800 },
    { min: 11, max: 20, amount: 1200 },
    { min: 21, max: 25, amount: 1500 },
    { min: 26, max: 30, amount: 2000 },
    { min: 31, max: 40, amount: 2500 },
    { min: 41, max: 70, amount: 3000 },
    { min: 71, max: 85, amount: 3500 },
    { min: 86, max: 100, amount: 4000 },
    { min: 101, max: 200, perKm: 40 },
    { min: 201, max: 300, perKm: 35 },
    { min: 301, max: 400, perKm: 30 },
    { min: 401, max: Infinity, perKm: 25 },
  ];
  const slab = slabs.find((item) => distance >= item.min && distance <= item.max);
  if (!slab) return 0;
  return slab.amount ?? Math.round(distance * slab.perKm);
}

function calculateBuyerPreview(availableGrades, gradePrices, distanceKm) {
  const grades = availableGrades.map((gradeLot) => {
    const price = Number(gradePrices[gradeLot.grade] || 0);
    return {
      grade: gradeLot.grade,
      quantity: gradeLot.quantity,
      price,
      amount: Math.round(gradeLot.quantity * price),
    };
  });
  const dealAmount = grades.reduce((sum, grade) => sum + Number(grade.amount || 0), 0);
  const driverCharge = calculateDriverCharge(distanceKm);
  const commissionBase = dealAmount + driverCharge;
  const commissionAmount = Math.round(commissionBase * 0.05);
  return {
    grades,
    dealAmount,
    driverCharge,
    commissionAmount,
    buyerPayable: dealAmount + driverCharge + commissionAmount,
  };
}
