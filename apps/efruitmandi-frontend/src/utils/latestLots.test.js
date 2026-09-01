import { describe, expect, it } from "vitest";
import {
  getCurrentlyLiveTradableLots,
  getNotificationsDashboardMetrics,
} from "./latestLots";

describe("Notifications Latest Lots summary", () => {
  it("returns zero when there are no qualifying live lots", () => {
    expect(getNotificationsDashboardMetrics({ marketplaceLots: [] }).latestLots).toBe(0);
  });

  it("counts currently active and tradable marketplace lots", () => {
    const marketplaceLots = [
      { _id: "available", status: "AVAILABLE" },
      { _id: "active", status: "ACTIVE" },
      { _id: "auction", status: "IN_AUCTION" },
      { _id: "upcoming", status: "SCHEDULED" },
    ];

    expect(getCurrentlyLiveTradableLots(marketplaceLots).map((lot) => lot._id)).toEqual([
      "available",
      "active",
      "auction",
    ]);
  });

  it("excludes historical and otherwise non-tradable lifecycle states", () => {
    const marketplaceLots = [
      { status: "ACTIVE", historical: true },
      { status: "ACTIVE", readOnly: true },
      { status: "ACTIVE", tradable: false },
      { status: "CLOSED" },
      { status: "EXPIRED" },
      { status: "COMPLETED" },
      { status: "NO_BUYER_INTEREST" },
      { status: "NO_DEAL_CONFIRMED" },
    ];

    expect(getCurrentlyLiveTradableLots(marketplaceLots)).toEqual([]);
  });

  it("does not derive the lot count from notification or unread counts", () => {
    const marketplaceLots = [{ status: "ACTIVE" }];
    const notifications = Array.from({ length: 17 }, (_, index) => ({
      id: `notification-${index}`,
      read: index < 3,
    }));

    expect(
      getNotificationsDashboardMetrics({ marketplaceLots, notifications })
    ).toEqual({ latestLots: 1, unread: 14 });
  });

  it("does not cap the count at the notification display limit", () => {
    const marketplaceLots = Array.from({ length: 15 }, (_, index) => ({
      _id: `lot-${index}`,
      status: "ACTIVE",
    }));

    expect(getNotificationsDashboardMetrics({ marketplaceLots }).latestLots).toBe(15);
  });
});
