import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { describe, expect, it } from "vitest";
import { createLotPdf } from "./lotPdfService.js";

const renderPdfText = async (options) => {
  const chunks = [];
  const stream = createLotPdf(options);
  await new Promise((resolve, reject) => {
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("end", resolve);
    stream.on("error", reject);
  });
  return (await pdfParse(Buffer.concat(chunks))).text;
};

const product = {
  _id: "64b000000000000000000010",
  lotNo: "TEST-2026-001",
  fruitName: "Apple",
  variety: "Royal Delicious",
  basePrice: 127.45,
  quantity: 20,
  createdBy: { name: "Grower", orchardName: "Test Orchard" },
};

describe("fruit lot PDFs", () => {
  it("excludes private base price from a public PDF", async () => {
    const text = await renderPdfText({ product: { ...product, basePrice: undefined }, auction: { currentBid: 150 }, fruitScanningReport: {} });
    expect(text).toContain("Current public deal price");
    expect(text).not.toContain("private base price");
    expect(text).not.toContain("127.45");
  });

  it("includes private base price only for an authorized owner/admin PDF", async () => {
    const text = await renderPdfText({ product, includePrivatePrice: true, fruitScanningReport: {} });
    expect(text).toContain("Private Owner / Admin Information");
    expect(text).toContain("Grower's private base price");
    expect(text).toContain("127.45");
  });

  it("renders one lot-wide summary for a completed multi-image scanning report", async () => {
    const text = await renderPdfText({
      product: { ...product, basePrice: undefined },
      fruitScanningReport: {
        available: true,
        status: "COMPLETED",
        imagesCaptured: 3,
        imagesAnalyzed: 3,
        totalFruitCount: 15,
        analyses: [
          { scanId: "one", status: "COMPLETED", imagesAnalyzed: 1, fruitCount: 4 },
          { scanId: "two", status: "COMPLETED", imagesAnalyzed: 1, fruitCount: 5 },
          { scanId: "three", status: "COMPLETED", imagesAnalyzed: 1, fruitCount: 6 },
        ],
      },
    });

    expect(text).toContain("Total fruits detected");
    expect(text).toContain("15");
    expect(text).toContain("visual/image analysis");
  });
});
