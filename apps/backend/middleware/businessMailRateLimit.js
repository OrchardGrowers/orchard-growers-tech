const adminBuckets = new Map();
let globalAttempts = [];

const positiveNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const getDefaults = () => ({
  adminWindowMs: positiveNumber(process.env.BUSINESS_MAIL_ADMIN_WINDOW_MS, 10 * 60 * 1000),
  adminMax: positiveNumber(process.env.BUSINESS_MAIL_ADMIN_MAX_SENDS, 10),
  dailyWindowMs: positiveNumber(process.env.BUSINESS_MAIL_ADMIN_DAILY_WINDOW_MS, 24 * 60 * 60 * 1000),
  dailyMax: positiveNumber(process.env.BUSINESS_MAIL_ADMIN_DAILY_MAX, 50),
  globalWindowMs: positiveNumber(process.env.BUSINESS_MAIL_GLOBAL_WINDOW_MS, 60 * 60 * 1000),
  globalMax: positiveNumber(process.env.BUSINESS_MAIL_GLOBAL_MAX_SENDS, 100),
});

const trimWindow = (timestamps, now, windowMs) => timestamps.filter((timestamp) => now - timestamp < windowMs);

const rejectRateLimit = (res, retryAfterMs) => {
  res.set("Retry-After", String(Math.max(1, Math.ceil(retryAfterMs / 1000))));
  return res.status(429).json({
    code: "BUSINESS_MAIL_RATE_LIMITED",
    msg: "Business Mail send rate limit reached. Please try again later.",
  });
};

export const createBusinessMailSendRateLimit = (overrides = {}) => {
  const settings = { ...getDefaults(), ...overrides };

  return (req, res, next) => {
    const adminId = String(req.admin?._id || req.admin?.id || req.user?.id || "").trim();
    if (!adminId) return res.status(401).json({ msg: "Admin authentication required" });

    const now = Date.now();
    const existing = adminBuckets.get(adminId) || [];
    const dailyAttempts = trimWindow(existing, now, settings.dailyWindowMs);
    const shortAttempts = trimWindow(dailyAttempts, now, settings.adminWindowMs);
    globalAttempts = trimWindow(globalAttempts, now, settings.globalWindowMs);

    if (shortAttempts.length >= settings.adminMax) {
      return rejectRateLimit(res, settings.adminWindowMs - (now - shortAttempts[0]));
    }
    if (dailyAttempts.length >= settings.dailyMax) {
      return rejectRateLimit(res, settings.dailyWindowMs - (now - dailyAttempts[0]));
    }
    if (globalAttempts.length >= settings.globalMax) {
      return rejectRateLimit(res, settings.globalWindowMs - (now - globalAttempts[0]));
    }

    adminBuckets.set(adminId, [...dailyAttempts, now]);
    globalAttempts.push(now);
    return next();
  };
};

export const businessMailSendRateLimit = createBusinessMailSendRateLimit();

export const resetBusinessMailRateLimitsForTests = () => {
  adminBuckets.clear();
  globalAttempts = [];
};

