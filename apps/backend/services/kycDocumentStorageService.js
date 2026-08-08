export const KYC_STORAGE_PROVIDERS = Object.freeze(["cloudinary", "r2"]);

const normalizeProvider = (value = "") => {
  const provider = String(value || "").trim().toLowerCase();
  return KYC_STORAGE_PROVIDERS.includes(provider) ? provider : "cloudinary";
};

export const normalizeKycDocumentMetadata = (
  document = {},
  { userId = "", roleType = "", trustedProvider = false } = {}
) => {
  const url = String(document.url || document.secure_url || "").trim();
  if (!url) return null;
  const publicId = String(document.publicId || document.public_id || "").trim();
  if (!trustedProvider) {
    try {
      if (new URL(url).hostname !== "res.cloudinary.com") return null;
    } catch {
      return null;
    }
    const expectedPrefix = userId && roleType ? `efruitmandi/kyc/${roleType}/${userId}/` : "";
    if (publicId && expectedPrefix && !publicId.startsWith(expectedPrefix)) return null;
  }
  // R2 is deliberately not accepted from user-controlled payloads until the
  // provider is integrated and server-side object references can be verified.
  const requestedProvider = normalizeProvider(document.storageProvider);
  const storageProvider = trustedProvider ? requestedProvider : "cloudinary";
  const storageKey = String(
    trustedProvider ? document.storageKey || document.providerReference || publicId : publicId
  ).trim();

  return {
    label: String(document.label || document.field || "").trim(),
    url,
    storageProvider,
    storageKey,
    publicId,
    resourceType: String(document.resourceType || document.resource_type || "").trim(),
    originalFilename: String(
      document.originalFilename || document.original_filename || document.fileName || ""
    ).trim(),
    sizeBytes: Number(document.sizeBytes || document.bytes || 0) || 0,
    mimeType: String(document.mimeType || document.mimetype || "").trim(),
    roleType,
    uploadedBy: userId,
    uploadedAt: document.uploadedAt || new Date(),
  };
};

export const createCloudinaryKycDocumentMetadata = (
  uploadResult = {},
  { label = "", userId = "", roleType = "", mimeType = "" } = {}
) => normalizeKycDocumentMetadata({
  label,
  url: uploadResult.secure_url,
  publicId: uploadResult.public_id,
  resourceType: uploadResult.resource_type,
  originalFilename: uploadResult.original_filename,
  sizeBytes: uploadResult.bytes,
  mimeType,
  storageProvider: "cloudinary",
  storageKey: uploadResult.public_id,
}, { userId, roleType, trustedProvider: true });
