import { describe, expect, it } from "vitest";
import { canLotAcceptOffers, isHistoricalLot, isPublicLotVisible } from "./dealLifecycleService.js";
import { sanitizePublicHistoricalLot } from "./publicLotHistoryService.js";

const privateHistoricalLot = {
  _id: "64b000000000000000000010",
  title: "Private title",
  fruitName: "Apple",
  variety: "Royal Delicious",
  quantity: 120,
  unit: "boxes",
  location: "House 12, Secret Road, Shimla, Himachal Pradesh, 171001",
  status: "EXPIRED",
  active: false,
  basePrice: 125,
  reservePrice: 150,
  acceptedBuyerId: "64b000000000000000000020",
  phone: "9999999999",
  email: "private@example.test",
  panNumber: "ABCDE1234F",
  kyc: { documents: ["private-pan.jpg"] },
  bankAccountNo: "1234567890",
  adminNotes: "private",
  createdAt: "2026-08-01T10:00:00.000Z",
  updatedAt: "2026-08-02T10:00:00.000Z",
};

describe("public historical fruit lots", () => {
  it("keeps terminal lots publicly visible but permanently read-only", () => {
    expect(isHistoricalLot(privateHistoricalLot)).toBe(true);
    expect(isPublicLotVisible(privateHistoricalLot)).toBe(true);
    expect(canLotAcceptOffers(privateHistoricalLot)).toBe(false);
  });

  it.each([
    [0, "No Buyer Interested"],
    [3, "No Deal Confirmed"],
  ])("publishes only sanitized history for %i offer(s)", (offerCount, outcome) => {
    const result = sanitizePublicHistoricalLot(privateHistoricalLot, { offerCount });

    expect(result).toMatchObject({
      fruitName: "Apple",
      variety: "Royal Delicious",
      quantity: 120,
      location: "Shimla, Himachal Pradesh",
      offerCount,
      historyOutcome: outcome,
      historical: true,
      readOnly: true,
      tradable: false,
    });
    expect(result.publicHistoryKey).toMatch(/^history_/);
    const serialized = JSON.stringify(result);
    for (const privateValue of [
      privateHistoricalLot._id,
      privateHistoricalLot.acceptedBuyerId,
      privateHistoricalLot.phone,
      privateHistoricalLot.email,
      privateHistoricalLot.panNumber,
      privateHistoricalLot.bankAccountNo,
      privateHistoricalLot.adminNotes,
      "private-pan.jpg",
    ]) {
      expect(serialized).not.toContain(String(privateValue));
    }
    expect(result).not.toHaveProperty("_id");
    expect(result).not.toHaveProperty("title");
    expect(result).not.toHaveProperty("basePrice");
    expect(result).not.toHaveProperty("reservePrice");
  });

  it("labels a genuinely completed transaction without exposing transaction amounts", () => {
    const result = sanitizePublicHistoricalLot(privateHistoricalLot, {
      offerCount: 2,
      completedOrder: { paymentStatus: "PAID", finalPrice: 9999, updatedAt: privateHistoricalLot.updatedAt },
    });
    expect(result.historyOutcome).toBe("Deal Completed");
    expect(result.finalLifecycleStatus).toBe("COMPLETED");
    expect(result).not.toHaveProperty("finalPrice");
  });
});
