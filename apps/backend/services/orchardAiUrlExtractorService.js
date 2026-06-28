import dns from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import axios from "axios";
import mongoose from "mongoose";
import Lead, { LEAD_TYPES, normalizeLeadPhone } from "../models/Lead.js";
import {
  findExistingOrchardAiLead,
  isOrchardAiLeadDuplicateError,
} from "./orchardAiLeadDeduplicationService.js";

const REQUEST_TIMEOUT_MS = 10000;
const MAX_HTML_BYTES = 1024 * 1024;

const cleanText = (value, fallback = "", maximumLength = 1000) => {
  const text = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return (text || fallback).slice(0, maximumLength);
};

const decodeHtmlEntities = (value = "") =>
  String(value)
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) =>
      String.fromCodePoint(Number.parseInt(code, 16))
    )
    .replace(/&#([0-9]+);/g, (_match, code) =>
      String.fromCodePoint(Number.parseInt(code, 10))
    )
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");

const stripHtml = (html = "") =>
  cleanText(
    decodeHtmlEntities(
      String(html)
        .replace(/<!--[\s\S]*?-->/g, " ")
        .replace(
          /<(script|style|noscript|svg|template)\b[^>]*>[\s\S]*?<\/\1>/gi,
          " "
        )
        .replace(/<br\s*\/?>/gi, " ")
        .replace(/<\/(p|div|li|h[1-6]|section|article)>/gi, " ")
        .replace(/<[^>]+>/g, " ")
    ),
    "",
    100000
  );

const extractTagText = (html, tagName) => {
  const match = String(html).match(
    new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i")
  );
  return match ? stripHtml(match[1]) : "";
};

const parseTagAttributes = (tag = "") => {
  const attributes = {};
  const pattern =
    /([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  let match;
  while ((match = pattern.exec(tag))) {
    attributes[match[1].toLowerCase()] = decodeHtmlEntities(
      match[2] ?? match[3] ?? match[4] ?? ""
    );
  }
  return attributes;
};

const extractMetaTitle = (html) => {
  const metaTags = String(html).match(/<meta\b[^>]*>/gi) || [];
  for (const tag of metaTags) {
    const attributes = parseTagAttributes(tag);
    const key = String(attributes.property || attributes.name || "").toLowerCase();
    if (["og:title", "twitter:title", "title"].includes(key) && attributes.content) {
      return cleanText(attributes.content, "", 200);
    }
  }
  return "";
};

const extractEmail = (visibleText) => {
  const match = String(visibleText).match(
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i
  );
  return match ? match[0].toLowerCase() : "";
};

const extractPhone = (visibleText) => {
  const candidates =
    String(visibleText).match(/(?:\+?\d[\d\s().-]{5,}\d)/g) || [];
  for (const candidate of candidates) {
    const normalized = normalizeLeadPhone(candidate);
    if (normalized.length >= 7 && normalized.length <= 15) {
      return cleanText(candidate, "", 40);
    }
  }
  return "";
};

const isPrivateIpv4 = (address) => {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return true;
  const [a, b, c] = parts;

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
};

const isPrivateIpv6 = (address) => {
  const normalized = address.toLowerCase().replace(/^\[|\]$/g, "");
  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    /^fe[89a-f]/.test(normalized) ||
    normalized.startsWith("ff") ||
    normalized.startsWith("2001:db8") ||
    normalized.startsWith("::ffff:")
  );
};

export const isPublicIpAddress = (address) => {
  const family = net.isIP(address);
  if (family === 4) return !isPrivateIpv4(address);
  if (family === 6) return !isPrivateIpv6(address);
  return false;
};

const validateExactPublicUrl = (value) => {
  const rawUrl = String(value || "").trim();
  if (!/^https?:\/\//i.test(rawUrl)) {
    throw new Error("URL must be an exact public HTTP or HTTPS URL");
  }

  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("URL is invalid");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only HTTP and HTTPS URLs are supported");
  }
  if (parsed.username || parsed.password) {
    throw new Error("URLs containing credentials are not allowed");
  }
  if (
    parsed.port &&
    !(
      (parsed.protocol === "http:" && parsed.port === "80") ||
      (parsed.protocol === "https:" && parsed.port === "443")
    )
  ) {
    throw new Error("Only standard HTTP and HTTPS ports are allowed");
  }

  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");
  if (
    !hostname ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".lan") ||
    hostname.endsWith(".home")
  ) {
    throw new Error("Local or private hostnames are not allowed");
  }
  const ipHostname = hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(ipHostname) && !isPublicIpAddress(ipHostname)) {
    throw new Error("Local or private IP addresses are not allowed");
  }

  parsed.hash = "";
  return parsed;
};

