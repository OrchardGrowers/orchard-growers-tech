const buckets = new Map();

const getClientKey = (req) =>
  String(req.ip || req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0].trim();

export const createRateLimiter = ({
  windowMs = 15 * 60 * 1000,
  max = 5,
  keyPrefix = "rate",
  message = "Too many requests. Please try again later.",
} = {}) => {
  return (req, res, next) => {
    const now = Date.now();
    const key = `${keyPrefix}:${getClientKey(req)}:${String(req.body?.identifier || req.body?.email || "").trim().toLowerCase()}`;
    const entry = buckets.get(key);

    if (!entry || entry.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (entry.count >= max) {
      res.set("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({ msg: message });
    }

    entry.count += 1;
    buckets.set(key, entry);
    return next();
  };
};
