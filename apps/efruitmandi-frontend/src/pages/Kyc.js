import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { FaCheckCircle, FaFileUpload, FaIdCard, FaRedo, FaUniversity } from "react-icons/fa";
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

const KYC_DIRECT_UPLOAD_LABELS = {
  idProofImage: "idProof",
  panImage: "pan",
  gstCertificate: "gstCertificate",
  passbookFile: "passbookFile",
  udyanCardFile: "udyanCard",
  drivingLicenseImage: "drivingLicense",
};

const REQUIRED_DOCUMENT_LABELS_BY_ROLE = {
  buyer: ["idProof", "passbookFile"],
  grower: ["idProof", "passbookFile"],
  driver: ["idProof", "passbookFile", "drivingLicense"],
};

const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024;
const DOCUMENT_PROGRESS_ITEMS = [
  { label: "Aadhaar/ID Proof", key: "idProof", requiredFor: ["buyer", "grower", "driver"] },
  { label: "PAN", key: "pan", optional: true },
  { label: "GST", key: "gstCertificate", optional: true },
  { label: "Bank Proof", key: "passbookFile", requiredFor: ["buyer", "grower", "driver"] },
  { label: "Driving License", key: "drivingLicense", requiredFor: ["driver"] },
];

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

const getCurrentStoredUserId = () => {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    return user._id || user.id || "";
  } catch {
    return "";
  }
};

const getUploadFolderRole = (roleType = "") => (roleType === "driver" ? "logistic" : roleType || "buyer");

const compressImageFile = (file) =>
  new Promise((resolve) => {
    if (!file?.type?.startsWith("image/") || file.size <= 2 * 1024 * 1024) {
      resolve(file);
      return;
    }

    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      const maxDimension = 1600;
      const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(objectUrl);
          if (!blob) {
            resolve(file);
            return;
          }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }));
        },
        "image/jpeg",
        0.78
      );
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };
    image.src = objectUrl;
  });

