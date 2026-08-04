const noReplyPattern = /^(?:no-?reply|do-?not-?reply|mailer-daemon|postmaster)@/i;

export const normalizeExtractedEmail = (value = "") => {
  const match = String(value || "").replace(/^mailto:/i, "").trim().match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const email = match ? match[0].toLowerCase() : "";
  return email && !noReplyPattern.test(email) ? email : "";
};

export const normalizeExtractedPhone = (value = "", { countryHint = "" } = {}) => {
  const original = String(value || "").trim().slice(0, 40);
  let digits = original.replace(/\D/g, "");
  if (/^(\d)\1+$/.test(digits) || digits.length < 7 || digits.length > 15) return { original, normalized: "", countryCode: "" };
  if (digits.startsWith("00")) digits = digits.slice(2);
  let countryCode = original.trim().startsWith("+") && digits.length > 10 ? digits.slice(0, digits.length - 10) : "";
  if (!countryCode && countryHint === "IN" && digits.length === 10) {
    countryCode = "91";
    digits = `91${digits}`;
  }
  return { original, normalized: digits, countryCode };
};

export const normalizeContactName = (value = "") => String(value || "").replace(/\s+/g, " ").trim().slice(0, 200);
export const normalizeBusinessNameForMatch = (value = "") => String(value || "")
  .toLowerCase()
  .replace(/\b(?:private|pvt|limited|ltd|llp|incorporated|inc|company|co)\b\.?/g, " ")
  .replace(/[^a-z0-9\p{L}]+/gu, " ")
  .replace(/\s+/g, " ")
  .trim();

const stateAliases = new Map([
  ["hp", "Himachal Pradesh"], ["h.p.", "Himachal Pradesh"], ["jk", "Jammu and Kashmir"],
  ["j&k", "Jammu and Kashmir"], ["up", "Uttar Pradesh"], ["uk", "Uttarakhand"],
  ["pb", "Punjab"], ["hr", "Haryana"], ["mh", "Maharashtra"],
]);
export const normalizeState = (value = "") => {
  const cleaned = String(value || "").replace(/\s+/g, " ").trim().slice(0, 160);
  return stateAliases.get(cleaned.toLowerCase()) || cleaned;
};

const fruitAliases = new Map([
  ["apples", "Apple"], ["apple", "Apple"], ["mangoes", "Mango"], ["mango", "Mango"],
  ["kinnows", "Kinnow"], ["kinnow", "Kinnow"], ["oranges", "Orange"], ["orange", "Orange"],
  ["pears", "Pear"], ["pear", "Pear"], ["grapes", "Grape"], ["grape", "Grape"],
  ["pomegranates", "Pomegranate"], ["pomegranate", "Pomegranate"], ["bananas", "Banana"], ["banana", "Banana"],
  ["guavas", "Guava"], ["guava", "Guava"], ["cherries", "Cherry"], ["cherry", "Cherry"],
]);
export const normalizeFruits = (values = []) => [...new Set(values.map((value) => fruitAliases.get(String(value).toLowerCase()) || "").filter(Boolean))];

export const buildNormalizedCandidateData = (data = {}) => ({
  email: normalizeExtractedEmail(data.email),
  phone: normalizeExtractedPhone(data.phone, { countryHint: String(data.country || "").toLowerCase() === "india" ? "IN" : "" }).normalized,
  alternateEmails: [...new Set((data.alternateEmails || []).map(normalizeExtractedEmail).filter(Boolean))],
  alternatePhones: [...new Set((data.alternatePhones || []).map((phone) => normalizeExtractedPhone(phone).normalized).filter(Boolean))],
  businessName: normalizeBusinessNameForMatch(data.businessName),
  contactName: normalizeContactName(data.contactPerson || data.name).toLowerCase(),
});
