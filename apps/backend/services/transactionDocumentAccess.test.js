import { describe, expect, it } from "vitest";
import { canAccessTransactionDocument } from "./transactionDocumentService.js";
import { sanitizeDocumentForViewer } from "../controllers/transactionDocumentController.js";

describe("transaction document authorization", () => {
  const growerId = "64b000000000000000000001";
  const buyerId = "64b000000000000000000002";
  const unrelatedId = "64b000000000000000000003";

  it("allows both deal participants to access the shared sales invoice", () => {
    const document = {
      recipientRole: "BOTH",
      issuedToUser: buyerId,
      grower: growerId,
      buyer: buyerId,
    };
    expect(canAccessTransactionDocument(document, { id: growerId })).toBe(true);
    expect(canAccessTransactionDocument(document, { id: buyerId })).toBe(true);
  });

  it("prevents unrelated users from accessing private transaction documents", () => {
    const document = {
      recipientRole: "BOTH",
      issuedToUser: buyerId,
      grower: growerId,
      buyer: buyerId,
    };
    expect(canAccessTransactionDocument(document, { id: unrelatedId })).toBe(false);
  });

  it("restricts commission invoices to the charged party and admins", () => {
    const document = {
      recipientRole: "BUYER",
      issuedToUser: buyerId,
      grower: growerId,
      buyer: buyerId,
    };
    expect(canAccessTransactionDocument(document, { id: buyerId })).toBe(true);
    expect(canAccessTransactionDocument(document, { id: growerId })).toBe(false);
    expect(canAccessTransactionDocument(document, { id: unrelatedId }, true)).toBe(true);
  });

  it("does not expose counterparty settlement details in a participant sales-invoice response", () => {
    const document = {
      documentType: "SALES_INVOICE",
      grower: growerId,
      buyer: buyerId,
      snapshot: {
        financial: {
          grossFruitSaleAmount: 100_000,
          growerCommissionAmount: 0,
          growerNetSettlement: 100_000,
          buyerCommissionAmount: 7_000,
          buyerTotalPayable: 107_000,
          platformRevenue: 7_000,
        },
      },
    };

    const growerDocument = sanitizeDocumentForViewer(document, { id: growerId });
    const buyerDocument = sanitizeDocumentForViewer(document, { id: buyerId });

    expect(growerDocument.snapshot.financial.buyerCommissionAmount).toBeUndefined();
    expect(growerDocument.snapshot.financial.growerNetSettlement).toBe(100_000);
    expect(buyerDocument.snapshot.financial.growerNetSettlement).toBeUndefined();
    expect(buyerDocument.snapshot.financial.buyerTotalPayable).toBe(107_000);
    expect(buyerDocument.snapshot.financial.platformRevenue).toBeUndefined();
  });
});
