import { BUSINESS_MAIL_SENDER_PROFILE_KEYS } from "./senderProfiles.js";

const HTML_MARKER = "business-mail-signature-";
const TEXT_MARKER = "\n-- \n";

const PROFILE_SIGNATURES = Object.freeze({
  [BUSINESS_MAIL_SENDER_PROFILE_KEYS.EFRUITMANDI_NO_REPLY]: {
    group: "efruitmandi",
    brand: "eFruitMandi",
    company: "Orchard Growers Private Limited",
    tagline: "India's Digital Fruit Marketplace",
    website: "https://www.efruitmandi.live",
    note: "This email was sent from a no-reply address. Please use the website above for assistance.",
  },
  [BUSINESS_MAIL_SENDER_PROFILE_KEYS.EFRUITMANDI_CAREER]: {
    group: "efruitmandi",
    brand: "eFruitMandi",
    company: "Orchard Growers Private Limited",
    tagline: "India's Digital Fruit Marketplace",
    website: "https://www.efruitmandi.live",
    note: "For career and application-related assistance, please reply to this email or contact the careers team.",
  },
  [BUSINESS_MAIL_SENDER_PROFILE_KEYS.ORCHARD_NO_REPLY]: {
    group: "orchard-growers",
    brand: "Orchard Growers",
    company: "Orchard Growers Private Limited",
    tagline: "",
    website: "https://www.orchardgrowers.in",
    note: "This email was sent from a no-reply address. Please use the website above for assistance.",
  },
  [BUSINESS_MAIL_SENDER_PROFILE_KEYS.ORCHARD_CAREER]: {
    group: "orchard-growers",
    brand: "Orchard Growers",
    company: "Orchard Growers Private Limited",
    tagline: "",
    website: "https://www.orchardgrowers.in",
    note: "For career and application-related assistance, please reply to this email or contact the careers team.",
  },
  [BUSINESS_MAIL_SENDER_PROFILE_KEYS.ADMINHO_ORCHARD]: {
    group: "orchard-growers",
    brand: "Orchard Growers",
    company: "Orchard Growers Private Limited",
    tagline: "",
    website: "https://www.orchardgrowers.in",
    note: "This message was sent by an authorized Orchard Growers administrator.",
  },
  [BUSINESS_MAIL_SENDER_PROFILE_KEYS.SALES_ORCHARD]: {
    group: "orchard-growers",
    brand: "Orchard Growers",
    company: "Orchard Growers Private Limited",
    tagline: "",
    website: "https://www.orchardgrowers.in",
    note: "For sales assistance, please reply to this email.",
  },
  [BUSINESS_MAIL_SENDER_PROFILE_KEYS.SUPPORT_EFRUITMANDI]: {
    group: "efruitmandi",
    brand: "eFruitMandi",
    company: "Orchard Growers Private Limited",
    tagline: "India's Digital Fruit Marketplace",
    website: "https://www.efruitmandi.live",
    note: "For support assistance, please reply to this email.",
  },
});

const escapeHtml = (value = "") => String(value)
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");

const renderHtml = (signature) => {
  const tagline = signature.tagline
    ? `<div style="margin-top:2px;color:#475569;font-size:13px;line-height:19px;">${escapeHtml(signature.tagline)}</div>`
    : "";
  return `<div id="${HTML_MARKER}${signature.group}" style="margin-top:28px;padding-top:18px;border-top:1px solid #dbe4e8;font-family:Arial,Helvetica,sans-serif;color:#172033;max-width:600px;">
  <div style="font-size:18px;line-height:24px;font-weight:700;color:#166534;">${escapeHtml(signature.brand)}</div>
  <div style="margin-top:2px;font-size:14px;line-height:20px;font-weight:600;">${escapeHtml(signature.company)}</div>
  ${tagline}
  <div style="margin-top:8px;font-size:13px;line-height:20px;"><a href="${escapeHtml(signature.website)}" target="_blank" rel="noopener noreferrer" style="color:#047857;text-decoration:none;">${escapeHtml(signature.website)}</a></div>
  <div style="margin-top:12px;color:#64748b;font-size:12px;line-height:18px;">${escapeHtml(signature.note)}</div>
</div>`;
};

const renderText = (signature) => [
  "-- ",
  signature.brand,
  signature.company,
  ...(signature.tagline ? [signature.tagline] : []),
  `Website: ${signature.website}`,
  "",
  signature.note,
].join("\n");

export const getBusinessMailSignature = (senderProfileKey = "") => {
  const key = String(senderProfileKey || "").trim().toUpperCase();
  const signature = PROFILE_SIGNATURES[key];
  if (!signature) return null;
  return Object.freeze({
    senderProfileKey: key,
    group: signature.group,
    html: renderHtml(signature),
    text: renderText(signature),
  });
};

export const hasControlledSignature = (content = "") => {
  const value = String(content || "");
  const hasTextSignature = value.includes(TEXT_MARKER)
    && value.includes("Orchard Growers Private Limited")
    && (value.includes("eFruitMandi") || value.includes("Orchard Growers"));
  return value.includes(`id="${HTML_MARKER}`)
    || value.includes(`id='${HTML_MARKER}`)
    || hasTextSignature;
};

export const appendBusinessMailSignature = ({ senderProfileKey, text = "", html = "" } = {}) => {
  const signature = getBusinessMailSignature(senderProfileKey);
  if (!signature) return { text: String(text || ""), html: String(html || ""), signature: null };
  const normalizedText = String(text || "");
  const normalizedHtml = String(html || "");
  return {
    text: normalizedText && !hasControlledSignature(normalizedText)
      ? `${normalizedText.trimEnd()}\n${signature.text}`
      : normalizedText,
    html: normalizedHtml && !hasControlledSignature(normalizedHtml)
      ? `${normalizedHtml.trimEnd()}\n${signature.html}`
      : normalizedHtml,
    signature,
  };
};
