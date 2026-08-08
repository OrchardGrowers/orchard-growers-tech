import { describe, expect, it } from "vitest";
import {
  createCloudinaryKycDocumentMetadata,
  normalizeKycDocumentMetadata,
} from "./kycDocumentStorageService.js";

describe("KYC document storage metadata", () => {
  it("keeps legacy Cloudinary URL-only documents readable", () => {
    expect(normalizeKycDocumentMetadata({
      label: "pan",
      url: "https://res.cloudinary.com/example/image/upload/pan.jpg",
    }, { userId: "user-1", roleType: "buyer" })).toMatchObject({
      label: "pan",
      url: "https://res.cloudinary.com/example/image/upload/pan.jpg",
      storageProvider: "cloudinary",
      storageKey: "",
      roleType: "buyer",
    });
  });

  it("stores Cloudinary public ID as the provider-neutral storage key", () => {
    expect(createCloudinaryKycDocumentMetadata({
      secure_url: "https://res.cloudinary.com/example/image/upload/pan.jpg",
      public_id: "efruitmandi/kyc/buyer/user-1/pan",
      resource_type: "image",
      bytes: 12345,
    }, { label: "pan", userId: "user-1", roleType: "buyer", mimeType: "image/jpeg" }))
      .toMatchObject({
        storageProvider: "cloudinary",
        storageKey: "efruitmandi/kyc/buyer/user-1/pan",
        publicId: "efruitmandi/kyc/buyer/user-1/pan",
        mimeType: "image/jpeg",
      });
  });

  it("does not accept an unverified R2 provider reference from user payloads", () => {
    expect(normalizeKycDocumentMetadata({
      label: "pan",
      url: "https://example.invalid/object",
      storageProvider: "r2",
      storageKey: "predictable-user-value",
    })).toBeNull();
  });
});
