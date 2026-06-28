import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildLinkedInCommentary,
  buildProfileRssXml,
  buildPublicProfileSnapshot,
  extractPublicCityState,
} from "./profilePublicationService.js";
import { buildLinkedInPostPayload } from "./linkedinProfilePublisher.js";

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env.EFRUITMANDI_PUBLIC_URL = "https://www.efruitmandi.live";
  process.env.EFRUITMANDI_DEFAULT_BRAND_IMAGE_URL =
    "https://www.efruitmandi.live/logo-original.png";
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("public profile publication privacy", () => {
  it("builds an allowlisted exporter snapshot without personal or address data", () => {
    const result = buildPublicProfileSnapshot(
      {
        _id: "507f1f77bcf86cd799439011",
        accountStatus: "ACTIVE",
        publicProfileRoles: ["buyer"],
        buyerBusinessType: "exporter",
        businessName: "Himalayan Fresh Exports",
        buyerLocation:
          "Plot 22, Market Road, Navi Mumbai, Maharashtra 400001, India",
        buyerCompanyLogoUrl:
          "https://res.cloudinary.com/demo/image/upload/exporter-logo.png",
        buyerAvatarUrl:
          "https://res.cloudinary.com/demo/image/upload/personal-photo.png",
        buyerContactPerson: "Private Person",
        phone: "+91 98765 43210",
        email: "private@example.com",
        gstNumber: "PRIVATE-GST",
      },
      "buyer"
    );

    expect(result.eligible).toBe(true);
    expect(result.snapshot).toMatchObject({
      firmName: "Himalayan Fresh Exports",
      businessType: "exporter",
      businessTypeLabel: "Exporter",
      city: "Navi Mumbai",
      state: "Maharashtra",
      logoUrl:
        "https://res.cloudinary.com/demo/image/upload/exporter-logo.png",
    });
    expect(Object.keys(result.snapshot).sort()).toEqual(
      [
        "businessType",
        "businessTypeLabel",
        "city",
        "description",
        "firmName",
        "logoUrl",
        "profileUrl",
        "state",
        "title",
      ].sort()
    );

    const serialized = JSON.stringify(result.snapshot);
    expect(serialized).not.toContain("Private Person");
    expect(serialized).not.toContain("98765");
    expect(serialized).not.toContain("private@example.com");
    expect(serialized).not.toContain("PRIVATE-GST");
    expect(serialized).not.toContain("Plot 22");
    expect(serialized).not.toContain("personal-photo");
  });

  it("uses explicit KYC district and state without copying the KYC payload", () => {
    const location = extractPublicCityState(
      {
        kycByRole: {
          grower: {
            district: "Shimla",
            state: "Himachal Pradesh",
            address: "Private full orchard address",
            phone: "9999999999",
          },
        },
      },
      "grower"
    );

    expect(location).toEqual({
      city: "Shimla",
      state: "Himachal Pradesh",
    });
  });

  it("prefers the grower's district/state field over a composed full address", () => {
    const location = extractPublicCityState(
      {
        addressLine3: "Shimla, Himachal Pradesh",
        location:
          "Private orchard road, Village Name, Shimla, Himachal Pradesh, Shimla, 171001",
      },
      "grower"
    );

    expect(location).toEqual({
      city: "Shimla",
      state: "Himachal Pradesh",
    });
  });

  it("requires explicit public consent and both city and state", () => {
    expect(
      buildPublicProfileSnapshot(
        {
          _id: "507f1f77bcf86cd799439011",
          accountStatus: "ACTIVE",
          publicProfileRoles: [],
          orchardName: "Private Orchard",
          location: "Shimla, Himachal Pradesh",
        },
        "grower"
      )
    ).toMatchObject({ eligible: false, reason: "not_public" });

    expect(
      buildPublicProfileSnapshot(
        {
          _id: "507f1f77bcf86cd799439011",
          accountStatus: "ACTIVE",
          publicProfileRoles: ["grower"],
          orchardName: "Public Orchard",
          location: "Shimla",
        },
        "grower"
      )
    ).toMatchObject({ eligible: false, reason: "missing_city_or_state" });
  });

  it("uses eFruitMandi branding when no official firm logo exists", () => {
    const result = buildPublicProfileSnapshot(
      {
        _id: "507f1f77bcf86cd799439011",
        accountStatus: "ACTIVE",
        publicProfileRoles: ["driver"],
        logisticsName: "Fresh Route Logistics",
        location: "Chandigarh, Chandigarh",
        avatarUrl:
          "https://res.cloudinary.com/demo/image/upload/personal-driver.png",
      },
      "driver"
    );

    expect(result.eligible).toBe(true);
    expect(result.snapshot.logoUrl).toBe(
      "https://www.efruitmandi.live/logo-original.png"
    );
    expect(result.snapshot.businessTypeLabel).toBe("Logistics");
    expect(JSON.stringify(result.snapshot)).not.toContain("personal-driver");
  });
});

describe("RSS and LinkedIn post output", () => {
  const snapshot = {
    firmName: "Green Valley Orchard",
    businessType: "grower",
    businessTypeLabel: "Grower",
    city: "Shimla",
    state: "Himachal Pradesh",
    logoUrl: "https://www.efruitmandi.live/logo-original.png",
    profileUrl:
      "https://www.efruitmandi.live/profiles/grower/507f1f77bcf86cd799439011",
    title: "New Grower Registered on eFruitMandi",
    description: buildLinkedInCommentary({
      businessTypeLabel: "Grower",
      firmName: "Green Valley Orchard",
      city: "Shimla",
      state: "Himachal Pradesh",
      profileUrl:
        "https://www.efruitmandi.live/profiles/grower/507f1f77bcf86cd799439011",
    }),
  };

  it("includes every required RSS field and a stable GUID", () => {
    const xml = buildProfileRssXml([
      {
        guid: "urn:efruitmandi:profile:507f1f77bcf86cd799439011:grower:registration",
        rssPublishedAt: new Date("2026-06-29T10:00:00.000Z"),
        snapshot,
      },
    ]);

    expect(xml).toContain("<title>New Grower Registered on eFruitMandi</title>");
    expect(xml).toContain("<efm:firmLogo>");
    expect(xml).toContain("<efm:businessType>Grower</efm:businessType>");
    expect(xml).toContain("<efm:city>Shimla</efm:city>");
    expect(xml).toContain("<efm:state>Himachal Pradesh</efm:state>");
    expect(xml).toContain("<efm:profileUrl>");
    expect(xml).toContain("<pubDate>Mon, 29 Jun 2026 10:00:00 GMT</pubDate>");
    expect(xml).toContain(
      "<guid isPermaLink=\"false\">urn:efruitmandi:profile:507f1f77bcf86cd799439011:grower:registration</guid>"
    );
  });

  it("creates a short professional Page post payload with an uploaded image", () => {
    const payload = buildLinkedInPostPayload({
      organizationUrn: "urn:li:organization:123456",
      snapshot,
      imageUrn: "urn:li:image:abc123",
    });

    expect(payload.author).toBe("urn:li:organization:123456");
    expect(payload.visibility).toBe("PUBLIC");
    expect(payload.lifecycleState).toBe("PUBLISHED");
    expect(payload.content.media.id).toBe("urn:li:image:abc123");
    expect(payload.commentary).toContain("View the complete profile");
    expect(payload.commentary).toContain("#eFruitMandi");
  });
});
