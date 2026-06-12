import { useEffect, useMemo, useState } from "react";
import {
  FaCertificate,
  FaClock,
  FaEye,
  FaFilter,
  FaGavel,
  FaMapMarkerAlt,
  FaRupeeSign,
  FaSearch,
  FaSeedling,
  FaShieldAlt,
  FaSortAmountDown,
  FaWeightHanging,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import API, { FILE_BASE_URL } from "../services/api";
import socket from "../services/socket";
import { canQuote, getCurrentUser, isBuyerAccount } from "../utils/auth";
import { getEfruitMandiProducts } from "../utils/marketProducts";
import CountdownTimer from "../components/CountdownTimer";
import SEO from "../components/SEO";
import {
  PAYMENT_PARTNER_ENABLED,
  PAYMENT_UNAVAILABLE_MESSAGE,
} from "../config/payment";

const isDevelopment = process.env.NODE_ENV !== "production";

const sortOptions = [
  { key: "latest", label: "Latest" },
  { key: "priceHigh", label: "Price high" },
  { key: "quantityHigh", label: "Quantity high" },
];

const LOT_OPEN_HOUR = 12;
const LOGIN_REQUIRED_MESSAGE = "Please login first to continue.";

export default function Auctions() {
  const navigate = useNavigate();
  const [auctions, setAuctions] = useState([]);
  const [products, setProducts] = useState([]);
  const [dealAmounts, setDealAmounts] = useState({});
  const [distanceByAuction, setDistanceByAuction] = useState({});
  const [dealPreviews, setDealPreviews] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortMode, setSortMode] = useState("latest");
  const initialUser = useMemo(() => getCurrentUser(), []);
  const [profile, setProfile] = useState(initialUser);
  const [message, setMessage] = useState("");
  const isBuyer = isBuyerAccount(profile);
  const canDeal = isBuyer && canQuote(profile);

  const fetchAuctions = async () => {
    try {
      setLoading(true);
      const [auctionRes, productRes] = await Promise.all([
        API.get("/auctions"),
        API.get("/products?platform=efruitmandi").catch(() => ({ data: [] })),
      ]);
      setAuctions(auctionRes.data || []);
      setProducts(getEfruitMandiProducts(productRes.data));
    } catch (err) {
      if (isDevelopment) {
        console.error(err);
      }
      setAuctions([]);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuctions();
    if (localStorage.getItem("accessToken")) {
      API.get("/user/profile")
        .then((res) => setProfile(res.data || initialUser))
        .catch(() => setProfile(initialUser));
    }
  }, [initialUser]);

  useEffect(() => {
    if (!socket.connected) socket.connect();

    socket.on("dealUpdate", ({ dealAmount, auctionId }) => {
      setAuctions((prev) =>
        prev.map((auction) =>
          auction._id === auctionId
            ? { ...auction, currentBid: dealAmount }
            : auction
        )
      );
    });

    socket.on("auctionEnded", () => {
      fetchAuctions();
    });

    socket.on("dealRejected", ({ msg }) => {
      alert(msg || "Unable to make a deal.");
    });

    return () => {
      socket.off("dealUpdate");
      socket.off("auctionEnded");
      socket.off("dealRejected");
    };
  }, []);

  const liveAuctions = useMemo(
    () => mergeLiveAuctionLots(auctions, products),
    [auctions, products]
  );

  const filteredAuctions = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const matching = query
      ? liveAuctions.filter((auction) => {
          const product = auction.product || {};
          return [
            product.title,
            product.fruitName,
            product.variety,
            product.location,
            product.createdBy?.orchardName,
            product.createdBy?.name,
          ]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(query));
        })
      : liveAuctions;

    return matching.slice().sort((a, b) => {
      if (sortMode === "priceHigh") return getCurrentPrice(b) - getCurrentPrice(a);
      if (sortMode === "quantityHigh") return Number(b.product?.quantity || 0) - Number(a.product?.quantity || 0);
      return new Date(b.createdAt || b.product?.createdAt || 0) - new Date(a.createdAt || a.product?.createdAt || 0);
    });
  }, [liveAuctions, searchTerm, sortMode]);

  const featuredAuction = filteredAuctions[0] || liveAuctions[0] || null;
  const metrics = useMemo(() => {
    const totalBoxes = liveAuctions.reduce((sum, auction) => sum + Number(auction.product?.quantity || 0), 0);
    const topDeal = liveAuctions.reduce((max, auction) => Math.max(max, getCurrentPrice(auction)), 0);
    const organicCount = liveAuctions.filter((auction) => isOrganicCertifiedProduct(auction.product || {})).length;
    return { totalBoxes, topDeal, organicCount };
  }, [liveAuctions]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      liveAuctions.forEach((auction) => {
        if (auction.syntheticProductLot) return;
        const baseRate = Number(dealAmounts[auction._id] || 0);
        if (!baseRate || !canDeal) return;

        API.post(`/auctions/${auction._id}/calculate`, {
          baseRate,
          distanceKm: Number(distanceByAuction[auction._id] || 0),
        })
          .then((res) =>
            setDealPreviews((current) => ({
              ...current,
              [auction._id]: res.data,
            }))
          )
          .catch(() =>
            setDealPreviews((current) => ({
              ...current,
              [auction._id]: null,
            }))
          );
      });
    }, 350);

    return () => clearTimeout(timeout);
  }, [canDeal, dealAmounts, distanceByAuction, liveAuctions]);

  useEffect(() => {
    liveAuctions.forEach((auction) => {
      if (auction.syntheticProductLot) return;
      socket.emit("joinAuction", auction._id);
    });
  }, [liveAuctions]);

  const placeDeal = (auctionId) => {
    if (!PAYMENT_PARTNER_ENABLED) {
      setMessage(PAYMENT_UNAVAILABLE_MESSAGE);
      return;
    }

    if (!canDeal) {
      if (!localStorage.getItem("accessToken")) {
        navigate("/profile", {
          state: {
            mode: "login",
            from: "/auctions",
            requiredProfile: "buyer",
            message: LOGIN_REQUIRED_MESSAGE,
          },
        });
        return;
      }
      if (isBuyer) {
        navigate("/kyc", {
          state: {
            from: "/auctions",
            roleType: "buyer",
            intent: "quote",
            message:
              "To keep eFruitMandi safe and trusted, KYC verification is required before placing a quote or deal. Please complete your KYC and wait for admin approval.",
          },
        });
        return;
      }
      navigate("/register-buyer", { state: { from: "/auctions" } });
      return;
    }

    const dealAmount = Number(dealAmounts[auctionId]);
    if (!dealAmount) return;

    socket.emit("placeDeal", {
      auctionId,
      dealAmount,
      distanceKm: Number(distanceByAuction[auctionId] || 0),
      userId: profile._id || profile.id,
      token: localStorage.getItem("accessToken"),
    });
  };

  const updateDealAmount = (auctionId, value) =>
    setDealAmounts((current) => ({
      ...current,
      [auctionId]: value,
    }));

  const updateDistance = (auctionId, value) =>
    setDistanceByAuction((current) => ({
      ...current,
      [auctionId]: value,
    }));

  return (
    <>
      <SEO
        title="Live Fruit Lots for Bulk Buyers | eFruitMandi"
        description="Browse live fresh fruit lots, orchard consignments, grades, quantities and buyer quote opportunities on eFruitMandi."
        canonical="/auctions"
      />
      <div className="mx-auto max-w-6xl pb-20">
      <header className="-mx-3 bg-green-800 px-4 pb-5 pt-4 text-white md:-mx-4 md:px-6">
        <div className="mx-auto max-w-6xl">
          <p className="flex items-center gap-2 text-xs font-extrabold uppercase text-green-100">
            <FaGavel />
            eFruitMandi Live Market
          </p>
          <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-2xl font-black leading-tight md:text-3xl">Live Fruit Lots</h1>
              <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-green-50">
                Fresh orchard consignments currently open for buyer quotes and complete-lot deals.
              </p>
            </div>
            <button
              type="button"
              onClick={fetchAuctions}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-extrabold text-green-800 shadow-sm"
            >
              <FaClock />
              Refresh Lots
            </button>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2 text-center">
            <Metric label="Live Lots" value={liveAuctions.length} />
            <Metric label="Total Boxes" value={metrics.totalBoxes} />
            <Metric label="Top Deal" value={`Rs. ${metrics.topDeal}`} />
          </div>
        </div>
      </header>

      {message && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
          {message}
        </p>
      )}

      <section className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
        <label className="flex items-center gap-2 rounded-lg border border-green-100 bg-white px-3 py-2">
          <FaSearch className="text-green-700" />
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search fruit, mandi, variety, or grower"
            className="min-h-9 flex-1 bg-transparent text-sm font-bold outline-none"
          />
        </label>
        <label className="flex items-center gap-2 rounded-lg border border-green-100 bg-white px-3 py-2">
          <FaSortAmountDown className="text-green-700" />
          <select
            aria-label="Sort live fruit lots"
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value)}
            className="min-h-9 flex-1 bg-transparent text-sm font-bold outline-none"
          >
            {sortOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      {featuredAuction && (
        <FeaturedLot
          auction={featuredAuction}
          canDeal={canDeal}
          onView={() => featuredAuction.product?._id && navigate(`/lots/${featuredAuction.product._id}`)}
          onQuote={() => featuredAuction.product?._id && navigate(`/lots/${featuredAuction.product._id}/quote`)}
        />
      )}

      <div className="mt-5 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-black text-gray-950">
          <FaFilter className="text-green-700" />
          Open Lots
        </h2>
        <span className="rounded-full bg-green-100 px-3 py-1 text-[10px] font-extrabold text-green-800">
          {filteredAuctions.length} shown
        </span>
      </div>

      {loading ? (
        <LotSkeleton />
      ) : !filteredAuctions.length ? (
        <EmptyState />
      ) : (
        <section className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filteredAuctions.map((auction) => (
            <LiveLotCard
              key={auction._id}
              auction={auction}
              dealAmount={dealAmounts[auction._id] || ""}
              distanceKm={distanceByAuction[auction._id] || ""}
              dealPreview={dealPreviews[auction._id]}
              canDeal={canDeal}
              isBuyer={isBuyer}
              onView={() => {
                if (auction.product?._id) navigate(`/lots/${auction.product._id}`);
              }}
              onDealChange={(value) => updateDealAmount(auction._id, value)}
              onDistanceChange={(value) => updateDistance(auction._id, value)}
              onDeal={() => {
                if (auction.syntheticProductLot && auction.product?._id) {
                  navigate(`/lots/${auction.product._id}/quote`);
                  return;
                }
                placeDeal(auction._id);
              }}
            />
          ))}
        </section>
      )}
      </div>
    </>
  );
}

