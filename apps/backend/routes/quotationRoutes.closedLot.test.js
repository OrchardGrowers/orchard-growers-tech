import { afterEach, describe, expect, it, vi } from "vitest";
import Product from "../models/Product.js";
import User from "../models/User.js";
import { createQuoteForLot } from "./quotationRoutes.js";

afterEach(() => vi.restoreAllMocks());

describe("historical lot offer authorization", () => {
  it.each([
    ["expired", { status: "EXPIRED", active: true }],
    ["cancelled", { status: "CANCELLED", active: true }],
    ["sold", { status: "SOLD", active: true }],
    ["deleted", { status: "DELETED", active: false }],
    ["inactive", { status: "AVAILABLE", active: false }],
    ["ended", { status: "IN_AUCTION", active: true, auctionEndTime: "2020-01-01T00:00:00.000Z" }],
  ])("rejects a new offer for a %s historical lot", async (_label, state) => {
    const product = {
      _id: "64b000000000000000000010",
      createdSource: "grower",
      createdBy: { _id: "64b000000000000000000001" },
      ...state,
    };
    vi.spyOn(Product, "findById").mockReturnValue({
      populate: vi.fn().mockResolvedValue(product),
    });
    vi.spyOn(User, "findById").mockReturnValue({
      select: vi.fn().mockResolvedValue({
        _id: "64b000000000000000000002",
        role: "buyer",
        profileTypes: ["buyer"],
      }),
    });
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };

    await createQuoteForLot(
      { params: { lotId: product._id }, body: {}, user: { id: "64b000000000000000000002" } },
      res
    );

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      code: "LOT_CLOSED",
      msg: "This historical fruit lot is read-only and cannot accept new offers.",
    });
  });
});
