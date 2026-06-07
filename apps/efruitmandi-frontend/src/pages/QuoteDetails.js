import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { FaArrowLeft, FaCalculator, FaHandshake, FaSeedling, FaUser } from "react-icons/fa";
import API from "../services/api";

export default function QuoteDetails() {
  const { quoteId } = useParams();
  const location = useLocation();
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
        const res = await API.get(`/quotes/${quoteId}${location.search || ""}`);
        setQuote(res.data?.quote || null);
      } catch (err) {
        setMessage(err.response?.data?.msg || err.response?.data?.message || "Quote details could not be loaded.");
      } finally {
        setLoading(false);
      }
    };

    loadQuote();
  }, [quoteId, location.search]);

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
  const isGrowerSettlementView = quote && quote.quotedTotalValue === undefined && quote.dealAmount === undefined;
  const canAccept = isGrowerSettlementView && status === "Pending";
  const buyerPlatformPayable = quote?.buyerPayableThroughPlatform || quote?.buyerPayable || 0;
  const isConsignmentReport = !isGrowerSettlementView && new URLSearchParams(location.search).get("report") === "consignment";

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
        <p className="text-xs font-extrabold uppercase tracking-wide text-green-700">
          {isConsignmentReport ? "Bought Consignment Report" : "Buyer Quote Details"}
        </p>
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
          {quote && <QuoteStatusBadge status={quote.status} buyerView={!isGrowerSettlementView} />}
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
              {isGrowerSettlementView ? "Lot Quote" : "Buyer and Lot"}
            </h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {!isGrowerSettlementView && <InfoTile label="Buyer" value={quote.buyerName || "Buyer"} />}
              {!isGrowerSettlementView && <InfoTile label="Buyer Phone" value={maskPhone(quote.buyerPhone)} />}
              {!isGrowerSettlementView && <InfoTile label="Lot No." value={quote.lotNo || quote.lotId} />}
              <InfoTile label="Grower" value={quote.growerName || "Grower"} />
              {!isGrowerSettlementView && <InfoTile label="Variety" value={quote.lotVariety || quote.fruitType} />}
              {!isGrowerSettlementView && <InfoTile label="Quality" value={quote.lotQuality} />}
              {!isGrowerSettlementView && <InfoTile label="Packing" value={quote.packingType || quote.lotUnit} />}
              {!isGrowerSettlementView && <InfoTile label="Total Weight" value={formatWeight(quote.totalWeightKg)} />}
              {!isGrowerSettlementView && <InfoTile label="Location" value={quote.lotLocation} />}
              <InfoTile label="Quote Date" value={formatDate(quote.createdAt)} />
            </div>

            {!isGrowerSettlementView && quote.message && (
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
            {isGrowerSettlementView ? (
              <>
                <div className="mt-3 border-t border-green-200 pt-3">
                  <p className="text-[10px] font-extrabold uppercase text-green-800">Net Rate</p>
                  <p className="mt-1 text-2xl font-black text-green-950">Rs. {quote.totalNetReceivable || 0}</p>
                  <p className="mt-2 text-xs font-bold leading-5 text-green-800">
                    Net receivable amount payable to the grower after applicable deductions and settlement adjustments.
                  </p>
                </div>
              </>
            ) : (
              <>
                <SummaryRow label="Buyer Bid Rate" value={quote.baseDealAmount || quote.quotedTotalValue || quote.dealAmount} />
                <SummaryRow label="Buyer Payable Through Platform" value={buyerPlatformPayable} />
                {isConsignmentReport && (
                  <>
                    <SummaryTextRow label="Payment Status" value={quote.acceptedOrderPaymentStatus || "PENDING"} />
                    <SummaryTextRow label="Delivery Status" value={quote.acceptedOrderDeliveryStatus || "PENDING"} />
                    <SummaryTextRow label="Buyer Invoice No." value={quote.acceptedOrderInvoiceNumber || "Not generated"} />
                  </>
                )}
                <p className="mt-2 rounded bg-white px-2 py-1 text-[11px] font-bold text-green-800">
                  Rs. {quote.labourChargePerUnit || 5} Labour Charge is managed and paid separately by the Buyer.
                </p>
                {isConsignmentReport && (
                  <p className="mt-2 rounded bg-white px-2 py-2 text-[11px] font-bold leading-5 text-green-900">
                    Final settlement is completed after the consignment is received at buyer premises, checked, and any recorded negotiation is completed.
                  </p>
                )}
              </>
            )}
            <button
              type="button"
              disabled={!canAccept || saving}
              onClick={acceptDeal}
              className={`mt-4 w-full items-center justify-center gap-2 rounded-md bg-green-700 px-4 py-3 text-sm font-extrabold text-white disabled:bg-gray-200 disabled:text-gray-500 ${isGrowerSettlementView ? "inline-flex" : "hidden"}`}
            >
              <FaHandshake />
              {saving ? "Accepting..." : canAccept ? "Accept Deal" : `Deal ${status}`}
            </button>
          </section>

          <section className="rounded-md border border-gray-200 bg-white p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-gray-950">
              <FaSeedling className="text-green-700" />
              {isGrowerSettlementView ? "Grade-wise Net Quote" : "Grade-wise Quote"}
            </h2>
            <div className="space-y-2">
              {(quote.grades || []).map((grade) => (
                <div key={grade.grade} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-md bg-green-50 px-3 py-2 text-sm font-bold text-green-950">
                  <span className="min-w-0 truncate">
                    {isGrowerSettlementView
                      ? `${grade.grade}: ${grade.quantity || 0} x Rs. ${grade.netRate || 0}`
                      : `Grade ${grade.grade}: ${grade.quantity} x Rs. ${grade.quotedRatePerUnit || grade.price || 0}`}
                  </span>
                  <span>
                    {isGrowerSettlementView
                      ? `Rs. ${grade.netAmount || 0}`
                      : `Platform Payable Rs. ${grade.buyerPayableThroughPlatform || Math.max(0, Number(grade.price || 0) - Number(grade.labourCharge || 0))}`}
                  </span>
                </div>
              ))}
            </div>
            {!isGrowerSettlementView && (
              <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2 border-t border-green-100 pt-3 text-sm font-black text-green-950">
                <span>Total Payable Through Platform</span>
                <span>Rs. {buyerPlatformPayable}</span>
              </div>
            )}
            {isGrowerSettlementView && (
              <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2 border-t border-green-100 pt-3 text-sm font-black text-green-950">
                <span>Total Net Receivable</span>
                <span>Rs. {quote.totalNetReceivable || 0}</span>
              </div>
            )}
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

function SummaryTextRow({ label, value }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 py-1.5 text-sm font-bold text-green-950">
      <span className="min-w-0">{label}</span>
      <span className="shrink-0">{value || "-"}</span>
    </div>
  );
}

function QuoteStatusBadge({ status, buyerView = false }) {
  const label = normalizeQuoteStatusLabel(status);
  const displayLabel = buyerView && label === "Accepted" ? "You Won the Quote" : label;
  const classes =
    label === "Accepted"
      ? "bg-green-700 text-white"
      : label === "Rejected" || label === "Closed"
        ? "bg-gray-200 text-gray-700"
        : "bg-amber-100 text-amber-800";
  return (
    <span className={`rounded-full px-3 py-1 text-[10px] font-extrabold uppercase ${classes}`}>
      {displayLabel}
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

function formatWeight(value) {
  const weight = Number(value || 0);
  if (!Number.isFinite(weight) || weight <= 0) return "Not available";
  return `${weight.toLocaleString("en-IN", { maximumFractionDigits: 2 })} kg`;
}