function FeaturedLot({ auction, canDeal, onView, onQuote }) {
  const product = auction.product || {};
  const imageUrl = getImageUrl(product);
  const currentBid = getCurrentPrice(auction);
  const grower = product.createdBy || {};

  return (
    <section className="mt-4 overflow-hidden rounded-lg border border-green-100 bg-white shadow-sm">
      <div className="grid md:grid-cols-[minmax(0,1fr)_340px]">
        <div className="p-4">
          <p className="inline-flex items-center gap-2 rounded-full bg-green-100 px-3 py-1 text-[10px] font-extrabold uppercase text-green-800">
            <FaShieldAlt />
            Featured Live Lot
          </p>
          <h2 className="mt-3 text-xl font-black text-gray-950">{product.title || "Fruit Lot"}</h2>
          <p className="mt-2 flex items-center gap-2 text-sm font-bold text-gray-600">
            <FaMapMarkerAlt className="text-green-700" />
            {product.location || "Fruit Mandi"}
          </p>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <InfoPill label="Boxes" value={product.quantity || 0} />
            <InfoPill label="Current deal" value={`Rs. ${currentBid}`} />
            <InfoPill label="Grade" value={auction.highestGrade || getHighestGrade(product) || "Lot"} />
          </div>

          <p className="mt-4 text-xs font-bold text-gray-600">
            {grower.orchardName || grower.businessName || grower.name || "Verified grower"} is accepting complete-lot buyer quotes.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={onView} className="inline-flex items-center gap-2 rounded-full bg-green-700 px-4 py-2 text-xs font-extrabold text-white hover:bg-green-800">
              <FaEye />
              View Listing
            </button>
            <button type="button" onClick={onQuote} className="inline-flex items-center gap-2 rounded-full bg-green-50 px-4 py-2 text-xs font-extrabold text-green-800 ring-1 ring-green-100 hover:bg-green-100">
              <FaRupeeSign />
              {canDeal ? "Quote Price" : "Check Quote Access"}
            </button>
          </div>
        </div>

        <div className="relative min-h-[220px] bg-green-50">
          {imageUrl ? (
            <img
              src={optimizeImageUrl(imageUrl, 680)}
              alt={product.title || "Fruit Lot"}
              width="680"
              height="320"
              className="h-full max-h-[320px] w-full object-contain"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="flex h-full min-h-[220px] items-center justify-center text-5xl text-green-700">
              <FaSeedling />
            </div>
          )}
          <span className="absolute right-3 top-3 rounded bg-green-800 px-3 py-1 text-[10px] font-extrabold uppercase text-white shadow">
            Deal Open
          </span>
        </div>
      </div>
    </section>
  );
}

