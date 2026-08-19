import mongoose from "mongoose";
import Admin from "../models/Admin.js";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import Quotation from "../models/Quotation.js";
import User from "../models/User.js";
import VerificationRequest from "../models/VerificationRequest.js";
import ErpAuditEvent from "../models/ErpAuditEvent.js";
import ErpCommissionLedger from "../models/ErpCommissionLedger.js";
import ErpDocumentRecord from "../models/ErpDocumentRecord.js";
import ErpLedgerEntry from "../models/ErpLedgerEntry.js";
import ErpNotificationLog from "../models/ErpNotificationLog.js";
import ErpPaymentTransaction from "../models/ErpPaymentTransaction.js";
import ErpRefund from "../models/ErpRefund.js";
import ErpSettlement from "../models/ErpSettlement.js";
import ErpSupportTicket from "../models/ErpSupportTicket.js";
import { isOrderCompletedForMarketplace } from "../services/dealLifecycleService.js";

const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const roundMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const toNumber = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const cleanText = (value = "") => String(value || "").trim();
const normalizeStatus = (value = "") => cleanText(value).toUpperCase();
const toObjectId = (value) => (mongoose.isValidObjectId(value) ? new mongoose.Types.ObjectId(value) : null);

const getLimit = (req, fallback = 100, max = 500) => {
  const limit = Number(req.query.limit || fallback);
  if (!Number.isFinite(limit) || limit <= 0) return fallback;
  return Math.min(Math.floor(limit), max);
};

const getIstDayRange = (date = new Date()) => {
  const shifted = date.getTime() + IST_OFFSET_MS;
  const start = Math.floor(shifted / DAY_MS) * DAY_MS - IST_OFFSET_MS;
  return {
    start: new Date(start),
    end: new Date(start + DAY_MS),
  };
};

const getDateRange = (req) => {
  const from = req.query.from ? new Date(req.query.from) : null;
  const to = req.query.to ? new Date(req.query.to) : null;
  const filter = {};

  if (from && !Number.isNaN(from.getTime())) filter.$gte = from;
  if (to && !Number.isNaN(to.getTime())) filter.$lte = to;
  return Object.keys(filter).length ? filter : null;
};

const getOrderAmount = (order = {}) =>
  roundMoney(
    order.financialSnapshot?.grossFruitSaleAmount ||
      order.finalPrice ||
      order.totalAmount ||
      order.auctionPrice ||
      order.dealBreakdown?.buyerPayableThroughPlatform ||
      order.dealBreakdown?.buyerPayable ||
      order.dealBreakdown?.dealAmount ||
      0
  );

const getBuyerPayableAmount = (order = {}) =>
  roundMoney(
    order.financialSnapshot?.buyerTotalPayable ||
      order.dealBreakdown?.buyerPayableThroughPlatform ||
      order.dealBreakdown?.buyerPayable ||
      order.totalAmount ||
      getOrderAmount(order)
  );

const getCommissionAmount = (order = {}) =>
  roundMoney(
    order.financialSnapshot?.platformRevenue ||
      order.platformCommission ||
      order.commissionTaxableAmount ||
      order.dealBreakdown?.platformServiceFee ||
      order.dealBreakdown?.commissionAmount ||
      0
  );

const getCommissionTaxAmount = (order = {}) =>
  roundMoney(order.financialSnapshot?.taxAmount || order.commissionGstAmount || 0);

const getGrowerPayout = (order = {}) =>
  roundMoney(order.financialSnapshot?.growerNetSettlement || order.growerPayout || order.dealBreakdown?.sellerReceivable || order.dealBreakdown?.growerReceivable || 0);

const getLogisticsAmount = (order = {}) =>
  roundMoney(order.financialSnapshot?.logisticsAmount || order.driverPayment || order.dealBreakdown?.driverCharge || order.dealBreakdown?.logisticsAmount || 0);

const getPartyName = (party = {}, fallback = "Not available") =>
  party?.businessName ||
  party?.buyerContactPerson ||
  party?.orchardName ||
  party?.logisticsName ||
  party?.driverName ||
  party?.name ||
  fallback;

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

