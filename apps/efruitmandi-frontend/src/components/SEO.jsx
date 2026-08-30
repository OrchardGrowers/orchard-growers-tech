import React from "react";
import { Helmet } from "react-helmet-async";
import { normalizeCanonicalUrl, prepareSchemas } from "../utils/schemaGenerators";

const SITE_URL = "https://www.efruitmandi.live";
const SITE_NAME = "eFruitMandi";
const DEFAULT_TITLE =
  "eFruitMandi - Fresh Fruit Marketplace for Growers and Buyers";
const DEFAULT_DESCRIPTION =
  "Connect directly with fruit growers, buyers and logistics partners. Discover fresh fruit lots across India through eFruitMandi.";
const DEFAULT_IMAGE = `${SITE_URL}/og-efruitmandi.jpg`;

function normalizeUrl(pathOrUrl = "/") {
  return normalizeCanonicalUrl(pathOrUrl);
}

export function getInitialRobotsDirective(canonical, fallback = "noindex,nofollow") {
  if (typeof document === "undefined") return fallback;

  const canonicalElement = document.querySelector('link[rel="canonical"]');
  if (!canonicalElement || normalizeUrl(canonicalElement.href) !== normalizeUrl(canonical)) {
    return fallback;
  }

  const directive = String(
    document.querySelector('meta[name="robots"]')?.getAttribute("content") || ""
  )
    .toLowerCase()
    .replace(/\s+/g, "");

  return ["index,follow", "noindex,follow", "noindex,nofollow"].includes(directive)
    ? directive
    : fallback;
}

export default function SEO({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  canonical = "/",
  image = DEFAULT_IMAGE,
  type = "website",
  noIndex = false,
  robots,
  schema,
  schemaId = "",
}) {
  const fullCanonical = canonical === null ? "" : normalizeUrl(canonical);
  const fullImage = image && (/^https?:\/\//i.test(image) || image.startsWith("/")) ? normalizeUrl(image) : "";
  const schemaList = prepareSchemas(schema);
  const robotsDirective =
    robots === "noindex,follow" || robots === "noindex,nofollow" || robots === "index,follow"
      ? robots
      : noIndex
        ? "noindex,nofollow"
        : "index,follow";

  return (
    <Helmet>
      <title>{title}</title>

      <meta name="description" content={description} />
      {fullCanonical && <link rel="canonical" href={fullCanonical} />}

      <meta
        name="robots"
        content={robotsDirective}
      />
      <meta
        name="googlebot"
        content={robotsDirective}
      />

      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      {fullCanonical && <meta property="og:url" content={fullCanonical} />}
      {fullImage && <meta property="og:image" content={fullImage} />}

      <meta name="twitter:card" content={fullImage ? "summary_large_image" : "summary"} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      {fullImage && <meta name="twitter:image" content={fullImage} />}

      {schemaList.length > 0
        ? schemaList.map((item, index) => (
            <script
              key={`${item?.["@type"] || "schema"}-${index}`}
              id={schemaId && index === 0 ? schemaId : undefined}
              type="application/ld+json"
            >
              {JSON.stringify(item).replace(/</g, "\\u003c")}
            </script>
          ))
        : null}
    </Helmet>
  );
}
