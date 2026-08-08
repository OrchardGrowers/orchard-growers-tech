import { describe, expect, it } from "vitest";
import {
  canAccessLotDetail,
  isValidLotLookupId,
} from "./publicLotAccessService.js";

const NOW = new Date("2026-08-08T08:00:00.000Z");
const PRODUCT_ID = "64b000000000000000000001";
const baseProduct = (overrides = {}) => ({
  _id: PRODUCT_ID,
  active: true,
  status: "AVAILABLE",
  inventoryType: "finished_product",
  createdSource: "grower",
  auctionEndTime: new Date("2026-08-09T08:00:00.000Z"),
  ...overrides,
});
const completedOrder = {
  product: PRODUCT_ID,
  paymentStatus: "PAID",
  deliveryStatus: "PENDING",
};

describe("public lot access", () => {
  it("accepts valid ObjectIds and rejects malformed IDs", () => {
    expect(isValidLotLookupId(PRODUCT_ID)).toBe(true);
    expect(isValidLotLookupId("not-an-object-id")).toBe(false);
  });

  it("allows an active public eFruitMandi lot", () => {
    expect(canAccessLotDetail({
      product: baseProduct(),
      platform: "efruitmandi",
      now: NOW,
    })).toBe(true);
  });

  it("rejects nonexistent, inactive, and hidden lots for anonymous access", () => {
    expect(canAccessLotDetail({ product: null, platform: "efruitmandi", now: NOW })).toBe(false);
    expect(canAccessLotDetail({ product: baseProduct({ active: false }), platform: "efruitmandi", now: NOW })).toBe(false);
    expect(canAccessLotDetail({ product: baseProduct({ active: false }), platform: "efruitmandi", completedOrder, now: NOW })).toBe(false);
    for (const status of ["EXPIRED", "CANCELLED", "DELETED"]) {
      expect(canAccessLotDetail({ product: baseProduct({ status }), platform: "efruitmandi", now: NOW })).toBe(false);
    }
  });

  it("requires a completed order for elapsed and completion-required lots", () => {
    const elapsed = baseProduct({ auctionEndTime: new Date("2026-08-07T08:00:00.000Z") });
    const sold = baseProduct({ status: "SOLD" });
    const pendingOrder = { product: PRODUCT_ID, paymentStatus: "PENDING", deliveryStatus: "PENDING" };

    expect(canAccessLotDetail({ product: elapsed, platform: "efruitmandi", now: NOW })).toBe(false);
    expect(canAccessLotDetail({ product: elapsed, platform: "efruitmandi", completedOrder, now: NOW })).toBe(true);
    expect(canAccessLotDetail({ product: sold, platform: "efruitmandi", completedOrder: pendingOrder, now: NOW })).toBe(false);
    expect(canAccessLotDetail({ product: sold, platform: "efruitmandi", completedOrder, now: NOW })).toBe(true);
  });

  it("rejects wrong-platform and raw-material products", () => {
    expect(canAccessLotDetail({
      product: baseProduct({ createdSource: "admin-panel" }),
      platform: "efruitmandi",
      now: NOW,
    })).toBe(false);
    expect(canAccessLotDetail({
      product: baseProduct({ inventoryType: "raw_material" }),
      platform: "efruitmandi",
      now: NOW,
    })).toBe(false);
  });

  it("preserves explicit privileged access to non-public lots without bypassing platform or inventory rules", () => {
    expect(canAccessLotDetail({
      product: baseProduct({ active: false, status: "DELETED" }),
      platform: "efruitmandi",
      allowNonPublic: true,
      now: NOW,
    })).toBe(true);
    expect(canAccessLotDetail({
      product: baseProduct({ createdSource: "admin-panel" }),
      platform: "efruitmandi",
      allowNonPublic: true,
      now: NOW,
    })).toBe(false);
  });
});
