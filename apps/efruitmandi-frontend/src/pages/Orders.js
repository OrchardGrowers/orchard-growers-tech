import { useEffect, useState } from "react";
import API from "../services/api";
import { useNavigate } from "react-router-dom";
import { isGrowerAccount } from "../utils/auth";
import {
  PAYMENT_PARTNER_ENABLED,
  PAYMENT_UNAVAILABLE_MESSAGE,
} from "../config/payment";

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();
  const isGrower = isGrowerAccount();

  const openPaymentRoute = (path) => {
    if (!PAYMENT_PARTNER_ENABLED) {
      setMessage(PAYMENT_UNAVAILABLE_MESSAGE);
      return;
    }

    navigate(path);
  };

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await API.get("/orders");
        setOrders(res.data || []);
      } catch (err) {
        setMessage(err.response?.data?.msg || "Could not load orders.");
      }
    };

    fetchOrders();
  }, []);

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Orders</h2>

      {message && (
        <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
          {message}
        </p>
      )}

      {!orders.length && !message && (
        <p className="text-sm font-semibold text-gray-500">No orders yet.</p>
      )}

      {orders.map((order) => (
        <div key={order._id} className="border p-4 mb-3 rounded">
          <p>Product: {order.product?.title || "Fruit lot"}</p>
          {isGrower ? (
            <p>You Will Receive: Rs. {order.sellerReceivable || order.growerPayout || order.auctionPrice || 0}</p>
          ) : (
            <p>Amount Payable: Rs. {order.finalPrice || order.totalAmount || order.auctionPrice || 0}</p>
          )}
          <p>Status: {order.paymentStatus}</p>
          <p>Delivery: {order.deliveryStatus || "PENDING"}</p>

          {order.paymentStatus === "PENDING" && !isGrower && (
            <button
              onClick={() => openPaymentRoute(`/payment/${order._id}`)}
              className="mt-2 bg-green-600 text-white px-3 py-1 rounded"
            >
              Pay Now
            </button>
          )}

          {order.paymentStatus === "PENDING" && isGrower && (
            <p className="mt-2 text-xs font-bold text-gray-500">
              Grower accounts cannot buy or pay for consignments.
            </p>
          )}

          <div className="mt-2 flex flex-wrap gap-2">
            <button
              onClick={() => openPaymentRoute(`/escrow/${order._id}`)}
              className="rounded bg-blue-600 px-3 py-1 text-sm text-white"
            >
              Escrow Flow
            </button>
            {order.deliveryStatus && order.deliveryStatus !== "PENDING" && (
              <button
                onClick={() => navigate(`/tracking/${order._id}`)}
                className="rounded bg-orange-500 px-3 py-1 text-sm text-white"
              >
                Track
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
