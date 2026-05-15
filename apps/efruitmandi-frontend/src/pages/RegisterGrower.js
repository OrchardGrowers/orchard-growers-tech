import { useState } from "react";
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

export default function RegisterGrower() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    orchardName: "OrcahrdGrowers",
    designation: "",
    location: "",
    contact: "+910987654321",
  });
  const [loading, setLoading] = useState(false);
  const [otp, setOtp] = useState("");
  const [verifiedPhone, setVerifiedPhone] = useState("");
  const [message, setMessage] = useState("");

  const updateForm = (field, value) => {
    setForm({ ...form, [field]: value });
    if (field === "contact") {
      setOtp("");
      setVerifiedPhone("");
    }
  };

  const contactValue = form.contact.trim();
  const phoneVerified = contactValue && verifiedPhone === contactValue;

  const sendPhoneOtp = async () => {
    setMessage("");

    if (!contactValue) {
      setMessage("Enter contact number first.");
      return;
    }

    try {
      const res = await API.post("/auth/send-otp", {
        identifier: contactValue,
      });

      if (res.data.channel !== "phone") {
        setMessage("Enter a valid phone number for OTP verification.");
        return;
      }

      setMessage(
        res.data.devOtp
          ? `OTP sent to phone. Dev OTP: ${res.data.devOtp}`
          : "OTP sent to phone."
      );
    } catch (err) {
      setMessage(err.response?.data?.msg || "Could not send phone OTP.");
    }
  };

  const verifyPhoneOtp = async () => {
    setMessage("");

    if (!contactValue || !otp.trim()) {
      setMessage("Enter contact number and OTP.");
      return;
    }

    try {
      await API.post("/auth/verify-otp", {
        identifier: contactValue,
        otp: otp.trim(),
      });
      setVerifiedPhone(contactValue);
      setMessage("Contact number verified.");
    } catch (err) {
      setVerifiedPhone("");
      setMessage(err.response?.data?.msg || "Phone OTP verification failed.");
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
        location: form.location.trim(),
        contact: form.contact.trim(),
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
            Register as Grower
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
          {loading ? "Saving..." : "Register as Grower"}
        </button>
      </form>
    </AuthBrandShell>
  );
}

function PhoneOtpControl({ otp, verified, onOtpChange, onSend, onVerify }) {
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
          onClick={onSend}
          className="inline-flex items-center justify-center gap-1 rounded-md bg-green-50 px-3 py-3 text-sm font-bold text-green-700 transition hover:bg-green-100"
        >
          <FaPaperPlane /> Send
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
