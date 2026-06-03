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
