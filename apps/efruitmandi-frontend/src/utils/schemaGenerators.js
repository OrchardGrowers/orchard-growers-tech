export const SITE_URL = "https://www.efruitmandi.live";
export const ORGANIZATION_NAME = "Orchard Growers Private Limited";
export const ORGANIZATION_ID = `${SITE_URL}/#organization`;

export const normalizeCanonicalUrl = (value = "/") => {
  try {
    const url = new URL(String(value || "/"), SITE_URL);
    if (!/^https?:$/.test(url.protocol)) return SITE_URL;
    url.hash = "";
    return url.toString();
  } catch {
    return SITE_URL;
  }
};

const compact = (value) => Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== ""));
const base = (type, values) => compact({ "@context": "https://schema.org", "@type": type, ...values });

export const buildOrganizationSchema = (values = {}) => base("Organization", {
  "@id": ORGANIZATION_ID,
  name: ORGANIZATION_NAME,
  url: SITE_URL,
  logo: `${SITE_URL}/logo-original.png`,
  ...values,
});

export const publisherReference = () => ({ "@id": ORGANIZATION_ID });
export const buildBusinessOrganizationSchema = (values = {}) => base("Organization", { parentOrganization: publisherReference(), ...values });
export const buildWebSiteSchema = ({ searchPath = "/search?q={search_term_string}", ...values } = {}) => base("WebSite", {
  "@id": `${SITE_URL}/#website`, name: "eFruitMandi", url: SITE_URL, publisher: publisherReference(),
  potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: normalizeCanonicalUrl(searchPath) }, "query-input": "required name=search_term_string" },
  ...values,
});
export const buildLocalBusinessSchema = (values = {}) => base("LocalBusiness", { publisher: publisherReference(), ...values });
export const buildPersonSchema = (values = {}) => base("Person", { affiliation: publisherReference(), ...values });
export const buildProductSchema = (values = {}) => base("Product", { brand: { "@type": "Brand", name: "eFruitMandi" }, subjectOf: { "@type": "WebPage", publisher: publisherReference() }, ...values });
export const buildCollectionPageSchema = (values = {}) => base("CollectionPage", { publisher: publisherReference(), ...values, url: normalizeCanonicalUrl(values.url) });
export const buildItemListSchema = (items = []) => items.length ? base("ItemList", { itemListElement: items.map((item, index) => compact({ "@type": "ListItem", position: index + 1, name: item.name, url: normalizeCanonicalUrl(item.url) })) }) : null;
export const buildBreadcrumbSchema = (items = []) => items.length ? base("BreadcrumbList", { itemListElement: items.map((item, index) => compact({ "@type": "ListItem", position: index + 1, name: item.name, item: normalizeCanonicalUrl(item.url || item.item) })) }) : null;
export const buildFAQSchema = (items = []) => items.length ? base("FAQPage", { publisher: publisherReference(), mainEntity: items.map((item) => ({ "@type": "Question", name: item.question, acceptedAnswer: { "@type": "Answer", text: item.answer } })) }) : null;

export const isValidSchema = (schema) => {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) return false;
  if (schema["@context"] !== "https://schema.org" || !schema["@type"]) return false;
  try { JSON.stringify(schema); return true; } catch { return false; }
};

export const prepareSchemas = (schema) => {
  const schemas = (Array.isArray(schema) ? schema : schema ? [schema] : []).filter(isValidSchema);
  const seen = new Set();
  return schemas.filter((item) => {
    const key = `${item["@type"]}|${item["@id"] || item.url || item.name || JSON.stringify(item)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};
