import {
  basisPointsToPercent,
  getActiveCommissionConfig,
  getCommissionTaxRateBps,
  percentToBasisPoints,
} from "../config/commission.js";

export const toMinorUnits = (value) => {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return 0;
  return Math.round((number + Number.EPSILON) * 100);
};

export const fromMinorUnits = (value) =>
  Math.round(Number(value || 0)) / 100;

export const calculatePercentageMinor = (baseMinor, rateBps) =>
  Math.round((Math.round(Number(baseMinor || 0)) * Math.round(Number(rateBps || 0))) / 10000);

const firstFinite = (...values) => {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return 0;
};

const firstDefinedFinite = (...values) => {
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue;
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return undefined;
};

const getExistingSnapshot = (order = {}) => {
  const snapshot = order.financialSnapshot?.toObject
    ? order.financialSnapshot.toObject()
    : order.financialSnapshot;
  return snapshot?.lockedAt ? snapshot : null;
};

const getStoredGrowerRatePercent = (order = {}) =>
  firstDefinedFinite(
    order.growerCommissionRate,
    order.platformCommissionRate,
    order.dealBreakdown?.growerCommissionRate,
    order.dealBreakdown?.commissionPercent
  );

const getStoredBuyerRatePercent = (order = {}) =>
  firstDefinedFinite(
    order.buyerCommissionRate,
    order.dealBreakdown?.buyerCommissionRate
  );

const getGrossSaleAmount = (order = {}, override) =>
  firstFinite(
    override,
    order.finalPrice,
    order.dealBreakdown?.dealAmount,
    order.dealBreakdown?.baseDealAmount,
    order.auctionPrice,
    order.totalAmount
  );

export const calculateDealSettlement = (
  order = {},
  {
    grossSaleAmount,
    finalQuantity,
    finalWeightKg,
    finalRate,
    lockedAt = new Date(),
  } = {}
) => {
  const existing = getExistingSnapshot(order);
  if (existing) return existing;

  const storedGrowerRate = getStoredGrowerRatePercent(order);
  const storedBuyerRate = getStoredBuyerRatePercent(order);
  const commissionConfig = getActiveCommissionConfig({
    legacyGrowerCommissionPercent: storedGrowerRate,
    legacyBuyerCommissionPercent: storedBuyerRate,
  });
  const commissionVersion = String(
    order.commissionVersion || order.dealBreakdown?.commissionVersion || ""
  ).trim();
  const legacyCommission =
    (!commissionVersion || commissionVersion === "legacy") &&
    firstDefinedFinite(order.dealBreakdown?.commissionPercent) !== undefined;
  const grossFruitSaleMinor = toMinorUnits(getGrossSaleAmount(order, grossSaleAmount));
  const logisticsMinor = toMinorUnits(
    firstFinite(
      order.driverPayment,
      order.dealBreakdown?.driverCharge,
      order.dealBreakdown?.logisticsAmount
    )
  );
  const labourMinor = toMinorUnits(firstFinite(order.dealBreakdown?.labourAmount));
  const growerCommissionEnabled = legacyCommission
    ? Number(storedGrowerRate || 0) > 0
    : commissionConfig.growerCommissionEnabled;
  const buyerCommissionEnabled = legacyCommission
    ? false
    : commissionConfig.buyerCommissionEnabled;
  const growerCommissionRateBps = growerCommissionEnabled
    ? legacyCommission
      ? percentToBasisPoints(storedGrowerRate)
      : commissionConfig.growerCommissionRateBps
    : 0;
  const buyerCommissionRateBps = buyerCommissionEnabled
    ? commissionConfig.buyerCommissionRateBps
    : 0;
  const growerCommissionMinor = calculatePercentageMinor(
    grossFruitSaleMinor,
    growerCommissionRateBps
  );
  const buyerCommissionMinor = calculatePercentageMinor(
    grossFruitSaleMinor,
    buyerCommissionRateBps
  );
  const commissionTaxRateBps = getCommissionTaxRateBps();
  const growerCommissionTaxMinor = calculatePercentageMinor(
    growerCommissionMinor,
    commissionTaxRateBps
  );
  const buyerCommissionTaxMinor = calculatePercentageMinor(
    buyerCommissionMinor,
    commissionTaxRateBps
  );
  const growerNetSettlementMinor = Math.max(
    0,
    grossFruitSaleMinor -
      growerCommissionMinor -
      growerCommissionTaxMinor -
      logisticsMinor -
      labourMinor
  );
  const buyerTotalPayableMinor =
    grossFruitSaleMinor + buyerCommissionMinor + buyerCommissionTaxMinor;

  return {
    currency: "INR",
    precision: 2,
    commissionVersion: commissionConfig.commissionVersion,
    grossFruitSaleMinor,
    grossFruitSaleAmount: fromMinorUnits(grossFruitSaleMinor),
    finalQuantity: firstFinite(finalQuantity, order.dealBreakdown?.totalUnits),
    finalWeightKg: firstFinite(finalWeightKg, order.finalWeightKg, order.product?.totalWeightKg),
    finalRate: firstFinite(finalRate, order.finalRate, order.highestGradeRate),
    growerCommissionEnabled,
    growerCommissionRateBps,
    growerCommissionRate: basisPointsToPercent(growerCommissionRateBps),
    growerCommissionMinor,
    growerCommissionAmount: fromMinorUnits(growerCommissionMinor),
    buyerCommissionEnabled,
    buyerCommissionRateBps,
    buyerCommissionRate: basisPointsToPercent(buyerCommissionRateBps),
    buyerCommissionMinor,
    buyerCommissionAmount: fromMinorUnits(buyerCommissionMinor),
    commissionTaxRateBps,
    commissionTaxRate: basisPointsToPercent(commissionTaxRateBps),
    growerCommissionTaxMinor,
    growerCommissionTaxAmount: fromMinorUnits(growerCommissionTaxMinor),
    buyerCommissionTaxMinor,
    buyerCommissionTaxAmount: fromMinorUnits(buyerCommissionTaxMinor),
    logisticsMinor,
    logisticsAmount: fromMinorUnits(logisticsMinor),
    labourMinor,
    labourAmount: fromMinorUnits(labourMinor),
    taxMinor: growerCommissionTaxMinor + buyerCommissionTaxMinor,
    taxAmount: fromMinorUnits(growerCommissionTaxMinor + buyerCommissionTaxMinor),
    growerNetSettlementMinor,
    growerNetSettlement: fromMinorUnits(growerNetSettlementMinor),
    buyerTotalPayableMinor,
    buyerTotalPayable: fromMinorUnits(buyerTotalPayableMinor),
    platformRevenueMinor: growerCommissionMinor + buyerCommissionMinor,
    platformRevenue: fromMinorUnits(growerCommissionMinor + buyerCommissionMinor),
    lockedAt,
  };
};

export const applyFinancialSnapshotToOrder = (order, snapshot) => {
  order.financialSnapshot = snapshot;
  order.commissionVersion = snapshot.commissionVersion;
  order.commissionLockedAt = snapshot.lockedAt;
  order.platformCommissionRate = snapshot.growerCommissionRate;
  order.growerCommissionRate = snapshot.growerCommissionRate;
  order.buyerCommissionRate = snapshot.buyerCommissionRate;
  order.platformCommission = snapshot.platformRevenue;
  order.growerPayout = snapshot.growerNetSettlement;
  order.finalPrice = snapshot.grossFruitSaleAmount;
  order.totalAmount = snapshot.buyerTotalPayable;
  return order;
};

export const resolveLegacyCommissionRateBps = (order = {}) =>
  percentToBasisPoints(getStoredGrowerRatePercent(order));
