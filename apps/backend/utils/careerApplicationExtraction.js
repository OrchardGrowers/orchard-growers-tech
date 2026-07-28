import crypto from "node:crypto";

const cleanText = (value, maxLength = 100000) =>
  String(value || "")
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, maxLength);

export const normalizeEmailAddress = (value) => {
  const match = cleanText(value, 320).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0].toLowerCase() : "";
};

export const extractEmailAddresses = (text, ...knownAddresses) => {
  const matches = cleanText(text).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  return [...new Set([...knownAddresses, ...matches].map(normalizeEmailAddress).filter(Boolean))];
};

export const normalizeIndianPhoneNumber = (value) => {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  return /^[6-9]\d{9}$/.test(digits) ? `+91${digits}` : "";
};

export const extractPhoneNumbers = (text) => {
  const candidates = cleanText(text).match(/(?:\+?91[\s.-]?)?[6-9](?:[\s.-]?\d){9}(?!\d)/g) || [];
  return [...new Set(candidates.map(normalizeIndianPhoneNumber).filter(Boolean))];
};

export const createBodyPreview = (text, maxLength = 500) =>
  cleanText(text)
    .replace(/\s+/g, " ")
    .slice(0, maxLength);

export const deriveApplicantName = ({ senderName, replyToName, senderEmail, textBody }) => {
  const emailLocalPart = normalizeEmailAddress(senderEmail).split("@")[0].replace(/[._-]+/g, " ");
  const candidates = [senderName, replyToName, cleanText(textBody).split(/\r?\n/)[0], emailLocalPart];
  const plausible = candidates
    .map((candidate) => cleanText(candidate, 80).replace(/^from\s*:\s*/i, ""))
    .find(
      (candidate) =>
        candidate &&
        candidate !== senderEmail &&
        !candidate.includes("@") &&
        !/^https?:\/\//i.test(candidate) &&
        /[A-Za-z\u00C0-\u024F\u0900-\u097F]/.test(candidate)
    );
  return plausible || "Unknown Applicant";
};

export const createFallbackMessageKey = ({
  senderEmail,
  replyToEmail,
  subject,
  emailDate,
  textBody,
}) => {
  const stableInput = [
    normalizeEmailAddress(senderEmail),
    normalizeEmailAddress(replyToEmail),
    cleanText(subject, 500).toLowerCase(),
    emailDate ? new Date(emailDate).toISOString() : "",
    cleanText(textBody, 2000).replace(/\s+/g, " ").toLowerCase(),
  ].join("\n");

  return `fallback:${crypto.createHash("sha256").update(stableInput).digest("hex")}`;
};
