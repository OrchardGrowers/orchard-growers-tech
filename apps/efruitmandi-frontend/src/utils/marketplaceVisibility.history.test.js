import { describe, expect, it } from "vitest";
import { isClosedDeal, isLiveDeal, normalizeDealStatus } from "./marketplaceVisibility";

describe("public historical lot visibility", () => {
  it.each([
    { historical: true },
    { readOnly: true },
    { tradable: false },
  ])("classifies a read-only history record as closed", (record) => {
    expect(normalizeDealStatus(record)).toBe("closed");
    expect(isClosedDeal(record)).toBe(true);
    expect(isLiveDeal(record)).toBe(false);
  });

  it("does not classify an ordinary active lot as history", () => {
    expect(normalizeDealStatus({ status: "IN_AUCTION" })).toBe("live");
  });
});
