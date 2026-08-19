import {
  basisPointsToPercent,
  getActiveCommissionConfig,
  getCommissionTaxRateBps,
} from "../config/commission.js";
import { calculatePercentageMinor, fromMinorUnits, toMinorUnits } from "./dealSettlementService.js";

export const DEFAULT_GRADE_ORDER = ["A+", "A", "B+", "B", "C+", "C", "D", "Ungraded"];

export const DEFAULT_DRIVER_CHARGE_SLABS = [
  { minKm: 0, maxKm: 0, amount: 0 },
  { minKm: 1, maxKm: 5, amount: 300 },
  { minKm: 6, maxKm: 10, amount: 800 },
  { minKm: 11, maxKm: 20, amount: 1200 },
  { minKm: 21, maxKm: 25, amount: 1500 },
  { minKm: 26, maxKm: 30, amount: 2000 },
  { minKm: 31, maxKm: 40, amount: 2500 },
  { minKm: 41, maxKm: 70, amount: 3000 },
  { minKm: 71, maxKm: 85, amount: 3500 },
  { minKm: 86, maxKm: 100, amount: 4000 },
  { minKm: 101, maxKm: 200, perKm: 40 },
  { minKm: 201, maxKm: 300, perKm: 35 },
  { minKm: 301, maxKm: 400, perKm: 30 },
  { minKm: 401, perKm: 25 },
];

const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const roundRate = (value) => roundMoney(value);
const ACTIVE_COMMISSION_DEFAULTS = getActiveCommissionConfig();
export const DEFAULT_PLATFORM_SERVICE_FEE_PERCENT = basisPointsToPercent(
  Math.max(
    ACTIVE_COMMISSION_DEFAULTS.growerCommissionRateBps,
    ACTIVE_COMMISSION_DEFAULTS.buyerCommissionRateBps
  )
);
const DEFAULT_LABOUR_CHARGE_PER_UNIT = 5;

export const normalizeGradeQuantities = (gradeQuantities = {}) => {
  if (Array.isArray(gradeQuantities)) {
    return gradeQuantities.reduce((result, item) => {
      const grade = String(item?.grade || "").trim();
      if (!grade) return result;
      const quantity = Number(item?.quantity ?? item?.boxes ?? item?.count ?? 0);
      result[grade] = (result[grade] || 0) + (Number.isFinite(quantity) ? quantity : 0);
      return result;
    }, {});
  }

  return Object.entries(gradeQuantities).reduce((result, [grade, quantity]) => {
    const normalizedGrade = String(grade || "").trim();
    const numericQuantity = Number(quantity || 0);
    if (normalizedGrade && Number.isFinite(numericQuantity)) {
      result[normalizedGrade] = numericQuantity;
    }
    return result;
  }, {});
};

export const getHighestAvailableGrade = (gradeQuantities = {}, gradeOrder = DEFAULT_GRADE_ORDER) => {
  const quantities = normalizeGradeQuantities(gradeQuantities);
  return gradeOrder.find((grade) => Number(quantities[grade] || 0) > 0) || "";
};

export const calculateDriverCharge = (distanceKm = 0, slabs = DEFAULT_DRIVER_CHARGE_SLABS) => {
  const distance = Number(distanceKm);
  if (!Number.isFinite(distance) || distance < 0) {
    throw new Error("Distance must be greater than or equal to 0");
  }

  const matchingSlab = slabs.find((slab) => {
    const minKm = Number(slab.minKm ?? 0);
    const maxKm = slab.maxKm === undefined || slab.maxKm === null ? Infinity : Number(slab.maxKm);
    return distance >= minKm && distance <= maxKm;
  });

  if (!matchingSlab) return 0;
  if (matchingSlab.amount !== undefined) return roundMoney(matchingSlab.amount);
  return roundMoney(distance * Number(matchingSlab.perKm || 0));
};