const getOrderQuery = (req) => {
  const query = {};
  const dateRange = getDateRange(req);
  if (dateRange) query.createdAt = dateRange;
  if (req.query.status) query.paymentStatus = normalizeStatus(req.query.status);
  if (req.query.orderId) {
    const orderId = toObjectId(req.query.orderId);
    if (orderId) query._id = orderId;
  }
  return query;
};

const getCompletedOrderQuery = (req) => ({
  ...getOrderQuery(req),
  $or: [
    { paymentStatus: { $in: ["ESCROW", "PAID", "RELEASED"] } },
    { deliveryStatus: "DELIVERED" },
  ],
});

const mapOrderPayment = (order = {}) => ({
  id: `order:${order._id}`,
  persisted: false,
  sourceOrder: order._id,
  sourceQuote: order.quote,
  lot: order.product,
  buyer: order.buyer,
  grower: order.grower,
  provider: normalizeProvider(order.paymentGateway || order.paymentMethod),
  gatewayOrderId: order.paymentGatewayOrderId || "",
  gatewayPaymentId: order.paymentReference || "",
  amount: getBuyerPayableAmount(order),
  currency: "INR",
  status: normalizePaymentStatus(order),
  escrowStatus: order.escrowStatus || "",
  paymentGatewayStatus: order.paymentGatewayStatus || "",
  paymentDueAt: order.paymentDueAt,
  createdAt: order.createdAt,
  updatedAt: order.updatedAt,
});

