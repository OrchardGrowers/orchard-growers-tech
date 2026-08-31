import { describe, expect, it } from "vitest";
import {
  canDownloadCompletedFruitScanningReport,
  getNormalizedDetectionBoxStyle,
} from "./fruitScanningReport";

describe("fruit scanning report UI helpers", () => {
  it("keeps normalized boxes aligned independently of rendered image size", () => {
    expect(getNormalizedDetectionBoxStyle({ x: 0.1, y: 0.2, width: 0.3, height: 0.4 })).toEqual({
      left: "10%",
      top: "20%",
      width: "30%",
      height: "40%",
    });
  });

  it("rejects invalid persisted boxes", () => {
    expect(getNormalizedDetectionBoxStyle({ x: -1, y: 0, width: 1, height: 1 })).toBeNull();
  });

  it("enables authoritative report download only after lot-wide completion", () => {
    expect(canDownloadCompletedFruitScanningReport({ available: true, status: "COMPLETED" })).toBe(true);
    expect(canDownloadCompletedFruitScanningReport({ available: false, status: "PROCESSING" })).toBe(false);
    expect(canDownloadCompletedFruitScanningReport({ available: false, status: "REVIEW_REQUIRED" })).toBe(false);
  });
});
