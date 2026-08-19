import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { describe, expect, it } from "vitest";
import { createTransactionDocumentPdf } from "./transactionDocumentPdfService.js";

const renderPdfText = async (record) => {
  const chunks = [];
  const stream = createTransactionDocumentPdf(record);
  await new Promise((resolve, reject) => {
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("end", resolve);
    stream.on("error", reject);
  });
  const parsed = await pdfParse(Buffer.concat(chunks));
  return parsed.text;
};

describe("transaction document PDFs", () => {
  it("renders the full fruit value without a platform commission line in the sales invoice", async () => {
    const text = await renderPdfText({
      _id: "64b000000000000000000020",
      documentNumber: "EFM-SI-2026-000001",
      documentType: "SALES_INVOICE",
      status: "FINAL",
      totalAmount: 19_012,
      finalizedAt: new Date("2026-08-10T12:00:00.000Z"),
      snapshot: {
        documentTitle: "FINAL SALES INVOICE",
        platform: { name: "eFruitMandi.live", legalEntity: "Orchard Growers Private Limited" },
        deal: {
          orderId: "64b000000000000000000020",
          lotId: "64b000000000000000000010",
          completedAt: new Date("2026-08-10T12:00:00.000Z"),
        },
        lot: { fruit: "Apple", variety: "Royal Delicious", grade: "A" },
        seller: { name: "Test Grower", businessName: "Test Orchard" },
        buyer: { name: "Test Buyer", businessName: "Test Buyer Firm" },
        financial: {
          grossFruitSaleAmount: 19_012,
          finalWeightKg: 194,
          finalRate: 98,
          buyerCommissionAmount: 1_330.84,
        },
        totalFruitSaleValue: 19_012,
      },
    });

    expect(text).toContain("FINAL SALES INVOICE");
    expect(text).toContain("TOTAL SALES INVOICE VALUE");
    expect(text).toContain("INR 19,012.00");
    expect(text).not.toMatch(/platform commission/i);
    expect(text).not.toMatch(/net after commission/i);
  }, 20_000);
});
