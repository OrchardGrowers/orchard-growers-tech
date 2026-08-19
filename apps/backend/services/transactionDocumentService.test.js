import { beforeEach, describe, expect, it, vi } from "vitest";

const documentStore = vi.hoisted(() => []);
const notificationStore = vi.hoisted(() => []);
const matches = vi.hoisted(() => (record, query) =>
  Object.entries(query).every(([key, value]) => String(record[key] || "") === String(value || "")));

vi.mock("../models/ErpDocumentRecord.js", () => ({
  default: {
    findOne: vi.fn((query) => ({
      lean: async () => documentStore.find((record) => matches(record, query)) || null,
    })),
    findOneAndUpdate: vi.fn((query, update) => ({
      lean: async () => {
        const existing = documentStore.find((record) => matches(record, query));
        if (existing) return existing;
        const record = {
          _id: `document-${documentStore.length + 1}`,
          ...query,
          ...(update.$setOnInsert || {}),
        };
        documentStore.push(record);
        return record;
      },
    })),
  },
}));

vi.mock("../models/UserNotification.js", () => ({
  default: {
    findOneAndUpdate: vi.fn(async (query, update) => {
      const existing = notificationStore.find((record) => matches(record, query));
      if (existing) return existing;
      const record = { ...query, ...(update.$setOnInsert || {}) };
      notificationStore.push(record);
      return record;
    }),
  },
}));

vi.mock("./invoiceNumberingService.js", () => ({
  generateLotChallanNo: vi.fn(async () => "EFM-GLC-2026-000001"),
  generateSalesInvoiceNo: vi.fn(async () => "EFM-SI-2026-000001"),
  generateGrowerCommissionInvoiceNo: vi.fn(async () => "EFM-CI-G-2026-000001"),
  generateBuyerCommissionInvoiceNo: vi.fn(async () => "EFM-CI-B-2026-000001"),
}));

import {
  ensureFinalTransactionDocuments,
  ensureLotListingChallan,
} from "./transactionDocumentService.js";

describe("transaction document generation", () => {
  beforeEach(() => {
    documentStore.length = 0;
    notificationStore.length = 0;
  });

  it("creates one immutable listing challan even when generation is retried", async () => {
    const lot = {
      _id: "64b000000000000000000010",
      lotNo: "LOT-10",
      title: "Apple",
      fruitName: "Apple",
      quantity: 10,
      totalWeightKg: 200,
      basePrice: 100,
      status: "IN_AUCTION",
      createdAt: new Date("2026-08-10T08:00:00.000Z"),
    };
    const grower = {
      _id: "64b000000000000000000001",
      name: "Test Grower",
      orchardName: "Test Orchard",
      kyc: { status: "APPROVED" },
    };

    const first = await ensureLotListingChallan(lot, { grower });
    const second = await ensureLotListingChallan(lot, { grower });

    expect(first.documentNumber).toBe("EFM-GLC-2026-000001");
    expect(second._id).toBe(first._id);
    expect(documentStore).toHaveLength(1);
    expect(documentStore[0].snapshot.disclaimer).toContain("not a tax invoice");
  });

  it("creates one gross sales invoice and only the enabled buyer commission invoice", async () => {
    const order = {
      _id: "64b000000000000000000020",
      product: {
        _id: "64b000000000000000000010",
        title: "Apple",
        fruitName: "Apple",
        variety: "Royal Delicious",
        quality: "A",
      },
      grower: {
        _id: "64b000000000000000000001",
        name: "Test Grower",
        orchardName: "Test Orchard",
      },
      buyer: {
        _id: "64b000000000000000000002",
        name: "Test Buyer",
        businessName: "Test Buyer Firm",
      },
      paymentStatus: "RELEASED",
      deliveryStatus: "DELIVERED",
      financialSnapshot: {
        currency: "INR",
        commissionVersion: "2026-07",
        grossFruitSaleAmount: 19_012,
        grossFruitSaleMinor: 1_901_200,
        finalWeightKg: 194,
        finalRate: 98,
        growerCommissionEnabled: false,
        growerCommissionMinor: 0,
        growerCommissionAmount: 0,
        buyerCommissionEnabled: true,
        buyerCommissionRate: 7,
        buyerCommissionMinor: 133_084,
        buyerCommissionAmount: 1_330.84,
        buyerTotalPayable: 20_342.84,
        growerNetSettlement: 19_012,
        lockedAt: new Date("2026-08-10T12:00:00.000Z"),
      },
    };

    const first = await ensureFinalTransactionDocuments(order);
    const second = await ensureFinalTransactionDocuments(order);

    expect(first).toHaveLength(2);
    expect(second.map((document) => document._id)).toEqual(first.map((document) => document._id));
    expect(documentStore).toHaveLength(2);
    const salesInvoice = documentStore.find((document) => document.documentType === "SALES_INVOICE");
    const commissionInvoice = documentStore.find(
      (document) => document.documentType === "BUYER_COMMISSION_INVOICE"
    );
    expect(salesInvoice.totalAmount).toBe(19_012);
    expect(salesInvoice.metadata.excludesPlatformCommission).toBe(true);
    expect(commissionInvoice.issuedToUser).toBe(order.buyer._id);
    expect(commissionInvoice.totalAmount).toBe(1_330.84);
    expect(documentStore.some((document) => document.documentType === "GROWER_COMMISSION_INVOICE")).toBe(false);
  });

  it("does not create final documents before financial lock or for a cancelled pre-final deal", async () => {
    await expect(
      ensureFinalTransactionDocuments({
        _id: "64b000000000000000000021",
        paymentStatus: "CANCELLED",
        deliveryStatus: "CANCELLED",
      })
    ).rejects.toThrow("locked financial snapshot");
    expect(documentStore).toHaveLength(0);
  });

  it("issues a grower commission invoice only to the grower when that charge is enabled", async () => {
    const order = {
      _id: "64b000000000000000000022",
      product: { _id: "64b000000000000000000010", fruitName: "Apple" },
      grower: { _id: "64b000000000000000000001", name: "Test Grower" },
      buyer: { _id: "64b000000000000000000002", name: "Test Buyer" },
      financialSnapshot: {
        currency: "INR",
        commissionVersion: "legacy",
        grossFruitSaleAmount: 100_000,
        growerCommissionEnabled: true,
        growerCommissionRate: 5,
        growerCommissionMinor: 500_000,
        growerCommissionAmount: 5_000,
        buyerCommissionEnabled: false,
        buyerCommissionMinor: 0,
        buyerCommissionAmount: 0,
        buyerTotalPayable: 100_000,
        growerNetSettlement: 95_000,
        lockedAt: new Date("2025-01-01T12:00:00.000Z"),
      },
    };

    const documents = await ensureFinalTransactionDocuments(order);
    const commissionInvoice = documents.find(
      (document) => document.documentType === "GROWER_COMMISSION_INVOICE"
    );

    expect(commissionInvoice.issuedToUser).toBe(order.grower._id);
    expect(commissionInvoice.totalAmount).toBe(5_000);
    expect(documents.some((document) => document.documentType === "BUYER_COMMISSION_INVOICE")).toBe(false);
  });
});
