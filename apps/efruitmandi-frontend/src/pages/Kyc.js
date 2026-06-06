import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { FaCheckCircle, FaFileUpload, FaIdCard, FaUniversity } from "react-icons/fa";
import API from "../services/api";
import BackHomeButton from "../components/BackHomeButton";
import { getKycStatusLabel, getProfileTypes } from "../utils/auth";
import { saveUserToStorage } from "../utils/userStorage";

const initialForm = {
  roleType: "buyer",
  fullName: "",
  phone: "",
  email: "",
  address: "",
  district: "",
  state: "",
  pinCode: "",
  idProofType: "Aadhaar",
  idProofNumber: "",
  panNumber: "",
  gstNumber: "",
  bankAccountHolderName: "",
  bankName: "",
  accountNumber: "",
  ifscCode: "",
  upiId: "",
  orchardName: "",
  orchardLocation: "",
  vehicleNumber: "",
  drivingLicenseNumber: "",
};

const statusMessages = {
  NOT_SUBMITTED: "Submit KYC documents for admin review.",
  PENDING: "Your KYC has been submitted and is waiting for admin review.",
  COMPLETED: "Your KYC has been submitted and is waiting for admin review.",
  UNDER_REVIEW: "Your KYC is currently under review.",
  APPROVED: "Your KYC is approved.",
  REJECTED: "Your KYC was rejected. Please check remarks and submit again.",
  CORRECTION_REQUIRED: "Please update the requested details and resubmit.",
};

const editableStatuses = new Set(["NOT_SUBMITTED", "REJECTED", "CORRECTION_REQUIRED"]);
const validRoleTypes = new Set(["buyer", "grower", "driver"]);
const roleTitleLabels = {
  buyer: "Buyer's Account",
  grower: "Grower's Account",
  driver: "Driver's Account",
};

const resolveLockedRoleType = (user = {}, kyc = {}, routeRoleType = "") => {
  const profiles = getProfileTypes(user);
  const routeRole = String(routeRoleType || "").toLowerCase();
  if (validRoleTypes.has(routeRole) && (profiles.size === 0 || profiles.has(routeRole))) return routeRole;

  const switchedMode = String(localStorage.getItem("efruitmandiProfileMode") || "").toLowerCase();
  if (validRoleTypes.has(switchedMode) && profiles.has(switchedMode)) return switchedMode;

  const userRole = String(user.role || "").toLowerCase();
  if (validRoleTypes.has(userRole) && (profiles.size === 0 || profiles.has(userRole))) return userRole;

  const kycRole = String(kyc.roleType || "").toLowerCase();
  if (validRoleTypes.has(kycRole) && (profiles.size === 0 || profiles.has(kycRole))) return kycRole;

  if (profiles.has("grower")) return "grower";
  if (profiles.has("driver")) return "driver";
  return "buyer";
};

const joinAddressParts = (...parts) =>
  parts
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(", ");

const getBuyerPremisesAddress = (user = {}) =>
  user.buyerLocation ||
  joinAddressParts(
    user.businessAddressLine1,
    user.businessAddressLine2,
    user.businessAddressLine3
  ) ||
  user.location ||
  "";

const getGrowerPremisesAddress = (user = {}) =>
  joinAddressParts(
    user.addressLine1,
    user.addressLine2,
    user.addressLine3,
    user.location
  ) || user.location || "";

const getRolePremisesAddress = (user = {}, roleType = "") => {
  if (roleType === "buyer") return getBuyerPremisesAddress(user);
  if (roleType === "grower") return getGrowerPremisesAddress(user);
  return user.location || "";
};

const getRolePinCode = (user = {}, roleType = "") => {
  if (roleType === "buyer") return user.buyerPinCode || user.businessPinCode || user.pinCode || "";
  return user.pinCode || "";
};

