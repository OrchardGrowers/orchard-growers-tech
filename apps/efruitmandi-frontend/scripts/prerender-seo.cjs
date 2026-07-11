const fs = require("fs");
const path = require("path");

const SITE_URL = "https://www.efruitmandi.live";
const PUBLIC_LOCATION_MIN_PROFILES = 2;
const API_BASE_URL = String(
  process.env.VITE_API_BASE_URL ||
    process.env.VITE_API_URL ||
    process.env.REACT_APP_API_BASE_URL ||
    "https://api.efruitmandi.live"
).replace(/\/+$/, "");
const appRoot = path.resolve(__dirname, "..");
const buildDir = path.join(appRoot, "build");
const indexPath = path.join(buildDir, "index.html");

const publicLinks = [
  { href: "/auctions", label: "Fruit Lots Marketplace" },
  { href: "/fruit-lots/apple", label: "Apple Fruit Lots" },
  { href: "/fruit-lots/persimmon", label: "Persimmon Fruit Lots" },
  { href: "/mandi-rates", label: "Mandi Rates" },
  { href: "/buyer-guide", label: "Buyer Guide" },
  { href: "/grower-guide", label: "Grower Guide" },
  { href: "/why-efruitmandi", label: "Why eFruitMandi" },
  { href: "/contact-us", label: "Contact" },
];

