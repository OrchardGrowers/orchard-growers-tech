import { describe, expect, it } from "vitest";
import { canViewPrivateLotPrice, sanitizeLotPricing } from "./lotPricePrivacyService.js";

const product = { _id: "lot-1", createdBy: "grower-1", basePrice: 125 };

describe("private fruit-lot pricing", () => {
  it.each([
    ["visitor", {}],
    ["buyer", { id: "buyer-1", role: "buyer" }],
    ["different grower", { id: "grower-2", role: "grower" }],
    ["driver", { id: "driver-1", role: "driver" }],
    ["unrelated employee", { id: "employee-1", role: "EMPLOYEE" }],
    ["read-only admin viewer", { id: "viewer-1", role: "VIEWER" }],
  ])("removes private prices for %s", (_label, viewer) => {
    const result = sanitizeLotPricing(
      {
        product,
        startingPrice: 125,
        currentBid: 150,
        finalPrice: 175,
        nested: { basePrice: 125 },
      },
      { product, viewer }
    );
    expect(result).not.toHaveProperty("startingPrice");
    expect(result.product).not.toHaveProperty("basePrice");
    expect(result.nested).not.toHaveProperty("basePrice");
    expect(result.currentBid).toBe(150);
    expect(result.finalPrice).toBe(175);
  });

  it("allows only the owning grower or an authorized admin", () => {
    const owner = { id: "grower-1", role: "grower" };
    const admin = { id: "admin-1", role: "ADMIN" };
    expect(canViewPrivateLotPrice(product, owner)).toBe(true);
    expect(canViewPrivateLotPrice(product, admin)).toBe(true);
    expect(sanitizeLotPricing(product, { product, viewer: owner }).basePrice).toBe(125);
    expect(sanitizeLotPricing(product, { product, viewer: admin }).basePrice).toBe(125);
  });

  it("does not trust ownership without a grower profile", () => {
    expect(canViewPrivateLotPrice(product, { id: "grower-1", role: "buyer" })).toBe(false);
  });

  it("sanitizes a public lot API-shaped response recursively", () => {
    const response = sanitizeLotPricing({
      product,
      auction: { startingPrice: 125, currentBid: 150 },
      populated: { product: { ...product } },
    }, { product, viewer: {} });
    expect(JSON.stringify(response)).not.toContain("basePrice");
    expect(JSON.stringify(response)).not.toContain("startingPrice");
    expect(response.auction.currentBid).toBe(150);
  });

  it("sanitizes a public Socket.IO-shaped payload recursively", () => {
    const event = sanitizeLotPricing({
      event: "dealUpdate",
      lot: { ...product },
      auction: { startingPrice: 125, currentBid: 150 },
      dealBreakdown: { finalPrice: 175 },
    }, { product, viewer: {} });
    expect(event.lot).not.toHaveProperty("basePrice");
    expect(event.auction).not.toHaveProperty("startingPrice");
    expect(event.auction.currentBid).toBe(150);
    expect(event.dealBreakdown.finalPrice).toBe(175);
  });

  it("does not hide public Orchard Growers retail pricing", () => {
    const retailProduct = { ...product, createdSource: "admin-panel" };
    expect(sanitizeLotPricing(retailProduct, { product: retailProduct, viewer: {} }).basePrice).toBe(125);
  });

  it("does not expose a legacy unbid opening price through currentBid", () => {
    const response = sanitizeLotPricing({
      product,
      startingPrice: 125,
      currentBid: 125,
      highestGradeRate: 125,
      dealBreakdown: { dealAmount: 125 },
    }, { product, viewer: {} });
    expect(response).not.toHaveProperty("startingPrice");
    expect(response).not.toHaveProperty("currentBid");
    expect(response).not.toHaveProperty("highestGradeRate");
    expect(response).not.toHaveProperty("dealBreakdown");
  });
});