const uploadToCloudinary = ({ file, signature, onProgress }) =>
  new Promise((resolve, reject) => {
    const data = new FormData();
    data.append("file", file);
    data.append("api_key", signature.apiKey);
    data.append("timestamp", signature.timestamp);
    data.append("signature", signature.signature);
    data.append("folder", signature.folder);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${signature.cloudName}/auto/upload`);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      try {
        const response = JSON.parse(xhr.responseText || "{}");
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(response);
          return;
        }
        reject(new Error(response.error?.message || "Upload failed"));
      } catch (err) {
        reject(err);
      }
    };
    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.send(data);
  });

export default function Kyc() {
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = location.state?.from || "";
  const isQuoteIntent = location.state?.intent === "quote";
  const intentMessage = location.state?.message || "";
  const routeRoleType = location.state?.roleType || "";
  const [form, setForm] = useState(initialForm);
  const [uploads, setUploads] = useState({});
  const [existingDocuments, setExistingDocuments] = useState({});
  const [currentUserId, setCurrentUserId] = useState("");
  const [kycStatus, setKycStatus] = useState("NOT_SUBMITTED");
  const [adminRemarks, setAdminRemarks] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const canEdit = editableStatuses.has(kycStatus);
  const requiredDocumentLabels = REQUIRED_DOCUMENT_LABELS_BY_ROLE[form.roleType] || REQUIRED_DOCUMENT_LABELS_BY_ROLE.buyer;
  const requiredDocumentsUploaded = requiredDocumentLabels.every((label) => existingDocuments[label] || uploads[label]?.status === "uploaded");
  const hasUploadingDocuments = Object.values(uploads).some((upload) => ["uploading", "optimizing"].includes(upload?.status));
  const hasRequiredUploadingDocuments = requiredDocumentLabels.some((label) => ["uploading", "optimizing"].includes(uploads[label]?.status));
  const hasRequiredUploadFailure = requiredDocumentLabels.some((label) => uploads[label]?.status === "failed" && !existingDocuments[label]);
  const canSubmitWithUploads = requiredDocumentsUploaded && !hasRequiredUploadingDocuments && !hasRequiredUploadFailure;
  const visibleProgressItems = DOCUMENT_PROGRESS_ITEMS.filter((item) =>
    item.requiredFor ? item.requiredFor.includes(form.roleType) : true
  );
  const completedDocumentCount = visibleProgressItems.filter((item) => existingDocuments[item.key] || uploads[item.key]?.status === "uploaded").length;
  const completionPercent = Math.round((completedDocumentCount / Math.max(1, visibleProgressItems.length)) * 100);
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
        setCurrentUserId(user._id || user.id || "");
        const nextExistingDocuments = {
          idProof: kyc.idProofImage || kyc.aadhaarCardFileUrl || "",
          pan: kyc.panImage || "",
          gstCertificate: kyc.gstCertificate || "",
          passbookFile: kyc.passbookFileUrl || "",
          udyanCard: kyc.udyanCardFileUrl || "",
          drivingLicense: kyc.drivingLicenseImage || "",
        };

        const nextForm = {
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
        };
        const draftKey = `efruitmandiKycDraft:${user._id || user.id || "guest"}:${roleType}`;
        try {
          const draft = JSON.parse(localStorage.getItem(draftKey) || "{}");
          if (draft?.form && editableStatuses.has(kyc.status || "NOT_SUBMITTED")) {
            Object.assign(nextForm, draft.form, { roleType });
            setAcceptedTerms(Boolean(draft.acceptedTerms));
            Object.assign(nextExistingDocuments, draft.existingDocuments || {});
            if (draft.uploads) setUploads(draft.uploads);
          }
        } catch {
          localStorage.removeItem(draftKey);
        }
        setExistingDocuments(nextExistingDocuments);
        setForm(nextForm);
        setKycStatus(kyc.status || "NOT_SUBMITTED");
        setAdminRemarks(kyc.adminRemarks || "");
        setDraftReady(true);
      } catch {
        setMessage("Please login to update KYC.");
        setDraftReady(true);
      }
    };

    loadKyc();
  }, []);

  useEffect(() => {
    if (!draftReady || !canEdit) return;
    const draftKey = `efruitmandiKycDraft:${currentUserId || getCurrentStoredUserId() || "guest"}:${form.roleType}`;
    const timeout = window.setTimeout(() => {
      const savedUploads = Object.fromEntries(
        Object.entries(uploads)
          .filter(([, upload]) => upload?.status === "uploaded" && upload.document)
          .map(([key, upload]) => [key, { fileName: upload.fileName, status: "uploaded", progress: 100, document: upload.document }])
      );
      localStorage.setItem(
        draftKey,
        JSON.stringify({ form, acceptedTerms, existingDocuments, uploads: savedUploads, savedAt: new Date().toISOString() })
      );
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [acceptedTerms, canEdit, currentUserId, draftReady, existingDocuments, form, uploads]);

  const title = useMemo(() => {
    if (kycStatus === "APPROVED") return "KYC Approved";
    if (kycStatus === "UNDER_REVIEW") return "KYC Under Review";
    if (kycStatus === "PENDING" || kycStatus === "COMPLETED") return "KYC Submitted";
    if (kycStatus === "REJECTED") return "KYC Rejected";
    if (kycStatus === "CORRECTION_REQUIRED") return "Correction Required";
    return "Submit KYC";
  }, [kycStatus]);

  const updateForm = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const uploadKycFile = async (field, file) => {
    const label = KYC_DIRECT_UPLOAD_LABELS[field] || field;
    if (!file) return;
    if (file.size > MAX_DOCUMENT_SIZE_BYTES && !file.type.startsWith("image/")) {
      setUploads((current) => ({
        ...current,
        [label]: { file, fileName: file.name, status: "failed", progress: 0, error: "File must be under 10 MB." },
      }));
      return;
    }

    const userId = currentUserId || getCurrentStoredUserId();
    if (!userId) {
      setUploads((current) => ({
        ...current,
        [label]: { file, fileName: file.name, status: "failed", progress: 0, error: "Login required before upload." },
      }));
      return;
    }

    setUploads((current) => ({
      ...current,
      [label]: { file, fileName: file.name, status: file.type?.startsWith("image/") && file.size > 2 * 1024 * 1024 ? "optimizing" : "uploading", progress: 1, error: "" },
    }));

    try {
      const uploadFile = await compressImageFile(file);
      setUploads((current) => ({
        ...current,
        [label]: { ...(current[label] || {}), status: "uploading", progress: 1 },
      }));
      const folder = `efruitmandi/kyc/${getUploadFolderRole(form.roleType)}/${userId}`;
      const signatureRes = await API.get("/cloudinary/signature", { params: { folder } });
      const uploaded = await uploadToCloudinary({
        file: uploadFile,
        signature: signatureRes.data,
        onProgress: (progress) =>
          setUploads((current) => ({
            ...current,
            [label]: { ...(current[label] || {}), status: "uploading", progress },
          })),
      });

      const document = {
        label,
        url: uploaded.secure_url,
        publicId: uploaded.public_id,
        resourceType: uploaded.resource_type,
        originalFilename: uploaded.original_filename || file.name,
        sizeBytes: uploaded.bytes || uploadFile.size || file.size,
        mimeType: uploadFile.type || file.type,
      };
      setUploads((current) => ({
        ...current,
        [label]: { file, fileName: file.name, status: "uploaded", progress: 100, document },
      }));
      setExistingDocuments((current) => ({ ...current, [label]: uploaded.secure_url }));
    } catch (err) {
      setUploads((current) => ({
        ...current,
        [label]: {
          file,
          fileName: file.name,
          status: "failed",
          progress: 0,
          error: err.response?.data?.msg || err.message || "Upload failed",
        },
      }));
    }
  };

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
    if (!canSubmitWithUploads) {
      setMessage(hasRequiredUploadingDocuments ? "Please wait, required documents are still uploading." : "Upload required KYC documents before submitting.");
      return;
    }

    try {
      setLoading(true);
      const data = {};
      const growerOnlyFields = new Set(["orchardName", "orchardLocation"]);
      const driverOnlyFields = new Set(["vehicleNumber", "drivingLicenseNumber"]);
      Object.entries(form).forEach(([key, value]) => {
        if (growerOnlyFields.has(key) && form.roleType !== "grower") return;
        if (driverOnlyFields.has(key) && form.roleType !== "driver") return;
        data[key] = String(value || "").trim();
      });
      data.acceptedTerms = true;
      data.documents = Object.values(uploads)
        .filter((upload) => upload?.status === "uploaded" && upload.document)
        .map((upload) => upload.document);

      const endpoint = kycStatus === "NOT_SUBMITTED" ? "/kyc/submit" : "/kyc/update";
      const res = endpoint.endsWith("submit")
        ? await API.post(endpoint, data)
        : await API.put(endpoint, data);
      saveUserToStorage(res.data);
      setKycStatus(res.data?.kyc?.status || "PENDING");
      setMessage("KYC submitted successfully.");
      localStorage.removeItem(`efruitmandiKycDraft:${currentUserId || getCurrentStoredUserId() || "guest"}:${form.roleType}`);
      if (returnTo) window.setTimeout(() => navigate(returnTo), 900);
    } catch (err) {
      setMessage(err.response?.data?.msg || "KYC submission failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto min-h-[calc(100vh-132px)] max-w-4xl overflow-x-hidden px-3 pb-44 md:min-h-[calc(100vh-94px)] md:px-4 md:pb-20">
      <section className="w-full overflow-hidden rounded-lg border border-gray-200 bg-white p-3 shadow-sm md:p-5">
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

        <KycMobileProgressSummary
          items={visibleProgressItems}
          uploads={uploads}
          existingDocuments={existingDocuments}
          completed={completedDocumentCount}
          total={visibleProgressItems.length}
        />

        <form onSubmit={submitKyc} className="space-y-4">
          <section className="min-w-0 rounded-lg border border-green-100 bg-green-50 p-3 md:p-4">
            <h2 className="mb-3 text-base font-extrabold text-gray-950">User Details</h2>
            <div className="grid min-w-0 gap-3 md:grid-cols-2">
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

          <section className="min-w-0 rounded-lg border border-green-100 bg-green-50 p-3 md:p-4">
            <div className="mb-3 flex items-center gap-2 text-green-800">
              <FaIdCard />
              <h2 className="text-base font-extrabold text-gray-950">Identity Documents</h2>
            </div>
            <div className="grid min-w-0 gap-3 md:grid-cols-2">
              <KycInput label="ID Proof Type" value={form.idProofType} disabled={!canEdit} onChange={(value) => updateForm("idProofType", value)} />
              <KycInput label="ID Proof Number" value={form.idProofNumber} disabled={!canEdit} onChange={(value) => updateForm("idProofNumber", value)} />
              <FileField required label="Upload ID Proof" disabled={!canEdit} upload={uploads.idProof} existingUrl={existingDocuments.idProof} onFileChange={(file) => uploadKycFile("idProofImage", file)} onRetry={() => uploads.idProof?.file && uploadKycFile("idProofImage", uploads.idProof.file)} />
            </div>
            <OptionalKycSection title="PAN Details Optional">
              <div className="grid min-w-0 gap-3 md:grid-cols-2">
                <KycInput label="PAN Number optional" value={form.panNumber} disabled={!canEdit} onChange={(value) => updateForm("panNumber", value)} />
                <FileField label="Upload PAN optional" disabled={!canEdit} upload={uploads.pan} existingUrl={existingDocuments.pan} onFileChange={(file) => uploadKycFile("panImage", file)} onRetry={() => uploads.pan?.file && uploadKycFile("panImage", uploads.pan.file)} />
              </div>
            </OptionalKycSection>
            <OptionalKycSection title="GST Details Optional">
              <div className="grid min-w-0 gap-3 md:grid-cols-2">
                <KycInput label="GST Number optional" value={form.gstNumber} disabled={!canEdit} onChange={(value) => updateForm("gstNumber", value)} />
                <FileField label="Upload GST Certificate optional" disabled={!canEdit} upload={uploads.gstCertificate} existingUrl={existingDocuments.gstCertificate} onFileChange={(file) => uploadKycFile("gstCertificate", file)} onRetry={() => uploads.gstCertificate?.file && uploadKycFile("gstCertificate", uploads.gstCertificate.file)} />
              </div>
            </OptionalKycSection>
          </section>

          <section className="min-w-0 rounded-lg border border-green-100 bg-green-50 p-3 md:p-4">
            <div className="mb-3 flex items-center gap-2 text-green-800">
              <FaUniversity />
              <h2 className="text-base font-extrabold text-gray-950">Bank Details</h2>
            </div>
            <div className="grid min-w-0 gap-3 md:grid-cols-2">
              <KycInput label="Account Holder Name" value={form.bankAccountHolderName} disabled={!canEdit} onChange={(value) => updateForm("bankAccountHolderName", value)} />
              <KycInput label="Bank Name" value={form.bankName} disabled={!canEdit} onChange={(value) => updateForm("bankName", value)} />
              <KycInput label="Account Number" value={form.accountNumber} disabled={!canEdit} onChange={(value) => updateForm("accountNumber", value)} />
              <KycInput label="IFSC Code" value={form.ifscCode} disabled={!canEdit} onChange={(value) => updateForm("ifscCode", value)} />
              <KycInput label="UPI ID optional" value={form.upiId} disabled={!canEdit} onChange={(value) => updateForm("upiId", value)} />
              <FileField required label="Upload Bank Proof / Passbook" disabled={!canEdit} upload={uploads.passbookFile} existingUrl={existingDocuments.passbookFile} onFileChange={(file) => uploadKycFile("passbookFile", file)} onRetry={() => uploads.passbookFile?.file && uploadKycFile("passbookFile", uploads.passbookFile.file)} />
            </div>
          </section>

          {form.roleType === "grower" && (
            <section className="min-w-0 rounded-lg border border-green-100 bg-green-50 p-3 md:p-4">
              <h2 className="mb-3 text-base font-extrabold text-gray-950">Grower Details</h2>
              <div className="grid min-w-0 gap-3 md:grid-cols-2">
                <KycInput label="Orchard Name optional" value={form.orchardName} disabled={!canEdit} onChange={(value) => updateForm("orchardName", value)} />
                <KycInput label="Orchard Location optional" value={form.orchardLocation} disabled={!canEdit} onChange={(value) => updateForm("orchardLocation", value)} />
              </div>
            </section>
          )}

          {form.roleType === "driver" && (
            <section className="min-w-0 rounded-lg border border-green-100 bg-green-50 p-3 md:p-4">
              <h2 className="mb-3 text-base font-extrabold text-gray-950">Driver Details</h2>
              <div className="grid min-w-0 gap-3 md:grid-cols-2">
                <KycInput label="Vehicle Number" value={form.vehicleNumber} disabled={!canEdit} onChange={(value) => updateForm("vehicleNumber", value)} />
                <KycInput label="Driving License Number" value={form.drivingLicenseNumber} disabled={!canEdit} onChange={(value) => updateForm("drivingLicenseNumber", value)} />
                <FileField required label="Upload Driving License" disabled={!canEdit} upload={uploads.drivingLicense} existingUrl={existingDocuments.drivingLicense} onFileChange={(file) => uploadKycFile("drivingLicenseImage", file)} onRetry={() => uploads.drivingLicense?.file && uploadKycFile("drivingLicenseImage", uploads.drivingLicense.file)} />
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
            disabled={loading || !canEdit || !canSubmitWithUploads}
            className="hidden w-full rounded-md bg-green-700 py-3 text-sm font-extrabold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-gray-300 md:block"
          >
            {loading
              ? "Submitting..."
              : !canEdit
                ? "KYC Locked"
                : hasUploadingDocuments
                  ? "Uploading Documents..."
                  : !requiredDocumentsUploaded
                    ? "Upload Required Documents"
                    : "Submit KYC"}
          </button>
          <div className="flex justify-center">
            <BackHomeButton />
          </div>
        </form>
      </section>
      <MobileSubmitBar
        loading={loading}
        canEdit={canEdit}
        canSubmit={canSubmitWithUploads}
        hasUploading={hasUploadingDocuments}
        requiredUploaded={requiredDocumentsUploaded}
        percent={completionPercent}
        onSubmit={(event) => submitKyc(event)}
      />
    </div>
  );
}

function SelectField({ label, value, options, disabled, onChange }) {
  return (
    <label className="block min-w-0">
      <span className="text-sm font-bold text-gray-800">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full min-w-0 rounded-md border border-green-100 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-green-700 disabled:bg-gray-100"
      >
        {options.map(([optionValue, labelText]) => (
          <option key={optionValue} value={optionValue}>{labelText}</option>
        ))}
      </select>
    </label>
  );
}

function OptionalKycSection({ title, children }) {
  return (
    <details className="mt-3 rounded-md border border-green-100 bg-white/70 p-3 md:open">
      <summary className="cursor-pointer text-sm font-extrabold text-green-800">{title}</summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

function getDocumentState(key, uploads = {}, existingDocuments = {}) {
  const upload = uploads[key];
  if (upload?.status) return upload.status;
  if (existingDocuments[key]) return "uploaded";
  return "pending";
}

function KycMobileProgressSummary({ items, uploads, existingDocuments, completed, total }) {
  return (
    <div className="sticky top-[56px] z-20 mb-3 rounded-lg border border-green-100 bg-white/95 p-2 shadow-sm backdrop-blur md:hidden">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-extrabold text-green-900">KYC Progress</p>
        <p className="text-xs font-extrabold text-green-700">{completed}/{total} completed</p>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1">
        {items.map((item) => {
          const state = getDocumentState(item.key, uploads, existingDocuments);
          const label =
            state === "uploaded"
              ? "Uploaded"
              : state === "uploading"
                ? "Uploading"
                : state === "optimizing"
                  ? "Optimizing"
                  : state === "failed"
                    ? "Retry"
                    : item.optional
                      ? "Optional"
                      : "Pending";
          return (
            <div key={item.key} className="min-w-0 rounded-md bg-green-50 px-2 py-1">
              <p className="truncate text-[10px] font-bold text-gray-700">{item.label}</p>
              <p className={`text-[10px] font-extrabold ${state === "failed" ? "text-red-700" : state === "uploaded" ? "text-green-700" : "text-gray-500"}`}>
                {label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MobileSubmitBar({ loading, canEdit, canSubmit, hasUploading, requiredUploaded, percent, onSubmit }) {
  const label = loading
    ? "Submitting..."
    : !canEdit
      ? "KYC Locked"
      : hasUploading
        ? "Uploading documents..."
        : !requiredUploaded
          ? "Upload required docs"
          : "Submit KYC";

  return (
    <div className="fixed inset-x-0 bottom-16 z-40 border-t border-green-100 bg-white/95 px-3 py-2 shadow-[0_-8px_20px_rgba(0,0,0,0.08)] backdrop-blur md:hidden">
      <div className="mx-auto max-w-md">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-xs font-extrabold text-gray-800">KYC Completion</span>
          <span className="text-xs font-extrabold text-green-700">{percent}%</span>
        </div>
        <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-green-100">
          <div className="h-full bg-green-700 transition-all" style={{ width: `${percent}%` }} />
        </div>
        <button
          type="button"
          onClick={onSubmit}
          disabled={loading || !canEdit || !canSubmit}
          className="w-full rounded-full bg-green-700 py-2.5 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {label}
        </button>
      </div>
    </div>
  );
}

function FileField({ label, required = false, disabled, upload, existingUrl, onFileChange, onRetry }) {
  const [fileName, setFileName] = useState("");
  const statusText =
    upload?.status === "optimizing"
      ? "Optimizing image..."
      : upload?.status === "uploading"
      ? `Uploading... ${upload.progress || 0}%`
      : upload?.status === "uploaded" || existingUrl
        ? "Uploaded"
        : upload?.status === "failed"
          ? "Failed"
          : "";
  return (
    <label className="block min-w-0">
      <span className="text-sm font-bold text-gray-800">{label}</span>
      <span className="mt-1 block rounded-md border border-dashed border-green-300 bg-white p-2 text-sm font-semibold text-gray-600">
        <span className="flex min-w-0 items-center gap-2">
          <FaFileUpload className="shrink-0 text-green-700" />
          <span className="min-w-0 flex-1 truncate">
            {fileName || upload?.fileName || (existingUrl ? "Already uploaded" : `+ ${label}`)}
          </span>
          {(upload?.status === "uploaded" || existingUrl) && <FaCheckCircle className="shrink-0 text-green-700" />}
        </span>
        {!upload?.status && !existingUrl && (
          <span className="mt-1 block truncate text-[11px] font-bold text-gray-400">
            JPEG, PNG, PDF | Max 10 MB{required ? " | Required" : " | Optional"}
          </span>
        )}
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
      {statusText && (
        <div className={`mt-1 flex min-w-0 items-center gap-2 text-xs font-extrabold ${upload?.status === "failed" ? "text-red-700" : "text-green-800"}`}>
          <span className="min-w-0 truncate">
          {statusText}
          </span>
          {upload?.status === "failed" && (
            <>
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onRetry?.();
                }}
                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-extrabold text-red-700 ring-1 ring-red-100"
              >
                <FaRedo />
                Retry
              </button>
            </>
          )}
          {(upload?.status === "uploaded" || existingUrl) && existingUrl && (
            <a
              href={existingUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
              className="shrink-0 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-extrabold text-green-700 ring-1 ring-green-100"
            >
              Preview
            </a>
          )}
        </div>
      )}
      {(upload?.status === "uploading" || upload?.status === "optimizing") && (
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-green-100">
          <div className="h-full bg-green-700 transition-all" style={{ width: `${upload?.status === "optimizing" ? 12 : upload.progress || 0}%` }} />
        </div>
      )}
    </label>
  );
}

function KycInput({ label, value, disabled, onChange }) {
  return (
    <label className="block min-w-0">
      <span className="text-sm font-bold text-gray-800">{label}</span>
      <input
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full min-w-0 rounded-md border border-green-100 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-green-700 disabled:bg-gray-100"
      />
    </label>
  );
}