const routes = [
  {
    path: "/auctions",
    title: "Fruit Lots Marketplace | Live Deals on eFruitMandi",
    description: "Browse Fruit Lots, Live Deals, Active Deals and Completed Deals on eFruitMandi, India's fresh fruit marketplace for growers and buyers.",
    h1: "Fruit Lots Marketplace",
    body: "Explore Live Deals, Active Deals, Completed Deals, Fruit Lots, Buy Lots and Sell Lots from verified growers and marketplace participants.",
  },
  {
    path: "/fruit-lots/apple",
    title: "Apple Fruit Lots | Buy Apple Lots Online | eFruitMandi",
    description: "Find Apple Fruit Lots with variety, grade, packing, region and seasonal marketplace information for fruit buyers and growers.",
    h1: "Apple Fruit Lots",
    body: "Apple Fruit Lots on eFruitMandi help buyers discover apple varieties, growing regions, lot details, grade information and marketplace sourcing options.",
  },
  {
    path: "/fruit-lots/persimmon",
    title: "Persimmon Fruit Lots | Buy Persimmon Lots Online | eFruitMandi",
    description: "Explore Persimmon Fruit Lots, seasonal availability, lot details and grower-buyer marketplace information on eFruitMandi.",
    h1: "Persimmon Fruit Lots",
    body: "Persimmon Fruit Lots include seasonal marketplace information, lot size, quality details and buyer sourcing context for fresh fruit trade.",
  },
  {
    path: "/grower-guide",
    title: "Grower Guide | Sell Fruit Lots on eFruitMandi",
    description: "Learn how growers can list Fruit Lots, manage Sell Lots, receive buyer offers and use eFruitMandi marketplace tools.",
    h1: "Grower Guide",
    body: "The Grower Guide explains how to sell fruit lots, prepare lot details, add grade and packing information, and participate in the marketplace.",
  },
  {
    path: "/buyer-guide",
    title: "Buyer Guide | Buy Fruit Lots on eFruitMandi",
    description: "Learn how buyers can discover Fruit Lots, compare Live Deals, submit offers and source fresh fruit through eFruitMandi.",
    h1: "Buyer Guide",
    body: "The Buyer Guide helps fruit buyers understand Buy Lots, Live Deals, lot details, grower profiles and marketplace sourcing workflows.",
  },
  {
    path: "/blog",
    title: "Fruit Trade Blog | eFruitMandi Marketplace",
    description: "Read fruit marketplace guides, market price insights, grower-buyer information and fresh fruit trade updates from eFruitMandi.",
    h1: "Fruit Trade Blog",
    body: "The eFruitMandi blog covers Fruit Lots, market prices, grower guidance, buyer sourcing, packing, grading and marketplace updates.",
  },
  {
    path: "/blog/market-price/apple",
    title: "Apple Market Price Guide | Apple Mandi Rates | eFruitMandi",
    description: "Read apple market price guidance, mandi rate context and buyer sourcing information for Apple Fruit Lots on eFruitMandi.",
    h1: "Apple Market Price Guide",
    body: "This apple market price guide helps visitors understand apple mandi rates, grade context, regional sourcing and Apple Fruit Lots marketplace information.",
  },
  {
    path: "/about",
    title: "About eFruitMandi | Fresh Fruit Marketplace",
    description: "Learn about eFruitMandi, a fresh fruit marketplace by Orchard Growers Private Limited for growers, buyers and logistics partners.",
    h1: "About eFruitMandi",
    body: "eFruitMandi supports India's fruit trade with Fruit Lots, marketplace records, verified profiles, grower-buyer discovery and logistics coordination.",
  },
  {
    path: "/our-story",
    title: "Our Story | eFruitMandi",
    description: "Read the story behind eFruitMandi and its mission to support growers, buyers and fresh fruit marketplace transparency.",
    h1: "Our Story",
    body: "eFruitMandi was built from practical fruit industry experience and research into grower needs, buyer discovery, marketplace records and trusted fruit trade.",
  },
  {
    path: "/contact-us",
    title: "Contact eFruitMandi | Fruit Marketplace Support",
    description: "Contact eFruitMandi for marketplace support, Fruit Lots, buyer questions, grower help, logistics support and platform information.",
    h1: "Contact eFruitMandi",
    body: "Use the official contact page for eFruitMandi marketplace questions, Fruit Lots support, grower help, buyer guidance and logistics coordination.",
  },
  {
    path: "/why-efruitmandi",
    title: "Why eFruitMandi | Fruit Marketplace for Growers and Buyers",
    description: "Discover why eFruitMandi supports Live Deals, Active Deals, Completed Deals, Fruit Lots, Buy Lots and Sell Lots.",
    h1: "Why eFruitMandi",
    body: "eFruitMandi helps growers and buyers use structured Fruit Lots, marketplace records, verified profiles and transparent fresh fruit trade workflows.",
  },
  {
    path: "/faqs",
    title: "eFruitMandi FAQs | Fruit Marketplace Questions",
    description: "Find answers about eFruitMandi, Fruit Lots, Buy Lots, Sell Lots, marketplace profiles, KYC, logistics and support workflows.",
    h1: "eFruitMandi FAQs",
    body: "Frequently asked questions explain Fruit Lots, Buy Lots, Sell Lots, marketplace access, grower-buyer workflows and platform support.",
  },
  {
    path: "/privacy-policy",
    title: "Privacy Policy | eFruitMandi",
    description: "Read the eFruitMandi privacy policy for marketplace users, growers, buyers, logistics partners and public visitors.",
    h1: "Privacy Policy",
    body: "The privacy policy explains how eFruitMandi handles marketplace user information, public pages, support records and platform data.",
  },
  {
    path: "/terms-of-service",
    title: "Terms of Service | eFruitMandi",
    description: "Read eFruitMandi terms for marketplace use, Fruit Lots, buyer and grower workflows, logistics records and platform support.",
    h1: "Terms of Service",
    body: "The terms of service describe marketplace responsibilities, Fruit Lots information, buyer and grower workflows, support records and platform use.",
  },
  {
    path: "/mandi-rates",
    title: "Mandi Rates | Fruit Market Prices | eFruitMandi",
    description: "View mandi rates and fruit market price information for buyers, growers and marketplace visitors on eFruitMandi.",
    h1: "Mandi Rates",
    body: "Mandi Rates on eFruitMandi help visitors review fruit market price context, public rate information and marketplace sourcing signals.",
  },
];

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function absoluteUrl(routePath) {
  return `${SITE_URL}${routePath === "/" ? "/" : routePath}`;
}

function replaceUnique(html, regex, replacement) {
  let found = false;
  const nextHtml = html.replace(regex, () => {
    if (found) return "";
    found = true;
    return replacement;
  });

  if (found) return nextHtml;
  return nextHtml.replace(/<\/head>/i, `    ${replacement}\n  </head>`);
}

