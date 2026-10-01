import { verifyKycDocumentContent } from "./kycDocumentOcr.js";
import { configureCloudinary } from "./cloudinaryService.js";
const TYPES = {
  liveFace: ["Live Face Capture"],
  idProof: ["Aadhaar", "Voter ID", "Driving Licence", "Passport"],
  tradeLicence: ["Trade Licence"],
  pan: ["PAN Card"], gstCertificate: ["GST Certificate"],
  passbookFile: ["Bank Passbook", "Cancelled Cheque"],
};
const reject = (message) => { const error = new Error(message); error.statusCode = 400; throw error; };
// Camera provenance and authenticity are not established by these checks.
// Verify stored image properties with the provider, not client MIME/size alone.
export async function validateNewKycCaptures({ roleType, body = {}, files = {}, existingKyc = {}, userId, reviewOnly = false }, lookup = async (id, resourceType) => configureCloudinary().api.resource(id, { resource_type: resourceType, type: "authenticated" }), verifyContent = verifyKycDocumentContent) {
  if (!["buyer", "grower"].includes(roleType)) return;
  if (body.idProofType && body.idProofType !== existingKyc.idProofType && !TYPES.idProof.includes(body.idProofType)) reject("Invalid ID proof type.");
  if (Object.values(files || {}).some((value) => value?.length)) reject("Use live camera capture for new KYC documents.");
  let documents = body.documents || [];
  if (typeof documents === "string") { try { documents = JSON.parse(documents); } catch { reject("Invalid KYC documents."); } }
  if (!Array.isArray(documents)) reject("Invalid KYC documents.");
  const seen = new Set();
  const results = [];
  for (const doc of documents) {
    if (!doc || typeof doc !== "object") reject("Invalid KYC document.");
    const previous = existingKyc.documents?.find((old) => old.label === doc.label && old.url === doc.url && old.publicId === doc.publicId);
    if (previous) continue;
    if (!Object.hasOwn(TYPES, doc.label) || seen.has(doc.label)) reject("Invalid KYC document category.");
    seen.add(doc.label);
    const manual = doc.captureMethod === "manual-upload" && ["gstCertificate", "tradeLicence"].includes(doc.label);
    const pdf = manual && doc.mimeType === "application/pdf";
    if ((!manual && doc.captureMethod !== "live-camera") || !TYPES[doc.label].includes(doc.documentType)) reject("Capture the required document using the camera.");
    if (doc.label === "idProof" && doc.documentType !== (body.idProofType || existingKyc.idProofType)) reject("ID document type does not match.");
    if (!reviewOnly && doc.label === "gstCertificate" && !String(body.gstNumber || existingKyc.gstNumber || "").trim()) reject("GST number is required for a GST certificate.");
    if (!(manual ? ["application/pdf", "image/jpeg", "image/jpg", "image/png"].includes(doc.mimeType) : doc.mimeType === "image/jpeg") || !(doc.sizeBytes > 0 && doc.sizeBytes <= 10 * 1024 * 1024)) reject("Invalid captured image size or type.");
    if (typeof doc.publicId !== "string" || !doc.publicId.startsWith(`efruitmandi/kyc/${roleType}/${userId}/`)) reject("Invalid KYC document owner.");
    let asset;
    try { asset = await lookup(doc.publicId, pdf ? "raw" : "image"); } catch { reject("Unable to verify captured document. Retry upload."); }
    if (asset.type !== "authenticated" || asset.resource_type !== (pdf ? "raw" : "image") || (!pdf && !(manual ? ["jpg", "jpeg", "png"] : ["jpg", "jpeg"]).includes(asset.format)) || !(asset.bytes > 0 && asset.bytes <= 10 * 1024 * 1024) || (!pdf && Math.min(asset.width || 0, asset.height || 0) < 720) || asset.secure_url !== doc.url) reject("Invalid captured document.");
    const fields = await verifyContent(asset, doc.documentType);
    results.push({ label: doc.label, documentType: doc.documentType, fields: fields || {} });
  }
  return results;
}
