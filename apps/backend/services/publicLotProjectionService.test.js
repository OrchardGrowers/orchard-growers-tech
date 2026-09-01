import { describe, expect, it } from "vitest";
import {
  PUBLIC_LOT_SEARCH_SELECT,
  PUBLIC_PROFILE_MARKET_LOT_SELECT,
} from "./publicLotProjectionService.js";

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
    }
  );
});
