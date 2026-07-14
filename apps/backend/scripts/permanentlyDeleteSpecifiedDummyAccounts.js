#!/usr/bin/env node
import crypto from "crypto";
import dns from "dns";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import mongoose from "mongoose";
import Admin from "../models/Admin.js";
import Auction from "../models/Auction.js";
import CaptureSession from "../models/CaptureSession.js";
import Delivery from "../models/Delivery.js";
import ErpAuditEvent from "../models/ErpAuditEvent.js";
import ErpCommissionLedger from "../models/ErpCommissionLedger.js";
import ErpDocumentRecord from "../models/ErpDocumentRecord.js";
import ErpLedgerEntry from "../models/ErpLedgerEntry.js";
import ErpNotificationLog from "../models/ErpNotificationLog.js";
import ErpPaymentTransaction from "../models/ErpPaymentTransaction.js";
import ErpRefund from "../models/ErpRefund.js";
import ErpSettlement from "../models/ErpSettlement.js";
import ErpSupportTicket from "../models/ErpSupportTicket.js";
import LogisticsShipment from "../models/LogisticsShipment.js";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import ProfilePublication from "../models/ProfilePublication.js";
import Quotation from "../models/Quotation.js";
import User from "../models/User.js";
import VerificationRequest from "../models/VerificationRequest.js";
import { deleteCloudinaryAssetsByUrls } from "../services/cloudinaryService.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = path.resolve(__dirname, "../.local/permanent-delete-six-dummy-accounts.json");
const CONFIRMATION = "DELETE SIX DUMMY ACCOUNTS PERMANENTLY";
const MANIFEST_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const EXPECTED_TARGET_COUNT = 6;
const PUBLIC_DNS_SERVERS = ["1.1.1.1", "8.8.8.8"];

const isSrvDnsError = (error) => {
  const details = [
    error?.code,
    error?.message,
    error?.cause?.code,
    error?.cause?.message,
  ].filter(Boolean).join(" ");
  return /ECONNREFUSED|ENOTFOUND|EAI_AGAIN|querySrv|DNS|SRV/i.test(details);
};

const safeConnectionError = (error) => String(error?.message || error || "unknown connection error")
  .replace(/mongodb(?:\+srv)?:\/\/[^\s]+/gi, "[redacted MongoDB URI]");

const inspectMongoTarget = (uri) => {
  const schemeMatch = String(uri || "").match(/^(mongodb(?:\+srv)?):\/\//i);
  if (!schemeMatch) throw new Error("MongoDB URI has an unsupported scheme");

  const remainder = uri.slice(schemeMatch[0].length);
  const authorityEnd = remainder.search(/[/?]/);
  const authority = (authorityEnd === -1 ? remainder : remainder.slice(0, authorityEnd));
  const hostList = authority.slice(authority.lastIndexOf("@") + 1).split(",").filter(Boolean);
  const hosts = hostList.map((entry) => {
    const bracketed = entry.match(/^\[([^\]]+)\](?::\d+)?$/);
    return (bracketed ? bracketed[1] : entry.replace(/:\d+$/, "")).toLowerCase();
  });
  const pathStart = remainder.indexOf("/");
  const rawDatabase = pathStart === -1 ? "" : remainder.slice(pathStart + 1).split("?")[0];
  const database = decodeURIComponent(rawDatabase || "").trim();
  return { scheme: schemeMatch[1].toLowerCase(), hosts, database };
};

const assertProductionTarget = (uri) => {
  const target = inspectMongoTarget(uri);
  if (!target.hosts.length || target.hosts.some((host) => ["localhost", "127.0.0.1", "::1"].includes(host))) {
    throw new Error("Safety refusal: local MongoDB hosts are not allowed");
  }
  if (!target.database) throw new Error("Safety refusal: MongoDB database name is not specified");
  if (target.database.toLowerCase() === "efruitmandi") {
    throw new Error("Safety refusal: database efruitmandi is not an allowed production target");
  }
  const allowedOverride = String(process.env.ALLOW_PRODUCTION_DATABASE_NAME || "").trim();
  if (target.database !== "orchardgrowers" && target.database !== allowedOverride) {
    throw new Error(`Safety refusal: database ${target.database} is not the expected production database`);
  }
  return target;
};

