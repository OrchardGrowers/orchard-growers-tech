import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import API from "../services/api";

export default function EscrowWorkflow() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [workflow, setWorkflow] = useState(null);
  const [message, setMessage] = useState("Loading escrow workflow...");

  useEffect(() => {
    if (!orderId) return;
    API.get(`/billdesk/escrow/${orderId}`)
      .then((res) => {
        setWorkflow(res.data);
        setMessage("");
      })
      .catch((err) => setMessage(err.response?.data?.msg || "Could not load escrow workflow."));
  }, [orderId]);

  const order = workflow?.order;

  return (
    <div className="mx-auto max-w-2xl space-y-4 rounded bg-white p-4 shadow">
      <h2 className="text-xl font-bold">Escrow Deal Workflow</h2>
      {message && <p className="rounded bg-green-50 px-3 py-2 text-sm font-semibold text-green-800">{message}</p>}

      {order && (
        <>
          <div className="rounded border border-gray-200 p-4 text-sm">
            <p className="font-semibold">Order ID</p>
            <p className="font-mono text-xs">{order._id}</p>
            <p className="mt-3">Amount: Rs. {order.finalPrice || order.auctionPrice || 0}</p>
            <p>Status: {order.paymentStatus} / {order.deliveryStatus}</p>
            <p>Driver Payment: Rs. {order.driverPayment || 0}</p>
            <p>Platform Commission: Rs. {order.platformCommission || 0}</p>
            <p>Grower Payout: Rs. {order.growerPayout || 0}</p>
          </div>

          <div className="space-y-2">
            {(workflow.steps || []).map((step) => (
              <div key={step.key} className="flex items-center justify-between rounded border border-gray-200 px-3 py-2 text-sm">
                <span className="font-semibold">{step.label}</span>
                <span className={step.complete ? "font-bold text-green-700" : "font-bold text-gray-400"}>
                  {step.complete ? "Done" : "Pending"}
                </span>
              </div>
            ))}
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <button onClick={() => navigate(`/payment/${order._id}`)} className="rounded bg-blue-600 py-2 text-sm font-bold text-white">
              BillDesk Payment
            </button>
            <button onClick={() => navigate("/delivery")} className="rounded bg-green-700 py-2 text-sm font-bold text-white">
              Delivery Actions
            </button>
            <button onClick={() => navigate(`/tracking/${order._id}`)} className="rounded bg-orange-500 py-2 text-sm font-bold text-white">
              Track Consignment
            </button>
          </div>
        </>
      )}
    </div>
  );
}
