import { afterEach, describe, expect, it, vi } from "vitest";
import Product from "../models/Product.js";
import {
  canAccessNonPublicLot,
  getProductById,
} from "./productController.js";

const createResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("product detail public access prerequisites", () => {
  it("returns 404 for a malformed ObjectId without querying MongoDB", async () => {
    const findById = vi.spyOn(Product, "findById");
    const res = createResponse();

    await getProductById({ params: { id: "not-an-object-id" }, query: {} }, res);

    expect(findById).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ msg: "Product not found" });
  });

  it("returns 500 when the product lookup fails", async () => {
    vi.spyOn(Product, "findById").mockImplementation(() => {
      throw new Error("database unavailable");
    });
    const res = createResponse();

    await getProductById({
      params: { id: "64b000000000000000000001" },
      query: { platform: "efruitmandi" },
    }, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ msg: "database unavailable" });
  });

  it("recognizes the owner, accepted buyer, or an authenticated admin as a non-public viewer", () => {
    const product = {
      createdBy: "64b000000000000000000001",
      acceptedBuyerId: "64b000000000000000000003",
    };
    expect(canAccessNonPublicLot(product, { id: "64b000000000000000000001", role: "grower" })).toBe(true);
    expect(canAccessNonPublicLot(product, { id: "64b000000000000000000002", role: "ADMIN" })).toBe(true);
    expect(canAccessNonPublicLot(product, { id: "64b000000000000000000003", role: "buyer" })).toBe(true);
    expect(canAccessNonPublicLot(product, { id: "64b000000000000000000002", role: "buyer" })).toBe(false);
    expect(canAccessNonPublicLot(product, null)).toBe(false);
  });
});
