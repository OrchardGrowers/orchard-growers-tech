import React, { useState } from "react";
import API from "../services/api";
import { getCurrentUser } from "../utils/auth";
import { useNavigate } from "react-router-dom";

export default function Delivery() {
  const navigate = useNavigate();
  const [orderId, setOrderId] = useState("");
  const [otp, setOtp] = useState("");
  const [amount, setAmount] = useState("");
  const [settlementOtp, setSettlementOtp] = useState("");
  const [message, setMessage] = useState("");
  const user = getCurrentUser();

  const runAction = async (action, successMessage) => {
    try {
      const result = await action();
      setMessage(successMessage(result));
    } catch (err) {
      setMessage(err.response?.data?.msg || err.message || "Action failed");
    }
  };

  const startDelivery = () =>
    runAction(
      () => API.post("/delivery/start", { orderId }),
      (res) => `Delivery OTP: ${res.data.deliveryOTP}`
    );

  const confirmDelivery = () =>
    runAction(
      () => API.post("/delivery/confirm-delivery", { orderId, otp }),
      () => "Delivery confirmed"
    );

  const negotiate = () =>
    runAction(
      () => API.post("/delivery/negotiate", { orderId, amount }),
      () => "Negotiation updated"
    );

  const generateOtp = () =>
    runAction(
      () => API.post("/delivery/generate-settlement-otp", { orderId }),
      (res) => `Settlement OTP: ${res.data.settlementOTP}`
    );

  const confirmPayment = () =>
    runAction(
      () => API.post("/delivery/confirm-settlement", { orderId, otp: settlementOtp }),
      () => "Payment released"
    );

  return (
    <div className="mx-auto max-w-md space-y-4 rounded bg-white p-4 shadow">
      <h2 className="text-xl font-bold">Delivery</h2>

      {message && (
        <p className="rounded bg-green-50 px-3 py-2 text-sm font-semibold text-green-800">
          {message}
        </p>
      )}

      <input
        value={orderId}
        placeholder="Order ID"
        onChange={(event) => setOrderId(event.target.value)}
        className="w-full rounded border border-gray-200 px-3 py-2 text-sm"
      />

      {user.role === "driver" && (
        <>
          <button onClick={startDelivery} className="w-full rounded bg-green-700 py-2 text-white">
            Start Delivery
          </button>
          <button onClick={() => navigate(`/tracking/${orderId}`)} className="w-full rounded bg-orange-500 py-2 text-white">
            GPS Tracking
          </button>
        </>
      )}

      {user.role === "buyer" && (
        <>
          <input
            value={otp}
            placeholder="Delivery OTP"
            onChange={(event) => setOtp(event.target.value)}
            className="w-full rounded border border-gray-200 px-3 py-2 text-sm"
          />
          <button onClick={confirmDelivery} className="w-full rounded bg-green-700 py-2 text-white">
            Confirm Delivery
          </button>

          <input
            value={amount}
            placeholder="Negotiation Amount"
            onChange={(event) => setAmount(event.target.value)}
            className="w-full rounded border border-gray-200 px-3 py-2 text-sm"
          />
          <button onClick={negotiate} className="w-full rounded bg-green-700 py-2 text-white">
            Negotiate
          </button>

          <button onClick={generateOtp} className="w-full rounded bg-blue-600 py-2 text-white">
            Generate Settlement OTP
          </button>
          <button onClick={() => navigate(`/escrow/${orderId}`)} className="w-full rounded bg-orange-500 py-2 text-white">
            View Escrow Flow
          </button>
        </>
      )}

      {user.role === "grower" && (
        <>
          <input
            value={settlementOtp}
            placeholder="Settlement OTP"
            onChange={(event) => setSettlementOtp(event.target.value)}
            className="w-full rounded border border-gray-200 px-3 py-2 text-sm"
          />
          <button onClick={confirmPayment} className="w-full rounded bg-green-700 py-2 text-white">
            Confirm Payment
          </button>
          <button onClick={() => navigate(`/escrow/${orderId}`)} className="w-full rounded bg-blue-600 py-2 text-white">
            View Escrow Flow
          </button>
        </>
      )}

      {!["buyer", "driver", "grower"].includes(user.role) && (
        <p className="text-sm font-semibold text-gray-600">
          Login with a buyer, grower, or driver account to manage delivery.
        </p>
      )}
    </div>
  );
}
