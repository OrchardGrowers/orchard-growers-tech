const LIVE_STATUSES = new Set([
  "live",
  "active",
  "open",
  "in auction",
  "available",
  "deal open",
]);

const UPCOMING_STATUSES = new Set([
  "upcoming",
  "scheduled",
  "not started",
]);

const COMPLETED_DEAL_STATUSES = new Set([
  "completed",
  "paid",
  "delivered",
]);

const COMPLETED_PAYMENT_STATUSES = new Set(["escrow", "paid", "released", "success", "completed"]);
const COMPLETED_DELIVERY_STATUSES = new Set(["delivered"]);
const INCOMPLETE_TERMINAL_STATUSES = new Set([
  "abandoned",
  "cancelled",
  "canceled",
  "closed",
  "deal confirmed",
  "deleted",
  "ended",
  "expired",
  "failed",
  "payment pending",
  "pending payment",
  "quote accepted",
  "sold",
  "unpaid",
]);

const SENSITIVE_LOCATION_PATTERN =
  /\b(address|house|street|road|near|plot|flat|building|village|ward|pin|pincode|post office|orchard location|exact)\b/i;

const cleanText = (value = "") => String(value || "").trim();

const normalizeStatusToken = (value = "") =>
  cleanText(value)
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();

export const hasCompletedDealSignal = (deal = {}) => {
  if (
    deal.completedDeal === true ||
    deal.dealCompleted === true ||
    deal.isCompletedDeal === true ||
    deal.marketplaceCompleted === true
  ) {
    return true;
  }

  const order = deal.order || deal.acceptedOrder || deal.completedOrder || deal.marketplaceOrder || {};
  const paymentCandidates = [
    deal.marketplaceLifecycle?.paymentStatus,
    deal.completedOrderPaymentStatus,
    deal.acceptedOrderPaymentStatus,
    deal.paymentStatus,
    order.paymentStatus,
    deal.product?.paymentStatus,
    deal.auction?.paymentStatus,
  ].map(normalizeStatusToken);

  if (paymentCandidates.some((status) => COMPLETED_PAYMENT_STATUSES.has(status))) return true;

  const deliveryCandidates = [
    deal.marketplaceLifecycle?.deliveryStatus,
    deal.completedOrderDeliveryStatus,
    deal.acceptedOrderDeliveryStatus,
    deal.deliveryStatus,
    order.deliveryStatus,
    deal.product?.deliveryStatus,
    deal.auction?.deliveryStatus,
  ].map(normalizeStatusToken);

  if (deliveryCandidates.some((status) => COMPLETED_DELIVERY_STATUSES.has(status))) return true;

  const statusCandidates = [
    deal.marketplaceLifecycle?.status,
    deal.lifecycleStatus,
    deal.completionStatus,
    deal.orderStatus,
    order.status,
    deal.dealStatus,
    deal.status,
  ].map(normalizeStatusToken);

  return statusCandidates.some((status) => COMPLETED_DEAL_STATUSES.has(status));
};

export const normalizeDealStatus = (deal = {}) => {
  if (hasCompletedDealSignal(deal)) return "closed";

  const candidates = [
    deal.dealTiming?.state,
    deal.status,
    deal.auctionStatus,
    deal.dealStatus,
    deal.lotStatus,
    deal.product?.status,
    deal.auction?.status,
  ]
    .map(normalizeStatusToken)
    .filter(Boolean);

  if (candidates.some((status) => INCOMPLETE_TERMINAL_STATUSES.has(status))) return "";
  if (candidates.some((status) => LIVE_STATUSES.has(status))) return "live";
  if (candidates.some((status) => UPCOMING_STATUSES.has(status))) return "upcoming";

  return candidates[0] || "";
};

export const isLiveDeal = (deal = {}) => normalizeDealStatus(deal) === "live";

export const isUpcomingDeal = (deal = {}) => normalizeDealStatus(deal) === "upcoming";

export const isClosedDeal = (deal = {}) => normalizeDealStatus(deal) === "closed";

export const getDealDisplayGroup = (deals = []) => {
  const liveDeals = deals.filter(isLiveDeal);
  if (liveDeals.length) {
    return {
      key: "live",
      title: "Live Fruit Deals",
      deals: liveDeals,
      emptyText: "No live fruit deal yet. New mandi deals will appear here.",
    };
  }

  const upcomingDeals = deals.filter(isUpcomingDeal);
  if (upcomingDeals.length) {
    return {
      key: "upcoming",
      title: "Upcoming Fruit Deals",
      deals: upcomingDeals,
      emptyText: "No upcoming fruit deal yet. Scheduled deals will appear here.",
    };
  }

  const closedDeals = deals.filter(isClosedDeal);
  if (closedDeals.length) {
    return {
      key: "closed",
      title: "Recently Closed Deals",
      deals: closedDeals,
      emptyText: "No recently closed deals yet.",
    };
  }

  return {
    key: "empty",
    title: "Live Fruit Deals",
    deals: [],
    emptyText: "No fruit deals yet. New mandi deals will appear here.",
  };
};

const firstText = (...values) => {
  for (const value of values) {
    const text = cleanText(value);
    if (text) return text;
  }
  return "";
};

const firstNumber = (...values) => {
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue;
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return undefined;
};

