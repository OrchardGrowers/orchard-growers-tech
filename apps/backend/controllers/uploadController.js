import {
  getEfruitmandiFolder,
  getResourceType,
  uploadBuffersToCloudinary,
} from "../services/cloudinaryService.js";

const getUploadFiles = (req) => {
  if (Array.isArray(req.files)) return req.files;
  if (!req.files || typeof req.files !== "object") return [];
  return Object.values(req.files).flat();
};

const normalizeUploadResponse = (file) => ({
  url: file.secure_url,
  secure_url: file.secure_url,
  publicId: file.publicId,
  folder: file.folder,
  resourceType: file.resourceType,
});

export const uploadEfruitmandiFiles = async (req, res) => {
  const files = getUploadFiles(req);

  if (!files.length) {
    return res.status(400).json({ msg: "No file uploaded", message: "No file uploaded" });
  }

  const folder = getEfruitmandiFolder(req.body?.folder || req.query?.folder || req.body?.purpose || req.query?.purpose);
  const uploaded = await uploadBuffersToCloudinary(files, { folder });
  const responseFiles = uploaded.map(normalizeUploadResponse);

  if (responseFiles.length === 1) {
    return res.status(201).json({
      success: true,
      ...responseFiles[0],
    });
  }

  return res.status(201).json({
    success: true,
    files: responseFiles,
  });
};

export const uploadFileFilter = (req, file, cb) => {
  const allowedFields = new Set(["image", "images", "file", "files"]);
  const allowedMimeTypes = new Set([
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "application/pdf",
  ]);

  if (!allowedFields.has(file.fieldname)) {
    const error = new Error("Unexpected file field in upload request");
    error.statusCode = 400;
    cb(error);
    return;
  }

  if (!allowedMimeTypes.has(file.mimetype)) {
    const error = new Error("Invalid file type. Upload JPG, PNG, WebP, or PDF files only.");
    error.statusCode = 400;
    cb(error);
    return;
  }

  cb(null, true);
};

export const getUploadResourceType = getResourceType;
