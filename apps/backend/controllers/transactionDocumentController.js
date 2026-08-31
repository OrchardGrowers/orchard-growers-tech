import mongoose from "mongoose";
import ErpDocumentRecord from "../models/ErpDocumentRecord.js";
import { isAdminRole } from "../middleware/authMiddleware.js";
import {
  canAccessTransactionDocument,
  getDocumentAccessFilter,
} from "../services/transactionDocumentService.js";
import { createTransactionDocumentPdf } from "../services/transactionDocumentPdfService.js";
import { canViewPrivateLotPrice } from "../services/lotPricePrivacyService.js";

const clampLimit = (value) => Math.min(Math.max(Number(value) || 100, 1), 250);
const TRANSACTION_DOCUMENT_TYPES = [
  "LOT_CHALLAN",
  "SALES_INVOICE",
  "GROWER_COMMISSION_INVOICE",
  "BUYER_COMMISSION_INVOICE",
];

const adminFilter = (query = {}) => {
  const filter = {
    platform: "efruitmandi",
    documentType: { $in: TRANSACTION_DOCUMENT_TYPES },
  };
  const documentType = String(query.documentType || "").trim().toUpperCase();
  if (documentType && TRANSACTION_DOCUMENT_TYPES.includes(documentType)) {
    filter.documentType = documentType;
  }
  const documentNumber = String(query.documentNumber || "").trim();
  if (documentNumber) filter.documentNumber = { $regex: documentNumber, $options: "i" };
  const lotId = String(query.lotId || "").trim();
  if (mongoose.isValidObjectId(lotId)) filter.sourceLot = lotId;
  const dealId = String(query.dealId || "").trim();
  if (mongoose.isValidObjectId(dealId)) filter.sourceOrder = dealId;
  const userId = String(query.userId || "").trim();
  if (mongoose.isValidObjectId(userId)) filter.$or = [{ grower: userId }, { buyer: userId }];
  return filter;
};

export const sanitizeDocumentForViewer = (documentValue, user = {}, isAdmin = false) => {
  let document = documentValue?.toObject ? documentValue.toObject() : { ...documentValue };
  if (!canViewPrivateLotPrice({ createdBy: document.grower }, user) && document.snapshot?.lot) {
    const lot = { ...document.snapshot.lot };
    delete lot.baseRate;
    delete lot.estimatedValue;
    document = { ...document, snapshot: { ...document.snapshot, lot } };
  }
  if (isAdmin || document.documentType !== "SALES_INVOICE" || !document.snapshot?.financial) {
    return document;
  }
  const userId = String(user.id || user._id || "");
  const isGrower = String(document.grower || "") === userId;
  const isBuyer = String(document.buyer || "") === userId;
  const financial = { ...document.snapshot.financial };
  delete financial.platformRevenueMinor;
  delete financial.platformRevenue;
  delete financial.taxMinor;
  delete financial.taxAmount;
  if (isGrower && !isBuyer) {
    for (const key of Object.keys(financial)) {
      if (key.startsWith("buyerCommission") || key.startsWith("buyerTotal")) delete financial[key];
    }
  }
  if (isBuyer && !isGrower) {
    for (const key of Object.keys(financial)) {
      if (key.startsWith("growerCommission") || key.startsWith("growerNet")) delete financial[key];
    }
    delete financial.logisticsMinor;
    delete financial.logisticsAmount;
    delete financial.labourMinor;
    delete financial.labourAmount;
  }
  return {
    ...document,
    snapshot: { ...document.snapshot, financial },
  };
};

export const listMyTransactionDocuments = async (req, res) => {
  const isAdmin = isAdminRole(req.user?.role);
  const filter = isAdmin
    ? adminFilter(req.query)
    : {
        platform: "efruitmandi",
        documentType: { $in: TRANSACTION_DOCUMENT_TYPES },
        ...getDocumentAccessFilter(req.user),
      };
  const documents = await ErpDocumentRecord.find(filter)
    .sort({ finalizedAt: -1, createdAt: -1 })
    .limit(clampLimit(req.query.limit))
    .lean();
  res.setHeader("Cache-Control", "private, no-store");
  res.json({
    success: true,
    documents: documents.map((document) => sanitizeDocumentForViewer(document, req.user, isAdmin)),
  });
};

const loadAuthorizedDocument = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400).json({ msg: "Invalid document identifier" });
    return null;
  }
  const document = await ErpDocumentRecord.findById(req.params.id);
  if (!document || !TRANSACTION_DOCUMENT_TYPES.includes(document.documentType)) {
    res.status(404).json({ msg: "Transaction document not found" });
    return null;
  }
  if (!canAccessTransactionDocument(document, req.user, isAdminRole(req.user?.role))) {
    res.status(403).json({ msg: "You cannot access this transaction document" });
    return null;
  }
  return document;
};

export const getTransactionDocument = async (req, res) => {
  const document = await loadAuthorizedDocument(req, res);
  if (document) {
    res.setHeader("Cache-Control", "private, no-store");
    res.json({
      success: true,
      document: sanitizeDocumentForViewer(
        document,
        req.user,
        isAdminRole(req.user?.role)
      ),
    });
  }
};

export const downloadTransactionDocumentPdf = async (req, res) => {
  const document = await loadAuthorizedDocument(req, res);
  if (!document) return;
  const disposition = String(req.query.disposition || "attachment").toLowerCase() === "inline"
    ? "inline"
    : "attachment";
  const safeNumber = String(document.documentNumber || document._id).replace(/[^A-Za-z0-9._-]/g, "-");
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `${disposition}; filename="${safeNumber}.pdf"`);
  res.setHeader("Cache-Control", "private, no-store");
  createTransactionDocumentPdf(sanitizeDocumentForViewer(
    document,
    req.user,
    isAdminRole(req.user?.role)
  )).pipe(res);
};