export const calculateDealBreakdown = ({
  gradeQuantities = {},
  gradePrices = {},
  distanceKm = 0,
  commissionPercent = Number(process.env.PLATFORM_COMMISSION_PERCENT || DEFAULT_PLATFORM_SERVICE_FEE_PERCENT),
  growerCommissionEnabled = ACTIVE_COMMISSION_DEFAULTS.growerCommissionEnabled,
  buyerCommissionEnabled = ACTIVE_COMMISSION_DEFAULTS.buyerCommissionEnabled,
  growerCommissionPercent = commissionPercent,
  buyerCommissionPercent = commissionPercent,
  labourAmount = Number(process.env.DEFAULT_LABOUR_AMOUNT || DEFAULT_LABOUR_CHARGE_PER_UNIT),
  driverChargeSlabs = DEFAULT_DRIVER_CHARGE_SLABS,
  gradeOrder = DEFAULT_GRADE_ORDER,
} = {}) => {
  const activeCommission = getActiveCommissionConfig();
  const quantities = normalizeGradeQuantities(gradeQuantities);
  const availableGrades = gradeOrder.filter((grade) => Number(quantities[grade] || 0) > 0);

  if (!availableGrades.length) {
    throw new Error("At least one grade quantity must be greater than 0");
  }

  const gradeBreakdown = availableGrades.map((grade) => {
    const quantity = Number(quantities[grade] || 0);
    const gradeRate = Number(gradePrices[grade] ?? 0);
    if (!Number.isFinite(gradeRate) || gradeRate <= 0) {
      throw new Error(`Enter a price greater than 0 for Grade ${grade}`);
    }

    return {
      grade,
      quantity,
      price: roundMoney(gradeRate),
      quotedRatePerUnit: roundMoney(gradeRate),
      amount: roundMoney(quantity * gradeRate),
    };
  });

  const totalUnits = roundMoney(
    gradeBreakdown.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
  );
  const dealAmount = roundMoney(
    gradeBreakdown.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  );
  const logisticsChargePerUnit = calculateDriverCharge(distanceKm, driverChargeSlabs);
  const logisticsAmount = roundMoney(totalUnits * logisticsChargePerUnit);
  const driverCharge = logisticsAmount;
  const commissionBase = dealAmount;
  const growerCommissionRateBps = growerCommissionEnabled
    ? Math.round(Number(growerCommissionPercent || 0) * 100)
    : 0;
  const buyerCommissionRateBps = buyerCommissionEnabled
    ? Math.round(Number(buyerCommissionPercent || 0) * 100)
    : 0;
  const growerCommissionAmount = fromMinorUnits(
    calculatePercentageMinor(toMinorUnits(commissionBase), growerCommissionRateBps)
  );
  const buyerCommissionAmount = fromMinorUnits(
    calculatePercentageMinor(toMinorUnits(commissionBase), buyerCommissionRateBps)
  );
  const commissionTaxRateBps = getCommissionTaxRateBps();
  const growerCommissionTaxAmount = fromMinorUnits(
    calculatePercentageMinor(toMinorUnits(growerCommissionAmount), commissionTaxRateBps)
  );
  const buyerCommissionTaxAmount = fromMinorUnits(
    calculatePercentageMinor(toMinorUnits(buyerCommissionAmount), commissionTaxRateBps)
  );
  const commissionAmount = roundMoney(growerCommissionAmount + buyerCommissionAmount);
  const commissionTaxAmount = roundMoney(growerCommissionTaxAmount + buyerCommissionTaxAmount);
  const labourChargePerUnit = roundMoney(Number(labourAmount || 0));
  const labour = roundMoney(totalUnits * labourChargePerUnit);
  const totalCharges = roundMoney(
    growerCommissionAmount + growerCommissionTaxAmount + labour + logisticsAmount
  );
  const chargePerUnit = totalUnits > 0 ? roundMoney(totalCharges / totalUnits) : 0;
  const settlementGrades = gradeBreakdown.map((grade) => {
    const growerPlatformServiceFee = fromMinorUnits(
      calculatePercentageMinor(toMinorUnits(grade.price), growerCommissionRateBps)
    );
    const buyerPlatformServiceFee = fromMinorUnits(
      calculatePercentageMinor(toMinorUnits(grade.price), buyerCommissionRateBps)
    );
    const growerServiceTax = fromMinorUnits(
      calculatePercentageMinor(toMinorUnits(growerPlatformServiceFee), commissionTaxRateBps)
    );
    const buyerServiceTax = fromMinorUnits(
      calculatePercentageMinor(toMinorUnits(buyerPlatformServiceFee), commissionTaxRateBps)
    );
    const netSettlementRate = roundRate(
      Math.max(
        0,
        Number(grade.price || 0) -
          growerPlatformServiceFee -
          growerServiceTax -
          labourChargePerUnit -
          logisticsChargePerUnit
      )
    );

    return {
      ...grade,
      platformServiceFee: roundMoney(growerPlatformServiceFee + buyerPlatformServiceFee),
      growerPlatformServiceFee,
      buyerPlatformServiceFee,
      growerServiceTax,
      buyerServiceTax,
      logisticsCharge: logisticsChargePerUnit,
      labourCharge: labourChargePerUnit,
      buyerPayableThroughPlatform: roundMoney(
        Number(grade.price || 0) + buyerPlatformServiceFee + buyerServiceTax
      ),
      netSettlementRate,
      netRate: netSettlementRate,
      netAmount: roundMoney(netSettlementRate * Number(grade.quantity || 0)),
    };
  });
  const sellerReceivable = roundMoney(
    Math.max(
      0,
      dealAmount - growerCommissionAmount - growerCommissionTaxAmount - labour - logisticsAmount
    )
  );
  const buyerPayable = roundMoney(
    dealAmount + buyerCommissionAmount + buyerCommissionTaxAmount
  );

  return {
    grades: settlementGrades,
    gradeBreakdown: settlementGrades,
    totalUnits,
    dealAmount,
    baseDealAmount: dealAmount,
    driverCharge,
    logisticsAmount,
    labourAmount: labour,
    labourChargePerUnit,
    commissionBase,
    commissionPercent: Number(commissionPercent || 0),
    growerCommissionEnabled: Boolean(growerCommissionEnabled),
    buyerCommissionEnabled: Boolean(buyerCommissionEnabled),
    growerCommissionRate: growerCommissionEnabled ? Number(growerCommissionPercent || 0) : 0,
    buyerCommissionRate: buyerCommissionEnabled ? Number(buyerCommissionPercent || 0) : 0,
    growerCommissionAmount,
    buyerCommissionAmount,
    commissionTaxRate: basisPointsToPercent(commissionTaxRateBps),
    growerCommissionTaxAmount,
    buyerCommissionTaxAmount,
    commissionTaxAmount,
    commissionVersion: activeCommission.commissionVersion,
    commissionAmount,
    platformServiceFee: commissionAmount,
    totalCharges,
    chargePerUnit,
    logisticsChargePerUnit,
    sellerReceivable,
    growerReceivable: sellerReceivable,
    buyerPayable,
    buyerPayableThroughPlatform: buyerPayable,
  };
};

