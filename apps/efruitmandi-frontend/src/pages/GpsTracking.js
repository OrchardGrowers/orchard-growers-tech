import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import API from "../services/api";
import { getCurrentUser, hasDriverProfile } from "../utils/auth";

export default function GpsTracking() {
  const { orderId } = useParams();
  const user = getCurrentUser();
  const isDriver = hasDriverProfile(user);
  const [manual, setManual] = useState({ lat: "", lng: "" });
  const [tracking, setTracking] = useState(null);
  const [message, setMessage] = useState("");

  const loadTracking = async () => {
    if (!orderId) return;
    try {
      const res = await API.get(`/delivery/track/${orderId}`);
      setTracking(res.data);
    } catch (err) {
      setMessage(err.response?.data?.msg || "Could not load tracking.");
    }
  };

  useEffect(() => {
    loadTracking();
  }, [orderId]);

  const updateLocation = async (payload) => {
    try {
      const res = await API.post("/delivery/location", { orderId, ...payload });
      setMessage(res.data?.msg || "Location updated.");
      loadTracking();
    } catch (err) {
      setMessage(err.response?.data?.msg || "Location update failed.");
    }
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
    updateLocation({ lat: manual.lat, lng: manual.lng, source: "MANUAL" });

  const lastLocation = tracking?.delivery?.lastLocation;
  const driver = tracking?.delivery?.driver;

  return (
    <div className="mx-auto max-w-lg space-y-4 rounded bg-white p-4 shadow">
      <h2 className="text-xl font-bold">GPS Tracking</h2>
      {message && <p className="rounded bg-green-50 px-3 py-2 text-sm font-semibold text-green-800">{message}</p>}

      <div className="rounded border border-gray-200 p-4 text-sm">
        <p className="font-semibold">Order ID</p>
        <p className="font-mono text-xs">{orderId}</p>
        <p className="mt-3 font-semibold">Driver / Vehicle</p>
        <p>{driver?.driverName || driver?.logisticsName || "Not assigned"} | {driver?.vehicleNumber || "Vehicle not available"}</p>
        <p className="mt-3 font-semibold">Last location</p>
        <p>
          {lastLocation
            ? `${lastLocation.lat}, ${lastLocation.lng} (${lastLocation.source})`
            : "No location update yet."}
        </p>
      </div>

      {isDriver && (
        <div className="space-y-3 rounded border border-gray-200 p-4">
          <button onClick={requestAutoLocation} className="w-full rounded bg-green-700 py-2 text-sm font-bold text-white">
            Allow Auto Location Tracking
          </button>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={manual.lat}
              placeholder="Latitude"
              onChange={(event) => setManual({ ...manual, lat: event.target.value })}
              className="rounded border border-gray-200 px-3 py-2 text-sm"
            />
            <input
              value={manual.lng}
              placeholder="Longitude"
              onChange={(event) => setManual({ ...manual, lng: event.target.value })}
              className="rounded border border-gray-200 px-3 py-2 text-sm"
            />
          </div>
          <button onClick={saveManualLocation} className="w-full rounded bg-orange-500 py-2 text-sm font-bold text-white">
            Save Manual Location
          </button>
        </div>
      )}
    </div>
  );
}
