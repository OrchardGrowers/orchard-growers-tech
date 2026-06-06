import { createSignedUploadParams } from "../services/cloudinaryService.js";

const VALID_KYC_ROLES = new Set(["buyer", "grower", "driver", "logistic"]);

const normalizeKycRole = (value = "") => {
  const role = String(value || "").trim().toLowerCase();
  if (role === "driver") return "logistic";
  return role;
};

export const getCloudinaryUploadSignature = async (req, res) => {
  const requestedFolder = String(req.query.folder || "").trim().replace(/\\/g, "/").replace(/\/+$/, "");
  const userId = req.user?.id?.toString();

  if (!userId) return res.status(401).json({ msg: "Authentication required" });

  const match = requestedFolder.match(/^efruitmandi\/kyc\/([^/]+)\/([^/]+)$/);
  const role = normalizeKycRole(match?.[1] || "");
  const folderUserId = match?.[2] || "";

  if (!match || !VALID_KYC_ROLES.has(role) || folderUserId !== userId) {
    return res.status(400).json({ msg: "Invalid KYC upload folder" });
  }

  const folder = `efruitmandi/kyc/${role}/${userId}`;
  res.json(createSignedUploadParams({ folder }));
};
