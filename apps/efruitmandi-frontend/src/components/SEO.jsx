import React from "react";
import { Helmet } from "react-helmet-async";

const SITE_URL = "https://www.efruitmandi.live";
const SITE_NAME = "eFruitMandi";
const DEFAULT_TITLE =
  "eFruitMandi - Fresh Fruit Marketplace for Growers and Buyers";
const DEFAULT_DESCRIPTION =
  "Connect directly with fruit growers, buyers and logistics partners. Discover fresh fruit lots across India through eFruitMandi.";
const DEFAULT_IMAGE = `${SITE_URL}/og-efruitmandi.jpg`;

function normalizeUrl(pathOrUrl = "/") {
  if (pathOrUrl.startsWith("http")) return pathOrUrl;
  if (!pathOrUrl.startsWith("/")) return `${SITE_URL}/${pathOrUrl}`;
  return `${SITE_URL}${pathOrUrl}`;
}

export default function SEO({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  canonical = "/",
  image = DEFAULT_IMAGE,
  type = "website",
  noIndex = false,
  schema,
}) {
  const fullCanonical = normalizeUrl(canonical);
  const fullImage = normalizeUrl(image);
  const schemaList = Array.isArray(schema) ? schema : schema ? [schema] : [];

  return (
    <Helmet>
      <title>{title}</title>

      <meta name="description" content={description} />
      <link rel="canonical" href={fullCanonical} />

      <meta
        name="robots"
        content={noIndex ? "noindex,nofollow" : "index,follow"}
      />

      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={fullCanonical} />
      <meta property="og:image" content={fullImage} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={fullImage} />

      {schemaList.length > 0
        ? schemaList.map((item, index) => (
            <script
              key={`${item?.["@type"] || "schema"}-${index}`}
              type="application/ld+json"
            >
              {JSON.stringify(item)}
            </script>
          ))
        : null}
    </Helmet>
  );
}