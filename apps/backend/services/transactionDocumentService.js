import ErpDocumentRecord from "../models/ErpDocumentRecord.js";
import Product from "../models/Product.js";
import User from "../models/User.js";
import UserNotification from "../models/UserNotification.js";
import {
  generateBuyerCommissionInvoiceNo,
  generateGrowerCommissionInvoiceNo,
  generateLotChallanNo,
  generateSalesInvoiceNo,
} from "./invoiceNumberingService.js";

const PLATFORM_NAME = "eFruitMandi.live";
const PLATFORM_ENTITY = "Orchard Growers Private Limited";

const plain = (value) => (value?.toObject ? value.toObject() : value || {});
const idOf = (value) => value?._id || value || undefined;
const text = (...values) => {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (normalized) return normalized;
  }
  return "";
};
const money = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const maskPan = (value) => {
  const pan = String(value || "").trim().toUpperCase();
  if (!pan) return "";
  if (pan.length < 5) return "****";
  return `${pan.slice(0, 2)}*****${pan.slice(-3)}`;
};

const partySnapshot = (source = {}, role) => {
  const user = plain(source);
  const kyc = plain(user.kycByRole?.[role] || user.kyc);
  return {
    userId: String(user._id || ""),
    role,
    name: text(kyc.fullName, user.name),
    businessName: text(
      role === "grower" ? kyc.orchardName : user.businessName,
      user.orchardName,
      user.businessName
    ),
    address: text(
      kyc.address,
      [user.businessAddressLine1, user.businessAddressLine2, user.businessAddressLine3]
        .filter(Boolean)
        .join(", "),
      [user.addressLine1, user.addressLine2, user.addressLine3].filter(Boolean).join(", "),
      user.location,
      user.buyerLocation
    ),
    village: text(kyc.village, user.village),
    district: text(kyc.district),
    state: text(kyc.state),
    pinCode: text(kyc.pinCode, user.businessPinCode, user.pinCode, user.buyerPinCode),
    phone: text(kyc.phone, user.phone, user.contact),
    email: text(kyc.email, user.email),
    kycStatus: text(kyc.status),
    maskedPan: maskPan(kyc.panNumber),
    gstNumber: text(kyc.gstNumber, user.gstNumber),
  };
};

const lotSnapshot = (source = {}) => {
  const lot = plain(source);
  return {
    lotId: String(lot._id || ""),
    lotNumber: text(lot.lotNo),
    title: text(lot.title, lot.fruitName),
    fruit: text(lot.fruitName, lot.title),
    variety: text(lot.variety),
    grade: text(lot.quality),
    gradeLots: (lot.gradeLots || []).map((grade) => ({
      grade: text(grade.grade),
      boxes: Number(grade.boxes || 0),
      weightKg: Number(grade.weightKg || 0),
    })),
    quantity: Number(lot.quantity || 0),
    boxes: Number(lot.packingSummary?.totalPackages || lot.quantity || 0),
    approximateWeightKg: Number(lot.totalWeightKg || lot.packingSummary?.totalWeightKg || 0),
    weightPerBoxKg: Number(lot.packingWeightKg || 0),
    packingType: text(lot.packingType),
    packingBreakdown: plain(lot.packingBreakdown || []),
    sizeCount: (lot.packingBreakdown || [])
      .map((packing) => [packing.size, packing.countPreset].filter(Boolean).join(" / "))
      .filter(Boolean)
      .join(", "),
    location: text(lot.location),
    baseRate: money(lot.basePrice),
    unit: text(lot.unit, "per box"),
    estimatedValue: money(Number(lot.basePrice || 0) * Number(lot.quantity || 0)),
    qualityDescription: text(lot.description),
    status: text(lot.status),
    listingType: lot.auctionStartTime || lot.auctionEndTime ? "Timed marketplace listing" : "Marketplace listing",
    listingDate: lot.createdAt,
    offerWindowStart: lot.auctionStartTime,
    offerWindowEnd: lot.auctionEndTime,
    photoCount: Array.isArray(lot.images) ? lot.images.length : 0,
  };
};

