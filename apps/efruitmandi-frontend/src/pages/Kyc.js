import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FaBuilding, FaCheckCircle, FaFileUpload, FaIdCard, FaUniversity } from "react-icons/fa";
import API from "../services/api";
import { saveUserToStorage } from "../utils/userStorage";

const initialForm = {
  udyanCardNo: "",
  bankAccountNo: "",
  ifscCode: "",
  aadhaarCardNo: "",
};

export default function Kyc() {
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = location.state?.from || "";
  const [form, setForm] = useState(initialForm);
  const [files, setFiles] = useState({
    udyanCardFile: null,
    passbookFile: null,
    aadhaarCardFile: null,
  });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [kycStatus, setKycStatus] = useState("NOT_SUBMITTED");

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await API.get("/user/profile");
        const kyc = res.data?.kyc || {};
        setForm({
          udyanCardNo: kyc.udyanCardNo || "",
          bankAccountNo: kyc.bankAccountNo || "",
          ifscCode: kyc.ifscCode || "",
          aadhaarCardNo: kyc.aadhaarCardNo || "",
        });
        setKycStatus(kyc.status || "NOT_SUBMITTED");
      } catch {
        setMessage("Please login to update KYC.");
      }
    };

    loadProfile();
  }, []);

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const updateFile = (field, file) => {
    setFiles((current) => ({ ...current, [field]: file || null }));
  };

  const submitKyc = async (event) => {
    event.preventDefault();
    setMessage("");

    if (!form.udyanCardNo || !form.bankAccountNo || !form.ifscCode || !form.aadhaarCardNo) {
      setMessage("Enter Udyan card, bank, IFSC, and Aadhaar details.");
      return;
    }

    try {
      setLoading(true);
      const data = new FormData();
      Object.entries(form).forEach(([key, value]) => data.append(key, value.trim()));
      Object.entries(files).forEach(([key, file]) => {
        if (file) data.append(key, file);
      });

      const res = await API.patch("/user/kyc", data);
      saveUserToStorage(res.data);
      setKycStatus(res.data?.kyc?.status || "COMPLETED");
      setMessage("KYC submitted. Authority verification will be completed within 24 hours.");
      if (returnTo) {
        window.setTimeout(() => navigate(returnTo), 800);
      }
    } catch (err) {
      setMessage(err.response?.data?.msg || "KYC submission failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto min-h-[calc(100vh-132px)] max-w-3xl px-4 pb-20 md:min-h-[calc(100vh-94px)]">
      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-5">
          <p className="text-xs font-extrabold uppercase tracking-wide text-green-700">
            Mandatory KYC
          </p>
          <h1 className="mt-1 text-2xl font-extrabold text-gray-950">
            {kycStatus === "APPROVED"
              ? "KYC Verified"
              : kycStatus === "COMPLETED"
                ? "KYC Submitted"
                : "Submit KYC Documents"}
          </h1>
          <p className="mt-2 text-sm font-semibold text-gray-600">
            {kycStatus === "APPROVED"
              ? "Your KYC is verified. You can update documents if needed."
              : kycStatus === "COMPLETED"
                ? "Your KYC is submitted for authority verification within 24 hours."
              : "Upload image or PDF documents before marketplace trading."}
          </p>
        </div>

        {message && (
          <div className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm font-bold text-green-800">
            {message}
          </div>
        )}

        <form onSubmit={submitKyc} className="space-y-4">
          <KycCard
            icon={<FaBuilding />}
            title="Udyan Card"
            numberLabel="Udyan Card No."
            numberValue={form.udyanCardNo}
            numberPlaceholder="Enter Udyan card number"
            onNumberChange={(value) => updateForm("udyanCardNo", value)}
            fileLabel="Upload Udyan Card Pic/PDF"
            onFileChange={(file) => updateFile("udyanCardFile", file)}
          />

          <KycCard
            icon={<FaUniversity />}
            title="Bank Details"
            numberLabel="Bank A/C No."
            numberValue={form.bankAccountNo}
            numberPlaceholder="Enter bank account number"
            onNumberChange={(value) => updateForm("bankAccountNo", value)}
            extraLabel="IFSC Code"
            extraValue={form.ifscCode}
            extraPlaceholder="Enter IFSC code"
            onExtraChange={(value) => updateForm("ifscCode", value)}
            fileLabel="Upload Passbook Pic/PDF"
            onFileChange={(file) => updateFile("passbookFile", file)}
          />

          <KycCard
            icon={<FaIdCard />}
            title="Aadhaar Card"
            numberLabel="Aadhaar Card No."
            numberValue={form.aadhaarCardNo}
            numberPlaceholder="Enter Aadhaar card number"
            onNumberChange={(value) => updateForm("aadhaarCardNo", value)}
            fileLabel="Upload Aadhaar Card Pic/PDF"
            onFileChange={(file) => updateFile("aadhaarCardFile", file)}
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-green-700 py-3 text-sm font-extrabold text-white hover:bg-green-800 disabled:bg-gray-300"
          >
            {loading ? "Submitting..." : "Submit KYC"}
          </button>
        </form>
      </section>
    </div>
  );
}

function KycCard({
  icon,
  title,
  numberLabel,
  numberValue,
  numberPlaceholder,
  onNumberChange,
  extraLabel,
  extraValue,
  extraPlaceholder,
  onExtraChange,
  fileLabel,
  onFileChange,
}) {
  const [fileName, setFileName] = useState("");

  return (
    <section className="rounded-lg border border-green-100 bg-green-50 p-4">
      <div className="mb-3 flex items-center gap-2 text-green-800">
        <span className="text-xl">{icon}</span>
        <h2 className="text-base font-extrabold text-gray-950">{title}</h2>
      </div>
      <div className="grid gap-3">
        <KycInput
          label={numberLabel}
          value={numberValue}
          placeholder={numberPlaceholder}
          onChange={onNumberChange}
        />
        {extraLabel && (
          <KycInput
            label={extraLabel}
            value={extraValue}
            placeholder={extraPlaceholder}
            onChange={onExtraChange}
          />
        )}
        <label className="block">
          <span className="text-sm font-bold text-gray-800">{fileLabel}</span>
          <span className="mt-1 flex items-center gap-2 rounded-md border border-dashed border-green-300 bg-white px-3 py-3 text-sm font-semibold text-gray-600">
            <FaFileUpload className="text-green-700" />
            <span className="min-w-0 flex-1 truncate">
              {fileName || "Choose image or PDF"}
            </span>
            {fileName && <FaCheckCircle className="text-green-700" />}
            <input
              type="file"
              accept="image/*,.pdf,application/pdf"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                setFileName(file?.name || "");
                onFileChange(file);
              }}
            />
          </span>
        </label>
      </div>
    </section>
  );
}

function KycInput({ label, value, placeholder, onChange }) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-gray-800">{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-md border border-green-100 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-green-700"
      />
    </label>
  );
}
