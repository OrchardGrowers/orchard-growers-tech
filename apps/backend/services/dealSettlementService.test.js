import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  calculateDealSettlement,
  calculatePercentageMinor,
  toMinorUnits,
} from "./dealSettlementService.js";
import { calculateDealBreakdown } from "./dealCalculationService.js";

const COMMISSION_ENV_KEYS = [
  "PLATFORM_COMMISSION_PERCENT",
  "PLATFORM_COMMISSION_BPS",
  "GROWER_COMMISSION_ENABLED",
  "BUYER_COMMISSION_ENABLED",
  "GROWER_COMMISSION_BPS",
  "BUYER_COMMISSION_BPS",
  "EFRUITMANDI_COMMISSION_GST_PERCENT",
];

const originalEnvironment = Object.fromEntries(
  COMMISSION_ENV_KEYS.map((key) => [key, process.env[key]])
);

describe("deal settlement financial snapshots", () => {
  beforeEach(() => {
    COMMISSION_ENV_KEYS.forEach((key) => delete process.env[key]);
  });

  afterEach(() => {
    COMMISSION_ENV_KEYS.forEach((key) => {
      if (originalEnvironment[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnvironment[key];
    });
  });

  it("uses the new buyer-side 7% commission without reducing the gross fruit sale", () => {
    const snapshot = calculateDealSettlement(
      {
        finalPrice: 19_012,
        growerCommissionRate: 0,
        buyerCommissionRate: 7,
        commissionVersion: "2026-07",
        dealBreakdown: { labourAmount: 0, logisticsAmount: 0 },
      },
      { finalWeightKg: 194, finalRate: 98 }
    );

    expect(snapshot.grossFruitSaleMinor).toBe(1_901_200);
    expect(snapshot.grossFruitSaleAmount).toBe(19_012);
    expect(snapshot.finalWeightKg).toBe(194);
    expect(snapshot.finalRate).toBe(98);
    expect(snapshot.growerCommissionAmount).toBe(0);
    expect(snapshot.buyerCommissionRate).toBe(7);
    expect(snapshot.buyerCommissionMinor).toBe(133_084);
    expect(snapshot.buyerCommissionAmount).toBe(1_330.84);
    expect(snapshot.buyerTotalPayable).toBe(20_342.84);
    expect(snapshot.growerNetSettlement).toBe(19_012);
  });

  it("preserves a historical accepted deal that stored the legacy 5% grower charge", () => {
    const snapshot = calculateDealSettlement({
      finalPrice: 100_000,
      dealBreakdown: {
        dealAmount: 100_000,
        commissionPercent: 5,
        labourAmount: 0,
        logisticsAmount: 0,
      },
    });

    expect(snapshot.growerCommissionRate).toBe(5);
    expect(snapshot.growerCommissionAmount).toBe(5_000);
    expect(snapshot.buyerCommissionAmount).toBe(0);
    expect(snapshot.growerNetSettlement).toBe(95_000);
    expect(snapshot.buyerTotalPayable).toBe(100_000);
  });

  it("returns an existing locked snapshot without recalculation", () => {
    const lockedAt = new Date("2025-01-01T00:00:00.000Z");
    const locked = {
      grossFruitSaleAmount: 10_000,
      buyerCommissionRate: 5,
      buyerCommissionAmount: 500,
      buyerTotalPayable: 10_500,
      lockedAt,
    };

    expect(
      calculateDealSettlement(
        { finalPrice: 99_999, financialSnapshot: locked },
        { grossSaleAmount: 50_000 }
      )
    ).toEqual(locked);
  });

  it("calculates percentages using integer paise rounding", () => {
    expect(toMinorUnits(19_012)).toBe(1_901_200);
    expect(calculatePercentageMinor(1_901_200, 700)).toBe(133_084);
    expect(calculatePercentageMinor(101, 700)).toBe(7);
  });

  it("applies only an explicitly configured service tax using paise precision", () => {
    process.env.EFRUITMANDI_COMMISSION_GST_PERCENT = "18";
    const snapshot = calculateDealSettlement({
      finalPrice: 1_000,
      buyerCommissionRate: 7,
      commissionVersion: "2026-07",
      dealBreakdown: { labourAmount: 0, logisticsAmount: 0 },
    });

    expect(snapshot.buyerCommissionAmount).toBe(70);
    expect(snapshot.buyerCommissionTaxAmount).toBe(12.6);
    expect(snapshot.taxAmount).toBe(12.6);
    expect(snapshot.buyerTotalPayable).toBe(1_082.6);
  });

  it("applies commission once in a new quotation breakdown", () => {
    const breakdown = calculateDealBreakdown({
      gradeQuantities: { A: 10 },
      gradePrices: { A: 100 },
      distanceKm: 0,
      labourAmount: 0,
      growerCommissionEnabled: false,
      buyerCommissionEnabled: true,
      buyerCommissionPercent: 7,
      growerCommissionPercent: 7,
      commissionPercent: 7,
    });

    expect(breakdown.dealAmount).toBe(1_000);
    expect(breakdown.commissionAmount).toBe(70);
    expect(breakdown.growerCommissionAmount).toBe(0);
    expect(breakdown.buyerCommissionAmount).toBe(70);
    expect(breakdown.buyerPayableThroughPlatform).toBe(1_070);
    expect(breakdown.sellerReceivable).toBe(1_000);
  });
});
