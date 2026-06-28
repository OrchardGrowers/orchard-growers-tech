import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  FaBriefcase,
  FaCheck,
  FaFileAlt,
  FaIdCard,
  FaMapMarkerAlt,
  FaPaperPlane,
  FaPhoneAlt,
  FaUserTie,
} from "react-icons/fa";
import API from "../services/api";
import AuthBrandShell from "../components/AuthBrandShell";
import { trackBuyerRegistration } from "../services/analytics";
import {
  getEfruitMandiWidgetId,
  getEfruitMandiTokenAuth,
  normalizeIndianMobile,
  retryMsg91WidgetOtp,
  sendMsg91WidgetOtp,
  verifyMsg91WidgetOtp,
} from "../utils/msg91OtpWidget";
import { getCurrentUser, hasBuyerProfile, hasDriverProfile } from "../utils/auth";

const LOGIN_REQUIRED_MESSAGE = "Please login first to continue.";

export default function RegisterBuyer() {
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = location.state?.from || "/profile-dashboard";
  const isAuthenticated = Boolean(localStorage.getItem("accessToken"));
  const currentUser = getCurrentUser();
  const [accountUser, setAccountUser] = useState(currentUser);
  const isUpdate = hasBuyerProfile(accountUser);
  const hasBlockedDriverProfile = hasDriverProfile(accountUser);
  const savedContact = currentUser.contact || currentUser.phone || "";
  const [form, setForm] = useState({
    businessName: currentUser.businessName || "",
    buyerBusinessType: currentUser.buyerBusinessType || "buyer",
    buyerContactPerson: currentUser.buyerContactPerson || currentUser.name || "",
    designation: currentUser.designation || "",
    location: currentUser.buyerLocation || currentUser.location || "",
    pinCode: currentUser.buyerPinCode || currentUser.pinCode || "",
    mapLatitude: currentUser.mapLatitude || "",
    mapLongitude: currentUser.mapLongitude || "",
    googleMapUrl: currentUser.googleMapUrl || "",
    contact: savedContact,
    gstNumber: currentUser.gstNumber || "",
    tradeLicenseNumber: currentUser.tradeLicenseNumber || "",
    publicProfile: isUpdate
      ? (currentUser.publicProfileRoles || []).includes("buyer")
      : true,
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
    if (!isAuthenticated) {
      navigate("/profile", {
        replace: true,
        state: {
          mode: "login",
          from: returnTo,
          requiredProfile: "buyer",
          message: LOGIN_REQUIRED_MESSAGE,
        },
      });
      return undefined;
    }

    API.get("/user/profile")
      .then((res) => {
        const latestUser = res.data || currentUser;
        setAccountUser(latestUser);
        localStorage.setItem("user", JSON.stringify(latestUser));
        setForm({
          businessName: latestUser.businessName || "",
          buyerBusinessType: latestUser.buyerBusinessType || "buyer",
          buyerContactPerson: latestUser.buyerContactPerson || latestUser.name || "",
          designation: latestUser.designation || "",
          location: latestUser.buyerLocation || latestUser.location || "",
          pinCode: latestUser.buyerPinCode || latestUser.pinCode || "",
          mapLatitude: latestUser.mapLatitude || "",
          mapLongitude: latestUser.mapLongitude || "",
          googleMapUrl: latestUser.googleMapUrl || "",
          contact: latestUser.contact || latestUser.phone || "",
          gstNumber: latestUser.gstNumber || "",
          tradeLicenseNumber: latestUser.tradeLicenseNumber || "",
          publicProfile: hasBuyerProfile(latestUser)
            ? (latestUser.publicProfileRoles || []).includes("buyer")
            : true,
        });
        const latestContact = latestUser.contact || latestUser.phone || "";
        if (hasBuyerProfile(latestUser) && latestContact) {
          setVerifiedPhone(latestContact);
        }
      })
      .catch(() => {});
  }, [isAuthenticated, navigate, returnTo]);

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
  const googleMapUrl =
    form.googleMapUrl ||
    (form.mapLatitude && form.mapLongitude
      ? `https://www.google.com/maps?q=${encodeURIComponent(`${form.mapLatitude},${form.mapLongitude}`)}`
      : form.location
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([form.location, form.pinCode].filter(Boolean).join(", "))}`
        : "");

  const captureMapPoint = () => {
    setMessage("");
    if (!navigator.geolocation) {
      setMessage("Location capture is not supported in this browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude.toFixed(6);
        const longitude = position.coords.longitude.toFixed(6);
        setForm((current) => ({
          ...current,
          mapLatitude: latitude,
          mapLongitude: longitude,
          googleMapUrl: `https://www.google.com/maps?q=${latitude},${longitude}`,
        }));
        setMessage("Buyer premises map point captured.");
      },
      () => setMessage("Could not capture map point. Please allow location permission or open map manually."),
      { enableHighAccuracy: true, timeout: 12000 }
    );
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

    if (hasBlockedDriverProfile) {
      setMessage("Buyer profile cannot be added because this account is already registered as Driver.");
      return;
    }

    if (
      !form.businessName.trim() ||
      !form.buyerContactPerson.trim() ||
      !form.location.trim() ||
      !form.contact.trim()
    ) {
      setMessage("Company name, contact person, location, and contact number are required.");
      return;
    }

    if (!phoneVerified) {
      setMessage("Verify contact number OTP before registration.");
      return;
    }

    try {
      setLoading(true);
      const res = await API.post("/user/set-role", {
        role: "buyer",
        businessName: form.businessName.trim(),
        buyerBusinessType: form.buyerBusinessType,
        buyerContactPerson: form.buyerContactPerson.trim(),
        designation: form.designation.trim(),
        buyerLocation: form.location.trim(),
        buyerPinCode: form.pinCode.trim(),
        mapLatitude: form.mapLatitude,
        mapLongitude: form.mapLongitude,
        googleMapUrl,
        contact: form.contact.trim(),
        gstNumber: form.gstNumber.trim(),
        tradeLicenseNumber: form.tradeLicenseNumber.trim(),
        otpVerificationToken,
        platform: "efruitmandi",
        allowUpdate: isUpdate,
        publicProfile: form.publicProfile,
      });

      localStorage.setItem("user", JSON.stringify(res.data.user));
      trackBuyerRegistration();
      navigate(returnTo);
    } catch (err) {
      setMessage(err.response?.data?.msg || "Buyer registration failed.");
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <AuthBrandShell compact>
      <form onSubmit={handleSubmit} className="w-full">
        <h2 className="mt-1 text-center text-xl font-extrabold text-black">
          {isUpdate ? "Update Buyer Profile" : "Register as Buyer"}
        </h2>
        {(hasBlockedDriverProfile || message) && (
          <div className="mt-4 rounded-md bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
            {hasBlockedDriverProfile
              ? "Buyer profile cannot be added because this account is already registered as Driver."
              : message}
          </div>
        )}

        <div className="mt-6 space-y-4">
          <BuyerField
            icon={<FaBriefcase className="text-green-600" />}
            label="Company Name"
            value={form.businessName}
            placeholder="Type your Company/Firm name"
            required
            onChange={(value) => updateForm("businessName", value)}
          />
          <label className="block">
            <span className="text-sm font-semibold text-gray-900 sm:text-lg sm:font-medium">
              Business Type <span className="text-green-600">*</span>
            </span>
            <select
              value={form.buyerBusinessType}
              onChange={(event) => updateForm("buyerBusinessType", event.target.value)}
              className="mt-2 min-h-11 w-full rounded-md border border-gray-200 bg-white px-3 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
            >
              <option value="buyer">Buyer</option>
              <option value="exporter">Exporter</option>
              <option value="commission_agent">Commission Agent</option>
              <option value="cold_storage">Cold Storage</option>
            </select>
          </label>
          <BuyerField
            icon={<FaUserTie className="text-green-600" />}
            label="Contact Person"
            value={form.buyerContactPerson}
            placeholder="Owner / manager name"
            required
            onChange={(value) => updateForm("buyerContactPerson", value)}
          />
          <BuyerField
            icon={<FaBriefcase className="text-green-600" />}
            label="Designation / Position"
            value={form.designation}
            placeholder="Owner, purchase manager, director, etc."
            onChange={(value) => updateForm("designation", value)}
          />
          <BuyerField
            icon={<FaMapMarkerAlt className="text-green-600" />}
            label="Location"
            value={form.location}
            placeholder="Type your Area Address"
            required
            onChange={(value) => updateForm("location", value)}
          />
          <BuyerField
            icon={<FaMapMarkerAlt className="text-green-600" />}
            label="Postal Code"
            value={form.pinCode}
            placeholder="Type your postal / PIN code"
            inputMode="numeric"
            onChange={(value) => updateForm("pinCode", value)}
          />
          <div className="rounded-md border border-green-100 bg-green-50 p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-700">Buyer premises Google map point</p>
                <p className="mt-1 text-xs text-gray-500">
                  {form.mapLatitude && form.mapLongitude
                    ? `Lat ${form.mapLatitude}, Lng ${form.mapLongitude}`
                    : "Capture receiving premises point for transport fare calculation."}
                </p>
              </div>
              <button
                type="button"
                onClick={captureMapPoint}
                className="min-h-11 w-full rounded-md bg-green-700 px-3 py-2 text-xs font-bold text-white hover:bg-green-800 sm:w-auto"
              >
                Use map point
              </button>
            </div>
            {googleMapUrl && (
              <a
                href={googleMapUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 block truncate rounded-md bg-white px-3 py-2 text-xs font-semibold text-green-700 underline"
              >
                Open Google Map location
              </a>
            )}
          </div>
          <BuyerField
            icon={<FaPhoneAlt className="text-green-600" />}
            label="Contact No."
            value={form.contact}
            placeholder="Type your Contact Number"
            inputMode="tel"
            required
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
          <BuyerField
            icon={<FaIdCard className="text-green-600" />}
            label="GST No. / PAN"
            value={form.gstNumber}
            placeholder="Optional for verified buyer"
            onChange={(value) => updateForm("gstNumber", value)}
          />
          <BuyerField
            icon={<FaFileAlt className="text-green-600" />}
            label="Trade License"
            value={form.tradeLicenseNumber}
            placeholder="Optional mandi/trade license"
            onChange={(value) => updateForm("tradeLicenseNumber", value)}
          />
          <label className="flex items-start gap-3 rounded-md border border-green-100 bg-green-50 p-3 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.publicProfile}
              onChange={(event) => updateForm("publicProfile", event.target.checked)}
              className="mt-1"
            />
            <span>
              Make this firm profile public. Only the firm name, business type,
              city/state, verification badges, and official company logo may be shown publicly.
            </span>
          </label>
        </div>

        <button
          type="submit"
          disabled={loading || hasBlockedDriverProfile}
          className="mt-7 min-h-12 w-full rounded-md bg-green-700 py-3 text-sm font-bold text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {loading ? "Saving..." : isUpdate ? "Update Buyer Profile" : "Register & Deal"}
        </button>
      </form>
    </AuthBrandShell>
  );
}

