import { describe, expect, it } from "vitest";
import {
  FRUIT_ANALYSIS_VERSION,
  hasCurrentCompletedFruitAnalysis,
  normalizeProviderResult,
} from "./fruitAnalysisProviderService.js";

const box = (x, y, width, height) => ({ x, y, width, height });

describe("fruit object-analysis provider contract", () => {
  it("counts fruit only and suppresses duplicate fruit detections", () => {
    const result = normalizeProviderResult({
      modelProvider: "test-provider",
      modelVersion: "detector-1",
      detections: [
        { category: "FRUIT", label: "apple", confidence: 0.96, boundingBox: box(0.1, 0.1, 0.2, 0.2) },
        { category: "FRUIT", label: "apple", confidence: 0.81, boundingBox: box(0.11, 0.11, 0.2, 0.2) },
        { category: "FRUIT", label: "apple", confidence: 0.9, boundingBox: box(0.55, 0.2, 0.2, 0.2) },
        { category: "NON_FRUIT", label: "carton", confidence: 0.99, boundingBox: box(0, 0, 1, 1) },
      ],
    });
    expect(result.status).toBe("COMPLETED");
    expect(result.fruitCount).toBe(2);
    expect(result.detections.filter((item) => item.category === "FRUIT")).toHaveLength(2);
  });

  it("never counts a hand and requires review for significant obstruction", () => {
    const result = normalizeProviderResult({
      modelProvider: "test-provider",
      modelVersion: "detector-1",
      detections: [
        { category: "FRUIT", label: "apple", confidence: 0.9, boundingBox: box(0.1, 0.1, 0.2, 0.2) },
        { category: "OBSTRUCTION", label: "hand", confidence: 0.93, boundingBox: box(0.3, 0.2, 0.45, 0.4) },
      ],
      colour: { dominant: "red" },
    });
    expect(result.fruitCount).toBe(1);
    expect(result.status).toBe("REVIEW_REQUIRED");
    expect(result.failureCode).toBe("TOO_MUCH_OBSTRUCTION");
    expect(result.colour).toBeNull();
  });

  it("does not complete analysis when no fruit is detected", () => {
    const result = normalizeProviderResult({
      modelProvider: "test-provider",
      modelVersion: "detector-1",
      detections: [
        { category: "NON_FRUIT", label: "tray", confidence: 0.94, boundingBox: box(0.1, 0.1, 0.8, 0.8) },
      ],
    });
    expect(result.fruitCount).toBe(0);
    expect(result.status).toBe("REVIEW_REQUIRED");
    expect(result.failureCode).toBe("FRUIT_NOT_DETECTED");
  });

  it("treats a completed image hash and analysis version as idempotent", () => {
    expect(hasCurrentCompletedFruitAnalysis({
      status: "COMPLETED",
      analysisVersion: FRUIT_ANALYSIS_VERSION,
      imageContentHash: "same-image-hash",
    }, "same-image-hash")).toBe(true);
    expect(hasCurrentCompletedFruitAnalysis({
      status: "COMPLETED",
      analysisVersion: FRUIT_ANALYSIS_VERSION,
      imageContentHash: "old-image-hash",
    }, "replacement-image-hash")).toBe(false);
  });
});
