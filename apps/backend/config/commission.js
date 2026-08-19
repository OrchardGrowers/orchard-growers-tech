export const COMMISSION_VERSION = "2026-07";
export const DEFAULT_PLATFORM_COMMISSION_BPS = 700;

const parseBoolean = (value, fallback) => {
  if (value === undefined || value === null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
};

const parseBasisPoints = (value, fallback) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return fallback;
  return Math.round(number);
};

export const percentToBasisPoints = (value, fallback = 0) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return fallback;
  return Math.round(number * 100);
};

export const basisPointsToPercent = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 10000;

export const getCommissionTaxRateBps = () =>
  percentToBasisPoints(process.env.EFRUITMANDI_COMMISSION_GST_PERCENT, 0);

export const getActiveCommissionConfig = ({
  legacyGrowerCommissionPercent,
  legacyBuyerCommissionPercent,
} = {}) => {
  const defaultRateBps = parseBasisPoints(
    process.env.PLATFORM_COMMISSION_BPS,
    percentToBasisPoints(
      process.env.PLATFORM_COMMISSION_PERCENT,
      DEFAULT_PLATFORM_COMMISSION_BPS
    )
  );
  const growerCommissionEnabled = parseBoolean(
    process.env.GROWER_COMMISSION_ENABLED,
    false
  );
  const buyerCommissionEnabled = parseBoolean(
    process.env.BUYER_COMMISSION_ENABLED,
    true
  );
  const growerCommissionRateBps = percentToBasisPoints(
    legacyGrowerCommissionPercent,
    parseBasisPoints(process.env.GROWER_COMMISSION_BPS, defaultRateBps)
  );
  const buyerCommissionRateBps = percentToBasisPoints(
    legacyBuyerCommissionPercent,
    parseBasisPoints(process.env.BUYER_COMMISSION_BPS, defaultRateBps)
  );

  return {
    commissionVersion: COMMISSION_VERSION,
    growerCommissionEnabled,
    buyerCommissionEnabled,
    growerCommissionRateBps: growerCommissionEnabled ? growerCommissionRateBps : 0,
    buyerCommissionRateBps: buyerCommissionEnabled ? buyerCommissionRateBps : 0,
  };
};
