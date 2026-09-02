import { afterEach, describe, expect, it, vi } from "vitest";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import Quotation from "../models/Quotation.js";
import { getPublicProfileMarketActivity } from "./userController.js";

const queryResult = (value) => ({
  select: vi.fn().mockReturnThis(),
  populate: vi.fn().mockReturnThis(),
  sort: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  lean: vi.fn().mockResolvedValue(value),
});

afterEach(() => vi.restoreAllMocks());

describe("public profile marketplace sections", () => {
  it("returns live lots, incomplete history, and completed deals without overlap", async () => {
    const live = {
      _id: "64b000000000000000000001",
      title: "Live Apples",
      fruitName: "Apple",
      status: "AVAILABLE",
      active: true,
      auctionEndTime: "2099-01-01T00:00:00.000Z",
      images: ["https://cdn.example.test/live.jpg"],
    };
    const incomplete = {
      _id: "64b000000000000000000002",
      title: "Expired Pears",
      fruitName: "Pear",
      status: "EXPIRED",
      active: false,
      images: ["https://cdn.example.test/history.jpg"],
      basePrice: 800,
    };
    const completed = {
      _id: "64b000000000000000000003",
      title: "Closed Plums",
      fruitName: "Plum",
      status: "SOLD",
      active: false,
      sampleVideo: "https://cdn.example.test/closed.mp4",
      acceptedBuyerId: "64b000000000000000000099",
      finalPrice: 9_999,
    };
    vi.spyOn(Product, "find").mockReturnValue(queryResult([live, incomplete, completed]));
    vi.spyOn(Order, "find").mockReturnValue(queryResult([
      {
        _id: "64b000000000000000000010",
        product: completed._id,
        paymentStatus: "PAID",
        finalPrice: 9_999,
      },
    ]));
    vi.spyOn(Quotation, "find").mockReturnValue(queryResult([
      { lot: incomplete._id },
      { lot: completed._id },
    ]));

    const result = await getPublicProfileMarketActivity("grower-1", "grower");

    expect(result.liveLots.map((item) => item._id)).toEqual([live._id]);
    expect(result.lotHistory).toHaveLength(1);
    expect(result.lotHistory[0]).toMatchObject({
      fruitName: "Pear",
      historyOutcome: "No Deal Confirmed",
      imageUrl: "https://cdn.example.test/history.jpg",
      readOnly: true,
      tradable: false,
    });
    expect(result.closedDeals).toHaveLength(1);
    expect(result.closedDeals[0]).toMatchObject({
      fruitName: "Plum",
      historyOutcome: "Deal Completed",
      sampleVideo: "https://cdn.example.test/closed.mp4",
      readOnly: true,
      tradable: false,
    });
    expect(result.historicalLots).toEqual(result.lotHistory);

    const serializedHistory = JSON.stringify([...result.lotHistory, ...result.closedDeals]);
    expect(serializedHistory).not.toContain(incomplete._id);
    expect(serializedHistory).not.toContain(completed._id);
    expect(serializedHistory).not.toContain(completed.acceptedBuyerId);
    expect(serializedHistory).not.toContain("9999");
    expect(new Set([
      ...result.lotHistory.map((item) => item.publicHistoryKey),
      ...result.closedDeals.map((item) => item.publicHistoryKey),
    ]).size).toBe(2);
  });
});
