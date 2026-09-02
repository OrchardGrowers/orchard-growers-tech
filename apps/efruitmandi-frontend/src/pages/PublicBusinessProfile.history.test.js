import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  getPublicRecordPath,
  partitionPublicProfileMarketActivity,
  PublicMarketLotCard,
  PublicReadOnlyLotDetails,
} from "./PublicBusinessProfile";

const historicalRecord = {
  publicHistoryKey: "history_safeOpaqueKey",
  title: "Royal Apple Lot",
  fruitName: "Apple",
  variety: "Royal Delicious",
  grade: "Grade A",
  quantity: 80,
  unit: "boxes",
  location: "Shimla, Himachal Pradesh",
  imageUrl: "https://cdn.example.test/apple-primary.jpg",
  images: ["https://cdn.example.test/apple-secondary.jpg"],
  sampleVideo: "https://cdn.example.test/apple.mp4",
  description: "Public orchard listing.",
  packingType: "Carton",
  packingBreakdown: [{ size: "Large", packageCount: 8, weightPerPackageKg: 10 }],
  historyOutcome: "No Buyer Interested",
  finalLifecycleStatus: "EXPIRED",
  historical: true,
  readOnly: true,
  tradable: false,
};

describe("public business profile lot history", () => {
  it("keeps live, incomplete history, and completed deals in separate sections", () => {
    const completed = {
      ...historicalRecord,
      publicHistoryKey: "history_completed",
      historyOutcome: "Deal Completed",
      finalLifecycleStatus: "COMPLETED",
    };
    const live = { _id: "live-lot", status: "AVAILABLE", tradable: true };
    const result = partitionPublicProfileMarketActivity({
      liveLots: [live],
      lotHistory: [historicalRecord, completed],
      closedDeals: [completed, completed],
    });

    expect(result.liveLots).toEqual([live]);
    expect(result.lotHistory).toEqual([historicalRecord]);
    expect(result.closedDeals).toEqual([completed]);
  });

  it("partitions the older overloaded closedDeals payload for backward compatibility", () => {
    const completed = {
      ...historicalRecord,
      publicHistoryKey: "history_completed",
      historyOutcome: "Deal Completed",
      finalLifecycleStatus: "COMPLETED",
    };
    const result = partitionPublicProfileMarketActivity({
      liveLots: [],
      closedDeals: [historicalRecord, completed],
    });
    expect(result.lotHistory).toEqual([historicalRecord]);
    expect(result.closedDeals).toEqual([completed]);
  });

  it("uses public media on a history card and exposes only View Details", () => {
    const html = renderToStaticMarkup(
      <PublicMarketLotCard item={historicalRecord} onOpen={() => {}} />
    );
    expect(html).toContain("https://cdn.example.test/apple-primary.jpg");
    expect(html).toContain("View Details");
    expect(html).not.toMatch(/>Offer(?: Price)?</i);
    expect(html).not.toMatch(/>Contact Buyer</i);
  });

  it("builds opaque-key detail navigation without an internal id", () => {
    expect(getPublicRecordPath("/growers/safe-grower", historicalRecord.publicHistoryKey)).toBe(
      "/growers/safe-grower/records/history_safeOpaqueKey"
    );
  });

  it("renders media and allowed details in a permanently read-only detail view", () => {
    const html = renderToStaticMarkup(<PublicReadOnlyLotDetails item={historicalRecord} />);
    expect(html).toContain("https://cdn.example.test/apple-primary.jpg");
    expect(html).toContain("https://cdn.example.test/apple-secondary.jpg");
    expect(html).toContain("https://cdn.example.test/apple.mp4");
    expect(html).toContain("Public orchard listing.");
    expect(html).toContain("Packaging breakdown");
    expect(html).toContain("8 package(s)");
    expect(html).toContain("Trading disabled");
    expect(html).not.toMatch(/>Quote</i);
    expect(html).not.toMatch(/>Offer Price</i);
    expect(html).not.toMatch(/>Contact Buyer</i);
  });

  it("keeps the existing live-lot card interaction and does not label it read-only", () => {
    const html = renderToStaticMarkup(
      <PublicMarketLotCard
        item={{ _id: "live-lot", title: "Live Apples", status: "AVAILABLE", imageUrl: historicalRecord.imageUrl }}
        onOpen={() => {}}
      />
    );
    expect(html).toMatch(/^<button/);
    expect(html).not.toContain("Historical record");
    expect(html).not.toContain("View Details");
  });
});
