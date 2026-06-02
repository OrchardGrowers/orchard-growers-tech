import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaIdCard, FaMapMarkerAlt, FaPhoneAlt, FaTruck } from "react-icons/fa";
import API from "../services/api";
import { getCurrentUser, hasBuyerProfile, hasDriverProfile } from "../utils/auth";

export default function RegisterDriver() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const [accountUser, setAccountUser] = useState(currentUser);
  const isUpdate = hasDriverProfile(accountUser);
  const hasBlockedBuyerProfile = hasBuyerProfile(accountUser);
  const [form, setForm] = useState({
    logisticsName: currentUser.logisticsName || "",
    logisticsOwnerName: currentUser.logisticsOwnerName || "",
    logisticsOwnerContact: currentUser.logisticsOwnerContact || "",
    ownerIsDriver: currentUser.ownerIsDriver ?? true,
    driverName: currentUser.driverName || "",
    driverContact: currentUser.driverContact || "",
    vehicleNumber: currentUser.vehicleNumber || "",
    licenseNumber: currentUser.licenseNumber || "",
    location: currentUser.location || "",
    contact: currentUser.contact || currentUser.phone || "",
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    API.get("/user/profile")
      .then((res) => {
        const latestUser = res.data || currentUser;
        setAccountUser(latestUser);
        localStorage.setItem("user", JSON.stringify(latestUser));
      })
      .catch(() => {});
  }, []);

  const updateForm = (field, value) => {
    setForm({ ...form, [field]: value });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage("");

    if (hasBlockedBuyerProfile) {
      setMessage("Driver profile cannot be added because this account is already registered as Buyer.");
      return;
    }

    if (!form.logisticsName.trim() || !form.vehicleNumber.trim() || !form.contact.trim()) {
      setMessage("Logistics name, vehicle number, and contact number are required.");
      return;
    }

    try {
      setLoading(true);
      const res = await API.post("/user/set-role", {
        role: "driver",
        logisticsName: form.logisticsName.trim(),
        logisticsOwnerName: form.logisticsOwnerName.trim() || form.logisticsName.trim(),
        logisticsOwnerContact: form.logisticsOwnerContact.trim() || form.contact.trim(),
        ownerIsDriver: form.ownerIsDriver,
        driverName: form.ownerIsDriver ? (form.logisticsOwnerName.trim() || form.logisticsName.trim()) : form.driverName.trim(),
        driverContact: form.ownerIsDriver ? (form.logisticsOwnerContact.trim() || form.contact.trim()) : form.driverContact.trim(),
        vehicleNumber: form.vehicleNumber.trim(),
        licenseNumber: form.licenseNumber.trim(),
        location: form.location.trim(),
        contact: form.contact.trim(),
      });

      localStorage.setItem("user", JSON.stringify(res.data.user));
      navigate("/delivery");
    } catch (err) {
      setMessage(err.response?.data?.msg || "Driver registration failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[999] overflow-y-auto bg-[#18a64b]">
      <div className="flex min-h-screen items-center justify-center px-4 py-8">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl shadow-green-900/10"
        >
          <div className="mb-6">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 text-orange-600">
              <FaTruck />
            </div>
            <p className="text-sm font-semibold text-orange-600">
              Logistics profile
            </p>
            <h2 className="mt-1 text-2xl font-bold text-gray-950">
              {isUpdate ? "Update Driver Profile" : "Register as Driver"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-gray-500">
              Deliver consignments, update delivery status, and manage transport details.
            </p>
          </div>

          {(hasBlockedBuyerProfile || message) && (
            <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {hasBlockedBuyerProfile
                ? "Driver profile cannot be added because this account is already registered as Buyer."
                : message}
            </div>
          )}

          <div className="space-y-4">
            <Field
              icon={<FaTruck />}
              label="Logistics partner name"
              value={form.logisticsName}
              placeholder="Fast Fruit Logistics"
              onChange={(value) => updateForm("logisticsName", value)}
            />
            <Field
              icon={<FaIdCard />}
              label="Vehicle owner name"
              value={form.logisticsOwnerName}
              placeholder="Owner name"
              onChange={(value) => updateForm("logisticsOwnerName", value)}
            />
            <Field
              icon={<FaPhoneAlt />}
              label="Vehicle owner contact"
              value={form.logisticsOwnerContact}
              placeholder="Owner phone number"
              inputMode="tel"
              onChange={(value) => updateForm("logisticsOwnerContact", value)}
            />
            <label className="flex items-center gap-2 rounded-md bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-700">
              <input
                type="checkbox"
                checked={form.ownerIsDriver}
                onChange={(event) => updateForm("ownerIsDriver", event.target.checked)}
              />
              Owner and driver are same
            </label>
            {!form.ownerIsDriver && (
              <>
                <Field
                  icon={<FaIdCard />}
                  label="Driver name"
                  value={form.driverName}
                  placeholder="Driver name"
                  onChange={(value) => updateForm("driverName", value)}
                />
                <Field
                  icon={<FaPhoneAlt />}
                  label="Driver contact"
                  value={form.driverContact}
                  placeholder="Driver phone number"
                  inputMode="tel"
                  onChange={(value) => updateForm("driverContact", value)}
                />
              </>
            )}
            <Field
              icon={<FaTruck />}
              label="Vehicle number"
              value={form.vehicleNumber}
              placeholder="HP01AB1234"
              onChange={(value) => updateForm("vehicleNumber", value)}
            />
            <Field
              icon={<FaIdCard />}
              label="License number"
              value={form.licenseNumber}
              placeholder="DL-123456789"
              onChange={(value) => updateForm("licenseNumber", value)}
            />
            <Field
              icon={<FaMapMarkerAlt />}
              label="Operating location"
              value={form.location}
              placeholder="Mandi, Himachal Pradesh"
              onChange={(value) => updateForm("location", value)}
            />
            <Field
              icon={<FaPhoneAlt />}
              label="Contact number"
              value={form.contact}
              placeholder="Enter phone number"
              inputMode="tel"
              onChange={(value) => updateForm("contact", value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading || hasBlockedBuyerProfile}
            className="mt-6 w-full rounded-md bg-orange-500 py-3 text-sm font-bold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {loading ? "Saving..." : isUpdate ? "Update Driver Profile" : "Register as Driver"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({ icon, label, value, placeholder, onChange, inputMode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-gray-700">
        {label}
      </span>
      <span className="flex items-center gap-3 rounded-md border border-gray-200 bg-white px-3 py-3 text-gray-400 transition focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-100">
        {icon}
        <input
          value={value}
          placeholder={placeholder}
          inputMode={inputMode}
          onChange={(event) => onChange(event.target.value)}
          className="w-full bg-transparent text-sm text-gray-950 outline-none placeholder:text-gray-400"
        />
      </span>
    </label>
  );
}
