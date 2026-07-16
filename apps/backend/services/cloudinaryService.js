import { v2 as cloudinary } from "cloudinary";

const EFRUITMANDI_FOLDERS = new Set([
  "efruitmandi/lots",
  "efruitmandi/products",
  "efruitmandi/growers",
  "efruitmandi/buyers",
  "efruitmandi/drivers",
  "efruitmandi/kyc",
]);

const DEFAULT_FOLDER_BY_PURPOSE = {
  lot: "efruitmandi/lots",
  lots: "efruitmandi/lots",
  product: "efruitmandi/products",
  products: "efruitmandi/products",
  grower: "efruitmandi/growers",
  growers: "efruitmandi/growers",
  buyer: "efruitmandi/buyers",
  buyers: "efruitmandi/buyers",
  driver: "efruitmandi/drivers",
  drivers: "efruitmandi/drivers",
  kyc: "efruitmandi/kyc",
};

export const isCloudinaryConfigured = () =>
  Boolean(
    process.env.CLOUDINARY_URL ||
      (process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET)
  );

export const configureCloudinary = () => {
  if (!isCloudinaryConfigured()) {
    const error = new Error("Cloudinary is not configured");
    error.statusCode = 500;
    throw error;
  }

  if (process.env.CLOUDINARY_URL) {
    cloudinary.config({ secure: true });
    return cloudinary;
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });

  return cloudinary;
};

export const getEfruitmandiFolder = (value = "", fallback = "efruitmandi/lots") => {
  const requested = String(value || "").trim();
  if (EFRUITMANDI_FOLDERS.has(requested)) return requested;

  const normalized = requested.toLowerCase();
  return DEFAULT_FOLDER_BY_PURPOSE[normalized] || fallback;
};

export const getAdminProductFolder = (platform = "orchardgrowers") => {
  const normalized = String(platform || "").trim().toLowerCase();
  if (normalized === "efruitmandi") return "efruitmandi/products";
  return process.env.CLOUDINARY_PRODUCT_FOLDER || "orchard-growers/products";
};

export const getResourceType = (file = {}, fallback = "image") => {
  if (file.mimetype === "application/pdf") return "raw";
  if (file.mimetype?.startsWith("video/")) return "video";
  if (file.mimetype?.startsWith("image/")) return "image";
  return fallback;
};

export const uploadBufferToCloudinary = (file, options = {}) =>
  new Promise((resolve, reject) => {
    if (!file?.buffer) return resolve(null);

    configureCloudinary();

    const stream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder,
        resource_type: options.resourceType || getResourceType(file),
      },
      (error, result) => {
        if (error) return reject(error);
        return resolve({
          url: result.secure_url,
          secure_url: result.secure_url,
          publicId: result.public_id,
          public_id: result.public_id,
          folder: result.folder || options.folder,
          resourceType: result.resource_type,
          resource_type: result.resource_type,
        });
      }
    );

    stream.end(file.buffer);
  });

export const uploadBuffersToCloudinary = async (files = [], options = {}) => {
  const uploaded = await Promise.all(
    files.map((file) =>
      uploadBufferToCloudinary(file, {
        ...options,
        resourceType: options.resourceType || getResourceType(file),
      })
    )
  );
  return uploaded.filter(Boolean);
};

const getCloudinaryAssetIdentity = (value = "") => {
  try {
    const url = new URL(String(value || ""));
    if (url.hostname !== "res.cloudinary.com") return null;
    const match = url.pathname.match(
      /^\/([^/]+)\/(image|video|raw)\/(upload|private|authenticated)\/(?:v\d+\/)?(.+)$/i
    );
    if (!match) return null;
    const cloudName = match[1];
    const resourceType = match[2].toLowerCase();
    const deliveryType = match[3].toLowerCase();
    let publicId = decodeURIComponent(match[4]);
    const formatMatch = publicId.match(/\.([a-z0-9]+)$/i);
    const format = formatMatch?.[1]?.toLowerCase() || "";
    if (resourceType !== "raw") publicId = publicId.replace(/\.[a-z0-9]+$/i, "");
    return publicId ? { cloudName, publicId, resourceType, deliveryType, format } : null;
  } catch {
    return null;
  }
};

export const getCloudinaryPrivateDownloadUrls = (value = "") => {
  const asset = getCloudinaryAssetIdentity(value);
  if (!asset || !isCloudinaryConfigured() || !asset.format) return [];

  const client = configureCloudinary();
  if (client.config().cloud_name !== asset.cloudName) return [];

  const options = {
    resource_type: asset.resourceType,
    type: asset.deliveryType,
    expires_at: Math.floor(Date.now() / 1000) + 5 * 60,
    attachment: false,
  };
  const publicIds = asset.resourceType === "raw"
    ? [asset.publicId.replace(new RegExp(`\\.${asset.format}$`, "i"), ""), asset.publicId]
    : [asset.publicId];

  return Array.from(new Set(publicIds)).map((publicId) =>
    client.utils.private_download_url(publicId, asset.format, options)
  );
};

export const deleteCloudinaryAssetsByUrls = async (values = []) => {
  const assets = new Map();
  values.forEach((value) => {
    const asset = getCloudinaryAssetIdentity(value);
    if (asset) assets.set(`${asset.resourceType}:${asset.publicId}`, asset);
  });
  if (!assets.size || !isCloudinaryConfigured()) return { deleted: 0, failed: 0 };

  const client = configureCloudinary();
  const results = await Promise.allSettled(
    Array.from(assets.values()).map(({ publicId, resourceType }) =>
      client.uploader.destroy(publicId, { resource_type: resourceType, invalidate: true })
    )
  );
  return {
    deleted: results.filter((result) => result.status === "fulfilled").length,
    failed: results.filter((result) => result.status === "rejected").length,
  };
};

export const createSignedUploadParams = ({ folder, publicIdPrefix = "" } = {}) => {
  const client = configureCloudinary();
  const timestamp = Math.round(Date.now() / 1000);
  const params = {
    folder,
    timestamp,
  };
  if (publicIdPrefix) params.public_id_prefix = publicIdPrefix;

  return {
    cloudName: client.config().cloud_name,
    apiKey: client.config().api_key,
    timestamp,
    folder,
    signature: client.utils.api_sign_request(params, client.config().api_secret),
  };
};
