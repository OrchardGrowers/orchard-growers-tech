import mongoose from "mongoose";
import Order from "../models/Order.js";
import VerificationRequest from "../models/VerificationRequest.js";
import ErpAuditEvent from "../models/ErpAuditEvent.js";
import ErpCommissionLedger from "../models/ErpCommissionLedger.js";
import ErpDocumentRecord from "../models/ErpDocumentRecord.js";
import ErpLedgerEntry from "../models/ErpLedgerEntry.js";
import ErpPaymentTransaction from "../models/ErpPaymentTransaction.js";
import ErpSettlement from "../models/ErpSettlement.js";
import { generateErpNumber } from "./erpNumberingService.js";
import { isOrderCompletedForMarketplace } from "./dealLifecycleService.js";

const roundMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const toNumber = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const normalizeStatus = (value = "") => String(value || "").trim().toUpperCase();
const toObjectIdValue = (value) => (mongoose.isValidObjectId(value) ? value : undefined);

const getOrderAmount = (order = {}) =>
  roundMoney(
    order.finalPrice ||
      order.totalAmount ||
      order.auctionPrice ||
      order.dealBreakdown?.buyerPayableThroughPlatform ||
      order.dealBreakdown?.buyerPayable ||
      order.dealBreakdown?.dealAmount ||
      0
  );

const getCommissionAmount = (order = {}) =>
  roundMoney(
    order.platformCommission ||
      order.commissionTaxableAmount ||
      order.dealBreakdown?.platformServiceFee ||
      order.dealBreakdown?.commissionAmount ||
      0
  );

const getGrowerPayout = (order = {}) =>
  roundMoney(order.growerPayout || order.dealBreakdown?.sellerReceivable || order.dealBreakdown?.growerReceivable || 0);

const getLogisticsAmount = (order = {}) =>
  roundMoney(order.driverPayment || order.dealBreakdown?.driverCharge || order.dealBreakdown?.logisticsAmount || 0);

const normalizeProvider = (value = "") => {
  const provider = normalizeStatus(value);
  if (provider.includes("RAZORPAY")) return "RAZORPAY_ROUTE";
  if (provider.includes("BILLDESK")) return "BILLDESK";
  if (provider.includes("CASHFREE")) return "CASHFREE";
  if (provider.includes("TEST")) return "TEST";
  if (provider.includes("MANUAL")) return "MANUAL";
  return "UNKNOWN";
};

const normalizePaymentStatus = (order = {}) => {
  const paymentStatus = normalizeStatus(order.paymentStatus);
  const gatewayStatus = normalizeStatus(order.paymentGatewayStatus);
  if (paymentStatus === "ESCROW") return "ESCROW_HELD";
  if (paymentStatus === "RELEASED") return "RELEASED";
  if (paymentStatus === "PAID" || gatewayStatus === "PAID" || gatewayStatus === "SUCCESS") return "SUCCESS";
  if (paymentStatus === "FAILED" || gatewayStatus === "FAILED") return "FAILED";
  return paymentStatus || "PENDING";
};

const findOrCreateNumber = async ({ model, query, field, type, date }) => {
  const existing = await model.findOne(query).select(field).lean();
  if (existing?.[field]) return existing[field];
  return generateErpNumber(type, date);
};

