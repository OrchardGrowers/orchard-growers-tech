import { useEffect, useMemo, useState } from "react";
import {
  FaCheck,
  FaClock,
  FaCompass,
  FaEye,
  FaHandHoldingUsd,
  FaMapMarkerAlt,
  FaMoneyBillWave,
  FaRoute,
  FaSeedling,
  FaTruck,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import API from "../services/api";
import BackHomeButton from "../components/BackHomeButton";
import {
  getCurrentUser,
  hasBuyerProfile,
  hasDriverProfile,
  hasGrowerProfile,
} from "../utils/auth";

const statusSteps = [
  { key: "PLACED", label: "Order placed" },
  { key: "PENDING", label: "Partner pending" },
  { key: "IN_TRANSIT", label: "In transit" },
  { key: "DELIVERED", label: "Delivered" },
];

export default function Delivery() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const isDriver = hasDriverProfile(user);
  const isBuyer = hasBuyerProfile(user);
  const isGrower = hasGrowerProfile(user);
  const [orders, setOrders] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [tracking, setTracking] = useState(null);
  const [deliveryTracking, setDeliveryTracking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [deliveryOtp, setDeliveryOtp] = useState("");
  const [settlementOtp, setSettlementOtp] = useState("");
  const [negotiationAmount, setNegotiationAmount] = useState("");
  const [manualLocation, setManualLocation] = useState({ lat: "", lng: "" });

  const selectedOrder = useMemo(
    () => orders.find((order) => order._id === selectedOrderId) || null,
    [orders, selectedOrderId]
  );

  const metrics = useMemo(() => {
    const inTransit = orders.filter((order) => order.deliveryStatus === "IN_TRANSIT").length;
    const delivered = orders.filter((order) => order.deliveryStatus === "DELIVERED").length;
    const pending = orders.filter((order) => !["IN_TRANSIT", "DELIVERED"].includes(order.deliveryStatus)).length;
    return { inTransit, delivered, pending };
  }, [orders]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const res = await API.get("/orders");
      const nextOrders = res.data || [];
      setOrders(nextOrders);
      setSelectedOrderId((current) => current || nextOrders[0]?._id || "");
    } catch (err) {
      setMessage(err.response?.data?.msg || "Could not load delivery orders.");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const loadTracking = async (orderId = selectedOrderId) => {
    if (!orderId) return;
    try {
      setTrackingLoading(true);
      const [courierRes, deliveryRes] = await Promise.all([
        API.get(`/orders/${orderId}/tracking`).catch((err) => ({ error: err })),
        API.get(`/delivery/track/${orderId}`).catch((err) => ({ error: err })),
      ]);

      setTracking(courierRes.error ? null : courierRes.data);
      setDeliveryTracking(deliveryRes.error ? null : deliveryRes.data);
    } finally {
      setTrackingLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  useEffect(() => {
    loadTracking(selectedOrderId);
  }, [selectedOrderId]);

  const runAction = async (action, successMessage) => {
    if (!selectedOrderId) {
      setMessage("Select an order first.");
      return;
    }

    try {
      const result = await action();
      setMessage(successMessage(result));
      await loadOrders();
      await loadTracking(selectedOrderId);
    } catch (err) {
      setMessage(err.response?.data?.msg || err.message || "Action failed");
    }
  };

  const startDelivery = () =>
    runAction(
      () => API.post("/delivery/start", { orderId: selectedOrderId }),
      (res) => `Delivery started. Buyer OTP: ${res.data.deliveryOTP}`
    );

  const confirmDelivery = () =>
    runAction(
      () => API.post("/delivery/confirm-delivery", { orderId: selectedOrderId, otp: deliveryOtp }),
      () => "Delivery confirmed. Negotiation is now unlocked."
    );

  const negotiate = () =>
    runAction(
      () => API.post("/delivery/negotiate", { orderId: selectedOrderId, amount: negotiationAmount }),
      (res) => `Negotiation updated. Final amount: Rs. ${res.data.finalAmount || negotiationAmount || 0}`
    );

  const generateSettlementOtp = () =>
    runAction(
      () => API.post("/delivery/generate-settlement-otp", { orderId: selectedOrderId }),
      (res) => `Settlement OTP generated: ${res.data.settlementOTP}`
    );

  const confirmSettlement = () =>
    runAction(
      () => API.post("/delivery/confirm-settlement", { orderId: selectedOrderId, otp: settlementOtp }),
      (res) => `Payment released. Receivable: Rs. ${res.data.finalReceivableAmount || 0}`
    );

  const updateLocation = async (payload) => {
    await runAction(
      () => API.post("/delivery/location", { orderId: selectedOrderId, ...payload }),
      () => "Location updated."
    );
  };

  const requestAutoLocation = () => {
    if (!navigator.geolocation) {
      setMessage("Auto location is not supported on this device.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) =>
        updateLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          source: "AUTO",
        }),
      () => setMessage("Location permission denied or unavailable."),
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  const saveManualLocation = () =>
    updateLocation({ lat: manualLocation.lat, lng: manualLocation.lng, source: "MANUAL" });

  return (
    <div className="mx-auto max-w-6xl pb-20">
      <header className="-mx-3 bg-green-800 px-4 pb-5 pt-4 text-white md:-mx-4 md:px-6">
        <div className="mx-auto max-w-6xl">
          <p className="flex items-center gap-2 text-xs font-extrabold uppercase text-green-100">
            <FaTruck />
            eFruitMandi Delivery Desk
          </p>
          <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-2xl font-black md:text-3xl">Delivery & Tracking</h1>
              <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-green-50">
                Manage consignment pickup, buyer confirmation, settlement, and live logistics updates.
              </p>
            </div>
            <button
              type="button"
              onClick={() => selectedOrderId && navigate(`/tracking/${selectedOrderId}`)}
              disabled={!selectedOrderId}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-extrabold text-green-800 shadow-sm disabled:cursor-not-allowed disabled:bg-green-100 disabled:text-green-500"
            >
              <FaCompass />
              GPS Tracking
            </button>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2 text-center">
            <Metric label="Pending" value={metrics.pending} />
            <Metric label="In Transit" value={metrics.inTransit} />
            <Metric label="Delivered" value={metrics.delivered} />
          </div>
        </div>
      </header>

      {message && (
        <div className="mt-4 rounded-md border border-green-100 bg-white px-3 py-3 text-sm font-bold text-green-800 shadow-sm">
          {message}
        </div>
      )}

      {!isBuyer && !isDriver && !isGrower && (
        <div className="mt-4 rounded-lg border border-dashed border-green-200 bg-green-50 px-4 py-5 text-green-900">
          <p className="text-sm font-black">Login with a buyer, grower, or driver account to manage delivery.</p>
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-black text-gray-950">Orders</h2>
            <button
              type="button"
              onClick={loadOrders}
              className="rounded-full bg-white px-3 py-1.5 text-[10px] font-extrabold text-green-800 ring-1 ring-green-100"
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <OrderSkeleton />
          ) : orders.length ? (
            <div className="space-y-2">
              {orders.map((order) => (
                <OrderCard
                  key={order._id}
                  order={order}
                  selected={order._id === selectedOrderId}
                  onSelect={() => setSelectedOrderId(order._id)}
                />
              ))}
            </div>
          ) : (
            <EmptyState />
          )}
        </section>

        <section className="space-y-4">
          <TrackingPanel
            order={selectedOrder}
            tracking={tracking}
            deliveryTracking={deliveryTracking}
            loading={trackingLoading}
            onOpenEscrow={() => selectedOrderId && navigate(`/escrow/${selectedOrderId}`)}
          />

          <RoleActionPanel
            isDriver={isDriver}
            isBuyer={isBuyer}
            isGrower={isGrower}
            selectedOrderId={selectedOrderId}
            deliveryOtp={deliveryOtp}
            setDeliveryOtp={setDeliveryOtp}
            settlementOtp={settlementOtp}
            setSettlementOtp={setSettlementOtp}
            negotiationAmount={negotiationAmount}
            setNegotiationAmount={setNegotiationAmount}
            manualLocation={manualLocation}
            setManualLocation={setManualLocation}
            startDelivery={startDelivery}
            confirmDelivery={confirmDelivery}
            negotiate={negotiate}
            generateSettlementOtp={generateSettlementOtp}
            confirmSettlement={confirmSettlement}
            requestAutoLocation={requestAutoLocation}
            saveManualLocation={saveManualLocation}
          />
        </section>
      </div>

      <div className="mt-6 flex justify-center">
        <BackHomeButton />
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-md bg-white/10 px-3 py-3 ring-1 ring-white/15">
      <p className="text-xl font-black">{value}</p>
      <p className="mt-1 text-[10px] font-extrabold uppercase text-green-100">{label}</p>
    </div>
  );
}

function OrderCard({ order, selected, onSelect }) {
  const title = order.product?.title || order.items?.[0]?.title || "Fruit consignment";
  const amount = order.finalPrice || order.totalAmount || order.auctionPrice || order.sellerReceivable || 0;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-lg border bg-white p-3 text-left shadow-sm ${
        selected ? "border-green-500 ring-2 ring-green-100" : "border-gray-200 hover:border-green-200"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="line-clamp-1 text-sm font-black text-gray-950">{title}</h3>
          <p className="mt-1 truncate text-[11px] font-bold text-gray-600">
            {order.invoiceNumber || shortId(order._id)}
          </p>
        </div>
        <StatusChip status={order.deliveryStatus || "PENDING"} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-bold">
        <InfoPill label="Payment" value={order.paymentStatus || "PENDING"} />
        <InfoPill label="Amount" value={`Rs. ${amount}`} />
      </div>
    </button>
  );
}

function TrackingPanel({ order, tracking, deliveryTracking, loading, onOpenEscrow }) {
  const delivery = deliveryTracking?.delivery;
  const driver = delivery?.driver || order?.driver;
  const lastLocation = delivery?.lastLocation;
  const currentStatus = tracking?.deliveryStatus || order?.deliveryStatus || "PENDING";
  const trackingNumber = tracking?.trackingNumber || order?.trackingNumber || "";

  if (!order) {
    return (
      <section className="rounded-lg border border-dashed border-green-200 bg-green-50 p-5 text-green-900">
        <FaRoute className="text-2xl" />
        <p className="mt-3 text-sm font-black">Select an order to view tracking.</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-wide text-green-700">Tracking Overview</p>
          <h2 className="mt-1 text-lg font-black text-gray-950">{order.product?.title || order.items?.[0]?.title || "Fruit consignment"}</h2>
          <p className="mt-1 text-xs font-bold text-gray-600">{order.invoiceNumber || shortId(order._id)}</p>
        </div>
        <button
          type="button"
          onClick={onOpenEscrow}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-green-700 px-4 py-2 text-xs font-extrabold text-white hover:bg-green-800"
        >
          <FaEye />
          Escrow Flow
        </button>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <InfoPill label="Courier" value={tracking?.courierPartner || order.courierPartner || "India Post"} />
        <InfoPill label="Booking" value={tracking?.courierBookingStatus || order.courierBookingStatus || "PENDING"} />
        <InfoPill label="Tracking No." value={trackingNumber || "Pending"} />
      </div>

      <div className="mt-4 rounded-md bg-green-50 p-3">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="min-w-0">
            <p className="text-xs font-black text-gray-950">Driver / Vehicle</p>
            <p className="mt-1 truncate text-xs font-bold text-gray-700">
              {driver?.driverName || driver?.logisticsName || driver?.name || "Not assigned"} | {driver?.vehicleNumber || "Vehicle pending"}
            </p>
          </div>
          <StatusChip status={currentStatus} />
        </div>
        <p className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold text-gray-700">
          <FaMapMarkerAlt className="text-green-700" />
          {lastLocation
            ? `${lastLocation.lat}, ${lastLocation.lng} (${lastLocation.source || "MANUAL"})`
            : "No GPS location update yet."}
        </p>
        {lastLocation?.lat && lastLocation?.lng && (
          <a
            href={`https://www.google.com/maps?q=${lastLocation.lat},${lastLocation.lng}`}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex rounded-full bg-white px-3 py-1.5 text-[10px] font-extrabold text-green-800 ring-1 ring-green-100"
          >
            Open map point
          </a>
        )}
      </div>

      <div className="mt-4">
        <p className="mb-3 text-xs font-black text-gray-950">Delivery progress</p>
        <div className="space-y-3">
          {statusSteps.map((step) => {
            const done = isStepDone(step.key, currentStatus, tracking);
            return (
              <div key={step.key} className="flex gap-3">
                <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] ${
                  done ? "bg-green-700 text-white" : "bg-gray-100 text-gray-500"
                }`}>
                  {done ? <FaCheck /> : <FaClock />}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-black text-gray-950">{step.label}</p>
                  <p className="text-xs font-bold text-gray-500">{getStepDetail(step.key, tracking, order)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {loading && <p className="mt-4 text-xs font-bold text-green-700">Refreshing tracking...</p>}
    </section>
  );
}

function RoleActionPanel(props) {
  const {
    isDriver,
    isBuyer,
    isGrower,
    selectedOrderId,
    deliveryOtp,
    setDeliveryOtp,
    settlementOtp,
    setSettlementOtp,
    negotiationAmount,
    setNegotiationAmount,
    manualLocation,
    setManualLocation,
    startDelivery,
    confirmDelivery,
    negotiate,
    generateSettlementOtp,
    confirmSettlement,
    requestAutoLocation,
    saveManualLocation,
  } = props;

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-extrabold uppercase tracking-wide text-green-700">Panel Actions</p>
      <h2 className="mt-1 text-lg font-black text-gray-950">Delivery Controls</h2>

      <div className="mt-4 grid gap-3">
        {isDriver && (
          <ActionBox icon={<FaTruck />} title="Driver actions">
            <button type="button" onClick={startDelivery} disabled={!selectedOrderId} className={primaryButtonClass}>
              Start Delivery
            </button>
            <button type="button" onClick={requestAutoLocation} disabled={!selectedOrderId} className={secondaryButtonClass}>
              Allow Auto Location Tracking
            </button>
            <div className="grid grid-cols-2 gap-2">
              <TextInput value={manualLocation.lat} placeholder="Latitude" onChange={(value) => setManualLocation({ ...manualLocation, lat: value })} />
              <TextInput value={manualLocation.lng} placeholder="Longitude" onChange={(value) => setManualLocation({ ...manualLocation, lng: value })} />
            </div>
            <button type="button" onClick={saveManualLocation} disabled={!selectedOrderId} className={secondaryButtonClass}>
              Save Manual Location
            </button>
          </ActionBox>
        )}

        {isBuyer && (
          <ActionBox icon={<FaMoneyBillWave />} title="Buyer actions">
            <TextInput value={deliveryOtp} placeholder="Delivery OTP" onChange={setDeliveryOtp} />
            <button type="button" onClick={confirmDelivery} disabled={!selectedOrderId} className={primaryButtonClass}>
              Confirm Delivery
            </button>
            <TextInput value={negotiationAmount} placeholder="Negotiation Amount" onChange={setNegotiationAmount} />
            <button type="button" onClick={negotiate} disabled={!selectedOrderId} className={secondaryButtonClass}>
              Update Negotiation
            </button>
            <button type="button" onClick={generateSettlementOtp} disabled={!selectedOrderId} className={secondaryButtonClass}>
              Generate Settlement OTP
            </button>
          </ActionBox>
        )}

        {isGrower && (
          <ActionBox icon={<FaHandHoldingUsd />} title="Grower actions">
            <TextInput value={settlementOtp} placeholder="Settlement OTP" onChange={setSettlementOtp} />
            <button type="button" onClick={confirmSettlement} disabled={!selectedOrderId} className={primaryButtonClass}>
              Confirm Payment Release
            </button>
          </ActionBox>
        )}

        {!isBuyer && !isDriver && !isGrower && (
          <p className="rounded-md bg-green-50 px-3 py-3 text-sm font-bold text-green-900">
            Delivery actions unlock after login with a buyer, grower, or driver profile.
          </p>
        )}
      </div>
    </section>
  );
}

const primaryButtonClass =
  "w-full rounded-md bg-green-700 px-3 py-2 text-sm font-extrabold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-gray-300";
const secondaryButtonClass =
  "w-full rounded-md bg-green-50 px-3 py-2 text-sm font-extrabold text-green-800 ring-1 ring-green-100 hover:bg-green-100 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400";

function ActionBox({ icon, title, children }) {
  return (
    <div className="rounded-md border border-green-100 bg-green-50 p-3">
      <p className="mb-3 flex items-center gap-2 text-sm font-black text-gray-950">
        <span className="text-green-700">{icon}</span>
        {title}
      </p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function TextInput({ value, placeholder, onChange }) {
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-md border border-green-100 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-green-700"
    />
  );
}

function InfoPill({ label, value }) {
  return (
    <div className="rounded-md bg-gray-50 px-3 py-2">
      <p className="text-[10px] font-extrabold uppercase text-gray-500">{label}</p>
      <p className="mt-1 truncate text-xs font-black text-gray-950">{value || "Not available"}</p>
    </div>
  );
}

function StatusChip({ status = "PENDING" }) {
  const normalized = String(status || "PENDING").toUpperCase();
  const statusClass =
    normalized === "DELIVERED"
      ? "bg-green-100 text-green-800"
      : normalized === "IN_TRANSIT"
        ? "bg-amber-100 text-amber-800"
        : "bg-gray-100 text-gray-700";

  return (
    <span className={`shrink-0 rounded px-2 py-1 text-[9px] font-extrabold ${statusClass}`}>
      {normalized.replace(/_/g, " ")}
    </span>
  );
}

function OrderSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((item) => (
        <div key={item} className="animate-pulse rounded-lg border border-green-100 bg-white p-3">
          <div className="h-4 w-2/3 rounded bg-gray-100" />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="h-12 rounded bg-green-50" />
            <div className="h-12 rounded bg-green-50" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-green-200 bg-green-50 px-4 py-5 text-green-900">
      <FaSeedling className="text-2xl" />
      <p className="mt-3 text-sm font-black">No delivery orders yet.</p>
      <p className="mt-1 text-xs font-bold text-green-800">Orders linked to your account will appear here.</p>
    </div>
  );
}

function isStepDone(step, currentStatus, tracking) {
  const normalized = String(currentStatus || "PENDING").toUpperCase();
  if (step === "PLACED") return true;
  if (step === "PENDING") return Boolean(tracking?.trackingNumber) || ["IN_TRANSIT", "DELIVERED"].includes(normalized);
  if (step === "IN_TRANSIT") return ["IN_TRANSIT", "DELIVERED"].includes(normalized);
  if (step === "DELIVERED") return normalized === "DELIVERED";
  return false;
}

function getStepDetail(step, tracking, order) {
  if (step === "PLACED") return formatDate(order?.createdAt);
  if (step === "PENDING") return tracking?.trackingNumber ? `Tracking ${tracking.trackingNumber}` : "Awaiting booking";
  if (step === "IN_TRANSIT") return "Driver or courier movement updates";
  if (step === "DELIVERED") return "Buyer confirmation completes this step";
  return "";
}

function formatDate(value) {
  if (!value) return "Not available";
  return new Date(value).toLocaleString([], {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shortId(value = "") {
  return value ? `Order ${String(value).slice(-8)}` : "Order";
}