const notifyDocumentAvailable = async ({ userId, document, title, message }) => {
  if (!userId || !document?._id) return null;
  return UserNotification.findOneAndUpdate(
    {
      user: userId,
      type: "TRANSACTION_DOCUMENT_AVAILABLE",
      entityId: document._id,
    },
    {
      $setOnInsert: {
        user: userId,
        type: "TRANSACTION_DOCUMENT_AVAILABLE",
        title,
        message,
        status: "AVAILABLE",
        entityId: document._id,
        actionUrl: "/invoices-chalan",
        metadata: {
          documentId: document._id,
          documentNumber: document.documentNumber,
          documentType: document.documentType,
        },
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
};

const findUser = async (value) => {
  const source = plain(value);
  if (source?._id && (source.name || source.email || source.kyc || source.kycByRole)) return source;
  const id = idOf(value);
  return id ? User.findById(id).lean() : null;
};

const findLot = async (value) => {
  const source = plain(value);
  if (source?._id && (source.title || source.fruitName || source.lotNo)) return source;
  const id = idOf(value);
  return id ? Product.findById(id).lean() : null;
};

const createImmutableDocument = async ({ query, numberFactory, payload }) => {
  const existing = await ErpDocumentRecord.findOne(query).lean();
  if (existing) return existing;
  const generatedAt = payload.finalizedAt || payload.generatedAt || new Date();
  const documentNumber = await numberFactory(generatedAt);
  try {
    return await ErpDocumentRecord.findOneAndUpdate(
      query,
      {
        $setOnInsert: {
          ...payload,
          documentNumber,
          status: payload.status || "FINAL",
          version: 1,
          finalizedAt: payload.finalizedAt || generatedAt,
          versions: [
            {
              version: 1,
              generatedAt,
              note: "Initial immutable transaction document",
            },
          ],
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();
  } catch (error) {
    if (error?.code !== 11000) throw error;
    const concurrentDocument = await ErpDocumentRecord.findOne(query).lean();
    if (!concurrentDocument) throw error;
    return concurrentDocument;
  }
};

export const ensureLotListingChallan = async (product, { grower } = {}) => {
  const lot = await findLot(product);
  if (!lot?._id) throw new Error("Lot is required to generate a listing challan");
  const lotGrower = await findUser(grower || lot.createdBy);
  if (!lotGrower?._id) throw new Error("Grower is required to generate a listing challan");
  const snapshot = {
    platform: { name: PLATFORM_NAME, legalEntity: PLATFORM_ENTITY },
    documentTitle: "GROWER LOT LISTING CHALLAN",
    lot: lotSnapshot(lot),
    grower: partySnapshot(lotGrower, "grower"),
    declaration:
      "The Grower confirms that the submitted fruit lot information is correct to the best of their knowledge and understands that quantity, grade, weight, packing and other transaction details may be verified or finalized before deal completion.",
    disclaimer:
      "This is a system-generated listing document. It is not a tax invoice, sales invoice, payment receipt, proof of sale, or proof of settlement.",
  };
  const document = await createImmutableDocument({
    query: {
      platform: "efruitmandi",
      sourceType: "LOT",
      sourceLot: lot._id,
      documentType: "LOT_CHALLAN",
    },
    numberFactory: generateLotChallanNo,
    payload: {
      platform: "efruitmandi",
      documentType: "LOT_CHALLAN",
      sourceType: "LOT",
      sourceLot: lot._id,
      grower: lotGrower._id,
      issuedFrom: PLATFORM_ENTITY,
      issuedToUser: lotGrower._id,
      issuedToName: snapshot.grower.name || snapshot.grower.businessName,
      recipientRole: "GROWER",
      currency: "INR",
      snapshot,
      metadata: { lotNumber: lot.lotNo || "", listingStatus: lot.status || "" },
      finalizedAt: lot.createdAt || new Date(),
    },
  });
  await notifyDocumentAvailable({
    userId: lotGrower._id,
    document,
    title: "Lot Listing Challan Available",
    message: `Your lot has been listed successfully. Challan ${document.documentNumber} is now available.`,
  });
  return document;
};

const transactionSnapshot = ({ order, lot, grower, buyer, financialSnapshot }) => ({
  platform: { name: PLATFORM_NAME, legalEntity: PLATFORM_ENTITY },
  deal: {
    orderId: String(order._id || ""),
    quoteId: String(idOf(order.quote) || ""),
    lotId: String(idOf(lot) || idOf(order.product) || ""),
    paymentReference: text(order.paymentReference),
    paymentStatus: text(order.paymentStatus),
    deliveryStatus: text(order.deliveryStatus),
    receivingStatus: text(order.receivingStatus),
    completedAt: financialSnapshot.lockedAt,
    deliveryDate: order.receivingDecisionAt || order.updatedAt,
  },
  lot: lotSnapshot(lot),
  seller: partySnapshot(grower, "grower"),
  buyer: partySnapshot(buyer, "buyer"),
  financial: financialSnapshot,
  items: (order.dealBreakdown?.grades || order.items || []).map((item) => ({
    fruit: text(item.title, lot?.fruitName, lot?.title),
    variety: text(lot?.variety),
    grade: text(item.grade, lot?.quality),
    quantity: Number(item.quantity || 0),
    actualWeightKg: Number(item.weightKg || 0),
    rate: money(item.price || item.quotedRatePerUnit || item.unitPrice || 0),
    amount: money(item.amount || item.lineTotal || 0),
    unit: text(lot?.unit, "unit"),
  })),
});

export const ensureFinalTransactionDocuments = async (orderValue) => {
  const order = plain(orderValue);
  const financialSnapshot = plain(order.financialSnapshot);
  if (!order?._id || !financialSnapshot?.lockedAt) {
    throw new Error("A locked financial snapshot is required before final documents can be generated");
  }
  const [lot, grower, buyer] = await Promise.all([
    findLot(order.product),
    findUser(order.grower),
    findUser(order.buyer),
  ]);
  if (!lot || !grower || !buyer) {
    throw new Error("Lot, Grower, and Buyer are required for final transaction documents");
  }
  const baseSnapshot = transactionSnapshot({ order, lot, grower, buyer, financialSnapshot });
  const finalizedAt = new Date(financialSnapshot.lockedAt);
  const common = {
    platform: "efruitmandi",
    sourceType: "ORDER",
    sourceOrder: order._id,
    sourceQuote: idOf(order.quote),
    sourceLot: lot._id,
    grower: grower._id,
    buyer: buyer._id,
    issuedFrom: "Grower via eFruitMandi.live",
    currency: financialSnapshot.currency || "INR",
    finalizedAt,
  };
  const salesInvoice = await createImmutableDocument({
    query: {
      platform: "efruitmandi",
      sourceType: "ORDER",
      sourceOrder: order._id,
      documentType: "SALES_INVOICE",
      recipientRole: "BOTH",
    },
    numberFactory: generateSalesInvoiceNo,
    payload: {
      ...common,
      documentType: "SALES_INVOICE",
      issuedToUser: buyer._id,
      issuedToName: baseSnapshot.buyer.businessName || baseSnapshot.buyer.name,
      recipientRole: "BOTH",
      taxableAmount: financialSnapshot.grossFruitSaleAmount,
      totalAmount: financialSnapshot.grossFruitSaleAmount,
      snapshot: {
        ...baseSnapshot,
        documentTitle: "FINAL SALES INVOICE",
        totalFruitSaleValue: financialSnapshot.grossFruitSaleAmount,
      },
      metadata: {
        marketplaceRole: "FACILITATOR",
        generatedOnBehalfOf: "GROWER",
        excludesPlatformCommission: true,
      },
    },
  });

  const documents = [salesInvoice];
  if (financialSnapshot.growerCommissionEnabled && financialSnapshot.growerCommissionMinor > 0) {
    documents.push(
      await createImmutableDocument({
        query: {
          platform: "efruitmandi",
          sourceType: "ORDER",
          sourceOrder: order._id,
          documentType: "GROWER_COMMISSION_INVOICE",
          recipientRole: "GROWER",
        },
        numberFactory: generateGrowerCommissionInvoiceNo,
        payload: {
          ...common,
          documentType: "GROWER_COMMISSION_INVOICE",
          issuedFrom: PLATFORM_ENTITY,
          issuedToUser: grower._id,
          issuedToName: baseSnapshot.seller.businessName || baseSnapshot.seller.name,
          recipientRole: "GROWER",
          taxableAmount: financialSnapshot.growerCommissionAmount,
          taxAmount: money(financialSnapshot.growerCommissionTaxAmount),
          totalAmount:
            money(financialSnapshot.growerCommissionAmount) +
            money(financialSnapshot.growerCommissionTaxAmount),
          snapshot: {
            ...baseSnapshot,
            documentTitle: "PLATFORM COMMISSION / SERVICE INVOICE",
            commissionParty: "GROWER",
            commissionRate: financialSnapshot.growerCommissionRate,
            commissionAmount: financialSnapshot.growerCommissionAmount,
          },
          metadata: {
            revenueType: "MARKETPLACE_COMMISSION",
            commissionParty: "GROWER",
            commissionVersion: financialSnapshot.commissionVersion,
          },
        },
      })
    );
  }
  if (financialSnapshot.buyerCommissionEnabled && financialSnapshot.buyerCommissionMinor > 0) {
    documents.push(
      await createImmutableDocument({
        query: {
          platform: "efruitmandi",
          sourceType: "ORDER",
          sourceOrder: order._id,
          documentType: "BUYER_COMMISSION_INVOICE",
          recipientRole: "BUYER",
        },
        numberFactory: generateBuyerCommissionInvoiceNo,
        payload: {
          ...common,
          documentType: "BUYER_COMMISSION_INVOICE",
          issuedFrom: PLATFORM_ENTITY,
          issuedToUser: buyer._id,
          issuedToName: baseSnapshot.buyer.businessName || baseSnapshot.buyer.name,
          recipientRole: "BUYER",
          taxableAmount: financialSnapshot.buyerCommissionAmount,
          taxAmount: money(financialSnapshot.buyerCommissionTaxAmount),
          totalAmount:
            money(financialSnapshot.buyerCommissionAmount) +
            money(financialSnapshot.buyerCommissionTaxAmount),
          snapshot: {
            ...baseSnapshot,
            documentTitle: "PLATFORM COMMISSION / SERVICE INVOICE",
            commissionParty: "BUYER",
            commissionRate: financialSnapshot.buyerCommissionRate,
            commissionAmount: financialSnapshot.buyerCommissionAmount,
          },
          metadata: {
            revenueType: "MARKETPLACE_COMMISSION",
            commissionParty: "BUYER",
            commissionVersion: financialSnapshot.commissionVersion,
          },
        },
      })
    );
  }

  await Promise.all([
    notifyDocumentAvailable({
      userId: grower._id,
      document: salesInvoice,
      title: "Final Sales Invoice Available",
      message: `Final Sales Invoice ${salesInvoice.documentNumber} is available.`,
    }),
    notifyDocumentAvailable({
      userId: buyer._id,
      document: salesInvoice,
      title: "Final Sales Invoice Available",
      message: `Final Sales Invoice ${salesInvoice.documentNumber} is available.`,
    }),
    ...documents
      .filter((document) => document.documentType.endsWith("COMMISSION_INVOICE"))
      .map((document) =>
        notifyDocumentAvailable({
          userId: document.issuedToUser,
          document,
          title: "Platform Service Invoice Available",
          message: `Platform service invoice ${document.documentNumber} is available.`,
        })
      ),
  ]);

  return documents;
};

export const getDocumentAccessFilter = (user = {}) => {
  const userId = user.id || user._id;
  return {
    $or: [
      { issuedToUser: userId },
      { recipientRole: "BOTH", grower: userId },
      { recipientRole: "BOTH", buyer: userId },
    ],
  };
};

export const canAccessTransactionDocument = (document, user = {}, isAdmin = false) => {
  if (isAdmin) return true;
  const userId = String(user.id || user._id || "");
  if (!userId) return false;
  const recipient = String(idOf(document.issuedToUser) || "");
  if (recipient === userId) return true;
  if (document.recipientRole !== "BOTH") return false;
  return [document.grower, document.buyer].some((participant) => String(idOf(participant) || "") === userId);
};
