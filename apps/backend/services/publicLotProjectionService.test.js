import { describe, expect, it } from "vitest";
import {
  PUBLIC_LOT_SEARCH_SELECT,
  PUBLIC_PROFILE_MARKET_LOT_SELECT,
} from "./publicLotProjectionService.js";
import Product from "../models/Product.js";

describe("public fruit-lot database projections", () => {
  it.each([PUBLIC_LOT_SEARCH_SELECT, PUBLIC_PROFILE_MARKET_LOT_SELECT])(
    "never selects confidential price fields",
    (projection) => {
      const selected = new Set(projection.split(/\s+/));
      expect(selected.has("basePrice")).toBe(false);
      expect(selected.has("startingPrice")).toBe(false);
      expect(selected.has("reservePrice")).toBe(false);
      expect(selected.has("finalPrice")).toBe(false);
      expect(selected.has("finalDealValue")).toBe(false);
      expect(selected.has("organicCertificationNo")).toBe(false);
      expect(selected.has("organicCertificateUrl")).toBe(false);
    }
  );

  it("selects the public media and packing fields needed by profile history", () => {
      const selected = new Set(PUBLIC_PROFILE_MARKET_LOT_SELECT.split(/\s+/));
      for (const publicField of [
        "description",
        "images",
        "imageObjects",
        "sampleVideo",
        "packingType",
        "packingBreakdown",
        "packingSummary",
      ]) {
        expect(selected.has(publicField)).toBe(true);
      }
      const hasPersistedSafeCertificateBoolean = Boolean(
        Product.schema.path("hasOrganicCertificateProof")
      );
      expect(hasPersistedSafeCertificateBoolean).toBe(false);
      expect(selected.has("hasOrganicCertificateProof")).toBe(
        hasPersistedSafeCertificateBoolean
      );
      expect(selected.has("organicCertificationNo")).toBe(false);
      expect(selected.has("organicCertificateUrl")).toBe(false);
      expect(selected.has("organicCertificatePublicId")).toBe(false);
  });
});