export const buildGradeQuantitiesFromProduct = (product = {}) =>
  {
    const quantities = normalizeGradeQuantities(
    (product.gradeLots || []).map((lot) => ({
      grade: lot.grade,
      quantity: lot.boxes,
    }))
  );

    if (!Object.values(quantities).some((quantity) => Number(quantity || 0) > 0)) {
      const quantity = Number(product.quantity || 0);
      if (Number.isFinite(quantity) && quantity > 0) {
        return { Ungraded: quantity };
      }
    }

    return quantities;
  };

export const mergeDealSettings = (settings = {}) => {
  const active = getActiveCommissionConfig();
  const commissionPercent = settings.commissionVersion
    ? Number(settings.commissionPercent)
    : Number(process.env.PLATFORM_COMMISSION_PERCENT || DEFAULT_PLATFORM_SERVICE_FEE_PERCENT);

  return {
    commissionPercent,
    growerCommissionEnabled: settings.commissionVersion
      ? settings.growerCommissionEnabled === true
      : active.growerCommissionEnabled,
    buyerCommissionEnabled: settings.commissionVersion
      ? settings.buyerCommissionEnabled !== false
      : active.buyerCommissionEnabled,
    growerCommissionPercent: settings.commissionVersion
      ? Number(settings.growerCommissionPercent ?? commissionPercent)
      : commissionPercent,
    buyerCommissionPercent: settings.commissionVersion
      ? Number(settings.buyerCommissionPercent ?? commissionPercent)
      : basisPointsToPercent(active.buyerCommissionRateBps),
    commissionVersion: settings.commissionVersion || active.commissionVersion,
    labourAmount: Number(process.env.DEFAULT_LABOUR_AMOUNT || DEFAULT_LABOUR_CHARGE_PER_UNIT),
    driverChargeSlabs: settings.driverChargeSlabs?.length
      ? settings.driverChargeSlabs
      : DEFAULT_DRIVER_CHARGE_SLABS,
  };
};
