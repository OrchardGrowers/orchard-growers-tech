import { describe, expect, it } from "vitest";
import { canLotAcceptOffers, isHistoricalLot, isPublicLotVisible } from "./dealLifecycleService.js";
import {
  partitionPublicHistoricalLots,
  sanitizePublicHistoricalLot,
} from "./publicLotHistoryService.js";

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
  quality: "Certified Organic",
  description: "Fresh orchard-picked fruit packed for safe transport.",
  images: ["https://cdn.example.test/apple-primary.jpg", "javascript:alert(1)"],
  imageObjects: [{
    url: "https://cdn.example.test/apple-secondary.jpg",
    publicId: "private-cloud-id",
    alt: "Apple lot",
    isPrimary: true,
  }],
  sampleVideo: "https://cdn.example.test/apple-lot.mp4",
  videos: ["file:///private/video.mp4"],
  packingType: "Carton",
  packingWeightKg: 10,
  packingSummary: { totalPackages: 12, totalWeightKg: 120, privateNote: "hidden" },
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
    expect(result).toMatchObject({
      imageUrl: "https://cdn.example.test/apple-secondary.jpg",
      images: [
        "https://cdn.example.test/apple-primary.jpg",
        "https://cdn.example.test/apple-secondary.jpg",
      ],
      sampleVideo: "https://cdn.example.test/apple-lot.mp4",
      videos: ["https://cdn.example.test/apple-lot.mp4"],
      description: "Fresh orchard-picked fruit packed for safe transport.",
      packingType: "Carton",
      packingWeightKg: 10,
      hasOrganicCertificateProof: true,
    });
    expect(result.imageObjects[0]).not.toHaveProperty("publicId");
    expect(result.packingSummary).not.toHaveProperty("privateNote");
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
      "private-cloud-id",
      "file:///private/video.mp4",
    ]) {
      expect(serialized).not.toContain(String(privateValue));
    }
    expect(result).not.toHaveProperty("_id");
    expect(result).not.toHaveProperty("basePrice");
    expect(result).not.toHaveProperty("reservePrice");
  });

  it("drops a public description when it contains contact or private-account data", () => {
    const result = sanitizePublicHistoricalLot({
      ...privateHistoricalLot,
      description: "Call 9876543210 or email private@example.test for bank details",
    });
    expect(result).not.toHaveProperty("description");
  });

  it("preserves an explicitly supplied safe certificate boolean without exposing certificate data", () => {
    const result = sanitizePublicHistoricalLot({
      ...privateHistoricalLot,
      quality: "Grade A",
      hasOrganicCertificateProof: true,
    });
    expect(result.hasOrganicCertificateProof).toBe(true);
    expect(result).not.toHaveProperty("organicCertificationNo");
    expect(result).not.toHaveProperty("organicCertificateUrl");
    expect(result).not.toHaveProperty("organicCertificatePublicId");
  });

  it("never derives the public certificate indicator from private persisted certificate fields", () => {
    const result = sanitizePublicHistoricalLot({
      ...privateHistoricalLot,
      quality: "Grade A",
      hasOrganicCertificateProof: false,
      organicCertificationNo: "PRIVATE-CERTIFICATE-NUMBER",
      organicCertificateUrl: "https://private.example.test/certificate.pdf",
    });
    expect(result.hasOrganicCertificateProof).toBe(false);
    expect(JSON.stringify(result)).not.toContain("PRIVATE-CERTIFICATE-NUMBER");
    expect(JSON.stringify(result)).not.toContain("private.example.test");
  });

  it("keeps the persisted sampleVideo field only when its URL is public-safe", () => {
    const safe = sanitizePublicHistoricalLot({
      ...privateHistoricalLot,
      sampleVideo: "/uploads/lots/public-sample.mp4",
      videos: ["https://cdn.example.test/not-a-persisted-field.mp4"],
      videoUrls: ["https://cdn.example.test/not-a-schema-field.mp4"],
    });
    expect(safe.sampleVideo).toBe("/uploads/lots/public-sample.mp4");
    expect(safe.videos).toEqual(["/uploads/lots/public-sample.mp4"]);

    const unsafe = sanitizePublicHistoricalLot({
      ...privateHistoricalLot,
      sampleVideo: "file:///private/sample.mp4",
    });
    expect(unsafe).not.toHaveProperty("sampleVideo");
    expect(unsafe.videos).toEqual([]);
  });

  it("partitions incomplete history and completed transactions without duplicates", () => {
    const incomplete = { ...privateHistoricalLot, _id: "64b000000000000000000011" };
    const completed = { ...privateHistoricalLot, _id: "64b000000000000000000012" };
    const completedOrderByProductId = new Map([
      [String(completed._id), { paymentStatus: "PAID", updatedAt: completed.updatedAt }],
    ]);
    const result = partitionPublicHistoricalLots(
      [incomplete, completed, completed],
      { completedOrderByProductId }
    );

    expect(result.lotHistory).toHaveLength(1);
    expect(result.closedDeals).toHaveLength(1);
    expect(result.lotHistory[0].historyOutcome).toBe("No Buyer Interested");
    expect(result.closedDeals[0].historyOutcome).toBe("Deal Completed");
    expect(result.lotHistory[0].publicHistoryKey).not.toBe(result.closedDeals[0].publicHistoryKey);
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
