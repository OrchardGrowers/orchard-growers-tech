import {
  BUSINESS_MAIL_ERROR_CODES,
  BusinessMailError,
} from "../services/businessMail/businessMailErrors.js";

const ALLOWED_TAGS = new Set([
  "p", "div", "span", "br", "strong", "b", "em", "i", "u", "ul", "ol", "li",
  "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "table", "thead", "tbody",
  "tr", "th", "td", "a",
]);
const GLOBAL_ATTRIBUTES = new Set(["class", "id", "title", "style", "align", "valign", "width", "height", "dir", "lang"]);
const TAG_ATTRIBUTES = Object.freeze({
  a: new Set(["href", "target", "rel"]),
  table: new Set(["border", "cellpadding", "cellspacing"]),
  th: new Set(["colspan", "rowspan"]),
  td: new Set(["colspan", "rowspan"]),
});
const BANNED_TAG_PATTERN = /<\s*\/?\s*(script|iframe|object|embed|form|input|button|textarea|select|option|meta|base|link|frame|frameset|svg|math)\b/i;
const EVENT_ATTRIBUTE_PATTERN = /\bon[a-z0-9_-]+\s*=/i;
const DANGEROUS_TEXT_PATTERNS = [
  /javascript:/i,
  /vbscript:/i,
  /data:text\/html/i,
  /expression\s*\(/i,
  /url\s*\(\s*javascript:/i,
  /document\s*\.\s*cookie/i,
  /window\s*\.\s*location/i,
  /\bsrcdoc\s*=/i,
  /http-equiv\s*=\s*["']?refresh/i,
];

const unsafeHtml = (message) => {
  throw new BusinessMailError(BUSINESS_MAIL_ERROR_CODES.UNSAFE_HTML, message);
};

const decodeCodePoint = (value, radix = 10) => {
  const codePoint = Number.parseInt(value, radix);
  return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
    ? String.fromCodePoint(codePoint)
    : "\ufffd";
};

const decodeEntitiesForInspection = (value = "") =>
  String(value)
    .replace(/&#(\d+);?/g, (_match, decimal) => decodeCodePoint(decimal))
    .replace(/&#x([0-9a-f]+);?/gi, (_match, hex) => decodeCodePoint(hex, 16))
    .replace(/&(colon|tab|newline);/gi, (_match, name) => ({ colon: ":", tab: "\t", newline: "\n" }[name.toLowerCase()]))
    .replace(/&(?:lt);/gi, "<")
    .replace(/&(?:gt);/gi, ">")
    .replace(/&(?:quot);/gi, '"')
    .replace(/&(?:apos|#39);/gi, "'")
    .replace(/&(?:amp);/gi, "&");

const parseAttributes = (rawAttributes = "") => {
  const attributes = [];
  let index = 0;

  while (index < rawAttributes.length) {
    while (/\s/.test(rawAttributes[index] || "")) index += 1;
    if (index >= rawAttributes.length || rawAttributes[index] === "/") break;

    const nameStart = index;
    while (index < rawAttributes.length && !/[\s=/>]/.test(rawAttributes[index])) index += 1;
    const name = rawAttributes.slice(nameStart, index).toLowerCase();
    if (!name) unsafeHtml("Business Mail HTML contains malformed attributes.");
    while (/\s/.test(rawAttributes[index] || "")) index += 1;

    let value = "";
    if (rawAttributes[index] === "=") {
      index += 1;
      while (/\s/.test(rawAttributes[index] || "")) index += 1;
      const quote = rawAttributes[index] === '"' || rawAttributes[index] === "'" ? rawAttributes[index++] : "";
      const valueStart = index;
      if (quote) {
        while (index < rawAttributes.length && rawAttributes[index] !== quote) index += 1;
        if (index >= rawAttributes.length) unsafeHtml("Business Mail HTML contains an unterminated attribute.");
        value = rawAttributes.slice(valueStart, index);
        index += 1;
      } else {
        while (index < rawAttributes.length && !/[\s>]/.test(rawAttributes[index])) index += 1;
        value = rawAttributes.slice(valueStart, index);
      }
    }
    attributes.push({ name, value });
  }

  return attributes;
};

const validateTag = (token) => {
  if (/^<\s*[!?]/.test(token)) unsafeHtml("Comments, declarations, and processing instructions are not allowed in Business Mail HTML.");
  const match = token.match(/^<\s*(\/?)\s*([a-z0-9]+)\b([^>]*)>$/i);
  if (!match) unsafeHtml("Business Mail HTML contains malformed markup.");

  const closing = Boolean(match[1]);
  const tagName = match[2].toLowerCase();
  const rawAttributes = match[3] || "";
  if (!ALLOWED_TAGS.has(tagName)) unsafeHtml(`HTML tag <${tagName}> is not allowed.`);
  if (closing) {
    if (rawAttributes.trim()) unsafeHtml("Closing HTML tags cannot contain attributes.");
    return;
  }

  for (const attribute of parseAttributes(rawAttributes)) {
    if (/^on/i.test(attribute.name) || attribute.name === "srcdoc") {
      unsafeHtml("Event handlers and srcdoc are not allowed in Business Mail HTML.");
    }
    const allowedForTag = TAG_ATTRIBUTES[tagName] || new Set();
    if (!GLOBAL_ATTRIBUTES.has(attribute.name) && !allowedForTag.has(attribute.name)) {
      unsafeHtml(`HTML attribute ${attribute.name} is not allowed on <${tagName}>.`);
    }
    if (tagName === "a" && attribute.name === "href") {
      const href = decodeEntitiesForInspection(attribute.value).trim();
      if (!/^(https?:\/\/|mailto:)/i.test(href)) unsafeHtml("Links must use http, https, or mailto URLs.");
    }
  }
};

export const validateBusinessMailHtml = (html = "") => {
  if (!html) return true;
  if (typeof html !== "string") unsafeHtml("Business Mail HTML must be a string.");

  const decoded = decodeEntitiesForInspection(html);
  const compact = decoded.replace(/[\u0000-\u0020\u007f]+/g, "").toLowerCase();
  if (BANNED_TAG_PATTERN.test(decoded)) unsafeHtml("Business Mail HTML contains a prohibited tag.");
  if (EVENT_ATTRIBUTE_PATTERN.test(decoded)) unsafeHtml("Business Mail HTML contains a prohibited event handler.");
  for (const pattern of DANGEROUS_TEXT_PATTERNS) {
    if (pattern.test(decoded) || pattern.test(compact)) unsafeHtml("Business Mail HTML contains prohibited active content.");
  }

  const tokens = decoded.match(/<[^>]*>/g) || [];
  const withoutTokens = decoded.replace(/<[^>]*>/g, "");
  if (withoutTokens.includes("<")) unsafeHtml("Business Mail HTML contains malformed markup.");
  tokens.forEach(validateTag);
  return true;
};

export const BUSINESS_MAIL_ALLOWED_HTML_TAGS = Object.freeze(Array.from(ALLOWED_TAGS));
