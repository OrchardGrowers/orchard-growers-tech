import express from "express";
import User from "../models/User.js";
import { buildPublicFruitDiscovery } from "../controllers/userController.js";

const router = express.Router();

const SITE_URL = "https://www.efruitmandi.live";
const PUBLIC_LOCATION_MIN_PROFILES = 2;

function escapeXml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatDate(date) {
  if (!date) return new Date().toISOString();
  return new Date(date).toISOString();
}

function hasSafePublicSlug(slug = "") {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(slug || ""));
}

const CURATED_FRUIT_LOT_SLUGS = [...new Set([
  "apple",
  "pear",
  "persimmon",
  "plum",
  "peach",
  "apricot",
  "cherry",
  "kiwi",
  "pomegranate",
  "mango",
  "banana",
  "orange",
  "kinnow",
  "guava",
  "grapes",
  "papaya",
  "watermelon",
  "muskmelon",
  "pineapple",
  "litchi",
  "strawberry",
  "dragonfruit",
  "fig",
  "jamun",
  "custardapple",
  "sapota",
  "amla",
].filter(hasSafePublicSlug))];

function slugifyPublicLocation(value = "") {
  return String(value || "").trim().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function getPublicLocationUrls(profiles, role) {
  const groups = new Map();
  profiles.forEach((profile) => {
    const location = profile.kycByRole?.[role] || {};
    const stateSlug = slugifyPublicLocation(location.state);
    const districtSlug = slugifyPublicLocation(location.district);
    if (!stateSlug) return;
    const stateIdentity = String(location.state || "").trim().toLocaleLowerCase("en-IN").replace(/\s+/g, " ");
    const statePath = `/${role === "grower" ? "growers" : "buyers"}/state/${stateSlug}`;
    const state = groups.get(statePath) || { path: statePath, identity: stateIdentity, count: 0, lastmod: profile.updatedAt || profile.createdAt, ambiguous: false };
    if (state.identity !== stateIdentity) state.ambiguous = true;
    state.count += 1;
    groups.set(statePath, state);
    if (districtSlug) {
      const districtIdentity = String(location.district || "").trim().toLocaleLowerCase("en-IN").replace(/\s+/g, " ");
      const districtPath = `${statePath}/district/${districtSlug}`;
      const district = groups.get(districtPath) || { path: districtPath, identity: districtIdentity, count: 0, lastmod: profile.updatedAt || profile.createdAt, ambiguous: false };
      if (district.identity !== districtIdentity) district.ambiguous = true;
      district.count += 1;
      groups.set(districtPath, district);
    }
  });
  return Array.from(groups.values()).filter((group) => !group.ambiguous && group.count >= PUBLIC_LOCATION_MIN_PROFILES);
}

function getPublicProfileIdentityQuery(role) {
  if (role === "grower") {
    return { orchardName: { $type: "string", $regex: /\S/ } };
  }

  if (role === "buyer") {
    return {
      $or: [
        { businessName: { $type: "string", $regex: /\S/ } },
        { buyerContactPerson: { $type: "string", $regex: /\S/ } },
      ],
    };
  }

  return null;
}

function buildPublicProfileSitemapQuery(role) {
  const identityQuery = getPublicProfileIdentityQuery(role);

  return {
    $and: [
      { $or: [{ accountStatus: "ACTIVE" }, { accountStatus: { $exists: false } }] },
      { publicProfileRoles: role },
      { $or: [{ role }, { activeRole: role }, { profileTypes: role }] },
      ...(identityQuery ? [identityQuery] : []),
    ],
  };
}

router.get("/sitemap.xml", async (req, res) => {
  try {
    const staticUrls = [
      { loc: "/", changefreq: "daily", priority: "1.0" },
      { loc: "/auctions", changefreq: "hourly", priority: "0.9" },
      { loc: "/growers", changefreq: "daily", priority: "0.8" },
      { loc: "/buyers", changefreq: "daily", priority: "0.8" },
      { loc: "/fruits", changefreq: "daily", priority: "0.8" },
      { loc: "/about", changefreq: "monthly", priority: "0.7" },
      { loc: "/our-story", changefreq: "monthly", priority: "0.6" },
      { loc: "/vision-mission", changefreq: "monthly", priority: "0.6" },
      { loc: "/why-efruitmandi", changefreq: "monthly", priority: "0.7" },
      { loc: "/contact", changefreq: "monthly", priority: "0.7" },
      { loc: "/faqs", changefreq: "weekly", priority: "0.7" },
      { loc: "/buyer-guide", changefreq: "monthly", priority: "0.7" },
      { loc: "/grower-guide", changefreq: "monthly", priority: "0.7" },
      { loc: "/logistics-partner-guide", changefreq: "monthly", priority: "0.6" },
      { loc: "/blog", changefreq: "weekly", priority: "0.7" },
      { loc: "/blog/market-price/apple", changefreq: "daily", priority: "0.7" },
      { loc: "/privacy-policy", changefreq: "monthly", priority: "0.5" },
      { loc: "/terms-of-service", changefreq: "monthly", priority: "0.5" },
      { loc: "/refund-cancellation-policy", changefreq: "monthly", priority: "0.5" },
      { loc: "/payment-escrow-policy", changefreq: "monthly", priority: "0.5" },
      { loc: "/kyc-verification-policy", changefreq: "monthly", priority: "0.5" },
      { loc: "/og-verified-policy", changefreq: "monthly", priority: "0.5" },
      { loc: "/commission-fee-policy", changefreq: "monthly", priority: "0.5" },
      { loc: "/shipping-logistics-policy", changefreq: "monthly", priority: "0.5" },
      { loc: "/community-guidelines", changefreq: "monthly", priority: "0.5" },
      { loc: "/fruit-grading-packing-guidelines", changefreq: "monthly", priority: "0.6" },
      { loc: "/report-problem", changefreq: "monthly", priority: "0.5" },
      { loc: "/user-data-deletion", changefreq: "monthly", priority: "0.4" },

      // Fruit lot SEO pages
      ...CURATED_FRUIT_LOT_SLUGS.map((slug) => ({
        loc: `/fruit-lots/${slug}`,
        changefreq: "weekly",
        priority: "0.8",
      })),

      // Mandi rate SEO pages
      { loc: "/mandi-rates", changefreq: "daily", priority: "0.8" },
      { loc: "/mandi-rates/apple", changefreq: "daily", priority: "0.8" },
      { loc: "/mandi-rates/mango", changefreq: "daily", priority: "0.8" },
      { loc: "/mandi-rates/pear", changefreq: "daily", priority: "0.8" },
    ];

    const [growerProfiles, buyerProfiles] = await Promise.all([
      User.find(buildPublicProfileSitemapQuery("grower"))
        .select("_id slug kycByRole updatedAt createdAt")
        .sort({ updatedAt: -1 })
        .limit(5000)
        .lean(),
      User.find(buildPublicProfileSitemapQuery("buyer"))
        .select("_id slug kycByRole updatedAt createdAt")
        .sort({ updatedAt: -1 })
        .limit(5000)
        .lean(),
    ]);

    const locationUrls = [
      ...getPublicLocationUrls(growerProfiles, "grower"),
      ...getPublicLocationUrls(buyerProfiles, "buyer"),
    ];
    const fruitDiscovery = await buildPublicFruitDiscovery().catch(() => ({ fruits: [] }));
    const fruitUrls = [];
    fruitDiscovery.fruits.forEach((fruit) => {
      if (fruit.lotCount >= 1) fruitUrls.push(`/fruits/${fruit.slug}`);
      if (fruit.growerCount >= 2) fruitUrls.push(`/fruits/${fruit.slug}/growers`);
      if (fruit.buyerCount >= 2) fruitUrls.push(`/fruits/${fruit.slug}/buyers`);
      [["grower", fruit.growers], ["buyer", fruit.buyers]].forEach(([role, profiles]) => {
        const stateGroups = new Map();
        profiles.forEach((profile) => {
          const stateSlug = slugifyPublicLocation(profile.state);
          const districtSlug = slugifyPublicLocation(profile.district);
          if (!stateSlug) return;
          const statePath = `/fruits/${fruit.slug}/${role}s/state/${stateSlug}`;
          stateGroups.set(statePath, (stateGroups.get(statePath) || 0) + 1);
          if (districtSlug) {
            const districtPath = `${statePath}/district/${districtSlug}`;
            stateGroups.set(districtPath, (stateGroups.get(districtPath) || 0) + 1);
          }
        });
        stateGroups.forEach((count, routePath) => { if (count >= PUBLIC_LOCATION_MIN_PROFILES) fruitUrls.push(routePath); });
      });
      fruit.varieties.forEach((variety) => {
        if (variety.lotCount >= 2) fruitUrls.push(`/fruits/${fruit.slug}/varieties/${variety.slug}`);
        if (variety.growerCount >= 2) fruitUrls.push(`/fruits/${fruit.slug}/varieties/${variety.slug}/growers`);
        if (variety.buyerCount >= 2) fruitUrls.push(`/fruits/${fruit.slug}/varieties/${variety.slug}/buyers`);
      });
    });
    const urls = [
      ...staticUrls.map((page) => ({
        loc: `${SITE_URL}${page.loc}`,
        lastmod: new Date().toISOString(),
        changefreq: page.changefreq,
        priority: page.priority,
      })),
      ...growerProfiles
        .filter((profile) => hasSafePublicSlug(profile.slug))
        .map((profile) => ({
          loc: `${SITE_URL}/growers/${profile.slug}`,
          lastmod: formatDate(profile.updatedAt || profile.createdAt),
          changefreq: "weekly",
          priority: "0.7",
        })),
      ...buyerProfiles
        .filter((profile) => hasSafePublicSlug(profile.slug))
        .map((profile) => ({
          loc: `${SITE_URL}/buyers/${profile.slug}`,
          lastmod: formatDate(profile.updatedAt || profile.createdAt),
          changefreq: "weekly",
          priority: "0.7",
        })),
      ...locationUrls.map((location) => ({
        loc: `${SITE_URL}${location.path}`,
        lastmod: formatDate(location.lastmod),
        changefreq: "weekly",
        priority: "0.6",
      })),
      ...[...new Set(fruitUrls)].map((fruitPath) => ({
        loc: `${SITE_URL}${fruitPath}`,
        lastmod: new Date().toISOString(),
        changefreq: "weekly",
        priority: "0.6",
      })),
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) => `  <url>
    <loc>${escapeXml(url.loc)}</loc>
    <lastmod>${escapeXml(url.lastmod)}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>`;

    res.header("Content-Type", "application/xml");
    res.send(xml);
  } catch (error) {
    res.status(500).type("text/plain").send("Unable to generate sitemap");
  }
});

export default router;
