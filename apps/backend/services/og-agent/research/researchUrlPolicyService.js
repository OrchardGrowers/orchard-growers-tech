import dns from "node:dns/promises";
import net from "node:net";
import { isPublicIpAddress } from "../../orchardAiUrlExtractorService.js";

const error = (message, code = "RESEARCH_URL_BLOCKED") => Object.assign(new Error(message), { statusCode: 403, code });
const normalizeHost = (value) => String(value || "").toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
export const normalizeResearchUrl = (value) => {
  let url; try { url = new URL(String(value || "").trim()); } catch { throw error("URL is malformed", "INVALID_RESEARCH_URL"); }
  if (!["https:", "http:"].includes(url.protocol)) throw error("Only approved HTTP and HTTPS URLs are allowed");
  if (url.username || url.password) throw error("Embedded URL credentials are prohibited");
  if (url.port && !(["https:", "443"].includes(url.protocol) && url.port === "443") && !(url.protocol === "http:" && url.port === "80")) throw error("Non-standard ports are prohibited");
  const hostname = normalizeHost(url.hostname.replace(/^\[|\]$/g, ""));
  if (!hostname || ["localhost", "metadata.google.internal"].includes(hostname) || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".internal") || hostname.endsWith(".lan")) throw error("Local, metadata, or internal hosts are prohibited", "SSRF_BLOCKED");
  if (net.isIP(hostname) && !isPublicIpAddress(hostname)) throw error("Private, reserved, or link-local IPs are prohibited", "SSRF_BLOCKED");
  url.hostname = url.hostname.toLowerCase(); url.hash = "";
  [...url.searchParams.keys()].filter((key) => /^(utm_|fbclid|gclid|mc_)/i.test(key)).forEach((key) => url.searchParams.delete(key));
  return url;
};
export const isApprovedResearchDomain = (hostname, approvedDomain) => { const host = normalizeHost(hostname); const allowed = normalizeHost(approvedDomain); return Boolean(allowed && (host === allowed || host.endsWith(`.${allowed}`))); };
export const assertApprovedResearchUrl = async ({ value, source, operation = "FETCH_PAGE", dnsLookup = dns.lookup }) => {
  const url = normalizeResearchUrl(value);
  if (!isApprovedResearchDomain(url.hostname, source.domain)) throw error("URL domain is not approved for this source", "UNAPPROVED_DOMAIN");
  if (!source.allowedOperations?.includes(operation)) throw error(`Source does not allow ${operation}`, "SOURCE_OPERATION_BLOCKED");
  const path = url.pathname || "/";
  if ((source.deniedPaths || []).some((prefix) => path.startsWith(prefix))) throw error("URL path is denied by source policy", "SOURCE_PATH_BLOCKED");
  if (source.allowedPaths?.length && !source.allowedPaths.some((prefix) => path.startsWith(prefix))) throw error("URL path is outside the source allowlist", "SOURCE_PATH_BLOCKED");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const answers = net.isIP(host) ? [{ address: host, family: net.isIP(host) }] : await dnsLookup(host, { all: true, verbatim: true }).catch(() => []);
  if (!answers.length || answers.some((entry) => !isPublicIpAddress(entry.address))) throw error("Hostname resolution is unavailable or unsafe", "SSRF_BLOCKED");
  return { url, addresses: answers };
};
export const assertSafeRedirect = (location, currentUrl, source) => { const target = new URL(location, currentUrl); if (!isApprovedResearchDomain(target.hostname, source.domain)) throw error("Redirect left the approved source domain", "REDIRECT_BLOCKED"); return normalizeResearchUrl(target); };
