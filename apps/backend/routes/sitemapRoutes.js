import express from "express";
import Product from "../models/Product.js";

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

router.get("/sitemap.xml", async (req, res) => {
  try {
    const staticUrls = [
      { loc: "/", changefreq: "daily", priority: "1.0" },
      { loc: "/auctions", changefreq: "hourly", priority: "0.9" },
      { loc: "/search", changefreq: "daily", priority: "0.9" },
      { loc: "/register-grower", changefreq: "weekly", priority: "0.8" },
      { loc: "/register-buyer", changefreq: "weekly", priority: "0.8" },
      { loc: "/get-verified", changefreq: "weekly", priority: "0.8" },
    ];

    const products = await Product.find({
      active: true,
      status: { $in: ["AVAILABLE", "IN_AUCTION"] },
    })
      .select("_id slug updatedAt createdAt")
      .sort({ updatedAt: -1 })
      .limit(5000)
      .lean();

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