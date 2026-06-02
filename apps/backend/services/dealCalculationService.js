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

export const DEFAULT_GRADE_RATE_RULES = {
  "A+": {
    "A+": 1,
    A: 0.8,
    "B+": 0.6,
    B: 0.5,
    "C+": 0.36,
    C: 0.3,
    D: 0.18,
    Ungraded: 0.8,
  },
  A: {
    A: 1,
    "B+": 0.8,
    B: 0.6,
    "C+": 0.5,
    C: 0.4,
    D: 0.25,
    Ungraded: 0.8,
  },
  "B+": {
    "B+": 1,
    B: 0.8,
    "C+": 0.6,
    C: 0.5,
    D: 0.5,
    Ungraded: 0.8,
  },
};

const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

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

const buildFallbackRule = (highestGrade, gradeOrder = DEFAULT_GRADE_ORDER) => {
  if (highestGrade === "Ungraded") return { Ungraded: 1 };

  const highestIndex = gradeOrder.indexOf(highestGrade);
  if (highestIndex < 0) return {};

  const descendingMultipliers = [1, 0.8, 0.6, 0.5, 0.4, 0.3, 0.2];
  return gradeOrder.slice(highestIndex).reduce((rule, grade, index) => {
    if (grade === "Ungraded") {
      rule[grade] = 0.8;
    } else {
      rule[grade] = descendingMultipliers[index] ?? 0.2;
    }
    return rule;
  }, {});
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
  highestGrade,
  baseRate,
  gradeQuantities = {},
  distanceKm = 0,
  commissionPercent = Number(process.env.PLATFORM_COMMISSION_PERCENT || 5),
  gradeRateRules = DEFAULT_GRADE_RATE_RULES,
  driverChargeSlabs = DEFAULT_DRIVER_CHARGE_SLABS,
  gradeOrder = DEFAULT_GRADE_ORDER,
} = {}) => {
  const rate = Number(baseRate);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error("Rate must be greater than 0");
  }

  const quantities = normalizeGradeQuantities(gradeQuantities);
  const availableGrades = gradeOrder.filter((grade) => Number(quantities[grade] || 0) > 0);
  const resolvedHighestGrade = highestGrade || availableGrades[0] || "";

  if (!resolvedHighestGrade) {
    throw new Error("At least one grade quantity must be greater than 0");
  }

  if (!availableGrades.includes(resolvedHighestGrade)) {
    throw new Error("Highest grade must be present in the lot quantity");
  }

  const rule = {
    ...buildFallbackRule(resolvedHighestGrade, gradeOrder),
    ...(gradeRateRules?.[resolvedHighestGrade] || {}),
  };

  const gradeBreakdown = availableGrades.map((grade) => {
    const quantity = Number(quantities[grade] || 0);
    const multiplier = Number(rule[grade]);
    const gradeRate = roundMoney(rate * (Number.isFinite(multiplier) ? multiplier : 0));
    return {
      grade,
      quantity,
      rate: gradeRate,
      amount: roundMoney(quantity * gradeRate),
    };
  });

  const dealAmount = roundMoney(
    gradeBreakdown.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  );
  const driverCharge = calculateDriverCharge(distanceKm, driverChargeSlabs);
  const commissionBase = roundMoney(dealAmount + driverCharge);
  const commissionAmount = roundMoney(commissionBase * (Number(commissionPercent || 0) / 100));
  const sellerReceivable = roundMoney(Math.max(0, dealAmount - commissionAmount));
  const buyerPayable = roundMoney(dealAmount + driverCharge + commissionAmount);

  return {
    highestGrade: resolvedHighestGrade,
    baseRate: rate,
    gradeBreakdown,
    dealAmount,
    driverCharge,
    commissionBase,
    commissionPercent: Number(commissionPercent || 0),
    commissionAmount,
    sellerReceivable,
    buyerPayable,
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
    settings.commissionPercent ?? Number(process.env.PLATFORM_COMMISSION_PERCENT || 5),
  driverChargeSlabs: settings.driverChargeSlabs?.length
    ? settings.driverChargeSlabs
    : DEFAULT_DRIVER_CHARGE_SLABS,
  gradeRateRules:
    settings.gradeRateRules && Object.keys(settings.gradeRateRules).length
      ? settings.gradeRateRules
      : DEFAULT_GRADE_RATE_RULES,
});
