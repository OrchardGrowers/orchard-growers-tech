import { useEffect, useState } from "react";
import API from "../services/api";
import { useParams, useNavigate } from "react-router-dom";
import { isGrowerAccount } from "../utils/auth";

export default function Payment() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const isGrower = isGrowerAccount();

  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (isGrower) return;

    const fetchOrder = async () => {
      try {
        const res = await API.get(`/orders/${orderId}`);
        setAmount(res.data.finalPrice || res.data.auctionPrice);
      } catch (err) {
        setMessage(err.response?.data?.msg || "Could not load this order.");
      }
    };

    fetchOrder();
  }, [isGrower, orderId]);

  if (isGrower) {
    return (
      <div className="mx-auto max-w-md rounded bg-white p-6 shadow">
        <h2 className="mb-3 text-xl font-bold">Payment unavailable</h2>
        <p className="text-sm font-semibold text-gray-600">
          Grower accounts cannot buy fruit lots or pay for consignments.
        </p>
        <button
          type="button"
          onClick={() => navigate("/profile-dashboard")}
          className="mt-4 w-full rounded bg-green-700 py-2 text-white"
        >
          Go to Profile Dashboard
        </button>
      </div>
    );
  }

  const handlePayment = async () => {
    setLoading(true);
    setMessage("");

    try {
      const res = await API.post("/billdesk/pay", { orderId });
      setAmount(res.data.amount);

      await API.post("/billdesk/callback", { orderId });
      navigate(`/escrow/${orderId}`);
    } catch (err) {
      setMessage(err.response?.data?.msg || "Payment failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white shadow p-6 rounded">
      <h2 className="text-xl font-bold mb-4">Secure Payment</h2>

      {message && (
        <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
          {message}
        </p>
      )}

      <div className="border p-4 rounded mb-4">
        <p className="text-gray-500">Order ID</p>
        <p className="font-mono text-sm">{orderId}</p>

        <p className="mt-3 text-gray-500">Amount</p>
        <p className="text-2xl font-bold">Rs. {amount || "-"}</p>
      </div>

      <button
        onClick={handlePayment}
        disabled={loading}
        className="w-full bg-blue-600 text-white py-2 rounded disabled:bg-gray-300"
      >
        {loading ? "Processing..." : "Pay Now"}
      </button>

      <p className="text-xs text-gray-500 mt-3">
        Secured via BillDesk (Test Mode)
      </p>
    </div>
  );
}
