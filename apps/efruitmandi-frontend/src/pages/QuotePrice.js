import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaCalculator, FaDownload, FaFileAlt, FaMapMarkerAlt, FaSeedling, FaVideo } from "react-icons/fa";
import API, { FILE_BASE_URL } from "../services/api";
import { trackDealCreated } from "../services/analytics";
import BackHomeButton from "../components/BackHomeButton";
import { canQuote, getCurrentUser, getKycStatusLabel, hasBuyerProfile } from "../utils/auth";
import { saveUserToStorage } from "../utils/userStorage";
import { canDownloadCompletedFruitScanningReport } from "../utils/fruitScanningReport";

const LOGIN_REQUIRED_MESSAGE = "Please login or Sign up first to continue.";
const DISTANCE_PENDING_MESSAGE = "Delivery distance will be calculated after buyer and grower business locations are available.";

export default function QuotePrice() {
  const { lotId } = useParams();
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [profileUser, setProfileUser] = useState(user);
  const isBuyer = hasBuyerProfile(profileUser);
  const isKycApproved = canQuote(profileUser);
  const kycStatusLabel = getKycStatusLabel(profileUser);
  const [product, setProduct] = useState(null);
  const [fruitScanningReport, setFruitScanningReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(null);
  const [gradePrices, setGradePrices] = useState({});
  const [autoDistanceKm, setAutoDistanceKm] = useState(null);
  const [otherBuyerOffers, setOtherBuyerOffers] = useState([]);
  const [quotation, setQuotation] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [reportDownloading, setReportDownloading] = useState(false);

  useEffect(() => {
    const loadLot = async () => {
      try {
        if (!localStorage.getItem("accessToken")) {
          navigate("/profile", {
            state: {
              mode: "login",
              from: `/lots/${lotId}/quote`,
              requiredProfile: "buyer",
              message: LOGIN_REQUIRED_MESSAGE,
            },
          });
          return;
        }

        const [lotRes, profileRes, offersRes] = await Promise.all([
          API.get(`/products/${lotId}?platform=efruitmandi&devPublicMarketplace=1`),
          API.get("/user/profile").catch(() => ({ data: user })),
          API.get(`/quotes/lots/${lotId}`).catch(() => ({ data: { quotations: [] } })),
        ]);
        const freshUser = profileRes.data || user;
        setProfileUser(freshUser);
        saveUserToStorage(freshUser);
        const lot = lotRes.data?.product || null;
        setProduct(lot);
        setFruitScanningReport(lotRes.data?.fruitScanningReport || null);
        setOtherBuyerOffers(Array.isArray(offersRes.data?.quotations) ? offersRes.data.quotations : []);
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
  const canUseAutoDistance = autoDistanceKm !== null;
  const preview = useMemo(
    () => calculateBuyerPreview(availableGrades, gradePrices),
    [availableGrades, gradePrices]
  );

  const downloadScanningReport = async () => {
    if (!canDownloadCompletedFruitScanningReport(fruitScanningReport) || reportDownloading) return;
    try {
      setReportDownloading(true);
      const response = await API.get(`/products/${lotId}/pdf?platform=efruitmandi`, {
        responseType: "blob",
      });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `eFruitMandi-lot-${product?.lotNo || lotId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setMessage("Fruit scanning report PDF could not be downloaded.");
    } finally {
      setReportDownloading(false);
    }
  };

  const updateGradePrice = (grade, value) => {
    setQuotation(null);
    setGradePrices((current) => ({ ...current, [grade]: value }));
  };

  const submitQuote = async (event) => {
    event.preventDefault();
    if (isOwnLot) {
      setMessage("You cannot make an offer on your own listed lot.");
      return;
    }

    const missingGrade = availableGrades.find((gradeLot) => Number(gradePrices[gradeLot.grade] || 0) <= 0);
    if (missingGrade) {
      setMessage(`Enter a price greater than 0 for Grade ${missingGrade.grade}.`);
      return;
    }

    if (!canUseAutoDistance) {
      setMessage(DISTANCE_PENDING_MESSAGE);
      return;
    }

    try {
      setSaving(true);
      setMessage("");
      const res = await API.post(`/quotes/lots/${lotId}`, {
        grades: availableGrades.map((gradeLot) => ({
          grade: gradeLot.grade,
          price: Number(gradePrices[gradeLot.grade] || 0),
        })),
        quotedPrice: Number(Object.values(gradePrices).find((value) => Number(value || 0) > 0) || 0),
      });
      setQuotation(res.data?.quotation || null);
      trackDealCreated({
        _id: res.data?.quotation?._id || res.data?.quotation?.id || "",
        lotId,
        fruitName: product?.fruitName || product?.title || "",
        category: product?.category || product?.fruitName || "",
        value: Number(res.data?.quotation?.quotedPrice || 0),
      });
      setMessage("Offer submitted successfully.");
    } catch (err) {
      setMessage(err.response?.data?.message || err.response?.data?.msg || "Offer could not be submitted.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-full overflow-x-hidden pb-[calc(160px+env(safe-area-inset-bottom))] md:max-w-6xl md:pb-20">
      <section className="section w-full max-w-full rounded-md border border-gray-200 bg-white p-3 md:p-4">
        <p className="text-xs font-extrabold uppercase tracking-wide text-green-700">Offer Your Price</p>
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
            Only registered fruit buyers can offer prices for grower lots. Create or update your buyer profile, then return to this lot.
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
          <h2 className="text-lg font-extrabold text-amber-950">Complete Your KYC to Offer Your Price</h2>
          <p className="mt-2 text-sm font-bold leading-6 text-amber-800">
            To keep eFruitMandi safe and trusted, KYC verification is required before placing an offer or deal. Please complete your KYC and wait for admin approval.
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
        <section className="mt-3 grid w-full max-w-full gap-3 overflow-x-hidden lg:grid-cols-[280px_minmax(0,1fr)_420px] lg:gap-4">
          <OtherBuyerOffersColumn offers={otherBuyerOffers} />

          <div className="min-w-0 space-y-3">
            <LotMediaPanel
              product={product}
              images={images}
              activeImage={activeImage}
              onSelectImage={setActiveImage}
            />
            <BuyerScanningReportPanel
              report={fruitScanningReport}
              downloading={reportDownloading}
              onView={() => navigate(`/lots/${lotId}#fruit-scanning-report`)}
              onDownload={downloadScanningReport}
            />
          </div>

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
                <p className="mt-1 rounded bg-white px-3 py-2 text-xs font-semibold text-green-800">
                  {DISTANCE_PENDING_MESSAGE}
                </p>
              )}
            </div>

            <div className="mt-4 w-full max-w-full rounded-md bg-green-50 p-3 text-sm font-bold text-green-900">
              <div className="flex items-center gap-2">
                <FaCalculator />
                <span>Buyer offer preview</span>
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
              disabled={saving || isOwnLot || !canUseAutoDistance}
              className="mt-4 hidden w-full items-center justify-center gap-2 rounded-md bg-green-700 px-4 py-3 text-sm font-extrabold text-white md:inline-flex"
            >
              <FaSeedling />
              {saving ? "Submitting..." : "Submit Offer"}
            </button>
            <div className="mt-3 hidden justify-center md:flex">
              <BackHomeButton />
            </div>
            <MobileQuoteSubmitBar saving={saving} disabled={isOwnLot || !canUseAutoDistance} preview={quotation || preview} onSubmit={submitQuote} />
          </form>
        </section>
      )}
    </div>
  );
}

function BuyerScanningReportPanel({ report, downloading, onView, onDownload }) {
  const status = String(report?.status || "NOT_AVAILABLE").toUpperCase();
  const downloadAvailable = canDownloadCompletedFruitScanningReport(report);
  const statusMessage = {
    COMPLETED: "The completed lot-wide visual quality report is available before you submit an offer.",
    PENDING: "Fruit scanning report is being prepared.",
    PROCESSING: "Fruit scanning report is being prepared.",
    REVIEW_REQUIRED: "Fruit scanning report requires review.",
    FAILED: "Fruit scanning report is currently unavailable because analysis failed.",
    NOT_AVAILABLE: "Fruit scanning report not available for this lot.",
  }[status] || "Fruit scanning report not available for this lot.";

  return (
    <section className="rounded-md border border-green-200 bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-extrabold text-gray-950">
            <FaFileAlt className="text-green-700" /> Fruit Scanning Report
          </h2>
          <p className="mt-1 text-xs font-semibold leading-5 text-gray-600">{statusMessage}</p>
        </div>
        <span className={`shrink-0 rounded px-2 py-1 text-[9px] font-extrabold ${status === "COMPLETED" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-900"}`}>
          {status.replace(/_/g, " ")}
        </span>
      </div>
      {status === "COMPLETED" && (
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <InfoTile label="Images analyzed" value={report?.imagesAnalyzed || 0} />
          <InfoTile label="Fruits detected" value={report?.totalFruitCount || 0} />
        </div>
      )}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={onView}
          className="min-h-11 rounded-md border border-green-300 bg-green-50 px-3 py-2 text-xs font-extrabold text-green-800"
        >
          View Scanning Report
        </button>
        <button
          type="button"
          onClick={onDownload}
          disabled={!downloadAvailable || downloading}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-green-700 px-3 py-2 text-xs font-extrabold text-white disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          <FaDownload /> {downloading ? "Preparing PDF..." : "Download PDF"}
        </button>
      </div>
      <p className="mt-2 text-[10px] font-semibold text-gray-500">
        Buyer reports exclude the Grower&apos;s private base or reserve price.
      </p>
    </section>
  );
}

function OtherBuyerOffersColumn({ offers = [] }) {
  const visibleOffers = offers.slice(0, 8);

  return (
    <section className="section min-w-0 rounded-md border border-gray-200 bg-white p-2.5 md:p-3 lg:sticky lg:top-20 lg:self-start">
      <div className="mb-2 flex items-center justify-between gap-2 md:mb-3">
        <h2 className="text-sm font-extrabold text-gray-950">Other Buyers' Offers</h2>
        <span className="rounded-full bg-green-100 px-2 py-1 text-[10px] font-extrabold text-green-800">
          Current Lot
        </span>
      </div>

      {!visibleOffers.length ? (
        <p className="rounded-md bg-green-50 px-3 py-3 text-xs font-bold text-green-800">
          No buyer offers submitted for this lot yet.
        </p>
      ) : (
        <div className="grid gap-2">
          {visibleOffers.map((offer) => (
            <article key={offer._id || offer.createdAt} className="rounded-md border border-green-100 bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-extrabold text-gray-950">
                    {offer.buyerName || "Buyer Business"}
                  </p>
                  <p className="mt-1 text-[10px] font-bold text-gray-500">
                    {formatDateTime(offer.createdAt)}
                  </p>
                </div>
                <span className="shrink-0 rounded bg-green-100 px-2 py-1 text-[9px] font-extrabold uppercase text-green-800">
                  {formatLotStatus(offer.status)}
                </span>
              </div>

              <div className="mt-2 space-y-1">
                {(offer.grades || []).map((grade) => (
                  <div key={`${offer._id}-${grade.grade}`} className="flex justify-between gap-2 rounded bg-green-50 px-2 py-1 text-[10px] font-bold text-green-900">
                    <span>Grade {grade.grade}</span>
                    <span>Rs. {Number(grade.price || grade.buyerPayableThroughPlatform || 0).toLocaleString("en-IN")}</span>
                  </div>
                ))}
              </div>

              <div className="mt-2 rounded bg-gray-50 px-2 py-1.5 text-[11px] font-extrabold text-gray-900">
                Total Offer: Rs. {Number(offer.quotedTotalValue || 0).toLocaleString("en-IN")}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
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
              <img src={image.url} alt={`${image.gradeLabel || "Fruit lot"} image`} className="h-full w-full max-w-full object-cover" />
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
  const logo = resolveProfileMediaUrl(grower.companyLogoUrl);

  if (!product) return null;

  return (
    <div className="flex w-full min-w-0 items-center gap-2 rounded-md bg-green-50 px-3 py-2 sm:w-auto sm:max-w-[240px] sm:shrink-0">
      {logo ? (
        <img src={logo} alt={`${name} logo`} className="h-10 w-10 rounded bg-white object-contain ring-1 ring-green-100" />
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
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-t border-green-200 pt-2 text-base font-extrabold">
        <span className="min-w-0 truncate">Buyer Bid Rate</span>
        <span className="shrink-0">Rs. {breakdown.dealAmount || 0}</span>
      </div>
      <SummaryRow label="Buyer Payable Through Platform" value={breakdown.buyerPayableThroughPlatform || breakdown.buyerPayable || 0} />
      <p className="rounded bg-white px-2 py-1 text-[11px] font-bold text-green-800">
        Unloading labour is not collected by eFruitMandi. Grower pays it directly at unloading, if applicable.
      </p>
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
          <p className="text-[10px] font-extrabold uppercase text-gray-500">Platform Payable</p>
          <p className="truncate text-base font-extrabold text-green-800">Rs. {preview.buyerPayableThroughPlatform || preview.buyerPayable || 0}</p>
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

function getLotGradeLabel(lot = {}) {
  if (lot.grade) return `Grade ${lot.grade}`;
  const firstGrade = Array.isArray(lot.gradeLots) ? lot.gradeLots.find((gradeLot) => gradeLot?.grade) : null;
  return firstGrade?.grade ? `Grade ${firstGrade.grade}` : "";
}

function getLotQuantity(lot = {}) {
  if (lot.quantity) return lot.quantity;
  return (lot.gradeLots || []).reduce((sum, gradeLot) => sum + Number(gradeLot.boxes || 0), 0);
}

function formatLotStatus(status = "") {
  const normalized = String(status || "").trim().replace(/_/g, " ");
  return normalized || "Available";
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time not available";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatLotPrice(lot = {}) {
  const value = Number(lot.basePrice || lot.finalPrice || lot.finalDealValue || 0);
  return value > 0 ? `Rs. ${value}` : "Price by offer";
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
  const labourChargePerUnit = 5;
  const grades = availableGrades.map((gradeLot) => {
    const price = Number(gradePrices[gradeLot.grade] || 0);
    return {
      grade: gradeLot.grade,
      quantity: gradeLot.quantity,
      price,
      labourCharge: labourChargePerUnit,
      buyerPayableThroughPlatform: price,
      amount: Math.round(gradeLot.quantity * price),
    };
  });
  const dealAmount = grades.reduce((sum, grade) => sum + Number(grade.amount || 0), 0);
  const totalUnits = grades.reduce((sum, grade) => sum + Number(grade.quantity || 0), 0);
  const labourAmount = totalUnits * labourChargePerUnit;
  return {
    grades,
    dealAmount,
    labourChargePerUnit,
    labourAmount,
    buyerPayable: dealAmount,
    buyerPayableThroughPlatform: dealAmount,
  };
}