export default function Kyc() {
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = location.state?.from || "";
  const isQuoteIntent = location.state?.intent === "quote";
  const intentMessage = location.state?.message || "";
  const routeRoleType = location.state?.roleType || "";
  const [form, setForm] = useState(initialForm);
  const [files, setFiles] = useState({});
  const [kycStatus, setKycStatus] = useState("NOT_SUBMITTED");
  const [adminRemarks, setAdminRemarks] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const canEdit = editableStatuses.has(kycStatus);
  const premisesAddressLabel =
    form.roleType === "buyer"
      ? "Buyer Premises Address"
      : form.roleType === "grower"
        ? "Grower Premises Address"
        : "Premises Address";

  useEffect(() => {
    const loadKyc = async () => {
      try {
        const requestedRoleType = routeRoleType || localStorage.getItem("efruitmandiProfileMode") || "";
        const res = await API.get("/kyc/me", {
          params: requestedRoleType ? { roleType: requestedRoleType } : {},
        });
        const user = res.data?.user || {};
        const kyc = res.data?.kyc || {};
        const roleType = resolveLockedRoleType(user, kyc, routeRoleType);

        setForm({
          ...initialForm,
          roleType,
          fullName: kyc.fullName || user.name || "",
          phone: kyc.phone || user.phone || "",
          email: kyc.email || user.email || "",
          address: kyc.address || getRolePremisesAddress(user, roleType),
          district: kyc.district || "",
          state: kyc.state || "",
          pinCode: kyc.pinCode || getRolePinCode(user, roleType),
          idProofType: kyc.idProofType || "Aadhaar",
          idProofNumber: kyc.idProofNumber || kyc.aadhaarCardNo || "",
          panNumber: kyc.panNumber || "",
          gstNumber: kyc.gstNumber || user.gstNumber || "",
          bankAccountHolderName: kyc.bankAccountHolderName || user.name || "",
          bankName: kyc.bankName || "",
          accountNumber: kyc.accountNumber || kyc.bankAccountNo || "",
          ifscCode: kyc.ifscCode || "",
          upiId: kyc.upiId || "",
          orchardName: kyc.orchardName || user.orchardName || "",
          orchardLocation: kyc.orchardLocation || getGrowerPremisesAddress(user),
          vehicleNumber: kyc.vehicleNumber || "",
          drivingLicenseNumber: kyc.drivingLicenseNumber || "",
        });
        setKycStatus(kyc.status || "NOT_SUBMITTED");
        setAdminRemarks(kyc.adminRemarks || "");
      } catch {
        setMessage("Please login to update KYC.");
      }
    };

    loadKyc();
  }, []);

  const title = useMemo(() => {
    if (kycStatus === "APPROVED") return "KYC Approved";
    if (kycStatus === "UNDER_REVIEW") return "KYC Under Review";
    if (kycStatus === "PENDING" || kycStatus === "COMPLETED") return "KYC Submitted";
    if (kycStatus === "REJECTED") return "KYC Rejected";
    if (kycStatus === "CORRECTION_REQUIRED") return "Correction Required";
    return "Submit KYC";
  }, [kycStatus]);

  const updateForm = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const updateFile = (field, file) => setFiles((current) => ({ ...current, [field]: file || null }));

  const submitKyc = async (event) => {
    event.preventDefault();
    setMessage("");

    if (!canEdit) {
      setMessage(kycStatus === "APPROVED" ? "KYC already approved." : "Only rejected or correction-required KYC can be edited.");
      return;
    }

    const requiredFields = [
      "roleType",
      "fullName",
      "phone",
      "address",
      "pinCode",
      "idProofType",
      "idProofNumber",
      "bankAccountHolderName",
      "bankName",
      "accountNumber",
      "ifscCode",
    ];
    if (form.roleType === "driver") requiredFields.push("vehicleNumber", "drivingLicenseNumber");
    const missing = requiredFields.filter((field) => !String(form[field] || "").trim());
    if (missing.length) {
      setMessage(`Complete required fields: ${missing.join(", ")}`);
      return;
    }
    if (!acceptedTerms) {
      setMessage("Accept the Terms of Use before submitting KYC.");
      return;
    }

    try {
      setLoading(true);
      const data = new FormData();
      const growerOnlyFields = new Set(["orchardName", "orchardLocation"]);
      const driverOnlyFields = new Set(["vehicleNumber", "drivingLicenseNumber"]);
      Object.entries(form).forEach(([key, value]) => {
        if (growerOnlyFields.has(key) && form.roleType !== "grower") return;
        if (driverOnlyFields.has(key) && form.roleType !== "driver") return;
        data.append(key, String(value || "").trim());
      });
      data.append("acceptedTerms", "true");
      Object.entries(files).forEach(([key, file]) => {
        if (file) data.append(key, file);
      });

      const endpoint = kycStatus === "NOT_SUBMITTED" ? "/kyc/submit" : "/kyc/update";
      const res = endpoint.endsWith("submit")
        ? await API.post(endpoint, data)
        : await API.put(endpoint, data);
      saveUserToStorage(res.data);
      setKycStatus(res.data?.kyc?.status || "PENDING");
      setMessage("KYC submitted successfully.");
      if (returnTo) window.setTimeout(() => navigate(returnTo), 900);
    } catch (err) {
      setMessage(err.response?.data?.msg || "KYC submission failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto min-h-[calc(100vh-132px)] max-w-4xl px-4 pb-20 md:min-h-[calc(100vh-94px)]">
      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-5">
          <h1 className="text-2xl font-extrabold text-gray-950">
            eFruitMandi KYC {roleTitleLabels[form.roleType] || "Account"}
          </h1>
          {isQuoteIntent && (
            <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm font-extrabold text-amber-900">
              Current KYC status: {getKycStatusLabel({ kyc: { status: kycStatus } })}
            </p>
          )}
          {intentMessage && !isQuoteIntent && (
            <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm font-extrabold text-amber-900">
              {intentMessage}
            </p>
          )}
          {adminRemarks && (
            <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800">
              Admin remarks: {adminRemarks}
            </p>
          )}
        </div>

        {message && (
          <div className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm font-bold text-green-800">
            {message}
          </div>
        )}

        <form onSubmit={submitKyc} className="space-y-4">
          <section className="rounded-lg border border-green-100 bg-green-50 p-4">
            <h2 className="mb-3 text-base font-extrabold text-gray-950">User Details</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <SelectField label="Role Type" value={form.roleType} disabled onChange={(value) => updateForm("roleType", value)} options={[
                ["buyer", "Buyer"],
                ["grower", "Grower / Seller"],
                ["driver", "Driver"],
              ]} />
              <KycInput label="Full Name" value={form.fullName} disabled={!canEdit} onChange={(value) => updateForm("fullName", value)} />
              <KycInput label="Phone" value={form.phone} disabled={!canEdit} onChange={(value) => updateForm("phone", value)} />
              <KycInput label="Email" value={form.email} disabled={!canEdit} onChange={(value) => updateForm("email", value)} />
              <KycInput label={premisesAddressLabel} value={form.address} disabled={!canEdit} onChange={(value) => updateForm("address", value)} />
              <KycInput label="District" value={form.district} disabled={!canEdit} onChange={(value) => updateForm("district", value)} />
              <KycInput label="State" value={form.state} disabled={!canEdit} onChange={(value) => updateForm("state", value)} />
              <KycInput label="PIN Code" value={form.pinCode} disabled={!canEdit} onChange={(value) => updateForm("pinCode", value)} />
            </div>
          </section>

          <section className="rounded-lg border border-green-100 bg-green-50 p-4">
            <div className="mb-3 flex items-center gap-2 text-green-800">
              <FaIdCard />
              <h2 className="text-base font-extrabold text-gray-950">Identity Documents</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <KycInput label="ID Proof Type" value={form.idProofType} disabled={!canEdit} onChange={(value) => updateForm("idProofType", value)} />
              <KycInput label="ID Proof Number" value={form.idProofNumber} disabled={!canEdit} onChange={(value) => updateForm("idProofNumber", value)} />
              <FileField label="Upload ID Proof" disabled={!canEdit} onFileChange={(file) => updateFile("idProofImage", file)} />
              <KycInput label="PAN Number optional" value={form.panNumber} disabled={!canEdit} onChange={(value) => updateForm("panNumber", value)} />
              <FileField label="Upload PAN optional" disabled={!canEdit} onFileChange={(file) => updateFile("panImage", file)} />
              <KycInput label="GST Number optional" value={form.gstNumber} disabled={!canEdit} onChange={(value) => updateForm("gstNumber", value)} />
              <FileField label="Upload GST Certificate optional" disabled={!canEdit} onFileChange={(file) => updateFile("gstCertificate", file)} />
            </div>
          </section>

          <section className="rounded-lg border border-green-100 bg-green-50 p-4">
            <div className="mb-3 flex items-center gap-2 text-green-800">
              <FaUniversity />
              <h2 className="text-base font-extrabold text-gray-950">Bank Details</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <KycInput label="Account Holder Name" value={form.bankAccountHolderName} disabled={!canEdit} onChange={(value) => updateForm("bankAccountHolderName", value)} />
              <KycInput label="Bank Name" value={form.bankName} disabled={!canEdit} onChange={(value) => updateForm("bankName", value)} />
              <KycInput label="Account Number" value={form.accountNumber} disabled={!canEdit} onChange={(value) => updateForm("accountNumber", value)} />
              <KycInput label="IFSC Code" value={form.ifscCode} disabled={!canEdit} onChange={(value) => updateForm("ifscCode", value)} />
              <KycInput label="UPI ID optional" value={form.upiId} disabled={!canEdit} onChange={(value) => updateForm("upiId", value)} />
              <FileField label="Upload Bank Proof / Passbook" disabled={!canEdit} onFileChange={(file) => updateFile("passbookFile", file)} />
            </div>
          </section>

          {form.roleType === "grower" && (
            <section className="rounded-lg border border-green-100 bg-green-50 p-4">
              <h2 className="mb-3 text-base font-extrabold text-gray-950">Grower Details</h2>
              <div className="grid gap-3 md:grid-cols-2">
                <KycInput label="Orchard Name optional" value={form.orchardName} disabled={!canEdit} onChange={(value) => updateForm("orchardName", value)} />
                <KycInput label="Orchard Location optional" value={form.orchardLocation} disabled={!canEdit} onChange={(value) => updateForm("orchardLocation", value)} />
              </div>
            </section>
          )}

          {form.roleType === "driver" && (
            <section className="rounded-lg border border-green-100 bg-green-50 p-4">
              <h2 className="mb-3 text-base font-extrabold text-gray-950">Driver Details</h2>
              <div className="grid gap-3 md:grid-cols-2">
                <KycInput label="Vehicle Number" value={form.vehicleNumber} disabled={!canEdit} onChange={(value) => updateForm("vehicleNumber", value)} />
                <KycInput label="Driving License Number" value={form.drivingLicenseNumber} disabled={!canEdit} onChange={(value) => updateForm("drivingLicenseNumber", value)} />
                <FileField label="Upload Driving License" disabled={!canEdit} onFileChange={(file) => updateFile("drivingLicenseImage", file)} />
              </div>
            </section>
          )}

          <label className="flex items-start gap-3 rounded-lg border border-green-100 bg-white p-3 text-sm font-bold text-gray-800">
            <input
              type="checkbox"
              checked={acceptedTerms}
              disabled={!canEdit}
              onChange={(event) => setAcceptedTerms(event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-green-300 text-green-700 focus:ring-green-600 disabled:opacity-60"
            />
            <span>
              I accept eFruitMandi{" "}
              <Link
                to="/terms-and-conditions"
                target="_blank"
                rel="noreferrer"
                className="font-extrabold text-green-700 underline"
              >
                Terms of Use
              </Link>
              {" "}for KYC verification and marketplace activity.
            </span>
          </label>

          <button
            type="submit"
            disabled={loading || !canEdit}
            className="w-full rounded-md bg-green-700 py-3 text-sm font-extrabold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {loading ? "Submitting..." : canEdit ? "Submit KYC" : "KYC Locked"}
          </button>
          <div className="flex justify-center">
            <BackHomeButton />
          </div>
        </form>
      </section>
    </div>
  );
}

function SelectField({ label, value, options, disabled, onChange }) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-gray-800">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-md border border-green-100 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-green-700 disabled:bg-gray-100"
      >
        {options.map(([optionValue, labelText]) => (
          <option key={optionValue} value={optionValue}>{labelText}</option>
        ))}
      </select>
    </label>
  );
}

function FileField({ label, disabled, onFileChange }) {
  const [fileName, setFileName] = useState("");
  return (
    <label className="block">
      <span className="text-sm font-bold text-gray-800">{label}</span>
      <span className="mt-1 flex items-center gap-2 rounded-md border border-dashed border-green-300 bg-white px-3 py-3 text-sm font-semibold text-gray-600">
        <FaFileUpload className="text-green-700" />
        <span className="min-w-0 flex-1 truncate">{fileName || "Choose image or PDF"}</span>
        {fileName && <FaCheckCircle className="text-green-700" />}
        <input
          type="file"
          disabled={disabled}
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
  );
}

function KycInput({ label, value, disabled, onChange }) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-gray-800">{label}</span>
      <input
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-md border border-green-100 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-green-700 disabled:bg-gray-100"
      />
    </label>
  );
}
