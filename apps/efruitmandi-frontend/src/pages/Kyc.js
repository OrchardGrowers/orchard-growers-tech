import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  FaCheckCircle,
  FaFileUpload,
  FaIdCard,
  FaRedo,
  FaUniversity,
} from "react-icons/fa";
import API, { getApiErrorMessage, getApiFieldErrors } from "../services/api";
import { trackKycSubmitted } from "../services/analytics";
import BackHomeButton from "../components/BackHomeButton";
import VerificationFeedback from "../components/VerificationFeedback";
import { getKycStatusLabel, getProfileTypes } from "../utils/auth";
import {
  prepareUploadFile,
  getMobileUploadErrorMessage,
} from "../utils/mobileMedia";
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
  PENDING: "Your KYC has been submitted. Please allow up to 24 hours for verification.",
  COMPLETED: "Your KYC has been submitted. Please allow up to 24 hours for verification.",
  UNDER_REVIEW: "Your KYC is under review. Please allow up to 24 hours for verification.",
  APPROVED: "Your KYC is approved.",
  REJECTED: "Your KYC was rejected. Please check remarks and submit again.",
  CORRECTION_REQUIRED: "Please update the requested details and resubmit.",
};

const editableStatuses = new Set([
  "NOT_SUBMITTED",
  "REJECTED",
  "CORRECTION_REQUIRED",
]);
const SECTION_EDITABLE_STATUSES = new Set(["NOT_SUBMITTED", "CHANGES_REQUIRED", "REJECTED"]);
const KYC_SECTION_FIELDS = {
  personal: ["fullName", "phone", "email", "address", "district", "state", "pinCode"],
  identity: ["idProofType", "idProofNumber", "gstNumber"],
  pan: ["panNumber"],
  bank: ["bankAccountHolderName", "bankName", "accountNumber", "ifscCode", "upiId"],
  business: ["orchardName", "orchardLocation"],
  driver: ["vehicleNumber", "drivingLicenseNumber"],
};
const KYC_SECTION_UPLOAD_LABELS = {
  personal: [],
  identity: ["idProof", "gstCertificate"],
  pan: ["pan"],
  bank: ["passbookFile"],
  business: ["udyanCard"],
  driver: ["drivingLicense"],
};
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
  buyer: ["idProof", "pan", "passbookFile"],
  grower: ["idProof", "pan", "passbookFile"],
  driver: ["idProof", "passbookFile", "drivingLicense"],
};

const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_DOCUMENT_SIZE_MB = Math.round(
  MAX_DOCUMENT_SIZE_BYTES / (1024 * 1024),
);
const ALLOWED_DOCUMENT_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/pdf",
]);
const ALLOWED_DOCUMENT_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "pdf"]);
const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const DOCUMENT_PROGRESS_ITEMS = [
  {
    label: "Aadhaar/ID Proof",
    key: "idProof",
    requiredFor: ["buyer", "grower", "driver"],
  },
  { label: "PAN", key: "pan", requiredFor: ["buyer", "grower"] },
  { label: "GST", key: "gstCertificate", optional: true },
  {
    label: "Bank Proof",
    key: "passbookFile",
    requiredFor: ["buyer", "grower", "driver"],
  },
  { label: "Driving License", key: "drivingLicense", requiredFor: ["driver"] },
];

const resolveLockedRoleType = (user = {}, kyc = {}, routeRoleType = "") => {
  const profiles = getProfileTypes(user);
  const routeRole = String(routeRoleType || "").toLowerCase();
  if (
    validRoleTypes.has(routeRole) &&
    (profiles.size === 0 || profiles.has(routeRole))
  )
    return routeRole;

  const switchedMode = String(
    localStorage.getItem("efruitmandiProfileMode") || "",
  ).toLowerCase();
  if (validRoleTypes.has(switchedMode) && profiles.has(switchedMode))
    return switchedMode;

  const userRole = String(user.role || "").toLowerCase();
  if (
    validRoleTypes.has(userRole) &&
    (profiles.size === 0 || profiles.has(userRole))
  )
    return userRole;

  const kycRole = String(kyc.roleType || "").toLowerCase();
  if (
    validRoleTypes.has(kycRole) &&
    (profiles.size === 0 || profiles.has(kycRole))
  )
    return kycRole;

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
    user.businessAddressLine3,
  ) ||
  user.location ||
  "";

const getGrowerPremisesAddress = (user = {}) =>
  joinAddressParts(
    user.addressLine1,
    user.addressLine2,
    user.addressLine3,
    user.location,
  ) ||
  user.location ||
  "";

const getRolePremisesAddress = (user = {}, roleType = "") => {
  if (roleType === "buyer") return getBuyerPremisesAddress(user);
  if (roleType === "grower") return getGrowerPremisesAddress(user);
  return user.location || "";
};

