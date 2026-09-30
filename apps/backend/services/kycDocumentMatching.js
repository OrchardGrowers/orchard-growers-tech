export const UNREADABLE = "Document text could not be read clearly. Please recapture in better lighting.";
export const MISMATCH = "Captured document does not match the selected document type. Please recapture the correct document.";

// Document-type evidence only, not identity or authenticity verification.
export function matchKycDocument(expected, { text = "", confidence = 0 } = {}) {
  if (!Number.isFinite(confidence) || confidence < 70) return "unreadable";
  const t = String(text).toUpperCase().replace(/[\u2010-\u2015]/g, "-").replace(/\s+/g, " ");
  const pan = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/.test(t);
  const gst = /\b[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b/.test(t);
  const ifsc = /\b[A-Z]{4}0[A-Z0-9]{6}\b/.test(t);
  const account = /\b(?:ACCOUNT|A\/C|ACCT)\b/.test(t) && /\b\d{6,18}\b/.test(t);
  const cheque = /\bCHEQUE\b|\bPAY\b.{0,100}\bBEARER\b/.test(t);
  const matches = [];
  if (/\b(?:AADHAAR|UIDAI|UNIQUE IDENTIFICATION AUTHORITY)\b/.test(t) && /\b[2-9]\d{3}[ -]?\d{4}[ -]?\d{4}\b/.test(t)) matches.push("Aadhaar");
  if (/\b(?:ELECTION COMMISSION|ELECTOR(?:S)? PHOTO IDENTITY|VOTER|EPIC)\b/.test(t) && /\b[A-Z]{3}[0-9]{7}\b/.test(t)) matches.push("Voter ID");
  if (/\b(?:DRIVING LICEN[CS]E|DRIVER'?S? LICEN[CS]E)\b/.test(t) && /\b[A-Z]{2}[ -]?\d{2}[ -]?(?:19|20)\d{2}[ -]?\d{7}\b/.test(t)) matches.push("Driving Licence");
  if (/\bPASSPORT\b/.test(t) && /\bREPUBLIC OF INDIA\b|P<IND/.test(t) && /\b[A-Z][0-9]{7}\b|P<IND[A-Z<]+/.test(t)) matches.push("Passport");
  if (/\b(?:INCOME TAX|PERMANENT ACCOUNT NUMBER|PAN)\b/.test(t) && pan) matches.push("PAN Card");
  if (/\b(?:GSTIN|GST|GOODS AND SERVICES TAX|REGISTRATION CERTIFICATE)\b/.test(t) && gst) matches.push("GST Certificate");
  if (!cheque && /\bBANK\b/.test(t) && account && (/\bPASS\s?BOOK\b/.test(t) || (/\b(?:ACCOUNT DETAILS|ACCOUNT HOLDER|CUSTOMER ID)\b/.test(t) && ifsc))) matches.push("Bank Passbook");
  if (cheque && /\bCANCELLED\b|\bCANCELED\b/.test(t) && ifsc && (account || /\bBANK\b/.test(t))) matches.push("Cancelled Cheque");
  if (matches.length !== 1) return "unreadable";
  return matches[0] === expected ? "match" : "mismatch";
}