function replaceHeadTags(html, meta) {
  const canonical = absoluteUrl(meta.path);
  let nextHtml = html;
  nextHtml = replaceUnique(nextHtml, /<title>[\s\S]*?<\/title>/gi, `<title>${escapeHtml(meta.title)}</title>`);
  nextHtml = replaceUnique(nextHtml, /<meta\s+(?=[^>]*\bname=["']description["'])[^>]*>\s*/gi, `<meta name="description" content="${escapeHtml(meta.description)}" />\n    `);
  nextHtml = replaceUnique(nextHtml, /<link\s+(?=[^>]*\brel=["']canonical["'])[^>]*>\s*/gi, `<link rel="canonical" href="${escapeHtml(canonical)}" />\n    `);
  nextHtml = replaceUnique(nextHtml, /<meta\s+(?=[^>]*\bproperty=["']og:title["'])[^>]*>\s*/gi, `<meta property="og:title" content="${escapeHtml(meta.title)}" />\n    `);
  nextHtml = replaceUnique(nextHtml, /<meta\s+(?=[^>]*\bproperty=["']og:description["'])[^>]*>\s*/gi, `<meta property="og:description" content="${escapeHtml(meta.description)}" />\n    `);
  nextHtml = replaceUnique(nextHtml, /<meta\s+(?=[^>]*\bproperty=["']og:url["'])[^>]*>\s*/gi, `<meta property="og:url" content="${escapeHtml(canonical)}" />\n    `);
  nextHtml = replaceUnique(nextHtml, /<meta\s+(?=[^>]*\bname=["']twitter:title["'])[^>]*>\s*/gi, `<meta name="twitter:title" content="${escapeHtml(meta.title)}" />\n    `);
  nextHtml = replaceUnique(nextHtml, /<meta\s+(?=[^>]*\bname=["']twitter:description["'])[^>]*>\s*/gi, `<meta name="twitter:description" content="${escapeHtml(meta.description)}" />\n    `);
  return nextHtml;
}

function removeHeadTag(html, regex) {
  return html.replace(regex, "");
}

function appendToHead(html, markup) {
  return html.replace(/<\/head>/i, `    ${markup}\n  </head>`);
}

function replaceProfileHeadTags(html, meta) {
  let nextHtml = replaceHeadTags(html, meta);
  nextHtml = replaceUnique(nextHtml, /<meta\s+(?=[^>]*\bname=["']robots["'])[^>]*>\s*/gi, `<meta name="robots" content="${meta.noIndex ? "noindex,nofollow" : "index,follow"}" />\n    `);
  nextHtml = replaceUnique(nextHtml, /<meta\s+(?=[^>]*\bproperty=["']og:type["'])[^>]*>\s*/gi, '<meta property="og:type" content="website" />\n    ');
  nextHtml = replaceUnique(nextHtml, /<meta\s+(?=[^>]*\bname=["']twitter:card["'])[^>]*>\s*/gi, `<meta name="twitter:card" content="${meta.image ? "summary_large_image" : "summary"}" />\n    `);

  nextHtml = removeHeadTag(nextHtml, /<meta\s+(?=[^>]*\bproperty=["']og:image["'])[^>]*>\s*/gi);
  nextHtml = removeHeadTag(nextHtml, /<meta\s+(?=[^>]*\bname=["']twitter:image["'])[^>]*>\s*/gi);
  if (meta.image) {
    nextHtml = appendToHead(
      nextHtml,
      `<meta property="og:image" content="${escapeHtml(meta.image)}" />\n    <meta name="twitter:image" content="${escapeHtml(meta.image)}" />`
    );
  }

  const schemas = (meta.schemas || [meta.businessSchema, meta.breadcrumbSchema])
    .filter(Boolean)
    .map((schema) => `<script type="application/ld+json">${JSON.stringify(schema).replace(/</g, "\\u003c")}</script>`)
    .join("\n    ");
  return appendToHead(nextHtml, schemas);
}

function renderFallback(meta) {
  const links = publicLinks
    .map((link) => `<a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a>`)
    .join(" | ");

  return `      <main style="background:#f7fff4;color:#123;padding:32px;font-family:Arial,sans-serif;line-height:1.6">
        <h1>${escapeHtml(meta.h1)}</h1>
        <p>${escapeHtml(meta.description)}</p>
        <h2>eFruitMandi Marketplace</h2>
        <p>${escapeHtml(meta.body)}</p>
        <p>Public eFruitMandi pages support Live Deals, Active Deals, Completed Deals, Fruit Lots, Buy Lots, Sell Lots and Marketplace discovery for fresh fruit trade.</p>
        <nav aria-label="Important eFruitMandi pages">${links}</nav>
      </main>`;
}

function renderPublicProfileFallback(meta) {
  const location = meta.location
    ? `<p><strong>Public location:</strong> ${escapeHtml(meta.location)}</p>`
    : "";
  const activity = meta.role === "grower"
    ? "Public fruit lots and completed deals from this grower are available on eFruitMandi."
    : "Public sourcing activity and completed fruit deals from this buyer are available on eFruitMandi.";

  return `      <main style="background:#f7fff4;color:#123;padding:32px;font-family:Arial,sans-serif;line-height:1.6">
        <article>
          <p>${meta.role === "grower" ? "Public Fruit Grower Profile" : "Public Fruit Buyer Profile"}</p>
          <h1>${escapeHtml(meta.name)}</h1>
          ${location}
          <p>${escapeHtml(activity)}</p>
          <p><a href="/">Visit eFruitMandi</a></p>
        </article>
      </main>`;
}

function renderPublicDirectoryFallback(meta) {
  const links = meta.profiles.length
    ? `<ul>${meta.profiles.map((profile) => `<li><a href="${escapeHtml(profile.path)}">${escapeHtml(profile.name)}</a>${profile.location ? ` — ${escapeHtml(profile.location)}` : ""}</li>`).join("")}</ul>`
    : `<p>No eligible public ${meta.role === "grower" ? "grower" : "buyer"} profiles are available right now.</p>`;

  const locationLinks = (meta.locationLinks || []).map((link) => `<a href="${escapeHtml(link.path)}">${escapeHtml(link.name)}</a>`).join(" | ");
  return `      <main style="background:#f7fff4;color:#123;padding:32px;font-family:Arial,sans-serif;line-height:1.6">
        <h1>${escapeHtml(meta.h1)}</h1>
        <p>${escapeHtml(meta.introduction)}</p>
        ${meta.parentLink ? `<p><a href="${escapeHtml(meta.parentLink.path)}">${escapeHtml(meta.parentLink.name)}</a></p>` : ""}
        ${locationLinks ? `<nav aria-label="Public profile locations">${locationLinks}</nav>` : ""}
        <nav aria-label="${escapeHtml(meta.h1)} directory">${links}</nav>
      </main>`;
}

function replaceRootContent(html, fallbackHtml) {
  const openMatch = /<div\s+id=["']root["'][^>]*>/i.exec(html);
  if (!openMatch) {
    throw new Error("Could not find <div id=\"root\"> in build/index.html");
  }

  const contentStart = openMatch.index + openMatch[0].length;
  const tagRegex = /<\/?div\b[^>]*>/gi;
  tagRegex.lastIndex = contentStart;
  let depth = 1;
  let match;

  while ((match = tagRegex.exec(html))) {
    depth += match[0].startsWith("</") ? -1 : 1;
    if (depth === 0) {
      return `${html.slice(0, contentStart)}\n${fallbackHtml}\n    ${html.slice(match.index)}`;
    }
  }

  throw new Error("Could not find closing </div> for React root in build/index.html");
}

function outputPathForRoute(routePath) {
  const parts = routePath.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
  return path.join(buildDir, ...parts, "index.html");
}

function prerenderRoute(baseHtml, meta) {
  const withHead = replaceHeadTags(baseHtml, meta);
  const withFallback = replaceRootContent(withHead, renderFallback(meta));
  const outputPath = outputPathForRoute(meta.path);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, withFallback, "utf8");
  console.log(`prerender-seo: generated ${path.relative(buildDir, outputPath).replace(/\\/g, "/")}`);
}

function normalizePublicImage(value = "") {
  const image = String(value || "").trim().replace(/\\/g, "/");
  if (!image || /^(data:|blob:)/i.test(image)) return "";
  if (/^https?:\/\//i.test(image)) {
    try {
      return new URL(image).toString();
    } catch {
      return "";
    }
  }
  if (image.startsWith("/uploads/")) return `${API_BASE_URL}${image}`;
  if (image.startsWith("/")) return `${SITE_URL}${image}`;
  return "";
}

function getPublicProfileMeta(profile, role) {
  if (!profile || typeof profile !== "object" || !["grower", "buyer"].includes(role)) return null;
  const slug = String(profile.slug || "").trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.includes("..")) return null;

  const name = String(
    role === "grower"
      ? profile.orchardName || profile.companyName || ""
      : profile.businessName || profile.companyName || ""
  ).trim();
  if (!name) return null;

  const location = String(profile.mainLocation || "").trim();
  const roleLabel = role === "grower" ? "Fruit Grower" : "Fruit Buyer";
  const routePath = `/${role === "grower" ? "growers" : "buyers"}/${slug}`;
  const canonical = `${SITE_URL}${routePath}`;
  const title = `${name} – ${roleLabel}${location ? ` in ${location}` : ""} | eFruitMandi`;
  const description = role === "grower"
    ? `View ${name} on eFruitMandi. Explore its public grower profile, ${location ? "location, " : ""}available fruit lots and completed deals${location ? ` from ${location}` : ""}.`
    : `View ${name} on eFruitMandi. Explore its public buyer profile, ${location ? "location, " : ""}sourcing activity and completed fruit deals${location ? ` from ${location}` : ""}.`;
  const image = normalizePublicImage(
    profile.logoUrl || profile.profileImage || profile.profilePic || profile.avatar || profile.avatarUrl || profile.photoURL
  );
  const address = profile.district || profile.state
    ? {
        "@type": "PostalAddress",
        ...(profile.district ? { addressLocality: profile.district } : {}),
        ...(profile.state ? { addressRegion: profile.state } : {}),
      }
    : null;

  return {
    path: routePath,
    slug,
    role,
    name,
    location,
    title,
    description,
    image,
    businessSchema: {
      "@context": "https://schema.org",
      "@type": role === "grower" ? "LocalBusiness" : "Organization",
      name,
      url: canonical,
      description,
      ...(image ? { image } : {}),
      ...(address ? { address } : {}),
      ...(location ? { areaServed: location } : {}),
    },
    breadcrumbSchema: {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
        {
          "@type": "ListItem",
          position: 2,
          name: role === "grower" ? "Growers" : "Buyers",
          item: `${SITE_URL}/${role === "grower" ? "growers" : "buyers"}`,
        },
        { "@type": "ListItem", position: 3, name, item: canonical },
      ],
    },
  };
}

function prerenderPublicProfile(baseHtml, meta) {
  const withHead = replaceProfileHeadTags(baseHtml, meta);
  const withFallback = replaceRootContent(withHead, renderPublicProfileFallback(meta));
  const outputPath = outputPathForRoute(meta.path);
  const resolvedOutputPath = path.resolve(outputPath);
  const resolvedBuildDir = `${path.resolve(buildDir)}${path.sep}`;
  if (!resolvedOutputPath.startsWith(resolvedBuildDir)) {
    throw new Error("Unsafe public profile output path");
  }
  fs.mkdirSync(path.dirname(resolvedOutputPath), { recursive: true });
  fs.writeFileSync(resolvedOutputPath, withFallback, "utf8");
  console.log(`prerender-seo: generated ${path.relative(buildDir, resolvedOutputPath).replace(/\\/g, "/")}`);
}

function getPublicDirectoryEntry(profile, role) {
  if (!profile || typeof profile !== "object") return null;
  const name = String(
    role === "grower"
      ? profile.orchardName || profile.companyName || ""
      : profile.businessName || profile.companyName || profile.buyerContactPerson || ""
  ).trim();
  if (!name) return null;

  const slug = String(profile.slug || "").trim().toLowerCase();
  const id = String(profile._id || profile.id || profile.userId || "").trim();
  const hasSafeSlug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && !slug.includes("..");
  const path = hasSafeSlug
    ? `/${role === "grower" ? "growers" : "buyers"}/${slug}`
    : /^[a-f0-9]{24}$/i.test(id)
      ? `/profiles/${role}/${id}`
      : "";
  if (!path) return null;

  return { name, path, location: String(profile.mainLocation || "").trim() };
}

function getPublicDirectoryMeta(profiles, role) {
  const isGrower = role === "grower";
  const path = isGrower ? "/growers" : "/buyers";
  const h1 = isGrower ? "Fruit Growers and Orchards" : "Fruit Buyers and Traders";
  const title = isGrower
    ? "Fruit Growers and Orchards in India | eFruitMandi"
    : "Fruit Buyers and Traders in India | eFruitMandi";
  const description = isGrower
    ? "Discover public fruit growers, orchards and farms listed on eFruitMandi. Explore grower profiles, locations and available fruit lots across India."
    : "Discover public fruit buyers, traders and sourcing businesses listed on eFruitMandi. Explore buyer profiles and fruit sourcing activity across India.";
  const introduction = isGrower
    ? "Explore public orchard and grower profiles listed on eFruitMandi, including their public locations and marketplace activity."
    : "Explore public buyer, trader and sourcing-business profiles listed on eFruitMandi.";
  const seen = new Set();
  const entries = profiles.map((profile) => getPublicDirectoryEntry(profile, role)).filter((entry) => {
    if (!entry || seen.has(entry.path)) return false;
    seen.add(entry.path);
    return true;
  });
  const canonical = `${SITE_URL}${path}`;
  const schemas = [
    { "@context": "https://schema.org", "@type": "CollectionPage", name: h1, description, url: canonical },
    ...(entries.length
      ? [{
          "@context": "https://schema.org",
          "@type": "ItemList",
          itemListElement: entries.map((entry, index) => ({
            "@type": "ListItem",
            position: index + 1,
            url: `${SITE_URL}${entry.path}`,
            name: entry.name,
          })),
        }]
      : []),
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
        { "@type": "ListItem", position: 2, name: isGrower ? "Growers" : "Buyers", item: canonical },
      ],
    },
  ];

  return { path, role, h1, title, description, introduction, profiles: entries, schemas, noIndex: entries.length === 0, image: "" };
}

function prerenderPublicDirectory(baseHtml, profiles, role) {
  const meta = getPublicDirectoryMeta(profiles, role);
  prerenderPublicDirectoryMeta(baseHtml, meta);
}

function prerenderPublicDirectoryMeta(baseHtml, meta) {
  const withHead = replaceProfileHeadTags(baseHtml, meta);
  const withFallback = replaceRootContent(withHead, renderPublicDirectoryFallback(meta));
  const outputPath = outputPathForRoute(meta.path);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, withFallback, "utf8");
  console.log(`prerender-seo: generated ${path.relative(buildDir, outputPath).replace(/\\/g, "/")}`);
}

function slugifyPublicLocation(value = "") {
  return String(value || "").trim().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function getPublicLocationMetas(profiles, role) {
  const basePath = role === "grower" ? "/growers" : "/buyers";
  const roleHeading = role === "grower" ? "Fruit Growers and Orchards" : "Fruit Buyers and Traders";
  const states = new Map();
  profiles.forEach((profile) => {
    const stateName = String(profile.state || "").trim();
    const districtName = String(profile.district || "").trim();
    const stateSlug = slugifyPublicLocation(stateName);
    if (!stateSlug) return;
    const stateIdentity = stateName.toLocaleLowerCase("en-IN").replace(/\s+/g, " ");
    const state = states.get(stateSlug) || { name: stateName, identity: stateIdentity, slug: stateSlug, profiles: [], districts: new Map(), ambiguous: false };
    if (state.identity !== stateIdentity) state.ambiguous = true;
    state.profiles.push(profile);
    if (districtName) {
      const districtSlug = slugifyPublicLocation(districtName);
      if (districtSlug) {
        const districtIdentity = districtName.toLocaleLowerCase("en-IN").replace(/\s+/g, " ");
        const district = state.districts.get(districtSlug) || { name: districtName, identity: districtIdentity, slug: districtSlug, profiles: [], ambiguous: false };
        if (district.identity !== districtIdentity) district.ambiguous = true;
        district.profiles.push(profile);
        state.districts.set(districtSlug, district);
      }
    }
    states.set(stateSlug, state);
  });

  const metas = [];
  states.forEach((state) => {
    if (state.ambiguous || state.profiles.length < PUBLIC_LOCATION_MIN_PROFILES) return;
    const statePath = `${basePath}/state/${state.slug}`;
    const eligibleDistricts = Array.from(state.districts.values()).filter((district) => !district.ambiguous && district.profiles.length >= PUBLIC_LOCATION_MIN_PROFILES);
    metas.push(buildPublicLocationMeta(state.profiles, role, statePath, state.name, roleHeading, [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: role === "grower" ? "Growers" : "Buyers", item: `${SITE_URL}${basePath}` },
      { "@type": "ListItem", position: 3, name: state.name, item: `${SITE_URL}${statePath}` },
    ], eligibleDistricts.map((district) => ({ name: district.name, path: `${statePath}/district/${district.slug}` }))));

    eligibleDistricts.forEach((district) => {
      const districtPath = `${statePath}/district/${district.slug}`;
      metas.push(buildPublicLocationMeta(district.profiles, role, districtPath, `${district.name}, ${state.name}`, roleHeading, [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
        { "@type": "ListItem", position: 2, name: role === "grower" ? "Growers" : "Buyers", item: `${SITE_URL}${basePath}` },
        { "@type": "ListItem", position: 3, name: state.name, item: `${SITE_URL}${statePath}` },
        { "@type": "ListItem", position: 4, name: district.name, item: `${SITE_URL}${districtPath}` },
      ], [], { name: `View all profiles in ${state.name}`, path: statePath }));
    });
  });
  return metas;
}

function buildPublicLocationMeta(profiles, role, routePath, locationName, roleHeading, breadcrumbs, locationLinks = [], parentLink = null) {
  const entries = profiles.map((profile) => getPublicDirectoryEntry(profile, role)).filter(Boolean);
  const description = role === "grower"
    ? `Discover public fruit growers, orchards and farms listed on eFruitMandi in ${locationName}. Explore grower profiles, public locations and available fruit lots.`
    : `Discover public fruit buyers, traders and sourcing businesses listed on eFruitMandi in ${locationName}. Explore buyer profiles and fruit sourcing activity.`;
  const canonical = `${SITE_URL}${routePath}`;
  return {
    path: routePath, role, h1: `${roleHeading} in ${locationName}`, title: `${roleHeading} in ${locationName} | eFruitMandi`, description,
    introduction: description, profiles: entries, locationLinks, parentLink, image: "", noIndex: false,
    schemas: [
      { "@context": "https://schema.org", "@type": "CollectionPage", name: `${roleHeading} in ${locationName}`, description, url: canonical },
      { "@context": "https://schema.org", "@type": "ItemList", itemListElement: entries.map((entry, index) => ({ "@type": "ListItem", position: index + 1, name: entry.name, url: `${SITE_URL}${entry.path}` })) },
      { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: breadcrumbs },
    ],
  };
}

async function fetchPublicProfiles(role) {
  const endpoint = `${API_BASE_URL}/user/public-profiles?role=${role}&limit=all`;
  const response = await fetch(endpoint, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = await response.json();
  return Array.isArray(payload?.profiles) ? payload.profiles : [];
}

async function fetchPublicFruitDiscovery() {
  const response = await fetch(`${API_BASE_URL}/user/public-fruit-discovery`, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function getFruitPrerenderMetas(discovery) {
  const metas = [];
  const makeMeta = (path, h1, description, links) => ({
    path, h1, title: `${h1} | eFruitMandi`, description, introduction: description, image: "", noIndex: false,
    profiles: links.map((link) => ({ name: link.name, path: link.path, location: "" })),
    schemas: [
      { "@context": "https://schema.org", "@type": "CollectionPage", name: h1, description, url: `${SITE_URL}${path}` },
      { "@context": "https://schema.org", "@type": "ItemList", itemListElement: links.map((link, index) => ({ "@type": "ListItem", position: index + 1, name: link.name, url: `${SITE_URL}${link.path}` })) },
      { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` }, { "@type": "ListItem", position: 2, name: "Fruits", item: `${SITE_URL}/fruits` }] },
    ],
  });
  const fruits = Array.isArray(discovery?.fruits) ? discovery.fruits : [];
  if (fruits.length) metas.push(makeMeta("/fruits", "Fruits Traded on eFruitMandi", "Explore fruits publicly listed on eFruitMandi. Discover fruit lots, eligible growers, orchards, buyers and traders across India.", fruits.map((fruit) => ({ name: fruit.name, path: `/fruits/${fruit.slug}` }))));
  fruits.forEach((fruit) => {
    if (fruit.lotCount >= 1) metas.push(makeMeta(`/fruits/${fruit.slug}`, `${fruit.name} on eFruitMandi`, `Explore public ${fruit.name} growers, buyers and fruit lots on eFruitMandi.`, []));
    [["grower", "Growers and Orchards"], ["buyer", "Buyers and Traders"]].forEach(([role, label]) => {
      const profiles = fruit[`${role}s`] || [];
      if (profiles.length >= 2) metas.push(makeMeta(`/fruits/${fruit.slug}/${role}s`, `${fruit.name} ${label}`, `Explore eligible public ${fruit.name} ${role}s on eFruitMandi.`, profiles.map((profile) => ({ name: profile.companyName, path: getPublicDirectoryEntry(profile, role)?.path })).filter((item) => item.path)));
      const locationGroups = new Map();
      profiles.forEach((profile) => {
        const stateSlug = slugifyPublicLocation(profile.state);
        const districtSlug = slugifyPublicLocation(profile.district);
        if (!stateSlug) return;
        const statePath = `/fruits/${fruit.slug}/${role}s/state/${stateSlug}`;
        const state = locationGroups.get(statePath) || { name: profile.state, profiles: [] };
        state.profiles.push(profile); locationGroups.set(statePath, state);
        if (districtSlug) {
          const districtPath = `${statePath}/district/${districtSlug}`;
          const district = locationGroups.get(districtPath) || { name: `${profile.district}, ${profile.state}`, profiles: [] };
          district.profiles.push(profile); locationGroups.set(districtPath, district);
        }
      });
      locationGroups.forEach((group, routePath) => {
        if (group.profiles.length >= 2) metas.push(makeMeta(routePath, `${fruit.name} ${label} in ${group.name}`, `Explore eligible public ${fruit.name} ${role}s in ${group.name} on eFruitMandi.`, group.profiles.map((profile) => ({ name: profile.companyName, path: getPublicDirectoryEntry(profile, role)?.path })).filter((item) => item.path)));
      });
    });
    (fruit.varieties || []).forEach((variety) => {
      if (variety.lotCount >= 2) metas.push(makeMeta(`/fruits/${fruit.slug}/varieties/${variety.slug}`, `${variety.name} ${fruit.name}`, `Explore public ${variety.name} ${fruit.name} marketplace activity on eFruitMandi.`, []));
      [["grower", "Growers"], ["buyer", "Buyers"]].forEach(([role, label]) => {
        const profiles = variety[`${role}s`] || [];
        if (profiles.length >= 2) metas.push(makeMeta(`/fruits/${fruit.slug}/varieties/${variety.slug}/${role}s`, `${variety.name} ${fruit.name} ${label}`, `Explore eligible public ${variety.name} ${fruit.name} ${role}s on eFruitMandi.`, profiles.map((profile) => ({ name: profile.companyName, path: getPublicDirectoryEntry(profile, role)?.path })).filter((item) => item.path)));
      });
    });
  });
  return metas;
}

async function prerenderPublicProfiles(baseHtml) {
  const writtenRoutes = new Set();
  for (const role of ["grower", "buyer"]) {
    let profiles;
    try {
      profiles = await fetchPublicProfiles(role);
    } catch (error) {
      console.warn(`prerender-seo: skipped ${role} profiles (${error.message || "public API unavailable"})`);
      continue;
    }

    try {
      prerenderPublicDirectory(baseHtml, profiles, role);
    } catch (error) {
      console.warn(`prerender-seo: skipped /${role === "grower" ? "growers" : "buyers"} (${error.message || "write failed"})`);
    }

    getPublicLocationMetas(profiles, role).forEach((meta) => {
      try {
        prerenderPublicDirectoryMeta(baseHtml, meta);
      } catch (error) {
        console.warn(`prerender-seo: skipped ${meta.path} (${error.message || "write failed"})`);
      }
    });

    for (const profile of profiles) {
      const meta = getPublicProfileMeta(profile, role);
      if (!meta) {
        console.warn(`prerender-seo: skipped invalid ${role} profile`);
        continue;
      }
      if (writtenRoutes.has(meta.path)) {
        console.warn(`prerender-seo: skipped duplicate route ${meta.path}`);
        continue;
      }

      try {
        prerenderPublicProfile(baseHtml, meta);
        writtenRoutes.add(meta.path);
      } catch (error) {
        console.warn(`prerender-seo: skipped ${meta.path} (${error.message || "write failed"})`);
      }
    }
  }
  try {
    const discovery = await fetchPublicFruitDiscovery();
    getFruitPrerenderMetas(discovery).forEach((meta) => {
      try { prerenderPublicDirectoryMeta(baseHtml, meta); }
      catch (error) { console.warn(`prerender-seo: skipped ${meta.path} (${error.message || "write failed"})`); }
    });
  } catch (error) {
    console.warn(`prerender-seo: fruit pages skipped (${error.message || "public API unavailable"})`);
  }
}

if (!fs.existsSync(indexPath)) {
  throw new Error(`Missing ${indexPath}. Run vite build before prerender-seo.`);
}

const baseHtml = fs.readFileSync(indexPath, "utf8");
routes.forEach((route) => prerenderRoute(baseHtml, route));
prerenderPublicProfiles(baseHtml).catch((error) => {
  console.warn(`prerender-seo: public profile generation skipped (${error.message || "unexpected error"})`);
});