const getRolePinCode = (user = {}, roleType = "") => {
  if (roleType === "buyer")
    return user.buyerPinCode || user.businessPinCode || user.pinCode || "";
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

const getUploadFolderRole = (roleType = "") =>
  roleType === "driver" ? "logistic" : roleType || "buyer";

const isAadhaarProof = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase() === "aadhaar";

const normalizeAadhaar = (value = "") =>
  String(value || "")
    .replace(/\D/g, "")
    .slice(0, 12);

const maskAadhaar = (value = "") => {
  const digits = normalizeAadhaar(value);
  if (digits.length !== 12) return value;
  return `XXXX XXXX ${digits.slice(-4)}`;
};

const validateDocumentFile = (file) => {
  if (!file) return "Select a JPG, PNG, WebP, or PDF document.";
  const extension =
    String(file.name || "")
      .split(".")
      .pop()
      ?.toLowerCase() || "";
  if (
    !ALLOWED_DOCUMENT_TYPES.has(file.type) ||
    !ALLOWED_DOCUMENT_EXTENSIONS.has(extension)
  ) {
    return "Only JPG, JPEG, PNG, WebP, or PDF files are accepted.";
  }
  if (file.size > MAX_DOCUMENT_SIZE_BYTES && !file.type.startsWith("image/")) {
    return `PDF files must be under ${MAX_DOCUMENT_SIZE_MB} MB.`;
  }
  return "";
};

const buildKycValidation = (
  form,
  acceptedTerms,
  canSubmitWithUploads,
  uploadStateText,
  panDocumentAvailable,
) => {
  const errors = {};
  const requiredFields = [
    ["fullName", "Full name is required."],
    ["phone", "Phone is required."],
    ["address", "Buyer premises address is required."],
    ["pinCode", "PIN code is required."],
    ["idProofType", "ID proof type is required."],
    ["idProofNumber", "ID proof number is required."],
    ["bankAccountHolderName", "Account holder name is required."],
    ["bankName", "Bank name is required."],
    ["accountNumber", "Bank account number is required."],
    ["ifscCode", "IFSC code is required."],
  ];

  requiredFields.forEach(([field, message]) => {
    if (!String(form[field] || "").trim()) errors[field] = message;
  });

  if (
    isAadhaarProof(form.idProofType) &&
    normalizeAadhaar(form.idProofNumber).length !== 12
  ) {
    errors.idProofNumber = "Aadhaar must be exactly 12 digits.";
  }

  const panNumber = String(form.panNumber || "")
    .trim()
    .toUpperCase();
  if (["buyer", "grower"].includes(form.roleType) && !panNumber) {
    errors.panNumber = "PAN Number is required.";
  } else if (panNumber && !PAN_PATTERN.test(panNumber)) {
    errors.panNumber = "Enter a valid PAN, for example ABCDE1234F.";
  }
  if (["buyer", "grower"].includes(form.roleType) && !panDocumentAvailable) {
    errors.pan = "PAN Card document is required.";
  }

  if (form.roleType === "driver") {
    if (!String(form.vehicleNumber || "").trim())
      errors.vehicleNumber = "Vehicle number is required.";
    if (!String(form.drivingLicenseNumber || "").trim()) {
      errors.drivingLicenseNumber = "Driving license number is required.";
    }
  }

  if (!acceptedTerms)
    errors.acceptedTerms = "Accept the Terms of Use before submitting KYC.";
  if (!canSubmitWithUploads) errors.documents = uploadStateText;

  return errors;
};

const getFirstErrorMessage = (errors = {}) =>
  Object.values(errors).find(Boolean) || "";

const compressImageFile = (file) =>
  prepareUploadFile(file, {
    forceResize: true,
    maxDimension: 1600,
    quality: 0.78,
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
    const resourceType = file.type === "application/pdf" ? "raw" : "image";
    xhr.open(
      "POST",
      `https://api.cloudinary.com/v1_1/${signature.cloudName}/${resourceType}/upload`,
    );
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable)
        onProgress(Math.round((event.loaded / event.total) * 100));
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
  const isQuoteIntent = location.state?.intent === "quote";
  const intentMessage = location.state?.message || "";
  const routeRoleType = location.state?.roleType || "";
  const [form, setForm] = useState(initialForm);
  const [uploads, setUploads] = useState({});
  const [existingDocuments, setExistingDocuments] = useState({});
  const [currentUserId, setCurrentUserId] = useState("");
  const [kycStatus, setKycStatus] = useState("NOT_SUBMITTED");
  const [adminRemarks, setAdminRemarks] = useState("");
  const [verificationFeedback, setVerificationFeedback] = useState(null);
  const [sectionStates, setSectionStates] = useState({});
  const [panUpdateRequired, setPanUpdateRequired] = useState(false);
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);
  const [showSubmissionSuccess, setShowSubmissionSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [uploadingLabel, setUploadingLabel] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const isInitialSubmission = kycStatus === "NOT_SUBMITTED";
  const isSectionEditable = (section) => isInitialSubmission || Boolean(sectionStates[section]?.editable);
  const canEdit = isInitialSubmission || Object.values(sectionStates).some((state) => state?.editable);
  const requiredDocumentLabels =
    REQUIRED_DOCUMENT_LABELS_BY_ROLE[form.roleType] ||
    REQUIRED_DOCUMENT_LABELS_BY_ROLE.buyer;
  const requiredDocumentsUploaded = requiredDocumentLabels.every(
    (label) =>
      existingDocuments[label] || uploads[label]?.status === "uploaded",
  );
  const hasUploadingDocuments = Object.values(uploads).some((upload) =>
    ["uploading", "optimizing"].includes(upload?.status),
  );
  const hasRequiredUploadingDocuments = requiredDocumentLabels.some((label) =>
    ["uploading", "optimizing"].includes(uploads[label]?.status),
  );
  const hasRequiredUploadFailure = requiredDocumentLabels.some(
    (label) => uploads[label]?.status === "failed" && !existingDocuments[label],
  );
  const canSubmitWithUploads =
    requiredDocumentsUploaded &&
    !hasRequiredUploadingDocuments &&
    !hasRequiredUploadFailure;
  const visibleProgressItems = DOCUMENT_PROGRESS_ITEMS.filter((item) =>
    item.requiredFor ? item.requiredFor.includes(form.roleType) : true,
  );
  const completedDocumentCount = visibleProgressItems.filter(
    (item) =>
      existingDocuments[item.key] || uploads[item.key]?.status === "uploaded",
  ).length;
  const completionPercent = Math.round(
    (completedDocumentCount / Math.max(1, visibleProgressItems.length)) * 100,
  );
  const premisesAddressLabel =
    form.roleType === "buyer"
      ? "Buyer Premises Address"
      : form.roleType === "grower"
        ? "Grower Premises Address"
        : "Premises Address";

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return undefined;

    const initialHeight = viewport.height;
    const updateKeyboardState = () => {
      setIsKeyboardOpen(initialHeight - viewport.height > 120);
    };

    viewport.addEventListener("resize", updateKeyboardState);
    return () => viewport.removeEventListener("resize", updateKeyboardState);
  }, []);

  useEffect(() => {
    if (!showSubmissionSuccess) return undefined;
    const redirectTimer = window.setTimeout(() => {
      navigate("/", { replace: true });
    }, 5000);
    return () => window.clearTimeout(redirectTimer);
  }, [navigate, showSubmissionSuccess]);

  useEffect(() => {
    const loadKyc = async () => {
      try {
        const requestedRoleType =
          routeRoleType || localStorage.getItem("efruitmandiProfileMode") || "";
        const res = await API.get("/kyc/me", {
          params: requestedRoleType ? { roleType: requestedRoleType } : {},
        });
        const user = res.data?.user || {};
        const kyc = res.data?.kyc || {};
        const roleType =
          routeRoleType === "buyer"
            ? "buyer"
            : resolveLockedRoleType(user, kyc, routeRoleType);
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
          orchardLocation:
            kyc.orchardLocation || getGrowerPremisesAddress(user),
          vehicleNumber: kyc.vehicleNumber || "",
          drivingLicenseNumber: kyc.drivingLicenseNumber || "",
        };
        const draftKey = `efruitmandiKycDraft:${user._id || user.id || "guest"}:${roleType}`;
        try {
          const draft = JSON.parse(localStorage.getItem(draftKey) || "{}");
          if (
            draft?.form &&
            (editableStatuses.has(kyc.status || "NOT_SUBMITTED") || res.data?.panUpdateRequired)
          ) {
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
        setVerificationFeedback(res.data?.verificationFeedback || null);
        setSectionStates(res.data?.sectionStates || {});
        setPanUpdateRequired(Boolean(res.data?.panUpdateRequired));
        setDraftReady(true);
      } catch {
        setMessage("Please login to update KYC.");
        setMessageIsError(true);
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
          .filter(
            ([, upload]) => upload?.status === "uploaded" && upload.document,
          )
          .map(([key, upload]) => [
            key,
            {
              fileName: upload.fileName,
              status: "uploaded",
              progress: 100,
              document: upload.document,
            },
          ]),
      );
      localStorage.setItem(
        draftKey,
        JSON.stringify({
          form,
          acceptedTerms,
          existingDocuments,
          uploads: savedUploads,
          savedAt: new Date().toISOString(),
        }),
      );
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [
    acceptedTerms,
    canEdit,
    currentUserId,
    draftReady,
    existingDocuments,
    form,
    uploads,
  ]);

  const title = useMemo(() => {
    if (kycStatus === "APPROVED") return "KYC Approved";
    if (kycStatus === "UNDER_REVIEW") return "KYC Under Review";
    if (kycStatus === "PENDING" || kycStatus === "COMPLETED")
      return "KYC Submitted";
    if (kycStatus === "REJECTED") return "KYC Rejected";
    if (kycStatus === "CORRECTION_REQUIRED") return "Correction Required";
    return "Submit KYC";
  }, [kycStatus]);

  const updateForm = (field, value) => {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    setForm((current) => {
      let nextValue = value;
      if (field === "roleType") nextValue = current.roleType;
      if (field === "idProofNumber" && isAadhaarProof(current.idProofType))
        nextValue = normalizeAadhaar(value);
      if (field === "panNumber")
        nextValue = String(value || "")
          .toUpperCase()
          .slice(0, 10);
      return { ...current, [field]: nextValue };
    });
  };

  const uploadKycFile = async (field, file) => {
    const label = KYC_DIRECT_UPLOAD_LABELS[field] || field;
    if (!file) return;
    setFieldErrors((current) => {
      const next = { ...current };
      delete next.documents;
      delete next[label];
      return next;
    });

    const validationMessage = validateDocumentFile(file);
    if (validationMessage) {
      setUploads((current) => ({
        ...current,
        [label]: {
          file,
          fileName: file.name,
          status: "failed",
          progress: 0,
          error: validationMessage,
        },
      }));
      return;
    }

    const userId = currentUserId || getCurrentStoredUserId();
    if (!userId) {
      setUploads((current) => ({
        ...current,
        [label]: {
          file,
          fileName: file.name,
          status: "failed",
          progress: 0,
          error: "Login required before upload.",
        },
      }));
      return;
    }

    setUploads((current) => ({
      ...current,
      [label]: {
        file,
        fileName: file.name,
        status:
          file.type?.startsWith("image/") && file.size > 2 * 1024 * 1024
            ? "optimizing"
            : "uploading",
        progress: 1,
        error: "",
      },
    }));
    setUploadingLabel(label);

    try {
      const uploadFile = await compressImageFile(file);
      if (uploadFile.size > MAX_DOCUMENT_SIZE_BYTES) {
        throw new Error(
          `Image must be under ${MAX_DOCUMENT_SIZE_MB} MB after compression.`,
        );
      }
      setUploads((current) => ({
        ...current,
        [label]: {
          ...(current[label] || {}),
          status: "uploading",
          progress: 1,
        },
      }));
      const folder = `efruitmandi/kyc/${getUploadFolderRole(form.roleType)}/${userId}`;
      const signatureRes = await API.get("/cloudinary/signature", {
        params: { folder },
      });
      const uploaded = await uploadToCloudinary({
        file: uploadFile,
        signature: signatureRes.data,
        onProgress: (progress) =>
          setUploads((current) => ({
            ...current,
            [label]: {
              ...(current[label] || {}),
              status: "uploading",
              progress,
            },
          })),
      });

      const document = {
        label,
        url: uploaded.secure_url,
        storageProvider: "cloudinary",
        storageKey: uploaded.public_id,
        publicId: uploaded.public_id,
        resourceType: uploaded.resource_type,
        originalFilename: uploaded.original_filename || file.name,
        sizeBytes: uploaded.bytes || uploadFile.size || file.size,
        mimeType: uploadFile.type || file.type,
      };
      setUploads((current) => ({
        ...current,
        [label]: {
          file,
          fileName: file.name,
          status: "uploaded",
          progress: 100,
          document,
        },
      }));
      setExistingDocuments((current) => ({
        ...current,
        [label]: uploaded.secure_url,
      }));
      setMessage("");
    } catch (err) {
      const errorMessage = getMobileUploadErrorMessage(
        getApiErrorMessage(err, "Upload failed. Try again."),
      );
      setUploads((current) => ({
        ...current,
        [label]: {
          file,
          fileName: file.name,
          status: "failed",
          progress: 0,
          error: errorMessage,
        },
      }));
      setMessage(errorMessage);
      setMessageIsError(true);
    } finally {
      setUploadingLabel("");
    }
  };

  const submitKyc = async (event, resubmitSection = "") => {
    event.preventDefault();
    setMessage("");
    setMessageIsError(false);
    setFieldErrors({});

    if (!canEdit) {
      setMessage(
        kycStatus === "APPROVED"
          ? "KYC already approved."
          : "KYC has already been submitted and is pending review. Please allow up to 24 hours for verification.",
      );
      setMessageIsError(true);
      return;
    }

    const uploadStateText = hasRequiredUploadingDocuments
      ? "Uploading document... Please wait before submitting."
      : "Upload required KYC documents before submitting.";
    let validationErrors = buildKycValidation(
        form,
        acceptedTerms,
        canSubmitWithUploads,
        uploadStateText,
      Boolean(existingDocuments.pan || uploads.pan?.status === "uploaded"),
    );
    if (resubmitSection) {
      const allowedFields = new Set([
        ...(KYC_SECTION_FIELDS[resubmitSection] || []),
        ...(resubmitSection === "identity" ? ["idProof"] : []),
        ...(resubmitSection === "pan" ? ["pan", "panImage"] : []),
        ...(resubmitSection === "bank" ? ["passbookFile"] : []),
        ...(resubmitSection === "driver" ? ["drivingLicense"] : []),
      ]);
      validationErrors = Object.fromEntries(
        Object.entries(validationErrors).filter(([field]) => allowedFields.has(field)),
      );
      const sectionUploadLabels = KYC_SECTION_UPLOAD_LABELS[resubmitSection] || [];
      if (sectionUploadLabels.some((label) => ["uploading", "optimizing"].includes(uploads[label]?.status))) {
        validationErrors.documents = "Uploading document... Please wait before resubmitting.";
      }
      const requiredSectionDocument = {
        identity: ["idProof", "ID proof image is required."],
        pan: ["pan", "PAN Card document is required."],
        bank: ["passbookFile", "Bank proof/passbook file is required."],
        driver: ["drivingLicense", "Driving license image is required."],
      }[resubmitSection];
      if (requiredSectionDocument) {
        const [label, requiredMessage] = requiredSectionDocument;
        if (!existingDocuments[label] && uploads[label]?.status !== "uploaded") {
          validationErrors[label === "pan" ? "pan" : label] = requiredMessage;
        }
      }
    }
    if (Object.keys(validationErrors).length) {
      setFieldErrors(validationErrors);
      setMessage(getFirstErrorMessage(validationErrors));
      setMessageIsError(true);
      return;
    }

    try {
      setLoading(true);
      setMessage("Submitting KYC...");
      const data = {};
      const growerOnlyFields = new Set(["orchardName", "orchardLocation"]);
      const driverOnlyFields = new Set([
        "vehicleNumber",
        "drivingLicenseNumber",
      ]);
      Object.entries(form).forEach(([key, value]) => {
        if (growerOnlyFields.has(key) && form.roleType !== "grower") return;
        if (driverOnlyFields.has(key) && form.roleType !== "driver") return;
        data[key] = String(value || "").trim();
      });
      data.roleType = form.roleType;
      if (isAadhaarProof(data.idProofType)) {
        data.idProofNumber = normalizeAadhaar(data.idProofNumber);
        data.aadhaarCardNo = data.idProofNumber;
      }
      data.acceptedTerms = true;
      data.documents = Object.entries(uploads)
        .filter(([label]) => !resubmitSection || KYC_SECTION_UPLOAD_LABELS[resubmitSection]?.includes(label))
        .map(([, upload]) => upload)
        .filter((upload) => upload?.status === "uploaded" && upload.document)
        .map((upload) => upload.document);

      if (resubmitSection) {
        const allowedFields = new Set(KYC_SECTION_FIELDS[resubmitSection] || []);
        Object.keys(data).forEach((field) => {
          if (!["roleType", "acceptedTerms", "documents"].includes(field) && !allowedFields.has(field)) delete data[field];
        });
        data.section = resubmitSection;
      }

      const endpoint =
        kycStatus === "NOT_SUBMITTED" ? "/kyc/submit" : "/kyc/update";
      const res = endpoint.endsWith("submit")
        ? await API.post(endpoint, data)
        : await API.put(endpoint, data);
      saveUserToStorage(res.data);
      setKycStatus(res.data?.kyc?.status || "PENDING");
      setVerificationFeedback(null);
      if (resubmitSection) {
        setSectionStates((current) => ({
          ...current,
          [resubmitSection]: {
            ...(current[resubmitSection] || {}),
            status: "PENDING",
            editable: false,
            latestRemark: null,
          },
        }));
      }
      setAdminRemarks("");
      setPanUpdateRequired(false);
      trackKycSubmitted(form.roleType || "buyer");
      setMessage("");
      setMessageIsError(false);
      if (resubmitSection) {
        setMessage("Correction submitted. Waiting for verification.");
      } else {
        setShowSubmissionSuccess(true);
      }
      localStorage.removeItem(
        `efruitmandiKycDraft:${currentUserId || getCurrentStoredUserId() || "guest"}:${form.roleType}`,
      );
    } catch (err) {
      const apiFieldErrors = getApiFieldErrors(err);
      setFieldErrors(apiFieldErrors);
      setMessage(
        getFirstErrorMessage(apiFieldErrors) ||
          getApiErrorMessage(err, "KYC submission failed. Please try again."),
      );
      setMessageIsError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="kyc-page mx-auto min-h-[calc(100vh-132px)] w-full max-w-4xl overflow-x-hidden px-3 md:min-h-[calc(100vh-94px)] md:px-4 md:pb-20"
      style={{ paddingBottom: "calc(90px + env(safe-area-inset-bottom))" }}
    >
      <section className="w-full max-w-full overflow-hidden rounded-lg border border-gray-200 bg-white p-3 shadow-sm md:p-5">
        <div className="mb-5">
          <h1 className="text-2xl font-extrabold text-gray-950">
            eFruitMandi KYC {roleTitleLabels[form.roleType] || "Account"}
          </h1>
          {isQuoteIntent && (
            <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm font-extrabold text-amber-900">
              Current KYC status:{" "}
              {getKycStatusLabel({ kyc: { status: kycStatus } })}
            </p>
          )}
          {intentMessage && !isQuoteIntent && (
            <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm font-extrabold text-amber-900">
              {intentMessage}
            </p>
          )}
          <VerificationFeedback feedback={verificationFeedback} />
          {panUpdateRequired && (
            <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm font-extrabold text-amber-900">
              KYC update required – Please add your PAN Number and PAN Card.
            </p>
          )}
          {!verificationFeedback && adminRemarks && (
            <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800">
              Admin remarks: {adminRemarks}
            </p>
          )}
        </div>

        {message && (
          <div
            className={`mb-4 w-full max-w-full rounded-md px-3 py-2 text-sm font-bold ${messageIsError || Object.keys(fieldErrors).length ? "bg-red-50 text-red-800" : "bg-green-50 text-green-800"}`}
          >
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

        {uploadingLabel && (
          <div className="mb-4 w-full max-w-full rounded-md bg-green-50 px-3 py-2 text-sm font-extrabold text-green-800">
            Uploading document...
          </div>
        )}

        <form onSubmit={submitKyc} className="w-full max-w-full space-y-4">
          <section id="personal" className="w-full min-w-0 max-w-full scroll-mt-24 rounded-lg border border-green-100 bg-green-50 p-3 md:p-4">
            <h2 className="mb-3 text-base font-extrabold text-gray-950">
              User Details
            </h2>
            <KycSectionStatus state={sectionStates.personal} />
            <div className="grid min-w-0 gap-3 md:grid-cols-2">
              <SelectField
                label="Role Type"
                required
                value={form.roleType}
                disabled
                error={fieldErrors.roleType}
                onChange={(value) => updateForm("roleType", value)}
                options={[
                  ["buyer", "Buyer"],
                  ["grower", "Grower / Seller"],
                  ["driver", "Driver"],
                ]}
              />
              <KycInput
                label="Full Name"
                required
                value={form.fullName}
                error={fieldErrors.fullName}
                disabled={!isSectionEditable("personal")}
                onChange={(value) => updateForm("fullName", value)}
              />
              <KycInput
                label="Phone"
                required
                value={form.phone}
                error={fieldErrors.phone}
                inputMode="tel"
                disabled={!isSectionEditable("personal")}
                onChange={(value) => updateForm("phone", value)}
              />
              <KycInput
                label="Email"
                value={form.email}
                error={fieldErrors.email}
                inputMode="email"
                disabled={!isSectionEditable("personal")}
                onChange={(value) => updateForm("email", value)}
              />
              <KycInput
                label={premisesAddressLabel}
                required
                value={form.address}
                error={fieldErrors.address}
                disabled={!isSectionEditable("personal")}
                onChange={(value) => updateForm("address", value)}
              />
              <KycInput
                label="District"
                value={form.district}
                error={fieldErrors.district}
                disabled={!isSectionEditable("personal")}
                onChange={(value) => updateForm("district", value)}
              />
              <KycInput
                label="State"
                value={form.state}
                error={fieldErrors.state}
                disabled={!isSectionEditable("personal")}
                onChange={(value) => updateForm("state", value)}
              />
              <KycInput
                label="PIN Code"
                required
                value={form.pinCode}
                error={fieldErrors.pinCode}
                inputMode="numeric"
                disabled={!isSectionEditable("personal")}
                onChange={(value) => updateForm("pinCode", value)}
              />
            </div>
            <KycSectionResubmit section="personal" state={sectionStates.personal} loading={loading} onResubmit={submitKyc} />
          </section>

          <section id="identity" className="w-full min-w-0 max-w-full scroll-mt-24 rounded-lg border border-green-100 bg-green-50 p-3 md:p-4">
            <div className="mb-3 flex items-center gap-2 text-green-800">
              <FaIdCard />
              <h2 className="text-base font-extrabold text-gray-950">
                Identity Documents
              </h2>
            </div>
            <KycSectionStatus state={sectionStates.identity} />
            <div className="grid min-w-0 gap-3 md:grid-cols-2">
              <KycInput
                label="ID Proof Type"
                required
                value={form.idProofType}
                error={fieldErrors.idProofType}
                disabled={!isSectionEditable("identity")}
                onChange={(value) => updateForm("idProofType", value)}
              />
              <KycInput
                label="ID Proof Number"
                required
                value={form.idProofNumber}
                displayValue={
                  isAadhaarProof(form.idProofType)
                    ? maskAadhaar(form.idProofNumber)
                    : undefined
                }
                error={fieldErrors.idProofNumber}
                inputMode={
                  isAadhaarProof(form.idProofType) ? "numeric" : "text"
                }
                disabled={!isSectionEditable("identity")}
                onChange={(value) => updateForm("idProofNumber", value)}
              />
              <FileField
                required
                label="Upload ID Proof"
                disabled={!isSectionEditable("identity")}
                error={fieldErrors.idProof || fieldErrors.documents}
                upload={uploads.idProof}
                existingUrl={existingDocuments.idProof}
                onFileChange={(file) => uploadKycFile("idProofImage", file)}
                onRetry={() =>
                  uploads.idProof?.file &&
                  uploadKycFile("idProofImage", uploads.idProof.file)
                }
              />
            </div>
            <KycSectionResubmit section="identity" state={sectionStates.identity} loading={loading} onResubmit={submitKyc} />
            <div id="pan" className="scroll-mt-24">
            <OptionalKycSection title={["buyer", "grower"].includes(form.roleType) ? "PAN Details" : "PAN Details Optional"}>
              <KycSectionStatus state={sectionStates.pan} />
              <div className="grid min-w-0 gap-3 md:grid-cols-2">
                <KycInput
                  label={["buyer", "grower"].includes(form.roleType) ? "PAN Number" : "PAN Number optional"}
                  required={["buyer", "grower"].includes(form.roleType)}
                  value={form.panNumber}
                  error={fieldErrors.panNumber}
                  disabled={!isSectionEditable("pan")}
                  onChange={(value) => updateForm("panNumber", value)}
                />
                <FileField
                  required={["buyer", "grower"].includes(form.roleType)}
                  label={["buyer", "grower"].includes(form.roleType) ? "Upload PAN Card" : "Upload PAN optional"}
                  disabled={!isSectionEditable("pan")}
                  error={fieldErrors.pan}
                  upload={uploads.pan}
                  existingUrl={existingDocuments.pan}
                  onFileChange={(file) => uploadKycFile("panImage", file)}
                  onRetry={() =>
                    uploads.pan?.file &&
                    uploadKycFile("panImage", uploads.pan.file)
                  }
                />
              </div>
              <KycSectionResubmit section="pan" state={sectionStates.pan} loading={loading} onResubmit={submitKyc} />
            </OptionalKycSection>
            </div>
            <OptionalKycSection title="GST Details Optional">
              <div className="grid min-w-0 gap-3 md:grid-cols-2">
                <KycInput
                  label="GST Number optional"
                  value={form.gstNumber}
                  error={fieldErrors.gstNumber}
                  disabled={!isSectionEditable("identity")}
                  onChange={(value) => updateForm("gstNumber", value)}
                />
                <FileField
                  label="Upload GST Certificate optional"
                  disabled={!isSectionEditable("identity")}
                  error={fieldErrors.gstCertificate}
                  upload={uploads.gstCertificate}
                  existingUrl={existingDocuments.gstCertificate}
                  onFileChange={(file) => uploadKycFile("gstCertificate", file)}
                  onRetry={() =>
                    uploads.gstCertificate?.file &&
                    uploadKycFile("gstCertificate", uploads.gstCertificate.file)
                  }
                />
              </div>
            </OptionalKycSection>
          </section>

          <section id="bank" className="w-full min-w-0 max-w-full scroll-mt-24 rounded-lg border border-green-100 bg-green-50 p-3 md:p-4">
            <div className="mb-3 flex items-center gap-2 text-green-800">
              <FaUniversity />
              <h2 className="text-base font-extrabold text-gray-950">
                Bank Details
              </h2>
            </div>
            <KycSectionStatus state={sectionStates.bank} />
            <div className="grid min-w-0 gap-3 md:grid-cols-2">
              <KycInput
                label="Account Holder Name"
                required
                value={form.bankAccountHolderName}
                error={fieldErrors.bankAccountHolderName}
                disabled={!isSectionEditable("bank")}
                onChange={(value) => updateForm("bankAccountHolderName", value)}
              />
              <KycInput
                label="Bank Name"
                required
                value={form.bankName}
                error={fieldErrors.bankName}
                disabled={!isSectionEditable("bank")}
                onChange={(value) => updateForm("bankName", value)}
              />
              <KycInput
                label="Account Number"
                required
                value={form.accountNumber}
                error={fieldErrors.accountNumber}
                inputMode="numeric"
                disabled={!isSectionEditable("bank")}
                onChange={(value) => updateForm("accountNumber", value)}
              />
              <KycInput
                label="IFSC Code"
                required
                value={form.ifscCode}
                error={fieldErrors.ifscCode}
                disabled={!isSectionEditable("bank")}
                onChange={(value) =>
                  updateForm("ifscCode", value.toUpperCase())
                }
              />
              <KycInput
                label="UPI ID optional"
                value={form.upiId}
                error={fieldErrors.upiId}
                disabled={!isSectionEditable("bank")}
                onChange={(value) => updateForm("upiId", value)}
              />
              <FileField
                required
                label="Upload Bank Proof / Passbook"
                disabled={!isSectionEditable("bank")}
                error={fieldErrors.passbookFile || fieldErrors.documents}
                upload={uploads.passbookFile}
                existingUrl={existingDocuments.passbookFile}
                onFileChange={(file) => uploadKycFile("passbookFile", file)}
                onRetry={() =>
                  uploads.passbookFile?.file &&
                  uploadKycFile("passbookFile", uploads.passbookFile.file)
                }
              />
            </div>
            <KycSectionResubmit section="bank" state={sectionStates.bank} loading={loading} onResubmit={submitKyc} />
          </section>

          {form.roleType === "grower" && (
            <section id="business" className="w-full min-w-0 max-w-full scroll-mt-24 rounded-lg border border-green-100 bg-green-50 p-3 md:p-4">
              <h2 className="mb-3 text-base font-extrabold text-gray-950">
                Grower Details
              </h2>
              <KycSectionStatus state={sectionStates.business} />
              <div className="grid min-w-0 gap-3 md:grid-cols-2">
                <KycInput
                  label="Orchard Name optional"
                  value={form.orchardName}
                  error={fieldErrors.orchardName}
                  disabled={!isSectionEditable("business")}
                  onChange={(value) => updateForm("orchardName", value)}
                />
                <KycInput
                  label="Orchard Location optional"
                  value={form.orchardLocation}
                  error={fieldErrors.orchardLocation}
                  disabled={!isSectionEditable("business")}
                  onChange={(value) => updateForm("orchardLocation", value)}
                />
              </div>
              <KycSectionResubmit section="business" state={sectionStates.business} loading={loading} onResubmit={submitKyc} />
            </section>
          )}

          {form.roleType === "driver" && (
            <section id="driver" className="w-full min-w-0 max-w-full scroll-mt-24 rounded-lg border border-green-100 bg-green-50 p-3 md:p-4">
              <h2 className="mb-3 text-base font-extrabold text-gray-950">
                Driver Details
              </h2>
              <KycSectionStatus state={sectionStates.driver} />
              <div className="grid min-w-0 gap-3 md:grid-cols-2">
                <KycInput
                  label="Vehicle Number"
                  required
                  value={form.vehicleNumber}
                  error={fieldErrors.vehicleNumber}
                  disabled={!isSectionEditable("driver")}
                  onChange={(value) =>
                    updateForm("vehicleNumber", value.toUpperCase())
                  }
                />
                <KycInput
                  label="Driving License Number"
                  required
                  value={form.drivingLicenseNumber}
                  error={fieldErrors.drivingLicenseNumber}
                  disabled={!isSectionEditable("driver")}
                  onChange={(value) =>
                    updateForm("drivingLicenseNumber", value.toUpperCase())
                  }
                />
                <FileField
                  required
                  label="Upload Driving License"
                  disabled={!isSectionEditable("driver")}
                  error={fieldErrors.drivingLicense || fieldErrors.documents}
                  upload={uploads.drivingLicense}
                  existingUrl={existingDocuments.drivingLicense}
                  onFileChange={(file) =>
                    uploadKycFile("drivingLicenseImage", file)
                  }
                  onRetry={() =>
                    uploads.drivingLicense?.file &&
                    uploadKycFile(
                      "drivingLicenseImage",
                      uploads.drivingLicense.file,
                    )
                  }
                />
              </div>
              <KycSectionResubmit section="driver" state={sectionStates.driver} loading={loading} onResubmit={submitKyc} />
            </section>
          )}

          {isInitialSubmission && <label className="flex w-full max-w-full items-start gap-3 rounded-lg border border-green-100 bg-white p-3 text-sm font-bold text-gray-800">
            <input
              type="checkbox"
              checked={acceptedTerms}
              disabled={!isInitialSubmission}
              onChange={(event) => setAcceptedTerms(event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-green-300 text-green-700 focus:ring-green-600 disabled:opacity-60"
            />
            <span>
              I agree to eFruitMandi{" "}
              <Link
                to="/terms-of-service"
                target="_blank"
                rel="noreferrer"
                className="font-extrabold text-green-700 underline"
              >
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link
                to="/privacy-policy"
                target="_blank"
                rel="noreferrer"
                className="font-extrabold text-green-700 underline"
              >
                Privacy Policy
              </Link>{" "}
              for KYC verification and marketplace activity.
              <span className="ml-1 text-red-600" aria-label="required">*</span>
            </span>
          </label>}
          {isInitialSubmission && fieldErrors.acceptedTerms && (
            <p className="-mt-2 text-xs font-bold text-red-700">
              {fieldErrors.acceptedTerms}
            </p>
          )}

          {isInitialSubmission && <button
            type="submit"
            disabled={loading || !canEdit || !canSubmitWithUploads}
            className="hidden w-full rounded-md bg-green-700 py-3 text-sm font-extrabold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-gray-300 md:block"
          >
            {loading
              ? "Submitting..."
              : !canEdit
                ? kycStatus === "APPROVED"
                  ? "KYC Approved"
                  : "KYC Submitted — Under Review"
                : hasUploadingDocuments
                  ? "Uploading Documents..."
                  : !requiredDocumentsUploaded
                    ? "Upload Required Documents"
                    : "Submit KYC"}
          </button>}
          <div className="flex justify-center">
            <BackHomeButton />
          </div>
        </form>
      </section>
      {isInitialSubmission && <MobileSubmitBar
        loading={loading}
        canEdit={canEdit}
        kycStatus={kycStatus}
        canSubmit={canSubmitWithUploads}
        hasUploading={hasUploadingDocuments}
        requiredUploaded={requiredDocumentsUploaded}
        percent={completionPercent}
        isKeyboardOpen={isKeyboardOpen}
        onSubmit={(event) => submitKyc(event)}
      />}
      {showSubmissionSuccess && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4">
          <div
            role="status"
            aria-live="polite"
            className="w-full max-w-sm rounded-xl bg-white p-5 text-center shadow-2xl"
          >
            <FaCheckCircle className="mx-auto text-5xl text-green-700" />
            <h2 className="mt-3 text-xl font-extrabold text-gray-950">
              KYC Submitted Successfully
            </h2>
            <p className="mt-2 text-sm font-bold leading-relaxed text-gray-700">
              Your KYC is under review. Please allow up to 24 hours for verification.
            </p>
            <p className="mt-3 text-xs font-extrabold text-green-800">
              Redirecting to Home in 5 seconds...
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function KycSectionStatus({ state }) {
  if (!state || state.status === "NOT_SUBMITTED") return null;
  const copy = {
    VERIFIED: "Verified — this information is locked.",
    PENDING: "Submitted for verification.",
    UNDER_REVIEW: "Under review.",
    CHANGES_REQUIRED: "Changes required.",
    REJECTED: "Rejected — update this section and resubmit.",
  }[state.status] || state.status;
  const warning = ["CHANGES_REQUIRED", "REJECTED"].includes(state.status);
  return (
    <div className={`mb-3 rounded-md border px-3 py-2 text-sm font-bold ${warning ? "border-amber-300 bg-amber-50 text-amber-900" : "border-green-200 bg-white text-green-800"}`}>
      <p>{copy}</p>
      {state.latestRemark?.remark && (
        <p className="mt-1 text-gray-800">Admin remark: {state.latestRemark.remark}</p>
      )}
    </div>
  );
}

function KycSectionResubmit({ section, state, loading, onResubmit }) {
  if (!state || !SECTION_EDITABLE_STATUSES.has(state.status) || state.status === "NOT_SUBMITTED") return null;
  return (
    <button
      type="button"
      disabled={loading}
      onClick={(event) => onResubmit(event, section)}
      className="mt-3 w-full rounded-md bg-green-700 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-green-800 disabled:opacity-60"
    >
      {loading ? "Submitting..." : "Resubmit for Verification"}
    </button>
  );
}

function RequiredFieldLabel({ label, required = false, missing = false }) {
  return (
    <span className={`text-sm font-bold ${missing ? "text-red-700" : "text-gray-800"}`}>
      {label}
      {required && <span className="ml-1 text-red-600" aria-label="required">*</span>}
    </span>
  );
}

function SelectField({ label, required = false, value, options, disabled, error, onChange }) {
  const missing = required && !String(value || "").trim();
  return (
    <label className="block w-full min-w-0 max-w-full">
      <RequiredFieldLabel label={label} required={required} missing={missing} />
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={`mt-1 w-full min-w-0 max-w-full rounded-md border bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-green-700 disabled:bg-gray-100 ${error || missing ? "border-red-400" : "border-green-100"}`}
      >
        {options.map(([optionValue, labelText]) => (
          <option key={optionValue} value={optionValue}>
            {labelText}
          </option>
        ))}
      </select>
      {error && (
        <span className="mt-1 block text-xs font-bold text-red-700">
          {error}
        </span>
      )}
    </label>
  );
}

function OptionalKycSection({ title, children }) {
  return (
    <details className="mt-3 w-full max-w-full rounded-md border border-green-100 bg-white/70 p-3 md:open">
      <summary className="cursor-pointer text-sm font-extrabold text-green-800">
        {title}
      </summary>
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

function KycMobileProgressSummary({
  items,
  uploads,
  existingDocuments,
  completed,
  total,
}) {
  return (
    <div className="sticky top-[56px] z-20 mb-3 rounded-lg border border-green-100 bg-white/95 p-2 shadow-sm backdrop-blur md:hidden">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-extrabold text-green-900">KYC Progress</p>
        <p className="text-xs font-extrabold text-green-700">
          {completed}/{total} completed
        </p>
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
            <div
              key={item.key}
              className="min-w-0 rounded-md bg-green-50 px-2 py-1"
            >
              <p className="truncate text-[10px] font-bold text-gray-700">
                {item.label}
              </p>
              <p
                className={`text-[10px] font-extrabold ${state === "failed" ? "text-red-700" : state === "uploaded" ? "text-green-700" : "text-gray-500"}`}
              >
                {label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MobileSubmitBar({
  loading,
  canEdit,
  kycStatus,
  canSubmit,
  hasUploading,
  requiredUploaded,
  percent,
  isKeyboardOpen,
  onSubmit,
}) {
  const label = loading
    ? "Submitting..."
    : !canEdit
      ? kycStatus === "APPROVED"
        ? "KYC Approved"
        : "KYC Submitted — Under Review"
      : hasUploading
        ? "Uploading documents..."
        : !requiredUploaded
          ? "Upload required docs"
          : "Submit KYC";

  if (isKeyboardOpen) return null;

  return (
    <div
      className="fixed inset-x-0 z-40 border-t border-green-100 bg-white/95 px-3 py-2 shadow-[0_-8px_20px_rgba(0,0,0,0.08)] backdrop-blur md:hidden"
      style={{ bottom: "calc(64px + env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto max-w-md">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-xs font-extrabold text-gray-800">
            KYC Completion
          </span>
          <span className="text-xs font-extrabold text-green-700">
            {percent}%
          </span>
        </div>
        <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-green-100">
          <div
            className="h-full bg-green-700 transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
        <button
          type="button"
          onClick={onSubmit}
          disabled={loading || !canEdit || !canSubmit}
          className="min-h-12 w-full rounded-full bg-green-700 py-3 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {label}
        </button>
      </div>
    </div>
  );
}

function FileField({
  label,
  required = false,
  disabled,
  error,
  upload,
  existingUrl,
  onFileChange,
  onRetry,
}) {
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
  const missing = required && !existingUrl && upload?.status !== "uploaded";
  return (
    <label className="block w-full min-w-0 max-w-full">
      <RequiredFieldLabel label={label} required={required} missing={missing} />
      <span
        className={`mt-1 block min-h-11 w-full max-w-full rounded-md border border-dashed bg-white p-3 text-sm font-semibold text-gray-600 ${error || missing || upload?.status === "failed" ? "border-red-400" : "border-green-300"}`}
      >
        <span className="flex min-w-0 items-center gap-2">
          <FaFileUpload className="shrink-0 text-green-700" />
          <span className="min-w-0 flex-1 truncate">
            {fileName ||
              upload?.fileName ||
              (existingUrl ? "Already uploaded" : `+ ${label}`)}
          </span>
          {(upload?.status === "uploaded" || existingUrl) && (
            <FaCheckCircle className="shrink-0 text-green-700" />
          )}
        </span>
        {!upload?.status && !existingUrl && (
          <span className="mt-1 block truncate text-[11px] font-bold text-gray-400">
            JPG, JPEG, PNG, PDF | Max {MAX_DOCUMENT_SIZE_MB} MB
            {required ? " | Required" : " | Optional"}
          </span>
        )}
        <input
          type="file"
          disabled={disabled}
          accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            setFileName(file?.name || "");
            onFileChange(file);
          }}
        />
      </span>
      {error && (
        <span className="mt-1 block text-xs font-bold text-red-700">
          {error}
        </span>
      )}
      {upload?.error && (
        <span className="mt-1 block text-xs font-bold text-red-700">
          {upload.error}
        </span>
      )}
      {statusText && (
        <div
          className={`mt-1 flex min-w-0 items-center gap-2 text-xs font-extrabold ${upload?.status === "failed" ? "text-red-700" : "text-green-800"}`}
        >
          <span className="min-w-0 truncate">{statusText}</span>
          {upload?.status === "failed" && (
            <>
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onRetry?.();
                }}
                className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-full bg-red-50 px-2 py-1 text-[10px] font-extrabold text-red-700 ring-1 ring-red-100"
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
              className="inline-flex min-h-8 shrink-0 items-center rounded-full bg-green-50 px-2 py-1 text-[10px] font-extrabold text-green-700 ring-1 ring-green-100"
            >
              Preview
            </a>
          )}
        </div>
      )}
      {(upload?.status === "uploading" || upload?.status === "optimizing") && (
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-green-100">
          <div
            className="h-full bg-green-700 transition-all"
            style={{
              width: `${upload?.status === "optimizing" ? 12 : upload.progress || 0}%`,
            }}
          />
        </div>
      )}
    </label>
  );
}

function KycInput({
  label,
  required = false,
  value,
  displayValue,
  disabled,
  error,
  inputMode = "text",
  onChange,
}) {
  const [focused, setFocused] = useState(false);
  const missing = required && !String(value || "").trim();
  const renderedValue =
    focused || displayValue === undefined ? value : displayValue;

  return (
    <label className="block w-full min-w-0 max-w-full">
      <RequiredFieldLabel label={label} required={required} missing={missing} />
      <input
        value={renderedValue}
        disabled={disabled}
        inputMode={inputMode}
        autoComplete="off"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(event) => onChange(event.target.value)}
        className={`mt-1 min-h-11 w-full min-w-0 max-w-full rounded-md border bg-white px-3 py-3 text-sm font-semibold outline-none focus:border-green-700 disabled:bg-gray-100 ${error || missing ? "border-red-400" : "border-green-100"}`}
      />
      {error && (
        <span className="mt-1 block text-xs font-bold text-red-700">
          {error}
        </span>
      )}
    </label>
  );
}
