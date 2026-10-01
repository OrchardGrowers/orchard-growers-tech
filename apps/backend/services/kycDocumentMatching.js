export const UNREADABLE = "Document text could not be read clearly. Please move closer and recapture.";
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
  const tradeTitle=/\bTRADE LICEN[CS]E\b/.test(t);
  const municipal=/\b(?:MUNICIPAL CORPORATION|MUNICIPAL COUNCIL|MUNICIPALITY|NAGAR PARISHAD|NAGAR PANCHAYAT)\b/.test(t);
  const licenceNumber=/\bLICEN[CS]E\s*(?:NUMBER|NO\.?)\s*[:#-]?\s*(?=[A-Z0-9/.-]*[0-9])[A-Z0-9][A-Z0-9/.-]{2,30}/.test(t);
  if (licenceNumber && (tradeTitle || (municipal && /\b(?:TRADE|BUSINESS|ESTABLISHMENT)\b/.test(t)))) matches.push("Trade Licence");
  if (matches.length !== 1) return "unreadable";
  return matches[0] === expected ? "match" : "mismatch";
}

// Only unique, high-confidence identifiers; no raw text escapes this module.
export function extractKycFields(expected, data = {}) {
  if (!Number.isFinite(data.confidence) || data.confidence < 85 || matchKycDocument(expected,data)!=="match") return {};
  const t=String(data.text||"").toUpperCase();
  const fields={};
  const unique=(field,pattern,normalize=v=>v.replace(/[ -]/g,""))=>{
    const values=[...new Set([...t.matchAll(pattern)].map(m=>normalize(m[1]||m[0])))];
    if(values.length===1)fields[field]=values[0];
  };
  if(expected==="PAN Card")unique("panNumber",/\b[A-Z]{5}[0-9]{4}[A-Z]\b/g);
  if(expected==="Aadhaar")unique("idProofNumber",/\b[2-9]\d{3}[ -]?\d{4}[ -]?\d{4}\b/g);
  if(expected==="Voter ID")unique("idProofNumber",/\b[A-Z]{3}[0-9]{7}\b/g);
  if(expected==="Driving Licence")unique("idProofNumber",/\b[A-Z]{2}[ -]?\d{2}[ -]?(?:19|20)\d{2}[ -]?\d{7}\b/g);
  if(expected==="Passport")unique("idProofNumber",/\b[A-Z][0-9]{7}\b/g);
  if(expected==="GST Certificate")unique("gstNumber",/\b[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b/g);
  if(["Bank Passbook","Cancelled Cheque"].includes(expected)){
    unique("ifscCode",/\b[A-Z]{4}0[A-Z0-9]{6}\b/g);
    unique("accountNumber",/\b(?:ACCOUNT|A\/C|ACCT)\s*(?:NUMBER|NO\.?)?\s*[:.-]?\s*(\d{6,18})\b/g);
    unique("bankAccountHolderName",/^\s*ACCOUNT HOLDER(?: NAME)?\s*:\s*([A-Z][A-Z .]{4,60})\s*$/gm,v=>v.trim());
  }
  if(expected==="Trade Licence") {
    unique("tradeLicenceNumber",/\bLICEN[CS]E\s*(?:NUMBER|NO\.?)\s*[:#-]?\s*((?=[A-Z0-9/.-]*[0-9])[A-Z0-9][A-Z0-9/.-]{2,30})/g,v=>v);
    unique("tradeBusinessName",/^\s*(?:BUSINESS|TRADE|ESTABLISHMENT) NAME\s*:\s*([A-Z][A-Z &.]{3,80})\s*$/gm,v=>v.trim());
  }
  return fields;
}
