import express from "express";
import User from "../models/User.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import {
  buildPublicFruitDiscovery,
  buildPublicProfileQuery,
} from "../controllers/userController.js";
import { FRUIT_ENTITIES } from "../../../packages/shared-config/fruitSearch.mjs";
import { getAvailableMandiFruitSlugs } from "../services/mandiRateService.js";
import { canAccessLotDetail } from "../services/publicLotAccessService.js";
import { isOrderCompletedForMarketplace } from "../services/dealLifecycleService.js";

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
  if (!date) return "";
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

function hasSafePublicSlug(slug = "") {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(slug || ""));
}

const CURATED_FRUIT_LOT_SLUGS = [
  ...new Set(FRUIT_ENTITIES.map((fruit) => fruit.slug).filter(hasSafePublicSlug)),
];

export function buildMandiRateSitemapEntries(availableSlugs = []) {
  const safeSlugs = [...new Set(
    (Array.isArray(availableSlugs) ? availableSlugs : []).filter(hasSafePublicSlug)
  )];
  return [
    { loc: "/mandi-rates", changefreq: "daily", priority: "0.8" },
    ...safeSlugs.map((slug) => ({
      loc: `/mandi-rates/${slug}`,
      changefreq: "daily",
      priority: "0.8",
    })),
  ];
}

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

export function buildDataDependentDirectorySitemapEntries({ buyerProfiles = [], fruitDiscovery = {} } = {}) {
  const entries = [];
  if (Array.isArray(buyerProfiles) && buyerProfiles.length > 0) {
    entries.push({ loc: "/buyers", changefreq: "daily", priority: "0.8" });
  }
  if (Array.isArray(fruitDiscovery?.fruits) && fruitDiscovery.fruits.length > 0) {
    entries.push({ loc: "/fruits", changefreq: "daily", priority: "0.8" });
  }
  return entries;
}

router.get("/sitemap.xml", async (req, res) => {
  try {
    const staticUrls = [
      { loc: "/", changefreq: "daily", priority: "1.0" },
      { loc: "/auctions", changefreq: "hourly", priority: "0.9" },
      { loc: "/growers", changefreq: "daily", priority: "0.8" },
      { loc: "/about", changefreq: "monthly", priority: "0.7" },
      { loc: "/our-story", changefreq: "monthly", priority: "0.6" },
      { loc: "/vision-mission", changefreq: "monthly", priority: "0.6" },
      { loc: "/why-efruitmandi", changefreq: "monthly", priority: "0.7" },
      { loc: "/contact-us", changefreq: "monthly", priority: "0.7" },
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
      ...buildMandiRateSitemapEntries(),
    ];

    const [growerProfiles, buyerProfiles, availableMandiSlugs, publicLotCandidates] = await Promise.all([
      User.find(buildPublicProfileQuery("grower"))
        .select("_id slug kycByRole updatedAt createdAt")
        .sort({ updatedAt: -1 })
        .limit(5000)
        .lean(),
      User.find(buildPublicProfileQuery("buyer"))
        .select("_id slug kycByRole updatedAt createdAt")
        .sort({ updatedAt: -1 })
        .limit(5000)
        .lean(),
      getAvailableMandiFruitSlugs().catch((error) => {
        console.error("Mandi sitemap availability query error:", error);
        return [];
      }),
      Product.find({
        active: { $ne: false },
        inventoryType: { $ne: "raw_material" },
        $or: [{ createdSource: "grower" }, { "gradeLots.0": { $exists: true } }],
      })
        .select("_id createdSource inventoryType status active auctionEndTime endTime updatedAt createdAt")
        .sort({ updatedAt: -1, createdAt: -1 })
        .limit(5000)
        .lean(),
    ]);
    staticUrls.push(...buildMandiRateSitemapEntries(availableMandiSlugs).slice(1));

    const publicLotIds = publicLotCandidates.map((lot) => lot._id).filter(Boolean);
    const lotOrders = publicLotIds.length
      ? await Order.find({ product: { $in: publicLotIds } })
          .select("_id product paymentStatus deliveryStatus updatedAt")
          .sort({ updatedAt: -1 })
          .lean()
      : [];
    const completedOrderByProduct = lotOrders.reduce((map, order) => {
      const key = String(order.product || "");
      if (key && !map.has(key) && isOrderCompletedForMarketplace(order)) map.set(key, order);
      return map;
    }, new Map());
    const publicLots = publicLotCandidates.filter((lot) =>
      canAccessLotDetail({
        product: lot,
        platform: "efruitmandi",
        completedOrder: completedOrderByProduct.get(String(lot._id)) || null,
      })
    );

    const locationUrls = [
      ...getPublicLocationUrls(growerProfiles, "grower"),
      ...getPublicLocationUrls(buyerProfiles, "buyer"),
    ];
    const fruitDiscovery = await buildPublicFruitDiscovery().catch(() => ({ fruits: [] }));
    staticUrls.push(...buildDataDependentDirectorySitemapEntries({ buyerProfiles, fruitDiscovery }));
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
        changefreq: page.changefreq,
        priority: page.priority,
      })),
      ...publicLots.map((lot) => ({
        loc: `${SITE_URL}/lots/${lot._id}`,
        lastmod: formatDate(lot.updatedAt || lot.createdAt),
        changefreq: "daily",
        priority: "0.8",
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
${url.lastmod ? `    <lastmod>${escapeXml(url.lastmod)}</lastmod>\n` : ""}    <changefreq>${url.changefreq}</changefreq>
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