async function buildDirectUriFromSrv(srvUri) {
  const parsed = new URL(srvUri);
  const resolver = new dns.promises.Resolver();
  resolver.setServers(PUBLIC_DNS_SERVERS);

  const srvRecords = await resolver.resolveSrv(`_mongodb._tcp.${parsed.hostname}`);
  if (!srvRecords.length) throw new Error("Public DNS returned no MongoDB SRV hosts");
  const hosts = srvRecords
    .sort((left, right) => left.priority - right.priority || right.weight - left.weight)
    .map((record) => `${record.name.replace(/\.$/, "")}:${record.port}`);

  let txtOptions = [];
  try {
    const txtRecords = await resolver.resolveTxt(parsed.hostname);
    txtOptions = txtRecords.map((record) => record.join("")).filter(Boolean);
  } catch (error) {
    if (error?.code !== "ENODATA" && error?.code !== "ENOTFOUND") throw error;
  }
  if (txtOptions.length > 1) throw new Error("Public DNS returned multiple MongoDB TXT option records");

  const options = new URLSearchParams(txtOptions[0] || "");
  for (const [key, value] of parsed.searchParams) options.set(key, value);
  if (!options.has("tls") && !options.has("ssl")) options.set("tls", "true");

  const credentials = parsed.username
    ? `${parsed.username}${parsed.password ? `:${parsed.password}` : ""}@`
    : "";
  const directUri = `mongodb://${credentials}${hosts.join(",")}${parsed.pathname || "/"}?${options.toString()}`;
  assertProductionTarget(directUri);
  return directUri;
}

async function tryMongoConnection(uri, label) {
  const target = assertProductionTarget(uri);
  console.log(`[dummy-cleanup] MongoDB connection source: ${label}; database=${target.database}; non-local=true`);
  await mongoose.connect(uri);
}

async function connectToMongo() {
  const directUri = process.env.MONGO_URI_DIRECT;
  const primaryUri = process.env.MONGO_URI;
  if (!directUri && !primaryUri) throw new Error("MONGO_URI_DIRECT and MONGO_URI are not configured");

  if (directUri) {
    assertProductionTarget(directUri);
    try {
      await tryMongoConnection(directUri, "direct mongodb:// (MONGO_URI_DIRECT)");
      return;
    } catch (directError) {
      console.error(`[dummy-cleanup] MONGO_URI_DIRECT connection failed: ${safeConnectionError(directError)}`);
      if (!primaryUri) throw new Error("Production direct MongoDB connection failed and MONGO_URI is not configured");
      await mongoose.disconnect().catch(() => undefined);
    }
  }

  const usesSrv = primaryUri.startsWith("mongodb+srv://");

  try {
    await tryMongoConnection(primaryUri, usesSrv ? "mongodb+srv" : "direct mongodb:// (MONGO_URI)");
    return;
  } catch (primaryError) {
    if (!usesSrv || !isSrvDnsError(primaryError)) throw primaryError;

    console.error(`[dummy-cleanup] mongodb+srv connection failed: ${safeConnectionError(primaryError)}`);
    console.error("[dummy-cleanup] This is a local SRV/DNS resolution problem, not a deletion or manifest problem.");
    await mongoose.disconnect().catch(() => undefined);
    try {
      const resolvedDirectUri = await buildDirectUriFromSrv(primaryUri);
      await tryMongoConnection(resolvedDirectUri, "public-DNS SRV/TXT resolved direct mongodb://");
    } catch (fallbackError) {
      console.error(`[dummy-cleanup] public DNS fallback failed: ${safeConnectionError(fallbackError)}`);
      throw new Error("Production MongoDB SRV and public-DNS fallback connections both failed");
    }
  }
}

