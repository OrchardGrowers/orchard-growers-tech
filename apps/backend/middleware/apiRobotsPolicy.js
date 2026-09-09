export const apiRobotsPolicy = (req, res, next) => {
  // This Express app serves the API host. The website sitemap is proxied through it.
  if (req.path !== "/sitemap.xml") res.setHeader("X-Robots-Tag", "noindex, nofollow");
  if (req.path === "/robots.txt" && ["GET", "HEAD"].includes(req.method)) {
    return res.type("text/plain").send("User-agent: *\nDisallow: /\n");
  }
  next();
};
