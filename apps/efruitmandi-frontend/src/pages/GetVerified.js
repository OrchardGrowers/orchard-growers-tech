import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaCertificate,
  FaCheckCircle,
  FaIdCard,
  FaPhoneAlt,
  FaRupeeSign,
  FaShieldAlt,
  FaUpload,
  FaVideo,
} from "react-icons/fa";
import API from "../services/api";
import BackHomeButton from "../components/BackHomeButton";
import { getCurrentUser, hasBuyerProfile } from "../utils/auth";
import {
  getEfruitMandiWidgetId,
  getEfruitMandiTokenAuth,
  normalizeIndianMobile,
  retryMsg91WidgetOtp,
  sendMsg91WidgetOtp,
  verifyMsg91WidgetOtp,
} from "../utils/msg91OtpWidget";

export default function GetVerified() {
  const navigate = useNavigate();
  const user = useMemo(() => getCurrentUser() || {}, []);
  const isBuyer = hasBuyerProfile(user);
  const [form, setForm] = useState({
    orchardName: isBuyer ? user.businessName || "" : user.orchardName || "",
    ownerName: isBuyer ? user.buyerContactPerson || user.name || "" : user.name || "",
    location: user.location || "",
    phone: user.phone || user.contact || "",
    otp: "",
    udyanCardName: "",
    udyanCardFile: null,
    orchardVideoName: "",
    orchardVideoFile: null,
  });
  const [otpSent, setOtpSent] = useState(false);
  const [otpReqId, setOtpReqId] = useState("");
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpMessage, setOtpMessage] = useState({ type: "", text: "" });
  const [feePaid, setFeePaid] = useState(false);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [requested, setRequested] = useState(
    () => localStorage.getItem("profileVerificationRequested") === "true"
  );
  const displayName =
    user.orchardName ||
    user.businessName ||
    user.logisticsName ||
    user.name ||
    "Orchard Growers";
  const detailTitle = isBuyer ? "Company Detail" : "Orchard Detail";
  const entityNameLabel = isBuyer ? "Company Name" : "Orchard Name";
  const entityNamePlaceholder = isBuyer ? "Green Valley Fruit Traders" : "Apple Valley Orchard";
  const personNameLabel = isBuyer ? "Contact Person Name" : "Owner/Propriter Name";
  const personNamePlaceholder = isBuyer ? "Owner / manager name" : "Owner name";
  const videoUploadLabel = isBuyer ? "Upload Company Video" : "Upload Orchard Video";
  const phoneStepText = `Verify the phone number entered in ${detailTitle}.`;
  const orchardDetailComplete = Boolean(
    form.orchardName.trim() &&
      form.ownerName.trim() &&
      form.location.trim() &&
      form.phone.trim() &&
      form.udyanCardFile &&
      form.orchardVideoFile
  );
  const verificationFee = 5000;
  const taxRate = 0.05;
  const taxAmount = Math.round(verificationFee * taxRate);
  const totalFee = verificationFee + taxAmount;

  useEffect(() => {
    if (otpCooldown <= 0) return undefined;
    const timer = window.setTimeout(() => setOtpCooldown((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [otpCooldown]);

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    if (field === "phone") {
      setOtpSent(false);
      setOtpReqId("");
      setOtpCooldown(0);
      setPhoneVerified(false);
      setFeePaid(false);
      setOtpMessage({ type: "", text: "" });
    }
  };

  const sendOtp = async () => {
    const identifier = form.phone.trim();

    if (!identifier || otpLoading || otpCooldown > 0) return;

    setOtpLoading(true);
    setOtpMessage({ type: "", text: "" });
    setSubmitError("");

    try {
      const widgetId = getEfruitMandiWidgetId();
      const tokenAuth = getEfruitMandiTokenAuth();
      const phone = normalizeIndianMobile(identifier);
      if (!phone) {
        setOtpMessage({
          type: "error",
          text: "Enter a valid phone number for verification.",
        });
        return;
      }

      const result = otpSent
        ? await retryMsg91WidgetOtp({ widgetId, tokenAuth, reqId: otpReqId })
        : await sendMsg91WidgetOtp({ widgetId, tokenAuth, phone, mode: "signup" });
      setOtpReqId(result.reqId || "");
      setOtpSent(true);
      setOtpCooldown(60);
      setPhoneVerified(false);
      setFeePaid(false);
      setOtpMessage({
        type: "success",
        text: result.reqId ? "OTP sent to phone." : "OTP sent. Enter the OTP received.",
      });
    } catch (err) {
      setOtpMessage({
        type: "error",
        text: err.response?.data?.msg || err.message || "Could not send OTP.",
      });
    } finally {
      setOtpLoading(false);
    }
  };

  const verifyOtp = async () => {
    const identifier = form.phone.trim();
    const otp = form.otp.trim();

    if (!identifier || !otp || otpLoading) return;

    setOtpLoading(true);
    setOtpMessage({ type: "", text: "" });
    setSubmitError("");

    try {
      const widgetId = getEfruitMandiWidgetId();
      const tokenAuth = getEfruitMandiTokenAuth();
      if (!widgetId || !tokenAuth || !otpSent) {
        setOtpMessage({ type: "error", text: "Request phone OTP first." });
        return;
      }

      await verifyMsg91WidgetOtp({ widgetId, tokenAuth, otp, reqId: otpReqId, phone: normalizeIndianMobile(identifier) || identifier, mode: "signup" });
      setPhoneVerified(true);
      setFeePaid(false);
      setOtpMessage({ type: "success", text: "Phone verified." });
    } catch (err) {
      setPhoneVerified(false);
      setOtpMessage({
        type: "error",
        text: err.response?.data?.msg || err.message || "OTP verification failed.",
      });
    } finally {
      setOtpLoading(false);
    }
  };

  const markFeePaid = async () => {
    if (!orchardDetailComplete || !phoneVerified || submittingPayment || feePaid) return;

    setSubmittingPayment(true);
    setSubmitError("");

    try {
      const payload = new FormData();
      payload.append("orchardName", form.orchardName);
      payload.append("ownerName", form.ownerName);
      payload.append("location", form.location);
      payload.append("phone", form.phone);
      payload.append("udyanCard", form.udyanCardFile);
      payload.append("orchardVideo", form.orchardVideoFile);

      await API.post("/verification-requests", payload);

      setFeePaid(true);
      localStorage.setItem("profileVerificationRequested", "true");
      setRequested(true);
    } catch (err) {
      setSubmitError(err.response?.data?.msg || "Verification request could not be sent.");
    } finally {
      setSubmittingPayment(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl pb-20">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <BackHomeButton />
      </div>

      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="bg-green-800 px-5 py-6 text-white md:px-8">
          <div className="flex items-start gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white text-2xl text-green-800">
              <FaCertificate />
            </span>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wide text-yellow-300">
                Trusted Badge
              </p>
              <h1 className="mt-1 text-2xl font-extrabold">
                Get Verified
              </h1>
              <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-white/85">
                Request Orchard Growers verification for {displayName}. Verified accounts can build stronger marketplace trust and show trusted profile signals.
              </p>
            </div>
          </div>
        </div>

        <div className="p-5 md:p-8">
          <section className="rounded-md border border-green-100 bg-green-50 p-4">
            <div className="mb-4 flex items-start gap-3">
              <span className="text-xl text-green-800">
                <FaIdCard />
              </span>
              <div>
                <h2 className="text-sm font-extrabold text-gray-950">{detailTitle}</h2>
                <p className="mt-1 text-xs font-semibold leading-5 text-gray-600">
                  Fill these details before phone verification, fee review, and final submission.
                </p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <FormInput
                label={entityNameLabel}
                value={form.orchardName}
                placeholder={entityNamePlaceholder}
                onChange={(value) => updateForm("orchardName", value)}
              />
              <FormInput
                label={personNameLabel}
                value={form.ownerName}
                placeholder={personNamePlaceholder}
                onChange={(value) => updateForm("ownerName", value)}
              />
              <FormInput
                label="Location"
                value={form.location}
                placeholder="Village, tehsil, district, state"
                onChange={(value) => updateForm("location", value)}
              />
              <FormInput
                label="Phone No."
                value={form.phone}
                placeholder="9876543210"
                inputMode="tel"
                onChange={(value) => updateForm("phone", value)}
              />
              <FileInput
                label="Upload Udyan Card Pic/File"
                fileName={form.udyanCardName}
                accept="image/*,.pdf"
                icon={<FaUpload />}
                onChange={(file) => {
                  updateForm("udyanCardFile", file);
                  updateForm("udyanCardName", file?.name || "");
                }}
              />
              <FileInput
                label={videoUploadLabel}
                fileName={form.orchardVideoName}
                accept="video/*"
                icon={<FaVideo />}
                onChange={(file) => {
                  updateForm("orchardVideoFile", file);
                  updateForm("orchardVideoName", file?.name || "");
                }}
              />
            </div>
          </section>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <StepCard
              disabled={!orchardDetailComplete}
              icon={<FaPhoneAlt />}
              title="Phone verification"
              text={phoneStepText}
            >
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!orchardDetailComplete || otpLoading || otpCooldown > 0}
                  onClick={sendOtp}
                  className="rounded-full bg-green-800 px-4 py-2 text-xs font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {otpLoading ? "Sending..." : otpCooldown > 0 ? `Resend in ${otpCooldown}s` : otpSent ? "Resend OTP" : "Send OTP"}
                </button>
                <input
                  value={form.otp}
                  disabled={!orchardDetailComplete || !otpSent || phoneVerified}
                  onChange={(event) => updateForm("otp", event.target.value)}
                  placeholder="Enter OTP"
                  inputMode="numeric"
                  className="min-w-0 flex-1 rounded-md border border-gray-200 px-3 py-2 text-xs font-semibold outline-none disabled:bg-gray-100"
                />
                <button
                  type="button"
                  disabled={!orchardDetailComplete || !otpSent || !form.otp || phoneVerified || otpLoading}
                  onClick={verifyOtp}
                  className="rounded-full bg-green-800 px-4 py-2 text-xs font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {phoneVerified ? "Verified" : otpLoading ? "Verifying..." : "Verify"}
                </button>
              </div>
              {otpMessage.text && (
                <p
                  className={`mt-2 text-xs font-bold ${
                    otpMessage.type === "error" ? "text-red-600" : "text-green-700"
                  }`}
                >
                  {otpMessage.text}
                </p>
              )}
            </StepCard>

            <StepCard
              disabled={!phoneVerified}
              icon={feePaid ? <FaCheckCircle /> : <FaRupeeSign />}
              title={feePaid ? "Fee paid" : "Verification fee"}
              text={
                feePaid
                  ? "Payment received for trusted badge verification."
                  : "One-time trusted badge verification fee."
              }
            >
              <div className="mt-3 rounded-md bg-white p-3 text-xs font-bold text-gray-700">
                <FeeRow label="One-time fee" value={`Rs. ${verificationFee}`} />
                <FeeRow label="Tax 5%" value={`Rs. ${taxAmount}`} />
                <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2 text-sm font-extrabold text-gray-950">
                  <span>Total payable</span>
                  <span>Rs. {totalFee}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={markFeePaid}
                disabled={feePaid || submittingPayment}
                className="mt-3 inline-flex items-center gap-2 rounded-full bg-green-800 px-4 py-2 text-xs font-extrabold text-white disabled:cursor-not-allowed disabled:bg-green-700"
              >
                {feePaid && <FaCheckCircle />}
                {feePaid ? "Fee paid" : submittingPayment ? "Sending..." : "Pay Rs. 5250"}
              </button>
              {submitError && (
                <p className="mt-2 text-xs font-bold text-red-600">{submitError}</p>
              )}
            </StepCard>
          </div>
        </div>

        <div className={`border-t border-gray-100 p-5 md:p-8 ${!orchardDetailComplete ? "opacity-45" : ""}`}>
          <div className="rounded-md bg-gray-50 p-4">
            <div className="flex items-start gap-3">
              <FaShieldAlt className="mt-1 shrink-0 text-green-800" />
              <div>
                <h2 className="text-sm font-extrabold text-gray-950">What happens next</h2>
                <p className="mt-1 text-xs font-semibold leading-5 text-gray-600">
                  Your request is marked for Orchard Growers Team review after {detailTitle}, OTP verification, and fee payment are complete.
                </p>
              </div>
            </div>
          </div>

          <div
            className={`mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-extrabold md:w-auto ${
              requested
                ? "border-2 border-yellow-300 bg-green-800 text-yellow-200 shadow-lg shadow-green-900/20 ring-4 ring-yellow-100"
                : "cursor-not-allowed bg-gray-400 text-white opacity-60"
            }`}
          >
            <FaCheckCircle />
            Verification Request Sent
          </div>
        </div>
      </section>
    </div>
  );
}

function FormInput({ label, value, placeholder, inputMode, onChange }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-extrabold text-gray-700">{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-green-700 focus:ring-2 focus:ring-green-100"
      />
    </label>
  );
}

function FileInput({ label, fileName, accept, icon, onChange }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-extrabold text-gray-700">{label}</span>
      <span className="flex min-h-[42px] cursor-pointer items-center gap-3 rounded-md border border-dashed border-green-300 bg-white px-3 py-2 text-sm font-semibold text-green-800">
        {icon}
        <span className="min-w-0 flex-1 truncate">{fileName || "Choose file"}</span>
      </span>
      <input
        type="file"
        accept={accept}
        className="hidden"
        onChange={(event) => onChange(event.target.files?.[0] || null)}
      />
    </label>
  );
}

function FeeRow({ label, value }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span>{label}</span>
      <span className="text-gray-950">{value}</span>
    </div>
  );
}

function StepCard({ disabled, icon, title, text, children }) {
  return (
    <article
      className={`rounded-md border border-green-100 bg-green-50 p-4 transition ${
        disabled ? "pointer-events-none opacity-45 grayscale" : ""
      }`}
    >
      <span className="text-xl text-green-800">{icon}</span>
      <h2 className="mt-3 text-sm font-extrabold text-gray-950">{title}</h2>
      <p className="mt-2 text-xs font-semibold leading-5 text-gray-600">{text}</p>
      {children}
    </article>
  );
}
