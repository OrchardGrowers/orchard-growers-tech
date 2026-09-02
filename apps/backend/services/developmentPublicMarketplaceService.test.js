import { afterEach, describe, expect, it } from "vitest";
import {
  isDevelopmentPublicMarketplaceEnabled,
  isDevelopmentPublicMarketplaceRequest,
  loadDevelopmentPublicProducts,
  sanitizeDevelopmentPublicAuction,
  sanitizeDevelopmentPublicProduct,
  sanitizeDevelopmentPublicProfile,
} from "./developmentPublicMarketplaceService.js";

const originalNodeEnv = process.env.NODE_ENV;
const originalAppEnv = process.env.APP_ENV;
const originalSource = process.env.DEV_PUBLIC_MARKETPLACE_SOURCE;

afterEach(() => {
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
  if (originalAppEnv === undefined) delete process.env.APP_ENV;
  else process.env.APP_ENV = originalAppEnv;
  if (originalSource === undefined) delete process.env.DEV_PUBLIC_MARKETPLACE_SOURCE;
  else process.env.DEV_PUBLIC_MARKETPLACE_SOURCE = originalSource;
});

describe("development public marketplace boundary", () => {
  it("can only be enabled outside production", () => {
    process.env.DEV_PUBLIC_MARKETPLACE_SOURCE = "production";
    process.env.NODE_ENV = "development";
    process.env.APP_ENV = "development";
    expect(isDevelopmentPublicMarketplaceEnabled()).toBe(true);

    process.env.NODE_ENV = "production";
    expect(isDevelopmentPublicMarketplaceEnabled()).toBe(false);

    process.env.NODE_ENV = "development";
    process.env.APP_ENV = "production";
    expect(isDevelopmentPublicMarketplaceEnabled()).toBe(false);
  });

  it("accepts only explicitly marked GET requests", () => {
    process.env.NODE_ENV = "development";
    process.env.APP_ENV = "development";
    process.env.DEV_PUBLIC_MARKETPLACE_SOURCE = "production";
    expect(isDevelopmentPublicMarketplaceRequest({ method: "GET", query: { devPublicMarketplace: "1" } })).toBe(true);
    expect(isDevelopmentPublicMarketplaceRequest({ method: "POST", query: { devPublicMarketplace: "1" } })).toBe(false);
    expect(isDevelopmentPublicMarketplaceRequest({ method: "GET", query: {} })).toBe(false);
  });

  it("does not make a production request when the flag is off", async () => {
    process.env.NODE_ENV = "development";
    process.env.APP_ENV = "development";
    process.env.DEV_PUBLIC_MARKETPLACE_SOURCE = "local";
    await expect(loadDevelopmentPublicProducts({ method: "GET", query: { devPublicMarketplace: "1" } })).resolves.toBeNull();
  });

  it("strictly sanitizes public grower and buyer profiles", () => {
    const result = sanitizeDevelopmentPublicProfile({
      _id: "507f1f77bcf86cd799439011",
      role: "grower",
      orchardName: "Safe Orchard",
      email: "private@example.com",
      phone: "+91 9999999999",
      kyc: { aadhaar: "secret" },
      kycByRole: { grower: { pan: "SECRET" } },
      adminNotes: "private",
      location: "House 12, Secret Road, Shimla, Himachal Pradesh, 171001",
    });

    expect(result.orchardName).toBe("Safe Orchard");
    expect(result._id).toMatch(/^pub_/);
    expect(result._id).not.toContain("507f1f77bcf86cd799439011");
    expect(result.location).toBe("Shimla, Himachal Pradesh");
    expect(JSON.stringify(result)).not.toContain("private@example.com");
    expect(result).not.toHaveProperty("phone");
    expect(result).not.toHaveProperty("kyc");
    expect(result).not.toHaveProperty("kycByRole");
    expect(result).not.toHaveProperty("adminNotes");
  });

  it("removes private pricing, relational IDs, storage IDs, and scan IDs", () => {
    const result = sanitizeDevelopmentPublicProduct({
      _id: "507f1f77bcf86cd799439012",
      title: "Apple Lot",
      basePrice: 999,
      reservePrice: 888,
      acceptedBuyerId: "507f1f77bcf86cd799439013",
      organicCertificationNo: "PRIVATE-CERT",
      organicCertificateUrl: "https://private.example/cert.pdf",
      imageObjects: [{ url: "https://cdn.example/lot.jpg", publicId: "cloudinary-secret" }],
      createdBy: {
        _id: "507f1f77bcf86cd799439014",
        role: "grower",
        orchardName: "Public Orchard",
        phone: "9999999999",
        email: "grower@example.com",
      },
      fruitScanningReport: {
        available: true,
        analyses: [{ scanId: "internal-scan", status: "COMPLETED", imageUrl: "https://cdn.example/scan.jpg" }],
      },
    });

    expect(result).not.toHaveProperty("basePrice");
    expect(result._id).toMatch(/^pub_/);
    expect(JSON.stringify(result)).not.toContain("507f1f77bcf86cd799439012");
    expect(JSON.stringify(result)).not.toContain("507f1f77bcf86cd799439014");
    expect(result).not.toHaveProperty("reservePrice");
    expect(result).not.toHaveProperty("acceptedBuyerId");
    expect(result).not.toHaveProperty("organicCertificationNo");
    expect(result.imageObjects[0]).not.toHaveProperty("publicId");
    expect(result.createdBy).not.toHaveProperty("phone");
    expect(result.createdBy).not.toHaveProperty("email");
    expect(result.fruitScanningReport.analyses[0]).not.toHaveProperty("scanId");
  });

  it("does not expose bidder or private auction calculations", () => {
    const result = sanitizeDevelopmentPublicAuction({
      _id: "507f1f77bcf86cd799439015",
      product: { _id: "507f1f77bcf86cd799439012", title: "Apple Lot" },
      currentBid: 1200,
      startingPrice: 800,
      highestBidder: { _id: "507f1f77bcf86cd799439016", email: "buyer@example.com" },
      dealBreakdown: { sellerReceivable: 1000 },
    });

    expect(result.currentBid).toBe(1200);
    expect(result._id).toMatch(/^pub_/);
    expect(JSON.stringify(result)).not.toContain("507f1f77bcf86cd799439015");
    expect(result).not.toHaveProperty("startingPrice");
    expect(result).not.toHaveProperty("highestBidder");
    expect(result).not.toHaveProperty("dealBreakdown");
  });

  it("preserves only read-only public fields for historical lots", () => {
    const result = sanitizeDevelopmentPublicProduct({
      publicHistoryKey: "history_safe",
      fruitName: "Apple",
      variety: "Gala",
      quantity: 20,
      location: "Secret Road, Shimla, Himachal Pradesh, 171001",
      offerCount: 0,
      historyOutcome: "No Buyer Interested",
      finalLifecycleStatus: "EXPIRED",
      historical: true,
      readOnly: true,
      tradable: false,
      images: ["https://cdn.example.test/history.jpg", "javascript:alert(1)"],
      imageObjects: [{
        url: "https://cdn.example.test/history-secondary.jpg",
        publicId: "private-media-id",
        isPrimary: true,
      }],
      sampleVideo: "https://cdn.example.test/history.mp4",
      videos: ["file:///private/history.mp4"],
      description: "Public orchard lot description.",
      quality: "Grade A",
      packingType: "Carton",
      _id: "507f1f77bcf86cd799439012",
      basePrice: 900,
      finalPrice: 1200,
      acceptedBuyerId: "507f1f77bcf86cd799439013",
      phone: "9999999999",
    });

    expect(result).toMatchObject({
      fruitName: "Apple",
      location: "Shimla, Himachal Pradesh",
      historyOutcome: "No Buyer Interested",
      readOnly: true,
      tradable: false,
      imageUrl: "https://cdn.example.test/history-secondary.jpg",
      sampleVideo: "https://cdn.example.test/history.mp4",
      description: "Public orchard lot description.",
      packingType: "Carton",
    });
    expect(result.images).toEqual([
      "https://cdn.example.test/history.jpg",
      "https://cdn.example.test/history-secondary.jpg",
    ]);
    expect(result.videos).toEqual(["https://cdn.example.test/history.mp4"]);
    expect(JSON.stringify(result)).not.toContain("private-media-id");
    expect(JSON.stringify(result)).not.toContain("file:///private/history.mp4");
    expect(result).not.toHaveProperty("_id");
    expect(result).not.toHaveProperty("basePrice");
    expect(result).not.toHaveProperty("finalPrice");
    expect(result).not.toHaveProperty("acceptedBuyerId");
    expect(result).not.toHaveProperty("phone");
  });
});