const mapOrderCommission = (order = {}) => {
  const commissionAmount = getCommissionAmount(order);
  const commissionTaxAmount = getCommissionTaxAmount(order);
  const taxAmount = toNumber(order.commissionGstAmount);
  const snapshot = order.financialSnapshot || {};
  const commissionParty = snapshot.buyerCommissionEnabled && snapshot.buyerCommissionAmount > 0
    ? "BUYER"
    : "GROWER";
  return {
    id: `order:${order._id}:commission`,
    persisted: false,
    sourceOrder: order._id,
    sourceQuote: order.quote,
    lot: order.product,
    buyer: order.buyer,
    grower: order.grower,
    commissionBase: roundMoney(snapshot.grossFruitSaleAmount || order.dealBreakdown?.commissionBase || getOrderAmount(order)),
    commissionPercent: commissionParty === "BUYER"
      ? toNumber(snapshot.buyerCommissionRate)
      : toNumber(snapshot.growerCommissionRate || order.dealBreakdown?.commissionPercent),
    commissionAmount,
    taxPercent: toNumber(order.commissionGstPercent),
    taxAmount,
    totalAmount: roundMoney(commissionAmount + taxAmount),
    status: order.commissionInvoiceNumber ? "INVOICED" : commissionAmount > 0 ? "ACCRUED" : "ACCRUED",
    invoiceNumber: order.commissionInvoiceNumber || "",
    invoiceDate: order.commissionInvoiceDate,
    receiptNumber: order.commissionReceiptNumber || "",
    receiptDate: order.commissionReceiptDate,
    metadata: {
      commissionParty,
      commissionVersion: snapshot.commissionVersion || order.commissionVersion || "legacy",
    },
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
};

const mapOrderSettlements = (order = {}) => {
  const mappedBeneficiaries = Array.isArray(order.beneficiaryMapping) && order.beneficiaryMapping.length
    ? order.beneficiaryMapping.map((beneficiary) => ({
        beneficiaryType: beneficiary.beneficiaryType,
        beneficiaryId: beneficiary.beneficiaryId,
        netAmount: roundMoney(beneficiary.settlementAmount),
        kycStatus: beneficiary.kycStatus,
        bankOrUpiVerified: beneficiary.bankOrUpiVerified,
      }))
    : [
        { beneficiaryType: "GROWER", beneficiaryId: order.grower, netAmount: getGrowerPayout(order) },
        { beneficiaryType: "LOGISTICS", beneficiaryId: order.driver, netAmount: getLogisticsAmount(order) },
        { beneficiaryType: "PLATFORM", beneficiaryId: "", netAmount: getCommissionAmount(order) },
      ];

  const releaseAllowed = Boolean(order.settlementEligibility?.settlementReleaseAllowed);
  const paymentStatus = normalizeStatus(order.paymentStatus);
  const status = paymentStatus === "RELEASED" ? "SETTLED" : releaseAllowed ? "ELIGIBLE" : "PENDING";

  return mappedBeneficiaries
    .filter((beneficiary) => beneficiary.beneficiaryType && beneficiary.netAmount > 0)
    .map((beneficiary) => ({
      id: `order:${order._id}:settlement:${beneficiary.beneficiaryType}`,
      persisted: false,
      sourceOrder: order._id,
      sourceQuote: order.quote,
      lot: order.product,
      beneficiaryType: beneficiary.beneficiaryType,
      beneficiaryId: beneficiary.beneficiaryId || "",
      grossAmount: beneficiary.netAmount,
      netAmount: beneficiary.netAmount,
      currency: "INR",
      status,
      kycStatus: beneficiary.kycStatus || "",
      bankOrUpiVerified: Boolean(beneficiary.bankOrUpiVerified),
      escrowStatus: order.escrowStatus || "",
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    }));
};

const mapOrderDocuments = (order = {}) => {
  const documents = [];

  if (order.invoiceNumber) {
    documents.push({
      id: `order:${order._id}:sale-bill`,
      persisted: false,
      documentType: "SALE_BILL",
      sourceType: "ORDER",
      sourceOrder: order._id,
      sourceQuote: order.quote,
      documentNumber: order.invoiceNumber,
      status: "GENERATED",
      issuedToUser: order.buyer,
      taxableAmount: getOrderAmount(order),
      totalAmount: getOrderAmount(order),
      createdAt: order.invoiceDate || order.createdAt,
    });
  }

  if (order.commissionInvoiceNumber) {
    documents.push({
      id: `order:${order._id}:commission-invoice`,
      persisted: false,
      documentType: "COMMISSION_INVOICE",
      sourceType: "ORDER",
      sourceOrder: order._id,
      sourceQuote: order.quote,
      documentNumber: order.commissionInvoiceNumber,
      status: "GENERATED",
      issuedToUser: order.buyer,
      taxableAmount: roundMoney(order.commissionTaxableAmount || getCommissionAmount(order)),
      taxAmount: roundMoney(order.commissionGstAmount),
      totalAmount: roundMoney(order.commissionTotalAmount || getCommissionAmount(order)),
      createdAt: order.commissionInvoiceDate || order.createdAt,
    });
  }

  if (order.commissionReceiptNumber) {
    documents.push({
      id: `order:${order._id}:commission-receipt`,
      persisted: false,
      documentType: "OTHER",
      sourceType: "ORDER",
      sourceOrder: order._id,
      sourceQuote: order.quote,
      documentNumber: order.commissionReceiptNumber,
      status: "GENERATED",
      issuedToUser: order.buyer,
      totalAmount: roundMoney(order.commissionTotalAmount || getCommissionAmount(order)),
      createdAt: order.commissionReceiptDate || order.createdAt,
    });
  }

  return documents;
};

const mapOrderLedgerEntries = (order = {}) => {
  if (!isOrderCompletedForMarketplace(order)) return [];

  const amount = getBuyerPayableAmount(order);
  const growerPayout = getGrowerPayout(order);
  const logisticsAmount = getLogisticsAmount(order);
  const commissionAmount = getCommissionAmount(order);
  const entries = [];

  if (amount > 0) {
    entries.push({
      id: `order:${order._id}:ledger:escrow`,
      persisted: false,
      sourceType: "ORDER",
      sourceOrder: order._id,
      accountCode: "1100",
      accountName: "Escrow / Payment Receivable",
      accountType: "ASSET",
      partyType: "BUYER",
      party: order.buyer,
      debit: amount,
      credit: 0,
      postingDate: order.createdAt,
      memo: "Buyer collection recorded from marketplace order",
    });
  }

  if (growerPayout > 0) {
    entries.push({
      id: `order:${order._id}:ledger:grower-payable`,
      persisted: false,
      sourceType: "SETTLEMENT",
      sourceOrder: order._id,
      accountCode: "2100",
      accountName: "Grower Settlement Payable",
      accountType: "LIABILITY",
      partyType: "GROWER",
      party: order.grower,
      debit: 0,
      credit: growerPayout,
      postingDate: order.createdAt,
      memo: "Grower payout liability",
    });
  }

  if (logisticsAmount > 0) {
    entries.push({
      id: `order:${order._id}:ledger:logistics-payable`,
      persisted: false,
      sourceType: "SETTLEMENT",
      sourceOrder: order._id,
      accountCode: "2200",
      accountName: "Logistics Settlement Payable",
      accountType: "LIABILITY",
      partyType: "LOGISTICS",
      party: order.driver,
      debit: 0,
      credit: logisticsAmount,
      postingDate: order.createdAt,
      memo: "Logistics payout liability",
    });
  }

  if (commissionAmount > 0) {
    entries.push({
      id: `order:${order._id}:ledger:commission`,
      persisted: false,
      sourceType: "COMMISSION",
      sourceOrder: order._id,
      accountCode: "4100",
      accountName: "Platform Commission Revenue",
      accountType: "REVENUE",
      partyType: "PLATFORM",
      debit: 0,
      credit: commissionAmount,
      postingDate: order.createdAt,
      memo: "OGPL marketplace commission",
    });
  }


  if (commissionTaxAmount > 0) {
    entries.push({
      id: `order:${order._id}:ledger:service-tax`,
      persisted: false,
      sourceType: "COMMISSION",
      sourceOrder: order._id,
      accountCode: "2400",
      accountName: "Service Tax Payable",
      accountType: "LIABILITY",
      partyType: "PLATFORM",
      debit: 0,
      credit: commissionTaxAmount,
      postingDate: order.createdAt,
      memo: "Configured service tax liability",
    });
  }

  return entries;
};

const makeSeriesKey = (date) => {
  const shifted = new Date(new Date(date).getTime() + IST_OFFSET_MS);
  return shifted.toISOString().slice(0, 10);
};

const formatTopPartyRows = async (rows, fallback) => {
  const ids = rows.map((row) => row._id).filter(Boolean);
  const users = await User.find({ _id: { $in: ids } })
    .select("name businessName buyerContactPerson orchardName logisticsName driverName")
    .lean();
  const userById = new Map(users.map((user) => [String(user._id), user]));

  return rows.map((row) => ({
    id: row._id,
    name: getPartyName(userById.get(String(row._id)), fallback),
    deals: row.deals || 0,
    amount: roundMoney(row.amount),
  }));
};

export const getAdminErpDashboard = async (req, res) => {
  const { start, end } = getIstDayRange();
  const last7DaysStart = new Date(start.getTime() - 6 * DAY_MS);

  const [
    todayOrders,
    escrowOrders,
    pendingSettlementOrders,
    completedDeals,
    failedPayments,
    verificationRequestsToday,
    persistedPaymentCount,
    persistedSettlementCount,
    persistedLedgerCount,
    supportOpenCount,
    topFruits,
    topBuyerRows,
    topGrowerRows,
    topStates,
    growthOrders,
  ] = await Promise.all([
    Order.find({
      createdAt: { $gte: start, $lt: end },
      $or: [
        { paymentStatus: { $in: ["ESCROW", "PAID", "RELEASED"] } },
        { deliveryStatus: "DELIVERED" },
      ],
    }).select("finalPrice totalAmount auctionPrice dealBreakdown platformCommission commissionTaxableAmount paymentStatus deliveryStatus growerPayout driverPayment createdAt").lean(),
    Order.find({ paymentStatus: "ESCROW" }).select("finalPrice totalAmount auctionPrice dealBreakdown paymentStatus").lean(),
    Order.find({ paymentStatus: { $in: ["ESCROW", "PAID"] }, "settlementEligibility.settlementReleaseAllowed": { $ne: true } }).select("_id").lean(),
    Order.countDocuments(getCompletedOrderQuery(req)),
    Order.countDocuments({ $or: [{ paymentStatus: "FAILED" }, { paymentGatewayStatus: "FAILED" }] }),
    VerificationRequest.find({ createdAt: { $gte: start, $lt: end }, "fee.paid": true }).select("fee").lean(),
    ErpPaymentTransaction.countDocuments(),
    ErpSettlement.countDocuments(),
    ErpLedgerEntry.countDocuments(),
    ErpSupportTicket.countDocuments({ status: { $in: ["OPEN", "IN_PROGRESS", "WAITING_ON_USER"] } }),
    Product.aggregate([
      { $match: { createdSource: "grower" } },
      { $group: { _id: { $ifNull: ["$fruitName", "$title"] }, lots: { $sum: 1 }, quantity: { $sum: { $ifNull: ["$quantity", 0] } } } },
      { $sort: { lots: -1, quantity: -1 } },
      { $limit: 10 },
    ]),
    Order.aggregate([
      { $match: { buyer: { $ne: null } } },
      { $group: { _id: "$buyer", deals: { $sum: 1 }, amount: { $sum: { $ifNull: ["$finalPrice", { $ifNull: ["$totalAmount", { $ifNull: ["$auctionPrice", 0] }] }] } } } },
      { $sort: { amount: -1 } },
      { $limit: 10 },
    ]),
    Order.aggregate([
      { $match: { grower: { $ne: null } } },
      { $group: { _id: "$grower", deals: { $sum: 1 }, amount: { $sum: { $ifNull: ["$finalPrice", { $ifNull: ["$totalAmount", { $ifNull: ["$auctionPrice", 0] }] }] } } } },
      { $sort: { amount: -1 } },
      { $limit: 10 },
    ]),
    Order.aggregate([
      { $match: { "shippingAddress.state": { $exists: true, $ne: "" } } },
      { $group: { _id: "$shippingAddress.state", deals: { $sum: 1 }, amount: { $sum: { $ifNull: ["$finalPrice", { $ifNull: ["$totalAmount", { $ifNull: ["$auctionPrice", 0] }] }] } } } },
      { $sort: { amount: -1 } },
      { $limit: 10 },
    ]),
    Order.find({
      createdAt: { $gte: last7DaysStart, $lt: end },
      $or: [
        { paymentStatus: { $in: ["ESCROW", "PAID", "RELEASED"] } },
        { deliveryStatus: "DELIVERED" },
      ],
    }).select("finalPrice totalAmount auctionPrice dealBreakdown platformCommission commissionTaxableAmount paymentStatus deliveryStatus createdAt").lean(),
  ]);

  const growthByDate = new Map();
  for (let index = 0; index < 7; index += 1) {
    const date = new Date(last7DaysStart.getTime() + index * DAY_MS);
    growthByDate.set(makeSeriesKey(date), { date: makeSeriesKey(date), deals: 0, gmv: 0, commission: 0 });
  }

  growthOrders.forEach((order) => {
    const key = makeSeriesKey(order.createdAt);
    const current = growthByDate.get(key) || { date: key, deals: 0, gmv: 0, commission: 0 };
    current.deals += 1;
    current.gmv = roundMoney(current.gmv + getOrderAmount(order));
    current.commission = roundMoney(current.commission + getCommissionAmount(order));
    growthByDate.set(key, current);
  });

  const todayGmv = todayOrders.reduce((sum, order) => sum + getOrderAmount(order), 0);
  const todayCommission = todayOrders.reduce((sum, order) => sum + getCommissionAmount(order), 0);
  const todaySettlements = todayOrders.reduce((sum, order) => sum + getGrowerPayout(order) + getLogisticsAmount(order), 0);
  const escrowBalance = escrowOrders.reduce((sum, order) => sum + getOrderAmount(order), 0);
  const verificationRevenue = verificationRequestsToday.reduce((sum, request) => sum + toNumber(request.fee?.totalAmount), 0);

  res.json({
    success: true,
    timezone: "Asia/Kolkata",
    generatedAt: new Date().toISOString(),
    source: "existing_marketplace_data_plus_erp_foundation",
    kpis: {
      todayGmv: roundMoney(todayGmv),
      todayRevenue: roundMoney(todayCommission + verificationRevenue),
      todayCommission: roundMoney(todayCommission),
      todaySettlements: roundMoney(todaySettlements),
      todayCollections: roundMoney(todayGmv + verificationRevenue),
      escrowBalance: roundMoney(escrowBalance),
      pendingSettlements: pendingSettlementOrders.length,
      completedDeals,
      failedPayments,
      refunds: await ErpRefund.countDocuments({ status: { $in: ["REQUESTED", "APPROVED", "PROCESSING"] } }),
      verificationRevenue: roundMoney(verificationRevenue),
      openSupportTickets: supportOpenCount,
    },
    topFruits: topFruits.map((item) => ({
      fruit: item._id || "Unknown",
      lots: item.lots,
      quantity: roundMoney(item.quantity),
    })),
    topBuyers: await formatTopPartyRows(topBuyerRows, "Buyer"),
    topGrowers: await formatTopPartyRows(topGrowerRows, "Grower"),
    topStates: topStates.map((item) => ({
      state: item._id || "Unknown",
      deals: item.deals,
      amount: roundMoney(item.amount),
    })),
    growthAnalytics: Array.from(growthByDate.values()),
    dataFoundation: {
      paymentTransactions: persistedPaymentCount,
      settlements: persistedSettlementCount,
      ledgerEntries: persistedLedgerCount,
      supportTickets: supportOpenCount,
    },
  });
};

export const listAdminErpPayments = async (req, res) => {
  const limit = getLimit(req);
  const [persisted, orders] = await Promise.all([
    ErpPaymentTransaction.find().sort({ createdAt: -1 }).limit(limit).lean(),
    Order.find(getOrderQuery(req))
      .select("quote product buyer grower finalPrice totalAmount auctionPrice dealBreakdown financialSnapshot paymentStatus paymentMethod paymentReference paymentGateway paymentGatewayOrderId paymentGatewayStatus escrowStatus paymentDueAt createdAt updatedAt")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean(),
  ]);

  res.json({
    success: true,
    count: persisted.length + orders.length,
    persistedCount: persisted.length,
    derivedCount: orders.length,
    payments: [
      ...persisted.map((payment) => ({ ...payment, persisted: true })),
      ...orders.map(mapOrderPayment),
    ],
  });
};

export const listAdminErpSettlements = async (req, res) => {
  const limit = getLimit(req);
  const [persisted, orders] = await Promise.all([
    ErpSettlement.find().sort({ createdAt: -1 }).limit(limit).lean(),
    Order.find(getOrderQuery(req))
      .select("quote product buyer grower driver beneficiaryMapping settlementEligibility paymentStatus escrowStatus finalPrice totalAmount auctionPrice dealBreakdown financialSnapshot growerPayout driverPayment platformCommission createdAt updatedAt")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean(),
  ]);

  const derived = orders.flatMap(mapOrderSettlements);
  res.json({
    success: true,
    count: persisted.length + derived.length,
    persistedCount: persisted.length,
    derivedCount: derived.length,
    settlements: [
      ...persisted.map((settlement) => ({ ...settlement, persisted: true })),
      ...derived,
    ],
  });
};

export const listAdminErpCommissions = async (req, res) => {
  const limit = getLimit(req);
  const [persisted, orders, quotes] = await Promise.all([
    ErpCommissionLedger.find().sort({ createdAt: -1 }).limit(limit).lean(),
    Order.find(getOrderQuery(req))
      .select("quote product buyer grower finalPrice totalAmount auctionPrice dealBreakdown financialSnapshot commissionVersion platformCommission commissionTaxableAmount commissionGstPercent commissionGstAmount commissionTotalAmount commissionInvoiceNumber commissionInvoiceDate commissionReceiptNumber commissionReceiptDate createdAt updatedAt")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean(),
    Quotation.find({ status: { $in: ["accepted", "ACCEPTED"] } })
      .select("lot buyer grower commissionBase commissionPercent commissionAmount platformServiceFee createdAt updatedAt")
      .sort({ updatedAt: -1 })
      .limit(Math.min(limit, 100))
      .lean(),
  ]);

  const orderCommissions = orders.map(mapOrderCommission);
  const quoteCommissions = quotes.map((quote) => ({
    id: `quote:${quote._id}:commission`,
    persisted: false,
    sourceQuote: quote._id,
    lot: quote.lot,
    buyer: quote.buyer,
    grower: quote.grower,
    commissionBase: roundMoney(quote.commissionBase),
    commissionPercent: toNumber(quote.commissionPercent),
    commissionAmount: roundMoney(quote.platformServiceFee || quote.commissionAmount),
    totalAmount: roundMoney(quote.platformServiceFee || quote.commissionAmount),
    status: "ACCRUED",
    createdAt: quote.createdAt,
    updatedAt: quote.updatedAt,
  }));

  res.json({
    success: true,
    count: persisted.length + orderCommissions.length + quoteCommissions.length,
    persistedCount: persisted.length,
    derivedCount: orderCommissions.length + quoteCommissions.length,
    commissions: [
      ...persisted.map((commission) => ({ ...commission, persisted: true })),
      ...orderCommissions,
      ...quoteCommissions,
    ],
  });
};

export const listAdminErpDocuments = async (req, res) => {
  const limit = getLimit(req);
  const [persisted, orders, verificationRequests] = await Promise.all([
    ErpDocumentRecord.find().sort({ createdAt: -1 }).limit(limit).lean(),
    Order.find(getCompletedOrderQuery(req))
      .select("quote buyer grower invoiceNumber invoiceDate commissionInvoiceNumber commissionInvoiceDate commissionReceiptNumber commissionReceiptDate commissionTaxableAmount commissionGstAmount commissionTotalAmount finalPrice totalAmount auctionPrice dealBreakdown paymentStatus deliveryStatus createdAt")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean(),
    VerificationRequest.find({ "fee.paid": true })
      .select("user roleType verificationType fee createdAt")
      .sort({ createdAt: -1 })
      .limit(Math.min(limit, 100))
      .lean(),
  ]);

  const persistedOrderIds = persisted
    .map((document) => document.sourceOrder)
    .filter(Boolean)
    .map((id) => id.toString());
  const persistedOrderStatusRows = persistedOrderIds.length
    ? await Order.find({ _id: { $in: persistedOrderIds } })
        .select("paymentStatus deliveryStatus")
        .lean()
    : [];
  const completedPersistedOrderIds = new Set(
    persistedOrderStatusRows
      .filter(isOrderCompletedForMarketplace)
      .map((order) => order._id.toString())
  );
  const visiblePersisted = persisted.filter(
    (document) =>
      !document.sourceOrder ||
      completedPersistedOrderIds.has(document.sourceOrder.toString())
  );
  const orderDocuments = orders.flatMap(mapOrderDocuments);
  const verificationDocuments = verificationRequests.map((request) => ({
    id: `verification:${request._id}:invoice`,
    persisted: false,
    documentType: "VERIFICATION_INVOICE",
    sourceType: "VERIFICATION",
    sourceVerification: request._id,
    documentNumber: `OGV-${request._id}`,
    status: "GENERATED",
    issuedToUser: request.user,
    taxableAmount: roundMoney(request.fee?.baseAmount),
    taxAmount: roundMoney(request.fee?.taxAmount),
    totalAmount: roundMoney(request.fee?.totalAmount),
    metadata: {
      roleType: request.roleType,
      verificationType: request.verificationType,
    },
    createdAt: request.fee?.paidAt || request.createdAt,
  }));

  res.json({
    success: true,
    count: visiblePersisted.length + orderDocuments.length + verificationDocuments.length,
    persistedCount: visiblePersisted.length,
    derivedCount: orderDocuments.length + verificationDocuments.length,
    documents: [
      ...visiblePersisted.map((document) => ({ ...document, persisted: true })),
      ...orderDocuments,
      ...verificationDocuments,
    ],
  });
};

export const listAdminErpLedgerEntries = async (req, res) => {
  const limit = getLimit(req);
  const [persisted, orders] = await Promise.all([
    ErpLedgerEntry.find().sort({ postingDate: -1, createdAt: -1 }).limit(limit).lean(),
    Order.find(getCompletedOrderQuery(req))
      .select("buyer grower driver finalPrice totalAmount auctionPrice dealBreakdown financialSnapshot growerPayout driverPayment platformCommission commissionTaxableAmount commissionGstAmount paymentStatus deliveryStatus createdAt")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean(),
  ]);

  const persistedOrderIds = persisted
    .map((entry) => entry.sourceOrder)
    .filter(Boolean)
    .map((id) => id.toString());
  const persistedOrderStatusRows = persistedOrderIds.length
    ? await Order.find({ _id: { $in: persistedOrderIds } })
        .select("paymentStatus deliveryStatus")
        .lean()
    : [];
  const completedPersistedOrderIds = new Set(
    persistedOrderStatusRows
      .filter(isOrderCompletedForMarketplace)
      .map((order) => order._id.toString())
  );
  const visiblePersisted = persisted.filter(
    (entry) =>
      !entry.sourceOrder ||
      completedPersistedOrderIds.has(entry.sourceOrder.toString())
  );
  const derived = orders.flatMap(mapOrderLedgerEntries);
  res.json({
    success: true,
    count: visiblePersisted.length + derived.length,
    persistedCount: visiblePersisted.length,
    derivedCount: derived.length,
    ledgerEntries: [
      ...visiblePersisted.map((entry) => ({ ...entry, persisted: true })),
      ...derived,
    ],
  });
};

export const listAdminErpAuditEvents = async (req, res) => {
  const limit = getLimit(req);
  const [erpEvents, adminAccounts] = await Promise.all([
    ErpAuditEvent.find().sort({ createdAt: -1 }).limit(limit).lean(),
    Admin.find({ "auditLogs.0": { $exists: true } })
      .select("name email role auditLogs")
      .sort({ updatedAt: -1 })
      .limit(Math.min(limit, 50))
      .lean(),
  ]);

  const embeddedAdminEvents = adminAccounts.flatMap((admin) =>
    (admin.auditLogs || []).map((event) => ({
      id: `admin:${admin._id}:${event.at || event.action}`,
      persisted: false,
      platform: "admin",
      module: "System Administration",
      action: event.action,
      entityType: "Admin",
      entityId: admin._id,
      actorAdmin: event.by,
      riskLevel: ["TERMINATE", "DELETE", "RESET_PASSWORD"].includes(normalizeStatus(event.action)) ? "HIGH" : "MEDIUM",
      before: event.from,
      after: event.to,
      note: event.note,
      createdAt: event.at,
      targetAdmin: {
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    }))
  );

  res.json({
    success: true,
    count: erpEvents.length + embeddedAdminEvents.length,
    persistedCount: erpEvents.length,
    derivedCount: embeddedAdminEvents.length,
    auditEvents: [
      ...erpEvents.map((event) => ({ ...event, persisted: true })),
      ...embeddedAdminEvents.sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0)),
    ].slice(0, limit),
  });
};

export const listAdminErpNotificationLogs = async (req, res) => {
  const limit = getLimit(req);
  const query = {};
  if (req.query.channel) query.channel = normalizeStatus(req.query.channel);
  if (req.query.status) query.status = normalizeStatus(req.query.status);

  const logs = await ErpNotificationLog.find(query).sort({ createdAt: -1 }).limit(limit).lean();
  res.json({ success: true, count: logs.length, notifications: logs });
};

export const listAdminErpSupportTickets = async (req, res) => {
  const limit = getLimit(req);
  const query = {};
  if (req.query.status) query.status = normalizeStatus(req.query.status);
  if (req.query.type) query.type = normalizeStatus(req.query.type);

  const tickets = await ErpSupportTicket.find(query)
    .populate("openedBy", "name phone email businessName orchardName")
    .populate("assignedTo", "name email role")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  res.json({ success: true, count: tickets.length, tickets });
};

export const listAdminErpRefunds = async (req, res) => {
  const limit = getLimit(req);
  const query = {};
  if (req.query.status) query.status = normalizeStatus(req.query.status);

  const refunds = await ErpRefund.find(query).sort({ createdAt: -1 }).limit(limit).lean();
  res.json({ success: true, count: refunds.length, refunds });
};
