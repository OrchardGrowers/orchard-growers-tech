import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import API from "../services/api";
import BackHomeButton from "../components/BackHomeButton";
import { isGrowerAccount } from "../utils/auth";

export default function EscrowWorkflow() {
  const { orderId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [workflow, setWorkflow] = useState(null);
  const [message, setMessage] = useState("Loading escrow workflow...");
  const query = new URLSearchParams(location.search);
  const paymentSuccess = query.get("payment") === "success";

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
  const isGrower = isGrowerAccount();

  return (
    <div className="mx-auto max-w-2xl space-y-4 rounded bg-white p-4 shadow">
      <h2 className="text-xl font-bold">Escrow Deal Workflow</h2>
      {paymentSuccess && (
        <p className="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm font-bold text-green-800">
          BillDesk demo payment completed. Logistics details are now open for this consignment.
        </p>
      )}
      {message && <p className="rounded bg-green-50 px-3 py-2 text-sm font-semibold text-green-800">{message}</p>}

      {order && (
        <>
          <div className="rounded border border-gray-200 p-4 text-sm">
            <p className="font-semibold">Order ID</p>
            <p className="font-mono text-xs">{order._id}</p>
            {isGrower ? (
              <p className="mt-3">You Will Receive: Rs. {order.sellerReceivable || order.growerPayout || order.auctionPrice || 0}</p>
            ) : (
              <p className="mt-3">Amount Payable: Rs. {order.finalPrice || order.auctionPrice || 0}</p>
            )}
            <p>Status: {order.paymentStatus} / {order.deliveryStatus}</p>
            {!isGrower && (
              <>
                <p>Driver Charges: Rs. {order.driverPayment || 0}</p>
                <p>Platform Commission: Rs. {order.platformCommission || 0}</p>
              </>
            )}
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

          <LogisticsDetailsPanel order={order} />

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
      <div className="flex justify-center">
        <BackHomeButton />
      </div>
    </div>
  );
}

function LogisticsDetailsPanel({ order }) {
  const assignment = order.logisticsAssignment || {};
  const status = assignment.status || "AWAITING_GROWER_DETAILS";
  const driverName = assignment.driverName || order.driver?.driverName || order.driver?.logisticsName || order.driver?.name || "";
  const vehicleNumber = assignment.vehicleNumber || order.driver?.vehicleNumber || "";

  return (
    <section className="rounded border border-orange-200 bg-orange-50 p-4 text-sm">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-bold text-orange-950">Logistics Details</h3>
          <p className="text-xs font-semibold text-orange-800">
            Required after BillDesk escrow payment before dispatch can proceed.
          </p>
        </div>
        <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-bold text-orange-800">
          {formatStatus(status)}
        </span>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <DetailItem label="Transport firm" value={assignment.transportFirmName} />
        <DetailItem label="Driver / logistics" value={driverName || "Awaiting grower details"} />
        <DetailItem label="Mobile" value={assignment.driverMobile} />
        <DetailItem label="Vehicle" value={vehicleNumber} />
        <DetailItem label="Pickup date" value={formatDate(assignment.pickupDate)} />
        <DetailItem label="Dispatch date" value={formatDate(assignment.expectedDispatchDate)} />
      </div>

      {status === "AWAITING_GROWER_DETAILS" && (
        <p className="mt-3 rounded bg-white px-3 py-2 text-xs font-bold text-orange-900">
          Grower must open Profile Dashboard and save logistics or driver details for this paid consignment.
        </p>
      )}
    </section>
  );
}

function DetailItem({ label, value }) {
  return (
    <div className="rounded bg-white px-3 py-2">
      <p className="text-[10px] font-bold uppercase text-gray-500">{label}</p>
      <p className="mt-1 break-words font-bold text-gray-900">{value || "-"}</p>
    </div>
  );
}

function formatStatus(value) {
  return String(value || "PENDING").replace(/_/g, " ");
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN");
}
