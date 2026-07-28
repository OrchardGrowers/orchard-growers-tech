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

const extractLabelValue = (text, labels, maxLength = 300) => {
  const labelPattern = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const match = cleanText(text).match(new RegExp(`(?:^|\\n)\\s*(?:${labelPattern})\\s*[:\\-]\\s*([^\\r\\n]+)`, "i"));
  return cleanText(match?.[1], maxLength);
};

const INDIAN_STATES = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar",
  "Chandigarh", "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa",
  "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka",
  "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
  "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim",
  "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
];

const FIELD_KEYWORDS = [
  ["TECHNOLOGY", /\b(software|developer|engineer|information technology|computer|react|javascript|python|java|web|app|data|cloud|cyber)\b/i],
  ["AGRICULTURE", /\b(agriculture|horticulture|agronomy|orchard|farming|crop|agri|soil|plant)\b/i],
  ["FINANCE", /\b(finance|accounting|accountant|banking|audit|taxation|chartered accountant|commerce)\b/i],
  ["SALES", /\b(sales|business development|bde|relationship manager)\b/i],
  ["MARKETING", /\b(marketing|digital marketing|social media|seo|branding)\b/i],
  ["LOGISTICS", /\b(logistics|supply chain|warehouse|transport|scm|dispatch)\b/i],
  ["HR", /\b(human resources|hr|recruitment|recruiter|talent acquisition)\b/i],
  ["OPERATIONS", /\b(operations|back office|administration|coordinator)\b/i],
  ["CUSTOMER_SUPPORT", /\b(customer support|customer care|telecaller|call cent(?:er|re))\b/i],
  ["PHARMA", /\b(pharmacy|pharmacist|pharmaceutical|drug)\b/i],
  ["BIOTECH", /\b(biotechnology|molecular biology|microbiology|life sciences|genomics)\b/i],
];

const SKILL_KEYWORDS = [
  "React", "JavaScript", "TypeScript", "Python", "Java", "Node.js", "MongoDB", "SQL", "Excel",
  "Accounting", "Auditing", "Taxation", "Sales", "Business Development", "Digital Marketing",
  "SEO", "Social Media", "Logistics", "Supply Chain", "Warehouse", "Recruitment", "Agriculture",
  "Horticulture", "Agronomy", "Customer Support", "Pharmacy", "Biotechnology",
];

export const classifyFieldOfWork = (text) => {
  const source = cleanText(text);
  if (/\bIT\b/.test(source)) return "TECHNOLOGY";
  if (/\bCA\b/.test(source)) return "FINANCE";
  const match = FIELD_KEYWORDS.find(([, pattern]) => pattern.test(source));
  return match?.[0] || "UNKNOWN";
};

export const deriveExperienceRange = (years, text = "") => {
  if (/\b(fresher|fresh graduate|no experience)\b/i.test(cleanText(text, 5000))) return "FRESHER";
  if (!Number.isFinite(years) || years < 0) return "UNKNOWN";
  if (years === 0) return "FRESHER";
  if (years < 2) return "UNDER_2_YEARS";
  if (years <= 5) return "TWO_TO_FIVE_YEARS";
  return "ABOVE_5_YEARS";
};

export const extractCandidateProfile = ({ textBody, subject, senderName, senderEmail, replyToName, replyToEmail }) => {
  const source = cleanText(textBody);
  const phones = extractPhoneNumbers(source);
  const emails = extractEmailAddresses(source, replyToEmail, senderEmail);
  const workExperienceText = extractLabelValue(source, ["work experience", "experience", "total experience"], 1000);
  const experienceMatch = workExperienceText
    ? workExperienceText.match(/\b(\d+(?:\.\d+)?)\s*(?:\+?\s*)?(?:years?|yrs?)\b/i)
    : source.match(/\b(?:work\s+)?experience\D{0,30}(\d+(?:\.\d+)?)\s*(?:\+?\s*)?(?:years?|yrs?)\b/i);
  const experienceYears = experienceMatch ? Number(experienceMatch[1]) : null;
  const stateFromLabel = extractLabelValue(source, ["state"], 100);
  const detectedState = INDIAN_STATES.find((state) => new RegExp(`\\b${state.replace(/\s+/g, "\\s+")}\\b`, "i").test(source));
  const qualification =
    extractLabelValue(source, ["qualification", "education", "highest qualification", "degree"], 300) ||
    cleanText(source.match(/\b(B\.?Tech|M\.?Tech|BCA|MCA|BBA|MBA|BSc|MSc|BCom|MCom|BA|MA|PhD|Diploma|ITI|12th|10th)\b/i)?.[0], 100);
  const skillsFromLabel = extractLabelValue(source, ["skills", "technical skills", "key skills"], 1000)
    .split(/[,;|]/)
    .map((value) => cleanText(value, 100))
    .filter(Boolean);
  const detectedSkills = SKILL_KEYWORDS.filter((skill) => {
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    return new RegExp(`\\b${escaped}\\b`, "i").test(source);
  });
  const address = extractLabelValue(source, ["address", "current address", "postal address"], 1000);
  const postalCode =
    extractLabelValue(source, ["pin", "pincode", "postal code", "zip"], 20).match(/\b[1-9]\d{5}\b/)?.[0] ||
    address.match(/\b[1-9]\d{5}\b/)?.[0] ||
    "";

  return {
    candidateName: deriveApplicantName({ senderName, replyToName, senderEmail, textBody: source }),
    email: emails[0] || "",
    contactNumber: phones[0] || "",
    normalizedContactNumber: phones[0] || "",
    alternateContactNumber: phones[1] || "",
    normalizedAlternateContactNumber: phones[1] || "",
    address,
    city: extractLabelValue(source, ["city", "town"], 100),
    district: extractLabelValue(source, ["district"], 100),
    state: stateFromLabel || detectedState || "",
    postalCode,
    qualification,
    workExperienceText,
    experienceYears,
    experienceRange: deriveExperienceRange(experienceYears, workExperienceText || source),
    currentCompany: extractLabelValue(source, ["current company", "company", "employer", "organization"], 200),
    currentDesignation: extractLabelValue(source, ["current designation", "designation", "job title", "position"], 200),
    skills: [...new Set([...skillsFromLabel, ...detectedSkills])].slice(0, 50),
    fieldOfWork: classifyFieldOfWork(`${subject || ""}\n${workExperienceText}\n${source}`),
  };
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