function LiveLotCard({
  auction,
  dealAmount,
  distanceKm,
  dealPreview,
  canDeal,
  isBuyer,
  onView,
  onDealChange,
  onDistanceChange,
  onDeal,
}) {
  const product = auction.product || {};
  const imageUrl = getImageUrl(product);
  const quantity = product.quantity || 0;
  const currentBid = getCurrentPrice(auction);
  const highestGrade = auction.highestGrade || dealPreview?.highestGrade || getHighestGrade(product);
  const isOrganicCertified = isOrganicCertifiedProduct(product);
  const certificateUrl = product.organicCertificateUrl ? toAssetUrl(product.organicCertificateUrl) : "";
  const grower = product.createdBy || {};

  return (
    <article className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
      <button
        type="button"
        onClick={onView}
        className="relative mb-3 aspect-[4/3] w-full overflow-hidden rounded-md bg-green-50"
        aria-label={`Open ${product.title || "Fruit Lot"}`}
      >
        {imageUrl ? (
          <img
            src={optimizeImageUrl(imageUrl, 420)}
            alt={product.title || "Fruit Lot"}
            width="420"
            height="315"
            className="h-full w-full object-contain"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span className="flex h-full items-center justify-center text-3xl text-green-700">
            <FaSeedling />
          </span>
        )}
        <span className="absolute left-2 top-2 rounded bg-green-800 px-2 py-1 text-[9px] font-extrabold uppercase text-white shadow">
          Deal Open
        </span>
      </button>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="line-clamp-1 text-sm font-black text-gray-950">{product.title || "Fruit Lot"}</h3>
          <p className="mt-1 flex min-w-0 items-center gap-1 text-xs font-bold text-gray-600">
            <FaMapMarkerAlt className="shrink-0 text-green-700" />
            <span className="truncate">{product.location || "Fruit Mandi"}</span>
          </p>
        </div>
        <span className="shrink-0 rounded bg-green-100 px-2 py-1 text-[9px] font-extrabold text-green-800">
          Live
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <InfoPill label="Boxes" value={quantity} />
        <InfoPill label="Deal" value={`Rs. ${currentBid}`} />
        <InfoPill label="Grade" value={highestGrade || "Lot"} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] font-extrabold text-gray-600">
        <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2 py-1">
          <FaSeedling className="text-green-700" />
          {grower.orchardName || grower.businessName || grower.name || "Grower"}
        </span>
        {isOrganicCertified && (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-1 text-green-800 ring-1 ring-green-100">
            <FaCertificate />
            Organic
          </span>
        )}
      </div>

      {auction.endTime && (
        <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-[10px] font-black text-red-600">
          <CountdownTimer endTime={auction.endTime} />
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={onView} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1.5 text-[10px] font-extrabold text-gray-700 hover:bg-gray-200">
          <FaEye />
          View Listing
        </button>
        {certificateUrl && (
          <a href={certificateUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1.5 text-[10px] font-extrabold text-green-800">
            <FaCertificate />
            Certificate
          </a>
        )}
      </div>

      {canDeal ? (
        <div className="mt-3 space-y-2 rounded-md bg-green-50 p-3">
          <div className="grid grid-cols-2 gap-2">
            <input
              className="min-w-0 rounded border border-green-100 bg-white px-2 py-2 text-xs font-bold outline-none focus:border-green-700"
              placeholder={`${highestGrade || "Highest"} rate`}
              value={dealAmount}
              type="number"
              min="1"
              onChange={(e) => onDealChange(e.target.value)}
            />
            <input
              className="min-w-0 rounded border border-green-100 bg-white px-2 py-2 text-xs font-bold outline-none focus:border-green-700"
              placeholder="Distance km"
              value={distanceKm}
              type="number"
              min="0"
              onChange={(e) => onDistanceChange(e.target.value)}
            />
          </div>
          {dealPreview && (
            <div className="rounded bg-white p-2 text-[10px] font-bold text-green-900">
              <p>Deal: Rs. {dealPreview.dealAmount || 0}</p>
              <p>Driver: Rs. {dealPreview.driverCharge || 0}</p>
              <p>Commission: Rs. {dealPreview.commissionAmount || 0}</p>
              <p>Total payable: Rs. {dealPreview.buyerPayable || 0}</p>
            </div>
          )}
          <button type="button" onClick={onDeal} className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-green-700 px-3 py-2 text-xs font-extrabold text-white hover:bg-green-800">
            <FaRupeeSign />
            Quote Your Price
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-2 rounded-md bg-gray-50 p-3">
          <p className="text-[10px] font-extrabold text-gray-600">
            {isBuyer ? "KYC approval is required before quoting." : "Buyer account required to participate."}
          </p>
          <button type="button" onClick={onDeal} className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-green-700 px-3 py-2 text-xs font-extrabold text-white hover:bg-green-800">
            <FaRupeeSign />
            Quote Your Price
          </button>
        </div>
      )}
    </article>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-md bg-white/10 px-3 py-3 ring-1 ring-white/15">
      <p className="truncate text-lg font-black">{value}</p>
      <p className="mt-1 text-[10px] font-extrabold uppercase text-green-100">{label}</p>
    </div>
  );
}

function InfoPill({ label, value }) {
  return (
    <div className="rounded-md bg-gray-50 px-2 py-2">
      <p className="flex items-center gap-1 text-[9px] font-extrabold uppercase text-gray-500">
        {label === "Boxes" && <FaWeightHanging />}
        {label}
      </p>
      <p className="mt-1 truncate text-xs font-black text-gray-950">{value || "0"}</p>
    </div>
  );
}

function LotSkeleton() {
  return (
    <section className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {[1, 2, 3, 4, 5, 6].map((item) => (
        <div key={item} className="animate-pulse rounded-lg border border-green-100 bg-white p-3">
          <div className="aspect-[4/3] rounded-md bg-green-50" />
          <div className="mt-3 h-4 w-2/3 rounded bg-gray-100" />
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="h-12 rounded bg-gray-50" />
            <div className="h-12 rounded bg-gray-50" />
            <div className="h-12 rounded bg-gray-50" />
          </div>
        </div>
      ))}
    </section>
  );
}

function getCurrentPrice(auction = {}) {
  return Number(auction.currentBid || auction.startingPrice || auction.highestGradeRate || 0);
}

function getHighestGrade(product) {
  const order = ["A+", "A", "B+", "B", "C+", "C", "D", "Ungraded"];
  const lots = Array.isArray(product.gradeLots) ? product.gradeLots : [];
  return order.find((grade) =>
    lots.some((lot) => lot.grade === grade && Number(lot.boxes || 0) > 0)
  );
}

function EmptyState() {
  return (
    <div className="mt-4 rounded-lg border border-dashed border-green-200 bg-green-50 px-4 py-6 text-center text-green-900">
      <FaSeedling className="mx-auto text-2xl" />
      <p className="mt-3 text-sm font-black">No live fruit lots yet.</p>
      <p className="mt-1 text-xs font-bold text-green-800">
        Fresh lots will appear here when growers open deals for buyer quotes.
      </p>
    </div>
  );
}

function getDailyLotTiming(now = new Date()) {
  const openAt = new Date(now);
  openAt.setHours(LOT_OPEN_HOUR, 0, 0, 0);

  const closeAt = new Date(openAt);
  closeAt.setDate(openAt.getDate() + 1);

  if (now >= openAt && now <= closeAt) {
    return {
      state: "live",
      label: "Deal Open",
      targetAt: closeAt.toISOString(),
    };
  }

  return {
    state: "upcoming",
    label: "Upcoming Deal",
    targetAt: openAt.toISOString(),
  };
}

function normalizeProductToLiveAuction(product = {}, timing) {
  return {
    _id: `product-${product._id}`,
    status: "ACTIVE",
    product: {
      ...product,
      status: "ACTIVE",
      dealTiming: timing,
    },
    syntheticProductLot: true,
    currentBid: product.currentBid || product.basePrice || 0,
    startingPrice: product.basePrice || product.currentBid || 0,
    endTime: timing?.targetAt || "",
    createdAt: product.createdAt,
  };
}

function mergeLiveAuctionLots(auctions = [], products = []) {
  const timing = getDailyLotTiming();
  const activeAuctions = auctions.filter((auction) => auction.status === "ACTIVE" && auction.product);
  const auctionProductIds = new Set(
    activeAuctions
      .map((auction) => auction.product?._id || auction.product?.id)
      .filter(Boolean)
      .map(String)
  );
  const liveProductLots = products
    .filter((product) => {
      const productId = product?._id || product?.id;
      const status = String(product?.status || "").toUpperCase();
      return productId && !auctionProductIds.has(String(productId)) && !["SOLD", "ENDED", "CLOSED"].includes(status);
    })
    .map((product) => normalizeProductToLiveAuction(product, timing));

  return [...activeAuctions, ...liveProductLots];
}

function getImageUrl(product) {
  const gradeImage = Array.isArray(product.gradeLots)
    ? product.gradeLots.find((lot) => lot?.images?.[0])?.images?.[0]
    : "";
  const image = Array.isArray(product.images) && product.images[0] ? product.images[0] : gradeImage;
  return toAssetUrl(image);
}

function toAssetUrl(path) {
  const normalizedPath = path ? path.replace(/\\/g, "/") : "";
  if (/^https?:\/\//i.test(normalizedPath)) return normalizedPath;
  return normalizedPath ? `${FILE_BASE_URL}/${normalizedPath}` : "";
}

function optimizeImageUrl(url = "", width = 640) {
  if (!url || !url.includes("res.cloudinary.com") || !url.includes("/image/upload/")) {
    return url;
  }
  if (/\/image\/upload\/[^/]*(?:f_auto|q_auto|w_)/.test(url)) {
    return url;
  }
  return url.replace("/image/upload/", `/image/upload/f_auto,q_auto,dpr_auto,c_limit,w_${width}/`);
}

function isOrganicCertifiedProduct(product = {}) {
  const quality = String(product.quality || "").toLowerCase();
  return (
    quality.includes("certified organic") ||
    Boolean(product.organicCertificationNo || product.organicCertificateUrl)
  );
}