const normalizeRole = (user = {}, fallbackRole = "") => {
  const role = firstText(user.businessType, fallbackRole, user.roleType, user.role, user.activeRole);
  if (role) return role.toLowerCase();
  if (user.orchardName) return "grower";
  if (user.businessName || user.buyerContactPerson || user.buyerCompanyLogoUrl) return "buyer";
  return "";
};

const isApproved = (status = "") => cleanText(status).toUpperCase() === "APPROVED";

const getRoleRecord = (records = {}, role = "") => {
  const normalizedRole = cleanText(role).toLowerCase();
  return normalizedRole ? records?.[normalizedRole] || {} : {};
};

const hasApprovedRequest = (record = {}) =>
  Boolean(record?.requestId && isApproved(record?.status));

const getSafeLocationFromParts = (...parts) =>
  parts
    .map(cleanText)
    .filter(Boolean)
    .filter((part) => !/\b\d{6}\b/.test(part))
    .slice(0, 3)
    .join(", ");

const getSafeLocationFromText = (value = "") => {
  const text = cleanText(value).replace(/\b\d{6}\b/g, "").replace(/\s+/g, " ");
  if (!text) return "";

  const parts = text
    .split(",")
    .map(cleanText)
    .filter(Boolean)
    .filter((part) => !/\d/.test(part))
    .filter((part) => !SENSITIVE_LOCATION_PATTERN.test(part));

  if (parts.length) return parts.slice(-3).join(", ");
  if (!/\d/.test(text) && !SENSITIVE_LOCATION_PATTERN.test(text) && text.length <= 42) return text;
  return "";
};

const getSafeMainLocation = (user = {}, role = "") => {
  if (user.mainLocation) return getSafeLocationFromText(user.mainLocation);

  const roleKyc = getRoleRecord(user.kycByRole, role);
  const legacyKyc = user.kyc || {};
  const locationObject = typeof user.location === "object" && user.location ? user.location : {};

  const explicitLocation = getSafeLocationFromParts(
    user.city || user.town || locationObject.city,
    user.district || locationObject.district || roleKyc.district || legacyKyc.district,
    user.state || locationObject.state || roleKyc.state || legacyKyc.state
  );
  if (explicitLocation) return explicitLocation;

  return getSafeLocationFromText(
    role === "buyer"
      ? firstText(user.buyerLocation, user.location)
      : firstText(user.location, user.businessAddressLine3, user.addressLine3)
  );
};

export const getSafePublicProfile = (user = {}, fallback = {}) => {
  const source = user || {};
  const role = normalizeRole(source, fallback.businessType);
  const roleKyc = getRoleRecord(source.kycByRole, role);
  const legacyKyc = source.kyc || {};
  const roleOg = getRoleRecord(source.ogVerificationByRole, role);
  const kycVerified = Boolean(
    source.isKycVerified ||
      source.kycVerified ||
      (role === "buyer" && source.buyerVerified) ||
      (role === "grower" && source.growerVerified) ||
      isApproved(roleKyc.status) ||
      isApproved(legacyKyc.status)
  );
  const ogVerified = Boolean(
    source.isOgVerified ||
      source.ogVerified ||
      (role === "buyer" && source.buyerOgVerified) ||
      (role === "grower" && source.growerOgVerified) ||
      hasApprovedRequest(roleOg)
  );

  const logoUrl =
    role === "buyer"
      ? firstText(
          source.logoUrl,
          source.buyerCompanyLogoUrl,
          source.buyerAvatarUrl,
          source.companyLogoUrl,
          source.avatarUrl,
          source.profileImage,
          source.profilePic,
          source.avatar,
          source.photoURL,
          fallback.logoUrl,
          fallback.profileImage,
          fallback.profilePic,
          fallback.avatar,
          fallback.photoURL
        )
      : firstText(
          source.logoUrl,
          source.companyLogoUrl,
          source.avatarUrl,
          source.profileImage,
          source.profilePic,
          source.avatar,
          source.photoURL,
          source.buyerCompanyLogoUrl,
          source.buyerAvatarUrl,
          fallback.logoUrl,
          fallback.profileImage,
          fallback.profilePic,
          fallback.avatar,
          fallback.photoURL
        );

  return {
    name: firstText(source.name, source.buyerContactPerson, fallback.name),
    companyName: firstText(
      source.companyName,
      source.orchardName,
      source.businessName,
      source.logisticsName,
      fallback.companyName
    ),
    logoUrl,
    profileImage: logoUrl,
    profilePic: logoUrl,
    avatar: logoUrl,
    photoURL: logoUrl,
    mainLocation: getSafeMainLocation(source, role) || cleanText(fallback.mainLocation),
    isKycVerified: kycVerified,
    isOgVerified: ogVerified,
    isTrusted: Boolean(source.isTrusted || source.trusted || source.isTrustedBuyer || source.trustedBuyer || ogVerified),
    memberSince: firstText(source.memberSince, source.createdAt, fallback.memberSince),
    totalLots: firstNumber(source.totalLots, source.totalListedLots, source.listedLotsCount, fallback.totalLots),
    totalDeals: firstNumber(source.totalDeals, source.totalQuotes, source.quoteCount, source.dealCount, fallback.totalDeals),
    businessType: role || cleanText(fallback.businessType),
  };
};
