import http from "node:http";
import https from "node:https";
import axios from "axios";
import { assertApprovedResearchUrl, assertSafeRedirect } from "./researchUrlPolicyService.js";
import { detectBlockedPage, sanitizeResearchContent } from "./researchContentSanitizer.js";

const allowedContentTypes = ["text/html", "application/xhtml+xml", "application/json", "application/ld+json", "text/csv", "application/xml", "text/xml", "application/rss+xml", "application/atom+xml"];
const pinnedAgent = (protocol, address, family) => { const lookup = (_host, options, callback) => options?.all ? callback(null, [{ address, family }]) : callback(null, address, family); return protocol === "https:" ? new https.Agent({ lookup, keepAlive: false }) : new http.Agent({ lookup, keepAlive: false }); };
export const fetchApprovedWebsitePage = async ({ source, value, settings = {}, httpClient = axios, dnsLookup, redirectChain = [] }) => {
  const { url, addresses } = await assertApprovedResearchUrl({ value, source, operation: "FETCH_PAGE", dnsLookup });
  const target = addresses.find((item) => item.family === 4) || addresses[0]; const agent = pinnedAgent(url.protocol, target.address, target.family);
  const maximumBytes = Math.min(settings.maximumResponseBytes || 500000, 2000000); let response;
  try { response = await httpClient.get(url.toString(), { timeout: Math.min((settings.requestTimeoutSeconds || 15) * 1000, 60000), maxRedirects: 0, responseType: "text", maxContentLength: maximumBytes, maxBodyLength: maximumBytes, decompress: true, validateStatus: () => true, headers: { Accept: allowedContentTypes.join(","), "User-Agent": "OrchardGrowersResearchAgent/1.0 (+https://www.efruitmandi.live)" }, httpAgent: url.protocol === "http:" ? agent : undefined, httpsAgent: url.protocol === "https:" ? agent : undefined }); } finally { agent.destroy(); }
  if (response.status >= 300 && response.status < 400) { if (!source.followRedirects || redirectChain.length >= source.maximumRedirects) throw Object.assign(new Error("Redirect is not allowed by source policy"), { code: "REDIRECT_BLOCKED", statusCode: 403 }); const next = assertSafeRedirect(response.headers?.location, url, source); return fetchApprovedWebsitePage({ source, value: next.toString(), settings, httpClient, dnsLookup, redirectChain: [...redirectChain, url.toString()] }); }
  if ([401, 403].includes(response.status)) throw Object.assign(new Error("Source requires login or denied access"), { code: response.status === 401 ? "LOGIN_REQUIRED" : "SOURCE_ACCESS_DENIED", statusCode: response.status });
  if (response.status === 429) throw Object.assign(new Error("Source rate limited the request"), { code: "SOURCE_RATE_LIMITED", statusCode: 429, retryAfter: response.headers?.["retry-after"] });
  if (response.status < 200 || response.status >= 300) throw Object.assign(new Error(`Source returned HTTP ${response.status}`), { code: "SOURCE_HTTP_ERROR", statusCode: 502 });
  const contentType = String(response.headers?.["content-type"] || "").toLowerCase(); if (!allowedContentTypes.some((type) => contentType.includes(type))) throw Object.assign(new Error("Unsupported or binary source content was rejected"), { code: "UNSUPPORTED_CONTENT_TYPE", statusCode: 415 });
  const raw = typeof response.data === "string" ? response.data : JSON.stringify(response.data); if (Buffer.byteLength(raw) > maximumBytes) throw Object.assign(new Error("Source response exceeded the configured size limit"), { code: "RESPONSE_TOO_LARGE", statusCode: 413 });
  const blocked = detectBlockedPage(raw); if (blocked) throw Object.assign(new Error(blocked === "CAPTCHA_DETECTED" ? "CAPTCHA stopped collection" : "Login-required content stopped collection"), { code: blocked, statusCode: 403 });
  return { url: url.toString(), redirectChain, contentType, httpStatus: response.status, rawContent: raw, ...sanitizeResearchContent(raw, maximumBytes) };
};
export const discoverApprovedLinks = ({ html, baseUrl, source, maximum = 20 }) => { const links = []; const seen = new Set(); const pattern = /<a\b[^>]*href\s*=\s*["']([^"']+)["']/gi; let match; while ((match = pattern.exec(String(html))) && links.length < maximum) { try { const url = new URL(match[1], baseUrl); url.hash = ""; const value = url.toString(); if (!seen.has(value) && (url.hostname === source.domain || url.hostname.endsWith(`.${source.domain}`)) && !(source.deniedPaths || []).some((path) => url.pathname.startsWith(path))) { seen.add(value); links.push(value); } } catch { /* invalid discovered link */ } } return links; };