const normalizeEmail = (value = "") => String(value || "").trim().toLowerCase();
const normalizePhone = (value = "") => String(value || "").replace(/\D/g, "");
const normalizeName = (value = "") => String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
const uniqueStrings = (values = []) => [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
const ids = (documents = []) => documents.map((document) => document._id);

const getNames = (user = {}) => uniqueStrings([
  user.name,
  user.orchardName,
  user.businessName,
  user.buyerContactPerson,
  user.kyc?.fullName,
  user.kyc?.orchardName,
  user.kycByRole?.grower?.fullName,
  user.kycByRole?.grower?.orchardName,
  user.kycByRole?.buyer?.fullName,
]);

const getPhones = (user = {}) => uniqueStrings([
  user.phone,
  user.contact,
  user.kyc?.phone,
  user.kycByRole?.grower?.phone,
  user.kycByRole?.buyer?.phone,
  user.kycByRole?.driver?.phone,
]).map(normalizePhone).filter(Boolean);

const snapshotFor = (user) => ({
  _id: String(user._id),
  name: String(user.name || ""),
  email: normalizeEmail(user.email),
  phone: String(user.phone || user.contact || ""),
  role: String(user.role || user.activeRole || ""),
  orchardName: String(user.orchardName || ""),
  businessName: String(user.businessName || ""),
  normalizedNames: getNames(user).map(normalizeName).filter(Boolean).sort(),
  normalizedPhones: getPhones(user).sort(),
  createdAt: user.createdAt ? new Date(user.createdAt).toISOString() : "",
});

const fingerprint = (snapshot) => crypto.createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
const hasPhone = (user, countryPhone) => {
  const localPhone = countryPhone.startsWith("91") ? countryPhone.slice(2) : countryPhone;
  return getPhones(user).some((phone) => phone === countryPhone || phone === localPhone);
};
const hasName = (user, predicate) => getNames(user).map(normalizeName).some(predicate);

async function resolveInitialTargets() {
  const candidates = await User.find({
    $or: [
      { email: /^\s*drx\.kutloo@gmail\.com\s*$/i },
      { email: /^\s*orchardgrowers\.in@gmail\.com\s*$/i },
      { name: /orchard\s*growers\s*private\s*limited|og\s*fruit\s*farms|green\s*v?alley|greenalley/i },
      { orchardName: /orchard\s*growers\s*private\s*limited|og\s*fruit\s*farms|green\s*v?alley|greenalley/i },
      { businessName: /orchard\s*growers\s*private\s*limited|og\s*fruit\s*farms|green\s*v?alley|greenalley/i },
    ],
  }).lean();

  const groups = {
    pavan: candidates.filter((user) => normalizeEmail(user.email) === "drx.kutloo@gmail.com"),
    pawann: candidates.filter((user) => normalizeEmail(user.email) === "orchardgrowers.in@gmail.com"),
    orchardGrowers: candidates.filter((user) => hasPhone(user, "919418153910") && hasName(user, (name) => name === "orchardgrowersprivatelimited")),
    ogFruitFarms: candidates.filter((user) => hasPhone(user, "919418153910") && hasName(user, (name) => name.includes("ogfruitfarms"))),
    greenValleyDuplicates: candidates.filter((user) => hasPhone(user, "918580660462") && hasName(user, (name) => name.includes("greenvalley") || name.includes("greenalley"))),
  };

  const expectedSizes = { pavan: 1, pawann: 1, orchardGrowers: 1, ogFruitFarms: 1, greenValleyDuplicates: 2 };
  Object.entries(expectedSizes).forEach(([group, expected]) => {
    if (groups[group].length !== expected) throw new Error(`Refusing manifest generation: ${group} resolved ${groups[group].length}, expected ${expected}`);
  });
  const targets = [...groups.pavan, ...groups.pawann, ...groups.orchardGrowers, ...groups.ogFruitFarms, ...groups.greenValleyDuplicates];
  if (new Set(targets.map((user) => String(user._id))).size !== EXPECTED_TARGET_COUNT) {
    throw new Error("Refusing manifest generation: targets are not six unique users");
  }
  return targets;
}

async function assertTargetsAreDeletable(targets) {
  const targetEmails = targets.map((user) => normalizeEmail(user.email)).filter(Boolean);
  const protectedEmails = uniqueStrings([
    process.env.MASTER_ADMIN_EMAIL,
    process.env.ADMIN_EMAIL,
    ...String(process.env.SYSTEM_ACCOUNT_EMAILS || "").split(","),
  ]).map(normalizeEmail);
  const matchingAdmins = targetEmails.length ? await Admin.find({ email: { $in: targetEmails } }).select("email").lean() : [];
  const protectedTarget = targets.find((user) =>
    ["admin", "super_admin"].includes(String(user.role || "").toLowerCase()) ||
    protectedEmails.includes(normalizeEmail(user.email))
  );
  if (matchingAdmins.length || protectedTarget) throw new Error("Refusing operation: a target is an admin, super admin, or required system account");
}

async function getImpact(userId) {
  const productIds = ids(await Product.find({ createdBy: userId }).select("_id").lean());
  const auctionIds = ids(await Auction.find({ product: { $in: productIds } }).select("_id").lean());
  const quoteQuery = { $or: [{ buyer: userId }, { grower: userId }, { lot: { $in: productIds } }] };
  const quoteIds = ids(await Quotation.find(quoteQuery).select("_id").lean());
  const orderQuery = { $or: [{ buyer: userId }, { grower: userId }, { driver: userId }, { assignedLogisticsAccount: userId }, { product: { $in: productIds } }, { auction: { $in: auctionIds } }, { quote: { $in: quoteIds } }] };
  const orderIds = ids(await Order.find(orderQuery).select("_id").lean());
  const paymentCount = await ErpPaymentTransaction.countDocuments({ $or: [{ buyer: userId }, { grower: userId }, { sourceOrder: { $in: orderIds } }, { sourceQuote: { $in: quoteIds } }, { lot: { $in: productIds } }] });
  const erpCounts = await Promise.all([
    ErpRefund.countDocuments({ buyer: userId }),
    ErpSettlement.countDocuments({ $or: [{ beneficiaryUser: userId }, { sourceOrder: { $in: orderIds } }, { sourceQuote: { $in: quoteIds } }, { lot: { $in: productIds } }] }),
    ErpCommissionLedger.countDocuments({ $or: [{ buyer: userId }, { grower: userId }, { sourceOrder: { $in: orderIds } }, { sourceQuote: { $in: quoteIds } }, { lot: { $in: productIds } }] }),
    ErpLedgerEntry.countDocuments({ $or: [{ party: userId }, { sourceOrder: { $in: orderIds } }, { sourceQuote: { $in: quoteIds } }] }),
    ErpDocumentRecord.countDocuments({ issuedToUser: userId }),
    ErpNotificationLog.countDocuments({ recipientUser: userId }),
    ErpSupportTicket.countDocuments({ openedBy: userId }),
    ErpAuditEvent.countDocuments({ actorUser: userId }),
  ]);
  return {
    products: productIds.length,
    auctions: auctionIds.length,
    quotations: quoteIds.length,
    orders: orderIds.length,
    paymentAndErpRecords: paymentCount + erpCounts.reduce((sum, count) => sum + count, 0),
  };
}

async function printDryRun(targets, manifest) {
  console.log(`[dummy-cleanup] mode=dry-run manifest=${MANIFEST_PATH}`);
  console.log(`[dummy-cleanup] created=${manifest.createdAt} expires=${manifest.expiresAt} executed=${manifest.executedAt || "no"}`);
  const results = [];
  for (const user of targets) {
    const snapshot = snapshotFor(user);
    const impact = await getImpact(user._id);
    const result = { ...snapshot, ...impact };
    results.push(result);
    console.log(JSON.stringify(result, null, 2));
  }
  const missing = manifest.targets.filter((target) => !targets.some((user) => String(user._id) === target._id));
  if (missing.length) console.log(`[dummy-cleanup] targets no longer present: ${missing.map((target) => target._id).join(", ")}`);
  return { results, missing: missing.map((target) => target._id) };
}

async function createManifest() {
  const targets = await resolveInitialTargets();
  await assertTargetsAreDeletable(targets);
  const createdAt = new Date();
  const manifest = {
    version: 1,
    purpose: "permanent deletion of six reviewed dummy accounts",
    createdAt: createdAt.toISOString(),
    expiresAt: new Date(createdAt.getTime() + MANIFEST_TTL_MS).toISOString(),
    executedAt: null,
    targets: targets.map((user) => {
      const snapshot = snapshotFor(user);
      return { ...snapshot, fingerprint: fingerprint(snapshot) };
    }),
  };
  await fs.mkdir(path.dirname(MANIFEST_PATH), { recursive: true });
  await fs.writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  return { manifest, targets };
}

async function loadManifest() {
  try {
    return JSON.parse(await fs.readFile(MANIFEST_PATH, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function loadManifestTargets(manifest, requireAll = false) {
  if (!manifest || manifest.version !== 1 || manifest.targets?.length !== EXPECTED_TARGET_COUNT) throw new Error("Invalid cleanup manifest");
  const targetIds = manifest.targets.map((target) => target._id);
  if (new Set(targetIds).size !== EXPECTED_TARGET_COUNT || targetIds.some((id) => !mongoose.isValidObjectId(id))) throw new Error("Manifest does not contain six unique valid User ids");
  const targets = await User.find({ _id: { $in: targetIds } }).lean();
  if (requireAll && targets.length !== EXPECTED_TARGET_COUNT) throw new Error(`Execution refused: only ${targets.length} of six manifest users still exist`);
  targets.forEach((user) => {
    const target = manifest.targets.find((entry) => entry._id === String(user._id));
    const snapshot = snapshotFor(user);
    if (!target || fingerprint(snapshot) !== target.fingerprint) throw new Error(`Execution refused: identity snapshot changed for ${user._id}`);
  });
  return targets;
}

const collectUrls = (value, urls = []) => {
  if (typeof value === "string" && /^https?:\/\//i.test(value)) urls.push(value);
  else if (Array.isArray(value)) value.forEach((item) => collectUrls(item, urls));
  else if (value && typeof value === "object") Object.values(value).forEach((item) => collectUrls(item, urls));
  return urls;
};

async function collectDeletionGraph(targets) {
  const userIds = ids(targets);
  const products = await Product.find({ createdBy: { $in: userIds } }).lean();
  const productIds = ids(products);
  const auctions = await Auction.find({ product: { $in: productIds } }).lean();
  const auctionIds = ids(auctions);
  const quotations = await Quotation.find({ $or: [{ buyer: { $in: userIds } }, { grower: { $in: userIds } }, { lot: { $in: productIds } }] }).lean();
  const quoteIds = ids(quotations);
  const orders = await Order.find({ $or: [{ buyer: { $in: userIds } }, { grower: { $in: userIds } }, { driver: { $in: userIds } }, { assignedLogisticsAccount: { $in: userIds } }, { product: { $in: productIds } }, { auction: { $in: auctionIds } }, { quote: { $in: quoteIds } }] }).lean();
  const orderIds = ids(orders);
  const verifications = await VerificationRequest.find({ user: { $in: userIds } }).lean();
  const verificationIds = ids(verifications);
  const captures = await CaptureSession.find({ $or: [{ userId: { $in: userIds } }, { attachedProduct: { $in: productIds } }] }).lean();
  const captureIds = ids(captures);
  const payments = await ErpPaymentTransaction.find({ $or: [{ buyer: { $in: userIds } }, { grower: { $in: userIds } }, { sourceOrder: { $in: orderIds } }, { sourceQuote: { $in: quoteIds } }, { lot: { $in: productIds } }] }).lean();
  const paymentIds = ids(payments);
  const refunds = await ErpRefund.find({ $or: [{ buyer: { $in: userIds } }, { sourcePayment: { $in: paymentIds } }] }).lean();
  const refundIds = ids(refunds);
  const settlements = await ErpSettlement.find({ $or: [{ beneficiaryUser: { $in: userIds } }, { sourceOrder: { $in: orderIds } }, { sourceQuote: { $in: quoteIds } }, { lot: { $in: productIds } }] }).lean();
  const settlementIds = ids(settlements);
  const commissions = await ErpCommissionLedger.find({ $or: [{ buyer: { $in: userIds } }, { grower: { $in: userIds } }, { sourceOrder: { $in: orderIds } }, { sourceQuote: { $in: quoteIds } }, { lot: { $in: productIds } }] }).lean();
  const ledgerEntries = await ErpLedgerEntry.find({ $or: [{ party: { $in: userIds } }, { sourceOrder: { $in: orderIds } }, { sourceQuote: { $in: quoteIds } }] }).lean();
  const documents = await ErpDocumentRecord.find({ $or: [{ issuedToUser: { $in: userIds } }, { sourceOrder: { $in: orderIds } }, { sourceQuote: { $in: quoteIds } }, { sourceVerification: { $in: verificationIds } }, { sourceSettlement: { $in: settlementIds } }] }).lean();
  const notifications = await ErpNotificationLog.find({ $or: [{ recipientUser: { $in: userIds } }, { sourceOrder: { $in: orderIds } }, { sourceQuote: { $in: quoteIds } }] }).lean();
  const tickets = await ErpSupportTicket.find({ $or: [{ openedBy: { $in: userIds } }, { relatedOrder: { $in: orderIds } }, { relatedQuote: { $in: quoteIds } }, { relatedLot: { $in: productIds } }, { relatedVerification: { $in: verificationIds } }] }).lean();
  const relatedEntityIds = [...userIds, ...productIds, ...auctionIds, ...quoteIds, ...orderIds, ...verificationIds];
  const audits = await ErpAuditEvent.find({ $or: [{ actorUser: { $in: userIds } }, { entityId: { $in: relatedEntityIds } }] }).lean();
  const deliveries = await Delivery.find({ $or: [{ driver: { $in: userIds } }, { order: { $in: orderIds } }] }).lean();
  const shipments = await LogisticsShipment.find({ orderId: { $in: orderIds.map(String) } }).lean();
  const publications = await ProfilePublication.find({ user: { $in: userIds } }).lean();
  const cloudinaryUrls = collectUrls([targets, products, captures]);
  return { userIds, products, productIds, auctions, auctionIds, quotations, quoteIds, orders, orderIds, verifications, verificationIds, captures, captureIds, payments, paymentIds, refunds, refundIds, settlements, settlementIds, commissions, ledgerEntries, documents, notifications, tickets, audits, deliveries, shipments, publications, cloudinaryUrls };
}

async function executeDeletion(manifest, targets) {
  if (manifest.executedAt) throw new Error(`Manifest was already executed at ${manifest.executedAt}`);
  if (Date.now() > new Date(manifest.expiresAt).getTime()) throw new Error("Manifest expired; execution is permanently disabled for this manifest");
  await assertTargetsAreDeletable(targets);
  const graph = await collectDeletionGraph(targets);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await Delivery.deleteMany({ _id: { $in: ids(graph.deliveries) } }).session(session);
      await LogisticsShipment.deleteMany({ _id: { $in: ids(graph.shipments) } }).session(session);
      await ErpRefund.deleteMany({ _id: { $in: graph.refundIds } }).session(session);
      await ErpPaymentTransaction.deleteMany({ _id: { $in: graph.paymentIds } }).session(session);
      await ErpCommissionLedger.deleteMany({ _id: { $in: ids(graph.commissions) } }).session(session);
      await ErpSettlement.deleteMany({ _id: { $in: graph.settlementIds } }).session(session);
      await ErpDocumentRecord.deleteMany({ _id: { $in: ids(graph.documents) } }).session(session);
      await ErpLedgerEntry.deleteMany({ _id: { $in: ids(graph.ledgerEntries) } }).session(session);
      await ErpNotificationLog.deleteMany({ _id: { $in: ids(graph.notifications) } }).session(session);
      await ErpSupportTicket.deleteMany({ _id: { $in: ids(graph.tickets) } }).session(session);
      await ErpAuditEvent.deleteMany({ _id: { $in: ids(graph.audits) } }).session(session);
      await ProfilePublication.deleteMany({ _id: { $in: ids(graph.publications) } }).session(session);
      await VerificationRequest.deleteMany({ _id: { $in: graph.verificationIds } }).session(session);
      await CaptureSession.deleteMany({ _id: { $in: graph.captureIds } }).session(session);
      await Order.deleteMany({ _id: { $in: graph.orderIds } }).session(session);
      await Quotation.deleteMany({ _id: { $in: graph.quoteIds } }).session(session);
      await Auction.deleteMany({ _id: { $in: graph.auctionIds } }).session(session);
      await Product.deleteMany({ _id: { $in: graph.productIds } }).session(session);
      await Product.updateMany({ acceptedBuyerId: { $in: graph.userIds } }, { $unset: { acceptedBuyerId: "", acceptedQuoteId: "" } }).session(session);
      await Product.updateMany({ deletedBy: { $in: graph.userIds } }, { $unset: { deletedBy: "" } }).session(session);
      await Auction.updateMany({ highestBidder: { $in: graph.userIds }, _id: { $nin: graph.auctionIds } }, { $unset: { highestBidder: "" } }).session(session);
      await Auction.updateMany({ cancelledBy: { $in: graph.userIds }, _id: { $nin: graph.auctionIds } }, { $unset: { cancelledBy: "" } }).session(session);
      await User.updateMany({ _id: { $nin: graph.userIds } }, { $pull: { growerRatings: { rater: { $in: graph.userIds } } } }).session(session);
      const result = await User.deleteMany({ _id: { $in: graph.userIds } }).session(session);
      if (result.deletedCount !== EXPECTED_TARGET_COUNT) throw new Error(`Transaction removed ${result.deletedCount} users instead of six`);
    });
  } finally {
    await session.endSession();
  }

  const cloudinary = await deleteCloudinaryAssetsByUrls(graph.cloudinaryUrls);
  manifest.executedAt = new Date().toISOString();
  manifest.execution = { database: "committed", cloudinary };
  await fs.writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`[dummy-cleanup] database transaction committed; six users permanently deleted`);
  console.log(`[dummy-cleanup] Cloudinary deleted=${cloudinary.deleted} failed=${cloudinary.failed}`);
  return {
    userIds: graph.userIds.map(String),
    deleted: {
      users: EXPECTED_TARGET_COUNT,
      products: graph.productIds.length,
      auctions: graph.auctionIds.length,
      quotations: graph.quoteIds.length,
      orders: graph.orderIds.length,
      deliveries: graph.deliveries.length,
      logisticsShipments: graph.shipments.length,
      payments: graph.paymentIds.length,
      refunds: graph.refundIds.length,
      settlements: graph.settlementIds.length,
      commissions: graph.commissions.length,
      ledgerEntries: graph.ledgerEntries.length,
      erpDocuments: graph.documents.length,
      notifications: graph.notifications.length,
      supportTickets: graph.tickets.length,
      auditEvents: graph.audits.length,
      profilePublications: graph.publications.length,
      verificationRequests: graph.verificationIds.length,
      captureSessions: graph.captureIds.length,
    },
    cloudinary,
    executedAt: manifest.executedAt,
  };
}

export async function runSpecifiedDummyAccountCleanup({ execute = false, confirmation = "", manageConnection = false } = {}) {
  try {
    if (manageConnection) await connectToMongo();
    if (!manageConnection && mongoose.connection.readyState !== 1) throw new Error("Production MongoDB connection is not ready");
    if (!manageConnection) {
      const database = String(mongoose.connection.name || "").trim();
      const host = String(mongoose.connection.host || "").trim().toLowerCase();
      const allowedOverride = String(process.env.ALLOW_PRODUCTION_DATABASE_NAME || "").trim();
      if (["localhost", "127.0.0.1", "::1"].includes(host)) throw new Error("Safety refusal: local MongoDB hosts are not allowed");
      if (database.toLowerCase() === "efruitmandi") throw new Error("Safety refusal: database efruitmandi is not an allowed production target");
      if (database !== "orchardgrowers" && database !== allowedOverride) throw new Error(`Safety refusal: database ${database || "(unspecified)"} is not the expected production database`);
    }

    let manifest = await loadManifest();
    if (!manifest) {
      if (execute) throw new Error("Execution refused: generate and review the dry-run manifest first");
      const generated = await createManifest();
      manifest = generated.manifest;
      const dryRun = await printDryRun(generated.targets, manifest);
      console.log("[dummy-cleanup] manifest generated; review it before execution");
      return { mode: "dry-run", manifestPath: MANIFEST_PATH, manifest, ...dryRun };
    }

    const targets = await loadManifestTargets(manifest, execute && !manifest.executedAt);
    if (!execute) {
      const dryRun = await printDryRun(targets, manifest);
      return { mode: "dry-run", manifestPath: MANIFEST_PATH, manifest, ...dryRun };
    }
    if (confirmation !== CONFIRMATION) throw new Error(`Execution refused: use --confirm="${CONFIRMATION}"`);
    return { mode: "execute", manifestPath: MANIFEST_PATH, ...(await executeDeletion(manifest, targets)) };
  } finally {
    if (manageConnection) await mongoose.disconnect().catch(() => undefined);
  }
}

async function main() {
  const execute = process.argv.includes("--execute");
  const confirmArg = process.argv.find((arg) => arg.startsWith("--confirm="));
  const confirmation = confirmArg ? confirmArg.slice("--confirm=".length) : "";
  await runSpecifiedDummyAccountCleanup({ execute, confirmation, manageConnection: true });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await main();
    process.exitCode = 0;
  } catch (error) {
    console.error("[dummy-cleanup] fatal:", error?.message || error);
    process.exitCode = 1;
  }
}
