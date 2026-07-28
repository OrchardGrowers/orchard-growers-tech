import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode, type RefObject } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import InstallAppPrompt, { openAdminInstallPrompt } from './components/InstallAppPrompt';
import BusinessMail, { canUseBusinessMail } from './components/BusinessMail';
import CareerApplications from './components/CareerApplications';
import OrchardAiLeadDatabase from './components/OrchardAiLeadDatabase';
import OrchardAiPlaceholder from './components/OrchardAiPlaceholder';

const rawApiBase =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  'https://api.orchardgrowers.in';

const normalizeApiBase = (value: string) => {
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  return /\/api$/i.test(trimmed) ? trimmed : `${trimmed}/api`;
};

const API_BASE = normalizeApiBase(
  rawApiBase
);
if (!import.meta.env.VITE_API_BASE_URL) {
  console.warn('Missing VITE_API_BASE_URL for admin panel.');
}
const FILE_BASE = API_BASE.replace(/\/api\/?$/, '');
const LOGO_URL = new URL('../logo.png', import.meta.url).href;
const ORCHARD_LOGO_URL = new URL('../../orchardgrowers-frontend/public/logo.png', import.meta.url).href;
const ADMIN_AUTH_SOURCE = {
  platform: 'orchardgrowers',
  sourceApp: 'admin-panel',
} as const;
const ADMIN_OTP_RESEND_SECONDS = 60;
const ORCHARD_PARTIES_STORAGE_KEY = 'orchard_parties';
const ORCHARD_PARTIES_CHANGED_EVENT = 'orchard-parties-changed';

const withAdminAuthSource = <T extends Record<string, unknown>>(payload: T) => ({
  ...payload,
  ...ADMIN_AUTH_SOURCE,
});

const adminMemoryStorage = new Map<string, string>();

const getAdminStorageItem = (key: string) => {
  try {
    const stored = window.localStorage.getItem(key);
    return stored ?? adminMemoryStorage.get(key) ?? '';
  } catch {
    return adminMemoryStorage.get(key) ?? '';
  }
};

const setAdminStorageItem = (key: string, value: string) => {
  adminMemoryStorage.set(key, value);
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Some mobile/private browsers block localStorage. Keep the session in memory.
  }
};

const removeAdminStorageItem = (key: string) => {
  adminMemoryStorage.delete(key);
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage errors so logout/session expiry cannot get stuck.
  }
};

const readAdminJson = <T,>(key: string): T | null => {
  const value = getAdminStorageItem(key);
  if (!value) return null;

  try {
    return JSON.parse(value) as T;
  } catch {
    removeAdminStorageItem(key);
    return null;
  }
};
const readAdminThemeMode = (): AdminThemeMode => {
  const stored = getAdminStorageItem(ADMIN_THEME_KEY);
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
};

const readResponseJson = async (res: Response) => {
  const text = await res.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { msg: text };
  }
};

const getNetworkErrorMessage = (err: unknown) => {
  console.error('Admin API network error:', err);

  if (err instanceof DOMException && err.name === 'AbortError') {
    return 'Server response timed out. Please try again in a few moments.';
  }

  if (err instanceof TypeError) {
    return 'Unable to reach the server. The backend may be starting up or there may be a temporary network issue. Please try again in 20–30 seconds.';
  }

  return err instanceof Error
    ? err.message
    : 'Unable to connect to the admin service. Please try again later.';
};
const formatDate = (value?: string) => {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

type AdminRole =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'UNIT_MANAGER'
  | 'INVENTORY_MANAGER'
  | 'SALES_EXECUTIVE'
  | 'PURCHASE_MANAGER'
  | 'FINANCE_MANAGER'
  | 'VERIFICATION_OFFICER'
  | 'SUPPORT_EXECUTIVE'
  | 'VIEWER'
  | 'EMPLOYEE';

type Admin = {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  roleLabel?: string;
  adminClass?: AdminClass;
};

type Review = {
  adminClass?: string;
  action: string;
  note?: string;
  reviewedAt?: string;
  admin?: {
    name?: string;
    email?: string;
    role?: string;
  };
};

type KycUser = {
  _id: string;
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
  profileTypes?: string[];
  businessName?: string;
  orchardName?: string;
  logisticsName?: string;
  buyerVerified?: boolean;
  growerVerified?: boolean;
  driverVerified?: boolean;
  isVerified?: boolean;
  kyc?: {
    roleType?: string;
    fullName?: string;
    phone?: string;
    email?: string;
    address?: string;
    district?: string;
    state?: string;
    pinCode?: string;
    idProofType?: string;
    idProofNumber?: string;
    idProofImage?: string;
    panNumber?: string;
    panImage?: string;
    gstNumber?: string;
    gstCertificate?: string;
    bankAccountHolderName?: string;
    bankName?: string;
    accountNumber?: string;
    upiId?: string;
    orchardName?: string;
    orchardLocation?: string;
    vehicleNumber?: string;
    drivingLicenseNumber?: string;
    drivingLicenseImage?: string;
    adminRemarks?: string;
    udyanCardNo?: string;
    udyanCardFileUrl?: string;
    bankAccountNo?: string;
    ifscCode?: string;
    passbookFileUrl?: string;
    aadhaarCardNo?: string;
    aadhaarCardFileUrl?: string;
    documents?: UploadedFile[];
    status?: string;
    submittedAt?: string;
    adminReviews?: Review[];
  };
};

type VerificationRequest = {
  _id: string;
  orchardName: string;
  ownerName: string;
  location: string;
  phone: string;
  roleType?: string;
  verificationType?: string;
  status: string;
  createdAt: string;
  youtubeVideoId?: string;
  youtubeLink?: string;
  udyanCardFile?: FileMeta;
  orchardVideo?: FileMeta;
  documents?: UploadedFile[];
  adminRemarks?: string;
  adminReviews?: Review[];
  user?: {
    _id?: string;
    name?: string;
    email?: string;
    phone?: string;
    role?: string;
    isVerified?: boolean;
    accountStatus?: string;
  };
};

type AdminOrder = {
  _id: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  commissionInvoiceNumber?: string;
  commissionInvoiceDate?: string;
  commissionReceiptNumber?: string;
  commissionReceiptDate?: string;
  commissionTaxableAmount?: number;
  commissionGstPercent?: number;
  commissionGstAmount?: number;
  commissionTotalAmount?: number;
  paymentMethod?: string;
  paymentReference?: string;
  paymentGateway?: string;
  paymentGatewayStatus?: string;
  escrowStatus?: string;
  customer?: { name?: string; phone?: string; email?: string };
  shippingAddress?: { city?: string; state?: string; pinCode?: string };
  items?: { title?: string; quantity?: number; unitPrice?: number; lineTotal?: number }[];
  totalAmount?: number;
  finalPrice?: number;
  auctionPrice?: number;
  sellerReceivable?: number;
  growerPayout?: number;
  paymentStatus?: string;
  settlementStatus?: string;
  deliveryStatus?: string;
  courierPartner?: string;
  deliveryPartnerSelection?: string;
  courierBookingStatus?: string;
  trackingNumber?: string;
  logisticsAssignment?: {
    status?: string;
    driverName?: string;
    driverMobile?: string;
    vehicleNumber?: string;
    vehicleType?: string;
    transportFirmName?: string;
    ownerName?: string;
    pickupDate?: string;
    expectedDispatchDate?: string;
    remarks?: string;
    registrationStatus?: string;
    invitationLink?: string;
    acceptedAt?: string;
    kycStatus?: string;
    settlementEligible?: boolean;
    assignedLogisticsAccount?: { logisticsName?: string; name?: string; driverVerified?: boolean; accountStatus?: string };
  };
  settlementEligibility?: {
    buyerPaymentReceived?: boolean;
    growerOtpVerified?: boolean;
    consignmentDelivered?: boolean;
    logisticsAccepted?: boolean;
    growerKycVerified?: boolean;
    logisticsKycVerified?: boolean;
    platformKycVerified?: boolean;
    settlementReleaseAllowed?: boolean;
  };
  beneficiaryMapping?: { beneficiaryType?: string; beneficiaryId?: string; kycStatus?: string; bankOrUpiVerified?: boolean; settlementAmount?: number }[];
  createdAt?: string;
};

type FileMeta = {
  path?: string;
  originalName?: string;
  mimetype?: string;
};

type AdminPlatform = 'main' | 'orchard' | 'orchardAi' | 'efruitmandi' | 'userManagement' | 'notifications' | 'businessMail' | 'system' | 'download' | 'logout';
type AdminThemeMode = 'light' | 'dark' | 'system';
type AdminTab =
  | 'dashboard'
  | 'master'
  | 'inventory'
  | 'productAdmin'
  | 'purchase'
  | 'billing'
  | 'sales'
  | 'logistics'
  | 'unitsOutlets'
  | 'expenses'
  | 'financials'
  | 'reports'
  | 'orchardSettings'
  | 'orchardAiDashboard'
  | 'orchardAiLeadCollection'
  | 'orchardAiLeadDatabase'
  | 'orchardAiCampaignCenter'
  | 'orchardAiReplyCenter'
  | 'efruitDashboard'
  | 'users'
  | 'kyc'
  | 'ogVerified'
  | 'produceLots'
  | 'mandiCommodities'
  | 'quotes'
  | 'deals'
  | 'efruitInvoices'
  | 'transactions'
  | 'supportDisputes'
  | 'analytics'
  | 'efruitSettings'
  | 'staffUsers'
  | 'adminUsers'
  | 'customers'
  | 'sellers'
  | 'buyers'
  | 'rolesPermissions'
  | 'suspendedUsers'
  | 'notifications'
  | 'businessMail'
  | 'careerApplications'
  | 'systemSettings'
  | 'downloadApp';
type OrchardModulePages = Partial<Record<AdminTab, string>>;
type ReviewAction = 'APPROVE' | 'REJECT' | 'UNDER_REVIEW' | 'CORRECTION_REQUIRED' | 'HOLD' | 'SUSPEND' | 'TERMINATE';
type UploadedFile = { label: string; path?: string; url?: string; fileName?: string };
type AdminProduct = {
  _id: string;
  title?: string;
  slug?: string;
  sku?: string;
  hsnCode?: string;
  hsnDescription?: string;
  gstRate?: number;
  cgst?: number;
  sgst?: number;
  fruitName?: string;
  variety?: string;
  productCategory?: string;
  seasonalCategory?: string;
  productType?: string;
  inventoryType?: string;
  unit?: string;
  seoMetaTitle?: string;
  seoMetaDescription?: string;
  seoKeywords?: string[];
  featured?: boolean;
  active?: boolean;
  description?: string;
  quantity?: number;
  basePrice?: number;
  discountPercent?: number;
  location?: string;
  status?: string;
  packingType?: string;
  packShape?: string;
  packLengthCm?: number;
  packWidthCm?: number;
  packHeightCm?: number;
  packRadiusCm?: number;
  packThicknessCm?: number;
  actualWeightKg?: number;
  dimensionWeightKg?: number;
  chargeableWeightKg?: number;
  images?: string[];
  imagePublicIds?: string[];
  quality?: string;
  lotNo?: string;
  gradeLots?: { grade?: string; boxes?: number; weightKg?: number; images?: string[] }[];
  organicCertificationNo?: string;
  organicCertificateUrl?: string;
  organicCertificatePublicId?: string;
  createdSource?: string;
  createdBy?: { name?: string; orchardName?: string; businessName?: string } | string;
  createdAt?: string;
};
type OrchardPartyRecord = {
  id?: string;
  partyName: string;
  partyType: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  gstin?: string;
  status?: string;
  productMapping?: string;
};

const getStoredPartyString = (record: Record<string, unknown>, field: string) => {
  const value = record[field];
  return typeof value === 'string' ? value.trim() : '';
};

const toOrchardPartyRecord = (value: unknown): OrchardPartyRecord | null => {
  if (!value || typeof value !== 'object') return null;

  const record = value as Record<string, unknown>;
  const partyName = getStoredPartyString(record, 'partyName');
  if (!partyName) return null;

  return {
    id: getStoredPartyString(record, 'id') || undefined,
    partyName,
    partyType: getStoredPartyString(record, 'partyType') || 'Party',
    contactPerson: getStoredPartyString(record, 'contactPerson') || undefined,
    phone: getStoredPartyString(record, 'phone') || undefined,
    email: getStoredPartyString(record, 'email') || undefined,
    gstin: getStoredPartyString(record, 'gstin') || undefined,
    status: getStoredPartyString(record, 'status') || 'Active',
    productMapping: getStoredPartyString(record, 'productMapping') || undefined,
  };
};

type KycUpdatePayload = Record<string, string>;

const isSubmittedKycRequest = (user: KycUser) => {
  const kyc = user.kyc || {};
  const status = String(kyc.status || '').trim().toUpperCase();
  return Boolean(
    (status && status !== 'NOT_SUBMITTED') ||
      kyc.submittedAt ||
      (kyc.fullName && kyc.idProofNumber && (kyc.accountNumber || kyc.bankAccountNo))
  );
};

const readStoredOrchardParties = ({ activeOnly = false }: { activeOnly?: boolean } = {}) => {
  const stored = readAdminJson<unknown>(ORCHARD_PARTIES_STORAGE_KEY);
  if (!Array.isArray(stored)) return [];

  return stored
    .map(toOrchardPartyRecord)
    .filter((party): party is OrchardPartyRecord => Boolean(party))
    .filter((party) => !activeOnly || (party.status || 'Active').toLowerCase() === 'active');
};
type AdminQuote = {
  _id: string;
  lotId?: string;
  buyerId?: string;
  growerId?: string;
  lotTitle?: string;
  fruitType?: string;
  lotQuantity?: number;
  buyerName?: string;
  buyerPhone?: string;
  growerName?: string;
  quotedPrice?: number;
  quotedTotalValue?: number;
  baseDealAmount?: number;
  buyerPayable?: number;
  buyerPayableThroughPlatform?: number;
  sellerReceivable?: number;
  growerReceivable?: number;
  commissionAmount?: number;
  platformServiceFee?: number;
  platformRevenue?: number;
  commissionPercent?: number;
  labourAmount?: number;
  labourChargePerUnit?: number;
  logisticsAmount?: number;
  totalCharges?: number;
  totalUnits?: number;
  chargePerUnit?: number;
  logisticsChargePerUnit?: number;
  status?: string;
  acceptedAt?: string;
  rejectedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  lotStatus?: string;
  settlementStatus?: string;
};
type AdminErpDashboard = {
  generatedAt?: string;
  source?: string;
  kpis?: Record<string, number>;
  topFruits?: { fruit?: string; lots?: number; quantity?: number }[];
  topBuyers?: { id?: string; name?: string; deals?: number; amount?: number }[];
  topGrowers?: { id?: string; name?: string; deals?: number; amount?: number }[];
  topStates?: { state?: string; deals?: number; amount?: number }[];
  growthAnalytics?: { date?: string; deals?: number; gmv?: number; commission?: number }[];
  dataFoundation?: Record<string, number>;
};
type AdminErpPayment = {
  _id?: string;
  id?: string;
  sourceOrder?: string;
  sourceQuote?: string;
  provider?: string;
  gatewayOrderId?: string;
  gatewayPaymentId?: string;
  amount?: number;
  currency?: string;
  status?: string;
  escrowStatus?: string;
  paymentGatewayStatus?: string;
  createdAt?: string;
  persisted?: boolean;
};
type AdminErpSettlement = {
  _id?: string;
  id?: string;
  sourceOrder?: string;
  beneficiaryType?: string;
  beneficiaryName?: string;
  netAmount?: number;
  grossAmount?: number;
  status?: string;
  provider?: string;
  kycStatus?: string;
  bankOrUpiVerified?: boolean;
  createdAt?: string;
  persisted?: boolean;
};
type AdminErpCommission = {
  _id?: string;
  id?: string;
  sourceOrder?: string;
  sourceQuote?: string;
  commissionBase?: number;
  commissionPercent?: number;
  commissionAmount?: number;
  taxAmount?: number;
  totalAmount?: number;
  status?: string;
  invoiceNumber?: string;
  createdAt?: string;
  persisted?: boolean;
};
type AdminErpDocument = {
  _id?: string;
  id?: string;
  documentType?: string;
  sourceType?: string;
  documentNumber?: string;
  status?: string;
  totalAmount?: number;
  createdAt?: string;
  persisted?: boolean;
};
type AdminErpLedgerEntry = {
  _id?: string;
  id?: string;
  sourceType?: string;
  accountCode?: string;
  accountName?: string;
  accountType?: string;
  partyType?: string;
  debit?: number;
  credit?: number;
  postingDate?: string;
  memo?: string;
  persisted?: boolean;
};
type AdminErpAuditEvent = {
  _id?: string;
  id?: string;
  module?: string;
  action?: string;
  entityType?: string;
  riskLevel?: string;
  note?: string;
  createdAt?: string;
  persisted?: boolean;
};
type AdminErpNotification = {
  _id?: string;
  channel?: string;
  recipient?: string;
  templateKey?: string;
  status?: string;
  createdAt?: string;
};
type AdminErpTicket = {
  _id?: string;
  ticketNumber?: string;
  type?: string;
  subject?: string;
  status?: string;
  priority?: string;
  createdAt?: string;
};
type AdminErpRefund = {
  _id?: string;
  sourceOrder?: string;
  amount?: number;
  reason?: string;
  status?: string;
  provider?: string;
  createdAt?: string;
};
type AdminErpData = {
  dashboard: AdminErpDashboard | null;
  payments: AdminErpPayment[];
  settlements: AdminErpSettlement[];
  commissions: AdminErpCommission[];
  documents: AdminErpDocument[];
  ledgerEntries: AdminErpLedgerEntry[];
  auditEvents: AdminErpAuditEvent[];
  notifications: AdminErpNotification[];
  tickets: AdminErpTicket[];
  refunds: AdminErpRefund[];
};
type MandiCommodity = {
  _id: string;
  commodity: string;
  displayName?: string;
  aliases?: string[];
  category?: 'fruit' | 'non-fruit' | 'uncategorized';
  isFruit?: boolean;
  source?: string;
  seenCount?: number;
  firstSeenAt?: string;
  lastSeenAt?: string;
  mappedAt?: string;
  adminNotes?: string;
};
type AdminUser = {
  _id: string;
  originalUserId?: string;
  name?: string;
  email?: string;
  phone?: string;
  role?: string | null;
  roleType?: string;
  profileName?: string;
  businessName?: string;
  orchardName?: string;
  location?: string;
  accountStatus?: string;
  isVerified?: boolean;
  kyc?: { status?: string; roleType?: string };
  adminNotes?: string;
  createdAt?: string;
};
type AdminClass = 'CLASS_I' | 'CLASS_II' | 'CLASS_III';
type AdminStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED' | 'TERMINATED';
type AdminAccount = {
  _id?: string;
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
  adminClass?: AdminClass;
  role?: AdminRole;
  roleLabel?: string;
  status?: AdminStatus;
  createdAt?: string;
  approvedBy?: { name?: string; email?: string } | string;
  approvedAt?: string;
  createdBy?: { name?: string; email?: string } | string;
  auditLogs?: { action?: string; at?: string; note?: string }[];
};
type BusinessMailAccessAssignment = {
  enabled: boolean;
  allowedRestrictedSenderProfiles: string[];
  authoritative?: boolean;
  approvedBy?: string;
  approvedAt?: string | null;
};
type BusinessMailSenderSummary = { key: string; name: string; email: string; enabled?: boolean };
type BusinessMailAccessAdmin = {
  id: string;
  name?: string;
  email?: string;
  role?: string;
  status?: string;
  businessMailAccess: BusinessMailAccessAssignment;
  businessMailEligible: boolean;
  matchingPersonalSenderProfile: BusinessMailSenderSummary | null;
  personalSenderAvailable: boolean;
  personalSenderReason: string;
  effectiveSenderProfiles: BusinessMailSenderSummary[];
  effectiveSenderCount: number;
};
type BusinessMailAccessManagement = {
  commonSenderProfiles: BusinessMailSenderSummary[];
  masterSenderProfiles: BusinessMailSenderSummary[];
  assignmentPolicy: string;
  admins: BusinessMailAccessAdmin[];
};
type ProductDraft = {
  title: string;
  slug: string;
  sku: string;
  hsnCode: string;
  hsnDescription: string;
  gstRate: string;
  cgst: string;
  sgst: string;
  fruitName: string;
  variety: string;
  productCategory: string;
  seasonalCategory: string;
  productType: string;
  inventoryType: string;
  unit: string;
  seoMetaTitle: string;
  seoMetaDescription: string;
  seoKeywords: string;
  featured: boolean;
  active: boolean;
  description: string;
  quantity: string;
  basePrice: string;
  discountPercent: string;
  location: string;
  packingType: string;
  packShape: string;
  packLengthCm: string;
  packWidthCm: string;
  packHeightCm: string;
  packRadiusCm: string;
  packThicknessCm: string;
  actualWeightKg: string;
  dimensionWeightKg: string;
  chargeableWeightKg: string;
  status: string;
  uploadedImages: ProductImageUpload[];
};
type ProductImageUpload = {
  url: string;
  publicId: string;
};
type AdminAuthMode = 'login' | 'signup' | 'forgot' | 'reset';
type HsnSuggestion = {
  _id: string;
  hsnCode: string;
  description: string;
  gstRate: number;
  category: string;
  needsVerification?: boolean;
};

const normalizeAdminEmail = (value: string) => value.trim().toLowerCase();
const isValidAdminEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const getAdminPasswordValidationMessage = (value: string) => {
  if (value.length < 8 || !/[A-Za-z]/.test(value) || !/\d/.test(value)) {
    return 'Password must be at least 8 characters and include a letter and a number.';
  }

  return '';
};

const marketSnapshotCards = [
  { title: 'Apple A+ Mandi Rate', text: 'Royal Delicious | Min 500 Max 1200 | Average: 850 +5%' },
  { title: 'Pear A+ Mandi Rate', text: 'Royal Delicious | Min 500 Max 1200 | Average: 850 +5%' },
  { title: 'Orchard Growers Inventory', text: 'Plants, seeds, tools, manure, growth tonic, and own-brand stock watch' },
  { title: 'Buyer Orders', text: 'Paid orders generate invoices; COD creates challan with greeting' },
  { title: 'eFruitMandi Users', text: 'Update buyer, grower, driver, KYC, and verification records' },
];

const emptyProductDraft: ProductDraft = {
  title: '',
  slug: '',
  sku: '',
  hsnCode: '',
  hsnDescription: '',
  gstRate: '',
  cgst: '',
  sgst: '',
  fruitName: '',
  variety: '',
  productCategory: '',
  seasonalCategory: '',
  productType: 'Plant',
  inventoryType: 'finished_product',
  unit: 'Plant',
  seoMetaTitle: '',
  seoMetaDescription: '',
  seoKeywords: '',
  featured: false,
  active: true,
  description: '',
  quantity: '',
  basePrice: '',
  discountPercent: '',
  location: 'Orchard Growers',
  packingType: 'Orchard Growers pack',
  packShape: 'box',
  packLengthCm: '',
  packWidthCm: '',
  packHeightCm: '',
  packRadiusCm: '',
  packThicknessCm: '',
  actualWeightKg: '',
  dimensionWeightKg: '',
  chargeableWeightKg: '',
  status: 'AVAILABLE',
  uploadedImages: [],
};

const emptyAdminErpData: AdminErpData = {
  dashboard: null,
  payments: [],
  settlements: [],
  commissions: [],
  documents: [],
  ledgerEntries: [],
  auditEvents: [],
  notifications: [],
  tickets: [],
  refunds: [],
};

const orchardProductCategories = [
  'Live Plants',
  'Fruit Plants',
  'Seasonal Plants',
  'All Season Plants',
  'Ornamental Plants',
  'Plant Seeds',
  'Organic and Natural Products',
  'Organic Manure',
  'Fertilizers',
  'Cocopeat',
  'Gardening Tools',
  'Tools & Equipments',
  'Machineries',
  'Nursery Pots',
  'Planters & Pots',
  'Shade Net',
  'Irrigation Pipes / Items',
  'Growth Tonic',
  'Orchard Kit',
  'Premium Combo',
  'Other',
];

const orchardSeasonalCategories = ['Spring', 'Summer', 'Monsoon', 'Winter'];
const rawMaterialCategories = ['Growing Media', 'Organic Manure', 'Fertilizer', 'Packaging', 'Pots / Containers', 'Irrigation Material', 'Plant Protection', 'Tools Consumable', 'Other'];
const logisticsPlatformPages = ['eFruitMandi', 'Orchard Growers'];
const logisticsCourierPartners = [
  'eFruitMandi',
  'India Post',
  'Delhivery',
  'Blue Dart',
  'DTDC',
  'Shiprocket',
  'Xpressbees',
  'Ecom Express',
  'Ekart',
  'Shadowfax',
  'Amazon Shipping',
  'Porter',
  'DHL',
  'FedEx',
  'UPS',
  'Aramex',
  'AWS',
];

type AdminTabButton = { id: AdminTab; label: string; count?: number };
type SidebarSubItem = { label: string; tab?: AdminTab; action?: () => void; count?: number };
type SidebarMenuItem = { label: string; icon: MenuIconName; tab?: AdminTab; action?: () => void; count?: number; children?: SidebarSubItem[] };
type SidebarGroup = {
  platform: AdminPlatform;
  title: string;
  subtitle: string;
  action?: () => void;
  items: SidebarMenuItem[];
};
type ModulePlan = {
  title: string;
  text: string;
  pages?: string[];
  fields?: string[];
  rules?: string[];
};

const orchardModuleChildRoutes: Partial<Record<AdminTab, Record<string, AdminTab>>> = {
  master: {
    'Add Product': 'productAdmin',
    'Add Raw Material': 'productAdmin',
    'Units / Outlets': 'unitsOutlets',
    'Vendors / Parties': 'master',
    Categories: 'master',
  },
  inventory: {
    'Production Update': 'inventory',
    'Purchase Entry': 'purchase',
    'Current Stock': 'inventory',
    'Stock Transfer': 'inventory',
    'Damaged / Dead Stock': 'inventory',
    'Low Stock Alert': 'inventory',
  },
  billing: {
    'New Invoice': 'billing',
    'Sales History': 'sales',
    'Returns / Refunds': 'billing',
  },
  logistics: {
    ...Object.fromEntries(logisticsPlatformPages.map((platform) => [platform, 'logistics' as AdminTab])),
  },
  financials: {
    Expenses: 'expenses',
    'GST Summary': 'financials',
    'Sales Pattern': 'reports',
    Evaluations: 'financials',
    'Profit / Loss': 'financials',
    'Cash Flow': 'financials',
    'Payment Collection': 'financials',
    'Outstanding Dues': 'financials',
    'Stock Valuation': 'reports',
    'Unit-wise Performance': 'reports',
    'Low Stock Report': 'reports',
    Reports: 'reports',
  },
  orchardSettings: {
    'Invoice Series': 'orchardSettings',
    'Stock Sync': 'orchardSettings',
    'GST Defaults': 'orchardSettings',
    'Low Stock Thresholds': 'orchardSettings',
  },
  adminUsers: {
    'Admin Users': 'adminUsers',
    'Create Admin': 'adminUsers',
    'Approved Admins': 'adminUsers',
  },
};

const defaultOrchardModulePages: Partial<Record<AdminTab, string>> = {
  master: 'Add Product',
  inventory: 'Current Stock',
  billing: 'New Invoice',
  logistics: 'eFruitMandi',
  financials: 'Expenses',
  orchardSettings: 'Invoice Series',
  adminUsers: 'Admin Users',
};

const adminRoutePaths: Record<AdminTab, string> = {
  dashboard: '/dashboard',
  master: '/orchard/master',
  inventory: '/orchard/inventory',
  productAdmin: '/orchard/products',
  purchase: '/orchard/purchase',
  billing: '/orchard/billing',
  sales: '/orchard/sales-invoice',
  logistics: '/orchard/logistics',
  unitsOutlets: '/orchard/units-outlets',
  expenses: '/orchard/expenses',
  financials: '/orchard/financials',
  reports: '/orchard/reports',
  orchardSettings: '/orchard/settings',
  orchardAiDashboard: '/orchard-ai/dashboard',
  orchardAiLeadCollection: '/orchard-ai/lead-collection',
  orchardAiLeadDatabase: '/orchard-ai/lead-database',
  orchardAiCampaignCenter: '/orchard-ai/campaign-center',
  orchardAiReplyCenter: '/orchard-ai/reply-center',
  efruitDashboard: '/efruitmandi/dashboard',
  users: '/efruitmandi/users',
  kyc: '/efruitmandi/kyc-verification',
  ogVerified: '/efruitmandi/og-verified',
  produceLots: '/efruitmandi/produce-lots',
  mandiCommodities: '/efruitmandi/mandi-commodities',
  quotes: '/efruitmandi/quotes',
  deals: '/efruitmandi/deals',
  efruitInvoices: '/efruitmandi/invoices-chalan',
  transactions: '/efruitmandi/transactions',
  supportDisputes: '/efruitmandi/support-disputes',
  analytics: '/efruitmandi/analytics',
  efruitSettings: '/efruitmandi/settings',
  staffUsers: '/users/staff',
  adminUsers: '/users/admin-users',
  customers: '/users/customers',
  sellers: '/users/sellers-growers-farmers',
  buyers: '/users/buyers',
  rolesPermissions: '/users/roles-permissions',
  suspendedUsers: '/users/suspended',
  notifications: '/notifications',
  businessMail: '/business-mail',
  careerApplications: '/career-applications',
  systemSettings: '/system-settings',
  downloadApp: '/download-app',
};

const adminTabPlatforms: Record<AdminTab, AdminPlatform> = {
  dashboard: 'main',
  master: 'orchard',
  inventory: 'orchard',
  productAdmin: 'orchard',
  purchase: 'orchard',
  billing: 'orchard',
  sales: 'orchard',
  logistics: 'orchard',
  unitsOutlets: 'orchard',
  expenses: 'orchard',
  financials: 'orchard',
  reports: 'orchard',
  orchardSettings: 'orchard',
  orchardAiDashboard: 'orchardAi',
  orchardAiLeadCollection: 'orchardAi',
  orchardAiLeadDatabase: 'orchardAi',
  orchardAiCampaignCenter: 'orchardAi',
  orchardAiReplyCenter: 'orchardAi',
  efruitDashboard: 'efruitmandi',
  users: 'efruitmandi',
  kyc: 'efruitmandi',
  ogVerified: 'efruitmandi',
  produceLots: 'efruitmandi',
  mandiCommodities: 'efruitmandi',
  quotes: 'efruitmandi',
  deals: 'efruitmandi',
  efruitInvoices: 'efruitmandi',
  transactions: 'efruitmandi',
  supportDisputes: 'efruitmandi',
  analytics: 'efruitmandi',
  efruitSettings: 'efruitmandi',
  staffUsers: 'userManagement',
  adminUsers: 'userManagement',
  customers: 'userManagement',
  sellers: 'userManagement',
  buyers: 'userManagement',
  rolesPermissions: 'userManagement',
  suspendedUsers: 'userManagement',
  notifications: 'notifications',
  businessMail: 'businessMail',
  careerApplications: 'businessMail',
  systemSettings: 'system',
  downloadApp: 'download',
};

const platformTabs: Record<AdminPlatform, AdminTabButton[]> = {
  main: [{ id: 'dashboard', label: 'Dashboard' }],
  orchard: [
    { id: 'master', label: 'Master' },
    { id: 'inventory', label: 'Inventory' },
    { id: 'billing', label: 'Billing' },
    { id: 'logistics', label: 'Logistics' },
    { id: 'financials', label: 'Financials' },
    { id: 'orchardSettings', label: 'Settings' },
  ],
  orchardAi: [
    { id: 'orchardAiDashboard', label: 'Dashboard' },
    { id: 'orchardAiLeadCollection', label: 'Lead Collection' },
    { id: 'orchardAiLeadDatabase', label: 'Lead Database' },
    { id: 'orchardAiCampaignCenter', label: 'Campaign Center' },
    { id: 'orchardAiReplyCenter', label: 'Reply Center' },
  ],
  efruitmandi: [
    { id: 'efruitDashboard', label: 'Dashboard' },
    { id: 'users', label: 'Users' },
    { id: 'kyc', label: 'KYC Verification' },
    { id: 'ogVerified', label: 'OG Verified' },
    { id: 'produceLots', label: 'Produce Lots' },
    { id: 'mandiCommodities', label: 'Mandi Commodities' },
    { id: 'quotes', label: 'Offers' },
    { id: 'deals', label: 'Deals' },
    { id: 'efruitInvoices', label: 'Invoices / Chalan' },
    { id: 'transactions', label: 'Transactions' },
    { id: 'supportDisputes', label: 'Support & Disputes' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'efruitSettings', label: 'Settings' },
  ],
  userManagement: [
    { id: 'staffUsers', label: 'Staff Users' },
    { id: 'adminUsers', label: 'Admin Users' },
    { id: 'customers', label: 'Customers' },
    { id: 'sellers', label: 'Sellers / Growers / Farmers' },
    { id: 'buyers', label: 'Buyers' },
    { id: 'rolesPermissions', label: 'Roles & Permissions' },
    { id: 'suspendedUsers', label: 'Suspended Users' },
  ],
  notifications: [{ id: 'notifications', label: 'Notifications' }],
  businessMail: [
    { id: 'businessMail', label: 'Business Mail' },
    { id: 'careerApplications', label: 'Career Applications' },
  ],
  system: [{ id: 'systemSettings', label: 'System Settings' }],
  download: [{ id: 'downloadApp', label: 'Download App' }],
  logout: [{ id: 'dashboard', label: 'Dashboard' }],
};

const allAdminTabs = Object.keys(adminRoutePaths) as AdminTab[];
const adminRoleLabels: Record<AdminRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  UNIT_MANAGER: 'Unit Manager',
  INVENTORY_MANAGER: 'Inventory Manager',
  SALES_EXECUTIVE: 'Sales Executive',
  PURCHASE_MANAGER: 'Purchase Manager',
  FINANCE_MANAGER: 'Finance Manager',
  VERIFICATION_OFFICER: 'Verification Officer',
  SUPPORT_EXECUTIVE: 'Support Executive',
  VIEWER: 'Viewer',
  EMPLOYEE: 'Admin',
};
const ADMIN_THEME_KEY = 'adminThemeMode';
const PROFILE_DELETE_ADMIN_EMAIL = 'adminho@orchardgrowers.in';
const adminThemeModes: { mode: AdminThemeMode; label: string }[] = [
  { mode: 'light', label: 'Light' },
  { mode: 'dark', label: 'Dark' },
  { mode: 'system', label: 'System' },
];
const classIAdminEmails = new Set([
  'pawann@orchardgrowers.in',
  'founder@orchardgrowers.in',
  'adminho@orchardgrowers.in',
  'komal@orchardgrowers.in',
]);
const classIIAdminEmails = new Set([
  'testadminclassii@orchardgrowers.in',
  'hr.ho@orchardgrowers.in',
  'invest@orchardgrowers.in',
  'careers@orchardgrowers.in',
  'grievance@orchardgrowers.in',
]);
const classIIIAdminEmails = new Set([
  'testadminclassiii@orchardgrowers.in',
  'sales.ffccbb@orchardgrowers.in',
]);
const adminRolePermissions: Record<AdminRole, AdminTab[]> = {
  SUPER_ADMIN: allAdminTabs,
  ADMIN: allAdminTabs.filter((tab) => tab !== 'systemSettings'),
  EMPLOYEE: allAdminTabs.filter((tab) => tab !== 'systemSettings' && tab !== 'businessMail' && tab !== 'careerApplications'),
  UNIT_MANAGER: ['dashboard', 'master', 'inventory', 'productAdmin', 'billing', 'sales', 'logistics', 'unitsOutlets', 'expenses', 'reports', 'orchardSettings', 'notifications', 'downloadApp'],
  INVENTORY_MANAGER: ['dashboard', 'master', 'inventory', 'productAdmin', 'purchase', 'reports', 'notifications', 'downloadApp'],
  SALES_EXECUTIVE: ['dashboard', 'billing', 'sales', 'logistics', 'customers', 'reports', 'notifications', 'businessMail', 'downloadApp'],
  PURCHASE_MANAGER: ['dashboard', 'master', 'inventory', 'purchase', 'reports', 'notifications', 'downloadApp'],
  FINANCE_MANAGER: ['dashboard', 'billing', 'expenses', 'financials', 'transactions', 'efruitInvoices', 'reports', 'analytics', 'notifications', 'downloadApp'],
  VERIFICATION_OFFICER: ['dashboard', 'efruitDashboard', 'users', 'kyc', 'ogVerified', 'produceLots', 'efruitInvoices', 'sellers', 'buyers', 'suspendedUsers', 'notifications', 'downloadApp'],
  SUPPORT_EXECUTIVE: ['dashboard', 'users', 'customers', 'sellers', 'buyers', 'supportDisputes', 'efruitInvoices', 'suspendedUsers', 'notifications', 'businessMail', 'downloadApp'],
  VIEWER: ['dashboard', 'reports', 'efruitDashboard', 'efruitInvoices', 'analytics', 'notifications', 'downloadApp'],
};
const adminRolePermissionSets = Object.fromEntries(
  Object.entries(adminRolePermissions).map(([role, tabs]) => [role, new Set(tabs)])
) as Record<AdminRole, Set<AdminTab>>;
const normalizeAdminRole = (role?: string): AdminRole =>
  role && Object.prototype.hasOwnProperty.call(adminRoleLabels, role) ? (role as AdminRole) : 'VIEWER';
const canAccessAdminTab = (role: AdminRole, tab: AdminTab) =>
  tab === 'businessMail'
    ? canUseBusinessMail(role)
    : adminRolePermissionSets[role]?.has(tab) || false;
const getAccessibleTabsForRole = (role: AdminRole) =>
  allAdminTabs.filter((tab) => canAccessAdminTab(role, tab));
const getDefaultAdminTab = (role: AdminRole) =>
  (canAccessAdminTab(role, 'dashboard') ? 'dashboard' : getAccessibleTabsForRole(role)[0]) || 'dashboard';
const getAdminDisplayRole = (admin: Admin) => {
  const adminEmail = normalizeAdminEmail(admin.email || '');
  if (classIAdminEmails.has(adminEmail)) return 'Class I || Admins';
  if (classIIAdminEmails.has(adminEmail)) return 'Class II || Admins';
  if (classIIIAdminEmails.has(adminEmail)) return 'Class III || Admins';
  return admin.roleLabel || adminRoleLabels[normalizeAdminRole(admin.role)] || admin.role;
};

const modulePlans: Partial<Record<AdminTab, ModulePlan>> = {
  dashboard: {
    title: 'Admin Dashboard',
    text: 'Single control window for OrchardGrowers.in operations and eFruitMandi.live marketplace monitoring.',
    pages: ['Orchard Growers snapshot', 'eFruitMandi verification snapshot', 'Notifications', 'System settings'],
  },
  notifications: {
    title: 'Notifications',
    text: 'Review admin alerts, pending approvals, verification updates, and operational notices from one place.',
  },
  master: {
    title: 'Master',
    text: 'Central Orchard Growers records for product catalog, outlets, vendors, parties, and categories used by inventory and billing.',
    pages: ['Products', 'Units / Outlets', 'Vendors / Parties', 'Categories'],
  },
  inventory: {
    title: 'Inventory',
    text: 'Own manufacturing, nursery production, growing stock, and third-party procurement roll into aggregated live stock for orchardgrowers.in.',
    pages: ['Production Update', 'Purchase Entry', 'Current Stock', 'Stock Transfer', 'Damaged / Dead Stock', 'Low Stock Alert'],
    fields: ['Product', 'Aggregated Quantity', 'Unit Breakdown', 'Sale Rate', 'Discount', 'Online Status'],
    rules: ['Increase stock from production or purchase entries.', 'Reduce stock from online and offline invoices.', 'Sync aggregated stock to orchardgrowers.in listings.'],
  },
  productAdmin: {
    title: 'Product Master',
    text: 'Create and maintain Orchard Growers catalog records that feed inventory, billing, SEO, and storefront listing data.',
    fields: ['Product Name', 'Slug', 'SKU', 'HSN Code', 'CGST', 'SGST', 'Category', 'Type', 'Unit', 'SEO Keywords', 'Featured', 'Active', 'Images 1-5'],
  },
  purchase: {
    title: 'Purchase Entry',
    text: 'Third-party procurement for Orchard Growers resale with vendor invoice, multi-product rows, GST, rates, transport cost, and stock update.',
    pages: ['Vendor Selection', 'Invoice Details', 'Product Rows', 'Transport Cost', 'Notes', 'Stock Sync'],
  },
  billing: {
    title: 'Billing',
    text: 'Single invoice sequence for online and offline sales. Offline invoices reduce stock and online orders enter billing history automatically.',
    pages: ['New Invoice', 'Sales History', 'Returns / Refunds'],
    fields: ['Customer', 'Address', 'GST No.', 'Products', 'Quantity', 'Discount', 'Tax', 'Payment Method', 'Notes'],
    rules: ['Invoice format: OG/2026/0000001', 'Online and offline sales share one sequence.', 'Save invoice reduces aggregated live stock.'],
  },
  sales: {
    title: 'Sales History',
    text: 'Review Orchard Growers online orders and offline invoice history with shared invoice numbering and stock deductions.',
    pages: ['Online Orders', 'Offline Sales', 'GST Invoice', 'Payment Received', 'Refund / Cancellation', 'Dispatch / Delivery Status'],
    fields: ['Customer', 'Product', 'Quantity', 'Unit Price', 'Discount', 'GST / Tax', 'Total Amount', 'Payment Mode', 'Unit / Outlet', 'Stock Deduction', 'Invoice PDF'],
  },
  unitsOutlets: {
    title: 'Units / Outlets',
    text: 'Operate stock, sales, expenses, and profit reporting by Orchard Growers unit or outlet.',
    pages: ['Add Unit / Outlet', 'Unit Manager', 'Unit Inventory', 'Unit Sales', 'Unit Expenses', 'Unit Stock Transfer', 'Unit-wise Profit / Loss'],
  },
  expenses: {
    title: 'Expenses',
    text: 'Track operating expenses with approvals, payment mode, bill upload, and unit allocation.',
    pages: [
      'Add Expense',
      'Labour Expense',
      'Transport Expense',
      'Packaging Expense',
      'Rent',
      'Electricity / Water',
      'Marketing Expense',
      'Repair & Maintenance',
      'Staff Salary',
      'Miscellaneous',
    ],
    fields: ['Expense Date', 'Expense Category', 'Unit / Outlet', 'Amount', 'Paid To', 'Payment Mode', 'Bill Upload', 'Approved By', 'Status'],
  },
  financials: {
    title: 'Financials',
    text: 'Financial controls for expenses, GST summary, sales patterns, evaluations, profit/loss, cash flow, stock valuation, and operational reports.',
    pages: ['Expenses', 'GST Summary', 'Sales Pattern', 'Evaluations', 'Profit / Loss', 'Cash Flow', 'Payment Collection', 'Outstanding Dues', 'Stock Valuation', 'Unit-wise Performance', 'Low Stock Report', 'Reports'],
  },
  reports: {
    title: 'Reports',
    text: 'Consolidated Orchard Growers reporting for sales pattern, purchase trend, GST, stock valuation, unit performance, evaluations, and low stock controls.',
    pages: ['Sales Pattern', 'Sales Report', 'Purchase Report', 'GST Report', 'Stock Valuation', 'Unit-wise Performance', 'Evaluation Report', 'Low Stock Report'],
  },
  orchardSettings: {
    title: 'Settings',
    text: 'Orchard Growers ERP configuration for storefront stock sync, invoice sequence, tax defaults, and low stock thresholds.',
    pages: ['Invoice Series', 'Stock Sync', 'GST Defaults', 'Low Stock Thresholds', 'Storefront Visibility'],
  },
  logistics: {
    title: 'Logistics Control',
    text: 'Control eFruitMandi marketplace transport and Orchard Growers courier dispatch from one operational panel.',
    pages: logisticsPlatformPages,
    fields: ['Platform', 'Courier Partner', 'Booking Status', 'Tracking', 'Webhook / API Status', 'Fallback Action'],
    rules: ['Use eFruitMandi for registered driver tracking, GPS/manual updates, and escrow reflection.', 'Use Orchard Growers for direct consumer consignments, India Post API booking, and courier assignment.', 'Only India Post and eFruitMandi are API/custom-system ready today; other couriers remain setup-ready until integration is added.'],
  },
  efruitDashboard: {
    title: 'eFruitMandi Dashboard',
    text: 'Marketplace monitoring only. Lot creation, offer submission, deal creation, transaction records, service charge, and settlement status are automated.',
    rules: [
      'Seller / grower lists produce lot',
      'Buyer submits offered price',
      'Seller accepts offered price',
      'Deal is created automatically',
      'Payment / escrow / gateway status is tracked',
      'Transaction record and platform service charge are generated automatically',
      'Settlement status is updated',
    ],
  },
  users: {
    title: 'eFruitMandi Users',
    text: 'Manage seller, grower, farmer, buyer, transporter, staff, and suspended user profiles with verification actions and admin remarks.',
    pages: ['View Profile', 'Edit Profile', 'View Uploaded Documents', 'Verify User', 'Approve User', 'Reject User', 'Ask for Resubmission', 'Suspend User', 'Terminate User', 'Reactivate User', 'Add Admin Remark'],
  },
  kyc: {
    title: 'KYC Verification',
    text: 'Review uploaded identity, business, farmer, banking, and address documents with approval, rejection, resubmission, and expiry statuses.',
    pages: ['Aadhaar / ID Proof', 'PAN', 'GST Certificate', 'Farmer Proof / Land Proof', 'Business Proof', 'Bank Details', 'Address Proof', 'Other Documents'],
    fields: ['Pending', 'Under Review', 'Approved', 'Rejected', 'Resubmission Required', 'Expired'],
  },
  ogVerified: {
    title: 'OG Verification',
    text: 'Review product quality, orchard quality, buyer/grower trust proof, uploaded media, and YouTube proof separately from KYC.',
    pages: ['Pending Requests', 'Under Review', 'Approved OG Verified', 'Rejected Requests', 'Quality Proof', 'YouTube Proof', 'Admin Remarks'],
    fields: ['Role Type', 'Company / Orchard Name', 'Owner / Contact Person', 'Location', 'Phone', 'YouTube Link', 'Uploaded Proof', 'Status'],
    rules: ['KYC approval must not approve OG Verification.', 'OG approval applies only to the selected buyer/grower/logistic role.', 'Approve only after quality proof is reviewed by authorized admins.'],
  },
  produceLots: {
    title: 'Produce Lots',
    text: 'Admin monitors listed produce lots and handles exception cases only. Sellers, growers, and farmers create lots from their own account.',
    pages: ['View Listed Lots', 'Edit Lot if Required', 'Pause / Hide Lot', 'Approve / Reject Problematic Lot', 'Lot Issue History'],
    rules: ['Do not create manual produce lots from admin by default.', 'Use edit only for support, correction, or suspicious listing cases.'],
  },
  mandiCommodities: {
    title: 'Mandi Commodity Mapping',
    text: 'Map discovered AGMARKNET commodities as fruit or non-fruit. Public mandi rates show only commodities marked as fruit.',
    pages: ['Sync Commodity Master', 'Mark Fruit', 'Mark Non-Fruit', 'Add Missing Commodity'],
    rules: ['Commodity discovery comes from AGMARKNET data.', 'Admins can add or recategorize fruit commodities without code changes.'],
  },
  quotes: {
    title: 'Offer Management',
    text: 'Review offer requests, offered prices, accepted deals, rejected offers, and deal conversion without manual marketplace billing.',
    pages: ['Active Offer Requests', 'Offered Prices', 'Accepted Deals', 'Rejected Offers', 'Deal Conversion'],
    fields: ['Offer', 'Offered Price', 'Price Offer', 'Offer Request', 'Deal Price', 'Accepted Deal', 'Price Negotiation'],
  },
  deals: {
    title: 'Deal Management',
    text: 'Monitor accepted marketplace deals and intervene only for cancellation, support, or dispute handling.',
    pages: ['Active Deals', 'Completed Deals', 'Cancelled Deals', 'Disputed Deals', 'Deal Support'],
  },
  transactions: {
    title: 'Transactions',
    text: 'Track payment status, gateway status, platform service charge, refunds, and settlement status generated from accepted deals.',
    pages: ['Payment Status', 'Platform Service Charge', 'Escrow / Payment Gateway Status', 'Refund Status', 'Settlement Status'],
  },
  supportDisputes: {
    title: 'Support & Disputes',
    text: 'Handle exception workflows for sellers, buyers, payments, produce quality, and accounts.',
    pages: ['Seller Issues', 'Buyer Issues', 'Payment Issues', 'Quality Disputes', 'Account Issues'],
  },
  analytics: {
    title: 'Analytics',
    text: 'One analytics module for marketplace and Orchard Growers patterns.',
    pages: ['Sales Pattern', 'Offer Pattern', 'Deal Pattern', 'Produce-wise Demand', 'Location-wise Demand', 'Transaction Pattern', 'Revenue Pattern'],
  },
  efruitSettings: {
    title: 'eFruitMandi Settings',
    text: 'Configure verification queues, marketplace exception rules, transaction monitoring defaults, service charge settings, and admin preferences.',
  },
  staffUsers: {
    title: 'Staff Users',
    text: 'Manage admin panel staff access and internal users for Orchard Growers and eFruitMandi operations.',
    pages: ['Super Admin', 'Admin', 'Unit Manager', 'Inventory Manager', 'Sales Executive', 'Purchase Manager', 'Finance Manager', 'Verification Officer', 'Support Executive', 'Viewer'],
  },
  customers: {
    title: 'Customers',
    text: 'Customer records for Orchard Growers sales, invoicing, payments, refunds, and support follow-up.',
  },
  sellers: {
    title: 'Sellers / Growers / Farmers',
    text: 'Profile, document, verification, account status, and support controls for produce sellers.',
  },
  buyers: {
    title: 'Buyers',
    text: 'Buyer profile, offer activity, deal history, payment status, support, and account controls.',
  },
  rolesPermissions: {
    title: 'Roles & Permissions',
    text: 'View staff access levels and module permissions for admin panel operations.',
  },
  suspendedUsers: {
    title: 'Suspended Users',
    text: 'Review suspended, held, and terminated users with admin remarks and reactivation controls.',
  },
  systemSettings: {
    title: 'System Settings',
    text: 'Global settings for admin access, notification defaults, platform routing, security, and operational preferences.',
  },
  downloadApp: {
    title: 'Download App',
    text: 'Admin download links and release information for Orchard Growers and eFruitMandi apps.',
  },
};

const rolePermissionPlan = [
  { role: 'Super Admin', access: 'Full control' },
  { role: 'Admin', access: 'Operational admin access across assigned modules' },
  { role: 'Unit Manager', access: 'Own unit data only' },
  { role: 'Inventory Manager', access: 'Products and stock only' },
  { role: 'Sales Executive', access: 'Sales and invoice only' },
  { role: 'Purchase Manager', access: 'Purchase management only' },
  { role: 'Finance Manager', access: 'Financials only' },
  { role: 'Verification Officer', access: 'eFruitMandi users and KYC only' },
  { role: 'Support Executive', access: 'Support and disputes only' },
  { role: 'Viewer', access: 'Read-only access' },
];

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [token, setToken] = useState(() => {
    return getAdminStorageItem('adminToken');
  });
  const [admin, setAdmin] = useState<Admin | null>(() => {
    return readAdminJson<Admin>('adminUser');
  });
  const [authMode, setAuthMode] = useState<AdminAuthMode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [otpVerifiedEmail, setOtpVerifiedEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [message, setMessage] = useState('');
  const [kycRequests, setKycRequests] = useState<KycUser[]>([]);
  const [verificationRequests, setVerificationRequests] = useState<VerificationRequest[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminAccount[]>([]);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [quotes, setQuotes] = useState<AdminQuote[]>([]);
  const [mandiCommodities, setMandiCommodities] = useState<MandiCommodity[]>([]);
  const [erpData, setErpData] = useState<AdminErpData>(emptyAdminErpData);
  const [loading, setLoading] = useState(false);
  const [viewingFile, setViewingFile] = useState<UploadedFile | null>(null);
  const [adminSearch, setAdminSearch] = useState('');
  const [productDraft, setProductDraft] = useState<ProductDraft>(emptyProductDraft);
  const [editingProductId, setEditingProductId] = useState('');
  const [productSaving, setProductSaving] = useState(false);
  const [platformRailWidth, setPlatformRailWidth] = useState(() => {
    const raw = getAdminStorageItem('adminPlatformRailWidth');
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) return 145;
    return parsed;
  });
  const [railResizeStart, setRailResizeStart] = useState<{ x: number; width: number } | null>(null);
  const [fullscreenTarget, setFullscreenTarget] = useState<'announcement' | 'action' | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [orchardModulePages, setOrchardModulePages] = useState<OrchardModulePages>(defaultOrchardModulePages);
  const [expandedSidebarKey, setExpandedSidebarKey] = useState<string | null>(null);
  const [lastPlatformTabs, setLastPlatformTabs] = useState<Partial<Record<AdminPlatform, AdminTab>>>({});
  const [themeMode, setThemeMode] = useState<AdminThemeMode>(readAdminThemeMode);
  const [systemPrefersDark, setSystemPrefersDark] = useState(() =>
    typeof window === 'undefined' ? true : window.matchMedia('(prefers-color-scheme: dark)').matches
  );
  const announcementBarRef = useRef<HTMLElement | null>(null);
  const actionPanelRef = useRef<HTMLDivElement | null>(null);
  const routeTab = getTabFromPath(location.pathname);
  const adminRole = normalizeAdminRole(admin?.role);
  const defaultAllowedTab = getDefaultAdminTab(adminRole);
  const activeTab = canAccessAdminTab(adminRole, routeTab) ? routeTab : defaultAllowedTab;
  const activePlatform = adminTabPlatforms[activeTab];
  const effectiveTheme = themeMode === 'system' ? (systemPrefersDark ? 'dark' : 'light') : themeMode;

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const syncSystemTheme = () => setSystemPrefersDark(media.matches);
    syncSystemTheme();
    media.addEventListener('change', syncSystemTheme);
    return () => media.removeEventListener('change', syncSystemTheme);
  }, []);

  useEffect(() => {
    setAdminStorageItem(ADMIN_THEME_KEY, themeMode);
    document.documentElement.dataset.adminThemeMode = themeMode;
    document.documentElement.dataset.adminEffectiveTheme = effectiveTheme;
    document.documentElement.style.colorScheme = effectiveTheme;
  }, [themeMode, effectiveTheme]);

  useEffect(() => {
    if (otpCooldown <= 0) return undefined;

    const timer = window.setTimeout(() => {
      setOtpCooldown((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [otpCooldown]);

  useEffect(() => {
    setLastPlatformTabs((current) => ({
      ...current,
      [activePlatform]: activeTab,
    }));
  }, [activePlatform, activeTab]);

  const authHeaders = useMemo(() => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return headers;
  }, [token]);
  const uploadAuthHeaders = useMemo(() => {
    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return headers;
  }, [token]);

  const switchAuthMode = (mode: AdminAuthMode) => {
    setAuthMode(mode);
    setMessage('');
    setPassword('');
    setConfirmPassword('');
    setOtp('');
    setOtpCooldown(0);
    setOtpVerifiedEmail('');
    if (mode !== 'reset') setResetToken('');
  };

  const validateAuthEmail = () => {
    const nextEmail = normalizeAdminEmail(email);
    if (!nextEmail || !isValidAdminEmail(nextEmail)) {
      setMessage('Valid admin email is required.');
      return '';
    }

    return nextEmail;
  };

  const validateNewPassword = () => {
    const passwordMessage = getAdminPasswordValidationMessage(password);
    if (passwordMessage) {
      setMessage(passwordMessage);
      return false;
    }

    if (password !== confirmPassword) {
      setMessage('Passwords do not match.');
      return false;
    }

    return true;
  };

  const sendAdminOtp = async () => {
    setMessage('');
    if (otpCooldown > 0) return;

    const otpEmail = validateAuthEmail();
    if (!otpEmail) return;

    if (!API_BASE) {
      setMessage('Admin API URL is not configured. Set VITE_API_BASE_URL for the admin panel deployment.');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/admin/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(withAdminAuthSource({ email: otpEmail, mode: authMode === 'signup' ? 'signup' : 'login' })),
      });
      const data = await readResponseJson(res);

      if (!res.ok) {
        setMessage(data.msg || 'Could not send OTP.');
        return;
      }

      setOtp('');
      setOtpCooldown(ADMIN_OTP_RESEND_SECONDS);
      setOtpVerifiedEmail('');
      setMessage(data.message || 'OTP sent to admin email.');
    } catch (err) {
      setMessage(getNetworkErrorMessage(err));
    }
  };

  const verifyAdminOtp = async () => {
    setMessage('');
    const otpEmail = validateAuthEmail();
    if (!otpEmail) return;

    if (!otp.trim()) {
      setMessage('Enter OTP.');
      return;
    }

    if (!API_BASE) {
      setMessage('Admin API URL is not configured. Set VITE_API_BASE_URL for the admin panel deployment.');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/admin/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(withAdminAuthSource({ email: otpEmail, otp: otp.trim() })),
      });
      const data = await readResponseJson(res);

      if (!res.ok) {
        setOtpVerifiedEmail('');
        setMessage(data.msg || 'OTP verification failed.');
        return;
      }

      if (data.requiresPasswordSetup && data.setupToken) {
        setOtpVerifiedEmail('');
        setResetToken(data.setupToken);
        setPassword('');
        setConfirmPassword('');
        setAuthMode('reset');
        setMessage('Please set your password to continue.');
        return;
      }

      setOtpVerifiedEmail(otpEmail);
      setMessage(data.message || 'OTP verified.');
    } catch (err) {
      setOtpVerifiedEmail('');
      setMessage(getNetworkErrorMessage(err));
    }
  };

  const login = async (event: FormEvent) => {
    event.preventDefault();
    setMessage('');

    const loginEmail = validateAuthEmail();
    if (!loginEmail) return;
    if (otpVerifiedEmail !== loginEmail) {
      setMessage('Verify OTP before admin login.');
      return;
    }

    if (!API_BASE) {
      setMessage('Admin API URL is not configured. Set VITE_API_BASE_URL for the admin panel deployment.');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(withAdminAuthSource({ email: loginEmail, password })),
      });
      const data = await readResponseJson(res);

      if (!res.ok) {
        if (data.requiresPasswordSetup) {
          setMessage('Please set your password to continue.');
          return;
        }
        setMessage(data.msg || 'Admin login failed');
        return;
      }

      if (!data.token || !data.admin) {
        setMessage('Admin login response did not include session data.');
        return;
      }

      setAdminStorageItem('adminToken', data.token);
      setAdminStorageItem('adminUser', JSON.stringify(data.admin));
      setToken(data.token);
      setAdmin(data.admin);
      setOtp('');
      setOtpVerifiedEmail('');

      if (location.pathname === '/') {
        navigate(adminRoutePaths.dashboard, { replace: true });
      }
    } catch (err) {
      setMessage(getNetworkErrorMessage(err));
    }
  };

  const signup = async (event: FormEvent) => {
    event.preventDefault();
    setMessage('');

    const signupEmail = validateAuthEmail();
    if (!signupEmail || !validateNewPassword()) return;
    if (otpVerifiedEmail !== signupEmail) {
      setMessage('Verify OTP before admin signup.');
      return;
    }

    if (!API_BASE) {
      setMessage('Admin API URL is not configured. Set VITE_API_BASE_URL for the admin panel deployment.');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/admin/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(withAdminAuthSource({ name, email: signupEmail, password, confirmPassword })),
      });
      const data = await readResponseJson(res);

      if (!res.ok) {
        setMessage(data.msg || 'Admin signup failed');
        return;
      }

      if (!data.token || !data.admin) {
        setMessage('Admin signup response did not include session data.');
        return;
      }

      setAdminStorageItem('adminToken', data.token);
      setAdminStorageItem('adminUser', JSON.stringify(data.admin));
      setToken(data.token);
      setAdmin(data.admin);
      setOtp('');
      setOtpVerifiedEmail('');
      setPassword('');
      setConfirmPassword('');

      if (location.pathname === '/') {
        navigate(adminRoutePaths.dashboard, { replace: true });
      }
    } catch (err) {
      setMessage(getNetworkErrorMessage(err));
    }
  };

  const requestPasswordReset = async (event: FormEvent) => {
    event.preventDefault();
    setMessage('');

    const resetEmail = validateAuthEmail();
    if (!resetEmail) return;

    if (!API_BASE) {
      setMessage('Admin API URL is not configured. Set VITE_API_BASE_URL for the admin panel deployment.');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/admin/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(withAdminAuthSource({ email: resetEmail })),
      });
      const data = await readResponseJson(res);

      if (!res.ok) {
        setMessage(data.msg || 'Reset request failed');
        return;
      }

      if (data.resetToken) {
        setResetToken(data.resetToken);
        setAuthMode('reset');
        setMessage(data.emailSent ? 'Reset link sent. Test token filled.' : 'Test reset token generated.');
        return;
      }

      setMessage(data.msg || 'If the admin email is registered, reset instructions have been sent.');
    } catch (err) {
      setMessage(getNetworkErrorMessage(err));
    }
  };

  const resetPasswordWithToken = async (event: FormEvent) => {
    event.preventDefault();
    setMessage('');

    const resetEmail = validateAuthEmail();
    if (!resetEmail) return;

    if (!resetToken.trim()) {
      setMessage('Reset token is required.');
      return;
    }

    if (!validateNewPassword()) return;

    if (!API_BASE) {
      setMessage('Admin API URL is not configured. Set VITE_API_BASE_URL for the admin panel deployment.');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/admin/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(withAdminAuthSource({
          email: resetEmail,
          token: resetToken.trim(),
          password,
          confirmPassword,
        })),
      });
      const data = await readResponseJson(res);

      if (!res.ok) {
        setMessage(data.msg || 'Password reset failed');
        return;
      }

      setPassword('');
      setConfirmPassword('');
      setResetToken('');
      setAuthMode('login');
      setMessage(data.msg || 'Password reset successful. Please login.');
      if (location.search) {
        navigate('/', { replace: true });
      }
    } catch (err) {
      setMessage(getNetworkErrorMessage(err));
    }
  };

  const clearAdminSession = (nextMessage?: string) => {
    removeAdminStorageItem('adminToken');
    removeAdminStorageItem('adminUser');
    setToken('');
    setAdmin(null);
    if (nextMessage) setMessage(nextMessage);
  };

  const loadRequests = async () => {
    if (!token) return;
    if (!API_BASE) {
      setMessage('Admin API URL is not configured. Set VITE_API_BASE_URL for the admin panel deployment.');
      return;
    }

    setLoading(true);
    setMessage('');
    try {
      const [kycRes, verificationRes, ordersRes, usersRes, productsRes, adminsRes, quotesRes, mandiCommodityRes] = await Promise.all([
        fetch(`${API_BASE}/admin/kyc-requests`, { headers: authHeaders }),
        fetch(`${API_BASE}/admin/verification-requests`, { headers: authHeaders }),
        fetch(`${API_BASE}/admin/orders`, { headers: authHeaders }),
        fetch(`${API_BASE}/admin/users`, { headers: authHeaders }),
        fetch(`${API_BASE}/admin/products`, { headers: authHeaders }),
        fetch(`${API_BASE}/admin/admins`, { headers: authHeaders }),
        fetch(`${API_BASE}/admin/quotes`, { headers: authHeaders }),
        fetch(`${API_BASE}/admin/mandi-commodities`, { headers: authHeaders }),
      ]);

      if ([kycRes, verificationRes, ordersRes, usersRes, productsRes, adminsRes, quotesRes, mandiCommodityRes].some((res) => [401, 403].includes(res.status))) {
        clearAdminSession('Admin session expired or access was revoked. Please log in again.');
        return;
      }

      const [kycData, verificationData, ordersData, usersData, productsData, adminsData, quotesData, mandiCommodityData] = await Promise.all([
        readResponseJson(kycRes),
        readResponseJson(verificationRes),
        readResponseJson(ordersRes),
        readResponseJson(usersRes),
        readResponseJson(productsRes),
        readResponseJson(adminsRes),
        readResponseJson(quotesRes),
        readResponseJson(mandiCommodityRes),
      ]);
      if (!kycRes.ok) throw new Error(kycData.msg || 'Could not load KYC requests');
      if (!verificationRes.ok) {
        throw new Error(verificationData.msg || 'Could not load verification requests');
      }
      if (!ordersRes.ok) throw new Error(ordersData.msg || 'Could not load orders');
      if (!usersRes.ok) throw new Error(usersData.msg || 'Could not load users');
      if (!productsRes.ok) throw new Error(productsData.msg || 'Could not load products');
      if (!adminsRes.ok) throw new Error(adminsData.msg || 'Could not load admin users');
      if (!quotesRes.ok) throw new Error(quotesData.msg || 'Could not load offers');
      if (!mandiCommodityRes.ok) throw new Error(mandiCommodityData.msg || 'Could not load mandi commodities');
      setKycRequests(Array.isArray(kycData) ? kycData.filter(isSubmittedKycRequest) : []);
      setVerificationRequests(verificationData || []);
      setOrders(ordersData || []);
      setUsers(usersData || []);
      setProducts(productsData || []);
      setAdminUsers(adminsData || []);
      setQuotes(quotesData.quotes || []);
      setMandiCommodities(mandiCommodityData.commodities || []);

      const loadOptionalErpJson = async <T,>(path: string, fallback: T): Promise<T> => {
        try {
          const response = await fetch(`${API_BASE}${path}`, { headers: authHeaders });
          if ([401, 403].includes(response.status)) {
            throw new Error('ERP_ADMIN_UNAUTHORIZED');
          }
          if (!response.ok) return fallback;
          return (await readResponseJson(response)) as T;
        } catch (erpError) {
          if (erpError instanceof Error && erpError.message === 'ERP_ADMIN_UNAUTHORIZED') {
            throw erpError;
          }
          return fallback;
        }
      };

      try {
        const [
          erpDashboardData,
          erpPaymentsData,
          erpSettlementsData,
          erpCommissionsData,
          erpDocumentsData,
          erpLedgerData,
          erpAuditData,
          erpNotificationsData,
          erpTicketsData,
          erpRefundsData,
        ] = await Promise.all([
          loadOptionalErpJson<{ success?: boolean } & AdminErpDashboard>('/admin/erp/dashboard', { success: false }),
          loadOptionalErpJson<{ payments?: AdminErpPayment[] }>('/admin/erp/payments?limit=100', { payments: [] }),
          loadOptionalErpJson<{ settlements?: AdminErpSettlement[] }>('/admin/erp/settlements?limit=100', { settlements: [] }),
          loadOptionalErpJson<{ commissions?: AdminErpCommission[] }>('/admin/erp/commission-ledger?limit=100', { commissions: [] }),
          loadOptionalErpJson<{ documents?: AdminErpDocument[] }>('/admin/erp/documents?limit=100', { documents: [] }),
          loadOptionalErpJson<{ ledgerEntries?: AdminErpLedgerEntry[] }>('/admin/erp/accounting/ledger?limit=100', { ledgerEntries: [] }),
          loadOptionalErpJson<{ auditEvents?: AdminErpAuditEvent[] }>('/admin/erp/audit/events?limit=100', { auditEvents: [] }),
          loadOptionalErpJson<{ notifications?: AdminErpNotification[] }>('/admin/erp/notifications?limit=100', { notifications: [] }),
          loadOptionalErpJson<{ tickets?: AdminErpTicket[] }>('/admin/erp/support/tickets?limit=100', { tickets: [] }),
          loadOptionalErpJson<{ refunds?: AdminErpRefund[] }>('/admin/erp/refunds?limit=100', { refunds: [] }),
        ]);

        setErpData({
          dashboard: erpDashboardData.success === false ? null : erpDashboardData,
          payments: erpPaymentsData.payments || [],
          settlements: erpSettlementsData.settlements || [],
          commissions: erpCommissionsData.commissions || [],
          documents: erpDocumentsData.documents || [],
          ledgerEntries: erpLedgerData.ledgerEntries || [],
          auditEvents: erpAuditData.auditEvents || [],
          notifications: erpNotificationsData.notifications || [],
          tickets: erpTicketsData.tickets || [],
          refunds: erpRefundsData.refunds || [],
        });
      } catch (erpError) {
        if (erpError instanceof Error && erpError.message === 'ERP_ADMIN_UNAUTHORIZED') {
          clearAdminSession('Admin session expired or access was revoked. Please log in again.');
          return;
        }
        setErpData(emptyAdminErpData);
      }
    } catch (err) {
      setMessage(getNetworkErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [token]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const resetMode = params.get('mode') === 'reset' || params.has('token');
    if (!resetMode) return;

    const resetEmail = params.get('email');
    const nextResetToken = params.get('token');
    if (resetEmail) setEmail(normalizeAdminEmail(resetEmail));
    if (nextResetToken) setResetToken(nextResetToken);
    setAuthMode('reset');
    setMessage('');
  }, [location.search]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    setAdminStorageItem('adminPlatformRailWidth', String(platformRailWidth));
  }, [platformRailWidth]);

  useEffect(() => {
    if (!railResizeStart) return;

    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMove = (event: MouseEvent) => {
      const nextWidth = railResizeStart.width + event.clientX - railResizeStart.x;
      setPlatformRailWidth(Math.min(320, Math.max(96, nextWidth)));
    };
    const handleUp = () => setRailResizeStart(null);

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);

    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [railResizeStart]);

  useEffect(() => {
    const updateFullscreen = () => {
      if (document.fullscreenElement === announcementBarRef.current) {
        setFullscreenTarget('announcement');
        return;
      }

      if (document.fullscreenElement === actionPanelRef.current) {
        setFullscreenTarget('action');
        return;
      }

      setFullscreenTarget(null);
    };
    document.addEventListener('fullscreenchange', updateFullscreen);
    updateFullscreen();

    return () => document.removeEventListener('fullscreenchange', updateFullscreen);
  }, []);

  const logout = () => {
    clearAdminSession();
  };

  const toggleAnnouncementFullscreen = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }

    await announcementBarRef.current?.requestFullscreen();
  };

  const toggleActionPanelFullscreen = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }

    await actionPanelRef.current?.requestFullscreen();
  };

  const review = async (
    type: 'kyc' | 'verification',
    id: string,
    action: ReviewAction
  ) => {
    if (type === 'kyc' && action === 'APPROVE' && !confirmTwice('approve this KYC request')) {
      return;
    }

    if (type === 'verification' && action === 'APPROVE' && !confirmTwice('approve this OG Verification request')) {
      return;
    }

    if (['HOLD', 'SUSPEND', 'TERMINATE'].includes(action) && !confirmTwice(`${action.toLowerCase()} this request and user account`)) {
      return;
    }

    const path =
      type === 'kyc'
        ? `${API_BASE}/admin/kyc-requests/${id}/review`
        : `${API_BASE}/admin/verification-requests/${id}/review`;
    const note =
      type === 'kyc' && ['REJECT', 'CORRECTION_REQUIRED'].includes(action)
        ? window.prompt('Admin remarks are required', '')
        : '';

    if (type === 'kyc' && ['REJECT', 'CORRECTION_REQUIRED'].includes(action) && !note?.trim()) {
      setMessage('Admin remarks are required for rejection or correction.');
      return;
    }

    const res = await fetch(path, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ action, note }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.msg || 'Review failed');
      return;
    }
    setMessage(
      action === 'APPROVE'
        ? type === 'verification'
          ? 'OG Verification approval saved. Badge appears only after required admin approval is complete.'
          : 'Approval saved. User verifies after Class1 and Class2 approval.'
        : 'Rejection saved.'
    );
    loadRequests();
  };

  const editVerificationRequest = async (request: VerificationRequest) => {
    if (!confirmTwice('edit this Get Verified request')) return;

    const orchardName = window.prompt('Company / Orchard Name', request.orchardName);
    if (orchardName === null) return;
    const ownerName = window.prompt('Owner / Contact Person', request.ownerName);
    if (ownerName === null) return;
    const location = window.prompt('Location', request.location);
    if (location === null) return;
    const phone = window.prompt('Phone', request.phone);
    if (phone === null) return;
    const youtubeVideoId = window.prompt('YouTube Video ID', request.youtubeVideoId || '');
    if (youtubeVideoId === null) return;

    const res = await fetch(`${API_BASE}/admin/verification-requests/${request._id}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ orchardName, ownerName, location, phone, youtubeVideoId }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.msg || 'Edit failed');
      return;
    }
    setMessage('Request updated.');
    loadRequests();
  };

  const saveOrchardProduct = async (event: FormEvent) => {
    event.preventDefault();
    setMessage('');
    const isRawMaterial = productDraft.inventoryType === 'raw_material';
    if (!isRawMaterial && productDraft.uploadedImages.length < 5) {
      setMessage('Upload at least 5 product images.');
      return;
    }

    const payload = getProductPayload(productDraft);

    try {
      setProductSaving(true);
      const res = editingProductId
        ? await fetch(`${API_BASE}/admin/products/${editingProductId}`, {
            method: 'PATCH',
            headers: authHeaders,
            body: JSON.stringify(payload),
          })
        : await fetch(`${API_BASE}/admin/products`, {
            method: 'POST',
            headers: uploadAuthHeaders,
            body: getProductFormData(payload),
          });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.msg || (editingProductId ? 'Product update failed' : 'Product save failed'));
        return;
      }
      setMessage(editingProductId ? 'Product updated.' : 'Product saved. It will display on orchardgrowers.in as currently unavailable until stock is added.');
      setProductDraft(emptyProductDraft);
      setEditingProductId('');
      loadRequests();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : editingProductId ? 'Product update failed' : 'Product save failed');
    } finally {
      setProductSaving(false);
    }
  };

  const editOrchardProduct = (product: AdminProduct) => {
    setEditingProductId(product._id);
    setProductDraft(getProductDraftFromProduct(product));
    setMessage('Editing product. Update fields and click Update Product.');
  };

  const cancelProductEdit = () => {
    setEditingProductId('');
    setProductDraft(emptyProductDraft);
    setMessage('');
  };

  const deleteOrchardProduct = async (product: AdminProduct) => {
    const productName = product.title || product.fruitName || 'this product';
    if (!confirmTwice(`delete ${productName}`)) return;

    const res = await fetch(`${API_BASE}/admin/products/${product._id}`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.msg || 'Product delete failed');
      return;
    }

    if (editingProductId === product._id) {
      setEditingProductId('');
      setProductDraft(emptyProductDraft);
    }
    setMessage('Product deleted.');
    loadRequests();
  };

  const updateProductStock = async (product: AdminProduct) => {
    const quantity = window.prompt('Update stock units', String(product.quantity ?? 0));
    if (quantity === null) return;
    const nextQuantity = Number(quantity);
    if (!Number.isFinite(nextQuantity) || nextQuantity < 0) {
      setMessage('Negative stock cannot be processed. Purchase or update stock first.');
      return;
    }
    const basePrice = window.prompt('Update product price', String(product.basePrice ?? 0));
    if (basePrice === null) return;
    const nextBasePrice = Number(basePrice);
    if (!Number.isFinite(nextBasePrice) || nextBasePrice < 0) {
      setMessage('Price cannot be negative.');
      return;
    }
    const status = window.prompt('Status: ACTIVE, QUOTE_ENABLED, INACTIVE', formatProductStatus(product.status || 'AVAILABLE'));
    if (status === null) return;
    const nextStatus = normalizeProductStatusInput(status);

    const res = await fetch(`${API_BASE}/admin/products/${product._id}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ quantity: nextQuantity, basePrice: nextBasePrice, status: nextStatus }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.msg || 'Inventory update failed');
      return;
    }
    setMessage('Inventory updated.');
    loadRequests();
  };

  const editUserInfo = async (user: AdminUser) => {
    const name = window.prompt('Name', user.name || '');
    if (name === null) return;
    const phone = window.prompt('Phone', user.phone || '');
    if (phone === null) return;
    const email = window.prompt('Email', user.email || '');
    if (email === null) return;
    const role = window.prompt('Role: grower, buyer, driver, or blank', user.role || '');
    if (role === null) return;
    const businessName = window.prompt('Business / Company name', user.businessName || user.orchardName || '');
    if (businessName === null) return;

    const res = await fetch(`${API_BASE}/admin/users/${user._id}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        name,
        phone,
        email,
        role,
        businessName,
        orchardName: role === 'grower' ? businessName : user.orchardName || '',
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.msg || 'User update failed');
      return;
    }
    setMessage('eFruitMandi user information updated.');
    loadRequests();
  };

  const setUserStatus = async (user: AdminUser, status: string) => {
    if (status !== 'ACTIVE' && !confirmTwice(`${status.toLowerCase()} ${user.name || user.email || 'this user'}`)) return;
    const note = window.prompt('Admin note', user.adminNotes || '');
    if (note === null) return;
    const res = await fetch(`${API_BASE}/admin/users/${user._id}/status`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ status, note }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.msg || 'User status update failed');
      return;
    }
    setMessage(`User status changed to ${status}.`);
    loadRequests();
  };

  const createManagedAdmin = async (payload: { name: string; email: string; phone: string; adminClass: string; role: string; status: string }) => {
    if (!confirmTwice(`create admin ${payload.email}`)) return;
    const res = await fetch(`${API_BASE}/admin/admins`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(payload),
    });
    const data = await readResponseJson(res);
    if (!res.ok) {
      setMessage(data.msg || 'Admin creation failed');
      return;
    }
    setMessage('Admin user created. They must verify OTP and set password on first login.');
    loadRequests();
  };

  const runAdminUserAction = async (target: AdminAccount, action: 'approve' | 'reject' | 'suspend' | 'activate' | 'reset-password') => {
    const id = target._id || target.id;
    if (!id) return;
    if (!confirmTwice(`${action.replace('-', ' ')} ${target.email || target.name || 'this admin'}`)) return;
    const res = await fetch(`${API_BASE}/admin/admins/${id}/${action}`, {
      method: 'PATCH',
      headers: authHeaders,
    });
    const data = await readResponseJson(res);
    if (!res.ok) {
      setMessage(data.msg || 'Admin action failed');
      return;
    }
    setMessage(data.message || 'Admin user updated.');
    loadRequests();
  };

  const changeManagedAdminClass = async (target: AdminAccount) => {
    const id = target._id || target.id;
    if (!id) return;
    const adminClass = window.prompt('Admin class: CLASS_II or CLASS_III', target.adminClass || 'CLASS_III');
    if (!adminClass) return;
    const res = await fetch(`${API_BASE}/admin/admins/${id}/class`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ adminClass }),
    });
    const data = await readResponseJson(res);
    if (!res.ok) {
      setMessage(data.msg || 'Admin class update failed');
      return;
    }
    setMessage('Admin class updated.');
    loadRequests();
  };

  const viewManagedAdminDetails = (target: AdminAccount) => {
    const approvedBy = typeof target.approvedBy === 'object' ? target.approvedBy?.email || target.approvedBy?.name : target.approvedBy || (target.status === 'ACTIVE' ? 'Approved' : 'Not approved');
    window.alert([
      `Name: ${target.name || ''}`,
      `Email: ${target.email || ''}`,
      `Phone: ${target.phone || ''}`,
      `Class: ${target.adminClass || ''}`,
      `Role: ${target.role || ''}`,
      `Status: ${target.status || ''}`,
      `Created: ${formatDate(target.createdAt)}`,
      `Approved by: ${approvedBy}`,
    ].join('\n'));
  };

  const deleteUserProfile = async (user: AdminUser) => {
    if (normalizeAdminEmail(admin?.email || '') !== PROFILE_DELETE_ADMIN_EMAIL) return;
    const profileName = user.profileName || user.businessName || user.orchardName || user.name || user.email || 'this profile';
    if (!confirmTwice(`permanently delete ${profileName}`)) return;

    const res = await fetch(`${API_BASE}/admin/users/${user._id}`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.msg || 'Profile delete failed');
      return;
    }

    setMessage(data.message || 'Profile deleted');
    loadRequests();
  };

  const updateKycInformation = async (id: string, updates: KycUpdatePayload) => {
    const res = await fetch(`${API_BASE}/admin/kyc-requests/${id}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify(updates),
    });
    const data = await readResponseJson(res);
    if (!res.ok) {
      setMessage(data.msg || 'KYC information could not be updated.');
      return false;
    }
    setMessage('KYC information updated successfully.');
    await loadRequests();
    return true;
  };

  const syncMandiCommodities = async () => {
    if (!confirmTwice('sync AGMARKNET commodity master data')) return;

    const res = await fetch(`${API_BASE}/admin/mandi-commodities/sync`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ limit: 1000, maxPages: 200 }),
    });
    const data = await readResponseJson(res);
    if (!res.ok) {
      setMessage(data.msg || 'Could not sync mandi commodities');
      return;
    }
    setMessage(`Commodity master synced. ${data.commoditiesSeen || 0} unique commodities seen.`);
    loadRequests();
  };

  const createMandiCommodity = async (payload: { commodity: string; displayName?: string; aliases?: string; isFruit: boolean; adminNotes?: string }) => {
    const res = await fetch(`${API_BASE}/admin/mandi-commodities`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        ...payload,
        category: payload.isFruit ? 'fruit' : 'non-fruit',
      }),
    });
    const data = await readResponseJson(res);
    if (!res.ok) {
      setMessage(data.msg || 'Could not save mandi commodity');
      return;
    }
    setMessage(`${payload.commodity} saved.`);
    loadRequests();
  };

  const updateMandiCommodity = async (id: string, payload: Partial<MandiCommodity>) => {
    const res = await fetch(`${API_BASE}/admin/mandi-commodities/${id}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify(payload),
    });
    const data = await readResponseJson(res);
    if (!res.ok) {
      setMessage(data.msg || 'Could not update mandi commodity');
      return;
    }
    setMessage('Mandi commodity mapping updated.');
    loadRequests();
  };

  if (!token || !admin) {
    const authFormTitle: Record<AdminAuthMode, string> = {
      login: 'Admin Panels',
      signup: 'Authority Signup',
      forgot: 'Forgot Password',
      reset: 'Reset Password',
    };
    const authButtonLabel: Record<AdminAuthMode, string> = {
      login: 'Login',
      signup: 'Create Admin Account',
      forgot: 'Send Reset Link',
      reset: 'Reset Password',
    };
    const handleAuthSubmit =
      authMode === 'signup'
        ? signup
        : authMode === 'forgot'
          ? requestPasswordReset
          : authMode === 'reset'
            ? resetPasswordWithToken
            : login;

    return (
      <div className={`admin-auth-page min-h-screen bg-slate-950 px-4 text-slate-100 ${authMode === 'signup' ? 'py-2 sm:py-3' : 'py-6 sm:py-10'}`}>
        <InstallAppPrompt />
        <form
          onSubmit={handleAuthSubmit}
          autoComplete={authMode === 'login' ? 'off' : undefined}
          className={`mx-auto max-w-md rounded-2xl border border-slate-800 bg-slate-900 shadow-xl ${authMode === 'signup' ? 'p-4' : 'p-6'}`}
        >
          <p className={`${authMode === 'signup' ? 'text-xs' : 'text-sm'} text-center font-bold tracking-[0.25em] text-emerald-400`}>
            Welcome To Orchard Growers Private Limited
          </p>
          <h1 className={`${authMode === 'signup' ? 'mt-2 text-xl' : 'mt-3 text-2xl'} text-center font-bold text-white`}>{authFormTitle[authMode]}</h1>
          {message && <p className={`${authMode === 'signup' ? 'mt-2 px-3 py-1.5 text-xs' : 'mt-4 px-3 py-2 text-sm'} rounded bg-red-950`}>{message}</p>}
          {authMode === 'signup' && (
            <label className="mt-2 block text-sm font-semibold">
              Name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-emerald-400"
              />
            </label>
          )}
          <label className={`${authMode === 'signup' ? 'mt-2' : 'mt-5'} block text-sm font-semibold`}>
            Email
            <input
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setOtpVerifiedEmail('');
                setOtpCooldown(0);
              }}
              autoComplete="email"
              className={`${authMode === 'signup' ? 'mt-1.5' : 'mt-2'} w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-emerald-400`}
            />
          </label>
          {(authMode === 'login' || authMode === 'signup') && (
            <label className={`${authMode === 'signup' ? 'mt-2' : 'mt-4'} block text-sm font-semibold`}>
              Enter OTP
              <div className={`${authMode === 'signup' ? 'mt-1.5' : 'mt-2'} flex gap-2`}>
                <input
                  value={otp}
                  onChange={(event) => {
                    setOtp(event.target.value);
                    setOtpVerifiedEmail('');
                  }}
                  autoComplete="one-time-code"
                  className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-emerald-400"
                />
                <button
                  type="button"
                  onClick={sendAdminOtp}
                  disabled={otpCooldown > 0}
                  className="rounded-lg border border-emerald-600 px-3 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-950 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {otpCooldown > 0 ? `${otpCooldown}s` : 'OTP'}
                </button>
                <button
                  type="button"
                  onClick={verifyAdminOtp}
                  className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-bold text-white hover:bg-slate-700"
                >
                  Verify
                </button>
              </div>
            </label>
          )}
          {authMode === 'reset' && (
            <label className="mt-4 block text-sm font-semibold">
              Reset Token
              <input
                value={resetToken}
                onChange={(event) => setResetToken(event.target.value)}
                autoComplete="one-time-code"
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-emerald-400"
              />
            </label>
          )}
          {authMode !== 'forgot' && (
            <label className={`${authMode === 'signup' ? 'mt-2' : 'mt-4'} block text-sm font-semibold`}>
              Password
              <input
                value={password}
                type="password"
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={authMode === 'login' ? 'off' : 'new-password'}
                className={`${authMode === 'signup' ? 'mt-1.5' : 'mt-2'} w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-emerald-400`}
              />
            </label>
          )}
          {(authMode === 'signup' || authMode === 'reset') && (
            <label className={`${authMode === 'signup' ? 'mt-2' : 'mt-4'} block text-sm font-semibold`}>
              Confirm Password
              <input
                value={confirmPassword}
                type="password"
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                className={`${authMode === 'signup' ? 'mt-1.5' : 'mt-2'} w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-emerald-400`}
              />
            </label>
          )}
          <button className={`${authMode === 'signup' ? 'mt-3 py-2.5' : 'mt-6 py-3'} w-full rounded-lg bg-emerald-600 text-sm font-bold text-white hover:bg-emerald-500`}>
            {authButtonLabel[authMode]}
          </button>
          <div className={`${authMode === 'signup' ? 'mt-2 gap-y-1 text-xs' : 'mt-4 gap-y-2 text-sm'} flex flex-wrap items-center justify-center gap-x-4 font-semibold`}>
            {authMode !== 'login' && (
              <button type="button" onClick={() => switchAuthMode('login')} className="text-emerald-400 hover:text-emerald-300">
                Login
              </button>
            )}
            {authMode !== 'signup' && (
              <button type="button" onClick={() => switchAuthMode('signup')} className="text-emerald-400 hover:text-emerald-300">
                Signup
              </button>
            )}
            {authMode !== 'forgot' && (
              <button type="button" onClick={() => switchAuthMode('forgot')} className="text-emerald-400 hover:text-emerald-300">
                Forgot Password
              </button>
            )}
            {authMode !== 'reset' && (
              <button type="button" onClick={() => switchAuthMode('reset')} className="text-emerald-400 hover:text-emerald-300">
                Reset Password
              </button>
            )}
          </div>
        </form>
      </div>
    );
  }

  const pendingKycCount = kycRequests.filter((user) =>
    ['PENDING', 'COMPLETED', 'UNDER_REVIEW', 'CORRECTION_REQUIRED'].includes(String(user.kyc?.status || '').toUpperCase())
  ).length;
  const pendingVerificationCount = verificationRequests.filter(
    (request) => request.status === 'SUBMITTED'
  ).length;
  const notificationCount = pendingKycCount + pendingVerificationCount;
  const approvedKycCount = kycRequests.filter((user) => user.kyc?.status === 'APPROVED').length;
  const approvedVerificationCount = verificationRequests.filter(
    (request) => request.status === 'APPROVED'
  ).length;
  const countByTab: Partial<Record<AdminTab, number>> = {
    inventory: products.length,
    sales: orders.length,
    logistics: orders.length,
    users: users.length,
    kyc: kycRequests.length,
    ogVerified: verificationRequests.length,
    mandiCommodities: mandiCommodities.length,
    deals: orders.length,
    transactions: erpData.payments.length || orders.length,
    efruitInvoices: erpData.documents.length,
    supportDisputes: erpData.tickets.length,
    analytics: erpData.dashboard?.growthAnalytics?.length || undefined,
    sellers: users.filter((user) => user.role === 'grower').length,
    buyers: users.filter((user) => user.role === 'buyer').length,
    suspendedUsers: users.filter((user) => ['HOLD', 'SUSPENDED', 'TERMINATED'].includes(user.accountStatus || '')).length,
    adminUsers: adminUsers.length,
    notifications: notificationCount,
  };
  const tabs = platformTabs[activePlatform]
    .filter((tab) => canAccessAdminTab(adminRole, tab.id))
    .map((tab) => ({
      ...tab,
      count: countByTab[tab.id],
    }));
  const actionTab = tabs.find((tab) => tab.id === activeTab);
  const actionTabs = [
    {
      id: activeTab,
      label: activeTab === 'logistics' ? 'Logistics Control' : actionTab?.label || getAdminTabTitle(activeTab, activePlatform),
      count: countByTab[activeTab],
    },
  ];
  const activeTitle = getAdminTabTitle(activeTab, activePlatform);
  const searchedProducts = filterProducts(products, adminSearch);
  const searchedUsers = filterUsers(users, adminSearch);
  const searchedMandiCommodities = filterMandiCommodities(mandiCommodities, adminSearch);
  const sidebarGroups = getSidebarGroups(countByTab, logout, adminRole);
  const getOrchardModulePage = (moduleTab: AdminTab) =>
    orchardModulePages[moduleTab] || defaultOrchardModulePages[moduleTab] || '';
  const getLastTabForPlatform = (platform: AdminPlatform) => {
    const lastTab = lastPlatformTabs[platform];
    if (lastTab && canAccessAdminTab(adminRole, lastTab)) return lastTab;
    return getDefaultTabForPlatform(platform, adminRole);
  };
  const openTab = (
    tab: AdminTab,
    options?: { childLabel?: string; parentTab?: AdminTab }
  ) => {
    const nextTab = tab;

    if (options?.childLabel && options.parentTab) {
      setOrchardModulePages((current) => ({
        ...current,
        [options.parentTab as AdminTab]: options.childLabel as string,
      }));
    }

    if (!canAccessAdminTab(adminRole, nextTab)) {
      setMessage('Access denied for your role.');
      navigate(adminRoutePaths[defaultAllowedTab], { replace: true });
      return;
    }

    navigate(adminRoutePaths[nextTab]);
  };
  const renderPanel = (tab: AdminTab) => {
    if (tab === 'dashboard') {
      return (
        <AdminDashboardPanel
          pendingKycCount={pendingKycCount}
          pendingVerificationCount={pendingVerificationCount}
          approvedKycCount={approvedKycCount}
          approvedVerificationCount={approvedVerificationCount}
          productCount={products.length}
          orderCount={orders.length}
          userCount={users.length}
          onOpenTab={openTab}
        />
      );
    }

    if (tab === 'master') {
      const activeMasterPage = getOrchardModulePage('master');
      if (activeMasterPage === 'Vendors / Parties') return <PartyVendorPanel />;
      if (activeMasterPage === 'Add Raw Material') {
        return <ProductAdminPanel
          draft={{ ...productDraft, inventoryType: 'raw_material', productType: productDraft.productType === 'Plant' ? 'Raw Material' : productDraft.productType }}
          onChange={setProductDraft}
          onSubmit={saveOrchardProduct}
          saving={productSaving}
          uploadAuthHeaders={uploadAuthHeaders}
          editing={Boolean(editingProductId)}
          onCancelEdit={cancelProductEdit}
          modeLabel="Raw Material"
          platform="orchardgrowers"
        />;
      }
      return <OrchardSubOptionPanel module="master" activePage={activeMasterPage} />;
    }

    if (tab === 'inventory') {
      return (
        <InventoryPanel
          products={searchedProducts}
          onUpdateStock={updateProductStock}
          onDeleteProduct={deleteOrchardProduct}
          onOpenTab={openTab}
          activePage={getOrchardModulePage('inventory')}
        />
      );
    }
    if (tab === 'productAdmin') {
      const productModeLabel = getOrchardModulePage('master') === 'Add Raw Material' ? 'Raw Material' : 'Product';
      const productPanelDraft = productModeLabel === 'Raw Material'
        ? { ...productDraft, inventoryType: 'raw_material', productType: productDraft.productType === 'Plant' ? 'Raw Material' : productDraft.productType }
        : { ...productDraft, inventoryType: productDraft.inventoryType || 'finished_product' };
      return (
        <section className="space-y-4">
          <ProductAdminPanel
            draft={productPanelDraft}
            onChange={setProductDraft}
            onSubmit={saveOrchardProduct}
            saving={productSaving}
            uploadAuthHeaders={uploadAuthHeaders}
            editing={Boolean(editingProductId)}
            onCancelEdit={cancelProductEdit}
            modeLabel={productModeLabel}
            platform="orchardgrowers"
          />
          <OrchardProductsTable products={searchedProducts} onEdit={editOrchardProduct} onDelete={deleteOrchardProduct} onViewFile={setViewingFile} />
        </section>
      );
    }
    if (tab === 'billing') {
      return (
        <BillingPanel
          plan={modulePlans.billing}
          orders={orders}
          products={searchedProducts}
          onOpenTab={openTab}
          activePage={getOrchardModulePage('billing')}
        />
      );
    }
    if (tab === 'sales') {
      return (
        <section className="space-y-4">
          <ModulePlanPanel plan={modulePlans.sales} />
          <OrdersPanel orders={orders} />
        </section>
      );
    }
    if (tab === 'unitsOutlets') {
      return <CreateUnitPanel />;
    }
    if (tab === 'purchase') {
      return <PurchaseEntryPanel products={searchedProducts} />;
    }
    if (tab === 'logistics') {
      return <LogisticsControlPanel orders={orders} authHeaders={authHeaders} onUpdated={loadRequests} activePage={getOrchardModulePage('logistics')} />;
    }
    if (tab === 'orchardSettings') {
      return <OrchardSubOptionPanel module="orchardSettings" activePage={getOrchardModulePage('orchardSettings')} />;
    }
    if (tab === 'financials') {
      return <OrchardSubOptionPanel module="financials" activePage={getOrchardModulePage('financials')} />;
    }
    if (['expenses', 'reports'].includes(tab)) {
      return <OrchardSubOptionPanel module={tab as AdminTab} activePage={getOrchardModulePage(tab as AdminTab) || getAdminTabTitle(tab as AdminTab, activePlatform)} />;
    }
    if (tab === 'efruitDashboard') {
      return (
        <section className="space-y-4">
          <HomePanel
            activePlatform="efruitmandi"
            pendingKycCount={pendingKycCount}
            pendingVerificationCount={pendingVerificationCount}
            approvedKycCount={approvedKycCount}
            approvedVerificationCount={approvedVerificationCount}
            productCount={products.length}
            userCount={users.length}
            onOpenTab={openTab}
          />
          <EfruitErpDashboardPanel dashboard={erpData.dashboard} />
        </section>
      );
    }
    if (tab === 'users') {
      return (
        <section className="space-y-4">
          <UsersPanel
            users={searchedUsers}
            onEdit={editUserInfo}
            onStatus={setUserStatus}
            onDelete={normalizeAdminEmail(admin?.email || '') === PROFILE_DELETE_ADMIN_EMAIL ? deleteUserProfile : undefined}
          />
        </section>
      );
    }
    if (tab === 'adminUsers') {
      const activeAdminUsersPage = getOrchardModulePage('adminUsers');
      return (
        <AdminUsersPanel
          apiBase={API_BASE}
          authHeaders={authHeaders}
          activePage={activeAdminUsersPage}
          admins={adminUsers.filter((item) => {
            const search = adminSearch.trim().toLowerCase();
            if (activeAdminUsersPage === 'Approved Admins' && item.status !== 'ACTIVE') return false;
            if (!search) return true;
            return [item.name, item.email, item.phone, item.adminClass, item.role, item.status].some((value) =>
              String(value || '').toLowerCase().includes(search)
            );
          })}
          onCreate={createManagedAdmin}
          onAction={runAdminUserAction}
          onChangeClass={changeManagedAdminClass}
          onView={viewManagedAdminDetails}
        />
      );
    }
    if (tab === 'kyc') {
      return (
        <KycVerificationPanel
          kycRequests={kycRequests}
          onReview={review}
          onUpdate={updateKycInformation}
          onViewFile={setViewingFile}
        />
      );
    }
    if (tab === 'ogVerified') {
      return (
        <OgVerificationPanel
          verificationRequests={verificationRequests}
          onReview={review}
          onEditVerification={editVerificationRequest}
          onViewFile={setViewingFile}
        />
      );
    }
    if (tab === 'produceLots') {
      return (
        <section className="space-y-4">
          <ModulePlanPanel plan={modulePlans.produceLots} />
          <EfruitMandiLotsPanel products={searchedProducts} onViewFile={setViewingFile} />
        </section>
      );
    }
    if (tab === 'mandiCommodities') {
      return (
        <section className="space-y-4">
          <ModulePlanPanel plan={modulePlans.mandiCommodities} />
          <MandiCommodityPanel
            commodities={searchedMandiCommodities}
            onSync={syncMandiCommodities}
            onCreate={createMandiCommodity}
            onUpdate={updateMandiCommodity}
          />
        </section>
      );
    }
    if (tab === 'efruitInvoices') {
      return <EfruitInvoiceChalanPanel orders={orders} />;
    }
    if (tab === 'quotes') {
      return (
        <section className="space-y-4">
          <ModulePlanPanel plan={modulePlans.quotes} />
          <AdminQuotesPanel quotes={quotes} />
        </section>
      );
    }
    if (tab === 'deals') {
      return (
        <section className="space-y-4">
          <ModulePlanPanel plan={modulePlans.deals} />
          <EfruitDealsPanel orders={orders} settlements={erpData.settlements} />
        </section>
      );
    }
    if (tab === 'transactions') {
      return (
        <section className="space-y-4">
          <ModulePlanPanel plan={modulePlans.transactions} />
          <EfruitTransactionsPanel
            payments={erpData.payments}
            settlements={erpData.settlements}
            commissions={erpData.commissions}
            refunds={erpData.refunds}
          />
        </section>
      );
    }
    if (tab === 'supportDisputes') {
      return (
        <section className="space-y-4">
          <ModulePlanPanel plan={modulePlans.supportDisputes} />
          <EfruitSupportDisputesPanel tickets={erpData.tickets} refunds={erpData.refunds} />
        </section>
      );
    }
    if (tab === 'analytics') {
      return (
        <section className="space-y-4">
          <ModulePlanPanel plan={modulePlans.analytics} />
          <EfruitAnalyticsPanel dashboard={erpData.dashboard} />
        </section>
      );
    }
    if (tab === 'efruitSettings') {
      return <ModulePlanPanel plan={modulePlans.efruitSettings} />;
    }
    if (tab === 'staffUsers' || tab === 'customers') return <ModulePlanPanel plan={modulePlans[tab]} />;
    if (tab === 'sellers') {
      return (
        <section className="space-y-4">
          <ModulePlanPanel plan={modulePlans.sellers} />
          <UsersPanel
            title="Sellers / Growers / Farmers"
            badge="Profile, documents, verification, account status"
            emptyLabel="No sellers, growers, or farmers found."
            users={searchedUsers.filter((user) => user.role === 'grower')}
            onEdit={editUserInfo}
            onStatus={setUserStatus}
            onDelete={normalizeAdminEmail(admin?.email || '') === PROFILE_DELETE_ADMIN_EMAIL ? deleteUserProfile : undefined}
          />
        </section>
      );
    }
    if (tab === 'buyers') {
      return (
        <section className="space-y-4">
          <ModulePlanPanel plan={modulePlans.buyers} />
          <UsersPanel
            title="Buyers"
            badge="Profile, offers, deals, payments"
            emptyLabel="No buyers found."
            users={searchedUsers.filter((user) => user.role === 'buyer')}
            onEdit={editUserInfo}
            onStatus={setUserStatus}
            onDelete={normalizeAdminEmail(admin?.email || '') === PROFILE_DELETE_ADMIN_EMAIL ? deleteUserProfile : undefined}
          />
        </section>
      );
    }
    if (tab === 'rolesPermissions') {
      return (
        <section className="space-y-4">
          <ModulePlanPanel plan={modulePlans.rolesPermissions} />
          <RolesPermissionsPanel />
        </section>
      );
    }
    if (tab === 'suspendedUsers') {
      return (
        <section className="space-y-4">
          <ModulePlanPanel plan={modulePlans.suspendedUsers} />
          <UsersPanel
            title="Suspended Users"
            badge="Hold, suspended, terminated"
            emptyLabel="No suspended users found."
            users={searchedUsers.filter((user) => ['HOLD', 'SUSPENDED', 'TERMINATED'].includes(user.accountStatus || ''))}
            onEdit={editUserInfo}
            onStatus={setUserStatus}
            onDelete={normalizeAdminEmail(admin?.email || '') === PROFILE_DELETE_ADMIN_EMAIL ? deleteUserProfile : undefined}
          />
        </section>
      );
    }
    if (tab === 'notifications') {
      return (
        <section className="space-y-4">
          <ModulePlanPanel plan={modulePlans.notifications} />
          <NotificationsPanel
            kycRequests={kycRequests}
            verificationRequests={verificationRequests}
            onOpenTab={openTab}
          />
        </section>
      );
    }
    if (tab === 'systemSettings') return <ModulePlanPanel plan={modulePlans.systemSettings} />;
    if (tab === 'downloadApp') return <ModulePlanPanel plan={modulePlans.downloadApp} />;
    if (tab === 'orchardAiDashboard') {
      return (
        <OrchardAiPlaceholder
          title="Orchard Growers AI Dashboard"
          description="An overview of Orchard Growers AI tools and activity will be available here."
        />
      );
    }
    if (tab === 'businessMail') {
      return <BusinessMail apiBase={API_BASE} authHeaders={authHeaders} />;
    }
    if (tab === 'careerApplications') {
      return <CareerApplications apiBase={API_BASE} authHeaders={authHeaders} />;
    }
    if (tab === 'orchardAiLeadCollection') {
      return (
        <OrchardAiPlaceholder
          title="Lead Collection"
          description="AI-assisted lead capture and collection workflows will be available here."
        />
      );
    }
    if (tab === 'orchardAiLeadDatabase') {
      return (
        <OrchardAiLeadDatabase
          apiBase={API_BASE}
          authHeaders={authHeaders}
          admins={adminUsers}
        />
      );
    }
    if (tab === 'orchardAiCampaignCenter') {
      return (
        <OrchardAiPlaceholder
          title="Campaign Center"
          description="Campaign creation, scheduling, and performance tools will be available here."
        />
      );
    }
    if (tab === 'orchardAiReplyCenter') {
      return (
        <OrchardAiPlaceholder
          title="Reply Center"
          description="AI-assisted reply review and conversation management will be available here."
        />
      );
    }
    return <Navigate to={adminRoutePaths.dashboard} replace />;
  };

  return (
    <div className={`admin-theme-${effectiveTheme} admin-app-frame h-full overflow-hidden bg-slate-950 p-2 text-slate-100`}>
      <InstallAppPrompt />
      <div className="admin-app-shell mx-auto flex h-full min-h-0 max-w-[1360px] flex-col">
        <MarketSnapshotStrip
          announcementRef={announcementBarRef}
          isFullscreen={fullscreenTarget === 'announcement'}
          onFullscreen={toggleAnnouncementFullscreen}
        />
        <section className="admin-top-nav mt-2 grid gap-2 lg:grid-cols-[138px_220px_minmax(0,1fr)]">
          <div className="flex h-11 items-center justify-center gap-1 overflow-hidden rounded-xl bg-transparent px-1">
            <img src={ORCHARD_LOGO_URL} alt="Orchard Growers" className="h-8 max-w-[62px] object-contain" />
            <span className="h-7 w-px bg-slate-700" />
            <img src={LOGO_URL} alt="eFruitMandi" className="h-8 max-w-[62px] object-contain" />
          </div>
          <label className="flex h-11 items-center rounded-full border border-slate-700 bg-slate-900/95 px-4 shadow-sm shadow-black/20">
            <span className="sr-only">Search admin records</span>
            <input
              value={adminSearch}
              onChange={(event) => setAdminSearch(event.target.value)}
              placeholder="Search products, users, orders..."
              className="h-8 w-full bg-transparent text-sm font-semibold text-white outline-none placeholder:text-slate-400"
            />
          </label>
          <div className="flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-700 bg-slate-900/95 px-3 py-1.5 text-sm font-semibold shadow-sm shadow-black/20">
            <span className="text-emerald-300">{activeTitle}</span>
            <span className="truncate text-slate-300">{admin.name} | {getAdminDisplayRole(admin)}</span>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              <ThemeModeControl mode={themeMode} onChange={setThemeMode} />
              <button
                onClick={loadRequests}
                className="admin-refresh-button h-8 rounded-lg bg-white px-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-100"
              >
                {loading ? 'Loading...' : 'Refresh'}
              </button>
              <button
                type="button"
                onClick={openAdminInstallPrompt}
                className="admin-download-button h-8 rounded-lg bg-white px-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-100"
              >
                Download App
              </button>
              <button
                onClick={logout}
                className="admin-logout-button h-8 rounded-lg bg-white px-3 text-sm font-semibold text-slate-950 transition hover:bg-red-100"
              >
                Logout
              </button>
              <button
                type="button"
                onClick={() => setMobileMenuOpen((open) => !open)}
                aria-expanded={mobileMenuOpen}
                aria-controls="mobile-admin-menu"
                className="admin-mobile-menu-button hidden h-8 w-8 items-center justify-center rounded-lg bg-white text-slate-950 transition hover:bg-emerald-100"
              >
                <MenuIcon name="menu" />
              </button>
            </div>
          </div>
        </section>
        {mobileMenuOpen && (
          <MobileAdminMenu
            groups={sidebarGroups}
            activePlatform={activePlatform}
            activeTab={activeTab}
            activePages={orchardModulePages}
            expandedItemKey={expandedSidebarKey}
            onToggleItem={(key) => setExpandedSidebarKey((current) => (current === key ? null : key))}
            onOpenTab={(tab, childLabel, parentTab) => openTab(tab, { childLabel, parentTab })}
            onOpenPlatform={(platform) => openTab(getLastTabForPlatform(platform))}
            onClose={() => setMobileMenuOpen(false)}
          />
        )}

        <section
          className="admin-shell-grid mt-2 grid flex-1 min-h-0 gap-0 overflow-hidden"
          style={{ '--admin-platform-rail-width': `${platformRailWidth}px` } as CSSProperties}
        >
          <PlatformRail
            activePlatform={activePlatform}
            activeTab={activeTab}
            activePages={orchardModulePages}
            groups={sidebarGroups}
            expandedItemKey={expandedSidebarKey}
            onToggleItem={(key) => setExpandedSidebarKey((current) => (current === key ? null : key))}
            onChange={(platform) => {
              openTab(getLastTabForPlatform(platform));
            }}
            onOpenTab={(platform, tab, childLabel, parentTab) => {
              openTab(tab, { childLabel, parentTab });
            }}
          />

          <div
            onMouseDown={(event) =>
              setRailResizeStart({ x: event.clientX, width: platformRailWidth })
            }
            className="admin-resize-handle cursor-col-resize hover:bg-emerald-500 bg-emerald-600/40 transition-all active:bg-emerald-500"
            title="Drag to resize panel (left-right)"
          />

          <div ref={actionPanelRef} className="admin-action-panel min-w-0 h-full overflow-hidden bg-slate-950 flex flex-col min-h-0">
            <AdminButtonTabs
              tabs={actionTabs}
              activeTab={activeTab}
              onChange={openTab}
            />
            <main className="admin-content-scroll flex-1 min-h-0 overflow-y-auto border-x border-slate-700 bg-slate-950 p-4 text-slate-100">
              {activeTab !== 'logistics' && (
                <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
                  <span>{activePlatform === 'orchard' ? 'Orchard Growers' : getAdminTabTitle(getDefaultTabForPlatform(activePlatform, adminRole), activePlatform)}</span>
                  <span>/</span>
                  <span className="text-emerald-300">{activeTitle}</span>
                </div>
              )}
              {message && (
                <p className="mb-4 rounded-lg border border-emerald-600 bg-emerald-950 px-4 py-3 text-sm font-bold text-emerald-100">
                  {message}
                </p>
              )}
              <Routes>
                <Route path="/" element={<Navigate to={adminRoutePaths[defaultAllowedTab]} replace />} />
                {(Object.entries(adminRoutePaths) as [AdminTab, string][]).map(([tab, path]) => (
                  <Route
                    key={tab}
                    path={path}
                    element={
                      canAccessAdminTab(adminRole, tab)
                        ? renderPanel(tab)
                        : <Navigate to={adminRoutePaths[defaultAllowedTab]} replace />
                    }
                  />
                ))}
                <Route path="*" element={<Navigate to={adminRoutePaths[defaultAllowedTab]} replace />} />
              </Routes>
            </main>
            <AdminButtonTabs
              tabs={actionTabs}
              activeTab={activeTab}
              onChange={openTab}
              showFullscreen
              showTabs={false}
              isFullscreen={fullscreenTarget === 'action'}
              onFullscreen={toggleActionPanelFullscreen}
            />
          </div>
        </section>
        {viewingFile && <FilePreviewModal file={viewingFile} authHeaders={authHeaders} onClose={() => setViewingFile(null)} />}
      </div>
    </div>
  );
}

function ThemeModeControl({
  mode,
  onChange,
}: {
  mode: AdminThemeMode;
  onChange: (mode: AdminThemeMode) => void;
}) {
  return (
    <div className="admin-theme-control flex h-9 items-center gap-1 rounded-xl border border-slate-600 bg-slate-950 p-1 shadow-inner shadow-black/30" aria-label="Theme mode">
      {adminThemeModes.map((item) => {
        const selected = mode === item.mode;
        return (
          <button
            key={item.mode}
            type="button"
            onClick={() => onChange(item.mode)}
            aria-pressed={selected}
            title={`${item.label} mode`}
            className={`flex h-7 items-center gap-1.5 rounded-lg px-2 text-xs font-black leading-none transition ${
              selected ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-950/40' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <ThemeModeIcon mode={item.mode} />
            <span className="hidden sm:inline">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function ThemeModeIcon({ mode }: { mode: AdminThemeMode }) {
  if (mode === 'light') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
    );
  }

  if (mode === 'dark') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3 6.5 6.5 0 0 0 21 12.8Z" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3a9 9 0 1 0 0 18V3Z" />
      <path d="M12 3a9 9 0 0 1 0 18" />
    </svg>
  );
}

function MarketSnapshotStrip({
  announcementRef,
  isFullscreen,
  onFullscreen,
}: {
  announcementRef: RefObject<HTMLElement>;
  isFullscreen: boolean;
  onFullscreen: () => void;
}) {
  const announcementItems = [...marketSnapshotCards, ...marketSnapshotCards];

  return (
    <section
      ref={announcementRef}
      className="admin-announcement-shell relative overflow-hidden rounded-xl border border-slate-700 bg-slate-900 pr-12 shadow-sm shadow-black/20"
      aria-label="Admin announcements"
    >
      <div className="admin-mobile-announcement-text hidden items-center gap-2 py-2 pl-3 pr-12 text-xs font-semibold text-slate-200">
        <span className="shrink-0 text-white">{marketSnapshotCards[0].title}</span>
        <span className="text-slate-500">|</span>
        <span className="truncate text-emerald-300">{marketSnapshotCards[0].text}</span>
      </div>
      <div className="admin-announcement-track flex w-max items-center gap-4 py-2">
        {announcementItems.map((card, index) => (
          <article
            key={`${card.title}-${index}`}
            className="flex h-9 shrink-0 items-center gap-2 rounded-full border border-slate-700 bg-slate-950 px-4 text-xs font-semibold text-slate-200"
          >
            <span className="text-white">{card.title}</span>
            <span className="text-slate-500">|</span>
            <span className="text-emerald-300">{card.text}</span>
          </article>
        ))}
      </div>
      <button
        type="button"
        onClick={onFullscreen}
        aria-label={isFullscreen ? 'Exit announcement full screen' : 'Open announcement full screen'}
        title={isFullscreen ? 'Exit announcement full screen' : 'Announcement full screen'}
        className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md bg-white text-slate-950 shadow-lg shadow-black/30 transition hover:bg-emerald-100"
      >
        <FullscreenIcon active={isFullscreen} />
      </button>
    </section>
  );
}

function getSidebarGroups(counts: Partial<Record<AdminTab, number>>, onLogout: () => void, role: AdminRole): SidebarGroup[] {
  const groups: SidebarGroup[] = [
    {
      platform: 'orchard',
      title: 'Orchard Growers',
      subtitle: 'ERP inventory and billing',
      items: [
        { label: 'Dashboard', icon: 'dashboard', tab: 'dashboard' },
        {
          label: 'Master',
          icon: 'inventory',
          tab: 'master',
          children: [
            { label: 'Add Product', tab: 'productAdmin' },
            { label: 'Add Raw Material', tab: 'productAdmin' },
            { label: 'Units / Outlets', tab: 'unitsOutlets' },
            { label: 'Vendors / Parties', tab: 'master' },
            { label: 'Categories', tab: 'master' },
          ],
        },
        {
          label: 'Inventory',
          icon: 'inventory',
          tab: 'inventory',
          children: [
            { label: 'Production Update', tab: 'inventory' },
            { label: 'Purchase Entry', tab: 'purchase' },
            { label: 'Current Stock', tab: 'inventory' },
            { label: 'Stock Transfer', tab: 'inventory' },
            { label: 'Damaged / Dead Stock', tab: 'inventory' },
            { label: 'Low Stock Alert', tab: 'inventory' },
          ],
        },
        {
          label: 'Billing',
          icon: 'sales',
          tab: 'billing',
          children: [
            { label: 'New Invoice', tab: 'billing' },
            { label: 'Sales History', tab: 'sales' },
            { label: 'Returns / Refunds', tab: 'billing' },
          ],
        },
        {
          label: 'Logistics Control',
          icon: 'purchase',
          tab: 'logistics',
          count: counts.logistics,
          children: logisticsPlatformPages.map((platform) => ({ label: platform, tab: 'logistics' as AdminTab })),
        },
        {
          label: 'Financials',
          icon: 'financials',
          tab: 'financials',
          children: [
            { label: 'Expenses', tab: 'expenses' },
            { label: 'GST Summary', tab: 'financials' },
            { label: 'Sales Pattern', tab: 'reports' },
            { label: 'Evaluations', tab: 'financials' },
            { label: 'Profit / Loss', tab: 'financials' },
            { label: 'Cash Flow', tab: 'financials' },
            { label: 'Payment Collection', tab: 'financials' },
            { label: 'Outstanding Dues', tab: 'financials' },
            { label: 'Stock Valuation', tab: 'reports' },
            { label: 'Unit-wise Performance', tab: 'reports' },
            { label: 'Low Stock Report', tab: 'reports' },
            { label: 'Reports', tab: 'reports' },
          ],
        },
        {
          label: 'Settings',
          icon: 'settings',
          tab: 'orchardSettings',
          children: [
            { label: 'Invoice Series', tab: 'orchardSettings' },
            { label: 'Stock Sync', tab: 'orchardSettings' },
            { label: 'GST Defaults', tab: 'orchardSettings' },
            { label: 'Low Stock Thresholds', tab: 'orchardSettings' },
          ],
        },
      ],
    },
    {
      platform: 'orchardAi',
      title: 'Orchard Growers AI',
      subtitle: 'AI leads and campaigns',
      items: [
        { label: 'Dashboard', icon: 'dashboard', tab: 'orchardAiDashboard' },
        { label: 'Lead Collection', icon: 'plus', tab: 'orchardAiLeadCollection' },
        { label: 'Lead Database', icon: 'users', tab: 'orchardAiLeadDatabase' },
        { label: 'Campaign Center', icon: 'chart', tab: 'orchardAiCampaignCenter' },
        { label: 'Reply Center', icon: 'quotes', tab: 'orchardAiReplyCenter' },
      ],
    },
    {
      platform: 'efruitmandi',
      title: 'eFruitMandi',
      subtitle: 'Marketplace control',
      items: [
        { label: 'Dashboard', icon: 'dashboard', tab: 'efruitDashboard' },
        { label: 'Users', icon: 'users', tab: 'users' },
        { label: 'KYC Verification', icon: 'verify', tab: 'kyc' },
        { label: 'OG Verified', icon: 'verify', tab: 'ogVerified', count: counts.ogVerified },
        { label: 'Produce Lots', icon: 'lot', tab: 'produceLots' },
        { label: 'Offers', icon: 'quotes', tab: 'quotes' },
        { label: 'Deals', icon: 'deal', tab: 'deals' },
        { label: 'Invoices / Chalan', icon: 'sales', tab: 'efruitInvoices' },
        { label: 'Transactions', icon: 'transaction', tab: 'transactions' },
        { label: 'Support & Disputes', icon: 'support', tab: 'supportDisputes' },
        { label: 'Analytics', icon: 'chart', tab: 'analytics' },
        { label: 'Settings', icon: 'settings', tab: 'efruitSettings' },
      ],
    },
    {
      platform: 'userManagement',
      title: 'User Management',
      subtitle: 'Accounts and access',
      items: [
        { label: 'Staff Users', icon: 'users', tab: 'staffUsers' },
        {
          label: 'Admin Users',
          icon: 'roles',
          tab: 'adminUsers',
          count: counts.adminUsers,
          children: [
            { label: 'Create Admin', tab: 'adminUsers' },
            { label: 'Approved Admins', tab: 'adminUsers', count: counts.adminUsers },
          ],
        },
        { label: 'Customers', icon: 'users', tab: 'customers' },
        { label: 'Sellers / Growers / Farmers', icon: 'users', tab: 'sellers' },
        { label: 'Buyers', icon: 'users', tab: 'buyers' },
        { label: 'Roles & Permissions', icon: 'roles', tab: 'rolesPermissions' },
        { label: 'Suspended Users', icon: 'verify', tab: 'suspendedUsers' },
      ],
    },
    {
      platform: 'notifications',
      title: 'Notifications',
      subtitle: 'Alerts and updates',
      items: [{ label: 'Notifications', icon: 'notification', tab: 'notifications', count: counts.notifications }],
    },
    {
      platform: 'businessMail',
      title: 'Business Mail',
      subtitle: 'Compose, delivery and applicants',
      items: [
        { label: 'Business Mail', icon: 'notification', tab: 'businessMail' },
        { label: 'Career Applications', icon: 'verify', tab: 'careerApplications' },
      ],
    },
    {
      platform: 'system',
      title: 'System Settings',
      subtitle: 'Global settings',
      items: [{ label: 'System Settings', icon: 'settings', tab: 'systemSettings' }],
    },
    {
      platform: 'download',
      title: 'Download App',
      subtitle: 'App releases',
      items: [{ label: 'Download App', icon: 'download', tab: 'downloadApp' }],
    },
    {
      platform: 'logout',
      title: 'Logout',
      subtitle: 'End session',
      action: onLogout,
      items: [{ label: 'Logout', icon: 'logout', action: onLogout }],
    },
  ];

  return groups
    .map((group) => ({
      ...group,
      items: group.action
        ? group.items
        : group.items.filter((item) => !item.tab || canAccessAdminTab(role, item.tab)),
    }))
    .filter((group) => group.action || group.items.length > 0);
}

function isSidebarChildActive(
  item: SidebarMenuItem,
  child: SidebarSubItem,
  activeTab: AdminTab,
  activePages: OrchardModulePages
) {
  if (!child.tab) return false;
  if (child.tab !== activeTab) return false;

  if (item.tab && child.tab === item.tab) {
    const activePage = activePages[item.tab] || defaultOrchardModulePages[item.tab];
    return activePage === child.label;
  }

  return Boolean(item.tab && activePages[item.tab] === child.label);
}

function getSidebarItemKey(group: SidebarGroup, item: SidebarMenuItem) {
  return `${group.platform}:${item.label}`;
}

type MenuIconName =
  | 'menu'
  | 'dashboard'
  | 'plus'
  | 'purchase'
  | 'sales'
  | 'financials'
  | 'settings'
  | 'logout'
  | 'verify'
  | 'chart'
  | 'pattern'
  | 'quotes'
  | 'transaction'
  | 'inventory'
  | 'users'
  | 'outlet'
  | 'expense'
  | 'report'
  | 'lot'
  | 'deal'
  | 'support'
  | 'notification'
  | 'roles'
  | 'download';

function PlatformRail({
  activePlatform,
  activeTab,
  activePages,
  groups,
  expandedItemKey,
  onChange,
  onOpenTab,
  onToggleItem,
}: {
  activePlatform: AdminPlatform;
  activeTab: AdminTab;
  activePages: OrchardModulePages;
  groups: SidebarGroup[];
  expandedItemKey: string | null;
  onChange: (platform: AdminPlatform) => void;
  onOpenTab: (platform: AdminPlatform, tab: AdminTab, childLabel?: string, parentTab?: AdminTab) => void;
  onToggleItem: (key: string) => void;
}) {
  return (
    <aside className="admin-platform-scroll h-full overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/40 p-2">
      <div className="flex h-full flex-col gap-2">
        {groups.map((group) => (
          <div
            key={group.title}
            className={`rounded-lg border px-2 py-3 ${
              activePlatform === group.platform
                ? 'border-emerald-500 bg-emerald-950 text-emerald-100'
                : 'border-slate-700 bg-slate-900 text-slate-200'
            }`}
          >
            <button type="button" onClick={() => (group.action ? group.action() : onChange(group.platform))} className="w-full text-left">
              <span className="block text-base font-semibold whitespace-nowrap overflow-hidden text-ellipsis">{group.title}</span>
              <span className="mt-1 block text-xs font-medium text-slate-400 whitespace-nowrap overflow-hidden text-ellipsis">{group.subtitle}</span>
            </button>
            <div className="mt-3 space-y-1">
              {group.items.map((item) => {
                const itemKey = getSidebarItemKey(group, item);
                const hasChildren = Boolean(item.children?.length);
                const childSelected = item.children?.some((child) => isSidebarChildActive(item, child, activeTab, activePages)) || false;
                const expanded = hasChildren && (expandedItemKey === itemKey || childSelected);
                const selected = Boolean(item.tab && (activeTab === item.tab || childSelected || expanded));
                return (
                  <div key={item.label}>
                    <button
                      type="button"
                      onClick={() => {
                        if (item.action) item.action();
                        else if (hasChildren) onToggleItem(itemKey);
                        else if (item.tab) onOpenTab(group.platform, item.tab);
                      }}
                      aria-expanded={hasChildren ? expanded : undefined}
                      className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs font-bold transition ${
                        selected ? 'bg-emerald-600 text-white' : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <MenuIcon name={item.icon} />
                      <span>
                        {item.label}
                        {typeof item.count === 'number' && ` (${item.count})`}
                      </span>
                    </button>
                    {expanded && (
                      <div className="mt-1 space-y-1 pl-5">
                        {item.children?.map((child) => {
                          const childActive = isSidebarChildActive(item, child, activeTab, activePages);
                          return (
                            <button
                              key={child.label}
                              type="button"
                              onClick={() => (child.action ? child.action() : child.tab && onOpenTab(group.platform, child.tab, child.label, item.tab))}
                              disabled={!child.tab && !child.action}
                              className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] font-bold transition ${
                                childActive ? 'bg-emerald-700 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:text-slate-500'
                              }`}
                            >
                              <span className="text-emerald-300">.</span>
                              <span className="min-w-0 truncate">{child.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

function MobileAdminMenu({
  groups,
  activePlatform,
  activeTab,
  activePages,
  expandedItemKey,
  onOpenTab,
  onOpenPlatform,
  onToggleItem,
  onClose,
}: {
  groups: SidebarGroup[];
  activePlatform: AdminPlatform;
  activeTab: AdminTab;
  activePages: OrchardModulePages;
  expandedItemKey: string | null;
  onOpenTab: (tab: AdminTab, childLabel?: string, parentTab?: AdminTab) => void;
  onOpenPlatform: (platform: AdminPlatform) => void;
  onToggleItem: (key: string) => void;
  onClose: () => void;
}) {
  const runAction = (action: () => void) => {
    action();
    onClose();
  };

  const selectTab = (tab: AdminTab, childLabel?: string, parentTab?: AdminTab) => {
    onOpenTab(tab, childLabel, parentTab);
    onClose();
  };

  const selectPlatform = (platform: AdminPlatform) => {
    onOpenPlatform(platform);
    onClose();
  };

  return (
    <>
      <button
        type="button"
        aria-label="Close admin menu"
        className="admin-mobile-menu-backdrop fixed inset-0 z-30 bg-slate-950/70 backdrop-blur-sm lg:hidden"
        onClick={onClose}
      />
      <div id="mobile-admin-menu" className="admin-mobile-menu fixed z-40 lg:hidden">
      <div className="mb-2 flex items-center justify-between gap-3 border-b border-slate-800 pb-2">
        <span className="text-sm font-black text-white">Admin Menu</span>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-800 text-slate-100 hover:bg-slate-700"
          aria-label="Close menu"
        >
          x
        </button>
      </div>
      <div className="space-y-2">
        {groups.map((group) => (
          <section
            key={group.title}
            className={`rounded-lg border px-2 py-2 ${
              activePlatform === group.platform
                ? 'border-emerald-500 bg-emerald-950 text-emerald-100'
                : 'border-slate-700 bg-slate-900 text-slate-200'
            }`}
          >
            <button
              type="button"
              onClick={() => (group.action ? runAction(group.action) : selectPlatform(group.platform))}
              className="flex w-full items-center justify-between gap-2 text-left"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold">{group.title}</span>
                <span className="mt-0.5 block truncate text-[11px] font-semibold text-slate-400">{group.subtitle}</span>
              </span>
              <MenuIcon name={group.items[0]?.icon || 'dashboard'} />
            </button>
            <div className="mt-2 grid grid-cols-2 gap-1">
              {group.items.map((item) => {
                const itemKey = getSidebarItemKey(group, item);
                const hasChildren = Boolean(item.children?.length);
                const childSelected = item.children?.some((child) => isSidebarChildActive(item, child, activeTab, activePages)) || false;
                const expanded = hasChildren && (expandedItemKey === itemKey || childSelected);
                const selected = Boolean(item.tab && (activeTab === item.tab || childSelected || expanded));
                return (
                  <div key={item.label} className={expanded ? 'col-span-2' : ''}>
                    <button
                      type="button"
                      onClick={() => {
                        if (item.action) runAction(item.action);
                        else if (hasChildren) onToggleItem(itemKey);
                        else if (item.tab) selectTab(item.tab);
                      }}
                      aria-expanded={hasChildren ? expanded : undefined}
                      className={`flex min-h-10 w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[11px] font-bold transition ${
                        selected ? 'bg-emerald-600 text-white' : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <MenuIcon name={item.icon} />
                      <span className="min-w-0 truncate">
                        {item.label}
                        {typeof item.count === 'number' && ` (${item.count})`}
                      </span>
                    </button>
                    {expanded && (
                      <div className="mt-1 grid grid-cols-2 gap-1 pl-4">
                        {item.children?.map((child) => {
                          const childActive = isSidebarChildActive(item, child, activeTab, activePages);
                          return (
                            <button
                              key={child.label}
                              type="button"
                              onClick={() => {
                                if (child.action) runAction(child.action);
                                else if (child.tab) selectTab(child.tab, child.label, item.tab);
                              }}
                              disabled={!child.tab && !child.action}
                              className={`flex min-h-8 items-center gap-1 rounded-md px-2 py-1.5 text-left text-[10px] font-bold transition ${
                                childActive ? 'bg-emerald-700 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:text-slate-500'
                              }`}
                            >
                              <span className="text-emerald-300">.</span>
                              <span className="min-w-0 truncate">{child.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      </div>
    </>
  );
}

function MenuIcon({ name }: { name: MenuIconName }) {
  const paths: Record<MenuIconName, ReactNode> = {
    menu: (
      <>
        <path d="M4 6h16" />
        <path d="M4 12h16" />
        <path d="M4 18h16" />
      </>
    ),
    dashboard: (
      <>
        <path d="M3 13h8V3H3v10Z" />
        <path d="M13 21h8V11h-8v10Z" />
        <path d="M13 3v6h8V3h-8Z" />
        <path d="M3 21h8v-6H3v6Z" />
      </>
    ),
    plus: (
      <>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </>
    ),
    purchase: (
      <>
        <path d="M6 6h15l-2 8H8L6 6Z" />
        <path d="M6 6 5 3H2" />
        <path d="M9 20h.01" />
        <path d="M18 20h.01" />
      </>
    ),
    sales: (
      <>
        <path d="M4 19V5" />
        <path d="M4 19h16" />
        <path d="m7 15 4-4 3 3 5-7" />
      </>
    ),
    financials: (
      <>
        <path d="M12 2v20" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6" />
      </>
    ),
    settings: (
      <>
        <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.04.04a2 2 0 0 1-2.83 2.83l-.04-.04a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56V21a2 2 0 0 1-4 0v-.08a1.7 1.7 0 0 0-1.04-1.56 1.7 1.7 0 0 0-1.87.34l-.04.04a2 2 0 0 1-2.83-2.83l.04-.04A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.04H3a2 2 0 0 1 0-4h.08A1.7 1.7 0 0 0 4.6 8.96a1.7 1.7 0 0 0-.34-1.87l-.04-.04a2 2 0 1 1 2.83-2.83l.04.04a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1-1.56V3a2 2 0 0 1 4 0v.08a1.7 1.7 0 0 0 1.04 1.56 1.7 1.7 0 0 0 1.87-.34l.04-.04a2 2 0 1 1 2.83 2.83l-.04.04A1.7 1.7 0 0 0 19.4 9c.37.16.78.25 1.2.25H21a2 2 0 0 1 0 4h-.08A1.7 1.7 0 0 0 19.4 15Z" />
      </>
    ),
    logout: (
      <>
        <path d="M10 17l5-5-5-5" />
        <path d="M15 12H3" />
        <path d="M21 3v18" />
      </>
    ),
    verify: (
      <>
        <path d="M9 12l2 2 4-5" />
        <path d="M21 12a9 9 0 1 1-6.2-8.56" />
      </>
    ),
    chart: (
      <>
        <path d="M4 19V5" />
        <path d="M4 19h16" />
        <path d="M8 16v-5" />
        <path d="M12 16V8" />
        <path d="M16 16v-3" />
      </>
    ),
    pattern: (
      <>
        <path d="M4 17c3-8 5 0 8-8s5 0 8-5" />
        <path d="M4 21h16" />
      </>
    ),
    quotes: (
      <>
        <path d="M4 5h16v10H7l-3 3V5Z" />
        <path d="M8 9h8" />
        <path d="M8 12h5" />
      </>
    ),
    transaction: (
      <>
        <path d="M7 7h13l-3-3" />
        <path d="M17 17H4l3 3" />
        <path d="M12 8v8" />
        <path d="M9.5 10.5c0-1.1 1-1.8 2.5-1.8s2.5.7 2.5 1.8S13.5 12 12 12s-2.5.4-2.5 1.5 1 1.8 2.5 1.8 2.5-.7 2.5-1.8" />
      </>
    ),
    inventory: (
      <>
        <path d="M3 7l9-4 9 4-9 4-9-4Z" />
        <path d="M3 7v10l9 4 9-4V7" />
        <path d="M12 11v10" />
      </>
    ),
    users: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    outlet: (
      <>
        <path d="M4 10h16" />
        <path d="M5 10l1-6h12l1 6" />
        <path d="M6 10v10h12V10" />
        <path d="M9 20v-6h6v6" />
      </>
    ),
    expense: (
      <>
        <path d="M7 3h10v18H7V3Z" />
        <path d="M9 7h6" />
        <path d="M9 11h6" />
        <path d="M9 15h3" />
      </>
    ),
    report: (
      <>
        <path d="M6 3h9l3 3v15H6V3Z" />
        <path d="M14 3v4h4" />
        <path d="M9 13h6" />
        <path d="M9 17h6" />
      </>
    ),
    lot: (
      <>
        <path d="M4 17c4-10 12-10 16 0" />
        <path d="M12 7v10" />
        <path d="M8 11c2 1 6 1 8 0" />
      </>
    ),
    deal: (
      <>
        <path d="M7 11l3 3 7-7" />
        <path d="M21 12a9 9 0 1 1-4-7.5" />
      </>
    ),
    support: (
      <>
        <path d="M12 18h.01" />
        <path d="M9.09 9a3 3 0 1 1 5.82 1c0 2-3 2-3 4" />
        <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </>
    ),
    notification: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </>
    ),
    roles: (
      <>
        <path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4Z" />
        <path d="M9 12l2 2 4-5" />
      </>
    ),
    download: (
      <>
        <path d="M12 3v12" />
        <path d="m7 10 5 5 5-5" />
        <path d="M5 21h14" />
      </>
    ),
  };

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}

function AdminButtonTabs({
  tabs,
  activeTab,
  onChange,
  showFullscreen = false,
  showTabs = true,
  isFullscreen = false,
  onFullscreen,
}: {
  tabs: { id: AdminTab; label: string; count?: number }[];
  activeTab: AdminTab;
  onChange: (tab: AdminTab) => void;
  showFullscreen?: boolean;
  showTabs?: boolean;
  isFullscreen?: boolean;
  onFullscreen?: () => void;
}) {
  return (
    <nav className="admin-button-tabs flex-shrink-0 flex items-center gap-1 overflow-x-auto border border-slate-700 bg-slate-900 px-2 py-1">
      {showTabs && (
        <>
          <span className="shrink-0 px-2 text-sm font-semibold text-slate-300">Panel Actions</span>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-bold transition ${
                activeTab === tab.id
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
              }`}
            >
              {tab.label}
              {typeof tab.count === 'number' && <span className="ml-1 text-xs">({tab.count})</span>}
            </button>
          ))}
        </>
      )}
      {showFullscreen && (
        <button
          type="button"
          onClick={onFullscreen}
          aria-label={isFullscreen ? 'Exit full screen' : 'Enter full screen'}
          title={isFullscreen ? 'Exit action panel full screen' : 'Action panel full screen'}
          className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white text-slate-950 transition hover:bg-emerald-100"
        >
          <FullscreenIcon active={isFullscreen} />
        </button>
      )}
    </nav>
  );
}

function FullscreenIcon({ active }: { active: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      {active ? (
        <>
          <path d="M9 3v6H3" />
          <path d="M15 3v6h6" />
          <path d="M9 21v-6H3" />
          <path d="M15 21v-6h6" />
        </>
      ) : (
        <>
          <path d="M3 9V3h6" />
          <path d="M21 9V3h-6" />
          <path d="M3 15v6h6" />
          <path d="M21 15v6h-6" />
        </>
      )}
    </svg>
  );
}

function getAdminTabTitle(activeTab: AdminTab, activePlatform: AdminPlatform) {
  if (activeTab === 'dashboard') return 'Admin Dashboard';
  if (activeTab === 'master') return 'Orchard Growers Master';
  if (activeTab === 'inventory') return 'Orchard Growers Inventory';
  if (activeTab === 'productAdmin') return 'Product Master';
  if (activeTab === 'purchase') return 'Purchase Entry';
  if (activeTab === 'billing') return 'Orchard Growers Billing';
  if (activeTab === 'sales') return 'Sales History';
  if (activeTab === 'logistics') return 'Logistics Control';
  if (activeTab === 'unitsOutlets') return 'Orchard Growers Units / Outlets';
  if (activeTab === 'expenses') return 'Orchard Growers Expenses';
  if (activeTab === 'financials') return 'Orchard Growers Financials';
  if (activeTab === 'reports') return 'Orchard Growers Reports';
  if (activeTab === 'orchardSettings') return 'Orchard Growers Settings';
  if (activeTab === 'orchardAiDashboard') return 'Orchard Growers AI Dashboard';
  if (activeTab === 'orchardAiLeadCollection') return 'Orchard Growers AI Lead Collection';
  if (activeTab === 'orchardAiLeadDatabase') return 'Orchard Growers AI Lead Database';
  if (activeTab === 'orchardAiCampaignCenter') return 'Orchard Growers AI Campaign Center';
  if (activeTab === 'orchardAiReplyCenter') return 'Orchard Growers AI Reply Center';
  if (activeTab === 'efruitDashboard') return 'eFruitMandi Dashboard';
  if (activeTab === 'users') return 'eFruitMandi Users';
  if (activeTab === 'notifications') return 'Admin Notifications';
  if (activeTab === 'businessMail') return 'Business Mail';
  if (activeTab === 'careerApplications') return 'Career Applications';
  if (activeTab === 'kyc') return 'eFruitMandi KYC Verification';
  if (activeTab === 'ogVerified') return 'eFruitMandi OG Verification';
  if (activeTab === 'produceLots') return 'eFruitMandi Produce Lots';
  if (activeTab === 'quotes') return 'eFruitMandi Offers';
  if (activeTab === 'deals') return 'eFruitMandi Deals';
  if (activeTab === 'transactions') return 'eFruitMandi Transactions';
  if (activeTab === 'supportDisputes') return 'eFruitMandi Support & Disputes';
  if (activeTab === 'analytics') return 'eFruitMandi Analytics';
  if (activeTab === 'efruitSettings') return 'eFruitMandi Settings';
  if (activeTab === 'staffUsers') return 'Staff Users';
  if (activeTab === 'adminUsers') return 'Admin Users / Admin Management';
  if (activeTab === 'customers') return 'Customers';
  if (activeTab === 'sellers') return 'Sellers / Growers / Farmers';
  if (activeTab === 'buyers') return 'Buyers';
  if (activeTab === 'rolesPermissions') return 'Roles & Permissions';
  if (activeTab === 'suspendedUsers') return 'Suspended Users';
  if (activeTab === 'systemSettings') return 'System Settings';
  if (activeTab === 'downloadApp') return 'Download App';
  return activePlatform === 'orchard' ? 'Orchard Growers Admin Command' : 'Admin Command';
}

function AdminDashboardPanel({
  pendingKycCount,
  pendingVerificationCount,
  approvedKycCount,
  approvedVerificationCount,
  productCount,
  orderCount,
  userCount,
  onOpenTab,
}: {
  pendingKycCount: number;
  pendingVerificationCount: number;
  approvedKycCount: number;
  approvedVerificationCount: number;
  productCount: number;
  orderCount: number;
  userCount: number;
  onOpenTab: (tab: AdminTab) => void;
}) {
  const cards = [
    { label: 'Orchard Products', value: productCount, action: 'Open Inventory', tab: 'inventory' as const },
    { label: 'Sales & Invoice', value: orderCount, action: 'Open Sales', tab: 'sales' as const },
    { label: 'eFruitMandi Users', value: userCount, action: 'Open Users', tab: 'users' as const },
    { label: 'Review Queue', value: pendingKycCount + pendingVerificationCount, action: 'Open OG Verification', tab: 'ogVerified' as const },
  ];

  return (
    <section className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <button
            key={card.label}
            onClick={() => onOpenTab(card.tab)}
            className="rounded-2xl border border-slate-800 bg-slate-900 p-5 text-left hover:border-emerald-500"
          >
            <p className="text-sm font-bold text-slate-400">{card.label}</p>
            <p className="mt-3 text-3xl font-black text-white">{card.value}</p>
            <p className="mt-4 text-sm font-bold text-emerald-300">{card.action}</p>
          </button>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <MetricCard label="Approved KYC" value={approvedKycCount} />
        <MetricCard label="Approved Verifications" value={approvedVerificationCount} />
      </div>
    </section>
  );
}

function ModulePlanPanel({ plan }: { plan?: ModulePlan }) {
  const safePlan = plan || {
    title: 'Module',
    text: 'Admin workflow controls will appear here as this module is expanded.',
  };

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <h2 className="text-lg font-bold text-white">{safePlan.title}</h2>
      <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-400">{safePlan.text}</p>
      {safePlan.pages?.length ? (
        <PlanList title="Pages" items={safePlan.pages} />
      ) : null}
      {safePlan.fields?.length ? (
        <PlanList title="Fields / Statuses" items={safePlan.fields} />
      ) : null}
      {safePlan.rules?.length ? (
        <PlanList title="Business Logic" items={safePlan.rules} />
      ) : null}
      {!safePlan.pages?.length && !safePlan.fields?.length && !safePlan.rules?.length && (
        <div className="mt-5 rounded-xl border border-dashed border-slate-700 bg-slate-950 p-5 text-sm font-semibold text-slate-500">
          Admin workflow controls will appear here as this module is expanded.
        </div>
      )}
    </section>
  );
}

function PlanList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mt-5 rounded-xl border border-dashed border-slate-700 bg-slate-950 p-4">
      <p className="text-sm font-black text-white">{title}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map((item) => (
          <span key={item} className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-slate-300">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

const subOptionVisuals: Record<string, { title: string; text: string; metrics: string[]; actions: string[] }> = {
  'Vendors / Parties': {
    title: 'Vendors / Parties',
    text: 'Maintain nursery vendors, transport vendors, local suppliers, and purchase parties used in Orchard Growers procurement.',
    metrics: ['Party Ledger', 'GST Details', 'Payment Terms', 'Purchase Link'],
    actions: ['Add Party', 'Verify GST', 'Map Products', 'Export Ledger'],
  },
  Categories: {
    title: 'Categories',
    text: 'Manage product, seasonal, plant, tools, manure, and orchard input categories used by storefront filters.',
    metrics: ['Product Tree', 'SEO Slug', 'Display Order', 'Active Status'],
    actions: ['Add Category', 'Set Parent', 'Sync Storefront', 'Review Filters'],
  },
  'Production Update': {
    title: 'Production Update',
    text: 'Record nursery production batches and push available quantity into aggregated stock after internal approval.',
    metrics: ['Batch No.', 'Unit', 'Quantity', 'Ready Date'],
    actions: ['Create Batch', 'Approve Stock', 'Attach Photos', 'Sync Inventory'],
  },
  'Purchase Entry': {
    title: 'Purchase Entry',
    text: 'Enter third-party purchase invoices, transport cost, GST values, and stock receipt details.',
    metrics: ['Vendor', 'Invoice', 'GST', 'Stock In'],
    actions: ['New Purchase', 'Upload Bill', 'Add Rows', 'Post Stock'],
  },
  'Stock Transfer': {
    title: 'Stock Transfer',
    text: 'Move stock between units, outlets, and online stock pools with dispatch and receiving confirmation.',
    metrics: ['From Unit', 'To Unit', 'In Transit', 'Received'],
    actions: ['Create Transfer', 'Dispatch', 'Receive', 'Audit'],
  },
  'Damaged / Dead Stock': {
    title: 'Damaged / Dead Stock',
    text: 'Write off damaged, dead, expired, or unsellable stock with reason, photo proof, and approval trail.',
    metrics: ['Product', 'Quantity', 'Reason', 'Approval'],
    actions: ['Report Damage', 'Upload Photo', 'Approve Writeoff', 'Update Stock'],
  },
  'Low Stock Alert': {
    title: 'Low Stock Alert',
    text: 'Monitor products below threshold and trigger purchase or production tasks before storefront stockouts.',
    metrics: ['Threshold', 'Current Qty', 'Reorder Qty', 'Priority'],
    actions: ['Set Threshold', 'Create Purchase', 'Notify Team', 'Export List'],
  },
  'Returns / Refunds': {
    title: 'Returns / Refunds',
    text: 'Review customer returns, replacement requests, refund approval, and stock reversal workflow.',
    metrics: ['Return ID', 'Reason', 'Refund Mode', 'Stock Impact'],
    actions: ['Create Return', 'Approve Refund', 'Issue Credit', 'Restock'],
  },
  'GST Summary': {
    title: 'GST Summary',
    text: 'View CGST, SGST, taxable sales, input purchases, and return-ready tax summaries.',
    metrics: ['Taxable Value', 'CGST', 'SGST', 'Input Credit'],
    actions: ['Generate Summary', 'Check HSN', 'Export CSV', 'Lock Period'],
  },
  'Invoice Series': {
    title: 'Invoice Series',
    text: 'Configure Orchard Growers invoice prefix, financial year sequence, and next invoice number.',
    metrics: ['Prefix', 'FY', 'Next No.', 'Status'],
    actions: ['Update Prefix', 'Preview Invoice', 'Lock Series', 'Audit Changes'],
  },
  'Stock Sync': {
    title: 'Stock Sync',
    text: 'Control online storefront quantity sync, offline deductions, and marketplace stock visibility.',
    metrics: ['Last Sync', 'Pending Sync', 'Failed Items', 'Storefront'],
    actions: ['Run Sync', 'Retry Failed', 'Pause Sync', 'View Log'],
  },
  'GST Defaults': {
    title: 'GST Defaults',
    text: 'Set default HSN, GST, CGST, and SGST values for plant, tool, manure, and input categories.',
    metrics: ['Category', 'HSN', 'GST Rate', 'Verification'],
    actions: ['Add Default', 'Verify HSN', 'Apply to Products', 'Export Rules'],
  },
  'Low Stock Thresholds': {
    title: 'Low Stock Thresholds',
    text: 'Set reorder levels per category and unit so low stock alerts remain actionable.',
    metrics: ['Category', 'Unit', 'Minimum Qty', 'Alert Owner'],
    actions: ['Set Threshold', 'Assign Owner', 'Notify', 'Review'],
  },
};

function OrchardSubOptionPanel({ module, activePage }: { module: AdminTab; activePage: string }) {
  const plan = modulePlans[module];
  const visual = subOptionVisuals[activePage] || {
    title: activePage || plan?.title || 'Workflow',
    text: plan?.text || 'Operational controls for this admin workflow.',
    metrics: plan?.fields?.slice(0, 4) || ['Status', 'Owner', 'Records', 'Action'],
    actions: plan?.pages?.slice(0, 4) || ['Create', 'Review', 'Approve', 'Export'],
  };

  return (
    <section className="space-y-4">
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-emerald-300">{plan?.title || getAdminTabTitle(module, 'orchard')}</p>
            <h2 className="mt-1 text-xl font-black text-white">{visual.title}</h2>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-400">{visual.text}</p>
          </div>
          <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-bold text-emerald-300">Action Panel</span>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          {visual.metrics.map((metric, index) => (
            <div key={metric} className="rounded-xl border border-slate-800 bg-slate-950 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">{metric}</p>
              <p className="mt-2 text-2xl font-black text-white">{index === 0 ? 'Ready' : index === 1 ? '0' : index === 2 ? 'Live' : 'Open'}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <p className="text-sm font-black text-white">Workflow Board</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {['Draft', 'Review', 'Approved', 'Synced'].map((status) => (
                <div key={status} className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm font-bold text-slate-300">
                  {status}
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <p className="text-sm font-black text-white">Actions</p>
            <div className="mt-3 space-y-2">
              {visual.actions.map((action) => (
                <button key={action} type="button" className="w-full rounded-lg bg-slate-800 px-3 py-2 text-left text-xs font-bold text-white hover:bg-slate-700">
                  {action}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </section>
  );
}

function RolesPermissionsPanel() {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Roles & Permissions</h2>
        <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-bold text-emerald-300">
          Permission planning
        </span>
      </div>
      <div className="space-y-3">
        {rolePermissionPlan.map((item) => (
          <article key={item.role} className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <h3 className="text-base font-bold text-white">{item.role}</h3>
              <p className="text-sm font-semibold text-slate-400">{item.access}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function KycVerificationPanel({
  kycRequests,
  onReview,
  onUpdate,
  onViewFile,
}: {
  kycRequests: KycUser[];
  onReview: (type: 'kyc' | 'verification', id: string, action: ReviewAction) => void;
  onUpdate: (id: string, updates: KycUpdatePayload) => Promise<boolean>;
  onViewFile: (file: UploadedFile) => void;
}) {
  const [filter, setFilter] = useState('all');
  const normalizedFilter = filter.toLowerCase();
  const filteredKycRequests = kycRequests.filter((user) => {
    const status = String(user.kyc?.status || '').toLowerCase();
    const roleType = getKycUserRoleType(user);
    if (normalizedFilter === 'all') return true;
    if (['buyer', 'grower', 'driver'].includes(normalizedFilter)) return roleType === normalizedFilter;
    return status === normalizedFilter || (normalizedFilter === 'pending' && status === 'completed');
  });

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <p className="text-sm font-bold text-slate-300">KYC filters</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            ['all', 'All'],
            ['pending', 'Pending'],
            ['under_review', 'Under Review'],
            ['approved', 'Approved'],
            ['rejected', 'Rejected'],
            ['correction_required', 'Correction Required'],
            ['buyer', 'Buyer'],
            ['grower', 'Grower'],
            ['driver', 'Driver'],
          ].map(([value, label]) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                filter === value ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <RequestSection title="KYC Verification" count={filteredKycRequests.length}>
        {filteredKycRequests.map((user) => (
          <KycRequestCard key={user._id} user={user} onReview={onReview} onUpdate={onUpdate} onViewFile={onViewFile} />
        ))}
      </RequestSection>
    </section>
  );
}

function OgVerificationPanel({
  verificationRequests,
  onReview,
  onEditVerification,
  onViewFile,
}: {
  verificationRequests: VerificationRequest[];
  onReview: (type: 'kyc' | 'verification', id: string, action: ReviewAction) => void;
  onEditVerification: (request: VerificationRequest) => void;
  onViewFile: (file: UploadedFile) => void;
}) {
  const [filter, setFilter] = useState('all');
  const normalizedFilter = filter.toLowerCase();
  const filteredRequests = verificationRequests.filter((request) => {
    const status = String(request.status || '').toLowerCase();
    const roleType = String(request.roleType || request.user?.role || '').toLowerCase();
    if (normalizedFilter === 'all') return true;
    if (['buyer', 'grower', 'driver'].includes(normalizedFilter)) return roleType === normalizedFilter;
    return status === normalizedFilter || (normalizedFilter === 'pending' && status === 'submitted');
  });
  const pending = verificationRequests.filter((request) => String(request.status || '').toUpperCase() === 'SUBMITTED').length;
  const approved = verificationRequests.filter((request) => String(request.status || '').toUpperCase() === 'APPROVED').length;
  const underReview = verificationRequests.filter((request) => String(request.status || '').toUpperCase() === 'UNDER_REVIEW').length;

  return (
    <section className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <MetricCard label="Pending OG Requests" value={pending} />
        <MetricCard label="Under Review" value={underReview} />
        <MetricCard label="Approved OG Verified" value={approved} />
      </div>
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <p className="text-sm font-bold text-slate-300">OG Verification filters</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            ['all', 'All'],
            ['pending', 'Pending'],
            ['under_review', 'Under Review'],
            ['approved', 'Approved'],
            ['rejected', 'Rejected'],
            ['buyer', 'Buyer'],
            ['grower', 'Grower'],
            ['driver', 'Logistic'],
          ].map(([value, label]) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                filter === value ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <RequestSection title="OG Verification / Quality Requests" count={filteredRequests.length}>
        {filteredRequests.map((request) => (
          <VerificationRequestCard
            key={request._id}
            request={request}
            onReview={onReview}
            onEdit={onEditVerification}
            onViewFile={onViewFile}
          />
        ))}
      </RequestSection>
    </section>
  );
}

function HomePanel({
  activePlatform,
  pendingKycCount,
  pendingVerificationCount,
  approvedKycCount,
  approvedVerificationCount,
  productCount,
  userCount,
  onOpenTab,
}: {
  activePlatform: AdminPlatform;
  pendingKycCount: number;
  pendingVerificationCount: number;
  approvedKycCount: number;
  approvedVerificationCount: number;
  productCount: number;
  userCount: number;
  onOpenTab: (tab: AdminTab) => void;
}) {
  const cards =
    activePlatform === 'orchard'
      ? [
          { label: 'Products in Inventory', value: productCount, action: 'Open Inventory', tab: 'inventory' as const },
          { label: 'Buyer Orders', value: pendingVerificationCount + pendingKycCount, action: 'Open Sales & Invoice', tab: 'sales' as const },
          { label: 'Product Entry Desk', value: productCount, action: 'Add Product', tab: 'productAdmin' as const },
          { label: 'Verified Supply Base', value: approvedVerificationCount + approvedKycCount, action: 'View Signals', tab: 'inventory' as const },
        ]
      : [
          { label: 'User Accounts', value: userCount, action: 'Open User Records', tab: 'users' as const },
          { label: 'KYC Queue', value: pendingKycCount, action: 'Open KYC Desk', tab: 'kyc' as const },
          { label: 'OG Verification Queue', value: pendingVerificationCount, action: 'Open OG Desk', tab: 'ogVerified' as const },
          { label: 'Verified Accounts', value: approvedVerificationCount + approvedKycCount, action: 'Review Verified Users', tab: 'users' as const },
        ];

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <button
          key={card.label}
          onClick={() => onOpenTab(card.tab)}
          className="rounded-2xl border border-slate-800 bg-slate-900 p-5 text-left hover:border-emerald-500"
        >
          <p className="text-sm font-bold text-slate-400">{card.label}</p>
          <p className="mt-3 text-3xl font-black text-white">{card.value}</p>
          <p className="mt-4 text-sm font-bold text-emerald-300">{card.action}</p>
        </button>
      ))}
    </section>
  );
}

const getAggregatedInventoryRows = (products: AdminProduct[]) => {
  const rows = new Map<string, {
    productId: string;
    product: string;
    quantity: number;
    breakdown: Map<string, number>;
    saleRate: number;
    discount: number;
    onlineStatus: string;
  }>();

  products.forEach((product) => {
    const productName = product.title || product.fruitName || 'Untitled product';
    const key = productName.trim().toLowerCase();
    const unitName = product.location || 'Orchard Growers';
    const quantity = Number(product.quantity || 0);
    const existing = rows.get(key) || {
      productId: product._id,
      product: productName,
      quantity: 0,
      breakdown: new Map<string, number>(),
      saleRate: Number(product.basePrice || 0),
      discount: Number(product.discountPercent || 0),
      onlineStatus: product.status === 'AVAILABLE' && product.active !== false ? 'Active' : 'Inactive',
    };

    existing.quantity += quantity;
    existing.breakdown.set(unitName, (existing.breakdown.get(unitName) || 0) + quantity);
    existing.saleRate = Math.max(existing.saleRate, Number(product.basePrice || 0));
    existing.discount = Math.max(existing.discount, Number(product.discountPercent || 0));
    if (product.status !== 'AVAILABLE' || product.active === false) existing.onlineStatus = 'Inactive';
    rows.set(key, existing);
  });

  return Array.from(rows.values()).map((row) => ({
    ...row,
    unitBreakdown: Array.from(row.breakdown.entries())
      .map(([unit, quantity]) => `${unit}: ${quantity}`)
      .join(', '),
  }));
};

function InventoryPanel({
  products,
  onUpdateStock,
  onDeleteProduct,
  onOpenTab,
  activePage,
}: {
  products: AdminProduct[];
  onUpdateStock: (product: AdminProduct) => void;
  onDeleteProduct: (product: AdminProduct) => void;
  onOpenTab: (tab: AdminTab) => void;
  activePage: string;
}) {
  const lowStock = products.filter((product) => Number(product.quantity || 0) <= 20).length;
  const aggregatedRows = getAggregatedInventoryRows(products);
  const totalLiveQuantity = aggregatedRows.reduce((sum, row) => sum + row.quantity, 0);
  const onlineActiveListings = products.filter((product) => product.status === 'AVAILABLE' && product.active !== false).length;

  if (activePage === 'Production Update') {
    return <ProductionUpdatePanel products={products} />;
  }

  if (activePage !== 'Current Stock') {
    return <OrchardSubOptionPanel module="inventory" activePage={activePage} />;
  }

  return (
    <section className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <MetricCard label="Total Orchard Products" value={products.length} />
        <MetricCard label="Total Live Quantity" value={totalLiveQuantity} />
        <MetricCard label="Low Stock Watch" value={lowStock} />
        <MetricCard label="Online Active Listings" value={onlineActiveListings} />
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        <div className="flex flex-col gap-2 border-b border-slate-800 p-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-bold text-white">Current Stock</h2>
          <span className="text-xs font-bold text-slate-400">Aggregated across units and outlets</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[860px] w-full text-left text-sm">
            <thead className="bg-slate-950 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Aggregated Quantity</th>
                <th className="px-4 py-3">Unit Breakdown</th>
                <th className="px-4 py-3">Sale Rate</th>
                <th className="px-4 py-3">Discount</th>
                <th className="px-4 py-3">Online Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {aggregatedRows.map((row) => {
                const product = products.find((item) => item._id === row.productId);
                return (
                <tr key={row.product} className="text-slate-200">
                  <td className="px-4 py-3 font-bold text-white">{row.product}</td>
                  <td className="px-4 py-3">{row.quantity}</td>
                  <td className="px-4 py-3 text-slate-400">{row.unitBreakdown || 'Orchard Growers: 0'}</td>
                  <td className="px-4 py-3">Rs. {row.saleRate}</td>
                  <td className="px-4 py-3">{row.discount}%</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-bold ${row.onlineStatus === 'Active' ? 'bg-emerald-950 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>
                      {row.onlineStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {product && (
                      <button type="button" onClick={() => onDeleteProduct(product)} className="rounded-lg bg-rose-700 px-3 py-2 text-xs font-bold text-white hover:bg-rose-600">
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
          {!aggregatedRows.length && <EmptyState label="No aggregated stock found." />}
        </div>
      </div>
    </section>
  );
}

function BillingPanel({
  plan,
  orders,
  products,
  onOpenTab,
  activePage,
}: {
  plan?: ModulePlan;
  orders: AdminOrder[];
  products: AdminProduct[];
  onOpenTab: (tab: AdminTab) => void;
  activePage: string;
}) {
  const invoicePreview = getNextInvoiceNumber(orders);
  const activeProducts = products.filter((product) => product.status === 'AVAILABLE' && product.active !== false);

  if (activePage !== 'New Invoice') {
    return <OrchardSubOptionPanel module="billing" activePage={activePage} />;
  }

  return (
    <section className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <MetricCard label="Sales History" value={orders.length} />
        <MetricCard label="Next Invoice" value={invoicePreview} />
        <MetricCard label="Billable Products" value={activeProducts.length} />
        <MetricCard label="Returns / Refunds" value={0} />
      </div>
      <NewInvoicePanel products={activeProducts} invoiceNumber={invoicePreview} />
    </section>
  );
}

function FormSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="block text-sm font-bold text-slate-300">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-white outline-none focus:border-emerald-400"
      >
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function PanelShell({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">{title}</h2>
          <p className="mt-1 text-sm font-semibold text-slate-400">{text}</p>
        </div>
        <span className="rounded-full bg-emerald-950 px-3 py-1 text-xs font-bold text-emerald-300">Action Panel</span>
      </div>
      {children}
    </section>
  );
}

function CreateUnitPanel() {
  const [draft, setDraft] = useState({
    unitName: '',
    unitType: 'Nursery Unit',
    manager: '',
    phone: '',
    gstin: '',
    address: '',
    city: '',
    state: '',
    pinCode: '',
    openingStockTag: 'Online stock pool',
    status: 'Active',
  });
  const update = (field: keyof typeof draft, value: string) => setDraft((current) => ({ ...current, [field]: value }));

  return (
    <section className="space-y-4">
      <PanelShell title="Create Unit / Outlet" text="Create operational units for nursery, warehouse, retail outlet, or online stock handling.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <AdminInput label="Unit / Outlet Name" value={draft.unitName} onChange={(value) => update('unitName', value)} placeholder="Orchard Growers Solan Unit" />
          <FormSelect label="Unit Type" value={draft.unitType} onChange={(value) => update('unitType', value)} options={['Nursery Unit', 'Warehouse', 'Retail Outlet', 'Online Stock Pool', 'Dispatch Hub']} />
          <AdminInput label="Unit Manager" value={draft.manager} onChange={(value) => update('manager', value)} placeholder="Manager name" />
          <AdminInput label="Contact Number" value={draft.phone} onChange={(value) => update('phone', value)} placeholder="Phone number" />
          <AdminInput label="GSTIN Optional" value={draft.gstin} onChange={(value) => update('gstin', value.toUpperCase())} placeholder="GST number" />
          <FormSelect label="Status" value={draft.status} onChange={(value) => update('status', value)} options={['Active', 'Inactive', 'Hold']} />
          <AdminInput label="Address" value={draft.address} onChange={(value) => update('address', value)} placeholder="Street / landmark" />
          <AdminInput label="City" value={draft.city} onChange={(value) => update('city', value)} placeholder="City" />
          <AdminInput label="State" value={draft.state} onChange={(value) => update('state', value)} placeholder="State" />
          <AdminInput label="PIN Code" value={draft.pinCode} onChange={(value) => update('pinCode', value)} placeholder="PIN code" />
          <FormSelect label="Stock Mapping" value={draft.openingStockTag} onChange={(value) => update('openingStockTag', value)} options={['Online stock pool', 'Offline only', 'Purchase receiving', 'Production nursery']} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              try {
                const stored = JSON.parse(localStorage.getItem('orchard_units') || '[]');
                const next = [
                  ...stored,
                  { ...draft, id: `unit-${Date.now()}` },
                ];
                localStorage.setItem('orchard_units', JSON.stringify(next));
                notifyLocalAction('Unit saved.');
                setDraft({
                  unitName: '',
                  unitType: 'Nursery Unit',
                  manager: '',
                  phone: '',
                  gstin: '',
                  address: '',
                  city: '',
                  state: '',
                  pinCode: '',
                  openingStockTag: 'Online stock pool',
                  status: 'Active',
                });
              } catch (err) {
                notifyLocalAction(err instanceof Error ? err.message : 'Save failed');
              }
            }}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-600"
          >
            Save Unit
          </button>
        </div>
      </PanelShell>
    </section>
  );
}

function PartyVendorPanel() {
  const [draft, setDraft] = useState({
    partyName: '',
    partyType: 'Supplier/Seller',
    contactPerson: '',
    phone: '',
    email: '',
    gstin: '',
    pan: '',
    paymentTerms: 'Immediate',
    creditLimit: '',
    address: '',
    productMapping: '',
    status: 'Active',
  });
  const update = (field: keyof typeof draft, value: string) => setDraft((current) => ({ ...current, [field]: value }));
  const saveParty = () => {
    if (!draft.partyName.trim()) {
      notifyLocalAction('Enter party / firm name before saving.');
      return;
    }

    try {
      const stored = readAdminJson<unknown>(ORCHARD_PARTIES_STORAGE_KEY);
      const existingParties = Array.isArray(stored) ? stored : [];
      setAdminStorageItem(ORCHARD_PARTIES_STORAGE_KEY, JSON.stringify([{ ...draft, id: `party-${Date.now()}` }, ...existingParties]));
      window.dispatchEvent(new Event(ORCHARD_PARTIES_CHANGED_EVENT));
      notifyLocalAction('Party / vendor saved.');
      setDraft({
        partyName: '',
        partyType: 'Supplier/Seller',
        contactPerson: '',
        phone: '',
        email: '',
        gstin: '',
        pan: '',
        paymentTerms: 'Immediate',
        creditLimit: '',
        address: '',
        productMapping: '',
        status: 'Active',
      });
    } catch (err) {
      notifyLocalAction(err instanceof Error ? err.message : 'Save failed');
    }
  };
  const verifyGst = () => {
    notifyLocalAction(draft.gstin.trim() ? `GST verification queued for ${draft.gstin}.` : 'Enter GSTIN before verification.');
  };
  const openLedger = () => {
    const stored = readStoredOrchardParties();
    notifyLocalAction(`Local vendor ledger has ${stored.length} saved parties.`);
  };
  const exportParties = () => {
    const stored = getAdminStorageItem(ORCHARD_PARTIES_STORAGE_KEY) || '[]';
    const blob = new Blob([stored], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'orchard-parties.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="space-y-4">
      <PanelShell title="Create Party / Vendor / Supplier" text="Maintain purchase parties, vendors, suppliers, transport vendors, and ledger-ready vendor records.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <AdminInput label="Party / Firm Name" value={draft.partyName} onChange={(value) => update('partyName', value)} placeholder="Vendor or supplier name" />
          <FormSelect label="Party Type" value={draft.partyType} onChange={(value) => update('partyType', value)} options={['Supplier/Seller', 'Vendor', 'Dealer/Bulk Buyer', 'Transport Vendor', 'Nursery Partner', 'Service Provider']} />
          <AdminInput label="Contact Person" value={draft.contactPerson} onChange={(value) => update('contactPerson', value)} placeholder="Contact name" />
          <AdminInput label="Phone" value={draft.phone} onChange={(value) => update('phone', value)} placeholder="Phone number" />
          <AdminInput label="Email" value={draft.email} onChange={(value) => update('email', value)} placeholder="email@example.com" type="email" />
          <AdminInput label="GSTIN" value={draft.gstin} onChange={(value) => update('gstin', value.toUpperCase())} placeholder="GST number" />
          <AdminInput label="PAN Optional" value={draft.pan} onChange={(value) => update('pan', value.toUpperCase())} placeholder="PAN number" />
          <FormSelect label="Payment Terms" value={draft.paymentTerms} onChange={(value) => update('paymentTerms', value)} options={['Immediate', '7 Days', '15 Days', '30 Days', 'Advance']} />
          <AdminInput label="Credit Limit" value={draft.creditLimit} onChange={(value) => update('creditLimit', value)} placeholder="0" type="number" />
          <AdminInput label="Address" value={draft.address} onChange={(value) => update('address', value)} placeholder="Billing address" />
          <AdminInput label="Product / Category Mapping" value={draft.productMapping} onChange={(value) => update('productMapping', value)} placeholder="Plants, manure, tools" />
          <FormSelect label="Status" value={draft.status} onChange={(value) => update('status', value)} options={['Active', 'Inactive', 'Blacklisted']} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={saveParty} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-600">Save Party</button>
          <button type="button" onClick={verifyGst} className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700">Verify GST</button>
          <button type="button" onClick={openLedger} className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700">Open Ledger</button>
          <button type="button" onClick={exportParties} className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700">Export</button>
        </div>
      </PanelShell>
    </section>
  );
}

function ProductionUpdatePanel({ products }: { products: AdminProduct[] }) {
  const [draft, setDraft] = useState({
    batchNo: `OG-PROD-${new Date().getFullYear()}-0001`,
    unit: 'Orchard Growers',
    productId: products[0]?._id || '',
    productionDate: new Date().toISOString().slice(0, 10),
    readyDate: '',
    quantity: '',
    wastage: '',
    supervisor: '',
    status: 'Draft',
    notes: '',
  });
  const update = (field: keyof typeof draft, value: string) => setDraft((current) => ({ ...current, [field]: value }));
  const produced = Number(draft.quantity || 0);
  const wastage = Number(draft.wastage || 0);
  const netStock = Math.max(0, produced - wastage);

  return (
    <section className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <MetricCard label="Produced Qty" value={produced} />
        <MetricCard label="Wastage" value={wastage} />
        <MetricCard label="Net Stock" value={netStock} />
      </div>
      <PanelShell title="Production Update" text="Record nursery production batches and calculate stock ready for approval.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <AdminInput label="Batch No." value={draft.batchNo} onChange={(value) => update('batchNo', value.toUpperCase())} placeholder="OG-PROD-2026-0001" />
          <label className="block text-sm font-bold text-slate-300">
            Product
            <select value={draft.productId} onChange={(event) => update('productId', event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-white outline-none focus:border-emerald-400">
              <option value="">Select product</option>
              {products.map((product) => (
                <option key={product._id} value={product._id}>{product.title || product.fruitName || 'Untitled product'}</option>
              ))}
            </select>
          </label>
          <AdminInput label="Unit / Outlet" value={draft.unit} onChange={(value) => update('unit', value)} placeholder="Orchard Growers" />
          <AdminInput label="Production Date" value={draft.productionDate} onChange={(value) => update('productionDate', value)} placeholder="YYYY-MM-DD" type="date" />
          <AdminInput label="Ready Date" value={draft.readyDate} onChange={(value) => update('readyDate', value)} placeholder="YYYY-MM-DD" type="date" />
          <AdminInput label="Produced Quantity" value={draft.quantity} onChange={(value) => update('quantity', value)} placeholder="0" type="number" />
          <AdminInput label="Damage / Dead Qty" value={draft.wastage} onChange={(value) => update('wastage', value)} placeholder="0" type="number" />
          <AdminInput label="Supervisor" value={draft.supervisor} onChange={(value) => update('supervisor', value)} placeholder="Supervisor name" />
          <FormSelect label="Status" value={draft.status} onChange={(value) => update('status', value)} options={['Draft', 'Under Review', 'Approved', 'Synced']} />
        </div>
        <label className="mt-3 block text-sm font-bold text-slate-300">
          Notes
          <textarea value={draft.notes} onChange={(event) => update('notes', event.target.value)} rows={3} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-emerald-400" placeholder="Production notes, quality remarks, or attachment reference." />
        </label>
        <div className="mt-4 flex flex-wrap gap-2">
          {['Save Production', 'Approve Stock', 'Sync Inventory', 'Attach Photos'].map((action) => (
            <button key={action} type="button" className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700">
              {action}
            </button>
          ))}
        </div>
      </PanelShell>
    </section>
  );
}

function PurchaseEntryPanel({ products }: { products: AdminProduct[] }) {
  const [draft, setDraft] = useState({
    vendor: '',
    invoiceNo: '',
    invoiceDate: new Date().toISOString().slice(0, 10),
    purchaseItemType: 'Finished Product',
    productId: products[0]?._id || '',
    rawMaterialName: '',
    quantity: '',
    rate: '',
    gstRate: '5',
    transportCost: '',
    unit: 'Orchard Growers',
    paymentStatus: 'Unpaid',
    notes: '',
  });
  const [vendorParties, setVendorParties] = useState<OrchardPartyRecord[]>(() => readStoredOrchardParties({ activeOnly: true }));
  const vendorListId = useMemo(() => `purchase-vendor-list-${Math.random().toString(36).slice(2)}`, []);
  const vendorOptions = useMemo(() => {
    const seen = new Set<string>();
    return vendorParties.filter((party) => {
      const key = party.partyName.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [vendorParties]);
  useEffect(() => {
    const refreshVendorParties = () => setVendorParties(readStoredOrchardParties({ activeOnly: true }));
    const handleStorage = (event: StorageEvent) => {
      if (!event.key || event.key === ORCHARD_PARTIES_STORAGE_KEY) refreshVendorParties();
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('focus', refreshVendorParties);
    window.addEventListener(ORCHARD_PARTIES_CHANGED_EVENT, refreshVendorParties);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', refreshVendorParties);
      window.removeEventListener(ORCHARD_PARTIES_CHANGED_EVENT, refreshVendorParties);
    };
  }, []);
  const update = (field: keyof typeof draft, value: string) => setDraft((current) => ({ ...current, [field]: value }));
  const taxable = Number(draft.quantity || 0) * Number(draft.rate || 0);
  const tax = taxable * (Number(draft.gstRate || 0) / 100);
  const total = taxable + tax + Number(draft.transportCost || 0);

  return (
    <section className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <MetricCard label="Taxable Value" value={Math.round(taxable)} />
        <MetricCard label="GST" value={Math.round(tax)} />
        <MetricCard label="Transport" value={Math.round(Number(draft.transportCost || 0))} />
        <MetricCard label="Grand Total" value={Math.round(total)} />
      </div>
      <PanelShell title="Purchase Entry" text="Enter supplier invoices, product rows, GST, transport cost, and stock receiving details.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <label className="block text-sm font-bold text-slate-300">
            Vendor / Supplier
            <input
              value={draft.vendor}
              list={vendorListId}
              onChange={(event) => update('vendor', event.target.value)}
              placeholder="Supplier name"
              className="mt-2 h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-white outline-none placeholder:text-slate-600 focus:border-emerald-400"
            />
            <datalist id={vendorListId}>
              {vendorOptions.map((party) => (
                <option key={party.id || party.partyName} value={party.partyName}>
                  {[party.partyType, party.contactPerson, party.phone, party.gstin].filter(Boolean).join(' | ')}
                </option>
              ))}
            </datalist>
          </label>
          <AdminInput label="Invoice No." value={draft.invoiceNo} onChange={(value) => update('invoiceNo', value.toUpperCase())} placeholder="Purchase invoice no." />
          <AdminInput label="Invoice Date" value={draft.invoiceDate} onChange={(value) => update('invoiceDate', value)} placeholder="YYYY-MM-DD" type="date" />
          <FormSelect label="Purchase Item Type" value={draft.purchaseItemType} onChange={(value) => update('purchaseItemType', value)} options={['Finished Product', 'Raw Material']} />
          {draft.purchaseItemType === 'Finished Product' ? (
            <label className="block text-sm font-bold text-slate-300">
              Product
              <select value={draft.productId} onChange={(event) => update('productId', event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-white outline-none focus:border-emerald-400">
                <option value="">Select product</option>
                {products.filter((product) => product.inventoryType !== 'raw_material').map((product) => (
                  <option key={product._id} value={product._id}>{product.title || product.fruitName || 'Untitled product'}</option>
                ))}
              </select>
            </label>
          ) : (
            <AdminInput label="Raw Material" value={draft.rawMaterialName} onChange={(value) => update('rawMaterialName', value)} placeholder="Cocopeat, compost, grafting tape" />
          )}
          <AdminInput label="Quantity" value={draft.quantity} onChange={(value) => update('quantity', value)} placeholder="0" type="number" />
          <AdminInput label="Rate" value={draft.rate} onChange={(value) => update('rate', value)} placeholder="0" type="number" />
          <FormSelect label="GST %" value={draft.gstRate} onChange={(value) => update('gstRate', value)} options={['0', '5', '12', '18', '28']} />
          <AdminInput label="Transport Cost" value={draft.transportCost} onChange={(value) => update('transportCost', value)} placeholder="0" type="number" />
          <AdminInput label="Receiving Unit" value={draft.unit} onChange={(value) => update('unit', value)} placeholder="Orchard Growers" />
          <FormSelect label="Payment Status" value={draft.paymentStatus} onChange={(value) => update('paymentStatus', value)} options={['Unpaid', 'Part Paid', 'Paid', 'On Hold']} />
        </div>
        <label className="mt-3 block text-sm font-bold text-slate-300">
          Notes
          <textarea value={draft.notes} onChange={(event) => update('notes', event.target.value)} rows={3} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-emerald-400" placeholder="Transport reference, bill upload note, stock condition, or payment remarks." />
        </label>
        <div className="mt-4 flex flex-wrap gap-2">
          {['Save Purchase', 'Upload Bill', 'Post Stock', 'Create Payable'].map((action) => (
            <button key={action} type="button" className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700">
              {action}
            </button>
          ))}
        </div>
      </PanelShell>
    </section>
  );
}

function NewInvoicePanel({ products, invoiceNumber }: { products: AdminProduct[]; invoiceNumber: string }) {
  const firstProduct = products[0];
  const productsById = new Map(products.map((product) => [product._id, product]));
  const [currentInvoiceNumber, setCurrentInvoiceNumber] = useState(invoiceNumber);
  useEffect(() => {
    setCurrentInvoiceNumber(invoiceNumber);
  }, [invoiceNumber]);
  const [customer, setCustomer] = useState({
    name: '',
    phone: '',
    email: '',
    gstin: '',
    paymentMethod: 'Cash',
    billingAddress: '',
  });
  const [customerType, setCustomerType] = useState<'Retail Customer' | 'Dealer/Firm/Company'>('Retail Customer');
  const createInvoiceRow = () => ({
    id: `row-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    productId: firstProduct?._id || '',
    quantity: '1',
    rate: String(firstProduct?.basePrice || ''),
    discountPercent: String(firstProduct?.discountPercent || 0),
    gstRate: String(firstProduct?.gstRate || 5),
  });
  const [rows, setRows] = useState([createInvoiceRow()]);
  const updateCustomer = (field: keyof typeof customer, value: string) => setCustomer((current) => ({ ...current, [field]: value }));
  const updateRow = (id: string, field: keyof ReturnType<typeof createInvoiceRow>, value: string) =>
    setRows((current) => current.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  const addRow = () => setRows((current) => [...current, createInvoiceRow()]);
  const removeRow = (id: string) => setRows((current) => (current.length > 1 ? current.filter((row) => row.id !== id) : current));
  const rowTotals = rows.map((row) => {
    const subtotal = Number(row.quantity || 0) * Number(row.rate || 0);
    const discount = subtotal * (Number(row.discountPercent || 0) / 100);
    const taxable = Math.max(0, subtotal - discount);
    const tax = taxable * (Number(row.gstRate || 0) / 100);
    return { subtotal, discount, tax, total: taxable + tax };
  });
  const subtotal = rowTotals.reduce((sum, item) => sum + item.subtotal, 0);
  const discount = rowTotals.reduce((sum, item) => sum + item.discount, 0);
  const tax = rowTotals.reduce((sum, item) => sum + item.tax, 0);
  const total = rowTotals.reduce((sum, item) => sum + item.total, 0);
  const getInvoiceSummary = () => {
    const productLines = rows.map((row, index) => {
      const product = products.find((item) => item._id === row.productId);
      return `${index + 1}. ${product?.title || 'Product'} x ${row.quantity || 0} = Rs. ${Math.round(rowTotals[index]?.total || 0)}`;
    });
    return [`Invoice ${currentInvoiceNumber}`, `Customer: ${customer.name || 'Walk-in customer'}`, ...productLines, `Grand Total: Rs. ${Math.round(total)}`].join('\n');
  };
  const saveInvoice = () => {
    try {
      const requestedByProduct = rows.reduce((map, row) => {
        if (!row.productId) return map;
        map.set(row.productId, (map.get(row.productId) || 0) + Number(row.quantity || 0));
        return map;
      }, new Map<string, number>());

      for (const [productId, requestedQuantity] of requestedByProduct.entries()) {
        const product = productsById.get(productId);
        const availableQuantity = Number(product?.quantity || 0);
        if (!product || requestedQuantity <= 0) {
          notifyLocalAction('Select product and enter a valid quantity before saving invoice.');
          return;
        }
        if (requestedQuantity > availableQuantity) {
          notifyLocalAction(`${product.title || product.fruitName || 'Product'} has only ${availableQuantity} unit(s) in stock. Purchase or update stock first.`);
          return;
        }
      }

      const stored = JSON.parse(localStorage.getItem('orchard_invoices') || '[]');
      const invoice = {
        id: `inv-${Date.now()}`,
        invoiceNumber: currentInvoiceNumber,
        customerType,
        customer: { ...customer },
        rows: rows.map(({ id, ...row }) => row),
        totals: { subtotal, discount, tax, total },
        createdAt: new Date().toISOString(),
      };
      localStorage.setItem('orchard_invoices', JSON.stringify([invoice, ...stored]));
      commitInvoiceNumber(currentInvoiceNumber);
      notifyLocalAction('Invoice saved locally.');
      setCustomer({ name: '', phone: '', email: '', gstin: '', paymentMethod: 'Cash', billingAddress: '' });
      setRows([createInvoiceRow()]);
      setCurrentInvoiceNumber(formatInvoiceNumber(getInvoiceSerial(currentInvoiceNumber) + 1));
    } catch (err) {
      notifyLocalAction(err instanceof Error ? err.message : 'Save failed');
    }
  };
  const generatePdf = () => {
    const printable = window.open('', '_blank', 'width=900,height=700');
    if (!printable) return;
    printable.document.write(`<pre style="font:14px/1.5 system-ui;white-space:pre-wrap">${getInvoiceSummary()}</pre>`);
    printable.document.close();
    printable.print();
  };
  const sendWhatsapp = () => {
    const phone = customer.phone.replace(/\D/g, '');
    const url = `https://wa.me/${phone ? `91${phone.slice(-10)}` : ''}?text=${encodeURIComponent(getInvoiceSummary())}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };
  const sendEmail = () => {
    const subject = encodeURIComponent(`Invoice ${currentInvoiceNumber}`);
    const body = encodeURIComponent(getInvoiceSummary());
    window.location.href = `mailto:${customer.email || ''}?subject=${subject}&body=${body}`;
  };

  return (
    <PanelShell title="New Invoice" text="Create offline invoices with the same sequence logic used for Orchard Growers billing.">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-emerald-950 px-3 py-1 text-xs font-bold text-emerald-300">{currentInvoiceNumber}</span>
        <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-bold text-slate-300">Draft</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <label className="block text-sm font-bold text-slate-300">
          Customer Type
          <select value={customerType} onChange={(e) => setCustomerType(e.target.value as any)} className="mt-2 h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-white outline-none focus:border-emerald-400">
            <option>Retail Customer</option>
            <option>Dealer/Firm/Company</option>
          </select>
        </label>
        <AdminInput label={customerType === 'Retail Customer' ? 'Customer Name' : 'Dealer / Firm / Company'} value={customer.name} onChange={(value) => updateCustomer('name', value)} placeholder={customerType === 'Retail Customer' ? 'Customer / firm name' : 'Dealer / Firm / Company name'} />
        <AdminInput label="Contact Number" value={customer.phone} onChange={(value) => updateCustomer('phone', value)} placeholder="Phone number" />
        <AdminInput label="Email" value={customer.email} onChange={(value) => updateCustomer('email', value)} placeholder="customer@example.com" type="email" />
        <AdminInput label="GST No. optional" value={customer.gstin} onChange={(value) => updateCustomer('gstin', value.toUpperCase())} placeholder="GSTIN" />
        <FormSelect label="Payment Method" value={customer.paymentMethod} onChange={(value) => updateCustomer('paymentMethod', value)} options={['Cash', 'UPI', 'Card', 'Bank', 'COD']} />
        <AdminInput label="Billing Address" value={customer.billingAddress} onChange={(value) => updateCustomer('billingAddress', value)} placeholder="Billing address" />
      </div>
      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-800">
        <table className="min-w-[900px] w-full text-left text-sm">
          <thead className="bg-slate-950 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-3 py-3">Product</th>
              <th className="px-3 py-3">Qty</th>
              <th className="px-3 py-3">Rate</th>
              <th className="px-3 py-3">Discount %</th>
              <th className="px-3 py-3">GST %</th>
              <th className="px-3 py-3">Total</th>
              <th className="px-3 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
            <tr key={row.id} className="text-slate-300">
              <td className="px-3 py-3">
                <div className="flex items-center gap-2">
                  <select value={row.productId} onChange={(event) => updateRow(row.id, 'productId', event.target.value)} className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-white outline-none focus:border-emerald-400">
                    <option value="">Select product</option>
                    {products.map((product) => (
                      <option key={product._id} value={product._id}>{product.title || product.fruitName || 'Untitled product'}</option>
                    ))}
                  </select>
                </div>
              </td>
              <td className="px-3 py-3"><input value={row.quantity} onChange={(event) => updateRow(row.id, 'quantity', event.target.value)} type="number" className="h-10 w-24 rounded-lg border border-slate-700 bg-slate-950 px-3 text-white outline-none focus:border-emerald-400" /></td>
              <td className="px-3 py-3"><input value={row.rate} onChange={(event) => updateRow(row.id, 'rate', event.target.value)} type="number" className="h-10 w-28 rounded-lg border border-slate-700 bg-slate-950 px-3 text-white outline-none focus:border-emerald-400" /></td>
              <td className="px-3 py-3"><input value={row.discountPercent} onChange={(event) => updateRow(row.id, 'discountPercent', event.target.value)} type="number" className="h-10 w-24 rounded-lg border border-slate-700 bg-slate-950 px-3 text-white outline-none focus:border-emerald-400" /></td>
              <td className="px-3 py-3"><input value={row.gstRate} onChange={(event) => updateRow(row.id, 'gstRate', event.target.value)} type="number" className="h-10 w-24 rounded-lg border border-slate-700 bg-slate-950 px-3 text-white outline-none focus:border-emerald-400" /></td>
              <td className="px-3 py-3 font-bold text-white">Rs. {Math.round(rowTotals[index]?.total || 0)}</td>
              <td className="px-3 py-3">
                <div className="flex gap-2">
                  <button type="button" onClick={addRow} aria-label="Add next product" title="Add next product" className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-lg font-black text-white hover:bg-emerald-500">+</button>
                  <button type="button" onClick={() => removeRow(row.id)} disabled={rows.length === 1} aria-label="Remove product row" title="Remove product row" className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800 text-sm font-black text-white hover:bg-slate-700 disabled:opacity-50">x</button>
                </div>
              </td>
            </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <MetricCard label="Subtotal" value={Math.round(subtotal)} />
        <MetricCard label="Discount" value={Math.round(discount)} />
        <MetricCard label="GST" value={Math.round(tax)} />
        <MetricCard label="Grand Total" value={Math.round(total)} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={saveInvoice} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-600">Save Invoice</button>
        <button type="button" onClick={() => window.print()} className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700">Print</button>
        <button type="button" onClick={generatePdf} className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700">Generate PDF</button>
        <button type="button" onClick={() => window.open(`sms:${customer.phone}?body=${encodeURIComponent(getInvoiceSummary())}`, '_self')} className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700">SMS Summary</button>
        <button type="button" onClick={sendWhatsapp} className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700">WhatsApp Share</button>
        <button type="button" onClick={sendEmail} className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700">Email PDF</button>
      </div>
    </PanelShell>
  );
}

function getProductPayload(draft: ProductDraft) {
  const slug = createProductSlug(draft.title);
  const dimensionWeightKg = calculateDimensionWeightKg(draft);
  const actualWeightKg = Number(draft.actualWeightKg || 0);
  const chargeableWeightKg = Math.max(
    Number.isFinite(actualWeightKg) ? actualWeightKg : 0,
    dimensionWeightKg
  );

  return {
    title: draft.title,
    slug,
    productCategory: draft.productCategory || draft.fruitName,
    fruitName: draft.fruitName || draft.productCategory,
    seasonalCategory: draft.seasonalCategory,
    description: draft.description,
    basePrice: Number(draft.basePrice || 0),
    discountPercent: Number(draft.discountPercent || 0),
    sku: draft.sku,
    hsnCode: draft.hsnCode,
    hsnDescription: draft.hsnDescription,
    gstRate: Number(draft.gstRate || 0),
    status: draft.active ? draft.status : 'SOLD',
    active: draft.active,
    quantity: Number(draft.quantity || 0),
    location: draft.location || 'Orchard Growers',
    variety: draft.variety || draft.productCategory || draft.fruitName,
    productType: draft.productType,
    inventoryType: draft.inventoryType,
    unit: draft.unit,
    packingType: getPackSizeLabel(draft),
    packShape: draft.packShape,
    packLengthCm: Number(draft.packLengthCm || 0),
    packWidthCm: Number(draft.packWidthCm || 0),
    packHeightCm: Number(draft.packHeightCm || 0),
    packRadiusCm: Number(draft.packRadiusCm || 0),
    packThicknessCm: Number(draft.packThicknessCm || 0),
    actualWeightKg,
    dimensionWeightKg,
    chargeableWeightKg,
    seoMetaTitle: draft.seoMetaTitle,
    seoMetaDescription: draft.seoMetaDescription,
    seoKeywords: draft.seoKeywords
      .split(',')
      .map((keyword) => keyword.trim())
      .filter(Boolean),
    featured: draft.featured,
    images: draft.uploadedImages.map((image) => image.url),
    imagePublicIds: draft.uploadedImages.map((image) => image.publicId),
  };
}

function getProductFormData(payload: ReturnType<typeof getProductPayload>) {
  const formData = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    formData.append(key, Array.isArray(value) ? JSON.stringify(value) : String(value));
  });
  return formData;
}

function getProductDraftFromProduct(product: AdminProduct): ProductDraft {
  const images = Array.isArray(product.images) ? product.images : [];
  const publicIds = Array.isArray(product.imagePublicIds) ? product.imagePublicIds : [];
  return {
    title: product.title || '',
    slug: product.slug || '',
    sku: product.sku || '',
    hsnCode: product.hsnCode || '',
    hsnDescription: product.hsnDescription || '',
    gstRate: product.gstRate === undefined || product.gstRate === null ? '' : String(product.gstRate),
    cgst: product.cgst === undefined || product.cgst === null ? '' : String(product.cgst),
    sgst: product.sgst === undefined || product.sgst === null ? '' : String(product.sgst),
    fruitName: product.fruitName || '',
    variety: product.variety || '',
    productCategory: product.productCategory || product.fruitName || '',
    seasonalCategory: product.seasonalCategory || '',
    productType: product.productType || 'Plant',
    inventoryType: product.inventoryType || 'finished_product',
    unit: product.unit || 'Plant',
    seoMetaTitle: product.seoMetaTitle || '',
    seoMetaDescription: product.seoMetaDescription || '',
    seoKeywords: Array.isArray(product.seoKeywords) ? product.seoKeywords.join(', ') : '',
    featured: Boolean(product.featured),
    active: product.active !== false && product.status !== 'SOLD',
    description: product.description || '',
    quantity: String(product.quantity ?? ''),
    basePrice: String(product.basePrice ?? ''),
    discountPercent: String(product.discountPercent ?? ''),
    location: product.location || 'Orchard Growers',
    packingType: product.packingType || 'Orchard Growers pack',
    status: product.status === 'SOLD' ? 'SOLD' : 'AVAILABLE',
    uploadedImages: images.map((url, index) => ({ url, publicId: publicIds[index] || '' })),
    packShape: product.packShape || 'box',
    packLengthCm: String(product.packLengthCm ?? ''),
    packWidthCm: String(product.packWidthCm ?? ''),
    packHeightCm: String(product.packHeightCm ?? ''),
    packRadiusCm: String(product.packRadiusCm ?? ''),
    packThicknessCm: String(product.packThicknessCm ?? ''),
    actualWeightKg: String(product.actualWeightKg ?? ''),
    dimensionWeightKg: String(product.dimensionWeightKg ?? ''),
    chargeableWeightKg: String(product.chargeableWeightKg ?? ''),
  };
}

function createProductSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function calculateDimensionWeightKg(draft: ProductDraft) {
  const length = Number(draft.packLengthCm || 0);
  const width = Number(draft.packWidthCm || 0);
  const height = Number(draft.packHeightCm || 0);
  const radius = Number(draft.packRadiusCm || 0);
  const thickness = Number(draft.packThicknessCm || 0);

  if (draft.packShape === 'cylinder') {
    const volume = Math.PI * radius * radius * height;
    return volume > 0 ? Number((volume / 5000).toFixed(2)) : 0;
  }

  const thirdDimension = draft.packShape === 'flyer' ? thickness : height;
  const volume = length * width * thirdDimension;
  return volume > 0 ? Number((volume / 5000).toFixed(2)) : 0;
}

function getPackSizeLabel(draft: ProductDraft) {
  if (draft.packShape === 'cylinder') {
    return `${draft.packRadiusCm || '0'} x ${draft.packHeightCm || '0'} cm (radius x height)`;
  }

  if (draft.packShape === 'flyer') {
    return `${draft.packLengthCm || '0'} x ${draft.packWidthCm || '0'} x ${draft.packThicknessCm || '0'} cm (length x width x thickness)`;
  }

  return `${draft.packLengthCm || '0'} x ${draft.packWidthCm || '0'} x ${draft.packHeightCm || '0'} cm (length x width x height)`;
}

function ProductAdminPanel({
  draft,
  onChange,
  onSubmit,
  saving,
  uploadAuthHeaders,
  editing,
  onCancelEdit,
  modeLabel = 'Product',
  platform = 'orchardgrowers',
}: {
  draft: ProductDraft;
  onChange: (draft: ProductDraft) => void;
  onSubmit: (event: FormEvent) => void;
  saving: boolean;
  uploadAuthHeaders: Record<string, string>;
  editing: boolean;
  onCancelEdit: () => void;
  modeLabel?: string;
  platform?: 'orchardgrowers' | 'efruitmandi';
}) {
  const update = (field: keyof ProductDraft, value: string | boolean | ProductImageUpload[]) => {
    const nextDraft = { ...draft, [field]: value };
    if (field === 'title') nextDraft.slug = createProductSlug(String(value));
    onChange(nextDraft);
  };
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');
  const [imageUploading, setImageUploading] = useState(false);
  const [hsnQuery, setHsnQuery] = useState(draft.hsnCode);
  const [hsnSuggestions, setHsnSuggestions] = useState<HsnSuggestion[]>([]);
  const [hsnOpen, setHsnOpen] = useState(false);
  const [skuGenerating, setSkuGenerating] = useState(false);
  const isRawMaterial = draft.inventoryType === 'raw_material';
  const dimensionWeightKg = calculateDimensionWeightKg(draft);
  const actualWeightKg = Number(draft.actualWeightKg || 0);
  const chargeableWeightKg = Math.max(Number.isFinite(actualWeightKg) ? actualWeightKg : 0, dimensionWeightKg);
  const generatedSlug = createProductSlug(draft.title);

  useEffect(() => {
    if (!draft.uploadedImages.length) {
      setImagePreviewUrl('');
      return undefined;
    }

    setImagePreviewUrl(draft.uploadedImages[0].url);
    return undefined;
  }, [draft.uploadedImages]);

  useEffect(() => {
    setHsnQuery(draft.hsnCode);
  }, [draft.hsnCode]);

  useEffect(() => {
    const query = (hsnQuery || draft.title || draft.productCategory).trim();
    if (!query) {
      setHsnSuggestions([]);
      return undefined;
    }

    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/hsn/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setHsnSuggestions(Array.isArray(data) ? data : []);
      } catch {
        setHsnSuggestions([]);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [draft.productCategory, draft.title, hsnQuery]);

  const generateSku = async () => {
    if (!draft.title.trim() || !(draft.productCategory || draft.fruitName).trim() || !draft.unit.trim()) return;

    try {
      setSkuGenerating(true);
      const params = new URLSearchParams({
        productName: draft.title.trim(),
        category: (draft.productCategory || draft.fruitName).trim(),
        unitId: draft.unit.trim(),
      });
      const res = await fetch(`${API_BASE}/products/generate-sku?${params.toString()}`, {
        headers: uploadAuthHeaders,
      });
      const data = await res.json();
      if (res.ok && data.sku) update('sku', data.sku);
    } catch {
      // Leave the SKU field editable when automatic generation is unavailable.
    } finally {
      setSkuGenerating(false);
    }
  };

  useEffect(() => {
    if (editing || !draft.title.trim() || !(draft.productCategory || draft.fruitName).trim() || !draft.unit.trim()) return;
    generateSku();
  }, [draft.title, draft.productCategory, draft.fruitName, draft.unit, editing]);

  const selectHsn = (item: HsnSuggestion) => {
    onChange({
      ...draft,
      hsnCode: item.hsnCode,
      hsnDescription: item.description,
      gstRate: String(item.gstRate),
      cgst: String(Number(item.gstRate) / 2),
      sgst: String(Number(item.gstRate) / 2),
    });
    setHsnQuery(item.hsnCode);
    setHsnOpen(false);
  };

  const uploadImages = async (files: File[]) => {
    if (!files.length) return;

    const remainingSlots = Math.max(0, 10 - draft.uploadedImages.length);
    const nextFiles = files.slice(0, remainingSlots);
    if (!nextFiles.length) return;

    const formData = new FormData();
    formData.append('platform', platform);
    nextFiles.forEach((file) => formData.append('images', file));

    try {
      setImageUploading(true);
      const res = await fetch(`${API_BASE}/admin/product-images`, {
        method: 'POST',
        headers: uploadAuthHeaders,
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) return;
      const uploaded = Array.isArray(data.images) ? data.images : [];
      onChange({
        ...draft,
        uploadedImages: [...draft.uploadedImages, ...uploaded].slice(0, 10),
      });
    } finally {
      setImageUploading(false);
    }
  };

  const removeImage = (index: number) => {
    onChange({
      ...draft,
      uploadedImages: draft.uploadedImages.filter((_, imageIndex) => imageIndex !== index),
    });
  };

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <div className="mb-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-bold text-white">{editing ? `Edit ${modeLabel}` : `Create ${modeLabel}`}</h2>
          <span className="rounded-full bg-emerald-950 px-3 py-1 text-xs font-bold text-emerald-300">{editing ? 'Edit Mode' : `${modeLabel} Master`}</span>
        </div>
        <p className="mt-1 text-sm font-semibold text-slate-400">
          {draft.inventoryType === 'raw_material'
            ? 'Create raw-material records for purchase, stock, and production. Raw materials stay out of the storefront showcase.'
            : 'Create own-brand product records for inventory, SEO, storefront sync, and billing.'}
        </p>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {(isRawMaterial ? ['Basic', 'Tax & Stock'] : ['Basic', 'Tax & Stock', 'SEO', 'Images']).map((tab) => (
          <span key={tab} className="rounded-full bg-slate-950 px-3 py-1 text-xs font-bold text-slate-300">
            {tab}
          </span>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <AdminInput label={isRawMaterial ? 'Raw Material Name' : 'Product Name'} value={draft.title} onChange={(value) => update('title', value)} placeholder={isRawMaterial ? 'Cocopeat' : 'Avocado Plant'} />
        <AdminInput label="Slug" value={generatedSlug} onChange={() => undefined} placeholder="auto-generated-slug" disabled />
        <label className="block text-sm font-bold text-slate-300">
          SKU
          <input
            value={skuGenerating ? 'Generating...' : draft.sku}
            readOnly
            placeholder="Auto-generated after name, category, and unit"
            className="mt-2 h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-slate-300 outline-none placeholder:text-slate-600"
          />
        </label>
        <label className="relative block text-sm font-bold text-slate-300">
          HSN Code
          <input
            value={hsnQuery}
            onFocus={() => setHsnOpen(true)}
            onChange={(event) => {
              const value = event.target.value;
              setHsnQuery(value);
              if (/^\d*$/.test(value.trim())) update('hsnCode', value.trim());
              setHsnOpen(true);
            }}
            placeholder="Search HSN / product / category"
            className="mt-2 h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-white outline-none placeholder:text-slate-600 focus:border-emerald-400"
          />
          {hsnOpen && hsnSuggestions.length > 0 && (
            <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-700 bg-slate-950 shadow-xl">
              {hsnSuggestions.map((item) => (
                <button
                  key={item._id}
                  type="button"
                  onClick={() => selectHsn(item)}
                  className="block w-full px-3 py-2 text-left text-xs text-slate-200 hover:bg-slate-800"
                >
                  <span className="font-black text-white">{item.hsnCode}</span>
                  <span className="ml-2 font-bold text-emerald-300">{item.gstRate}% GST</span>
                  <span className="mt-1 block text-slate-400">{item.category} - {item.description}</span>
                </button>
              ))}
            </div>
          )}
        </label>
        <AdminInput label="GST %" value={draft.gstRate} onChange={(value) => update('gstRate', value)} placeholder="5" type="number" />
        <AdminInput label="HSN Description" value={draft.hsnDescription} onChange={(value) => update('hsnDescription', value)} placeholder="HSN item description" />
        <label className="block text-sm font-bold text-slate-300">
          {isRawMaterial ? 'Raw Material Category' : 'Product Category'}
          <select
            value={draft.productCategory}
            onChange={(event) => update('productCategory', event.target.value)}
            className="mt-2 h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-white outline-none focus:border-emerald-400"
          >
            <option value="">Select category</option>
            {(isRawMaterial ? rawMaterialCategories : orchardProductCategories).map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </label>
        {!isRawMaterial && (
          <label className="block text-sm font-bold text-slate-300">
            Seasonal Plant Category
            <select
              value={draft.seasonalCategory}
              onChange={(event) => update('seasonalCategory', event.target.value)}
              className="mt-2 h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-white outline-none focus:border-emerald-400"
            >
              <option value="">Not seasonal</option>
              {orchardSeasonalCategories.map((season) => (
                <option key={season} value={season}>{season}</option>
              ))}
            </select>
          </label>
        )}
        <label className="block text-sm font-bold text-slate-300">
          Inventory Type
          <select
            value={draft.inventoryType}
            onChange={(event) => update('inventoryType', event.target.value)}
            className="mt-2 h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-white outline-none focus:border-emerald-400"
          >
            <option value="finished_product">Finished Product</option>
            <option value="raw_material">Raw Material</option>
          </select>
        </label>
        <label className="block text-sm font-bold text-slate-300">
          {isRawMaterial ? 'Material Type' : 'Product Type'}
          <select
            value={draft.productType}
            onChange={(event) => update('productType', event.target.value)}
            className="mt-2 h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-white outline-none focus:border-emerald-400"
          >
            {['Plant', 'Seeds', 'Tools', 'Fertilizer', 'Equipment', 'Raw Material', 'Growing Media', 'Packaging', 'Other'].map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-bold text-slate-300">
          Unit
          <select
            value={draft.unit}
            onChange={(event) => update('unit', event.target.value)}
            className="mt-2 h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-white outline-none focus:border-emerald-400"
          >
            {['Kg', 'Piece', 'Plant', 'Box', 'Litre'].map((unit) => (
              <option key={unit} value={unit}>{unit}</option>
            ))}
          </select>
        </label>
        {!isRawMaterial && (
          <label className="block text-sm font-bold text-slate-300">
            Product category legacy
            <select
              value={draft.fruitName}
              onChange={(event) => update('fruitName', event.target.value)}
              className="mt-2 h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-white outline-none focus:border-emerald-400"
            >
              <option value="">Select legacy category</option>
              {orchardProductCategories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </label>
        )}
        {!isRawMaterial && <AdminInput label="Variety / product line" value={draft.variety} onChange={(value) => update('variety', value)} placeholder="Orchard Growers Premium" />}
        <AdminInput label="Location" value={draft.location} onChange={(value) => update('location', value)} placeholder="Orchard Growers" />
        {!isRawMaterial && <AdminInput label="Price" value={draft.basePrice} onChange={(value) => update('basePrice', value)} placeholder="999" type="number" />}
        {!isRawMaterial && <AdminInput label="Discount %" value={draft.discountPercent} onChange={(value) => update('discountPercent', value)} placeholder="0" type="number" />}
        {!isRawMaterial && (
          <label className="block text-sm font-bold text-slate-300">
            Pack shape
            <select
              value={draft.packShape}
              onChange={(event) => update('packShape', event.target.value)}
              className="mt-2 h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-white outline-none focus:border-emerald-400"
            >
              <option value="box">Box / carton</option>
              <option value="cylinder">Cylinder</option>
              <option value="flyer">Flyer / packet</option>
            </select>
          </label>
        )}
        {!isRawMaterial && draft.packShape === 'cylinder' ? (
          <>
            <AdminInput label="Radius cm" value={draft.packRadiusCm} onChange={(value) => update('packRadiusCm', value)} placeholder="10" type="number" />
            <AdminInput label="Height cm" value={draft.packHeightCm} onChange={(value) => update('packHeightCm', value)} placeholder="30" type="number" />
          </>
        ) : !isRawMaterial ? (
          <>
            <AdminInput label="Length cm" value={draft.packLengthCm} onChange={(value) => update('packLengthCm', value)} placeholder="30" type="number" />
            <AdminInput label="Width cm" value={draft.packWidthCm} onChange={(value) => update('packWidthCm', value)} placeholder="20" type="number" />
            <AdminInput
              label={draft.packShape === 'flyer' ? 'Thickness cm' : 'Height cm'}
              value={draft.packShape === 'flyer' ? draft.packThicknessCm : draft.packHeightCm}
              onChange={(value) => update(draft.packShape === 'flyer' ? 'packThicknessCm' : 'packHeightCm', value)}
              placeholder={draft.packShape === 'flyer' ? '2' : '15'}
              type="number"
            />
          </>
        ) : null}
        {!isRawMaterial && <AdminInput label="Pack size" value={getPackSizeLabel(draft)} onChange={() => undefined} placeholder="auto-generated pack size" disabled />}
        {!isRawMaterial && <AdminInput label="Actual weight kg" value={draft.actualWeightKg} onChange={(value) => update('actualWeightKg', value)} placeholder="1.25" type="number" />}
        {!isRawMaterial && <AdminInput label="Dimension weight kg" value={String(dimensionWeightKg)} onChange={() => undefined} placeholder="auto" disabled />}
        {!isRawMaterial && <AdminInput label="Chargeable weight kg" value={String(chargeableWeightKg)} onChange={() => undefined} placeholder="auto" disabled />}
        <label className="block text-sm font-bold text-slate-300">
          Product status
          <select
            value={draft.status}
            onChange={(event) => update('status', event.target.value)}
            className="mt-2 h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-white outline-none focus:border-emerald-400"
          >
            <option value="AVAILABLE">Active</option>
            <option value="SOLD">Inactive</option>
          </select>
        </label>
      </div>
      {!isRawMaterial && (
        <label className="mt-3 block text-sm font-bold text-slate-300">
          Product Description Blog
          <textarea
            value={draft.description}
            onChange={(event) => update('description', event.target.value)}
            rows={3}
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-emerald-400"
            placeholder="Demo product details for buyers and Orchard Growers showcase."
          />
        </label>
      )}
      {!isRawMaterial && (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <AdminInput label="SEO Meta Title" value={draft.seoMetaTitle} onChange={(value) => update('seoMetaTitle', value)} placeholder="Buy Avocado Plant Online" />
          <AdminInput label="SEO Meta Description" value={draft.seoMetaDescription} onChange={(value) => update('seoMetaDescription', value)} placeholder="Healthy grafted plants from Orchard Growers." />
        </div>
      )}
      {!isRawMaterial && (
        <div className="mt-3">
          <AdminInput label="SEO Keywords" value={draft.seoKeywords} onChange={(value) => update('seoKeywords', value)} placeholder="avocado plant, grafted fruit plant, orchard growers" />
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-3">
        {!isRawMaterial && (
          <label className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm font-bold text-slate-300">
            <input type="checkbox" checked={draft.featured} onChange={(event) => update('featured', event.target.checked)} />
            Featured Product
          </label>
        )}
        <label className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm font-bold text-slate-300">
          <input type="checkbox" checked={draft.active} onChange={(event) => update('active', event.target.checked)} />
          Active
        </label>
      </div>
      {!isRawMaterial && <div className="mt-4 rounded-xl border border-dashed border-slate-700 bg-slate-950 p-4">
        <p className="text-sm font-black text-white">Product Images</p>
        <p className="mt-1 text-xs font-semibold text-slate-500">Select at list 5 images</p>
        <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_140px] md:items-end">
          <label className="block text-xs font-bold text-slate-300">
            Upload images
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(event) => {
                uploadImages(Array.from(event.target.files || []));
                event.currentTarget.value = '';
              }}
              className="mt-2 block w-full text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-600 file:px-3 file:py-2 file:text-sm file:font-bold file:text-white hover:file:bg-emerald-500"
            />
            <span className="mt-2 block text-xs text-slate-500">
              {imageUploading ? 'Uploading' : `${draft.uploadedImages.length} uploaded / minimum 5`}
            </span>
          </label>
          <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg border border-slate-800 bg-slate-900">
            {imagePreviewUrl ? <img src={imagePreviewUrl} alt="Product preview" className="h-full w-full object-cover" /> : <span className="text-xs font-bold text-slate-600">Preview</span>}
          </div>
        </div>
        {draft.uploadedImages.length > 0 && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2 md:grid-cols-5">
            {draft.uploadedImages.map((image, index) => (
              <div key={image.publicId || image.url} className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900">
                <a href={image.url} target="_blank" rel="noreferrer" className="block aspect-square">
                  <img src={image.url} alt={`Cloudinary product ${index + 1}`} className="h-full w-full object-cover" />
                </a>
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="block w-full bg-slate-800 px-2 py-1 text-xs font-bold text-slate-200 hover:bg-slate-700"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>}
      <div className="mt-4 flex flex-wrap gap-2">
        <button disabled={saving} className="rounded-lg bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-60">
          {saving ? 'Saving...' : editing ? `Update ${modeLabel}` : `Save ${modeLabel}`}
        </button>
        {editing && (
          <button type="button" onClick={onCancelEdit} className="rounded-lg bg-slate-800 px-5 py-3 text-sm font-bold text-white hover:bg-slate-700">
            Cancel Edit
          </button>
        )}
      </div>
    </form>
  );
}

function OrchardProductsTable({
  products,
  onEdit,
  onDelete,
  onViewFile,
}: {
  products: AdminProduct[];
  onEdit: (product: AdminProduct) => void;
  onDelete: (product: AdminProduct) => void;
  onViewFile: (file: UploadedFile) => void;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
      <div className="flex flex-col gap-2 border-b border-slate-800 p-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-bold text-white">Orchard Growers Products</h2>
        <span className="text-xs font-bold text-slate-400">{products.length} records</span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[1100px] w-full text-left text-sm">
          <thead className="bg-slate-950 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Season</th>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">HSN / GST</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Discount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Certification</th>
              <th className="px-4 py-3">Images</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {products.map((product) => (
              <tr key={product._id} className="text-slate-200">
                <td className="px-4 py-3 font-bold text-white">{product.title || 'Untitled product'}</td>
                <td className="px-4 py-3 text-slate-400">{product.productCategory || product.fruitName || '-'}</td>
                <td className="px-4 py-3 text-slate-400">{product.seasonalCategory || '-'}</td>
                <td className="px-4 py-3 text-slate-300">{product.sku || '-'}</td>
                <td className="px-4 py-3 text-slate-400">{product.hsnCode || '-'} / {product.gstRate ?? 0}%</td>
                <td className="px-4 py-3">Rs. {product.basePrice || 0}</td>
                <td className="px-4 py-3">{product.discountPercent || 0}%</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-1 text-xs font-bold ${product.status === 'AVAILABLE' && product.active !== false ? 'bg-emerald-950 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>
                    {formatProductStatus(product.status || 'SOLD')}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <OrganicCertificationCell product={product} onViewFile={onViewFile} />
                </td>
                <td className="px-4 py-3 text-slate-400">{product.images?.length || 0}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => onEdit(product)} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500">
                      Edit
                    </button>
                    <button type="button" onClick={() => onDelete(product)} className="rounded-lg bg-rose-700 px-3 py-2 text-xs font-bold text-white hover:bg-rose-600">
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!products.length && <EmptyState label="No Orchard Growers products found." />}
      </div>
    </section>
  );
}

function UsersPanel({
  users,
  onEdit,
  onStatus,
  onDelete,
  title = 'eFruitMandi User Information',
  badge = 'Profile, role, account status',
  emptyLabel = 'No eFruitMandi users found.',
}: {
  users: AdminUser[];
  onEdit: (user: AdminUser) => void;
  onStatus: (user: AdminUser, status: string) => void;
  onDelete?: (user: AdminUser) => void;
  title?: string;
  badge?: string;
  emptyLabel?: string;
}) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">{title}</h2>
        <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-bold text-emerald-300">
          {badge}
        </span>
      </div>
      <div className="space-y-3">
        {users.map((user) => (
          <article key={user._id} className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <h3 className="truncate text-base font-bold text-white">{user.profileName || user.businessName || user.orchardName || user.name || 'Unnamed user'}</h3>
                <p className="mt-1 text-sm font-semibold text-slate-400">{user.email || 'No email'} | {user.phone || 'No phone'}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
                  <span className="rounded-full bg-slate-900 px-2 py-1 text-slate-300">Role: {user.roleType || user.role || 'not set'}</span>
                  <span className="rounded-full bg-slate-900 px-2 py-1 text-slate-300">KYC: {user.kyc?.status || 'NOT_SUBMITTED'}</span>
                  <span className="rounded-full bg-slate-900 px-2 py-1 text-slate-300">Status: {user.accountStatus || 'ACTIVE'}</span>
                  <span className="rounded-full bg-slate-900 px-2 py-1 text-slate-300">{user.isVerified ? 'Verified' : 'Not verified'}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => onEdit(user)} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-500">
                  Edit Info
                </button>
                <button onClick={() => onStatus(user, 'ACTIVE')} className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-bold text-white hover:bg-slate-700">
                  Active
                </button>
                <button onClick={() => onStatus(user, 'HOLD')} className="rounded-lg bg-amber-700 px-3 py-2 text-sm font-bold text-white hover:bg-amber-600">
                  Hold
                </button>
                <button onClick={() => onStatus(user, 'SUSPENDED')} className="rounded-lg bg-red-800 px-3 py-2 text-sm font-bold text-white hover:bg-red-700">
                  Suspend
                </button>
                {onDelete && (
                  <button onClick={() => onDelete(user)} className="rounded-lg bg-rose-700 px-3 py-2 text-sm font-bold text-white hover:bg-rose-600">
                    Delete Profile
                  </button>
                )}
              </div>
            </div>
          </article>
        ))}
        {!users.length && <EmptyState label={emptyLabel} />}
      </div>
    </section>
  );
}

function AdminUsersPanel({
  apiBase,
  authHeaders,
  activePage,
  admins,
  onCreate,
  onAction,
  onChangeClass,
  onView,
}: {
  apiBase: string;
  authHeaders: Record<string, string>;
  activePage: string;
  admins: AdminAccount[];
  onCreate: (payload: { name: string; email: string; phone: string; adminClass: string; role: string; status: string }) => void;
  onAction: (admin: AdminAccount, action: 'approve' | 'reject' | 'suspend' | 'activate' | 'reset-password') => void;
  onChangeClass: (admin: AdminAccount) => void;
  onView: (admin: AdminAccount) => void;
}) {
  const [draft, setDraft] = useState({
    name: '',
    email: '',
    phone: '',
    adminClass: 'CLASS_III',
    role: 'EMPLOYEE',
    status: 'PENDING',
  });
  const updateDraft = (field: keyof typeof draft, value: string) => setDraft((current) => ({ ...current, [field]: value }));
  const submitDraft = (event: FormEvent) => {
    event.preventDefault();
    onCreate(draft);
  };

  if (activePage === 'Create Admin') {
    return (
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-white">Create Admin</h2>
          <p className="mt-1 text-sm font-semibold text-slate-400">Assign class, role, and initial status. New admins must verify OTP and set password on first login.</p>
        </div>
        <form onSubmit={submitDraft} className="grid gap-4 lg:grid-cols-2">
          <AdminInput label="Name" value={draft.name} onChange={(value) => updateDraft('name', value)} placeholder="Admin name" />
          <AdminInput label="Email" value={draft.email} onChange={(value) => updateDraft('email', value)} placeholder="admin@orchardgrowers.in" type="email" />
          <AdminInput label="Phone Optional" value={draft.phone} onChange={(value) => updateDraft('phone', value)} placeholder="Phone number" />
          <label className="block text-sm font-bold text-slate-300">
            Admin Class
            <select value={draft.adminClass} onChange={(event) => updateDraft('adminClass', event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-white outline-none focus:border-emerald-400">
              <option value="CLASS_II">CLASS_II</option>
              <option value="CLASS_III">CLASS_III</option>
            </select>
          </label>
          <label className="block text-sm font-bold text-slate-300">
            Role / Department / Unit Access
            <select value={draft.role} onChange={(event) => updateDraft('role', event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-white outline-none focus:border-emerald-400">
              {Object.keys(adminRoleLabels).filter((role) => role !== 'SUPER_ADMIN' && role !== 'ADMIN').map((role) => (
                <option key={role} value={role}>{adminRoleLabels[role as AdminRole]}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-bold text-slate-300">
            Initial Status
            <select value={draft.status} onChange={(event) => updateDraft('status', event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-white outline-none focus:border-emerald-400">
              <option value="PENDING">PENDING</option>
              <option value="ACTIVE">ACTIVE</option>
            </select>
          </label>
          <div className="lg:col-span-2">
            <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500">
              Save Admin
            </button>
          </div>
        </form>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <BusinessMailSenderAccessManager apiBase={apiBase} authHeaders={authHeaders} />
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">{activePage === 'Approved Admins' ? 'Approved Admins' : 'Admin Users / Admin Management'}</h2>
          <p className="mt-1 text-sm font-semibold text-slate-400">Class I approval, class changes, status control, and first-login password setup.</p>
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="min-w-[1100px] w-full divide-y divide-slate-800 text-left text-sm">
          <thead className="bg-slate-950 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              {['Name', 'Email', 'Phone', 'Admin Class', 'Role', 'Status', 'Created At', 'Approved By', 'Actions'].map((header) => (
                <th key={header} className="px-3 py-3">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-900">
            {admins.map((admin) => {
              const approvedBy = typeof admin.approvedBy === 'object' ? admin.approvedBy?.email || admin.approvedBy?.name : admin.approvedBy || (admin.status === 'ACTIVE' ? 'Approved' : '');
              return (
                <tr key={admin._id || admin.id || admin.email}>
                  <td className="px-3 py-3 font-bold text-white">{admin.name || 'Unnamed admin'}</td>
                  <td className="px-3 py-3 text-slate-300">{admin.email || 'No email'}</td>
                  <td className="px-3 py-3 text-slate-300">{admin.phone || 'Optional'}</td>
                  <td className="px-3 py-3 text-slate-300">{admin.adminClass || 'CLASS_III'}</td>
                  <td className="px-3 py-3 text-slate-300">{admin.roleLabel || admin.role || 'EMPLOYEE'}</td>
                  <td className="px-3 py-3">
                    <span className="rounded-full bg-slate-800 px-2 py-1 text-xs font-bold text-emerald-300">{admin.status || 'PENDING'}</span>
                  </td>
                  <td className="px-3 py-3 text-slate-400">{formatDate(admin.createdAt)}</td>
                  <td className="px-3 py-3 text-slate-400">{approvedBy || 'Not approved'}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => onAction(admin, 'approve')} className="rounded-lg bg-emerald-700 px-2 py-1 text-xs font-bold text-white hover:bg-emerald-600">Approve</button>
                      <button onClick={() => onAction(admin, 'reject')} className="rounded-lg bg-rose-800 px-2 py-1 text-xs font-bold text-white hover:bg-rose-700">Reject</button>
                      <button onClick={() => onAction(admin, 'suspend')} className="rounded-lg bg-amber-700 px-2 py-1 text-xs font-bold text-white hover:bg-amber-600">Suspend</button>
                      <button onClick={() => onAction(admin, 'activate')} className="rounded-lg bg-slate-700 px-2 py-1 text-xs font-bold text-white hover:bg-slate-600">Activate</button>
                      <button onClick={() => onChangeClass(admin)} className="rounded-lg bg-slate-700 px-2 py-1 text-xs font-bold text-white hover:bg-slate-600">Change Class</button>
                      <button onClick={() => onAction(admin, 'reset-password')} className="rounded-lg bg-slate-700 px-2 py-1 text-xs font-bold text-white hover:bg-slate-600">Reset Password</button>
                      <button onClick={() => onView(admin)} className="rounded-lg bg-white px-2 py-1 text-xs font-bold text-slate-950 hover:bg-emerald-100">View Details</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!admins.length && <EmptyState label="No admin users found." />}
      </div>
      </section>
    </div>
  );
}

function SimpleAdminPanel({ title, text }: { title: string; text: string }) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <h2 className="text-lg font-bold text-white">{title}</h2>
      <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-400">{text}</p>
      <div className="mt-5 rounded-xl border border-dashed border-slate-700 bg-slate-950 p-5 text-sm font-semibold text-slate-500">
        Admin workflow controls will appear here as this module is expanded.
      </div>
    </section>
  );
}

const formatAdminMoney = (value?: number) =>
  `Rs. ${Number(value || 0).toLocaleString('en-IN')}`;

const getAdminRecordKey = (record: { _id?: string; id?: string }, fallback: string) =>
  record._id || record.id || fallback;

function EfruitErpDashboardPanel({ dashboard }: { dashboard: AdminErpDashboard | null }) {
  const kpis = dashboard?.kpis || {};
  const cards = [
    { label: "Today's GMV", value: formatAdminMoney(kpis.todayGmv) },
    { label: "Today's Revenue", value: formatAdminMoney(kpis.todayRevenue) },
    { label: 'Escrow Balance', value: formatAdminMoney(kpis.escrowBalance) },
    { label: 'Pending Settlements', value: kpis.pendingSettlements || 0 },
  ];

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-white">ERP Control Center</h2>
        <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-bold text-emerald-300">
          {dashboard?.generatedAt ? formatDate(dashboard.generatedAt) : 'Live view'}
        </span>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <MetricCard key={card.label} label={card.label} value={card.value} />
        ))}
      </div>
      {!dashboard && (
        <div className="mt-4">
          <EmptyState label="ERP metrics will appear after the admin ERP API is available." />
        </div>
      )}
    </section>
  );
}

function BusinessMailSenderAccessManager({ apiBase, authHeaders }: {
  apiBase: string;
  authHeaders: Record<string, string>;
}) {
  const [management, setManagement] = useState<BusinessMailAccessManagement | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    const loadManagement = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${apiBase}/admin/business-mail/sender-access`, { headers: authHeaders });
        const body = await readResponseJson(response);
        if (cancelled) return;
        if (response.status === 403) {
          setAvailable(false);
          return;
        }
        if (!response.ok) {
          setAvailable(true);
          setMessage(body.msg || 'Business Mail sender access could not be loaded.');
          return;
        }
        const nextManagement = body as BusinessMailAccessManagement;
        setManagement(nextManagement);
        setAvailable(true);
      } catch {
        if (!cancelled) {
          setAvailable(true);
          setMessage('Business Mail sender access could not be loaded.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void loadManagement();
    return () => { cancelled = true; };
  }, [apiBase, authHeaders]);

  if (available === false) return null;
  if (loading && available === null) {
    return <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-sm font-semibold text-slate-400">Checking Business Mail sender-access permissions...</section>;
  }
  if (!management) {
    return available ? <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><p role="alert" className="text-sm font-bold text-amber-200">{message}</p></section> : null;
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-white">Business Mail Sender Access</h2>
        <p className="mt-1 text-sm font-semibold text-slate-400">Read-only effective access derived from Business Mail roles, controlled profiles, and exact login-email matching.</p>
      </div>
      {message && <p role="status" className="mb-4 rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm font-bold text-slate-200">{message}</p>}
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-3"><h3 className="text-sm font-bold text-white">Common senders</h3><p className="mt-1 text-xs font-semibold text-slate-400">Automatically available to every eligible Business Mail admin.</p><p className="mt-2 text-sm text-slate-300">{management.commonSenderProfiles.map((profile) => profile.email).join(', ') || 'None globally enabled'}</p></div>
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-3"><h3 className="text-sm font-bold text-white">Personal sender</h3><p className="mt-1 text-xs font-semibold text-slate-400">Available only when one enabled controlled profile exactly matches the authenticated login email.</p></div>
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-3"><h3 className="text-sm font-bold text-white">Master access</h3><p className="mt-1 text-xs font-semibold text-slate-400">All globally enabled controlled profiles ({management.masterSenderProfiles.length}).</p></div>
      </div>
      {management.admins.length === 0 ? <div className="mt-4"><EmptyState label="No administrator accounts are available." /></div> : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-800">
          <table className="min-w-[980px] w-full text-left text-sm">
            <thead className="bg-slate-950 text-xs uppercase text-slate-400"><tr>{['Administrator', 'Role / Status', 'Eligible', 'Matching Personal Sender', 'Effective Senders', 'Reason'].map((heading) => <th key={heading} className="px-3 py-3 font-black">{heading}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-800 bg-slate-900">
              {management.admins.map((admin) => <tr key={admin.id} className="align-top">
                <td className="px-3 py-3"><span className="block font-bold text-white">{admin.name || 'Unnamed admin'}</span><span className="break-all text-xs text-slate-400">{admin.email}</span></td>
                <td className="px-3 py-3 text-slate-300">{admin.role || 'Unknown'}<span className="block text-xs text-slate-500">{admin.status || 'Unknown status'}</span></td>
                <td className="px-3 py-3 font-bold text-slate-200">{admin.businessMailEligible ? 'Yes' : 'No'}</td>
                <td className="px-3 py-3">{admin.matchingPersonalSenderProfile ? <><span className="block font-bold text-white">{admin.matchingPersonalSenderProfile.name}</span><span className="break-all text-xs text-slate-400">{admin.matchingPersonalSenderProfile.email}</span><span className={`mt-1 block text-xs font-bold ${admin.personalSenderAvailable ? 'text-emerald-300' : 'text-amber-300'}`}>{admin.personalSenderAvailable ? 'Globally enabled' : 'Globally disabled'}</span></> : <span className="text-slate-500">No controlled match</span>}</td>
                <td className="px-3 py-3"><span className="font-black text-white">{admin.effectiveSenderCount}</span><span className="mt-1 block text-xs text-slate-500">{admin.effectiveSenderProfiles.map((profile) => profile.email).join(', ') || 'No access'}</span></td>
                <td className="max-w-[280px] px-3 py-3 text-xs font-semibold text-slate-400">{admin.personalSenderReason}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function EfruitDealsPanel({
  orders,
  settlements,
}: {
  orders: AdminOrder[];
  settlements: AdminErpSettlement[];
}) {
  const completedDeals = orders.filter(isCompletedMarketplaceOrder);
  const escrowDeals = orders.filter((order) => COMPLETED_EFRUIT_PAYMENT_STATUSES.has(String(order.paymentStatus || '').toUpperCase()));
  const blockedSettlements = settlements.filter((settlement) =>
    ['FAILED', 'ON_HOLD', 'CANCELLED'].includes(String(settlement.status || '').toUpperCase())
  );

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <MetricCard label="Orders Tracked" value={orders.length} />
        <MetricCard label="Completed" value={completedDeals.length} />
        <MetricCard label="Escrow / Paid" value={escrowDeals.length} />
        <MetricCard label="Settlement Exceptions" value={blockedSettlements.length} />
      </div>

      {!orders.length ? (
        <EmptyState label="No confirmed marketplace deals found." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-800">
          <div className="hidden grid-cols-[1fr_1fr_0.8fr_0.8fr_1fr] gap-3 bg-slate-950 px-3 py-2 text-xs font-black uppercase tracking-wide text-slate-400 lg:grid">
            <span>Deal</span>
            <span>Customer</span>
            <span>Payment</span>
            <span>Delivery</span>
            <span>Settlement</span>
          </div>
          <div className="divide-y divide-slate-800">
            {orders.slice(0, 30).map((order) => (
              <article key={order._id} className="grid gap-3 bg-slate-900 px-3 py-3 text-sm lg:grid-cols-[1fr_1fr_0.8fr_0.8fr_1fr] lg:items-center">
                <div className="min-w-0">
                  <p className="truncate font-extrabold text-white">{order.invoiceNumber || order._id}</p>
                  <p className="text-xs font-semibold text-slate-400">{formatDate(order.createdAt)}</p>
                </div>
                <div className="min-w-0">
                  <p className="truncate font-bold text-slate-100">{order.customer?.name || 'Buyer'}</p>
                  <p className="text-xs font-semibold text-slate-500">{maskAdminPhone(order.customer?.phone)}</p>
                </div>
                <p className="font-bold text-emerald-300">{order.paymentStatus || 'PENDING'}</p>
                <p className="font-bold text-slate-300">{order.deliveryStatus || 'PENDING'}</p>
                <div className="text-xs font-semibold text-slate-400">
                  <p>{order.escrowStatus || order.settlementStatus || 'PENDING_BUYER_PAYMENT'}</p>
                  <p>{order.settlementEligibility?.settlementReleaseAllowed ? 'Release allowed' : 'Release blocked'}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function EfruitTransactionsPanel({
  payments,
  settlements,
  commissions,
  refunds,
}: {
  payments: AdminErpPayment[];
  settlements: AdminErpSettlement[];
  commissions: AdminErpCommission[];
  refunds: AdminErpRefund[];
}) {
  const paymentTotal = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const settlementTotal = settlements.reduce((sum, settlement) => sum + Number(settlement.netAmount || settlement.grossAmount || 0), 0);
  const commissionTotal = commissions.reduce((sum, commission) => sum + Number(commission.totalAmount || commission.commissionAmount || 0), 0);
  const refundTotal = refunds.reduce((sum, refund) => sum + Number(refund.amount || 0), 0);

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <MetricCard label="Payments" value={`${payments.length} / ${formatAdminMoney(paymentTotal)}`} />
        <MetricCard label="Settlements" value={`${settlements.length} / ${formatAdminMoney(settlementTotal)}`} />
        <MetricCard label="Commission" value={formatAdminMoney(commissionTotal)} />
        <MetricCard label="Refunds" value={`${refunds.length} / ${formatAdminMoney(refundTotal)}`} />
      </div>

      {!payments.length && !settlements.length && !commissions.length && !refunds.length ? (
        <EmptyState label="No ERP transaction records found." />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          <ErpMiniTable
            title="Payment Center"
            rows={payments.slice(0, 20).map((payment, index) => ({
              key: getAdminRecordKey(payment, `payment-${index}`),
              primary: payment.provider || 'Gateway',
              secondary: payment.gatewayOrderId || payment.sourceOrder || 'Order',
              amount: payment.amount,
              status: payment.status || payment.paymentGatewayStatus || 'PENDING',
            }))}
          />
          <ErpMiniTable
            title="Settlement Center"
            rows={settlements.slice(0, 20).map((settlement, index) => ({
              key: getAdminRecordKey(settlement, `settlement-${index}`),
              primary: settlement.beneficiaryType || 'Beneficiary',
              secondary: settlement.beneficiaryName || settlement.sourceOrder || 'Order',
              amount: settlement.netAmount || settlement.grossAmount,
              status: settlement.status || 'PENDING',
            }))}
          />
          <ErpMiniTable
            title="Commission Center"
            rows={commissions.slice(0, 20).map((commission, index) => ({
              key: getAdminRecordKey(commission, `commission-${index}`),
              primary: commission.invoiceNumber || commission.sourceOrder || commission.sourceQuote || 'Commission',
              secondary: `${commission.commissionPercent || 0}% service fee`,
              amount: commission.totalAmount || commission.commissionAmount,
              status: commission.status || 'ACCRUED',
            }))}
          />
          <ErpMiniTable
            title="Refund Center"
            rows={refunds.slice(0, 20).map((refund, index) => ({
              key: getAdminRecordKey(refund, `refund-${index}`),
              primary: refund.provider || 'Refund',
              secondary: refund.reason || refund.sourceOrder || 'Order',
              amount: refund.amount,
              status: refund.status || 'REQUESTED',
            }))}
          />
        </div>
      )}
    </section>
  );
}

function EfruitSupportDisputesPanel({
  tickets,
  refunds,
}: {
  tickets: AdminErpTicket[];
  refunds: AdminErpRefund[];
}) {
  const openTickets = tickets.filter((ticket) => !['RESOLVED', 'CLOSED', 'CANCELLED'].includes(String(ticket.status || '').toUpperCase()));
  const activeRefunds = refunds.filter((refund) => !['REFUNDED', 'REJECTED', 'CANCELLED'].includes(String(refund.status || '').toUpperCase()));

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <MetricCard label="Open Tickets" value={openTickets.length} />
        <MetricCard label="Refund Cases" value={activeRefunds.length} />
        <MetricCard label="Total Records" value={tickets.length + refunds.length} />
      </div>
      {!tickets.length && !refunds.length ? (
        <EmptyState label="No support, dispute, or refund cases found." />
      ) : (
        <ErpMiniTable
          title="Support Queue"
          rows={[
            ...tickets.map((ticket, index) => ({
              key: getAdminRecordKey(ticket, `ticket-${index}`),
              primary: ticket.ticketNumber || ticket.type || 'Ticket',
              secondary: ticket.subject || formatDate(ticket.createdAt),
              status: ticket.status || 'OPEN',
            })),
            ...refunds.map((refund, index) => ({
              key: getAdminRecordKey(refund, `refund-case-${index}`),
              primary: refund.provider || 'Refund',
              secondary: refund.reason || refund.sourceOrder || 'Order',
              amount: refund.amount,
              status: refund.status || 'REQUESTED',
            })),
          ].slice(0, 30)}
        />
      )}
    </section>
  );
}

function EfruitAnalyticsPanel({ dashboard }: { dashboard: AdminErpDashboard | null }) {
  const topFruits = dashboard?.topFruits || [];
  const topBuyers = dashboard?.topBuyers || [];
  const topGrowers = dashboard?.topGrowers || [];
  const topStates = dashboard?.topStates || [];
  const growth = dashboard?.growthAnalytics || [];

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      {!dashboard ? (
        <EmptyState label="Analytics will appear after the admin ERP API is available." />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          <ErpMiniTable
            title="Top Fruits"
            rows={topFruits.map((fruit, index) => ({
              key: `${fruit.fruit || 'fruit'}-${index}`,
              primary: fruit.fruit || 'Fruit',
              secondary: `${fruit.lots || 0} lots`,
              amount: fruit.quantity,
              status: 'LOTS',
            }))}
          />
          <ErpMiniTable
            title="Top Buyers"
            rows={topBuyers.map((buyer, index) => ({
              key: buyer.id || `buyer-${index}`,
              primary: buyer.name || 'Buyer',
              secondary: `${buyer.deals || 0} deals`,
              amount: buyer.amount,
              status: 'GMV',
            }))}
          />
          <ErpMiniTable
            title="Top Growers"
            rows={topGrowers.map((grower, index) => ({
              key: grower.id || `grower-${index}`,
              primary: grower.name || 'Grower',
              secondary: `${grower.deals || 0} deals`,
              amount: grower.amount,
              status: 'GMV',
            }))}
          />
          <ErpMiniTable
            title="Top States"
            rows={topStates.map((state, index) => ({
              key: `${state.state || 'state'}-${index}`,
              primary: state.state || 'State',
              secondary: `${state.deals || 0} deals`,
              amount: state.amount,
              status: 'GMV',
            }))}
          />
          <div className="xl:col-span-2">
            <ErpMiniTable
              title="Growth Analytics"
              rows={growth.map((row, index) => ({
                key: row.date || `growth-${index}`,
                primary: row.date || 'Date',
                secondary: `${row.deals || 0} deals | ${formatAdminMoney(row.commission)}`,
                amount: row.gmv,
                status: 'GMV',
              }))}
            />
          </div>
        </div>
      )}
    </section>
  );
}

function ErpMiniTable({
  title,
  rows,
}: {
  title: string;
  rows: { key: string; primary: string; secondary?: string; amount?: number; status?: string }[];
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-800">
      <div className="flex items-center justify-between gap-3 bg-slate-950 px-3 py-2">
        <p className="text-sm font-black text-white">{title}</p>
        <span className="rounded-full bg-slate-800 px-2 py-1 text-[10px] font-bold text-emerald-300">
          {rows.length}
        </span>
      </div>
      {!rows.length ? (
        <div className="p-4">
          <EmptyState label="No records found." />
        </div>
      ) : (
        <div className="divide-y divide-slate-800">
          {rows.map((row) => (
            <div key={row.key} className="grid gap-2 bg-slate-900 px-3 py-3 text-sm md:grid-cols-[1fr_0.9fr_0.7fr] md:items-center">
              <div className="min-w-0">
                <p className="truncate font-extrabold text-white">{row.primary}</p>
                <p className="truncate text-xs font-semibold text-slate-500">{row.secondary || 'Not available'}</p>
              </div>
              <p className="font-bold text-emerald-300">{row.amount === undefined ? '-' : formatAdminMoney(row.amount)}</p>
              <span className="w-fit rounded-full bg-slate-800 px-2.5 py-1 text-xs font-black uppercase text-slate-200">
                {row.status || 'OPEN'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AdminQuotesPanel({ quotes }: { quotes: AdminQuote[] }) {
  const totalValue = quotes.reduce((sum, quote) => sum + Number(quote.baseDealAmount || quote.quotedTotalValue || 0), 0);
  const accepted = quotes.filter((quote) => normalizeAdminQuoteStatus(quote.status) === 'accepted').length;
  const pending = quotes.filter((quote) => normalizeAdminQuoteStatus(quote.status) === 'pending').length;

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <MetricCard label="Total Offers" value={quotes.length} />
        <MetricCard label="Pending Offers" value={pending} />
        <MetricCard label="Accepted Deals" value={`${accepted} / Rs. ${totalValue.toLocaleString('en-IN')}`} />
      </div>

      {!quotes.length ? (
        <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950 p-5 text-sm font-semibold text-slate-500">
          No buyer offers have been submitted yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-800">
          <div className="hidden grid-cols-[1.1fr_0.9fr_0.9fr_1fr_1fr_0.8fr] gap-3 bg-slate-950 px-3 py-2 text-xs font-black uppercase tracking-wide text-slate-400 lg:grid">
            <span>Lot</span>
            <span>Buyer</span>
            <span>Grower</span>
            <span>Settlement</span>
            <span>Charges</span>
            <span>Status</span>
          </div>
          <div className="divide-y divide-slate-800">
            {quotes.map((quote) => (
              <article key={quote._id} className="grid gap-3 bg-slate-900 px-3 py-3 text-sm lg:grid-cols-[1.1fr_0.9fr_0.9fr_1fr_1fr_0.8fr] lg:items-center">
                <div className="min-w-0">
                  <p className="truncate font-extrabold text-white">{quote.lotTitle || 'Fruit Lot'}</p>
                  <p className="text-xs font-semibold text-slate-400">{quote.lotQuantity || 0} boxes | {quote.fruitType || 'Fruit'}</p>
                </div>
                <div className="min-w-0">
                  <p className="truncate font-bold text-slate-100">{quote.buyerName || 'Buyer'}</p>
                  <p className="text-xs font-semibold text-slate-500">{maskAdminPhone(quote.buyerPhone)}</p>
                </div>
                <p className="min-w-0 truncate font-bold text-slate-100">{quote.growerName || 'Grower'}</p>
                <div>
                  <p className="font-black text-emerald-300">Buyer Bid Rate Rs. {Number(quote.quotedPrice || 0).toLocaleString('en-IN')}</p>
                  <p className="text-xs font-semibold text-slate-400">Buyer Bid Total Rs. {Number(quote.baseDealAmount || quote.quotedTotalValue || 0).toLocaleString('en-IN')}</p>
                  <p className="text-xs font-semibold text-slate-400">Platform Payable Rs. {Number(quote.buyerPayableThroughPlatform || quote.buyerPayable || 0).toLocaleString('en-IN')}</p>
                  <p className="text-xs font-semibold text-slate-400">Grower Net Rs. {Number(quote.growerReceivable || quote.sellerReceivable || 0).toLocaleString('en-IN')}</p>
                </div>
                <div className="text-xs font-semibold text-slate-400">
                  <p>Platform Service Fee Rs. {Number(quote.platformServiceFee || quote.commissionAmount || 0).toLocaleString('en-IN')}</p>
                  <p>Platform Revenue Rs. {Number(quote.platformServiceFee || quote.commissionAmount || 0).toLocaleString('en-IN')}</p>
                  <p>Logistics Charge Rs. {Number(quote.logisticsChargePerUnit || 0).toLocaleString('en-IN')} / unit</p>
                  <p>Logistics Total Rs. {Number(quote.logisticsAmount || 0).toLocaleString('en-IN')}</p>
                  <p>Labour Rs. {Number(quote.labourChargePerUnit || 0).toLocaleString('en-IN')} (Buyer Managed)</p>
                </div>
                <AdminQuoteStatusBadge status={quote.status} />
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function AdminQuoteStatusBadge({ status }: { status?: string }) {
  const normalized = normalizeAdminQuoteStatus(status);
  const classes =
    normalized === 'accepted'
      ? 'bg-emerald-500 text-white'
      : normalized === 'rejected' || normalized === 'closed'
        ? 'bg-slate-700 text-slate-200'
        : 'bg-amber-300 text-amber-950';
  return (
    <span className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-black uppercase ${classes}`}>
      {normalized}
    </span>
  );
}

function normalizeAdminQuoteStatus(status = '') {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'submitted') return 'pending';
  if (normalized === 'expired') return 'closed';
  return normalized || 'pending';
}

function maskAdminPhone(phone = '') {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 4) return 'Phone hidden';
  return `${digits.slice(0, 2)}XXXX${digits.slice(-2)}`;
}

function MetricCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <p className="text-sm font-bold text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-black text-white">{value}</p>
    </div>
  );
}

function AdminInput({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block text-sm font-bold text-slate-300">
      {label}
      <input
        value={value}
        type={type}
        disabled={disabled}
        readOnly={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={`mt-2 h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 outline-none placeholder:text-slate-600 ${disabled ? 'text-slate-400' : 'text-white focus:border-emerald-400'}`}
      />
    </label>
  );
}

function NotificationsPanel({
  kycRequests,
  verificationRequests,
  onOpenTab,
}: {
  kycRequests: KycUser[];
  verificationRequests: VerificationRequest[];
  onOpenTab: (tab: AdminTab) => void;
}) {
  const pendingKyc = kycRequests.filter((user) =>
    ['PENDING', 'COMPLETED', 'UNDER_REVIEW', 'CORRECTION_REQUIRED'].includes(String(user.kyc?.status || '').toUpperCase())
  );
  const pendingVerification = verificationRequests.filter((request) => request.status === 'SUBMITTED');

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">eFruitMandi Review Alerts</h2>
        <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-bold text-emerald-300">
          {pendingKyc.length + pendingVerification.length} pending
        </span>
      </div>
      <div className="space-y-3">
        {pendingKyc.map((user) => (
          <NotificationItem
            key={`kyc-${user._id}`}
            title={`${user.businessName || user.name || 'User'} submitted KYC`}
            detail="Authority verification required within 24 hours."
            action="Review KYC"
            onClick={() => onOpenTab('kyc')}
          />
        ))}
        {pendingVerification.map((request) => (
          <NotificationItem
            key={`verification-${request._id}`}
            title={`${request.orchardName} requested verification`}
            detail="Class1 and Class2 approval required."
            action="Review Request"
            onClick={() => onOpenTab('kyc')}
          />
        ))}
        {!pendingKyc.length && !pendingVerification.length && <EmptyState />}
      </div>
    </section>
  );
}

function OrdersPanel({ orders }: { orders: AdminOrder[] }) {
  return (
    <RequestSection title="Placed Orders" count={orders.length}>
      {orders.map((order) => (
        <article key={order._id} className="rounded-xl border border-slate-800 bg-slate-950 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className="text-base font-bold text-white">{order.invoiceNumber || order._id}</h3>
              <p className="mt-1 text-xs font-semibold text-emerald-300">Buyer Invoice No: {order.invoiceNumber || '-'}</p>
              <p className="mt-1 text-sm font-semibold text-slate-400">
                {order.customer?.name || 'Customer'} - {order.customer?.phone || 'No phone'}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {order.shippingAddress?.city || 'City'}, {order.shippingAddress?.state || 'State'} {order.shippingAddress?.pinCode || ''}
              </p>
            </div>
            <div className="text-left lg:text-right">
              <p className="text-lg font-black text-emerald-300">Rs. {order.totalAmount || 0}</p>
              <p className="text-xs font-bold text-slate-400">{order.paymentStatus} / {order.deliveryStatus}</p>
              <p className="text-xs font-bold text-slate-500">Settlement: {order.settlementStatus || order.escrowStatus || '-'}</p>
            </div>
          </div>
          <div className="mt-4 grid gap-2 text-sm text-slate-300 md:grid-cols-3">
            <Info label="Commission Invoice" value={order.commissionInvoiceNumber || 'Pending'} />
            <Info label="Commission Receipt" value={order.commissionReceiptNumber || 'Pending'} />
            <Info label="BillDesk Ref" value={order.paymentReference || order.paymentGatewayStatus || 'Pending'} />
            <Info label="GST / Tax" value={`${order.commissionGstPercent || 0}% | Rs. ${order.commissionGstAmount || 0}`} />
            <Info label="Commission Total" value={`Rs. ${order.commissionTotalAmount || order.commissionTaxableAmount || 0}`} />
            <Info label="Payment Gateway" value={order.paymentGateway || 'BillDesk'} />
          </div>
          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900 p-3">
            <p className="text-sm font-bold text-white">Items</p>
            <div className="mt-2 space-y-2">
              {(order.items || []).map((item, index) => (
                <div key={`${item.title}-${index}`} className="flex justify-between gap-3 text-sm text-slate-300">
                  <span>{item.title} x {item.quantity || 1}</span>
                  <span>Rs. {item.lineTotal || (Number(item.quantity || 1) * Number(item.unitPrice || 0))}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-3 grid gap-2 text-sm text-slate-300 md:grid-cols-3">
            <Info label="Courier" value={order.courierPartner || 'India Post'} />
            <Info label="Booking" value={order.courierBookingStatus || 'PENDING'} />
            <Info label="Tracking" value={order.trackingNumber || 'Not assigned'} />
          </div>
          <div className="mt-3 grid gap-2 text-sm text-slate-300 md:grid-cols-3">
            <Info label="Logistics Assignment" value={order.logisticsAssignment?.status || 'AWAITING_GROWER_DETAILS'} />
            <Info label="Driver" value={order.logisticsAssignment?.driverName || order.logisticsAssignment?.assignedLogisticsAccount?.logisticsName || 'Not assigned'} />
            <Info label="Driver Mobile" value={order.logisticsAssignment?.driverMobile || 'Not provided'} />
            <Info label="Vehicle" value={[order.logisticsAssignment?.vehicleNumber, order.logisticsAssignment?.vehicleType].filter(Boolean).join(' / ') || 'Not provided'} />
            <Info label="Registration / KYC" value={`${order.logisticsAssignment?.registrationStatus || '-'} / ${order.logisticsAssignment?.kycStatus || '-'}`} />
            <Info label="Escrow Hold" value={order.escrowStatus || 'PENDING_BUYER_PAYMENT'} />
          </div>
          <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900 p-3">
            <p className="text-sm font-bold text-white">Settlement Eligibility</p>
            <div className="mt-2 grid gap-2 text-xs text-slate-300 md:grid-cols-4">
              <Info label="Payment Received" value={order.settlementEligibility?.buyerPaymentReceived ? 'TRUE' : 'FALSE'} />
              <Info label="Delivered" value={order.settlementEligibility?.consignmentDelivered ? 'TRUE' : 'FALSE'} />
              <Info label="Logistics Accepted" value={order.settlementEligibility?.logisticsAccepted ? 'TRUE' : 'FALSE'} />
              <Info label="Release Allowed" value={order.settlementEligibility?.settlementReleaseAllowed ? 'TRUE' : 'FALSE'} />
              <Info label="Grower KYC" value={order.settlementEligibility?.growerKycVerified ? 'VERIFIED' : 'PENDING'} />
              <Info label="Logistics KYC" value={order.settlementEligibility?.logisticsKycVerified ? 'VERIFIED' : 'PENDING'} />
              <Info label="Platform KYC" value={order.settlementEligibility?.platformKycVerified ? 'VERIFIED' : 'PENDING'} />
              <Info label="Logistics Settlement" value={order.logisticsAssignment?.settlementEligible ? 'ELIGIBLE' : 'BLOCKED'} />
            </div>
            {!!order.beneficiaryMapping?.length && (
              <div className="mt-3 grid gap-2 md:grid-cols-3">
                {order.beneficiaryMapping.map((beneficiary) => (
                  <div key={`${order._id}-${beneficiary.beneficiaryType}`} className="rounded-lg border border-slate-800 bg-slate-950 p-2 text-xs text-slate-300">
                    <p className="font-black text-emerald-300">{beneficiary.beneficiaryType}</p>
                    <p>KYC: {beneficiary.kycStatus || '-'}</p>
                    <p>Bank/UPI: {beneficiary.bankOrUpiVerified ? 'Verified' : 'Pending'}</p>
                    <p>Amount: Rs. {beneficiary.settlementAmount || 0}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </article>
      ))}
    </RequestSection>
  );
}

function getEfruitDocumentType(order: AdminOrder) {
  return String(order.paymentMethod || '').toUpperCase() === 'COD' ? 'Chalan' : 'Invoice';
}

const COMPLETED_EFRUIT_PAYMENT_STATUSES = new Set(['ESCROW', 'PAID', 'RELEASED']);
const COMPLETED_EFRUIT_DELIVERY_STATUSES = new Set(['DELIVERED']);

function isCompletedMarketplaceOrder(order: AdminOrder) {
  return (
    COMPLETED_EFRUIT_PAYMENT_STATUSES.has(String(order.paymentStatus || '').toUpperCase()) ||
    COMPLETED_EFRUIT_DELIVERY_STATUSES.has(String(order.deliveryStatus || '').toUpperCase())
  );
}

function getEfruitDocumentAmount(order: AdminOrder) {
  return order.finalPrice || order.totalAmount || order.auctionPrice || order.sellerReceivable || order.growerPayout || 0;
}

function buildAdminDocumentHtml(order: AdminOrder) {
  const documentType = getEfruitDocumentType(order);
  const rows = order.items?.length
    ? order.items
    : [{ title: 'Fruit lot', quantity: 1, lineTotal: getEfruitDocumentAmount(order) }];

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${documentType} ${order.invoiceNumber || order._id}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #0f172a; padding: 28px; }
    .top { display: flex; justify-content: space-between; gap: 20px; border-bottom: 2px solid #10b981; padding-bottom: 14px; }
    h1 { margin: 0; color: #047857; }
    table { width: 100%; border-collapse: collapse; margin-top: 22px; }
    th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; }
    th { background: #ecfdf5; }
    .total { margin-top: 18px; font-size: 20px; font-weight: 800; text-align: right; }
  </style>
</head>
<body>
  <div class="top">
    <div>
      <h1>eFruitMandi ${documentType}</h1>
      <p><strong>Document No:</strong> ${order.invoiceNumber || order._id}</p>
      <p><strong>Date:</strong> ${formatDate(order.invoiceDate || order.createdAt)}</p>
    </div>
    <div>
      <p><strong>Customer:</strong> ${order.customer?.name || 'Customer'}</p>
      <p><strong>Phone:</strong> ${order.customer?.phone || '-'}</p>
      <p><strong>Status:</strong> ${order.paymentStatus || '-'} / ${order.deliveryStatus || '-'}</p>
    </div>
  </div>
  <table>
    <thead><tr><th>Item</th><th>Qty</th><th>Amount</th></tr></thead>
    <tbody>
      ${rows.map((item) => `<tr><td>${item.title || 'Fruit lot'}</td><td>${item.quantity || 1}</td><td>Rs. ${item.lineTotal || 0}</td></tr>`).join('')}
    </tbody>
  </table>
  <p class="total">Total: Rs. ${getEfruitDocumentAmount(order)}</p>
</body>
</html>`;
}

function downloadAdminDocument(order: AdminOrder) {
  const type = getEfruitDocumentType(order).toLowerCase();
  const blob = new Blob([buildAdminDocumentHtml(order)], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${type}-${order.invoiceNumber || order._id}.html`.replace(/[^\w.-]+/g, '-');
  link.click();
  URL.revokeObjectURL(url);
}

function printAdminDocument(order: AdminOrder) {
  const printWindow = window.open('', '_blank', 'noopener,noreferrer');
  if (!printWindow) return;
  printWindow.document.write(buildAdminDocumentHtml(order));
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

function EfruitInvoiceChalanPanel({ orders }: { orders: AdminOrder[] }) {
  const documents = orders.filter(isCompletedMarketplaceOrder);

  return (
    <RequestSection title="eFruitMandi Invoices / Chalan" count={documents.length}>
      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-950 text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-3 py-3">Document</th>
              <th className="px-3 py-3">Customer</th>
              <th className="px-3 py-3">Amount</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-900">
            {documents.map((order) => (
              <tr key={order._id}>
                <td className="px-3 py-3">
                  <p className="font-bold text-white">{order.invoiceNumber || order._id}</p>
                  <p className="text-xs font-bold text-emerald-300">{getEfruitDocumentType(order)} - {formatDate(order.invoiceDate || order.createdAt)}</p>
                </td>
                <td className="px-3 py-3 text-slate-300">
                  <p className="font-bold">{order.customer?.name || 'Customer'}</p>
                  <p className="text-xs text-slate-500">{order.customer?.phone || 'No phone'}</p>
                </td>
                <td className="px-3 py-3 font-black text-emerald-300">Rs. {getEfruitDocumentAmount(order)}</td>
                <td className="px-3 py-3 text-slate-300">{order.paymentStatus || 'PENDING'} / {order.deliveryStatus || 'PENDING'}</td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => downloadAdminDocument(order)} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500">
                      Download
                    </button>
                    <button type="button" onClick={() => printAdminDocument(order)} className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-600">
                      Print
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!documents.length && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center font-bold text-slate-400">No eFruitMandi invoice or chalan records found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </RequestSection>
  );
}

function LogisticsControlPanel({
  orders,
  authHeaders,
  onUpdated,
  activePage,
}: {
  orders: AdminOrder[];
  authHeaders: HeadersInit;
  onUpdated: () => void;
  activePage: string;
}) {
  type LogisticsMode = 'manual' | 'automatic';
  type LogisticsDraft = {
    _id?: string;
    orderId: string;
    platform: string;
    courierMode: string;
    selectedCourier: string;
    courierPriority: string;
    serviceType: string;
    pickupDate: string;
    pickupTimeSlot: string;
    expectedDeliveryDate: string;
    awbNumber: string;
    trackingUrl: string;
    labelUrl: string;
    invoiceUrl: string;
    shipmentStatus: string;
    customerDetails: Record<string, string>;
    pickupDetails: Record<string, string>;
    packageDetails: Record<string, string | boolean>;
    plantDetails: Record<string, string | boolean>;
    fruitLotDetails: Record<string, string | boolean>;
    invoiceDetails: Record<string, string | boolean>;
    serviceabilityResults: LogisticsRateResult[];
    rateResults: LogisticsRateResult[];
  };
  type LogisticsRateResult = { courier: string; serviceable: boolean; estimatedCost?: number; eta?: string; reason?: string };

  const platform = activePage === 'eFruitMandi' ? 'efruitmandi' : 'orchardgrowers';
  const [logisticsOrders, setLogisticsOrders] = useState<LogisticsDraft[]>([]);
  const [draft, setDraft] = useState<LogisticsDraft>(() => makeLogisticsDraft(platform));
  const [notice, setNotice] = useState('');
  const [loadingAction, setLoadingAction] = useState('');

  useEffect(() => {
    let ignore = false;
    const loadLogisticsOrders = async () => {
      try {
        const res = await fetch(`${API_BASE}/logistics/orders`, { headers: authHeaders });
        const data = await readResponseJson(res);
        if (!res.ok) throw new Error(data.msg || 'Could not load logistics orders');
        if (ignore) return;
        let sourceOrders = data.orders || [];
        if (platform === 'efruitmandi') {
          const efruitRes = await fetch(`${API_BASE}/admin/efruitmandi/orders`, { headers: authHeaders });
          const efruitData = await readResponseJson(efruitRes);
          if (efruitRes.ok) {
            const existingKeys = new Set(sourceOrders.map((item: Record<string, unknown>) => `${item.platform}:${item.orderId}`));
            sourceOrders = [
              ...sourceOrders,
              ...(efruitData.orders || []).filter((item: Record<string, unknown>) => !existingKeys.has(`${item.platform}:${item.orderId}`)),
            ];
          }
        }
        const nextOrders = sourceOrders.map((item: Record<string, unknown>) => normalizeLogisticsDraft(item, platform));
        setLogisticsOrders(nextOrders);
        const selected = nextOrders.find((item: LogisticsDraft) => item.platform === platform) || nextOrders[0];
        if (selected) setDraft(selected);
      } catch (err) {
        if (!ignore) {
          const fallback = orders.map((order) => logisticsDraftFromAdminOrder(order, platform));
          setLogisticsOrders(fallback);
          setDraft(fallback.find((item) => item.platform === platform) || makeLogisticsDraft(platform));
          setNotice(err instanceof Error ? err.message : 'Could not load logistics orders');
        }
      }
    };
    loadLogisticsOrders();
    return () => {
      ignore = true;
    };
  }, [authHeaders, orders, platform]);

  useEffect(() => {
    if (draft.platform !== platform) {
      const selected = logisticsOrders.find((item) => item.platform === platform);
      setDraft(selected || makeLogisticsDraft(platform));
    }
  }, [platform, draft.platform, logisticsOrders]);

  const visibleOrders = logisticsOrders.filter((item) => item.platform === platform);
  const volumetricWeightKg = calculateVolumetricWeight(draft.packageDetails.lengthCm, draft.packageDetails.widthCm, draft.packageDetails.heightCm);

  const updateRoot = (field: keyof LogisticsDraft, value: string | LogisticsRateResult[]) =>
    setDraft((current) => ({ ...current, [field]: value }));
  const updateGroup = (group: 'customerDetails' | 'pickupDetails' | 'packageDetails' | 'plantDetails' | 'fruitLotDetails' | 'invoiceDetails', field: string, value: string | boolean) =>
    setDraft((current) => ({ ...current, [group]: { ...current[group], [field]: value } }));
  const updateMode = (mode: LogisticsMode) => {
    setDraft((current) => ({
      ...current,
      courierMode: mode,
      selectedCourier: mode === 'automatic' ? '' : current.selectedCourier || 'India Post',
      courierPriority: mode === 'automatic' ? current.courierPriority || 'Cheapest' : 'Manual',
    }));
  };
  const logisticsRequest = async (path: string, payload?: Record<string, unknown>, method = 'POST') => {
    const res = await fetch(`${API_BASE}/logistics${path}`, {
      method,
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: method === 'GET' ? undefined : JSON.stringify(payload || draft),
    });
    const data = await readResponseJson(res);
    if (!res.ok) throw new Error(data.msg || 'Logistics request failed');
    return data;
  };
  const isIndiaPost = (draft.selectedCourier || '').toLowerCase() === 'india post';
  const runAction = async (action: string, task: () => Promise<void>) => {
    setLoadingAction(action);
    setNotice('');
    try {
      await task();
      onUpdated();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Logistics action failed');
    } finally {
      setLoadingAction('');
    }
  };
  const syncShipment = (shipment: Record<string, unknown>) => {
    const normalized = normalizeLogisticsDraft(shipment, platform);
    setDraft(normalized);
    setLogisticsOrders((current) => {
      const key = `${normalized.platform}:${normalized.orderId}`;
      const without = current.filter((item) => `${item.platform}:${item.orderId}` !== key);
      return [normalized, ...without];
    });
  };
  const validateDraft = () => {
    const checks = [
      [draft.orderId, 'Order ID'],
      [draft.customerDetails.customerName, 'Customer name'],
      [draft.customerDetails.phone, 'Mobile'],
      [draft.customerDetails.addressLine1, 'Full address'],
      [draft.customerDetails.city, 'City'],
      [draft.customerDetails.state, 'State'],
      [draft.customerDetails.pincode, 'Pincode'],
      [draft.pickupDetails.pickupAddress, 'Pickup address'],
      [draft.pickupDetails.pickupPincode, 'Pickup pincode'],
      [draft.packageDetails.productName, 'Product name'],
      [draft.packageDetails.quantity, 'Quantity'],
      [draft.packageDetails.deadWeightKg, 'Weight'],
      [draft.packageDetails.lengthCm, 'Length'],
      [draft.packageDetails.widthCm, 'Width'],
      [draft.packageDetails.heightCm, 'Height'],
      [draft.invoiceDetails.orderAmount, 'Order value'],
      [draft.invoiceDetails.paymentMode, 'Payment mode'],
    ];
    const missing = checks.filter(([value]) => !String(value || '').trim()).map(([, label]) => label);
    if (draft.courierMode === 'manual' && !draft.selectedCourier) missing.push('Courier partner');
    return missing;
  };
  const checkServiceability = () => runAction('serviceability', async () => {
    const data = await logisticsRequest(isIndiaPost ? '/india-post/pincode-check' : '/serviceability', { ...draft, packageDetails: { ...draft.packageDetails, volumetricWeightKg } });
    updateRoot('serviceabilityResults', data.results || (data.result ? [data.result] : []));
    syncShipment(data.shipment);
    setNotice(`${isIndiaPost ? 'India Post pincode' : 'Serviceability'} checked.`);
  });
  const estimateCost = () => runAction('rates', async () => {
    const data = await logisticsRequest(isIndiaPost ? '/india-post/tariff' : '/rates', { ...draft, packageDetails: { ...draft.packageDetails, volumetricWeightKg } });
    setDraft((current) => ({ ...normalizeLogisticsDraft(data.shipment, platform), rateResults: data.results || (data.result ? [data.result] : []), selectedCourier: data.selectedCourier || current.selectedCourier }));
    setNotice(`${isIndiaPost ? 'India Post tariff' : 'Courier rates'} estimated.`);
  });
  const bookShipment = () => runAction('book', async () => {
    const missing = validateDraft();
    if (missing.length) throw new Error(`Required before booking: ${missing.join(', ')}`);
    const data = await logisticsRequest(isIndiaPost ? '/india-post/book' : draft.courierMode === 'manual' ? '/manual-book' : '/book', { ...draft, packageDetails: { ...draft.packageDetails, volumetricWeightKg } });
    syncShipment(data.shipment);
    setNotice(`Shipment booked. AWB: ${data.shipment?.awbNumber || data.booking?.awbNumber || 'Generated'}`);
  });
  const generateLabel = () => runAction('label', async () => {
    const id = draft._id || draft.awbNumber;
    if (!id) throw new Error('Book shipment before generating label.');
    const data = await logisticsRequest(isIndiaPost ? `/india-post/label/${encodeURIComponent(id)}` : `/label/${encodeURIComponent(id)}`, undefined, 'GET');
    setDraft((current) => ({ ...current, labelUrl: data.labelUrl || data.label?.labelUrl || current.labelUrl, shipmentStatus: 'Label Generated' }));
    setNotice('Label generated.');
  });
  const trackShipment = () => runAction('track', async () => {
    const id = draft._id || draft.awbNumber;
    if (!id) throw new Error('Book shipment before tracking.');
    const data = await logisticsRequest(isIndiaPost && draft.awbNumber ? `/india-post/track/${encodeURIComponent(draft.awbNumber)}` : `/track/${encodeURIComponent(id)}`, undefined, 'GET');
    setDraft((current) => ({ ...current, shipmentStatus: data.tracking?.status || current.shipmentStatus }));
    setNotice(`Tracking status: ${data.tracking?.status || 'Updated'}`);
  });
  const cancelShipment = () => runAction('cancel', async () => {
    const id = draft._id || draft.awbNumber;
    if (!id) throw new Error('Book shipment before cancellation.');
    await logisticsRequest(isIndiaPost ? `/india-post/cancel/${encodeURIComponent(id)}` : `/cancel/${encodeURIComponent(id)}`, {});
    setDraft((current) => ({ ...current, shipmentStatus: 'Cancelled' }));
    setNotice('Shipment cancelled.');
  });
  const saveDraft = () => runAction('draft', async () => {
    const data = await logisticsRequest('/manual-book', { ...draft, courierMode: 'manual' });
    syncShipment(data.shipment);
    setNotice('Draft saved.');
  });
  const printUrl = (url: string, title: string) => {
    const printable = window.open('', '_blank', 'width=720,height=560');
    if (!printable) return;
    printable.document.write(`<pre style="font:15px/1.5 system-ui;white-space:pre-wrap">${title}\n${url || 'Mock document will be generated after booking.'}</pre>`);
    printable.document.close();
    printable.print();
  };
  const viewLogs = () => {
    const requestLog = (draft as Record<string, unknown>).indiaPostRequestRaw || {};
    const responseLog = (draft as Record<string, unknown>).indiaPostResponseRaw || (draft as Record<string, unknown>).bookingResponseRaw || {};
    const printable = window.open('', '_blank', 'width=900,height=650');
    if (!printable) return;
    printable.document.write(`<pre style="font:13px/1.5 ui-monospace,Consolas,monospace;white-space:pre-wrap">India Post Logs\n\nRequest:\n${JSON.stringify(requestLog, null, 2)}\n\nResponse:\n${JSON.stringify(responseLog, null, 2)}</pre>`);
    printable.document.close();
  };

  return (
    <section className="flex min-h-full flex-col rounded-2xl border border-slate-800 bg-slate-900">
      <div className="flex flex-1 flex-col gap-4 p-4">
        {notice && <div className={`rounded-xl border p-3 text-sm font-bold ${/failed|required|could not|no serviceable/i.test(notice) ? 'border-red-900 bg-red-950 text-red-200' : 'border-emerald-900 bg-emerald-950 text-emerald-200'}`}>{notice}</div>}
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase text-emerald-300">Order Details</p>
              <h3 className="mt-1 text-xl font-black text-white">{activePage}</h3>
            </div>
            <div className="flex flex-wrap gap-4 text-sm font-bold text-slate-300">
              <label className="flex items-center gap-2"><input type="radio" checked={draft.courierMode === 'manual'} onChange={() => updateMode('manual')} /> Manual</label>
              <label className="flex items-center gap-2"><input type="radio" checked={draft.courierMode === 'automatic'} onChange={() => updateMode('automatic')} /> Automatic</label>
              <StatusBadge status={draft.shipmentStatus || 'Draft'} />
              <span className="rounded-full bg-slate-800 px-2 py-1 text-xs font-black text-slate-200">India Post {import.meta.env.VITE_INDIA_POST_MODE || 'sandbox'}</span>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-800">
            <table className="min-w-[1400px] w-full text-left text-xs">
              <thead className="bg-black text-white">
                <tr>{(platform === 'efruitmandi' ? ['Order ID', 'Lot ID', 'Buyer Name', 'Buyer Mobile', 'Buyer Pincode', 'Seller/Pickup Pincode', 'Fruit Name', 'Crates', 'Weight', 'Invoice Value', 'Shipment Status', 'Courier', 'Action'] : ['Order ID', 'Platform', 'Customer Name', 'Mobile', 'Pincode', 'City', 'State', 'Product Type', 'Weight', 'Package Size', 'Payment Mode', 'Order Value', 'Courier', 'AWB', 'Status', 'Action']).map((head) => <th key={head} className="px-3 py-2">{head}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {visibleOrders.length ? visibleOrders.map((item) => (
                  <tr key={`${item.platform}-${item.orderId}`} onClick={() => setDraft(item)} className={`cursor-pointer text-slate-300 hover:bg-slate-900 ${draft.orderId === item.orderId ? 'bg-emerald-950/40' : 'bg-slate-950'}`}>
                    {platform === 'efruitmandi' ? (
                      <>
                        <td className="px-3 py-2 font-bold text-white">{item.orderId}</td>
                        <td className="px-3 py-2">{String(item.fruitLotDetails.lotId || '-')}</td>
                        <td className="px-3 py-2">{item.customerDetails.customerName || '-'}</td>
                        <td className="px-3 py-2">{item.customerDetails.phone || '-'}</td>
                        <td className="px-3 py-2">{item.customerDetails.pincode || '-'}</td>
                        <td className="px-3 py-2">{item.pickupDetails.pickupPincode || '-'}</td>
                        <td className="px-3 py-2">{item.packageDetails.productName || '-'}</td>
                        <td className="px-3 py-2">{String(item.fruitLotDetails.crateCount || item.packageDetails.quantity || '-')}</td>
                        <td className="px-3 py-2">{String(item.fruitLotDetails.grossWeight || item.packageDetails.deadWeightKg || '-')}</td>
                        <td className="px-3 py-2">Rs. {String(item.invoiceDetails.orderAmount || item.invoiceDetails.totalInvoiceValue || 0)}</td>
                        <td className="px-3 py-2"><StatusBadge status={item.shipmentStatus || 'Draft'} /></td>
                        <td className="px-3 py-2">{item.selectedCourier || 'India Post'}</td>
                        <td className="px-3 py-2"><button type="button" className="rounded bg-emerald-600 px-2 py-1 text-white">Create Shipment</button></td>
                      </>
                    ) : (
                      <>
                        <td className="px-3 py-2 font-bold text-white">{item.orderId}</td>
                        <td className="px-3 py-2">{formatLogisticsPlatform(item.platform)}</td>
                        <td className="px-3 py-2">{item.customerDetails.customerName || '-'}</td>
                        <td className="px-3 py-2">{item.customerDetails.phone || '-'}</td>
                        <td className="px-3 py-2">{item.customerDetails.pincode || '-'}</td>
                        <td className="px-3 py-2">{item.customerDetails.city || '-'}</td>
                        <td className="px-3 py-2">{item.customerDetails.state || '-'}</td>
                        <td className="px-3 py-2">{item.packageDetails.productCategory || item.packageDetails.productName || '-'}</td>
                        <td className="px-3 py-2">{String(item.packageDetails.deadWeightKg || '-')}</td>
                        <td className="px-3 py-2">{packageSizeLabel(item)}</td>
                        <td className="px-3 py-2">{String(item.invoiceDetails.paymentMode || '-')}</td>
                        <td className="px-3 py-2">Rs. {String(item.invoiceDetails.orderAmount || item.invoiceDetails.totalInvoiceValue || 0)}</td>
                        <td className="px-3 py-2">{item.selectedCourier || '-'}</td>
                        <td className="px-3 py-2">{item.awbNumber || '-'}</td>
                        <td className="px-3 py-2"><StatusBadge status={item.shipmentStatus || 'Draft'} /></td>
                        <td className="px-3 py-2"><button type="button" className="rounded bg-emerald-600 px-2 py-1 text-white">Create Shipment</button></td>
                      </>
                    )}
                  </tr>
                )) : (
                  <tr><td colSpan={16} className="px-3 py-6 text-center font-bold text-slate-400">No logistics orders found for this platform.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <FormGroup title="Customer / Consignee Details">
            {renderInputs(['customerName', 'phone', 'alternatePhone', 'email', 'addressLine1', 'addressLine2', 'landmark', 'city', 'district', 'state', 'pincode', 'country'], draft.customerDetails, (field, value) => updateGroup('customerDetails', field, value))}
          </FormGroup>
          <FormGroup title="Seller / Pickup Details">
            {renderInputs(['sellerName', 'pickupContactName', 'pickupPhone', 'pickupEmail', 'pickupAddress', 'pickupCity', 'pickupDistrict', 'pickupState', 'pickupPincode', 'gstNumber', 'warehouseName'], draft.pickupDetails, (field, value) => updateGroup('pickupDetails', field, value))}
          </FormGroup>
          <FormGroup title="Shipment / Package Details">
            <AdminInput label="Product Name" value={String(draft.packageDetails.productName || '')} onChange={(value) => updateGroup('packageDetails', 'productName', value)} placeholder="Product name" />
            {renderInputs(['sku', 'hsn', 'quantity', 'productCategory'], draft.packageDetails, (field, value) => updateGroup('packageDetails', field, value))}
            <AdminSelect label="Package Type" value={String(draft.packageDetails.packageType || 'Box')} options={['Box', 'Bag', 'Crate', 'Bundle']} onChange={(value) => updateGroup('packageDetails', 'packageType', value)} />
            {renderInputs(['deadWeightKg', 'lengthCm', 'widthCm', 'heightCm'], draft.packageDetails, (field, value) => updateGroup('packageDetails', field, value), 'number')}
            <AdminInput label="Volumetric Weight kg" value={volumetricWeightKg} onChange={() => undefined} placeholder="auto" disabled />
            {renderChecks(['fragile', 'perishable', 'temperatureSensitive'], draft.packageDetails, (field, value) => updateGroup('packageDetails', field, value))}
            <AdminInput label="Special Handling Instructions" value={String(draft.packageDetails.specialHandlingInstructions || '')} onChange={(value) => updateGroup('packageDetails', 'specialHandlingInstructions', value)} placeholder="Instructions" />
          </FormGroup>
          <FormGroup title={platform === 'efruitmandi' ? 'eFruitMandi Fruit Lot Extra Fields' : 'Orchard Growers Plant Shipment Extra Fields'}>
            {platform === 'efruitmandi' ? (
              <>
                {renderInputs(['lotId', 'crateCount', 'netWeight', 'grossWeight', 'harvestDate', 'grade', 'temperatureRequirement'], draft.fruitLotDetails, (field, value) => updateGroup('fruitLotDetails', field, value))}
                {renderChecks(['completeLotOnly'], draft.fruitLotDetails, (field, value) => updateGroup('fruitLotDetails', field, value))}
              </>
            ) : (
              <>
                {renderInputs(['plantType', 'plantAge', 'potSize', 'bareRootOrPotted'], draft.plantDetails, (field, value) => updateGroup('plantDetails', field, value))}
                {renderChecks(['wateredBeforeDispatch', 'plantHealthVerified', 'phytosanitaryRequired'], draft.plantDetails, (field, value) => updateGroup('plantDetails', field, value))}
              </>
            )}
          </FormGroup>
          <FormGroup title="Invoice / Value / Payment">
            {renderInputs(['orderAmount', 'shippingCharge', 'codAmount', 'prepaidAmount', 'gstAmount', 'totalInvoiceValue', 'invoiceNumber', 'invoiceDate'], draft.invoiceDetails, (field, value) => updateGroup('invoiceDetails', field, value))}
            <AdminSelect label="Payment Mode" value={String(draft.invoiceDetails.paymentMode || 'Prepaid')} options={['Prepaid', 'COD', 'Escrow', 'Manual']} onChange={(value) => updateGroup('invoiceDetails', 'paymentMode', value)} />
            {renderChecks(['insuranceRequired'], draft.invoiceDetails, (field, value) => updateGroup('invoiceDetails', field, value))}
            <AdminInput label="Insurance Value" value={String(draft.invoiceDetails.insuranceValue || '')} onChange={(value) => updateGroup('invoiceDetails', 'insuranceValue', value)} placeholder="0" type="number" />
          </FormGroup>
          <FormGroup title="Courier Selection">
            <AdminSelect label="Courier Partner" value={draft.selectedCourier || ''} options={['', 'India Post', 'Delhivery', 'Porter', 'DTDC', 'Blue Dart', 'Xpressbees', 'Shadowfax', 'Ecom Express', 'Shiprocket', 'Manual Other']} onChange={(value) => updateRoot('selectedCourier', value)} disabled={draft.courierMode === 'automatic'} />
            <AdminSelect label="Service Type" value={draft.serviceType || 'Standard'} options={['Standard', 'Express', 'Same Day', 'Surface', 'Air', 'Local Delivery']} onChange={(value) => updateRoot('serviceType', value)} />
            <AdminInput label="Pickup Date" value={draft.pickupDate || ''} onChange={(value) => updateRoot('pickupDate', value)} placeholder="YYYY-MM-DD" type="date" />
            <AdminInput label="Pickup Time Slot" value={draft.pickupTimeSlot || ''} onChange={(value) => updateRoot('pickupTimeSlot', value)} placeholder="10:00-14:00" />
            <AdminInput label="Expected Delivery Date" value={draft.expectedDeliveryDate || ''} onChange={(value) => updateRoot('expectedDeliveryDate', value)} placeholder="YYYY-MM-DD" type="date" />
            <AdminSelect label="Courier Priority" value={draft.courierPriority || 'Cheapest'} options={['Cheapest', 'Fastest', 'Best Rated', 'Manual']} onChange={(value) => updateRoot('courierPriority', value)} disabled={draft.courierMode === 'manual'} />
            {draft.courierMode === 'manual' && <AdminInput label="Manual AWB" value={draft.awbNumber || ''} onChange={(value) => updateRoot('awbNumber', value)} placeholder="External AWB" />}
            {draft.courierMode === 'manual' && <AdminInput label="Manual Tracking URL" value={draft.trackingUrl || ''} onChange={(value) => updateRoot('trackingUrl', value)} placeholder="https://..." />}
          </FormGroup>
        </div>

        {draft.courierMode === 'automatic' && (
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <p className="text-sm font-black text-white">Automatic Courier Comparison</p>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-[680px] w-full text-left text-xs">
                <thead className="bg-slate-900 text-slate-300"><tr>{['Courier', 'Serviceable', 'Estimated Cost', 'ETA', 'Reason if unavailable'].map((head) => <th key={head} className="px-3 py-2">{head}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-800">
                  {(draft.rateResults.length ? draft.rateResults : draft.serviceabilityResults).map((result) => (
                    <tr key={result.courier} className="text-slate-300">
                      <td className="px-3 py-2 font-bold text-white">{result.courier}</td>
                      <td className="px-3 py-2">{result.serviceable ? 'Yes' : 'No'}</td>
                      <td className="px-3 py-2">{result.estimatedCost ? `Rs. ${result.estimatedCost}` : '-'}</td>
                      <td className="px-3 py-2">{result.eta || '-'}</td>
                      <td className="px-3 py-2">{result.reason || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-auto rounded-xl border border-slate-800 bg-slate-950 p-3">
          <div className="flex flex-wrap gap-2">
            <LogisticsButton label="Check Serviceability" loading={loadingAction === 'serviceability'} onClick={checkServiceability} />
            <LogisticsButton label="Estimate Cost" loading={loadingAction === 'rates'} onClick={estimateCost} />
            <LogisticsButton label="Book Shipment" loading={loadingAction === 'book'} onClick={bookShipment} />
            <LogisticsButton label="Generate Label" loading={loadingAction === 'label'} onClick={generateLabel} />
            <LogisticsButton label="Generate Invoice" onClick={() => setDraft((current) => ({ ...current, invoiceUrl: `/api/logistics/invoice/${current._id || current.orderId}` }))} />
            <LogisticsButton label="Track Shipment" loading={loadingAction === 'track'} onClick={trackShipment} />
            <LogisticsButton label="Cancel Shipment" loading={loadingAction === 'cancel'} onClick={cancelShipment} />
            <LogisticsButton label="View Logs" onClick={viewLogs} />
            <LogisticsButton label="Reassign Courier" onClick={() => updateMode('manual')} />
            <LogisticsButton label="Print Label" onClick={() => printUrl(draft.labelUrl, 'Shipping Label')} />
            <LogisticsButton label="Print Invoice" onClick={() => printUrl(draft.invoiceUrl, 'Invoice')} />
            <LogisticsButton label="Save Draft" loading={loadingAction === 'draft'} onClick={saveDraft} />
          </div>
          {(draft.awbNumber || draft.trackingUrl || draft.labelUrl) && (
            <div className="mt-3 grid gap-2 text-xs text-slate-300 md:grid-cols-3">
              <Info label="AWB" value={draft.awbNumber || 'Pending'} />
              <Info label="Tracking URL" value={draft.trackingUrl || 'Pending'} />
              <Info label="Label" value={draft.labelUrl || 'Pending'} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function OrganicCertificationCell({
  product,
  onViewFile,
}: {
  product: AdminProduct;
  onViewFile: (file: UploadedFile) => void;
}) {
  const certified = isOrganicCertifiedProduct(product);

  if (!certified) {
    return <span className="text-xs font-bold text-slate-500">-</span>;
  }

  return (
    <div className="space-y-2">
      <span className="inline-flex rounded-full bg-emerald-950 px-2 py-1 text-xs font-black text-emerald-300">
        Organic Certified
      </span>
      <p className="text-xs font-bold text-slate-300">
        Cert No: {product.organicCertificationNo || 'Not entered'}
      </p>
      {product.organicCertificateUrl ? (
        <button
          type="button"
          onClick={() =>
            onViewFile({
              label: 'View Organic Certificate',
              path: product.organicCertificateUrl,
              fileName: `${product.title || product.lotNo || 'Organic'} certificate`,
            })
          }
          className="rounded-lg bg-emerald-600 px-2 py-1 text-xs font-bold text-white hover:bg-emerald-500"
        >
          View Certificate
        </button>
      ) : (
        <span className="text-xs font-bold text-amber-300">Certificate missing</span>
      )}
    </div>
  );
}

function EfruitMandiLotsPanel({
  products,
  onViewFile,
}: {
  products: AdminProduct[];
  onViewFile: (file: UploadedFile) => void;
}) {
  const lots = products.filter((product) =>
    product.createdSource === 'grower' ||
    Boolean(product.lotNo) ||
    Array.isArray(product.gradeLots)
  );

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
      <div className="flex flex-col gap-2 border-b border-slate-800 p-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-bold text-white">eFruitMandi Listed Lots</h2>
        <span className="text-xs font-bold text-slate-400">{lots.length} lots</span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[1050px] w-full text-left text-sm">
          <thead className="bg-slate-950 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-4 py-3">Lot</th>
              <th className="px-4 py-3">Grower</th>
              <th className="px-4 py-3">Fruit / Variety</th>
              <th className="px-4 py-3">Quality</th>
              <th className="px-4 py-3">Quantity</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Organic Certificate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {lots.map((product) => (
              <tr key={product._id} className="text-slate-200">
                <td className="px-4 py-3">
                  <p className="font-black text-white">{product.title || 'Fruit lot'}</p>
                  <p className="text-xs font-bold text-slate-400">{product.lotNo || '-'}</p>
                </td>
                <td className="px-4 py-3 text-slate-300">{getProductGrowerName(product)}</td>
                <td className="px-4 py-3 text-slate-300">
                  {product.fruitName || '-'} / {product.variety || '-'}
                </td>
                <td className="px-4 py-3 text-slate-300">{product.quality || '-'}</td>
                <td className="px-4 py-3 text-slate-300">
                  {product.quantity || 0} boxes
                  {product.gradeLots?.length ? (
                    <p className="text-xs text-slate-500">
                      {product.gradeLots.map((lot) => `${lot.grade}: ${lot.boxes || 0}`).join(', ')}
                    </p>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-slate-800 px-2 py-1 text-xs font-bold text-slate-300">
                    {formatProductStatus(product.status || 'SOLD')}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <OrganicCertificationCell product={product} onViewFile={onViewFile} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!lots.length && <EmptyState label="No eFruitMandi listed lots found." />}
      </div>
    </section>
  );
}

function MandiCommodityPanel({
  commodities,
  onSync,
  onCreate,
  onUpdate,
}: {
  commodities: MandiCommodity[];
  onSync: () => void;
  onCreate: (payload: { commodity: string; displayName?: string; aliases?: string; isFruit: boolean; adminNotes?: string }) => void;
  onUpdate: (id: string, payload: Partial<MandiCommodity>) => void;
}) {
  const [draft, setDraft] = useState({
    commodity: '',
    displayName: '',
    aliases: '',
    isFruit: true,
    adminNotes: '',
  });
  const fruitCount = commodities.filter((item) => item.isFruit).length;
  const uncategorizedCount = commodities.filter((item) => item.category === 'uncategorized').length;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.commodity.trim()) return;
    onCreate(draft);
    setDraft({ commodity: '', displayName: '', aliases: '', isFruit: true, adminNotes: '' });
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
      <div className="flex flex-col gap-3 border-b border-slate-800 p-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">AGMARKNET Commodity Mapping</h2>
          <p className="mt-1 text-sm font-semibold text-slate-400">
            {commodities.length} commodities, {fruitCount} marked fruit, {uncategorizedCount} uncategorized
          </p>
        </div>
        <button
          type="button"
          onClick={onSync}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-black text-white hover:bg-emerald-500"
        >
          Sync Commodity Master
        </button>
      </div>

      <form onSubmit={submit} className="grid gap-3 border-b border-slate-800 p-4 lg:grid-cols-[1fr_1fr_1fr_120px_120px]">
        <AdminInput label="Commodity" value={draft.commodity} onChange={(value) => setDraft((current) => ({ ...current, commodity: value }))} placeholder="Dragon Fruit" />
        <AdminInput label="Display Name" value={draft.displayName} onChange={(value) => setDraft((current) => ({ ...current, displayName: value }))} placeholder="Dragon Fruit" />
        <AdminInput label="Aliases" value={draft.aliases} onChange={(value) => setDraft((current) => ({ ...current, aliases: value }))} placeholder="Pitaya, Kamalam" />
        <label className="block text-sm font-bold text-slate-300">
          Category
          <select
            value={draft.isFruit ? 'fruit' : 'non-fruit'}
            onChange={(event) => setDraft((current) => ({ ...current, isFruit: event.target.value === 'fruit' }))}
            className="mt-2 h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-white outline-none focus:border-emerald-400"
          >
            <option value="fruit">Fruit</option>
            <option value="non-fruit">Non-fruit</option>
          </select>
        </label>
        <button type="submit" className="mt-7 h-11 rounded-lg bg-white px-3 text-sm font-black text-slate-950 hover:bg-emerald-100">
          Add
        </button>
      </form>

      <div className="overflow-x-auto">
        <table className="min-w-[980px] w-full text-left text-sm">
          <thead className="bg-slate-950 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-4 py-3">Commodity</th>
              <th className="px-4 py-3">Aliases</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Seen</th>
              <th className="px-4 py-3">Last Seen</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {commodities.map((item) => (
              <tr key={item._id} className="text-slate-200">
                <td className="px-4 py-3">
                  <p className="font-black text-white">{item.displayName || item.commodity}</p>
                  <p className="text-xs font-bold text-slate-500">{item.commodity}</p>
                </td>
                <td className="px-4 py-3 text-slate-300">{item.aliases?.join(', ') || '-'}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-1 text-xs font-black ${
                    item.isFruit
                      ? 'bg-emerald-950 text-emerald-300'
                      : item.category === 'non-fruit'
                        ? 'bg-slate-800 text-slate-300'
                        : 'bg-amber-950 text-amber-200'
                  }`}>
                    {item.isFruit ? 'fruit' : item.category || 'uncategorized'}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-300">{item.seenCount || 0}</td>
                <td className="px-4 py-3 text-slate-300">{formatDate(item.lastSeenAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={item.isFruit}
                      onClick={() => onUpdate(item._id, { category: 'fruit', isFruit: true })}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-black text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
                    >
                      Mark Fruit
                    </button>
                    <button
                      type="button"
                      disabled={!item.isFruit && item.category === 'non-fruit'}
                      onClick={() => onUpdate(item._id, { category: 'non-fruit', isFruit: false })}
                      className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-black text-slate-100 hover:bg-slate-700 disabled:cursor-not-allowed disabled:text-slate-500"
                    >
                      Non-fruit
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!commodities.length && <EmptyState label="No mandi commodities found. Sync the commodity master to discover AGMARKNET commodities." />}
      </div>
    </section>
  );
}

function makeLogisticsDraft(platform: string) {
  const today = new Date().toISOString().slice(0, 10);
  return {
    orderId: `DRAFT-${Date.now().toString().slice(-6)}`,
    platform: platform === 'efruitmandi' ? 'efruitmandi' : 'orchardgrowers',
    courierMode: 'manual',
    selectedCourier: 'India Post',
    courierPriority: 'Manual',
    serviceType: 'Standard',
    pickupDate: today,
    pickupTimeSlot: '10:00-14:00',
    expectedDeliveryDate: '',
    awbNumber: '',
    trackingUrl: '',
    labelUrl: '',
    invoiceUrl: '',
    shipmentStatus: 'Draft',
    customerDetails: { customerName: '', phone: '', alternatePhone: '', email: '', addressLine1: '', addressLine2: '', landmark: '', city: '', district: '', state: '', pincode: '', country: 'India' },
    pickupDetails: { sellerName: 'Orchard Growers', pickupContactName: 'Dispatch Desk', pickupPhone: '', pickupEmail: '', pickupAddress: '', pickupCity: '', pickupDistrict: '', pickupState: '', pickupPincode: '', gstNumber: '', warehouseName: 'Main Warehouse' },
    packageDetails: { productName: '', sku: '', hsn: '', quantity: '1', productCategory: '', packageType: 'Box', deadWeightKg: '', lengthCm: '', widthCm: '', heightCm: '', volumetricWeightKg: '', fragile: false, perishable: false, temperatureSensitive: false, specialHandlingInstructions: '' },
    plantDetails: { plantType: '', plantAge: '', potSize: '', bareRootOrPotted: '', wateredBeforeDispatch: false, plantHealthVerified: false, phytosanitaryRequired: false },
    fruitLotDetails: { lotId: '', crateCount: '', netWeight: '', grossWeight: '', harvestDate: '', grade: '', completeLotOnly: true, temperatureRequirement: '' },
    invoiceDetails: { orderAmount: '', shippingCharge: '', codAmount: '', prepaidAmount: '', gstAmount: '', totalInvoiceValue: '', invoiceNumber: '', invoiceDate: today, paymentMode: 'Prepaid', insuranceRequired: false, insuranceValue: '' },
    serviceabilityResults: [],
    rateResults: [],
  };
}

function normalizeLogisticsDraft(item: Record<string, any>, fallbackPlatform: string) {
  const base = makeLogisticsDraft(item.platform || fallbackPlatform);
  return {
    ...base,
    ...item,
    _id: item._id || '',
    platform: item.platform === 'efruitmandi' ? 'efruitmandi' : 'orchardgrowers',
    courierMode: item.courierMode === 'automatic' ? 'automatic' : 'manual',
    selectedCourier: item.selectedCourier || item.courierPartner || base.selectedCourier,
    customerDetails: { ...base.customerDetails, ...(item.customerDetails || {}) },
    pickupDetails: { ...base.pickupDetails, ...(item.pickupDetails || {}) },
    packageDetails: { ...base.packageDetails, ...(item.packageDetails || {}) },
    plantDetails: { ...base.plantDetails, ...(item.plantDetails || {}) },
    fruitLotDetails: { ...base.fruitLotDetails, ...(item.fruitLotDetails || {}) },
    invoiceDetails: { ...base.invoiceDetails, ...(item.invoiceDetails || {}) },
    serviceabilityResults: item.serviceabilityResults || [],
    rateResults: item.rateResults || [],
  };
}

function logisticsDraftFromAdminOrder(order: AdminOrder, fallbackPlatform: string) {
  const base = makeLogisticsDraft((order.courierPartner || '').toLowerCase() === 'efruitmandi' ? 'efruitmandi' : fallbackPlatform);
  const item = order.items?.[0] || {};
  return normalizeLogisticsDraft({
    orderId: order.invoiceNumber || order._id,
    platform: base.platform,
    customerDetails: {
      customerName: order.customer?.name || '',
      phone: order.customer?.phone || '',
      email: order.customer?.email || '',
      city: order.shippingAddress?.city || '',
      state: order.shippingAddress?.state || '',
      pincode: order.shippingAddress?.pinCode || '',
      country: 'India',
    },
    packageDetails: { productName: item.title || '', quantity: String(item.quantity || 1), packageType: 'Box' },
    invoiceDetails: { orderAmount: String(order.totalAmount || 0), totalInvoiceValue: String(order.totalAmount || 0), invoiceNumber: order.invoiceNumber || '', paymentMode: order.paymentStatus === 'ESCROW' ? 'Escrow' : 'Prepaid' },
    selectedCourier: order.courierPartner || 'India Post',
    courierMode: String(order.deliveryPartnerSelection || '').toLowerCase() === 'manual' ? 'manual' : 'automatic',
    awbNumber: order.trackingNumber || '',
    shipmentStatus: order.trackingNumber ? 'Booked' : 'Draft',
  }, fallbackPlatform);
}

function calculateVolumetricWeight(length: unknown, width: unknown, height: unknown) {
  const value = (Number(length) * Number(width) * Number(height)) / 5000;
  return Number.isFinite(value) && value > 0 ? value.toFixed(2) : '';
}

function formatLogisticsPlatform(platform: string) {
  return platform === 'efruitmandi' ? 'eFruitMandi' : 'Orchard Growers';
}

function packageSizeLabel(item: { packageDetails?: Record<string, string | boolean> }) {
  const details = item.packageDetails || {};
  const length = String(details.lengthCm || '');
  const width = String(details.widthCm || '');
  const height = String(details.heightCm || '');
  return length && width && height ? `${length}x${width}x${height} cm` : '-';
}

function titleFromField(field: string) {
  return field.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase());
}

function renderInputs(
  fields: string[],
  values: Record<string, string | boolean>,
  onChange: (field: string, value: string) => void,
  type: string = 'text',
) {
  return fields.map((field) => (
    <AdminInput key={field} label={titleFromField(field)} value={String(values[field] || '')} onChange={(value) => onChange(field, value)} placeholder={titleFromField(field)} type={type} />
  ));
}

function renderChecks(fields: string[], values: Record<string, string | boolean>, onChange: (field: string, value: boolean) => void) {
  return fields.map((field) => (
    <label key={field} className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm font-bold text-slate-300">
      <input type="checkbox" checked={Boolean(values[field])} onChange={(event) => onChange(field, event.target.checked)} />
      {titleFromField(field)}
    </label>
  ));
}

function FormGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
      <p className="mb-3 text-sm font-black text-white">{title}</p>
      <div className="grid gap-3 md:grid-cols-2">{children}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const danger = ['Cancelled', 'Failed'].includes(status);
  const success = ['Booked', 'Label Generated', 'Picked Up', 'In Transit', 'Delivered'].includes(status);
  return (
    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-black ${danger ? 'bg-red-950 text-red-200' : success ? 'bg-emerald-950 text-emerald-300' : 'bg-slate-800 text-slate-300'}`}>
      {status}
    </span>
  );
}

function LogisticsButton({ label, loading, onClick }: { label: string; loading?: boolean; onClick: () => void }) {
  return (
    <button type="button" disabled={loading} onClick={onClick} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black text-white hover:bg-emerald-500 disabled:opacity-60">
      {loading ? 'Working...' : label}
    </button>
  );
}

const logisticsProviderProfiles: Record<string, { text: string; defaultService: string; apiLabel: string; accountLabel: string }> = {
  eFruitMandi: {
    text: 'Own eFruitMandi transporter onboarding, driver assignment, marketplace dispatch, proof collection, and auto-updated order visibility.',
    defaultService: 'Own Transport',
    apiLabel: 'Auto Sync Channel',
    accountLabel: 'Transport Fleet Code',
  },
  'India Post': {
    text: 'India Post parcel booking workspace with manual entry today and API-ready setup for automatic postal booking and tracking.',
    defaultService: 'Speed Post Parcel',
    apiLabel: 'India Post API Token',
    accountLabel: 'Postal Customer ID',
  },
  Delhivery: {
    text: 'Delhivery surface/express booking, pickup account setup, waybill generation, and shipment tracking.',
    defaultService: 'Surface',
    apiLabel: 'Delhivery API Token',
    accountLabel: 'Client Warehouse Code',
  },
  'Blue Dart': {
    text: 'Blue Dart domestic express setup for pickup registration, airway bill booking, label printing, and premium tracking.',
    defaultService: 'Domestic Priority',
    apiLabel: 'Blue Dart API Key',
    accountLabel: 'Customer Code',
  },
  DTDC: {
    text: 'DTDC courier booking for express, surface, COD configuration, consignment tracking, and manifest export.',
    defaultService: 'DTDC Express',
    apiLabel: 'DTDC API Key',
    accountLabel: 'DTDC Account No.',
  },
  Shiprocket: {
    text: 'Shiprocket aggregator setup for rate selection, courier assignment, pickup scheduling, AWB generation, and labels.',
    defaultService: 'Aggregator Surface',
    apiLabel: 'Shiprocket Token',
    accountLabel: 'Channel ID',
  },
  Xpressbees: {
    text: 'Xpressbees shipment desk for e-commerce parcels, COD support, pickup PIN serviceability, and tracking sync.',
    defaultService: 'Xpressbees Surface',
    apiLabel: 'Xpressbees Token',
    accountLabel: 'Business Account',
  },
  'Ecom Express': {
    text: 'Ecom Express parcel workflow for marketplace delivery, pickup registration, AWB booking, and reverse-ready manifests.',
    defaultService: 'Ecom Express Surface',
    apiLabel: 'Ecom Express Token',
    accountLabel: 'Customer Code',
  },
  Ekart: {
    text: 'Ekart logistics setup for local and national parcel movement, assignment, tracking updates, and shipment labels.',
    defaultService: 'Ekart Surface',
    apiLabel: 'Ekart API Key',
    accountLabel: 'Seller Code',
  },
  Shadowfax: {
    text: 'Shadowfax hyperlocal and city delivery setup for quick dispatch, rider allocation, COD, and proof of delivery.',
    defaultService: 'Hyperlocal',
    apiLabel: 'Shadowfax Token',
    accountLabel: 'Merchant ID',
  },
  'Amazon Shipping': {
    text: 'Amazon Shipping setup for seller pickup, parcel booking, tracking, labels, and SLA-based shipment handling.',
    defaultService: 'Amazon Shipping Standard',
    apiLabel: 'Amazon Shipping Token',
    accountLabel: 'Seller / Shipper ID',
  },
  Porter: {
    text: 'Porter local delivery page for city dispatch, vehicle booking, driver coordination, and manual/partner tracking.',
    defaultService: 'Two Wheeler / Mini Truck',
    apiLabel: 'Porter API Token',
    accountLabel: 'Porter Account ID',
  },
  DHL: {
    text: 'DHL international and premium parcel desk for account setup, express booking, commercial labels, and tracking.',
    defaultService: 'DHL Express',
    apiLabel: 'DHL API Key',
    accountLabel: 'DHL Account No.',
  },
  FedEx: {
    text: 'FedEx express and international booking page for account setup, package declaration, label creation, and tracking.',
    defaultService: 'FedEx Express',
    apiLabel: 'FedEx API Key',
    accountLabel: 'FedEx Account No.',
  },
  UPS: {
    text: 'UPS shipment setup for express parcels, pickup account configuration, label generation, and tracking sync.',
    defaultService: 'UPS Express',
    apiLabel: 'UPS Access Key',
    accountLabel: 'UPS Account No.',
  },
  Aramex: {
    text: 'Aramex domestic/international logistics setup for waybill booking, pickup, customs-ready labels, and tracking.',
    defaultService: 'Aramex Parcel',
    apiLabel: 'Aramex API Key',
    accountLabel: 'Aramex Account No.',
  },
  AWS: {
    text: 'AWS event, storage, webhook, and notification workflow for logistics automation jobs and partner callbacks.',
    defaultService: 'Webhook Automation',
    apiLabel: 'AWS Access Key / Webhook Secret',
    accountLabel: 'Event Bus / Queue Name',
  },
};

function getLogisticsProviderProfile(provider: string) {
  return logisticsProviderProfiles[provider] || {
    text: `${provider} courier workspace for manual order placement, automatic API setup, tracking updates, labels, manifests, and COD/service configuration.`,
    defaultService: 'Surface',
    apiLabel: `${provider} API Token`,
    accountLabel: 'Partner Account Code',
  };
}

function getProviderStorageKey(provider: string) {
  return `orchard_logistics_provider_${provider.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
}

type LogisticsProviderSetup = {
  mode: 'AUTOMATIC' | 'MANUAL';
  apiKey: string;
  accountCode: string;
  pickupPincode: string;
  serviceType: string;
  codEnabled: boolean;
};

const defaultProviderSetup = (provider: string): LogisticsProviderSetup => ({
  mode: provider === 'eFruitMandi' ? 'AUTOMATIC' : 'MANUAL',
  apiKey: '',
  accountCode: '',
  pickupPincode: '175029',
  serviceType: getLogisticsProviderProfile(provider).defaultService,
  codEnabled: false,
});

function readProviderSetup(provider: string): LogisticsProviderSetup {
  try {
    const parsed = JSON.parse(localStorage.getItem(getProviderStorageKey(provider)) || 'null');
    return { ...defaultProviderSetup(provider), ...(parsed || {}) };
  } catch {
    return defaultProviderSetup(provider);
  }
}

function LogisticsProviderPanel({
  activePage,
  orders,
  onBookOrder,
}: {
  activePage: string;
  orders: AdminOrder[];
  onBookOrder: (order: AdminOrder, payload: Partial<AdminOrder>) => void;
}) {
  const platform = logisticsPlatformPages.includes(activePage) ? activePage : 'eFruitMandi';
  const defaultCourierPartner = platform === 'eFruitMandi' ? 'eFruitMandi' : 'India Post';
  const [selectedCourierPartner, setSelectedCourierPartner] = useState(defaultCourierPartner);
  const provider = platform === 'eFruitMandi' ? 'eFruitMandi' : selectedCourierPartner;
  const providerProfile = getLogisticsProviderProfile(provider);
  const platformOrders = orders.filter((order) => ((order.courierPartner || '').toLowerCase() === 'efruitmandi') === (platform === 'eFruitMandi'));
  const providerOrders = orders.filter((order) => (order.courierPartner || 'India Post') === provider);
  const pendingOrders = orders.filter((order) => !order.trackingNumber || ['PENDING', 'PLACED'].includes(order.deliveryStatus || 'PLACED'));
  const [setup, setSetup] = useState<LogisticsProviderSetup>(() => readProviderSetup(provider));
  const [selectedOrderId, setSelectedOrderId] = useState(pendingOrders[0]?._id || orders[0]?._id || '');
  const [bookingDraft, setBookingDraft] = useState({
    weightKg: '1',
    declaredValue: '',
    packageType: 'Parcel',
    note: '',
  });
  const [driverDraft, setDriverDraft] = useState({
    name: 'eFruitMandi Driver',
    phone: '',
    vehicle: '',
    location: 'GPS pending',
    status: 'AVAILABLE',
    escrowStatus: 'BILLDESK_PENDING',
    billDeskRef: '',
  });
  const [indiaPostPickup, setIndiaPostPickup] = useState({
    pickupDate: new Date().toISOString().slice(0, 10),
    pickupSlot: '10:00-14:00',
    maxWeightKg: '2',
    directConsumerDelivery: true,
  });
  const [localNotice, setLocalNotice] = useState('');

  useEffect(() => {
    setSelectedCourierPartner(defaultCourierPartner);
  }, [defaultCourierPartner]);

  useEffect(() => {
    setSetup(readProviderSetup(provider));
    setSelectedOrderId(pendingOrders[0]?._id || orders[0]?._id || '');
    setLocalNotice('');
  }, [provider, orders.length]);

  const selectedOrder = orders.find((order) => order._id === selectedOrderId);
  const updateSetup = (field: keyof LogisticsProviderSetup, value: string | boolean) =>
    setSetup((current) => ({ ...current, [field]: value }));
  const saveSetup = () => {
    localStorage.setItem(getProviderStorageKey(provider), JSON.stringify(setup));
    setLocalNotice(`${provider} setup saved.`);
  };
  const bookSelectedOrder = () => {
    if (!selectedOrder) {
      setLocalNotice('Select an order before booking.');
      return;
    }
    const trackingPrefix = provider === 'India Post' ? 'IP' : provider === 'eFruitMandi' ? 'EFM' : provider.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'SHIP';
    const trackingNumber = `${trackingPrefix}${Date.now().toString().slice(-10)}`;
    onBookOrder(selectedOrder, {
      courierPartner: provider,
      deliveryPartnerSelection: setup.mode,
      courierBookingStatus: setup.mode === 'AUTOMATIC' ? 'API_BOOKED' : 'MANUAL_BOOKED',
      trackingNumber,
      deliveryStatus: 'IN_TRANSIT',
    });
    setLocalNotice(`${provider} booking created for ${selectedOrder.invoiceNumber || selectedOrder._id}.`);
  };
  const printLabel = () => {
    if (!selectedOrder) {
      setLocalNotice('Select an order before printing label.');
      return;
    }
    const label = [
      `${provider} Shipping Label`,
      `Invoice: ${selectedOrder.invoiceNumber || selectedOrder._id}`,
      `Customer: ${selectedOrder.customer?.name || 'Customer'} ${selectedOrder.customer?.phone || ''}`,
      `To: ${selectedOrder.shippingAddress?.city || ''}, ${selectedOrder.shippingAddress?.state || ''} ${selectedOrder.shippingAddress?.pinCode || ''}`,
      `Service: ${setup.serviceType}`,
      `Weight: ${bookingDraft.weightKg} kg`,
      `Tracking: ${selectedOrder.trackingNumber || 'Generated after booking'}`,
    ].join('\n');
    const printable = window.open('', '_blank', 'width=720,height=560');
    if (!printable) return;
    printable.document.write(`<pre style="font:15px/1.5 system-ui;white-space:pre-wrap">${label}</pre>`);
    printable.document.close();
    printable.print();
  };
  const createManifest = () => {
    const manifest = providerOrders.map((order) => ({
      invoiceNumber: order.invoiceNumber || order._id,
      customer: order.customer?.name || 'Customer',
      trackingNumber: order.trackingNumber || '',
      status: order.deliveryStatus || 'PLACED',
    }));
    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${provider.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-manifest.json`;
    link.click();
    URL.revokeObjectURL(url);
    setLocalNotice(`${provider} manifest exported.`);
  };
  const saveDriverUpdate = () => {
    localStorage.setItem('orchard_efruitmandi_driver_tracking', JSON.stringify(driverDraft));
    setLocalNotice('eFruitMandi driver GPS/status update saved for action panel tracking.');
  };
  const scheduleIndiaPostPickup = () => {
    localStorage.setItem('orchard_india_post_pickup', JSON.stringify(indiaPostPickup));
    setLocalNotice('India Post small-consignment pickup setup saved.');
  };
  const bookedCount = providerOrders.filter((order) => order.trackingNumber).length;
  const autoReady = provider === 'eFruitMandi' || (setup.mode === 'AUTOMATIC' && (setup.apiKey || provider === 'AWS'));
  const platformText = platform === 'eFruitMandi'
    ? 'eFruitMandi transport reflects registered drivers from efruitmandi.live, live/manual location updates, destination status, and escrow payment visibility.'
    : 'Orchard Growers dispatch shows direct customer orders, courier assignment, India Post pickup/API setup, labels, and tracking controls.';

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-emerald-300">Logistics Platform</p>
          <h3 className="mt-1 text-lg font-black text-white">{platform}</h3>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-400">{platformText}</p>
        </div>
        <span className="rounded-full bg-emerald-950 px-3 py-1 text-xs font-bold text-emerald-300">{platformOrders.length} platform orders</span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        {[
          ['Open Orders', pendingOrders.length],
          ['Partner Booked', bookedCount],
          ['Setup Mode', setup.mode],
          ['Auto Ready', autoReady ? 'Yes' : 'No'],
        ].map(([metric, value]) => (
          <div key={metric} className="rounded-lg border border-slate-800 bg-slate-900 p-3">
            <p className="text-xs font-bold text-slate-500">{metric}</p>
            <p className="mt-1 text-xl font-black text-white">{value}</p>
          </div>
        ))}
      </div>
      {platform === 'eFruitMandi' && (
        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900 p-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black text-white">eFruitMandi Driver GPS Desk</p>
              <p className="mt-1 text-xs font-semibold text-slate-400">Drivers registered on efruitmandi.live update GPS and delivery status; this desk reflects and controls that dispatch state.</p>
            </div>
            <span className="rounded-full bg-emerald-950 px-3 py-1 text-xs font-bold text-emerald-300">{driverDraft.status}</span>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-5">
            <AdminInput label="Driver Name" value={driverDraft.name} onChange={(value) => setDriverDraft((current) => ({ ...current, name: value }))} placeholder="Driver name" />
            <AdminInput label="Phone" value={driverDraft.phone} onChange={(value) => setDriverDraft((current) => ({ ...current, phone: value }))} placeholder="Driver phone" />
            <AdminInput label="Vehicle" value={driverDraft.vehicle} onChange={(value) => setDriverDraft((current) => ({ ...current, vehicle: value }))} placeholder="Vehicle no." />
            <AdminInput label="GPS Location" value={driverDraft.location} onChange={(value) => setDriverDraft((current) => ({ ...current, location: value }))} placeholder="Lat,Lng / area" />
            <AdminSelect label="Driver Status" value={driverDraft.status} options={['AVAILABLE', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED']} onChange={(value) => setDriverDraft((current) => ({ ...current, status: value }))} />
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <AdminSelect label="Escrow / BillDesk Status" value={driverDraft.escrowStatus} options={['BILLDESK_PENDING', 'ESCROW_HOLD', 'DESTINATION_REACHED', 'RELEASE_READY', 'SETTLED']} onChange={(value) => setDriverDraft((current) => ({ ...current, escrowStatus: value }))} />
            <AdminInput label="BillDesk Reference" value={driverDraft.billDeskRef} onChange={(value) => setDriverDraft((current) => ({ ...current, billDeskRef: value }))} placeholder="Payment / escrow ref" />
          </div>
          <button type="button" onClick={saveDriverUpdate} className="mt-3 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500">Save Driver GPS Update</button>
        </div>
      )}
      {platform === 'Orchard Growers' && (
        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900 p-3">
          <div>
            <p className="text-sm font-black text-white">India Post Small Consignment Pickup</p>
            <p className="mt-1 text-xs font-semibold text-slate-400">Use India Post for small Orchard Growers consignments picked up from unit/outlet and delivered directly to the end consumer.</p>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-4">
            <AdminInput label="Pickup Date" value={indiaPostPickup.pickupDate} onChange={(value) => setIndiaPostPickup((current) => ({ ...current, pickupDate: value }))} placeholder="YYYY-MM-DD" type="date" />
            <AdminInput label="Pickup Slot" value={indiaPostPickup.pickupSlot} onChange={(value) => setIndiaPostPickup((current) => ({ ...current, pickupSlot: value }))} placeholder="10:00-14:00" />
            <AdminInput label="Max Weight kg" value={indiaPostPickup.maxWeightKg} onChange={(value) => setIndiaPostPickup((current) => ({ ...current, maxWeightKg: value }))} placeholder="2" type="number" />
            <label className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm font-bold text-slate-300">
              <input type="checkbox" checked={indiaPostPickup.directConsumerDelivery} onChange={(event) => setIndiaPostPickup((current) => ({ ...current, directConsumerDelivery: event.target.checked }))} />
              Direct to consumer
            </label>
          </div>
          <button type="button" onClick={scheduleIndiaPostPickup} className="mt-3 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500">Save Pickup Setup</button>
        </div>
      )}
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
          <p className="text-sm font-black text-white">{platform === 'eFruitMandi' ? 'Own Transport Auto Sync' : 'Courier Partner Setup'}</p>
          <p className="mt-1 text-xs font-semibold text-slate-400">{providerProfile.text}</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {platform === 'Orchard Growers' && (
              <AdminSelect label="Courier Partner" value={selectedCourierPartner} options={logisticsCourierPartners.filter((partner) => partner !== 'eFruitMandi')} onChange={setSelectedCourierPartner} />
            )}
            <AdminSelect label="Booking Mode" value={setup.mode} options={['AUTOMATIC', 'MANUAL']} onChange={(value) => updateSetup('mode', value)} disabled={platform === 'eFruitMandi'} />
            <AdminInput label="Pickup PIN" value={setup.pickupPincode} onChange={(value) => updateSetup('pickupPincode', value)} placeholder="175029" />
            {platform !== 'eFruitMandi' && <AdminInput label={providerProfile.apiLabel} value={setup.apiKey} onChange={(value) => updateSetup('apiKey', value)} placeholder={providerProfile.apiLabel} />}
            {platform !== 'eFruitMandi' && <AdminInput label={providerProfile.accountLabel} value={setup.accountCode} onChange={(value) => updateSetup('accountCode', value)} placeholder={providerProfile.accountLabel} />}
            <AdminInput label="Service Type" value={setup.serviceType} onChange={(value) => updateSetup('serviceType', value)} placeholder="Surface / Express / Speed Post" />
            <label className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm font-bold text-slate-300">
              <input type="checkbox" checked={setup.codEnabled} onChange={(event) => updateSetup('codEnabled', event.target.checked)} />
              COD enabled
            </label>
          </div>
          {platform === 'Orchard Growers' && provider !== 'India Post' && (
            <p className="mt-3 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-bold text-slate-400">API integration is setup-ready for {provider}; live automatic booking is enabled first for India Post.</p>
          )}
          <button type="button" onClick={saveSetup} className="mt-3 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500">Save Setup</button>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
          <p className="text-sm font-black text-white">Manual / API Booking</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="block text-sm font-bold text-slate-300 md:col-span-2">
              Order
              <select value={selectedOrderId} onChange={(event) => setSelectedOrderId(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-white outline-none focus:border-emerald-400">
                <option value="">Select order</option>
                {orders.map((order) => (
                  <option key={order._id} value={order._id}>{order.invoiceNumber || order._id} - {order.customer?.name || 'Customer'}</option>
                ))}
              </select>
            </label>
            <AdminInput label="Weight kg" value={bookingDraft.weightKg} onChange={(value) => setBookingDraft((current) => ({ ...current, weightKg: value }))} placeholder="1" type="number" />
            <AdminInput label="Declared Value" value={bookingDraft.declaredValue} onChange={(value) => setBookingDraft((current) => ({ ...current, declaredValue: value }))} placeholder="Order value" type="number" />
            <AdminInput label="Package Type" value={bookingDraft.packageType} onChange={(value) => setBookingDraft((current) => ({ ...current, packageType: value }))} placeholder="Parcel" />
            <AdminInput label="Booking Note" value={bookingDraft.note} onChange={(value) => setBookingDraft((current) => ({ ...current, note: value }))} placeholder="Optional note" />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={bookSelectedOrder} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500">{setup.mode === 'AUTOMATIC' ? 'Place API Order' : 'Save Manual Booking'}</button>
            <button type="button" onClick={printLabel} className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-bold text-white hover:bg-slate-700">Print Label</button>
            <button type="button" onClick={createManifest} className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-bold text-white hover:bg-slate-700">Export Manifest</button>
          </div>
        </div>
      </div>
      {localNotice && <div className="mt-3 rounded-lg border border-emerald-900 bg-emerald-950 px-3 py-2 text-xs font-bold text-emerald-200">{localNotice}</div>}
    </section>
  );
}

function AdminSelect({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block text-sm font-bold text-slate-300">
      {label}
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-white outline-none focus:border-emerald-400 disabled:opacity-60"
      >
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function AdminInlineInput({
  label,
  value,
  onSave,
  disabled,
}: {
  label: string;
  value: string;
  onSave: (value: string) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <label className="block text-sm font-bold text-slate-300">
      {label}
      <div className="mt-2 flex gap-2">
        <input
          value={draft}
          disabled={disabled}
          onChange={(event) => setDraft(event.target.value)}
          className="h-11 min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 text-white outline-none focus:border-emerald-400 disabled:opacity-60"
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSave(draft)}
          className="rounded-lg bg-emerald-600 px-3 text-xs font-black text-white hover:bg-emerald-500 disabled:opacity-60"
        >
          Save
        </button>
      </div>
    </label>
  );
}

function NotificationItem({
  title,
  detail,
  action,
  onClick,
}: {
  title: string;
  detail: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="block w-full rounded-xl border border-slate-800 bg-slate-950 p-4 text-left hover:border-emerald-500"
    >
      <p className="font-bold text-white">{title}</p>
      <p className="mt-1 text-sm font-semibold text-slate-400">{detail}</p>
      <p className="mt-3 text-sm font-bold text-emerald-300">{action}</p>
    </button>
  );
}

function RequestSection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">{title}</h2>
        <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-bold">{count}</span>
      </div>
      <div className="space-y-4">{count ? children : <EmptyState />}</div>
    </section>
  );
}

const validKycRoleTypes = new Set(['buyer', 'grower', 'driver']);

function getKycUserProfileTypes(user: KycUser) {
  const profiles = new Set(Array.isArray(user.profileTypes) ? user.profileTypes.map((role) => String(role).toLowerCase()) : []);
  const role = String(user.role || '').toLowerCase();

  if (role) profiles.add(role);
  if (user.orchardName || user.kyc?.orchardName) profiles.add('grower');
  if (user.businessName) profiles.add('buyer');
  if (user.logisticsName || user.kyc?.vehicleNumber || user.kyc?.drivingLicenseNumber) profiles.add('driver');

  return profiles;
}

function hasGrowerKycFields(user: KycUser) {
  return Boolean(
    user.kyc?.orchardName ||
      user.kyc?.orchardLocation ||
      user.kyc?.udyanCardNo ||
      user.kyc?.udyanCardFileUrl
  );
}

function getKycUserRoleType(user: KycUser) {
  const profiles = getKycUserProfileTypes(user);
  const kycRole = String(user.kyc?.roleType || '').toLowerCase();
  const userRole = String(user.role || '').toLowerCase();

  if (validKycRoleTypes.has(kycRole) && (profiles.size === 0 || profiles.has(kycRole))) return kycRole;
  if (hasGrowerKycFields(user)) return 'grower';
  if (validKycRoleTypes.has(userRole) && (profiles.size === 0 || profiles.has(userRole))) return userRole;
  if (profiles.has('grower')) return 'grower';
  if (profiles.has('buyer')) return 'buyer';
  if (profiles.has('driver')) return 'driver';
  return kycRole || userRole || 'user';
}

const kycEditableFields: Array<{ key: string; label: string; roles?: string[] }> = [
  { key: 'fullName', label: 'Full Name' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
  { key: 'address', label: 'Premises Address' },
  { key: 'district', label: 'District' },
  { key: 'state', label: 'State' },
  { key: 'pinCode', label: 'PIN Code' },
  { key: 'idProofType', label: 'ID Proof Type' },
  { key: 'idProofNumber', label: 'ID Proof Number' },
  { key: 'panNumber', label: 'PAN Number' },
  { key: 'gstNumber', label: 'GST Number' },
  { key: 'bankAccountHolderName', label: 'Account Holder Name' },
  { key: 'bankName', label: 'Bank Name' },
  { key: 'accountNumber', label: 'Bank Account Number' },
  { key: 'ifscCode', label: 'IFSC Code' },
  { key: 'upiId', label: 'UPI ID' },
  { key: 'orchardName', label: 'Orchard Name', roles: ['grower'] },
  { key: 'orchardLocation', label: 'Orchard Location', roles: ['grower'] },
  { key: 'udyanCardNo', label: 'Udyan Card Number', roles: ['grower'] },
  { key: 'vehicleNumber', label: 'Vehicle Number', roles: ['driver'] },
  { key: 'drivingLicenseNumber', label: 'Driving License Number', roles: ['driver'] },
];

function getKycEditDraft(kyc: NonNullable<KycUser['kyc']>) {
  return Object.fromEntries(
    kycEditableFields.map(({ key }) => [
      key,
      String((kyc as Record<string, unknown>)[key] || (key === 'accountNumber' ? kyc.bankAccountNo : '') || ''),
    ])
  ) as KycUpdatePayload;
}

function KycRequestCard({
  user,
  onReview,
  onUpdate,
  onViewFile,
}: {
  user: KycUser;
  onReview: (type: 'kyc', id: string, action: ReviewAction) => void;
  onUpdate: (id: string, updates: KycUpdatePayload) => Promise<boolean>;
  onViewFile: (file: UploadedFile) => void;
}) {
  const kyc = user.kyc || {};
  const roleType = getKycUserRoleType(user);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editDraft, setEditDraft] = useState<KycUpdatePayload>(() => getKycEditDraft(kyc));
  const kycStatus = String(kyc.status || '').toUpperCase();
  const isApproved = kycStatus === 'APPROVED';
  const premisesAddressLabel =
    roleType === 'buyer'
      ? 'Buyer Premises'
      : roleType === 'grower'
        ? 'Grower Premises'
        : 'Premises Address';
  const visibleEditFields = kycEditableFields.filter((field) => !field.roles || field.roles.includes(roleType));
  const extraDocuments = (kyc.documents || []).map((file, index) => ({
    label: file.label || `View Document ${index + 1}`,
    path: file.path || file.url,
    fileName: file.fileName,
  }));

  useEffect(() => {
    if (!isEditing) setEditDraft(getKycEditDraft(kyc));
  }, [isEditing, user._id, user.kyc]);

  const saveInformation = async () => {
    setIsSaving(true);
    const saved = await onUpdate(user._id, editDraft);
    setIsSaving(false);
    if (saved) setIsEditing(false);
  };

  const downloadInformation = () => {
    const exportData = {
      userId: user._id.split(':')[0],
      roleType,
      account: { name: user.name, email: user.email, phone: user.phone },
      kyc,
    };
    const blobUrl = URL.createObjectURL(new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `kyc-${roleType}-${user._id.split(':')[0]}.json`;
    link.click();
    URL.revokeObjectURL(blobUrl);
  };

  return (
    <article className="rounded-xl border border-slate-800 bg-slate-950 p-4">
      <RequestHeader
        title={kyc.fullName || user.businessName || user.orchardName || user.logisticsName || user.name || 'User'}
        subtitle={`${roleType} - ${kyc.email || user.email || kyc.phone || user.phone || 'No contact'}`}
        status={kyc.status || 'NOT_SUBMITTED'}
      />
      <div className="mt-4 grid gap-2 text-sm text-slate-300">
        <Info label="Role Type" value={roleType} />
        <Info label="Full Name" value={kyc.fullName || user.name} />
        <Info label="Phone" value={kyc.phone || user.phone} />
        <Info label="Email" value={kyc.email || user.email} />
        <Info label={premisesAddressLabel} value={kyc.address} />
        <Info label="District / State" value={[kyc.district, kyc.state].filter(Boolean).join(', ')} />
        <Info label="PIN Code" value={kyc.pinCode} />
        <Info label="ID Proof" value={[kyc.idProofType, kyc.idProofNumber].filter(Boolean).join(' - ')} />
        <Info label="PAN" value={kyc.panNumber} />
        <Info label="GST" value={kyc.gstNumber} />
        <Info label="Bank Holder" value={kyc.bankAccountHolderName} />
        <Info label="Bank Name" value={kyc.bankName} />
        <Info label="Bank A/C No." value={kyc.accountNumber || kyc.bankAccountNo} />
        <Info label="IFSC Code" value={kyc.ifscCode} />
        <Info label="UPI ID" value={kyc.upiId} />
        <Info label="Orchard Name" value={kyc.orchardName || user.orchardName} />
        <Info label="Orchard Location" value={kyc.orchardLocation} />
        <Info label="Vehicle Number" value={kyc.vehicleNumber} />
        <Info label="Driving License" value={kyc.drivingLicenseNumber} />
        <Info label="Udyan Card Number" value={kyc.udyanCardNo} />
        <Info label="Submitted At" value={formatDate(kyc.submittedAt)} />
        <Info label="Admin Remarks" value={kyc.adminRemarks} />
      </div>
      <UploadedFilesPanel
        onViewFile={onViewFile}
        files={[
          { label: 'View ID Proof', path: kyc.idProofImage || kyc.aadhaarCardFileUrl },
          { label: 'View PAN', path: kyc.panImage },
          { label: 'View GST Certificate', path: kyc.gstCertificate },
          { label: 'View Bank Proof / Passbook', path: kyc.passbookFileUrl },
          { label: 'View Udyan Card', path: kyc.udyanCardFileUrl },
          { label: 'View Driving License', path: kyc.drivingLicenseImage },
          ...extraDocuments,
        ]}
      />
      {kyc.adminReviews?.length ? (
        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900 p-3">
          <p className="text-sm font-black text-white">Admin Review History</p>
          <div className="mt-2 space-y-2">
            {kyc.adminReviews.map((review, index) => (
              <p key={`${review.reviewedAt || index}-${review.action}`} className="text-xs font-semibold text-slate-300">
                {review.action} by {review.admin?.name || review.admin?.email || review.adminClass || 'Admin'} · {formatDate(review.reviewedAt)}
                {review.note ? ` · ${review.note}` : ''}
              </p>
            ))}
          </div>
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={downloadInformation}
          className="rounded-lg bg-sky-700 px-3 py-2 text-sm font-bold text-white hover:bg-sky-600"
        >
          Download Full KYC Information
        </button>
        <button
          type="button"
          onClick={() => setIsEditing((current) => !current)}
          className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-bold text-white hover:bg-amber-500"
        >
          {isEditing ? 'Cancel Information Change' : 'Change Mismatched Information'}
        </button>
      </div>
      {isEditing ? (
        <div className="mt-3 rounded-xl border border-amber-800 bg-amber-950/30 p-3">
          <p className="text-sm font-black text-amber-200">Correct information after matching it with the uploaded documents.</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {visibleEditFields.map((field) => (
              <label key={field.key} className="block text-sm font-bold text-slate-300">
                {field.label}
                <input
                  value={editDraft[field.key] || ''}
                  onChange={(event) => setEditDraft((current) => ({ ...current, [field.key]: event.target.value }))}
                  className="mt-2 h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-white outline-none focus:border-amber-400"
                />
              </label>
            ))}
          </div>
          <button
            type="button"
            disabled={isSaving}
            onClick={saveInformation}
            className="mt-3 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-60"
          >
            {isSaving ? 'Saving...' : 'Save Corrected Information'}
          </button>
        </div>
      ) : null}
      <div className="mt-4 grid gap-2 md:grid-cols-4">
        <AdminActionButton label="Under Review" onClick={() => onReview('kyc', user._id, 'UNDER_REVIEW')} />
        <AdminActionButton
          label={isApproved ? 'Approved' : 'Approve'}
          onClick={() => onReview('kyc', user._id, 'APPROVE')}
          disabled={isApproved}
          success={isApproved}
        />
        <AdminActionButton label="Correction Required" onClick={() => onReview('kyc', user._id, 'CORRECTION_REQUIRED')} />
        <AdminActionButton label="Reject" onClick={() => onReview('kyc', user._id, 'REJECT')} danger />
      </div>
    </article>
  );
}

function VerificationRequestCard({
  request,
  onReview,
  onEdit,
  onViewFile,
}: {
  request: VerificationRequest;
  onReview: (type: 'verification', id: string, action: ReviewAction) => void;
  onEdit: (request: VerificationRequest) => void;
  onViewFile: (file: UploadedFile) => void;
}) {
  const status = String(request.status || '').toUpperCase();
  const roleType = String(request.roleType || request.user?.role || 'grower').toLowerCase();
  const youtubeUrl = request.youtubeLink || (request.youtubeVideoId ? `https://www.youtube.com/watch?v=${request.youtubeVideoId}` : '');
  const uploadedDocuments = (request.documents || []).map((file, index) => ({
    label: file.label || `View Proof ${index + 1}`,
    path: file.path || file.url,
    fileName: file.fileName,
  }));

  return (
    <article className="rounded-xl border border-slate-800 bg-slate-950 p-4">
      <RequestHeader
        title={request.orchardName}
        subtitle={`${roleType} OG verification - ${request.user?.email || request.user?.phone || request.phone}`}
        status={request.status}
      />
      <div className="mt-4 grid gap-2 text-sm text-slate-300">
        <Info label="Role Type" value={roleType} />
        <Info label="Verification Type" value={request.verificationType || 'og_verified'} />
        <Info label="Company / Orchard Name" value={request.orchardName} />
        <Info label="Owner / Contact Person" value={request.ownerName} />
        <Info label="Location" value={request.location} />
        <Info label="Phone" value={request.phone} />
        <Info label="Submitted At" value={formatDate(request.createdAt)} />
        <Info label="Admin Remarks" value={request.adminRemarks} />
      </div>
      <UploadedFilesPanel
        onViewFile={onViewFile}
        files={[
          {
            label: 'View Udyan Card Pic/PDF',
            path: request.udyanCardFile?.path,
            fileName: request.udyanCardFile?.originalName,
          },
          {
            label: 'View Uploaded Video',
            path: request.orchardVideo?.path,
            fileName: request.orchardVideo?.originalName,
          },
          {
            label: 'View YouTube Video',
            path: youtubeUrl,
          },
          ...uploadedDocuments,
        ]}
      />
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <AdminActionButton label="Edit" onClick={() => onEdit(request)} />
        <AdminActionButton label="Under Review" onClick={() => onReview('verification', request._id, 'UNDER_REVIEW')} />
        <AdminActionButton label="Hold" onClick={() => onReview('verification', request._id, 'HOLD')} />
        <AdminActionButton label="Suspend" onClick={() => onReview('verification', request._id, 'SUSPEND')} danger />
        <AdminActionButton label="Terminate" onClick={() => onReview('verification', request._id, 'TERMINATE')} danger />
      </div>
      <ReviewButtons
        onApprove={() => onReview('verification', request._id, 'APPROVE')}
        onReject={() => onReview('verification', request._id, 'REJECT')}
        approved={status === 'APPROVED'}
      />
    </article>
  );
}

function RequestHeader({
  title,
  subtitle,
  status,
}: {
  title: string;
  subtitle: string;
  status: string;
}) {
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-bold text-white">{title}</h3>
          <p className="mt-1 text-xs font-semibold text-slate-400">{subtitle}</p>
        </div>
        <span className="rounded-full bg-slate-800 px-3 py-1 text-[10px] font-bold text-emerald-300">
          {status}
        </span>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string }) {
  return (
    <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-2">
      <span className="font-bold text-slate-500">{label}</span>
      <span className="min-w-0 break-words text-slate-200">{value || 'Not available'}</span>
    </div>
  );
}

function UploadedFilesPanel({
  files,
  onViewFile,
}: {
  files: UploadedFile[];
  onViewFile: (file: UploadedFile) => void;
}) {
  const uploadedFiles = files.filter((file, index, allFiles) => {
    const href = normalizeFileUrl(file.path || file.url);
    if (!href) return false;
    return allFiles.findIndex((candidate) => normalizeFileUrl(candidate.path || candidate.url) === href) === index;
  });

  if (!uploadedFiles.length) return null;

  return (
    <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-black text-white">Uploaded Documents / Media</p>
        <span className="rounded-full bg-slate-950 px-2 py-1 text-[10px] font-bold text-slate-400">
          {uploadedFiles.length}
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {uploadedFiles.map((file) => (
          <FileViewButton key={`${file.label}-${file.path || file.url}`} file={file} onViewFile={onViewFile} />
        ))}
      </div>
    </div>
  );
}

function FileViewButton({
  file,
  onViewFile,
}: {
  file: UploadedFile;
  onViewFile: (file: UploadedFile) => void;
}) {
  const href = normalizeFileUrl(file.path || file.url);

  return (
    <div className="flex overflow-hidden rounded-lg border border-slate-700">
      <button
        type="button"
        onClick={() => onViewFile(file)}
        title={file.fileName || file.label}
        className="min-w-0 flex-1 bg-emerald-600 px-3 py-2 text-center text-sm font-bold text-white hover:bg-emerald-500"
      >
        {file.label}
      </button>
      <a
        href={href}
        download={file.fileName || file.label}
        target="_blank"
        rel="noreferrer"
        className="bg-sky-700 px-3 py-2 text-sm font-bold text-white hover:bg-sky-600"
      >
        Download
      </a>
    </div>
  );
}

function FilePreviewModal({
  file,
  authHeaders,
  onClose,
}: {
  file: UploadedFile;
  authHeaders: Record<string, string>;
  onClose: () => void;
}) {
  const href = normalizeFileUrl(file.path || file.url);
  const name = file.fileName || file.label;
  const isPdf = /\.pdf($|\?)/i.test(href) || /\.pdf$/i.test(name);
  const isImage = /\.(png|jpe?g|webp|gif|bmp|svg)($|\?)/i.test(href) || /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(name);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState('');
  const [pdfPreviewError, setPdfPreviewError] = useState('');
  const [pdfPreviewLoading, setPdfPreviewLoading] = useState(isPdf);

  useEffect(() => {
    if (!isPdf) return undefined;
    let objectUrl = '';
    let cancelled = false;
    setPdfPreviewLoading(true);
    setPdfPreviewError('');

    const loadPdf = async () => {
      try {
        const isCloudinaryFile = /^https:\/\/res\.cloudinary\.com\//i.test(href);
        const previewUrl = isCloudinaryFile
          ? `${API_BASE}/admin/files/preview?url=${encodeURIComponent(href)}`
          : href;
        const response = await fetch(previewUrl, { headers: isCloudinaryFile ? authHeaders : undefined });
        if (!response.ok) {
          const errorData = await readResponseJson(response);
          throw new Error(errorData.msg || `PDF returned ${response.status}`);
        }
        const blob = await response.blob();
        if (blob.type && !blob.type.includes('pdf')) throw new Error('Uploaded file is not a valid PDF.');
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) setPdfPreviewUrl(objectUrl);
      } catch (error) {
        if (!cancelled) {
          setPdfPreviewError(error instanceof Error ? error.message : 'PDF preview could not be loaded.');
        }
      } finally {
        if (!cancelled) setPdfPreviewLoading(false);
      }
    };
    loadPdf();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [authHeaders, href, isPdf]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 p-4">
          <div className="min-w-0">
            <p className="truncate text-base font-black text-white">{name}</p>
            <p className="text-xs font-bold text-slate-400">Supports Pic/PDF preview</p>
          </div>
          <div className="flex gap-2">
            <a
              href={href}
              download={name}
              className="rounded-lg bg-sky-700 px-3 py-2 text-sm font-bold text-white hover:bg-sky-600"
            >
              Download
            </a>
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-500"
            >
              Open New Tab
            </a>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-bold text-white hover:bg-slate-700"
            >
              Close
            </button>
          </div>
        </div>
        <div className="min-h-[55vh] overflow-auto p-4">
          {isImage ? (
            <img src={href} alt={name} className="mx-auto max-h-[72vh] max-w-full rounded-lg object-contain" />
          ) : isPdf && pdfPreviewLoading ? (
            <div className="flex min-h-[55vh] items-center justify-center rounded-xl border border-slate-800 text-sm font-bold text-slate-300">
              Loading PDF securely...
            </div>
          ) : isPdf && pdfPreviewUrl ? (
            <iframe title={name} src={pdfPreviewUrl} className="h-[72vh] w-full rounded-lg border border-slate-800 bg-white" />
          ) : isPdf ? (
            <div className="rounded-xl border border-rose-900 bg-rose-950/40 p-6 text-center">
              <p className="text-sm font-bold text-rose-200">{pdfPreviewError || 'PDF preview could not be loaded.'}</p>
              <p className="mt-2 text-xs font-semibold text-slate-300">Use Download or Open New Tab. If that also fails, the source document must be uploaded again.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-700 p-6 text-center">
              <p className="text-sm font-bold text-slate-300">
                This file type cannot be previewed here. Use Open New Tab.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewButtons({
  onApprove,
  onReject,
  approved = false,
}: {
  onApprove: () => void;
  onReject: () => void;
  approved?: boolean;
}) {
  return (
    <div className="mt-4 flex gap-2">
      <button
        onClick={onApprove}
        disabled={approved}
        className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold text-white ${
          approved ? 'cursor-not-allowed bg-emerald-700' : 'bg-emerald-600 hover:bg-emerald-500'
        }`}
      >
        {approved ? 'Approved' : 'Approve'}
      </button>
      <button
        onClick={onReject}
        className="flex-1 rounded-lg bg-red-700 px-3 py-2 text-sm font-bold text-white hover:bg-red-600"
      >
        Reject
      </button>
    </div>
  );
}

function AdminActionButton({
  label,
  onClick,
  danger = false,
  disabled = false,
  success = false,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  success?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg px-3 py-2 text-sm font-bold ${
        disabled && success
          ? 'cursor-not-allowed border border-emerald-500 bg-emerald-700 text-white'
          : disabled
            ? 'cursor-not-allowed border border-slate-700 bg-slate-800 text-slate-500'
            : danger
          ? 'border border-red-900 bg-red-950 text-red-100 hover:bg-red-900'
          : 'border border-slate-700 bg-slate-900 text-slate-100 hover:border-emerald-400'
      }`}
    >
      {label}
    </button>
  );
}

function EmptyState({ label = 'No requests to review.' }: { label?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-700 p-5 text-sm font-semibold text-slate-400">
      {label}
    </div>
  );
}

function filterProducts(products: AdminProduct[], search: string) {
  const query = search.trim().toLowerCase();
  if (!query) return products;

  return products.filter((product) =>
    [product.title, product.fruitName, product.variety, product.description, product.location, product.status]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(query)
  );
}

function filterUsers(users: AdminUser[], search: string) {
  const query = search.trim().toLowerCase();
  if (!query) return users;

  return users.filter((user) =>
    [user.name, user.email, user.phone, user.role || '', user.businessName, user.orchardName, user.location, user.accountStatus]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(query)
  );
}

function filterMandiCommodities(commodities: MandiCommodity[], search: string) {
  const query = search.trim().toLowerCase();
  if (!query) return commodities;

  return commodities.filter((item) =>
    [item.commodity, item.displayName, item.category, item.aliases?.join(' '), item.adminNotes]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(query)
  );
}

function getTabFromPath(pathname: string): AdminTab {
  const normalizedPath = pathname.replace(/\/+$/, '') || '/';
  const matchedRoute = (Object.entries(adminRoutePaths) as [AdminTab, string][]).find(
    ([, path]) => path === normalizedPath
  );

  return matchedRoute?.[0] || 'dashboard';
}

function getDefaultTabForPlatform(platform: AdminPlatform, role: AdminRole): AdminTab {
  const defaultTabs: Record<AdminPlatform, AdminTab> = {
    main: 'dashboard',
    orchard: 'inventory',
    orchardAi: 'orchardAiDashboard',
    efruitmandi: 'efruitDashboard',
    userManagement: 'staffUsers',
    notifications: 'notifications',
    businessMail: 'businessMail',
    system: 'systemSettings',
    download: 'downloadApp',
    logout: 'dashboard',
  };

  const platformDefault = defaultTabs[platform];
  if (canAccessAdminTab(role, platformDefault)) return platformDefault;

  const firstAllowedPlatformTab = platformTabs[platform]
    ?.map((tab) => tab.id)
    .find((tab) => canAccessAdminTab(role, tab));

  return firstAllowedPlatformTab || getDefaultAdminTab(role);
}

function normalizeProductStatusInput(status: string) {
  const nextStatus = status.trim().toUpperCase().replace(/\s+/g, '_');
  if (['ACTIVE', 'AVAILABLE'].includes(nextStatus)) return 'AVAILABLE';
  if (['QUOTE_ENABLED', 'QUOTE_MODE'].includes(nextStatus)) return 'IN_AUCTION';
  if (['INACTIVE', 'SOLD'].includes(nextStatus)) return 'SOLD';
  return nextStatus;
}

function formatProductStatus(status: string) {
  if (status === 'AVAILABLE') return 'ACTIVE';
  if (status === 'IN_AUCTION') return 'OFFER ENABLED';
  if (status === 'SOLD') return 'INACTIVE';
  return status;
}

function normalizeFileUrl(path?: string) {
  if (!path) return '';
  if (/^https?:\/\//.test(path)) return path;
  return `${FILE_BASE}/${path.replace(/\\/g, '/')}`;
}

function isOrganicCertifiedProduct(product: AdminProduct) {
  const quality = String(product.quality || '').toLowerCase();
  return (
    quality.includes('certified organic') ||
    Boolean(product.organicCertificationNo || product.organicCertificateUrl)
  );
}

function getProductGrowerName(product: AdminProduct) {
  const createdBy = product.createdBy;
  if (createdBy && typeof createdBy === 'object') {
    return createdBy.orchardName || createdBy.businessName || createdBy.name || 'Grower';
  }

  return 'Grower';
}

function confirmTwice(actionLabel: string) {
  return (
    window.confirm(`Confirm you want to ${actionLabel}.`) &&
    window.confirm(`Final confirmation: ${actionLabel} will be applied now.`)
  );
}

function notifyLocalAction(message: string) {
  window.alert(message);
}

const INVOICE_SEQUENCE_KEY = 'orchard_invoice_sequence';

function getInvoiceSerial(invoiceNumber?: string) {
  const match = String(invoiceNumber || '').match(/^OG\/\d{4}\/(\d+)$/);
  return match ? Number(match[1]) : 0;
}

function formatInvoiceNumber(serial: number, year = new Date().getFullYear()) {
  return `OG/${year}/${String(serial).padStart(7, '0')}`;
}

function getNextInvoiceNumber(orders: AdminOrder[] = []) {
  const year = new Date().getFullYear();
  const savedSerial = Number(getAdminStorageItem(INVOICE_SEQUENCE_KEY) || 0);
  const onlineSerial = orders.reduce((max, order) => Math.max(max, getInvoiceSerial(order.invoiceNumber)), 0);
  return formatInvoiceNumber(Math.max(savedSerial, onlineSerial) + 1, year);
}

function commitInvoiceNumber(invoiceNumber: string) {
  const serial = getInvoiceSerial(invoiceNumber);
  if (serial > 0) setAdminStorageItem(INVOICE_SEQUENCE_KEY, String(serial));
}

export default App;
