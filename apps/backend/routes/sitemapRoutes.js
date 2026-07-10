import express from "express";
import Product from "../models/Product.js";
import User from "../models/User.js";

const router = express.Router();

const SITE_URL = "https://www.efruitmandi.live";

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

function buildPublicProfileSitemapQuery(role) {
  const roleClauses = [
    { role },
    { activeRole: role },
    { profileTypes: role },
  ];

  if (role === "grower") {
    roleClauses.push({ orchardName: { $exists: true, $ne: "" } });
  }

  if (role === "buyer") {
    roleClauses.push(
      { businessName: { $exists: true, $ne: "" } },
      { buyerContactPerson: { $exists: true, $ne: "" } }
    );
  }

  return {
    $and: [
      { $or: [{ accountStatus: "ACTIVE" }, { accountStatus: { $exists: false } }] },
      { publicProfileRoles: role },
      { $or: roleClauses },
    ],
  };
}

router.get("/sitemap.xml", async (req, res) => {
  try {
    const staticUrls = [
      { loc: "/", changefreq: "daily", priority: "1.0" },
      { loc: "/auctions", changefreq: "hourly", priority: "0.9" },
      { loc: "/about", changefreq: "monthly", priority: "0.7" },
      { loc: "/our-story", changefreq: "monthly", priority: "0.6" },
      { loc: "/vision-mission", changefreq: "monthly", priority: "0.6" },
      { loc: "/why-efruitmandi", changefreq: "monthly", priority: "0.7" },
      { loc: "/contact", changefreq: "monthly", priority: "0.7" },
      { loc: "/faqs", changefreq: "weekly", priority: "0.7" },
      { loc: "/buyer-guide", changefreq: "monthly", priority: "0.7" },
      { loc: "/grower-guide", changefreq: "monthly", priority: "0.7" },
      { loc: "/logistics-partner-guide", changefreq: "monthly", priority: "0.6" },
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
      { loc: "/fruit-lots/apple", changefreq: "weekly", priority: "0.8" },
      { loc: "/fruit-lots/pear", changefreq: "weekly", priority: "0.8" },
      { loc: "/fruit-lots/persimmon", changefreq: "weekly", priority: "0.8" },
      { loc: "/fruit-lots/plum", changefreq: "weekly", priority: "0.8" },
      { loc: "/fruit-lots/mango", changefreq: "weekly", priority: "0.8" },

      // Mandi rate SEO pages
      { loc: "/mandi-rates", changefreq: "daily", priority: "0.8" },
      { loc: "/mandi-rates/apple", changefreq: "daily", priority: "0.8" },
      { loc: "/mandi-rates/mango", changefreq: "daily", priority: "0.8" },
      { loc: "/mandi-rates/pear", changefreq: "daily", priority: "0.8" },
    ];

    const products = await Product.find({
      active: true,
      status: { $in: ["AVAILABLE", "IN_AUCTION"] },
    })
      .select("_id slug updatedAt createdAt")
      .sort({ updatedAt: -1 })
      .limit(5000)
      .lean();

    const [growerProfiles, buyerProfiles] = await Promise.all([
      User.find(buildPublicProfileSitemapQuery("grower"))
        .select("_id updatedAt createdAt")
        .sort({ updatedAt: -1 })
        .limit(5000)
        .lean(),
      User.find(buildPublicProfileSitemapQuery("buyer"))
        .select("_id updatedAt createdAt")
        .sort({ updatedAt: -1 })
        .limit(5000)
        .lean(),
    ]);

    const urls = [
      ...staticUrls.map((page) => ({
        loc: `${SITE_URL}${page.loc}`,
        lastmod: new Date().toISOString(),
        changefreq: page.changefreq,
        priority: page.priority,
      })),
      ...products.map((product) => ({
        loc: `${SITE_URL}/lots/${product._id}`,
        lastmod: formatDate(product.updatedAt || product.createdAt),
        changefreq: "daily",
        priority: "0.9",
      })),
      ...growerProfiles.map((profile) => ({
        loc: `${SITE_URL}/profiles/grower/${profile._id}`,
        lastmod: formatDate(profile.updatedAt || profile.createdAt),
        changefreq: "weekly",
        priority: "0.7",
      })),
      ...buyerProfiles.map((profile) => ({
        loc: `${SITE_URL}/profiles/buyer/${profile._id}`,
        lastmod: formatDate(profile.updatedAt || profile.createdAt),
        changefreq: "weekly",
        priority: "0.7",
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
