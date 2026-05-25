import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import {
  getEfruitMandiWidgetId,
  getEfruitMandiTokenAuth,
  normalizeIndianMobile,
  retryMsg91WidgetOtp,
  sendMsg91WidgetOtp,
  verifyMsg91WidgetOtp,
} from "../utils/msg91OtpWidget";

export default function RegisterBuyer() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    businessName: "",
    buyerContactPerson: "",
    designation: "",
    location: "",
    pinCode: "",
    contact: "",
    gstNumber: "",
    tradeLicenseNumber: "",
  });
  const [loading, setLoading] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpReqId, setOtpReqId] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [verifiedPhone, setVerifiedPhone] = useState("");
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
    }
  };

  const contactValue = form.contact.trim();
  const phoneVerified = contactValue && verifiedPhone === contactValue;

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
        : await sendMsg91WidgetOtp({ widgetId, tokenAuth, phone, mode: "signup" });
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
      if (!widgetId || !tokenAuth || !otpSent) {
        setMessage("Request phone OTP first.");
        return;
      }

      await verifyMsg91WidgetOtp({ widgetId, tokenAuth, otp: otp.trim(), reqId: otpReqId });
      setVerifiedPhone(contactValue);
      setMessage("Contact number verified.");
    } catch (err) {
      setVerifiedPhone("");
      setMessage(err.response?.data?.msg || err.message || "Phone OTP verification failed.");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage("");

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
        buyerContactPerson: form.buyerContactPerson.trim(),
        designation: form.designation.trim(),
        location: form.location.trim(),
        pinCode: form.pinCode.trim(),
        contact: form.contact.trim(),
        gstNumber: form.gstNumber.trim(),
        tradeLicenseNumber: form.tradeLicenseNumber.trim(),
      });

      localStorage.setItem("user", JSON.stringify(res.data.user));
      navigate("/profile-dashboard");
    } catch (err) {
      setMessage(err.response?.data?.msg || "Buyer registration failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthBrandShell compact>
      <form onSubmit={handleSubmit} className="w-full">
        <h2 className="mt-1 text-center text-xl font-extrabold text-black">
          Buyer Registration
        </h2>
        {message && (
          <div className="mt-4 rounded-md bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
            {message}
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
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-7 w-full rounded-md bg-green-700 py-3 text-sm font-bold text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {loading ? "Saving..." : "Register & Deal"}
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
          <FaPaperPlane /> {cooldown > 0 ? `${cooldown}s` : "Send"}
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
      <span className="flex items-center gap-1 text-lg font-medium text-gray-900">
        {label}
        {required && <span className="text-green-600">*</span>}
      </span>
      <span className="flex items-center gap-2 border-b border-gray-300 py-2 transition focus-within:border-green-600">
        <span className="text-xl">{icon}</span>
        <input
          value={value}
          inputMode={inputMode}
          placeholder={placeholder}
          required={required}
          onChange={(event) => onChange(event.target.value)}
          className="w-full bg-transparent text-sm outline-none placeholder:text-gray-500"
        />
      </span>
    </label>
  );
}
