import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaArrowLeft, FaCalculator, FaMapMarkerAlt, FaSeedling, FaVideo } from "react-icons/fa";
import API, { FILE_BASE_URL } from "../services/api";
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
  const preview = useMemo(
    () => calculateBuyerPreview(availableGrades, gradePrices, distanceKm),
    [availableGrades, gradePrices, distanceKm]
  );

  const updateGradePrice = (grade, value) => {
    setQuotation(null);
    setGradePrices((current) => ({ ...current, [grade]: value }));
  };

  const submitQuote = async (event) => {
    event.preventDefault();
    const missingGrade = availableGrades.find((gradeLot) => Number(gradePrices[gradeLot.grade] || 0) <= 0);
    if (missingGrade) {
      setMessage(`Enter a price greater than 0 for Grade ${missingGrade.grade}.`);
      return;
    }

    try {
      setSaving(true);
      setMessage("");
      const res = await API.post(`/quotations/lots/${lotId}`, {
        grades: availableGrades.map((gradeLot) => ({
          grade: gradeLot.grade,
          price: Number(gradePrices[gradeLot.grade] || 0),
        })),
        distanceKm,
      });
      setQuotation(res.data?.quotation || null);
      setMessage("Quote submitted. The grower will see only the final receivable amount.");
    } catch (err) {
      setMessage(err.response?.data?.message || err.response?.data?.msg || "Quote could not be submitted.");
    } finally {
      setSaving(false);
    }
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
        <div className="mt-1 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-extrabold text-gray-950">
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
              onClick={() => navigate("/kyc", { state: { from: `/lots/${lotId}/quote` } })}
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
        <section className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
          <LotMediaPanel
            product={product}
            images={images}
            activeImage={activeImage}
            onSelectImage={setActiveImage}
          />

          <form onSubmit={submitQuote} className="rounded-md border border-gray-200 bg-white p-4 lg:sticky lg:top-20 lg:self-start">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              <InfoTile label="Available grades" value={`${availableGrades.length} grades`} />
              <InfoTile label="Packing" value={product?.packingType || "Not set"} />
              <InfoTile label="Variety" value={product?.variety || "Not set"} />
              <InfoTile label="Quality" value={product?.quality || "Not set"} />
            </div>

            <div className="mt-4 space-y-3">
              <p className="text-sm font-extrabold text-gray-800">Grade-wise prices</p>
              {availableGrades.map((gradeLot) => {
                const price = Number(gradePrices[gradeLot.grade] || 0);
                const amount = price * gradeLot.quantity;
                return (
                  <label key={gradeLot.grade} className="block rounded-md border border-gray-200 bg-white p-3">
                    <span className="flex items-center justify-between gap-2 text-sm font-extrabold text-gray-800">
                      <span>{gradeLot.grade} Grade Price (Rs. per {quoteUnit.singular})</span>
                      <span className="text-xs text-gray-500">
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
                      className="mt-2 w-full rounded-md border border-gray-200 px-3 py-3 text-sm font-bold outline-none focus:border-green-600"
                    />
                    <p className="mt-2 text-xs font-bold text-green-800">
                      Amount: Rs. {amount || 0}
                    </p>
                  </label>
                );
              })}
            </div>

            <label className="mt-3 block text-sm font-bold text-gray-700">
              Delivery distance in km fallback
              <input
                value={distanceKm}
                inputMode="numeric"
                type="number"
                min="0"
                onChange={(event) => setDistanceKm(event.target.value)}
                placeholder="Auto-calculated when profile map points exist"
                className="mt-2 w-full rounded-md border border-gray-200 px-3 py-3 text-sm font-bold outline-none focus:border-green-600"
              />
            </label>

            <div className="mt-4 rounded-md bg-green-50 p-3 text-sm font-bold text-green-900">
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
              disabled={saving}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-green-700 px-4 py-3 text-sm font-extrabold text-white"
            >
              <FaSeedling />
              {saving ? "Submitting..." : "Submit Quote"}
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
      <div className="relative flex min-h-[320px] items-center justify-center rounded-md bg-white">
        {activeImage ? (
          <img
            src={activeImage.url}
            alt={product?.title || "Fruit Lot"}
            className="max-h-[560px] max-w-full object-contain"
          />
        ) : (
          <div className="flex h-56 w-full items-center justify-center rounded-md bg-green-50 text-4xl text-green-700">
            <FaSeedling />
          </div>
        )}
        {activeImage?.gradeLabel && <FruitGradeBadge label={activeImage.gradeLabel} />}
      </div>

      {images.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {images.map((image) => (
            <button
              key={image.url}
              type="button"
              onClick={() => onSelectImage(image)}
              className={`relative h-16 w-20 shrink-0 overflow-hidden rounded border bg-white ${
                activeImage?.url === image.url ? "border-green-700" : "border-gray-200"
              }`}
            >
              <img src={image.url} alt="" className="h-full w-full object-contain" />
              {image.gradeLabel && (
                <span className="absolute left-1 top-1 rounded bg-green-800 px-1.5 py-0.5 text-[8px] font-extrabold uppercase text-white shadow">
                  {image.gradeLabel}
                </span>
              )}
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

function GrowerIdentity({ product }) {
  const grower = product?.createdBy || {};
  const name = grower.orchardName || grower.businessName || grower.name || "Grower's Orchard";
  const logo = resolveProfileMediaUrl(grower.companyLogoUrl || grower.avatarUrl);

  if (!product) return null;

  return (
    <div className="flex max-w-[240px] shrink-0 items-center gap-2 rounded-md bg-green-50 px-3 py-2">
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
    <div className="rounded-md bg-green-50 px-3 py-2">
      <p className="text-[10px] font-extrabold text-gray-500">{label}</p>
      <p className="mt-1 text-xs font-extrabold text-gray-950">{value}</p>
    </div>
  );
}

function BuyerQuoteSummary({ breakdown = {} }) {
  const grades = breakdown.grades || [];

  return (
    <div className="mt-2 space-y-2">
      {grades.length > 0 && (
        <div className="space-y-1">
          {grades.map((grade) => (
            <div key={grade.grade} className="flex items-center justify-between gap-2 rounded bg-white px-2 py-1 text-xs">
              <span>
                Grade {grade.grade}: {grade.quantity} x Rs. {grade.price || 0}
              </span>
              <span>Rs. {grade.amount || 0}</span>
            </div>
          ))}
        </div>
      )}
      <SummaryRow label="Total deal amount" value={breakdown.dealAmount} />
      <SummaryRow label="Driver charge" value={breakdown.driverCharge} />
      <SummaryRow label="Commission" value={breakdown.commissionAmount} />
      <div className="flex items-center justify-between gap-2 border-t border-green-200 pt-2 text-base font-extrabold">
        <span>Final payable</span>
        <span>Rs. {breakdown.buyerPayable || 0}</span>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span>{label}</span>
      <span>Rs. {value || 0}</span>
    </div>
  );
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
  const topImages = (Array.isArray(product.images) ? product.images : [])
    .map((image) => addImage(image, product.grade || ""))
    .filter(Boolean);
  const gradeImages = Array.isArray(product.gradeLots)
    ? product.gradeLots.flatMap((lot) =>
        (lot.images || []).map((image) => addImage(image, lot.grade || "")).filter(Boolean)
      )
    : [];
  return [...topImages, ...gradeImages];
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

function getQuoteUnit(product = {}) {
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
