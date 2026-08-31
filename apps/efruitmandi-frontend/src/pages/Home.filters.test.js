import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ExclusiveHomeListingMode,
  HOME_LISTING_FILTERS,
  getHomepageFilteredListings,
  isOrganicLot,
  isPremiumOrganicLot,
} from "./Home";

const growers = [
  { _id: "registered", orchardName: "Registered Orchard", isKycVerified: false, isOgVerified: false },
  { _id: "verified", orchardName: "Verified Valley", isKycVerified: true, isOgVerified: false },
  { _id: "og", orchardName: "Organic Heights", isKycVerified: true, isOgVerified: true },
];

const buyers = [
  { _id: "buyer-registered", companyName: "Registered Buyer", isKycVerified: false, isOgVerified: false },
  { _id: "buyer-verified", companyName: "Verified Buyer", isKycVerified: true, isOgVerified: false },
  { _id: "buyer-og", companyName: "OG Buyer", isKycVerified: true, isOgVerified: true },
];

const filter = (filterKey, overrides = {}) =>
  getHomepageFilteredListings({
    filter: filterKey,
    search: "",
    liveLots: [],
    allDealListings: [],
    growers,
    buyers,
    ...overrides,
  });

describe("Home listing filters", () => {
  it("renders exactly one mutually exclusive Home listing mode", () => {
    const filteredMarkup = renderToStaticMarkup(
      <ExclusiveHomeListingMode
        filterActive
        filteredContent={<section data-mode="filtered">Filtered category</section>}
        defaultContent={<section data-mode="default">Default feed</section>}
      />
    );
    const defaultMarkup = renderToStaticMarkup(
      <ExclusiveHomeListingMode
        filterActive={false}
        filteredContent={<section data-mode="filtered">Filtered category</section>}
        defaultContent={<section data-mode="default">Default feed</section>}
      />
    );

    expect(filteredMarkup).toContain('data-mode="filtered"');
    expect(filteredMarkup).not.toContain('data-mode="default"');
    expect(defaultMarkup).toContain('data-mode="default"');
    expect(defaultMarkup).not.toContain('data-mode="filtered"');
  });

  it("separates registered, KYC-verified, and approved OG grower categories", () => {
    expect(filter(HOME_LISTING_FILTERS.REGISTERED_FRUIT_GROWERS).items).toHaveLength(3);
    expect(
      filter(HOME_LISTING_FILTERS.VERIFIED_FRUIT_GROWERS).items.map((item) => item._id)
    ).toEqual(["verified", "og"]);
    expect(
      filter(HOME_LISTING_FILTERS.OG_VERIFIED_FRUIT_GROWERS).items.map((item) => item._id)
    ).toEqual(["og"]);
  });

  it("applies the same role-specific rules to buyer categories", () => {
    expect(filter(HOME_LISTING_FILTERS.REGISTERED_FRUIT_BUYERS).items).toHaveLength(3);
    expect(
      filter(HOME_LISTING_FILTERS.VERIFIED_FRUIT_BUYERS).items.map((item) => item._id)
    ).toEqual(["buyer-verified", "buyer-og"]);
    expect(
      filter(HOME_LISTING_FILTERS.OG_VERIFIED_FRUIT_BUYERS).items.map((item) => item._id)
    ).toEqual(["buyer-og"]);
  });

  it("searches only inside the selected category", () => {
    const result = filter(HOME_LISTING_FILTERS.VERIFIED_FRUIT_BUYERS, {
      search: "OG Buyer",
    });

    expect(result.kind).toBe("profiles");
    expect(result.items.map((item) => item._id)).toEqual(["buyer-og"]);
  });

  it("returns every matching live lot without a client-side result cap", () => {
    const liveLots = Array.from({ length: 38 }, (_, index) => ({
      _id: `lot-${index}`,
      fruitName: `Apple ${index}`,
    }));

    expect(filter(HOME_LISTING_FILTERS.LIVE_FRUIT_LOTS, { liveLots }).items).toHaveLength(38);
  });

  it("returns every matching published profile without applying the default-feed size", () => {
    const allGrowers = Array.from({ length: 38 }, (_, index) => ({
      _id: `grower-${index}`,
      orchardName: `Orchard ${index}`,
      isKycVerified: true,
      isOgVerified: false,
    }));

    expect(
      filter(HOME_LISTING_FILTERS.VERIFIED_FRUIT_GROWERS, { growers: allGrowers }).items
    ).toHaveLength(38);
  });

  it("requires an accepted organic quality and certificate proof", () => {
    const certified = {
      quality: "Grade B Certified Organic / Natural Quality",
      hasOrganicCertificateProof: true,
    };
    const legacyCertified = {
      quality: "Premium Certified Organic Export Quality",
      organicCertificationNo: "CERT-1",
    };

    expect(isOrganicLot(certified)).toBe(true);
    expect(isOrganicLot({ ...certified, hasOrganicCertificateProof: false })).toBe(false);
    expect(isOrganicLot(legacyCertified)).toBe(true);
    expect(isOrganicLot({ quality: "Grade A+ Premium Quality", hasOrganicCertificateProof: true })).toBe(false);
    expect(isPremiumOrganicLot(certified)).toBe(false);
    expect(isPremiumOrganicLot(legacyCertified)).toBe(true);
  });

  it("requires strict OG status plus a qualifying public lot for organic grower categories", () => {
    const allDealListings = [
      {
        _id: "organic-lot",
        createdBy: { _id: "og" },
        quality: "Grade B Certified Organic / Natural Quality",
        hasOrganicCertificateProof: true,
      },
      {
        _id: "unproved-lot",
        createdBy: { _id: "verified" },
        quality: "Grade A+ Premium Certified Organic / Natural Quality",
        hasOrganicCertificateProof: false,
      },
    ];

    expect(
      filter(HOME_LISTING_FILTERS.OG_VERIFIED_ORGANIC_FRUIT_GROWERS, {
        allDealListings,
      }).items.map((item) => item._id)
    ).toEqual(["og"]);
    expect(
      filter(HOME_LISTING_FILTERS.OG_VERIFIED_PREMIUM_ORGANIC_FRUIT_GROWERS, {
        allDealListings,
      }).items
    ).toEqual([]);
  });

  it.each([
    [HOME_LISTING_FILTERS.LIVE_FRUIT_LOTS, "Ruby Lot", "ruby-lot"],
    [HOME_LISTING_FILTERS.VERIFIED_FRUIT_GROWERS, "Organic Heights", "og"],
    [HOME_LISTING_FILTERS.VERIFIED_FRUIT_BUYERS, "OG Buyer", "buyer-og"],
    [HOME_LISTING_FILTERS.OG_VERIFIED_FRUIT_GROWERS, "Organic Heights", "og"],
    [HOME_LISTING_FILTERS.OG_VERIFIED_FRUIT_BUYERS, "OG Buyer", "buyer-og"],
    [HOME_LISTING_FILTERS.REGISTERED_FRUIT_GROWERS, "Organic Heights", "og"],
    [HOME_LISTING_FILTERS.REGISTERED_FRUIT_BUYERS, "OG Buyer", "buyer-og"],
    [HOME_LISTING_FILTERS.OG_VERIFIED_ORGANIC_FRUIT_GROWERS, "Organic Heights", "og"],
    [HOME_LISTING_FILTERS.OG_VERIFIED_PREMIUM_ORGANIC_FRUIT_GROWERS, "Organic Heights", "og"],
  ])("keeps search scoped to %s", (filterKey, search, expectedId) => {
    const result = filter(filterKey, {
      search,
      liveLots: [{ _id: "ruby-lot", title: "Ruby Lot" }, { _id: "other-lot", title: "Other Lot" }],
      allDealListings: [{
        _id: "premium-organic-lot",
        createdBy: { _id: "og" },
        quality: "Grade A+ Premium Certified Organic / Natural Quality",
        hasOrganicCertificateProof: true,
      }],
    });

    expect(result.items.map((item) => item._id)).toEqual([expectedId]);
  });

  it("returns a category-specific empty state only for a genuine empty result", () => {
    const result = filter(HOME_LISTING_FILTERS.OG_VERIFIED_FRUIT_BUYERS, {
      buyers: [],
    });

    expect(result.items).toEqual([]);
    expect(result.emptyText).toBe("No OG Verified Fruit Buyers are available.");
  });

  it("keeps rapid filter evaluations independent and does not mutate source lists", () => {
    const originalGrowers = growers.map((profile) => ({ ...profile }));
    const registered = filter(HOME_LISTING_FILTERS.REGISTERED_FRUIT_GROWERS);
    const ogOnly = filter(HOME_LISTING_FILTERS.OG_VERIFIED_FRUIT_GROWERS);
    const verified = filter(HOME_LISTING_FILTERS.VERIFIED_FRUIT_GROWERS);

    expect(registered.items).toHaveLength(3);
    expect(ogOnly.items.map((item) => item._id)).toEqual(["og"]);
    expect(verified.items.map((item) => item._id)).toEqual(["verified", "og"]);
    expect(growers).toEqual(originalGrowers);
  });
});
