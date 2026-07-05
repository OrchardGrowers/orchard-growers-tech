const DEFAULT_MARKET_TIME_ZONE = "Asia/Kolkata";
const DEFAULT_DEAL_OPEN_HOUR = 9;
const DEFAULT_DEAL_CLOSE_HOUR = 16;

export const COMPLETED_PAYMENT_STATUSES = new Set(["ESCROW", "PAID", "RELEASED"]);
export const COMPLETED_DELIVERY_STATUSES = new Set(["DELIVERED"]);
export const TERMINAL_INCOMPLETE_AUCTION_STATUSES = new Set(["EXPIRED", "CANCELLED"]);
export const HIDDEN_LOT_STATUSES = new Set(["EXPIRED", "CANCELLED", "DELETED"]);
export const COMPLETION_REQUIRED_LOT_STATUSES = new Set(["SOLD", "QUOTE_ACCEPTED", "DEAL_CONFIRMED"]);

const toInt = (value, fallback) => {
  const number = Number(value);
  return Number.isInteger(number) ? number : fallback;
};

const normalizeStatus = (value = "") => String(value || "").trim().toUpperCase();

const toTime = (value) => {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
};

const hasPassedEndTime = (value, now = new Date()) => {
  const endTime = toTime(value);
  return Boolean(endTime && endTime <= now.getTime());
};

export const getDealMarketTimeZone = () =>
  process.env.DEAL_MARKET_TIME_ZONE ||
  process.env.MARKET_TIME_ZONE ||
  process.env.TZ ||
  DEFAULT_MARKET_TIME_ZONE;

export const getDealOpenHour = () =>
  Math.min(Math.max(toInt(process.env.DEAL_OPEN_HOUR, DEFAULT_DEAL_OPEN_HOUR), 0), 23);

export const getDealCloseHour = () =>
  Math.min(Math.max(toInt(process.env.DEAL_CLOSE_HOUR, DEFAULT_DEAL_CLOSE_HOUR), getDealOpenHour() + 1), 24);

const getZonedParts = (date = new Date(), timeZone = getDealMarketTimeZone()) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  return Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  );
};

const zonedTimeToUtc = (
  { year, month, day, hour = 0, minute = 0, second = 0 },
  timeZone = getDealMarketTimeZone()
) => {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second);
  const zonedAtGuess = getZonedParts(new Date(utcGuess), timeZone);
  const desiredAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const guessedAsUtc = Date.UTC(
    zonedAtGuess.year,
    zonedAtGuess.month - 1,
    zonedAtGuess.day,
    zonedAtGuess.hour,
    zonedAtGuess.minute,
    zonedAtGuess.second
  );

  return new Date(utcGuess + desiredAsUtc - guessedAsUtc);
};

const getWindowForZonedDate = (parts, timeZone = getDealMarketTimeZone()) => ({
  openAt: zonedTimeToUtc(
    { year: parts.year, month: parts.month, day: parts.day, hour: getDealOpenHour() },
    timeZone
  ),
  closeAt: zonedTimeToUtc(
    { year: parts.year, month: parts.month, day: parts.day, hour: getDealCloseHour() },
    timeZone
  ),
});

export const resolveDealSchedule = (requestedAt = new Date(), timeZone = getDealMarketTimeZone()) => {
  const requestedDate = requestedAt instanceof Date ? requestedAt : new Date(requestedAt);
  const now = Number.isNaN(requestedDate.getTime()) ? new Date() : requestedDate;
  const parts = getZonedParts(now, timeZone);
  const todayWindow = getWindowForZonedDate(parts, timeZone);

  if (now < todayWindow.openAt) {
    return {
      timeZone,
      startTime: todayWindow.openAt,
      endTime: todayWindow.closeAt,
      isLiveNow: false,
    };
  }

  if (now < todayWindow.closeAt) {
    return {
      timeZone,
      startTime: now,
      endTime: todayWindow.closeAt,
      isLiveNow: true,
    };
  }

  const tomorrowWindow = getWindowForZonedDate(
    { ...parts, day: parts.day + 1 },
    timeZone
  );

  return {
    timeZone,
    startTime: tomorrowWindow.openAt,
    endTime: tomorrowWindow.closeAt,
    isLiveNow: false,
  };
};

export const isOrderCompletedForMarketplace = (order = {}) => {
  const paymentStatus = normalizeStatus(order.paymentStatus);
  const deliveryStatus = normalizeStatus(order.deliveryStatus);

  return (
    COMPLETED_PAYMENT_STATUSES.has(paymentStatus) ||
    COMPLETED_DELIVERY_STATUSES.has(deliveryStatus)
  );
};

export const isOrderProtectedFromGrowerDelete = (order = {}) =>
  isOrderCompletedForMarketplace(order) ||
  ["IN_TRANSIT", "DELIVERED"].includes(normalizeStatus(order.deliveryStatus));

export const getCompletedMarketplaceOrder = (order = {}) =>
  isOrderCompletedForMarketplace(order) ? order : null;

export const buildMarketplaceLifecycle = (order = {}) => {
  const completedOrder = getCompletedMarketplaceOrder(order);
  if (!completedOrder) {
    return {
      completedDeal: false,
      marketplaceLifecycle: {
        status: "incomplete",
      },
    };
  }

  return {
    completedDeal: true,
    dealStatus: "completed",
    marketplaceLifecycle: {
      status: "completed",
      orderId: completedOrder._id,
      paymentStatus: completedOrder.paymentStatus || "",
      deliveryStatus: completedOrder.deliveryStatus || "",
    },
  };
};

export const isPublicAuctionVisible = (auction = {}, completedOrderByAuctionId = new Map(), now = new Date()) => {
  const status = normalizeStatus(auction.status);
  if (TERMINAL_INCOMPLETE_AUCTION_STATUSES.has(status)) return false;
  const completedOrder = completedOrderByAuctionId.get(String(auction._id));
  if (status === "ENDED") return Boolean(completedOrder);
  if (hasPassedEndTime(auction.endTime || auction.product?.auctionEndTime, now)) {
    return Boolean(completedOrder);
  }
  return true;
};

export const isPublicLotVisible = (product = {}, completedOrderByProductId = new Map(), now = new Date()) => {
  const status = normalizeStatus(product.status);
  if (product.active === false || HIDDEN_LOT_STATUSES.has(status)) return false;
  const completedOrder = completedOrderByProductId.get(String(product._id));
  if (COMPLETION_REQUIRED_LOT_STATUSES.has(status)) return Boolean(completedOrder);
  if (hasPassedEndTime(product.auctionEndTime || product.endTime, now)) return Boolean(completedOrder);
  return true;
};
