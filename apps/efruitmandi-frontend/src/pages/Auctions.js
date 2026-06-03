import { useEffect, useMemo, useState } from "react";
import { FaCertificate, FaEye, FaSeedling } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import API, { FILE_BASE_URL } from "../services/api";
import socket from "../services/socket";
import { getCurrentUser, isBuyerAccount } from "../utils/auth";

import CountdownTimer from "../components/CountdownTimer";

export default function Auctions() {
  const navigate = useNavigate();
  const [auctions, setAuctions] = useState([]);
  const [dealAmounts, setDealAmounts] = useState({});
  const [distanceByAuction, setDistanceByAuction] = useState({});
  const [dealPreviews, setDealPreviews] = useState({});
  const initialUser = useMemo(() => getCurrentUser(), []);
  const [profile, setProfile] = useState(initialUser);
  const isBuyer = isBuyerAccount(profile);
  const hasTradingKyc = profile?.kyc?.status === "APPROVED";
  const canDeal = isBuyer && hasTradingKyc;

  const fetchAuctions = async () => {
    try {
      const res = await API.get("/auctions");
      setAuctions(res.data || []);
    } catch (err) {
      console.error(err);
      setAuctions([]);
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
    () => auctions.filter((auction) => auction.status === "ACTIVE"),
    [auctions]
  );

  useEffect(() => {
    const timeout = setTimeout(() => {
      liveAuctions.forEach((auction) => {
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
      socket.emit("joinAuction", auction._id);
    });
  }, [liveAuctions]);

  const placeDeal = (auctionId) => {
    if (!canDeal) {
      alert(
        isBuyer
          ? "Complete KYC authority verification before starting fruit trading."
          : "Buyer account required to participate."
      );
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

  return (
    <div className="pb-20">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-extrabold text-black">Live Fruit Lots</h2>
        <span className="rounded-full bg-green-100 px-3 py-1 text-[10px] font-extrabold text-green-800">
          {liveAuctions.length} live
        </span>
      </div>

      {!liveAuctions.length ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {liveAuctions.map((auction) => (
            <LiveLotCard
              key={auction._id}
              auction={auction}
              dealAmount={dealAmounts[auction._id] || ""}
              distanceKm={distanceByAuction[auction._id] || ""}
              dealPreview={dealPreviews[auction._id]}
              canDeal={canDeal}
              isBuyer={isBuyer}
              onView={() => {
                if (auction.product?._id) {
                  navigate(`/lots/${auction.product._id}`);
                }
              }}
              onDealChange={(value) =>
                setDealAmounts((current) => ({
                  ...current,
                  [auction._id]: value,
                }))
              }
              onDistanceChange={(value) =>
                setDistanceByAuction((current) => ({
                  ...current,
                  [auction._id]: value,
                }))
              }
              onDeal={() => placeDeal(auction._id)}
            />
          ))}
        </div>
      )}
    </div>
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
  const currentBid = auction.currentBid || auction.startingPrice || 0;
  const highestGrade = auction.highestGrade || dealPreview?.highestGrade || getHighestGrade(product);
  const isOrganicCertified = isOrganicCertifiedProduct(product);
  const certificateUrl = product.organicCertificateUrl
    ? toAssetUrl(product.organicCertificateUrl)
    : "";

  return (
    <article className="rounded-md border border-gray-200 bg-white p-2">
      <div className="mb-2 aspect-[4/3] w-full overflow-hidden rounded-md bg-green-100">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={product.title || "Fruit Lot"}
            className="h-full w-full object-contain"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-2xl text-green-700">
            <FaSeedling />
          </div>
        )}
      </div>

      <div className="mb-1 flex items-center justify-between gap-2">
        <h3 className="line-clamp-1 text-xs font-extrabold text-black">
          {product.title || "Fruit Lot"}
        </h3>
        <span className="rounded bg-green-100 px-2 py-0.5 text-[8px] font-extrabold text-green-800">
          Deal Open
        </span>
      </div>

      <p className="truncate text-[10px] font-bold text-gray-600">
        {product.location || "Fruit Mandi"}
      </p>
      <p className="text-[10px] font-bold text-black">
        {quantity} Box Lot
      </p>
      <p className="text-[10px] font-bold text-black">
        Current deal price: Rs. {currentBid}
      </p>
      {isOrganicCertified && (
        <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-1 text-[9px] font-extrabold text-green-800 ring-1 ring-green-200">
          <FaCertificate />
          <span>Organic Certified</span>
        </div>
      )}

      {auction.endTime && (
        <div className="mt-1 text-[10px] font-bold text-red-600">
          <CountdownTimer endTime={auction.endTime} />
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-1">
        <button
          type="button"
          onClick={onView}
          className="inline-flex items-center gap-1 rounded-full bg-gray-200 px-2 py-1 text-[9px] font-bold text-gray-700"
        >
          <FaEye />
          View Listing
        </button>
        {certificateUrl && (
          <a
            href={certificateUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-[9px] font-bold text-green-800"
          >
            <FaCertificate />
            Certificate
          </a>
        )}
      </div>

      {canDeal ? (
        <div className="mt-2 space-y-2">
          <div className="grid grid-cols-2 gap-1">
            <input
              className="min-w-0 rounded border border-gray-200 px-2 py-1 text-[10px] font-bold"
              placeholder={`${highestGrade || "Highest"} rate`}
              value={dealAmount}
              type="number"
              min="1"
              onChange={(e) => onDealChange(e.target.value)}
            />
            <input
              className="min-w-0 rounded border border-gray-200 px-2 py-1 text-[10px] font-bold"
              placeholder="Distance km"
              value={distanceKm}
              type="number"
              min="0"
              onChange={(e) => onDistanceChange(e.target.value)}
            />
          </div>
          {dealPreview && (
            <div className="rounded bg-green-50 p-2 text-[9px] font-bold text-green-900">
              <p>Complete lot only</p>
              <p>Deal: Rs. {dealPreview.dealAmount || 0}</p>
              <p>Driver: Rs. {dealPreview.driverCharge || 0}</p>
              <p>Commission: Rs. {dealPreview.commissionAmount || 0}</p>
              <p>Total payable: Rs. {dealPreview.buyerPayable || 0}</p>
            </div>
          )}
          <button
            type="button"
            onClick={onDeal}
            className="inline-flex items-center gap-1 rounded-full bg-gray-200 px-2 py-1 text-[9px] font-bold text-gray-700"
          >
            <FaEye />
            Quote Your Price
          </button>
        </div>
      ) : (
        <p className="mt-2 rounded bg-gray-100 px-2 py-1 text-[9px] font-bold text-gray-600">
          {isBuyer
            ? "KYC authority verification required to participate"
            : "Buyer account required to participate"}
        </p>
      )}
    </article>
  );
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
    <div className="flex items-center gap-3 rounded-md border border-dashed border-green-200 bg-green-50 px-3 py-4 text-green-800">
      <span className="text-lg">
        <FaSeedling />
      </span>
      <p className="text-xs font-bold">
        No live fruit lots yet. Closed lots are available from the profile dashboard.
      </p>
    </div>
  );
}

function getImageUrl(product) {
  const image = Array.isArray(product.images) ? product.images[0] : "";
  return toAssetUrl(image);
}

function toAssetUrl(path) {
  const normalizedPath = path ? path.replace(/\\/g, "/") : "";
  if (/^https?:\/\//i.test(normalizedPath)) return normalizedPath;
  return normalizedPath ? `${FILE_BASE_URL}/${normalizedPath}` : "";
}

function isOrganicCertifiedProduct(product = {}) {
  const quality = String(product.quality || "").toLowerCase();
  return (
    quality.includes("certified organic") ||
    Boolean(product.organicCertificationNo || product.organicCertificateUrl)
  );
}
