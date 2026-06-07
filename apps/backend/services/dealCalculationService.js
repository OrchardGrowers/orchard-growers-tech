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
const roundRate = (value) => Math.round(Number(value) || 0);
const DEFAULT_PLATFORM_SERVICE_FEE_PERCENT = 5;
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
  labourAmount = Number(process.env.DEFAULT_LABOUR_AMOUNT || DEFAULT_LABOUR_CHARGE_PER_UNIT),
  driverChargeSlabs = DEFAULT_DRIVER_CHARGE_SLABS,
  gradeOrder = DEFAULT_GRADE_ORDER,
} = {}) => {
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
  const commissionAmount = roundMoney(commissionBase * (Number(commissionPercent || 0) / 100));
  const labourChargePerUnit = roundMoney(Number(labourAmount || 0));
  const labour = roundMoney(totalUnits * labourChargePerUnit);
  const totalCharges = roundMoney(commissionAmount + labour + logisticsAmount);
  const chargePerUnit = totalUnits > 0 ? roundMoney(totalCharges / totalUnits) : 0;
  const settlementGrades = gradeBreakdown.map((grade) => {
    const platformServiceFee = roundMoney(Number(grade.price || 0) * (Number(commissionPercent || 0) / 100));
    const netSettlementRate = roundRate(
      Math.max(
        0,
        Number(grade.price || 0) -
          platformServiceFee -
          labourChargePerUnit -
          logisticsChargePerUnit
      )
    );

    return {
      ...grade,
      platformServiceFee,
      logisticsCharge: logisticsChargePerUnit,
      labourCharge: labourChargePerUnit,
      buyerPayableThroughPlatform: roundMoney(Math.max(0, Number(grade.price || 0) - labourChargePerUnit)),
      netSettlementRate,
      netRate: netSettlementRate,
      netAmount: roundMoney(netSettlementRate * Number(grade.quantity || 0)),
    };
  });
  const sellerReceivable = roundMoney(
    settlementGrades.reduce((sum, grade) => sum + Number(grade.netAmount || 0), 0)
  );
  const buyerPayable = roundMoney(Math.max(0, dealAmount - labour));

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

export const mergeDealSettings = (settings = {}) => ({
  commissionPercent:
    settings.commissionPercent ?? Number(process.env.PLATFORM_COMMISSION_PERCENT || DEFAULT_PLATFORM_SERVICE_FEE_PERCENT),
  labourAmount: Number(process.env.DEFAULT_LABOUR_AMOUNT || DEFAULT_LABOUR_CHARGE_PER_UNIT),
  driverChargeSlabs: settings.driverChargeSlabs?.length
    ? settings.driverChargeSlabs
    : DEFAULT_DRIVER_CHARGE_SLABS,
});
