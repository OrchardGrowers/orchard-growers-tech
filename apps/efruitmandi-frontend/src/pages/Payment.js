import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import API from "../services/api";
import { trackPaymentFailed, trackPaymentInitiated, trackPaymentSuccess } from "../services/analytics";
import { useParams, useNavigate } from "react-router-dom";
import BackHomeButton from "../components/BackHomeButton";
import { getCurrentUser, hasBuyerProfile } from "../utils/auth";
import {
  PAYMENT_PARTNER_ENABLED,
  PAYMENT_UNAVAILABLE_MESSAGE,
} from "../config/payment";

export default function Payment() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const user = getCurrentUser();
  const canUseBuyerPayment = hasBuyerProfile(user);
  const currentUserId = getEntityId(user);

  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState(null);
  const [order, setOrder] = useState(null);
  const [message, setMessage] = useState("");
  const [orderReady, setOrderReady] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchOrder = async () => {
      if (!PAYMENT_PARTNER_ENABLED || !canUseBuyerPayment) return;

      try {
        const res = await API.get(`/orders/${orderId}`);
        const orderBuyerId = getEntityId(res.data?.buyer);
        if (orderBuyerId && currentUserId && orderBuyerId !== currentUserId) {
          setMessage("You can pay only for your own consignment.");
          setOrderReady(false);
          return;
        }
        setOrder(res.data);
        setAmount(getBuyerPayableAmount(res.data));
        setOrderReady(true);
      } catch (err) {
        setMessage(err.response?.data?.msg || "Could not load this order.");
        setOrderReady(false);
      }
    };

    fetchOrder();
  }, [canUseBuyerPayment, currentUserId, orderId]);

  if (!PAYMENT_PARTNER_ENABLED) {
    return <PaymentUnavailablePanel navigate={navigate} />;
  }

  if (!canUseBuyerPayment) {
    return (
      <div className="mx-auto max-w-md rounded bg-white p-6 shadow">
        <h2 className="mb-3 text-xl font-bold">Payment unavailable</h2>
        <p className="text-sm font-semibold text-gray-600">
          Register or switch to your buyer profile to pay for consignments.
        </p>
        <button
          type="button"
          onClick={() => navigate("/profile-dashboard")}
          className="mt-4 w-full rounded bg-green-700 py-2 text-white"
        >
          Go to Profile Dashboard
        </button>
        <div className="mt-3 flex justify-center">
          <BackHomeButton />
        </div>
      </div>
    );
  }

  const handlePayment = async () => {
    if (!PAYMENT_PARTNER_ENABLED) {
      setMessage(PAYMENT_UNAVAILABLE_MESSAGE);
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      trackPaymentInitiated({
        value: amount || getBuyerPayableAmount(order),
      });

      const res = await API.post("/billdesk/pay", { orderId });
      setAmount(res.data.amount);

      await API.post("/billdesk/callback", { orderId });
      trackPaymentSuccess({
        value: res.data.amount || amount || getBuyerPayableAmount(order),
      });
      navigate(`/escrow/${orderId}?payment=success&section=logistics`);
    } catch (err) {
      trackPaymentFailed({
        value: amount || getBuyerPayableAmount(order),
      });
      setMessage(err.response?.data?.msg || "Payment failed");
    } finally {
      setLoading(false);
    }
  };

  const product = getProduct(order);
  const gradeRows = getBuyerGradeRows(order);
  const totalBoxes = getTotalBoxes(order, product, gradeRows);
  const paymentDueText = formatPaymentCountdown(order?.paymentDueAt, now);

  return (
    <div className="mx-auto w-full max-w-4xl pb-10">
      <Helmet>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <div className="mb-4 rounded bg-white p-5 shadow">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-bold">Secure Payment</h2>
            <p className="mt-1 text-sm font-semibold text-gray-600">
              Lot Chalan and platform payable amount for this consignment.
            </p>
          </div>
          {paymentDueText && (
            <span className="w-fit rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-800">
              Confirm within {paymentDueText}
            </span>
          )}
        </div>
      </div>

      {message && (
        <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
          {message}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="rounded bg-white p-5 shadow">
          <h3 className="mb-4 text-lg font-bold">Grower Lot Chalan</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoItem label="Lot No." value={product?.lotNo || shortId(product?._id || order?.product)} />
            <InfoItem label="Grower" value={getGrowerName(order)} />
            <InfoItem label="Fruit" value={product?.fruitName || product?.title} />
            <InfoItem label="Variety" value={product?.variety || product?.quality} />
            <InfoItem label="Total Boxes" value={formatQuantity(totalBoxes, product?.unit || "boxes")} />
            <InfoItem label="Packing" value={product?.packingType || product?.unit || "Box"} />
            <InfoItem label="Total Weight" value={formatWeight(product?.totalWeightKg || product?.actualWeightKg)} />
            <InfoItem label="Location" value={product?.location} />
            <InfoItem label="Chalan Date" value={formatDate(order?.createdAt)} />
            <InfoItem label="Order ID" value={orderId} mono />
          </div>
        </section>

        <section className="rounded bg-white p-5 shadow">
          <h3 className="text-lg font-bold">Amount Buyer Has To Pay</h3>
          <p className="mt-1 text-sm font-semibold text-gray-600">
            Payable through eFruitMandi platform.
          </p>

          <div className="mt-4 rounded border border-green-100 bg-green-50 p-4">
            <p className="text-sm font-semibold text-green-800">Buyer Platform Payable</p>
            <p className="mt-1 text-3xl font-bold text-green-950">
              {formatCurrency(amount)}
            </p>
            <p className="mt-2 text-xs font-semibold text-green-900">
              Unloading labour is not collected by eFruitMandi. Buyer pays it directly at unloading, if applicable.
            </p>
          </div>

          <button
            onClick={handlePayment}
            disabled={loading || !orderReady}
            className="mt-4 w-full rounded bg-blue-600 py-2 text-white disabled:bg-gray-300"
          >
            {loading ? "Processing..." : "Pay to Confirm Consignment"}
          </button>

          <p className="mt-3 text-xs text-gray-500">
            Secured via BillDesk (Test Mode)
          </p>
        </section>

        <section className="rounded bg-white p-5 shadow lg:col-span-2">
          <h3 className="mb-3 text-lg font-bold">Grade-wise Buyer Quote</h3>
          {gradeRows.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="border-b text-xs uppercase text-gray-500">
                  <tr>
                    <th className="py-2">Grade</th>
                    <th className="py-2">Quantity</th>
                    <th className="py-2">Buyer Rate</th>
                    <th className="py-2 text-right">Buyer Quote Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {gradeRows.map((row) => (
                    <tr key={row.grade} className="border-b last:border-b-0">
                      <td className="py-3 font-bold">{row.grade}</td>
                      <td className="py-3">{formatQuantity(row.quantity, product?.unit || "boxes")}</td>
                      <td className="py-3">{formatCurrency(row.rate)} per box</td>
                      <td className="py-3 text-right font-bold">{formatCurrency(row.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="rounded border border-gray-100 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-600">
              Grade-wise buyer quote will appear after the accepted quote is available.
            </p>
          )}
        </section>

        <section className="rounded bg-white p-5 shadow lg:col-span-2">
          <h3 className="text-lg font-bold">Consignment Confirmation</h3>
          <p className="mt-2 text-sm font-semibold text-gray-700">
            This payment confirms the consignment through the platform. Final release and settlement happens after the consignment is received at buyer premises, checked, and any recorded negotiation is completed.
          </p>
        </section>
      </div>

      <div className="mt-4 flex justify-center">
        <BackHomeButton />
      </div>
    </div>
  );
}

function PaymentUnavailablePanel({ navigate }) {
  return (
    <div className="mx-auto max-w-md rounded bg-white p-6 shadow">
      <Helmet>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <h2 className="mb-3 text-xl font-bold">Payment unavailable</h2>
      <p className="text-sm font-semibold text-gray-700">
        {PAYMENT_UNAVAILABLE_MESSAGE}
      </p>
      <button
        type="button"
        onClick={() => navigate("/profile-dashboard")}
        className="mt-4 w-full rounded bg-green-700 py-2 text-white"
      >
        Go to Profile Dashboard
      </button>
      <div className="mt-3 flex justify-center">
        <BackHomeButton />
      </div>
    </div>
  );
}

function InfoItem({ label, value, mono = false }) {
  return (
    <div className="rounded border border-gray-100 bg-gray-50 px-3 py-2">
      <p className="text-xs font-semibold uppercase text-gray-500">{label}</p>
      <p className={`mt-1 break-words text-sm font-bold text-gray-900 ${mono ? "font-mono" : ""}`}>
        {value || "-"}
      </p>
    </div>
  );
}

function getEntityId(value) {
  return String(value?._id || value?.id || value || "");
}

function getProduct(order) {
  return order?.product || order?.items?.[0]?.product || {};
}

function getGrowerName(order) {
  return order?.grower?.orchardName || order?.grower?.name || "-";
}

function getBuyerPayableAmount(order) {
  const value =
    order?.dealBreakdown?.dealAmount ??
    order?.dealBreakdown?.buyerPayableThroughPlatform ??
    order?.finalPrice ??
    order?.auctionPrice ??
    order?.totalAmount ??
    0;
  return Number(value || 0);
}

function getBuyerGradeRows(order) {
  const grades = order?.dealBreakdown?.grades;
  if (!Array.isArray(grades)) return [];

  return grades
    .map((grade) => {
      const quantity = Number(grade.quantity ?? grade.boxes ?? 0);
      const rate = firstPositiveNumber(
        grade.quotedRatePerUnit,
        grade.rate,
        grade.price,
        grade.buyerBidRate,
        quantity > 0 ? Number(grade.amount || 0) / quantity : 0
      );
      const amount = Number(grade.amount ?? quantity * rate);
      return {
        grade: grade.grade || grade.name || "-",
        quantity,
        rate,
        amount,
      };
    })
    .filter((grade) => grade.quantity > 0 || grade.rate > 0 || grade.amount > 0);
}

function firstPositiveNumber(...values) {
  for (const value of values) {
    const number = Number(value || 0);
    if (Number.isFinite(number) && number > 0) return number;
  }
  return 0;
}

function getTotalBoxes(order, product, gradeRows) {
  const fromGrades = gradeRows.reduce((sum, grade) => sum + Number(grade.quantity || 0), 0);
  return Number(product?.quantity || order?.dealBreakdown?.totalUnits || fromGrades || 0);
}

function formatCurrency(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return "Rs. -";
  return `Rs. ${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function formatQuantity(value, unit = "boxes") {
  const quantity = Number(value || 0);
  if (!Number.isFinite(quantity) || quantity <= 0) return "-";
  return `${quantity.toLocaleString("en-IN")} ${unit}`;
}

function formatWeight(value) {
  const weight = Number(value || 0);
  if (!Number.isFinite(weight) || weight <= 0) return "-";
  return `${weight.toLocaleString("en-IN", { maximumFractionDigits: 2 })} kg`;
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-IN");
}

function formatPaymentCountdown(value, now) {
  if (!value) return "";
  const dueAt = new Date(value).getTime();
  if (!Number.isFinite(dueAt)) return "";
  const remaining = Math.max(0, dueAt - now);
  if (!remaining) return "0m 00s";
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

function shortId(value) {
  const id = getEntityId(value);
  return id ? `LOT-${id.slice(-6).toUpperCase()}` : "-";
}