function PhoneOtpControl({ otp, verified, cooldown, onOtpChange, onSend, onVerify }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2 text-sm font-semibold text-gray-700">
        <span>Phone OTP verification</span>
        {verified && (
          <span className="inline-flex items-center gap-1 text-green-700">
            <FaCheck /> Verified
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
        <input
          value={otp}
          inputMode="numeric"
          placeholder="Enter OTP"
          onChange={(event) => onOtpChange(event.target.value)}
          className="min-h-11 min-w-0 rounded-md border border-gray-200 px-3 py-3 text-sm outline-none transition placeholder:text-gray-400 focus:border-green-600 focus:ring-2 focus:ring-green-100"
        />
        <button
          type="button"
          disabled={cooldown > 0}
          onClick={onSend}
          className="inline-flex min-h-11 items-center justify-center gap-1 rounded-md bg-green-50 px-3 py-3 text-sm font-bold text-green-700 transition hover:bg-green-100 disabled:opacity-50"
        >
          <FaPaperPlane /> {cooldown > 0 ? `${cooldown}s` : "Request OTP"}
        </button>
        <button
          type="button"
          onClick={onVerify}
          className="min-h-11 rounded-md bg-green-700 px-3 py-3 text-sm font-bold text-white transition hover:bg-green-800"
        >
          Verify
        </button>
      </div>
    </div>
  );
}

function BuyerField({
  icon,
  label,
  value,
  placeholder,
  onChange,
  inputMode,
  required,
}) {
  return (
    <label className="block">
      <span className="flex items-center gap-1 text-sm font-semibold text-gray-900 sm:text-lg sm:font-medium">
        {label}
        {required && <span className="text-green-600">*</span>}
      </span>
      <span className="flex min-h-11 items-center gap-2 border-b border-gray-300 py-2 transition focus-within:border-green-600">
        <span className="text-xl">{icon}</span>
        <input
          value={value}
          inputMode={inputMode}
          placeholder={placeholder}
          required={required}
          onChange={(event) => onChange(event.target.value)}
          className="min-w-0 w-full bg-transparent text-sm outline-none placeholder:text-gray-500"
        />
      </span>
    </label>
  );
}