const upsertAuditEvent = async ({ order, verificationRequest, module, action, entityType, adminId, metadata }) => {
  const entityId = order?._id || verificationRequest?._id;
  if (!entityId) return null;

  return ErpAuditEvent.findOneAndUpdate(
    {
      module,
      action,
      entityType,
      entityId,
    },
    {
      $setOnInsert: {
        platform: "efruitmandi",
        module,
        action,
        entityType,
        entityId,
        actorAdmin: adminId || undefined,
        riskLevel: "MEDIUM",
        metadata,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();
};

const upsertPaymentTransaction = async ({ order, adminId }) => {
  const amount = getOrderAmount(order);
  if (amount <= 0) return null;

  const query = {
    platform: "efruitmandi",
    paymentType: "BUYER_COLLECTION",
    sourceOrder: order._id,
  };
  const transactionNumber = await findOrCreateNumber({
    model: ErpPaymentTransaction,
    query,
    field: "transactionNumber",
    type: "PAYMENT",
    date: order.createdAt || new Date(),
  });

  return ErpPaymentTransaction.findOneAndUpdate(
    query,
    {
      $set: {
        sourceQuote: order.quote,
        lot: order.product,
        buyer: order.buyer,
        grower: order.grower,
        transactionNumber,
        provider: normalizeProvider(order.paymentGateway || order.paymentMethod),
        gatewayOrderId: order.paymentGatewayOrderId || "",
        gatewayPaymentId: order.paymentReference || "",
        amount,
        currency: "INR",
        status: normalizePaymentStatus(order),
        escrowStatus: order.escrowStatus || "",
        paidAt: ["PAID", "ESCROW", "RELEASED"].includes(normalizeStatus(order.paymentStatus))
          ? order.updatedAt || order.createdAt
          : undefined,
        rawPayload: {
          paymentGatewayStatus: order.paymentGatewayStatus || "",
          paymentMethod: order.paymentMethod || "",
        },
        updatedBy: adminId || undefined,
      },
      $setOnInsert: {
        createdBy: adminId || undefined,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();
};

const upsertCommissionLedger = async ({ order, adminId }) => {
  if (!isOrderCompletedForMarketplace(order)) return null;

  const commissionAmount = getCommissionAmount(order);
  if (commissionAmount <= 0) return null;

  const taxAmount = roundMoney(order.commissionGstAmount);
  const query = {
    platform: "efruitmandi",
    sourceOrder: order._id,
  };

  return ErpCommissionLedger.findOneAndUpdate(
    query,
    {
      $set: {
        sourceQuote: order.quote,
        lot: order.product,
        buyer: order.buyer,
        grower: order.grower,
        commissionBase: roundMoney(order.dealBreakdown?.commissionBase || getOrderAmount(order)),
        commissionPercent: toNumber(order.dealBreakdown?.commissionPercent),
        commissionAmount,
        taxPercent: toNumber(order.commissionGstPercent),
        taxAmount,
        totalAmount: roundMoney(order.commissionTotalAmount || commissionAmount + taxAmount),
        currency: "INR",
        status: order.commissionInvoiceNumber ? "INVOICED" : "ACCRUED",
        invoiceNumber: order.commissionInvoiceNumber || "",
        invoiceDate: order.commissionInvoiceDate,
        receiptNumber: order.commissionReceiptNumber || "",
        receiptDate: order.commissionReceiptDate,
        updatedBy: adminId || undefined,
      },
      $setOnInsert: {
        createdBy: adminId || undefined,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();
};

const buildSettlementRows = (order = {}) => {
  if (Array.isArray(order.beneficiaryMapping) && order.beneficiaryMapping.length) {
    return order.beneficiaryMapping
      .filter((beneficiary) => Number(beneficiary.settlementAmount || 0) > 0)
      .map((beneficiary) => ({
        beneficiaryType: normalizeStatus(beneficiary.beneficiaryType),
        beneficiaryUser: beneficiary.beneficiaryId,
        netAmount: roundMoney(beneficiary.settlementAmount),
        metadata: {
          kycStatus: beneficiary.kycStatus || "",
          bankOrUpiVerified: Boolean(beneficiary.bankOrUpiVerified),
        },
      }));
  }

  return [
    { beneficiaryType: "GROWER", beneficiaryUser: order.grower, netAmount: getGrowerPayout(order) },
    { beneficiaryType: "LOGISTICS", beneficiaryUser: order.driver, netAmount: getLogisticsAmount(order) },
    { beneficiaryType: "PLATFORM", beneficiaryUser: undefined, netAmount: getCommissionAmount(order) },
  ].filter((row) => row.netAmount > 0);
};

const upsertSettlements = async ({ order, adminId }) => {
  if (!isOrderCompletedForMarketplace(order)) return [];

  const releaseAllowed = Boolean(order.settlementEligibility?.settlementReleaseAllowed);
  const paymentStatus = normalizeStatus(order.paymentStatus);
  const status = paymentStatus === "RELEASED" ? "SETTLED" : releaseAllowed ? "ELIGIBLE" : "PENDING";
  const rows = buildSettlementRows(order);

  const settlements = [];
  for (const row of rows) {
    const query = {
      platform: "efruitmandi",
      sourceOrder: order._id,
      beneficiaryType: row.beneficiaryType,
    };
    const settlementNumber = await findOrCreateNumber({
      model: ErpSettlement,
      query,
      field: "settlementNumber",
      type: "SETTLEMENT",
      date: order.createdAt || new Date(),
    });

    const settlement = await ErpSettlement.findOneAndUpdate(
      query,
      {
        $set: {
          sourceQuote: order.quote,
          lot: order.product,
          settlementNumber,
          beneficiaryUser: toObjectIdValue(row.beneficiaryUser),
          grossAmount: row.netAmount,
          netAmount: row.netAmount,
          currency: "INR",
          status,
          provider: normalizeProvider(order.paymentGateway || order.paymentMethod),
          settledAt: paymentStatus === "RELEASED" ? order.updatedAt || new Date() : undefined,
          updatedBy: adminId || undefined,
        },
        $setOnInsert: {
          createdBy: adminId || undefined,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();
    settlements.push(settlement);
  }

  return settlements;
};

const upsertDocument = async ({ query, type, payload, date, adminId }) => {
  const documentNumber =
    payload.documentNumber ||
    (await findOrCreateNumber({
      model: ErpDocumentRecord,
      query,
      field: "documentNumber",
      type,
      date,
    }));

  return ErpDocumentRecord.findOneAndUpdate(
    query,
    {
      $set: {
        ...payload,
        documentNumber,
      },
      $setOnInsert: {
        generatedBy: adminId || undefined,
        versions: [
          {
            version: 1,
            generatedBy: adminId || undefined,
            generatedAt: date || new Date(),
            note: "Initial ERP document record",
          },
        ],
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();
};

const upsertOrderDocuments = async ({ order, adminId }) => {
  if (!isOrderCompletedForMarketplace(order)) return [];

  const amount = getOrderAmount(order);
  const documents = [];

  if (amount > 0) {
    documents.push(
      await upsertDocument({
        query: {
          platform: "efruitmandi",
          sourceType: "ORDER",
          sourceOrder: order._id,
          documentType: "SALE_BILL",
        },
        type: "SALE_BILL",
        date: order.invoiceDate || order.createdAt || new Date(),
        adminId,
        payload: {
          platform: "efruitmandi",
          documentType: "SALE_BILL",
          sourceType: "ORDER",
          sourceOrder: order._id,
          sourceQuote: order.quote,
          documentNumber: order.invoiceNumber || undefined,
          status: "GENERATED",
          issuedFrom: "Grower via eFruitMandi.live",
          issuedToUser: order.buyer,
          taxableAmount: amount,
          totalAmount: amount,
          currency: "INR",
          metadata: {
            marketplaceRole: "FACILITATOR",
            generatedOnBehalfOf: "GROWER",
          },
        },
      })
    );
  }

  const commissionAmount = getCommissionAmount(order);
  if (commissionAmount > 0) {
    documents.push(
      await upsertDocument({
        query: {
          platform: "efruitmandi",
          sourceType: "ORDER",
          sourceOrder: order._id,
          documentType: "COMMISSION_INVOICE",
        },
        type: "COMMISSION",
        date: order.commissionInvoiceDate || order.createdAt || new Date(),
        adminId,
        payload: {
          platform: "efruitmandi",
          documentType: "COMMISSION_INVOICE",
          sourceType: "ORDER",
          sourceOrder: order._id,
          sourceQuote: order.quote,
          documentNumber: order.commissionInvoiceNumber || undefined,
          status: "GENERATED",
          issuedFrom: "Orchard Growers Private Limited",
          issuedToUser: order.buyer,
          taxableAmount: roundMoney(order.commissionTaxableAmount || commissionAmount),
          taxAmount: roundMoney(order.commissionGstAmount),
          totalAmount: roundMoney(order.commissionTotalAmount || commissionAmount),
          currency: "INR",
          metadata: {
            revenueType: "MARKETPLACE_COMMISSION",
            commissionPercent: order.dealBreakdown?.commissionPercent || 0,
          },
        },
      })
    );
  }

  return documents.filter(Boolean);
};

const buildLedgerRows = (order = {}) => {
  const amount = getOrderAmount(order);
  const growerPayout = getGrowerPayout(order);
  const logisticsAmount = getLogisticsAmount(order);
  const commissionAmount = getCommissionAmount(order);
  const rows = [];

  if (amount > 0) {
    rows.push({
      sourceType: "PAYMENT",
      accountCode: "1100",
      accountName: "Escrow / Payment Receivable",
      accountType: "ASSET",
      partyType: "BUYER",
      party: order.buyer,
      debit: amount,
      credit: 0,
      memo: "Buyer payment collected through marketplace payment flow",
    });
    rows.push({
      sourceType: "PAYMENT",
      accountCode: "2300",
      accountName: "Escrow Liability",
      accountType: "LIABILITY",
      partyType: "PLATFORM",
      debit: 0,
      credit: amount,
      memo: "Marketplace escrow liability against buyer payment",
    });
  }

  if (growerPayout > 0) {
    rows.push({
      sourceType: "SETTLEMENT",
      accountCode: "2300",
      accountName: "Escrow Liability Clearing",
      accountType: "LIABILITY",
      partyType: "PLATFORM",
      debit: growerPayout,
      credit: 0,
      memo: "Escrow liability allocated to grower payout",
    });
    rows.push({
      sourceType: "SETTLEMENT",
      accountCode: "2100",
      accountName: "Grower Settlement Payable",
      accountType: "LIABILITY",
      partyType: "GROWER",
      party: order.grower,
      debit: 0,
      credit: growerPayout,
      memo: "Grower payout liability",
    });
  }

  if (logisticsAmount > 0) {
    rows.push({
      sourceType: "SETTLEMENT",
      accountCode: "2300",
      accountName: "Escrow Liability Clearing",
      accountType: "LIABILITY",
      partyType: "LOGISTICS",
      debit: logisticsAmount,
      credit: 0,
      memo: "Escrow liability allocated to logistics payout",
    });
    rows.push({
      sourceType: "SETTLEMENT",
      accountCode: "2200",
      accountName: "Logistics Settlement Payable",
      accountType: "LIABILITY",
      partyType: "LOGISTICS",
      party: order.driver,
      debit: 0,
      credit: logisticsAmount,
      memo: "Logistics payout liability",
    });
  }

  if (commissionAmount > 0) {
    rows.push({
      sourceType: "COMMISSION",
      accountCode: "2300",
      accountName: "Escrow Liability Clearing",
      accountType: "LIABILITY",
      partyType: "PLATFORM",
      debit: commissionAmount,
      credit: 0,
      memo: "Escrow liability allocated to OGPL commission revenue",
    });
    rows.push({
      sourceType: "COMMISSION",
      accountCode: "4100",
      accountName: "Platform Commission Revenue",
      accountType: "REVENUE",
      partyType: "PLATFORM",
      debit: 0,
      credit: commissionAmount,
      memo: "OGPL marketplace commission revenue",
    });
  }

  return rows;
};

const upsertLedgerEntries = async ({ order, adminId }) => {
  if (!isOrderCompletedForMarketplace(order)) return [];

  const rows = buildLedgerRows(order);
  if (!rows.length) return [];

  const existingJournal = await ErpLedgerEntry.findOne({
    platform: "efruitmandi",
    sourceOrder: order._id,
  })
    .select("journalNumber")
    .lean();
  const journalNumber = existingJournal?.journalNumber || (await generateErpNumber("LEDGER", order.createdAt || new Date()));
  const entries = [];

  for (const row of rows) {
    const query = {
      platform: "efruitmandi",
      sourceOrder: order._id,
      sourceType: row.sourceType,
      accountCode: row.accountCode,
      partyType: row.partyType,
    };
    const existing = await ErpLedgerEntry.findOne(query).select("journalNumber").lean();
    const entry = await ErpLedgerEntry.findOneAndUpdate(
      query,
      {
        $set: {
          sourceId: order._id,
          sourceQuote: order.quote,
          journalNumber: existing?.journalNumber || journalNumber,
          accountName: row.accountName,
          accountType: row.accountType,
          party: row.party || undefined,
          debit: row.debit,
          credit: row.credit,
          currency: "INR",
          postingDate: order.createdAt || new Date(),
          status: "POSTED",
          memo: row.memo,
          metadata: {
            marketplaceRole: "FACILITATOR",
          },
        },
        $setOnInsert: {
          createdBy: adminId || undefined,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();
    entries.push(entry);
  }

  return entries;
};

export const materializeOrderFinanceArtifacts = async (order, { adminId } = {}) => {
  const sourceOrder = order?.toObject ? order.toObject() : order;
  if (!sourceOrder?._id) return null;

  const [paymentTransaction, commissionLedger, settlements, documents, ledgerEntries] = await Promise.all([
    upsertPaymentTransaction({ order: sourceOrder, adminId }),
    upsertCommissionLedger({ order: sourceOrder, adminId }),
    upsertSettlements({ order: sourceOrder, adminId }),
    upsertOrderDocuments({ order: sourceOrder, adminId }),
    upsertLedgerEntries({ order: sourceOrder, adminId }),
  ]);

  await upsertAuditEvent({
    order: sourceOrder,
    module: "ERP Finance",
    action: "MATERIALIZE_ORDER_FINANCE",
    entityType: "Order",
    adminId,
    metadata: {
      paymentTransactionId: paymentTransaction?._id,
      commissionLedgerId: commissionLedger?._id,
      settlementCount: settlements.length,
      documentCount: documents.length,
      ledgerEntryCount: ledgerEntries.length,
    },
  });

  return {
    orderId: sourceOrder._id,
    paymentTransaction,
    commissionLedger,
    settlements,
    documents,
    ledgerEntries,
  };
};

export const materializeVerificationFinanceArtifacts = async (verificationRequest, { adminId } = {}) => {
  const request = verificationRequest?.toObject ? verificationRequest.toObject() : verificationRequest;
  if (!request?._id || !request.fee?.paid) return null;

  const amount = roundMoney(request.fee.totalAmount);
  if (amount <= 0) return null;

  const paymentQuery = {
    platform: "efruitmandi",
    paymentType: "VERIFICATION_FEE",
    gatewayOrderId: `verification:${request._id}`,
  };
  const transactionNumber = await findOrCreateNumber({
    model: ErpPaymentTransaction,
    query: paymentQuery,
    field: "transactionNumber",
    type: "PAYMENT",
    date: request.fee.paidAt || request.createdAt || new Date(),
  });
  const paymentTransaction = await ErpPaymentTransaction.findOneAndUpdate(
    paymentQuery,
    {
      $set: {
        transactionNumber,
        buyer: request.user,
        provider: "UNKNOWN",
        gatewayOrderId: `verification:${request._id}`,
        amount,
        currency: "INR",
        status: "SUCCESS",
        paidAt: request.fee.paidAt || request.createdAt,
        rawPayload: { verificationRequestId: String(request._id) },
        updatedBy: adminId || undefined,
      },
      $setOnInsert: {
        createdBy: adminId || undefined,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();

  const document = await upsertDocument({
    query: {
      platform: "efruitmandi",
      sourceType: "VERIFICATION",
      sourceVerification: request._id,
      documentType: "VERIFICATION_INVOICE",
    },
    type: "VERIFICATION",
    date: request.fee.paidAt || request.createdAt || new Date(),
    adminId,
    payload: {
      platform: "efruitmandi",
      documentType: "VERIFICATION_INVOICE",
      sourceType: "VERIFICATION",
      sourceVerification: request._id,
      status: "GENERATED",
      issuedFrom: "Orchard Growers Private Limited",
      issuedToUser: request.user,
      taxableAmount: roundMoney(request.fee.baseAmount),
      taxAmount: roundMoney(request.fee.taxAmount),
      totalAmount: amount,
      currency: "INR",
      metadata: {
        revenueType: "OG_VERIFIED_FEE",
        roleType: request.roleType,
        verificationType: request.verificationType,
      },
    },
  });

  const ledgerRows = [
    {
      accountCode: "1110",
      accountName: "Verification Fee Collection",
      accountType: "ASSET",
      partyType: "BUYER",
      party: request.user,
      debit: amount,
      credit: 0,
    },
    {
      accountCode: "4200",
      accountName: "OG Verified Revenue",
      accountType: "REVENUE",
      partyType: "PLATFORM",
      debit: 0,
      credit: amount,
    },
  ];
  const existingVerificationJournal = await ErpLedgerEntry.findOne({
    platform: "efruitmandi",
    sourceType: "VERIFICATION",
    sourceId: request._id,
  })
    .select("journalNumber")
    .lean();
  const verificationJournalNumber =
    existingVerificationJournal?.journalNumber ||
    (await generateErpNumber("LEDGER", request.fee.paidAt || request.createdAt || new Date()));
  const ledgerEntries = [];
  for (const row of ledgerRows) {
    const ledgerQuery = {
      platform: "efruitmandi",
      sourceType: "VERIFICATION",
      sourceId: request._id,
      accountCode: row.accountCode,
      partyType: row.partyType,
    };
    const existing = await ErpLedgerEntry.findOne(ledgerQuery).select("journalNumber").lean();
    const entry = await ErpLedgerEntry.findOneAndUpdate(
      ledgerQuery,
      {
        $set: {
          journalNumber: existing?.journalNumber || verificationJournalNumber,
          accountName: row.accountName,
          accountType: row.accountType,
          party: row.party || undefined,
          debit: row.debit,
          credit: row.credit,
          currency: "INR",
          postingDate: request.fee.paidAt || request.createdAt || new Date(),
          status: "POSTED",
          memo: "OG Verified verification fee",
        },
        $setOnInsert: {
          createdBy: adminId || undefined,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();
    ledgerEntries.push(entry);
  }

  await upsertAuditEvent({
    verificationRequest: request,
    module: "ERP Finance",
    action: "MATERIALIZE_VERIFICATION_FINANCE",
    entityType: "VerificationRequest",
    adminId,
    metadata: {
      paymentTransactionId: paymentTransaction?._id,
      documentId: document?._id,
      ledgerEntryCount: ledgerEntries.length,
    },
  });

  return {
    verificationRequestId: request._id,
    paymentTransaction,
    document,
    ledgerEntries,
  };
};

export const materializeFinanceArtifacts = async ({ limit = 50, adminId } = {}) => {
  const cappedLimit = Math.min(Math.max(Number(limit) || 50, 1), 500);
  const [orders, verificationRequests] = await Promise.all([
    Order.find({
      $or: [
        { paymentStatus: { $in: ["ESCROW", "PAID", "RELEASED", "FAILED"] } },
        { invoiceNumber: { $exists: true, $ne: "" } },
        { commissionInvoiceNumber: { $exists: true, $ne: "" } },
      ],
    })
      .sort({ updatedAt: -1 })
      .limit(cappedLimit),
    VerificationRequest.find({ "fee.paid": true }).sort({ updatedAt: -1 }).limit(cappedLimit),
  ]);

  const orderResults = [];
  for (const order of orders) {
    const result = await materializeOrderFinanceArtifacts(order, { adminId });
    if (result) orderResults.push(result);
  }

  const verificationResults = [];
  for (const request of verificationRequests) {
    const result = await materializeVerificationFinanceArtifacts(request, { adminId });
    if (result) verificationResults.push(result);
  }

  return {
    success: true,
    processed: {
      orders: orderResults.length,
      verificationRequests: verificationResults.length,
    },
    artifacts: {
      paymentTransactions:
        orderResults.filter((result) => result.paymentTransaction).length +
        verificationResults.filter((result) => result.paymentTransaction).length,
      commissionLedgers: orderResults.filter((result) => result.commissionLedger).length,
      settlements: orderResults.reduce((sum, result) => sum + result.settlements.length, 0),
      documents:
        orderResults.reduce((sum, result) => sum + result.documents.length, 0) +
        verificationResults.filter((result) => result.document).length,
      ledgerEntries:
        orderResults.reduce((sum, result) => sum + result.ledgerEntries.length, 0) +
        verificationResults.reduce((sum, result) => sum + result.ledgerEntries.length, 0),
    },
  };
};
