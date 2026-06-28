import express from "express";
import {
  buildProfileRssXml,
  getVisibleProfilePublications,
} from "../services/profilePublicationService.js";

const router = express.Router();

const servePublicProfileFeed = async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const publications = await getVisibleProfilePublications({ limit });
    const protocol = req.get("x-forwarded-proto")?.split(",")[0]?.trim() || req.protocol;
    const feedUrl = `${protocol}://${req.get("host")}${req.baseUrl}${req.path}`;
    const xml = buildProfileRssXml(publications, { feedUrl });

    res.set({
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
      "X-Content-Type-Options": "nosniff",
    });
    return res.send(xml);
  } catch (error) {
    return next(error);
  }
};

router.get("/rss/public-profiles.xml", servePublicProfileFeed);
router.get("/api/rss/public-profiles.xml", servePublicProfileFeed);

export default router;