const resolvePublicTarget = async (parsedUrl, lookup = dns.lookup) => {
  const hostname = parsedUrl.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(hostname)) {
    if (!isPublicIpAddress(hostname)) {
      throw new Error("Local or private IP addresses are not allowed");
    }
    return {
      address: hostname,
      family: net.isIP(hostname),
    };
  }

  let addresses;
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new Error("Public hostname could not be resolved");
  }

  if (!Array.isArray(addresses) || !addresses.length) {
    throw new Error("Public hostname could not be resolved");
  }
  if (addresses.some((entry) => !isPublicIpAddress(entry.address))) {
    throw new Error("Hostname resolves to a local, private, or reserved IP address");
  }

  return addresses.find((entry) => entry.family === 4) || addresses[0];
};

const createPinnedAgent = (parsedUrl, target) => {
  const lookup = (_hostname, options, callback) => {
    if (options?.all) {
      callback(null, [{ address: target.address, family: target.family }]);
      return;
    }
    callback(null, target.address, target.family);
  };
  const options = {
    keepAlive: false,
    lookup,
  };
  return parsedUrl.protocol === "https:"
    ? new https.Agent(options)
    : new http.Agent(options);
};

const fetchPublicHtml = async (
  parsedUrl,
  { httpClient = axios, dnsLookup = dns.lookup } = {}
) => {
  const target = await resolvePublicTarget(parsedUrl, dnsLookup);
  const agent = createPinnedAgent(parsedUrl, target);
  let response;

  try {
    response = await httpClient.get(parsedUrl.toString(), {
      timeout: REQUEST_TIMEOUT_MS,
      maxRedirects: 0,
      responseType: "text",
      maxContentLength: MAX_HTML_BYTES,
      maxBodyLength: MAX_HTML_BYTES,
      decompress: true,
      validateStatus: () => true,
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "OrchardGrowersLeadVerifier/1.0",
      },
      httpAgent: parsedUrl.protocol === "http:" ? agent : undefined,
      httpsAgent: parsedUrl.protocol === "https:" ? agent : undefined,
    });
  } finally {
    agent.destroy();
  }

  if (response.status >= 300 && response.status < 400) {
    throw new Error("URL redirects are not followed. Submit the final public URL");
  }
  if ([401, 403].includes(response.status)) {
    throw new Error("Login, protected, or access-controlled pages cannot be extracted");
  }
  if (response.status === 429) {
    throw new Error("The public page is rate limited. Try again later");
  }
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Public page returned HTTP ${response.status}`);
  }

  const contentType = String(response.headers?.["content-type"] || "").toLowerCase();
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
    throw new Error("URL must return a public HTML page");
  }
  if (typeof response.data !== "string") {
    throw new Error("Public page did not return readable HTML");
  }

  return response.data.slice(0, MAX_HTML_BYTES);
};

const buildFailureSummary = (message, statusCode = 400) => ({
  ok: false,
  created: 0,
  skipped: 0,
  errors: 1,
  lead: null,
  message,
  statusCode,
});

const normalizeLeadType = (value) => {
  const requested = cleanText(value, "Buyer", 80);
  return LEAD_TYPES.find(
    (leadType) => leadType.toLowerCase() === requested.toLowerCase()
  );
};

export const extractOrchardAiLeadFromUrl = async (
  input,
  dependencies = {}
) => {
  const LeadModel = dependencies.LeadModel || Lead;
  const actorId = String(input?.actorId || input?.createdBy || "").trim();
  if (!mongoose.isValidObjectId(actorId)) {
    return buildFailureSummary("A valid collector admin ID is required");
  }

  const leadType = normalizeLeadType(input?.leadType);
  if (!leadType) {
    return buildFailureSummary(`leadType must be one of: ${LEAD_TYPES.join(", ")}`);
  }

  let parsedUrl;
  try {
    parsedUrl = validateExactPublicUrl(input?.url);
  } catch (error) {
    return buildFailureSummary(error.message);
  }

  let html;
  try {
    const fetchPage = dependencies.fetchPage || fetchPublicHtml;
    html = await fetchPage(parsedUrl, dependencies);
  } catch (error) {
    const safeMessage =
      error instanceof Error && error.message
        ? error.message
        : "Public URL could not be extracted";
    return buildFailureSummary(safeMessage, 502);
  }

  const lowerHtml = html.toLowerCase();
  if (
    lowerHtml.includes("captcha") ||
    lowerHtml.includes("verify you are human") ||
    lowerHtml.includes("cf-chl-")
  ) {
    return buildFailureSummary(
      "CAPTCHA or bot-protected pages cannot be extracted",
      403
    );
  }

  const visibleText = stripHtml(html);
  const companyName =
    cleanText(extractTagText(html, "title"), "", 200) ||
    cleanText(extractTagText(html, "h1"), "", 200) ||
    cleanText(extractMetaTitle(html), "", 200) ||
    cleanText(parsedUrl.hostname.replace(/^www\./, ""), "To be verified", 200);
  const phone = extractPhone(visibleText);
  const email = extractEmail(visibleText);
  const sourceUrl = parsedUrl.toString();
  const payload = {
    companyName,
    contactPerson: "To be verified",
    leadType,
    fruits: cleanText(input?.fruit, "", 80) ? [cleanText(input.fruit, "", 80)] : [],
    city: cleanText(input?.city, "", 120),
    state: cleanText(input?.state, "", 120),
    address: "",
    phone,
    email,
    whatsapp: "",
    website: parsedUrl.origin,
    sourceUrl,
    sourcePlatform: parsedUrl.hostname.toLowerCase().replace(/^www\./, ""),
    score: 35,
    priority: "Medium",
    status: "New",
    assignedTo: null,
    notes: cleanText(visibleText, "Public page contained no readable text.", 800),
    tags: ["url-extracted", "public-data", "needs-verification"],
    createdBy: actorId,
    updatedBy: actorId,
  };

  try {
    const duplicate = await findExistingOrchardAiLead(payload, { LeadModel });
    if (duplicate) {
      return {
        ok: true,
        created: 0,
        skipped: 1,
        errors: 0,
        lead: null,
        message: `Lead skipped because ${duplicate.matchedBy} already exists.`,
        statusCode: 200,
      };
    }

    const lead = await LeadModel.create(payload);
    return {
      ok: true,
      created: 1,
      skipped: 0,
      errors: 0,
      lead,
      message: "Lead extracted and created successfully.",
      statusCode: 201,
    };
  } catch (error) {
    if (isOrchardAiLeadDuplicateError(error)) {
      return {
        ok: true,
        created: 0,
        skipped: 1,
        errors: 0,
        lead: null,
        message: "Lead skipped because a duplicate already exists.",
        statusCode: 200,
      };
    }

    return buildFailureSummary(
      error?.name === "ValidationError"
        ? "Extracted lead did not pass validation"
        : "Extracted lead could not be saved",
      400
    );
  }
};
