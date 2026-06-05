import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaCheck,
  FaBriefcase,
  FaMapMarkerAlt,
  FaPaperPlane,
  FaPhoneAlt,
  FaSeedling,
} from "react-icons/fa";
import API from "../services/api";
import AuthBrandShell from "../components/AuthBrandShell";
import {
  getEfruitMandiWidgetId,
  getEfruitMandiTokenAuth,
  normalizeIndianMobile,
  retryMsg91WidgetOtp,
  sendMsg91WidgetOtp,
  verifyMsg91WidgetOtp,
} from "../utils/msg91OtpWidget";
import { getCurrentUser, hasGrowerProfile } from "../utils/auth";
import { requestLocationPermission } from "../utils/permissionConsent";

export default function RegisterGrower() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const isUpdate = hasGrowerProfile(currentUser);
  const savedContact = currentUser.contact || currentUser.phone || "";
  const [form, setForm] = useState({
    orchardName: currentUser.orchardName || "",
    designation: currentUser.designation || "",
    location: currentUser.location || "",
    addressLine1: currentUser.addressLine1 || "",
    addressLine2: currentUser.addressLine2 || "",
    addressLine3: currentUser.addressLine3 || "",
    pinCode: currentUser.pinCode || "",
    mapLatitude: currentUser.mapLatitude || "",
    mapLongitude: currentUser.mapLongitude || "",
    googleMapUrl: currentUser.googleMapUrl || "",
    contact: savedContact,
  });
  const [loading, setLoading] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpReqId, setOtpReqId] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [verifiedPhone, setVerifiedPhone] = useState(isUpdate ? savedContact : "");
  const [otpVerificationToken, setOtpVerificationToken] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (otpCooldown <= 0) return undefined;
    const timer = window.setTimeout(() => setOtpCooldown((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [otpCooldown]);

  const updateForm = (field, value) => {
    setForm({ ...form, [field]: value });
    if (field === "contact") {
      setOtp("");
      setOtpReqId("");
      setOtpSent(false);
      setOtpCooldown(0);
      setVerifiedPhone("");
      setOtpVerificationToken("");
    }
  };

  const contactValue = form.contact.trim();
  const phoneVerified = contactValue && verifiedPhone === contactValue;
  const fullAddress = [form.addressLine1, form.addressLine2, form.addressLine3, form.location, form.pinCode]
    .map((item) => item.trim())
    .filter(Boolean)
    .join(", ");
  const googleMapUrl =
    form.googleMapUrl ||
    (form.mapLatitude && form.mapLongitude
      ? `https://www.google.com/maps?q=${encodeURIComponent(`${form.mapLatitude},${form.mapLongitude}`)}`
      : fullAddress
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`
        : "");

  const captureMapPoint = () => {
    setMessage("");
    if (!navigator.geolocation) {
      setMessage("Location capture is not supported in this browser.");
      return;
    }
    requestLocationPermission({
      onSuccess: (position) => {
        const latitude = position.coords.latitude.toFixed(6);
        const longitude = position.coords.longitude.toFixed(6);
        setForm((current) => ({
          ...current,
          mapLatitude: latitude,
          mapLongitude: longitude,
          googleMapUrl: `https://www.google.com/maps?q=${latitude},${longitude}`,
        }));
        setMessage("Google map point captured.");
      },
      onError: () => setMessage("Could not capture map point. Please allow location permission or open map manually."),
      options: { enableHighAccuracy: true, timeout: 12000 },
    });
  };

  const sendPhoneOtp = async () => {
    setMessage("");
    if (otpCooldown > 0) return;

    if (!contactValue) {
      setMessage("Enter contact number first.");
      return;
    }

    try {
      const widgetId = getEfruitMandiWidgetId();
      const tokenAuth = getEfruitMandiTokenAuth();
      const phone = normalizeIndianMobile(contactValue);
      if (!phone) {
        setMessage("Enter a valid phone number for OTP verification.");
        return;
      }

      const result = otpSent
        ? await retryMsg91WidgetOtp({ widgetId, tokenAuth, reqId: otpReqId })
        : await sendMsg91WidgetOtp({ widgetId, tokenAuth, phone, mode: "profile" });
      setOtpReqId(result.reqId || "");
      setOtpSent(true);
      setOtpCooldown(60);
      setMessage(result.reqId ? "OTP sent to phone." : "OTP sent. Enter the OTP received.");
    } catch (err) {
      setMessage(err.response?.data?.msg || err.message || "Could not send phone OTP.");
    }
  };

  const verifyPhoneOtp = async () => {
    setMessage("");

    if (!contactValue || !otp.trim()) {
      setMessage("Enter contact number and OTP.");
      return;
    }

    try {
      const widgetId = getEfruitMandiWidgetId();
      const tokenAuth = getEfruitMandiTokenAuth();
      if (!otpSent) {
        setMessage("Request phone OTP first.");
        return;
      }

      const result = await verifyMsg91WidgetOtp({ widgetId, tokenAuth, otp: otp.trim(), reqId: otpReqId, phone: normalizeIndianMobile(contactValue) || contactValue, mode: "profile" });
      if (!result.data?.otpVerificationToken) {
        setMessage("OTP verified, but verification token was not returned. Request OTP again.");
        return;
      }
      setVerifiedPhone(contactValue);
      setOtpVerificationToken(result.data?.otpVerificationToken || "");
      setMessage("Contact number verified.");
    } catch (err) {
      setVerifiedPhone("");
      setMessage(err.response?.data?.msg || err.message || "Phone OTP verification failed.");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage("");

    if (!form.orchardName.trim()) {
      setMessage("Enter orchard name.");
      return;
    }

    if (!phoneVerified) {
      setMessage("Verify contact number OTP before registration.");
      return;
    }

    try {
      setLoading(true);
      const res = await API.post("/user/set-role", {
        role: "grower",
        orchardName: form.orchardName.trim(),
        designation: form.designation.trim(),
        location: fullAddress || form.location.trim(),
        addressLine1: form.addressLine1.trim(),
        addressLine2: form.addressLine2.trim(),
        addressLine3: form.addressLine3.trim(),
        pinCode: form.pinCode.trim(),
        mapLatitude: form.mapLatitude,
        mapLongitude: form.mapLongitude,
        googleMapUrl,
        contact: form.contact.trim(),
        otpVerificationToken,
        platform: "efruitmandi",
        allowUpdate: isUpdate,
      });

      localStorage.setItem("user", JSON.stringify(res.data.user));
      navigate("/profile-dashboard");
    } catch (err) {
      setMessage(err.response?.data?.msg || "Grower registration failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthBrandShell compact>
      <form onSubmit={handleSubmit} className="w-full">
        <div className="mb-5">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-green-100 text-green-700">
            <FaSeedling />
          </div>
          <p className="text-sm font-semibold text-green-700">
            Grower profile
          </p>
          <h2 className="mt-1 text-2xl font-bold text-gray-950">
            {isUpdate ? "Update Grower Profile" : "Register as Grower"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            Add orchard details so buyers can trust your listings.
          </p>
        </div>

        {message && (
          <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {message}
          </div>
        )}

        <div className="space-y-4">
          <Field
            icon={<FaSeedling />}
            label="Orchard name"
            value={form.orchardName}
            placeholder="Green Valley Orchard"
            onChange={(value) => updateForm("orchardName", value)}
          />
          <Field
            icon={<FaBriefcase />}
            label="Designation / Position"
            value={form.designation}
            placeholder="Owner, orchard manager, supervisor, etc."
            onChange={(value) => updateForm("designation", value)}
          />
          <Field
            icon={<FaMapMarkerAlt />}
            label="Location"
            value={form.location}
            placeholder="Shimla"
            onChange={(value) => updateForm("location", value)}
          />
          <Field
            icon={<FaMapMarkerAlt />}
            label="Full address"
            value={form.addressLine1}
            placeholder="Village / street / orchard road"
            onChange={(value) => updateForm("addressLine1", value)}
          />
          <Field
            icon={<FaMapMarkerAlt />}
            label="Address line 2"
            value={form.addressLine2}
            placeholder="Post office / tehsil / landmark"
            onChange={(value) => updateForm("addressLine2", value)}
          />
          <Field
            icon={<FaMapMarkerAlt />}
            label="District / State"
            value={form.addressLine3}
            placeholder="District, State"
            onChange={(value) => updateForm("addressLine3", value)}
          />
          <Field
            icon={<FaMapMarkerAlt />}
            label="PIN Code"
            value={form.pinCode}
            placeholder="Enter PIN code"
            inputMode="numeric"
            onChange={(value) => updateForm("pinCode", value)}
          />
          <div className="rounded-md border border-gray-200 bg-white p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-700">Google map pointing</p>
                <p className="mt-1 text-xs text-gray-500">
                  {form.mapLatitude && form.mapLongitude ? `Lat ${form.mapLatitude}, Lng ${form.mapLongitude}` : "Capture orchard point for transport fare calculation."}
                </p>
              </div>
              <button
                type="button"
                onClick={captureMapPoint}
                className="rounded-md bg-green-50 px-3 py-2 text-sm font-bold text-green-700 transition hover:bg-green-100"
              >
                Use map point
              </button>
            </div>
            {googleMapUrl && (
              <a
                href={googleMapUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 block truncate rounded-md bg-gray-50 px-3 py-2 text-xs font-semibold text-green-700 underline"
              >
                Open Google Map location
              </a>
            )}
          </div>
          <Field
            icon={<FaPhoneAlt />}
            label="Contact number"
            value={form.contact}
            placeholder="Enter phone number"
            inputMode="tel"
            onChange={(value) => updateForm("contact", value)}
          />

          <PhoneOtpControl
            otp={otp}
            verified={phoneVerified}
            cooldown={otpCooldown}
            onOtpChange={setOtp}
            onSend={sendPhoneOtp}
            onVerify={verifyPhoneOtp}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-md bg-green-700 py-3 text-sm font-bold text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {loading ? "Saving..." : isUpdate ? "Update Grower Profile" : "Register as Grower"}
        </button>
      </form>
    </AuthBrandShell>
  );
}

function PhoneOtpControl({ otp, verified, cooldown, onOtpChange, onSend, onVerify }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2 text-sm font-semibold text-gray-700">
        <span>Phone OTP verification</span>
        {verified && (
          <span className="inline-flex items-center gap-1 text-green-700">
            <FaCheck /> Verified
          </span>
        )}
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2">
        <input
          value={otp}
          inputMode="numeric"
          placeholder="Enter OTP"
          onChange={(event) => onOtpChange(event.target.value)}
          className="min-w-0 rounded-md border border-gray-200 px-3 py-3 text-sm outline-none transition placeholder:text-gray-400 focus:border-green-600 focus:ring-2 focus:ring-green-100"
        />
        <button
          type="button"
          disabled={cooldown > 0}
          onClick={onSend}
          className="inline-flex items-center justify-center gap-1 rounded-md bg-green-50 px-3 py-3 text-sm font-bold text-green-700 transition hover:bg-green-100 disabled:opacity-50"
        >
          <FaPaperPlane /> {cooldown > 0 ? `${cooldown}s` : "Request OTP"}
        </button>
        <button
          type="button"
          onClick={onVerify}
          className="rounded-md bg-green-700 px-3 py-3 text-sm font-bold text-white transition hover:bg-green-800"
        >
          Verify
        </button>
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
      <span className="flex items-center gap-3 rounded-md border border-gray-200 bg-white px-3 py-3 text-gray-400 transition focus-within:border-green-600 focus-within:ring-2 focus-within:ring-green-100">
        {icon}
        <input
          value={value}
          inputMode={inputMode}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent text-sm text-gray-950 outline-none placeholder:text-gray-400"
        />
      </span>
    </label>
  );
}
