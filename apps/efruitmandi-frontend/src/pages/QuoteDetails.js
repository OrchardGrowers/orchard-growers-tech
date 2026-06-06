import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaArrowLeft, FaCalculator, FaHandshake, FaSeedling, FaUser } from "react-icons/fa";
import API from "../services/api";

export default function QuoteDetails() {
  const { quoteId } = useParams();
  const navigate = useNavigate();
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const loadQuote = async () => {
      try {
        setLoading(true);
        setMessage("");
        const res = await API.get(`/quotes/${quoteId}`);
        setQuote(res.data?.quote || null);
      } catch (err) {
        setMessage(err.response?.data?.msg || err.response?.data?.message || "Quote details could not be loaded.");
      } finally {
        setLoading(false);
      }
    };

    loadQuote();
  }, [quoteId]);

  const acceptDeal = async () => {
    if (!quote?._id) return;
    if (!window.confirm("After accepting this deal, other quotes for this lot will be closed. Continue?")) {
      return;
    }

    try {
      setSaving(true);
      setMessage("");
      const res = await API.patch(`/quotes/${quote._id}/accept`);
      setQuote(res.data?.quote || quote);
      setMessage("Deal accepted successfully.");
    } catch (err) {
      setMessage(err.response?.data?.msg || err.response?.data?.message || "Deal could not be accepted.");
    } finally {
      setSaving(false);
    }
  };

  const status = normalizeQuoteStatusLabel(quote?.status);
  const canAccept = status === "Pending";

  return (
    <div className="mx-auto w-full max-w-4xl overflow-x-hidden pb-[calc(160px+env(safe-area-inset-bottom))]">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-3 inline-flex items-center gap-2 rounded-full bg-gray-200 px-3 py-1.5 text-xs font-extrabold text-gray-700"
      >
        <FaArrowLeft />
        Back
      </button>

      <section className="rounded-md border border-green-100 bg-white p-4">
        <p className="text-xs font-extrabold uppercase tracking-wide text-green-700">Buyer Quote Details</p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-black leading-tight text-gray-950">
              {loading ? "Loading quote..." : quote?.lotTitle || "Fruit Lot Quote"}
            </h1>
            {quote && (
              <p className="mt-1 text-sm font-bold text-gray-600">
                {quote.lotQuantity || 0} boxes | {quote.fruitType || "Fruit lot"}
              </p>
            )}
          </div>
          {quote && <QuoteStatusBadge status={quote.status} />}
        </div>
      </section>

      {message && (
        <p className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm font-bold text-green-800">
          {message}
        </p>
      )}

      {!loading && !quote ? (
        <section className="mt-3 rounded-md border border-dashed border-green-200 bg-green-50 p-4 text-sm font-bold text-green-800">
          Quote details are not available.
        </section>
      ) : quote ? (
        <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="rounded-md border border-gray-200 bg-white p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-gray-950">
              <FaUser className="text-green-700" />
              Buyer and Lot
            </h2>
            <div className="grid gap-2 sm:grid-cols-2">
              <InfoTile label="Buyer" value={quote.buyerName || "Buyer"} />
              <InfoTile label="Buyer Phone" value={maskPhone(quote.buyerPhone)} />
              <InfoTile label="Grower" value={quote.growerName || "Grower"} />
              <InfoTile label="Quote Date" value={formatDate(quote.createdAt)} />
            </div>

            {quote.message && (
              <div className="mt-3 rounded-md bg-green-50 p-3">
                <p className="text-[10px] font-extrabold uppercase text-gray-500">Buyer Message</p>
                <p className="mt-1 text-sm font-bold text-gray-800">{quote.message}</p>
              </div>
            )}
          </section>

          <section className="rounded-md border border-green-100 bg-green-50 p-4 lg:row-span-2">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-green-950">
              <FaCalculator />
              Deal Summary
            </h2>
            <SummaryRow label="Buyer quote value" value={quote.quotedTotalValue || quote.dealAmount} />
            <SummaryRow label="Logistics / driver charge" value={quote.driverCharge} />
            <SummaryRow label="Platform fee" value={quote.commissionAmount} />
            <div className="mt-3 border-t border-green-200 pt-3">
              <p className="text-[10px] font-extrabold uppercase text-green-800">Grower receives</p>
              <p className="mt-1 text-2xl font-black text-green-950">Rs. {quote.sellerReceivable || 0}</p>
            </div>
            <p className="mt-2 text-xs font-bold text-green-800">
              Buyer final payable: Rs. {quote.buyerPayable || 0}
            </p>
            <button
              type="button"
              disabled={!canAccept || saving}
              onClick={acceptDeal}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-green-700 px-4 py-3 text-sm font-extrabold text-white disabled:bg-gray-200 disabled:text-gray-500"
            >
              <FaHandshake />
              {saving ? "Accepting..." : canAccept ? "Accept Deal" : `Deal ${status}`}
            </button>
          </section>

          <section className="rounded-md border border-gray-200 bg-white p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-gray-950">
              <FaSeedling className="text-green-700" />
              Grade-wise Quote
            </h2>
            <div className="space-y-2">
              {(quote.grades || []).map((grade) => (
                <div key={grade.grade} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-md bg-green-50 px-3 py-2 text-sm font-bold text-green-950">
                  <span className="min-w-0 truncate">
                    Grade {grade.grade}: {grade.quantity} x Rs. {grade.price || 0}
                  </span>
                  <span>Rs. {grade.amount || 0}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function InfoTile({ label, value }) {
  return (
    <div className="min-w-0 rounded-md bg-green-50 px-3 py-2">
      <p className="text-[10px] font-extrabold uppercase text-gray-500">{label}</p>
      <p className="mt-1 truncate text-sm font-extrabold text-gray-950">{value || "Not available"}</p>
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 py-1.5 text-sm font-bold text-green-950">
      <span className="min-w-0">{label}</span>
      <span className="shrink-0">Rs. {value || 0}</span>
    </div>
  );
}

function QuoteStatusBadge({ status }) {
  const label = normalizeQuoteStatusLabel(status);
  const classes =
    label === "Accepted"
      ? "bg-green-700 text-white"
      : label === "Rejected" || label === "Closed"
        ? "bg-gray-200 text-gray-700"
        : "bg-amber-100 text-amber-800";
  return (
    <span className={`rounded-full px-3 py-1 text-[10px] font-extrabold uppercase ${classes}`}>
      {label}
    </span>
  );
}

function normalizeQuoteStatusLabel(status = "") {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "accepted") return "Accepted";
  if (normalized === "rejected") return "Rejected";
  if (normalized === "closed" || normalized === "expired") return "Closed";
  if (normalized === "cancelled") return "Cancelled";
  return "Pending";
}

function maskPhone(phone = "") {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length < 4) return "Phone hidden";
  return `${digits.slice(0, 2)}XXXX${digits.slice(-2)}`;
}

function formatDate(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-IN");
}
