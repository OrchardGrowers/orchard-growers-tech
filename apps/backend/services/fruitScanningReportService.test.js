import { describe, expect, it } from "vitest";
import { buildFruitScanningReport, toPublicScanAnalysis } from "./fruitScanningReportService.js";

describe("fruit scanning report contract", () => {
  it("does not invent measurements for unavailable analysis", () => {
    const report = buildFruitScanningReport([{ scanId: "scan-1", analysis: { status: "REVIEW_REQUIRED" } }]);
    expect(report.available).toBe(false);
    expect(report.status).toBe("REVIEW_REQUIRED");
    expect(report.analyses[0].fruitCount).toBeNull();
    expect(report.analyses[0].russetingPercent).toBeNull();
  });

  it("returns stored provider results and safe detection coordinates", () => {
    const result = toPublicScanAnalysis({
      scanId: "scan-1",
      analysis: {
        status: "COMPLETED",
        grade: "A",
        fruitCount: 4,
        detections: [{ category: "FRUIT", label: "apple", confidence: 0.91, boundingBox: { x: 0.1, y: 0.2, width: 0.3, height: 0.3 } }],
        russetingPercent: 2.4,
      },
    });
    expect(result).toMatchObject({ status: "COMPLETED", grade: "A", fruitCount: 4, russetingPercent: 2.4 });
    expect(result.detections).toHaveLength(1);
    expect(result.detections[0]).toMatchObject({ category: "FRUIT", label: "apple" });
  });

  it("aggregates a completed multi-image lot into one authoritative report", () => {
    const report = buildFruitScanningReport([
      { scanId: "scan-1", analysis: { status: "COMPLETED", imagesAnalyzed: 1, fruitCount: 4 } },
      { scanId: "scan-2", analysis: { status: "COMPLETED", imagesAnalyzed: 1, fruitCount: 5 } },
      { scanId: "scan-3", analysis: { status: "COMPLETED", imagesAnalyzed: 1, fruitCount: 6 } },
    ]);

    expect(report).toMatchObject({
      available: true,
      status: "COMPLETED",
      imagesCaptured: 3,
      imagesAnalyzed: 3,
      imagesCompleted: 3,
      totalFruitCount: 15,
    });
  });

  it("does not falsely complete a partially processed multi-image lot", () => {
    const report = buildFruitScanningReport([
      { scanId: "scan-1", analysis: { status: "COMPLETED", imagesAnalyzed: 1, fruitCount: 4 } },
      { scanId: "scan-2", analysis: { status: "COMPLETED", imagesAnalyzed: 1, fruitCount: 5 } },
      { scanId: "scan-3", analysis: { status: "PROCESSING" } },
    ]);

    expect(report).toMatchObject({
      available: false,
      status: "PROCESSING",
      imagesCaptured: 3,
      imagesCompleted: 2,
    });
  });

  it("rejects invalid persisted detection coordinates", () => {
    const result = toPublicScanAnalysis({
      scanId: "scan-invalid-box",
      analysis: {
        status: "COMPLETED",
        detections: [{ category: "FRUIT", boundingBox: { x: -1, y: 0, width: 1, height: 1 } }],
      },
    });

    expect(result.detections[0].boundingBox).toBeNull();
  });
});
