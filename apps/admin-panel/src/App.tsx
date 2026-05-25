import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode, type RefObject } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import InstallAppPrompt, { openAdminInstallPrompt } from './components/InstallAppPrompt';

const rawApiBase =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  'https://orchard-growers-backend.onrender.com';

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
const ADMIN_AUTH_SOURCE = {
  platform: 'orchardgrowers',
  sourceApp: 'admin-panel',
} as const;
const ADMIN_OTP_RESEND_SECONDS = 60;

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
  if (err instanceof TypeError) {
    return 'Admin API request failed. Check VITE_API_BASE_URL, HTTPS, and backend CORS origins.';
  }

  return err instanceof Error ? err.message : 'Admin API request failed';
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
  businessName?: string;
  orchardName?: string;
  isVerified?: boolean;
  kyc?: {
    udyanCardNo?: string;
    udyanCardFileUrl?: string;
    bankAccountNo?: string;
    ifscCode?: string;
    passbookFileUrl?: string;
    aadhaarCardNo?: string;
    aadhaarCardFileUrl?: string;
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
  status: string;
  createdAt: string;
  youtubeVideoId?: string;
  udyanCardFile?: FileMeta;
  orchardVideo?: FileMeta;
  adminReviews?: Review[];
  user?: {
    _id?: string;
    name?: string;
    email?: string;
    role?: string;
    isVerified?: boolean;
    accountStatus?: string;
  };
};

type AdminOrder = {
  _id: string;
  invoiceNumber?: string;
  customer?: { name?: string; phone?: string; email?: string };
  shippingAddress?: { city?: string; state?: string; pinCode?: string };
  items?: { title?: string; quantity?: number; unitPrice?: number; lineTotal?: number }[];
  totalAmount?: number;
  paymentStatus?: string;
  deliveryStatus?: string;
  courierPartner?: string;
  courierBookingStatus?: string;
  trackingNumber?: string;
  createdAt?: string;
};

type FileMeta = {
  path?: string;
  originalName?: string;
  mimetype?: string;
};

type AdminPlatform = 'main' | 'orchard' | 'efruitmandi' | 'userManagement' | 'notifications' | 'system' | 'download' | 'logout';
type AdminThemeMode = 'light' | 'dark' | 'system';
type AdminTab =
  | 'dashboard'
  | 'master'
  | 'inventory'
  | 'productAdmin'
  | 'purchase'
  | 'billing'
  | 'sales'
  | 'unitsOutlets'
  | 'expenses'
  | 'financials'
  | 'reports'
  | 'orchardSettings'
  | 'efruitDashboard'
  | 'users'
  | 'kyc'
  | 'produceLots'
  | 'quotes'
  | 'deals'
  | 'transactions'
  | 'supportDisputes'
  | 'analytics'
  | 'efruitSettings'
  | 'staffUsers'
  | 'customers'
  | 'sellers'
  | 'buyers'
  | 'rolesPermissions'
  | 'suspendedUsers'
  | 'notifications'
  | 'systemSettings'
  | 'downloadApp';
type OrchardModulePages = Partial<Record<AdminTab, string>>;
type ReviewAction = 'APPROVE' | 'REJECT' | 'HOLD' | 'SUSPEND' | 'TERMINATE';
type UploadedFile = { label: string; path?: string; fileName?: string };
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
  unit?: string;
  seoMetaTitle?: string;
  seoMetaDescription?: string;
  featured?: boolean;
  active?: boolean;
  description?: string;
  quantity?: number;
  basePrice?: number;
  discountPercent?: number;
  location?: string;
  status?: string;
  packingType?: string;
  images?: string[];
  imagePublicIds?: string[];
  createdAt?: string;
};
type AdminUser = {
  _id: string;
  name?: string;
  email?: string;
  phone?: string;
  role?: string | null;
  businessName?: string;
  orchardName?: string;
  location?: string;
  accountStatus?: string;
  isVerified?: boolean;
  adminNotes?: string;
  createdAt?: string;
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
  unit: string;
  seoMetaTitle: string;
  seoMetaDescription: string;
  featured: boolean;
  active: boolean;
  description: string;
  quantity: string;
  basePrice: string;
  discountPercent: string;
  location: string;
  packingType: string;
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
  unit: 'Plant',
  seoMetaTitle: '',
  seoMetaDescription: '',
  featured: false,
  active: true,
  description: '',
  quantity: '',
  basePrice: '',
  discountPercent: '',
  location: 'Orchard Growers',
  packingType: 'Orchard Growers pack',
  status: 'AVAILABLE',
  uploadedImages: [],
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
    'Units / Outlets': 'unitsOutlets',
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
  },
  financials: {
    Expenses: 'expenses',
    Reports: 'reports',
  },
};

const defaultOrchardModulePages: Partial<Record<AdminTab, string>> = {
  master: 'Add Product',
  inventory: 'Current Stock',
  billing: 'New Invoice',
  financials: 'Expenses',
  orchardSettings: 'Invoice Series',
};

const adminRoutePaths: Record<AdminTab, string> = {
  dashboard: '/dashboard',
  master: '/orchard/master',
  inventory: '/orchard/inventory',
  productAdmin: '/orchard/products',
  purchase: '/orchard/purchase',
  billing: '/orchard/billing',
  sales: '/orchard/sales-invoice',
  unitsOutlets: '/orchard/units-outlets',
  expenses: '/orchard/expenses',
  financials: '/orchard/financials',
  reports: '/orchard/reports',
  orchardSettings: '/orchard/settings',
  efruitDashboard: '/efruitmandi/dashboard',
  users: '/efruitmandi/users',
  kyc: '/efruitmandi/kyc-verification',
  produceLots: '/efruitmandi/produce-lots',
  quotes: '/efruitmandi/quotes',
  deals: '/efruitmandi/deals',
  transactions: '/efruitmandi/transactions',
  supportDisputes: '/efruitmandi/support-disputes',
  analytics: '/efruitmandi/analytics',
  efruitSettings: '/efruitmandi/settings',
  staffUsers: '/users/staff',
  customers: '/users/customers',
  sellers: '/users/sellers-growers-farmers',
  buyers: '/users/buyers',
  rolesPermissions: '/users/roles-permissions',
  suspendedUsers: '/users/suspended',
  notifications: '/notifications',
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
  unitsOutlets: 'orchard',
  expenses: 'orchard',
  financials: 'orchard',
  reports: 'orchard',
  orchardSettings: 'orchard',
  efruitDashboard: 'efruitmandi',
  users: 'efruitmandi',
  kyc: 'efruitmandi',
  produceLots: 'efruitmandi',
  quotes: 'efruitmandi',
  deals: 'efruitmandi',
  transactions: 'efruitmandi',
  supportDisputes: 'efruitmandi',
  analytics: 'efruitmandi',
  efruitSettings: 'efruitmandi',
  staffUsers: 'userManagement',
  customers: 'userManagement',
  sellers: 'userManagement',
  buyers: 'userManagement',
  rolesPermissions: 'userManagement',
  suspendedUsers: 'userManagement',
  notifications: 'notifications',
  systemSettings: 'system',
  downloadApp: 'download',
};

const platformTabs: Record<AdminPlatform, AdminTabButton[]> = {
  main: [{ id: 'dashboard', label: 'Dashboard' }],
  orchard: [
    { id: 'master', label: 'Master' },
    { id: 'inventory', label: 'Inventory' },
    { id: 'billing', label: 'Billing' },
    { id: 'financials', label: 'Financials' },
    { id: 'orchardSettings', label: 'Settings' },
  ],
  efruitmandi: [
    { id: 'efruitDashboard', label: 'Dashboard' },
    { id: 'users', label: 'Users' },
    { id: 'kyc', label: 'KYC Verification' },
    { id: 'produceLots', label: 'Produce Lots' },
    { id: 'quotes', label: 'Quotes' },
    { id: 'deals', label: 'Deals' },
    { id: 'transactions', label: 'Transactions' },
    { id: 'supportDisputes', label: 'Support & Disputes' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'efruitSettings', label: 'Settings' },
  ],
  userManagement: [
    { id: 'staffUsers', label: 'Staff Users' },
    { id: 'customers', label: 'Customers' },
    { id: 'sellers', label: 'Sellers / Growers / Farmers' },
    { id: 'buyers', label: 'Buyers' },
    { id: 'rolesPermissions', label: 'Roles & Permissions' },
    { id: 'suspendedUsers', label: 'Suspended Users' },
  ],
  notifications: [{ id: 'notifications', label: 'Notifications' }],
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
  EMPLOYEE: allAdminTabs.filter((tab) => tab !== 'systemSettings'),
  UNIT_MANAGER: ['dashboard', 'master', 'inventory', 'productAdmin', 'billing', 'sales', 'unitsOutlets', 'expenses', 'reports', 'orchardSettings', 'notifications', 'downloadApp'],
  INVENTORY_MANAGER: ['dashboard', 'master', 'inventory', 'productAdmin', 'purchase', 'reports', 'notifications', 'downloadApp'],
  SALES_EXECUTIVE: ['dashboard', 'billing', 'sales', 'customers', 'reports', 'notifications', 'downloadApp'],
  PURCHASE_MANAGER: ['dashboard', 'master', 'inventory', 'purchase', 'reports', 'notifications', 'downloadApp'],
  FINANCE_MANAGER: ['dashboard', 'billing', 'expenses', 'financials', 'transactions', 'reports', 'analytics', 'notifications', 'downloadApp'],
  VERIFICATION_OFFICER: ['dashboard', 'efruitDashboard', 'users', 'kyc', 'produceLots', 'sellers', 'buyers', 'suspendedUsers', 'notifications', 'downloadApp'],
  SUPPORT_EXECUTIVE: ['dashboard', 'users', 'customers', 'sellers', 'buyers', 'supportDisputes', 'suspendedUsers', 'notifications', 'downloadApp'],
  VIEWER: ['dashboard', 'reports', 'efruitDashboard', 'analytics', 'notifications', 'downloadApp'],
};
const adminRolePermissionSets = Object.fromEntries(
  Object.entries(adminRolePermissions).map(([role, tabs]) => [role, new Set(tabs)])
) as Record<AdminRole, Set<AdminTab>>;
const normalizeAdminRole = (role?: string): AdminRole =>
  role && Object.prototype.hasOwnProperty.call(adminRoleLabels, role) ? (role as AdminRole) : 'VIEWER';
const canAccessAdminTab = (role: AdminRole, tab: AdminTab) =>
  adminRolePermissionSets[role]?.has(tab) || false;
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
    fields: ['Product Name', 'Slug', 'SKU', 'HSN Code', 'CGST', 'SGST', 'Category', 'Type', 'Unit', 'SEO', 'Featured', 'Active', 'Images 1-5'],
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
    text: 'Financial controls for expenses, GST summary, stock valuation, unit-wise reporting, and operational reports.',
    pages: ['Expenses', 'GST Summary', 'Sales Report', 'Purchase Report', 'Stock Valuation', 'Unit-wise Performance', 'Low Stock Report'],
  },
  reports: {
    title: 'Reports',
    text: 'Consolidated Orchard Growers reporting for sales, purchase, GST, stock valuation, unit performance, and low stock controls.',
    pages: ['Sales Report', 'Purchase Report', 'GST Report', 'Stock Valuation', 'Unit-wise Performance', 'Low Stock Report'],
  },
  orchardSettings: {
    title: 'Settings',
    text: 'Orchard Growers ERP configuration for storefront stock sync, invoice sequence, tax defaults, and low stock thresholds.',
    pages: ['Invoice Series', 'Stock Sync', 'GST Defaults', 'Low Stock Thresholds', 'Storefront Visibility'],
  },
  efruitDashboard: {
    title: 'eFruitMandi Dashboard',
    text: 'Marketplace monitoring only. Lot creation, quote submission, deal creation, transaction records, service charge, and settlement status are automated.',
    rules: [
      'Seller / grower lists produce lot',
      'Buyer submits quoted price',
      'Seller accepts quoted price',
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
  produceLots: {
    title: 'Produce Lots',
    text: 'Admin monitors listed produce lots and handles exception cases only. Sellers, growers, and farmers create lots from their own account.',
    pages: ['View Listed Lots', 'Edit Lot if Required', 'Pause / Hide Lot', 'Approve / Reject Problematic Lot', 'Lot Issue History'],
    rules: ['Do not create manual produce lots from admin by default.', 'Use edit only for support, correction, or suspicious listing cases.'],
  },
  quotes: {
    title: 'Quote Management',
    text: 'Review quote requests, quoted prices, accepted deals, rejected quotes, and deal conversion without manual marketplace billing.',
    pages: ['Active Quote Requests', 'Quoted Prices', 'Accepted Deals', 'Rejected Quotes', 'Deal Conversion'],
    fields: ['Quote', 'Quoted Price', 'Price Offer', 'Quote Request', 'Deal Price', 'Accepted Deal', 'Price Negotiation'],
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
    pages: ['Sales Pattern', 'Quote Pattern', 'Deal Pattern', 'Produce-wise Demand', 'Location-wise Demand', 'Transaction Pattern', 'Revenue Pattern'],
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
    text: 'Buyer profile, quote activity, deal history, payment status, support, and account controls.',
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
  const [products, setProducts] = useState<AdminProduct[]>([]);
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
      const [kycRes, verificationRes, ordersRes, usersRes, productsRes] = await Promise.all([
        fetch(`${API_BASE}/admin/kyc-requests`, { headers: authHeaders }),
        fetch(`${API_BASE}/admin/verification-requests`, { headers: authHeaders }),
        fetch(`${API_BASE}/admin/orders`, { headers: authHeaders }),
        fetch(`${API_BASE}/admin/users`, { headers: authHeaders }),
        fetch(`${API_BASE}/admin/products`, { headers: authHeaders }),
      ]);

      if ([kycRes, verificationRes, ordersRes, usersRes, productsRes].some((res) => [401, 403].includes(res.status))) {
        clearAdminSession('Admin session expired or access was revoked. Please log in again.');
        return;
      }

      const [kycData, verificationData, ordersData, usersData, productsData] = await Promise.all([
        readResponseJson(kycRes),
        readResponseJson(verificationRes),
        readResponseJson(ordersRes),
        readResponseJson(usersRes),
        readResponseJson(productsRes),
      ]);
      if (!kycRes.ok) throw new Error(kycData.msg || 'Could not load KYC requests');
      if (!verificationRes.ok) {
        throw new Error(verificationData.msg || 'Could not load verification requests');
      }
      if (!ordersRes.ok) throw new Error(ordersData.msg || 'Could not load orders');
      if (!usersRes.ok) throw new Error(usersData.msg || 'Could not load users');
      if (!productsRes.ok) throw new Error(productsData.msg || 'Could not load products');
      setKycRequests(kycData || []);
      setVerificationRequests(verificationData || []);
      setOrders(ordersData || []);
      setUsers(usersData || []);
      setProducts(productsData || []);
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
    if (['HOLD', 'SUSPEND', 'TERMINATE'].includes(action) && !confirmTwice(`${action.toLowerCase()} this request and user account`)) {
      return;
    }

    const path =
      type === 'kyc'
        ? `${API_BASE}/admin/kyc-requests/${id}/review`
        : `${API_BASE}/admin/verification-requests/${id}/review`;
    const res = await fetch(path, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ action }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.msg || 'Review failed');
      return;
    }
    setMessage(
      action === 'APPROVE'
        ? 'Approval saved. User verifies after Class1 and Class2 approval.'
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
    if (productDraft.uploadedImages.length < 5) {
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
    const basePrice = window.prompt('Update product price', String(product.basePrice ?? 0));
    if (basePrice === null) return;
    const status = window.prompt('Status: ACTIVE, QUOTE_ENABLED, INACTIVE', formatProductStatus(product.status || 'AVAILABLE'));
    if (status === null) return;
    const nextStatus = normalizeProductStatusInput(status);

    const res = await fetch(`${API_BASE}/admin/products/${product._id}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ quantity: Number(quantity), basePrice: Number(basePrice), status: nextStatus }),
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

  const pendingKycCount = kycRequests.filter((user) => user.kyc?.status === 'COMPLETED').length;
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
    users: users.length,
    kyc: kycRequests.length + verificationRequests.length,
    sellers: users.filter((user) => user.role === 'grower').length,
    buyers: users.filter((user) => user.role === 'buyer').length,
    suspendedUsers: users.filter((user) => ['HOLD', 'SUSPENDED', 'TERMINATED'].includes(user.accountStatus || '')).length,
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
      label: actionTab?.label || getAdminTabTitle(activeTab, activePlatform),
      count: countByTab[activeTab],
    },
  ];
  const activeTitle = getAdminTabTitle(activeTab, activePlatform);
  const searchedProducts = filterProducts(products, adminSearch);
  const searchedUsers = filterUsers(users, adminSearch);
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
    let nextTab = tab;

    if (options?.childLabel && options.parentTab) {
      setOrchardModulePages((current) => ({
        ...current,
        [options.parentTab as AdminTab]: options.childLabel as string,
      }));
    } else {
      const lastChildLabel = getOrchardModulePage(tab);
      nextTab = orchardModuleChildRoutes[tab]?.[lastChildLabel] || tab;
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
      return null;
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
      return (
        <section className="space-y-4">
          <ProductAdminPanel
            draft={productDraft}
            onChange={setProductDraft}
            onSubmit={saveOrchardProduct}
            saving={productSaving}
            uploadAuthHeaders={uploadAuthHeaders}
            editing={Boolean(editingProductId)}
            onCancelEdit={cancelProductEdit}
          />
          <OrchardProductsTable products={searchedProducts} onEdit={editOrchardProduct} onDelete={deleteOrchardProduct} />
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
    if (tab === 'orchardSettings') {
      return null;
    }
    if (tab === 'financials') {
      return null;
    }
    if (['purchase', 'unitsOutlets', 'expenses', 'reports'].includes(tab)) {
      return null;
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
          <ModulePlanPanel plan={modulePlans.efruitDashboard} />
        </section>
      );
    }
    if (tab === 'users') {
      return (
        <section className="space-y-4">
          <ModulePlanPanel plan={modulePlans.users} />
          <UsersPanel users={searchedUsers} onEdit={editUserInfo} onStatus={setUserStatus} />
        </section>
      );
    }
    if (tab === 'kyc') {
      return (
        <KycVerificationPanel
          kycRequests={kycRequests}
          verificationRequests={verificationRequests}
          onReview={review}
          onEditVerification={editVerificationRequest}
          onViewFile={setViewingFile}
        />
      );
    }
    if (['produceLots', 'quotes', 'deals', 'transactions', 'supportDisputes', 'analytics', 'efruitSettings'].includes(tab)) {
      return <ModulePlanPanel plan={modulePlans[tab]} />;
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
            badge="Profile, quotes, deals, payments"
            emptyLabel="No buyers found."
            users={searchedUsers.filter((user) => user.role === 'buyer')}
            onEdit={editUserInfo}
            onStatus={setUserStatus}
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
    return <Navigate to={adminRoutePaths.dashboard} replace />;
  };

  return (
    <div className={`admin-theme-${effectiveTheme} h-full overflow-hidden bg-slate-950 p-2 text-slate-100`}>
      <InstallAppPrompt />
      <div className="mx-auto flex h-full min-h-0 max-w-[1360px] flex-col">
        <MarketSnapshotStrip
          announcementRef={announcementBarRef}
          isFullscreen={fullscreenTarget === 'announcement'}
          onFullscreen={toggleAnnouncementFullscreen}
        />
        <section className="admin-top-nav mt-2 grid gap-2 md:grid-cols-[108px_220px_minmax(0,1fr)]">
          <div className="flex h-11 items-center justify-center px-1">
            <img src={LOGO_URL} alt="Orchard Growers Admin" className="h-9 w-auto object-contain" />
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
                className="h-8 rounded-lg bg-white px-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-100"
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
            <main className="flex-1 min-h-0 overflow-y-auto border-x border-slate-700 bg-slate-950 p-4 text-slate-100">
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
                <span>{activePlatform === 'orchard' ? 'Orchard Growers' : getAdminTabTitle(getDefaultTabForPlatform(activePlatform, adminRole), activePlatform)}</span>
                <span>/</span>
                <span className="text-emerald-300">{activeTitle}</span>
              </div>
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
        {viewingFile && <FilePreviewModal file={viewingFile} onClose={() => setViewingFile(null)} />}
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
            { label: 'Units / Outlets', tab: 'unitsOutlets' },
            { label: 'Vendors / Parties' },
            { label: 'Categories' },
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
            { label: 'Returns / Refunds' },
          ],
        },
        {
          label: 'Financials',
          icon: 'financials',
          tab: 'financials',
          children: [
            { label: 'Expenses', tab: 'expenses' },
            { label: 'GST Summary' },
            { label: 'Reports', tab: 'reports' },
          ],
        },
        {
          label: 'Settings',
          icon: 'settings',
          tab: 'orchardSettings',
          children: [
            { label: 'Invoice Series' },
            { label: 'Stock Sync' },
            { label: 'GST Defaults' },
            { label: 'Low Stock Thresholds' },
          ],
        },
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
        { label: 'Produce Lots', icon: 'lot', tab: 'produceLots' },
        { label: 'Quotes', icon: 'quotes', tab: 'quotes' },
        { label: 'Deals', icon: 'deal', tab: 'deals' },
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

  return true;
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
  onChange,
  onOpenTab,
}: {
  activePlatform: AdminPlatform;
  activeTab: AdminTab;
  activePages: OrchardModulePages;
  groups: SidebarGroup[];
  onChange: (platform: AdminPlatform) => void;
  onOpenTab: (platform: AdminPlatform, tab: AdminTab, childLabel?: string, parentTab?: AdminTab) => void;
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
                const childSelected = item.children?.some((child) => isSidebarChildActive(item, child, activeTab, activePages)) || false;
                const selected = Boolean(item.tab && activePlatform === group.platform && (activeTab === item.tab || childSelected));
                const expanded = selected && Boolean(item.children?.length);
                return (
                  <div key={item.label}>
                    <button
                      type="button"
                      onClick={() => (item.action ? item.action() : item.tab && onOpenTab(group.platform, item.tab))}
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
  onOpenTab,
  onOpenPlatform,
  onClose,
}: {
  groups: SidebarGroup[];
  activePlatform: AdminPlatform;
  activeTab: AdminTab;
  activePages: OrchardModulePages;
  onOpenTab: (tab: AdminTab, childLabel?: string, parentTab?: AdminTab) => void;
  onOpenPlatform: (platform: AdminPlatform) => void;
  onClose: () => void;
}) {
  const runAction = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <div id="mobile-admin-menu" className="admin-mobile-menu fixed z-40 md:hidden">
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
              onClick={() => (group.action ? runAction(group.action) : onOpenPlatform(group.platform))}
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
                const childSelected = item.children?.some((child) => isSidebarChildActive(item, child, activeTab, activePages)) || false;
                const selected = Boolean(item.tab && (activeTab === item.tab || childSelected));
                const expanded = selected && Boolean(item.children?.length);
                return (
                  <div key={item.label} className={expanded ? 'col-span-2' : ''}>
                    <button
                      type="button"
                      onClick={() => (item.action ? runAction(item.action) : item.tab && onOpenTab(item.tab))}
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
                                else if (child.tab) onOpenTab(child.tab, child.label, item.tab);
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
    <nav className="flex-shrink-0 flex items-center gap-1 overflow-x-auto border border-slate-700 bg-slate-900 px-2 py-1">
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
  if (activeTab === 'unitsOutlets') return 'Orchard Growers Units / Outlets';
  if (activeTab === 'expenses') return 'Orchard Growers Expenses';
  if (activeTab === 'financials') return 'Orchard Growers Financials';
  if (activeTab === 'reports') return 'Orchard Growers Reports';
  if (activeTab === 'orchardSettings') return 'Orchard Growers Settings';
  if (activeTab === 'efruitDashboard') return 'eFruitMandi Dashboard';
  if (activeTab === 'users') return 'eFruitMandi Users';
  if (activeTab === 'notifications') return 'Admin Notifications';
  if (activeTab === 'kyc') return 'eFruitMandi KYC Verification';
  if (activeTab === 'produceLots') return 'eFruitMandi Produce Lots';
  if (activeTab === 'quotes') return 'eFruitMandi Quotes';
  if (activeTab === 'deals') return 'eFruitMandi Deals';
  if (activeTab === 'transactions') return 'eFruitMandi Transactions';
  if (activeTab === 'supportDisputes') return 'eFruitMandi Support & Disputes';
  if (activeTab === 'analytics') return 'eFruitMandi Analytics';
  if (activeTab === 'efruitSettings') return 'eFruitMandi Settings';
  if (activeTab === 'staffUsers') return 'Staff Users';
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
    { label: 'Review Queue', value: pendingKycCount + pendingVerificationCount, action: 'Open KYC', tab: 'kyc' as const },
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
      <ModulePlanPanel plan={modulePlans.dashboard} />
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
  verificationRequests,
  onReview,
  onEditVerification,
  onViewFile,
}: {
  kycRequests: KycUser[];
  verificationRequests: VerificationRequest[];
  onReview: (type: 'kyc' | 'verification', id: string, action: ReviewAction) => void;
  onEditVerification: (request: VerificationRequest) => void;
  onViewFile: (file: UploadedFile) => void;
}) {
  return (
    <section className="space-y-4">
      <ModulePlanPanel plan={modulePlans.kyc} />
      <RequestSection title="KYC Verification" count={kycRequests.length}>
        {kycRequests.map((user) => (
          <KycRequestCard key={user._id} user={user} onReview={onReview} onViewFile={onViewFile} />
        ))}
      </RequestSection>
      <RequestSection title="User Verification Requests" count={verificationRequests.length}>
        {verificationRequests.map((request) => (
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
          { label: 'Verification Queue', value: pendingVerificationCount, action: 'Open Verification Desk', tab: 'kyc' as const },
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

  if (activePage !== 'Current Stock') {
    return null;
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
  const invoicePreview = `OG/${new Date().getFullYear()}/0000001`;
  const activeProducts = products.filter((product) => product.status === 'AVAILABLE' && product.active !== false);

  if (activePage !== 'New Invoice') {
    return null;
  }

  return (
    <section className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <MetricCard label="Sales History" value={orders.length} />
        <MetricCard label="Invoice Series" value={1} />
        <MetricCard label="Billable Products" value={activeProducts.length} />
        <MetricCard label="Returns / Refunds" value={0} />
      </div>
      <div className="grid gap-4">
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">New Invoice</h2>
              <p className="mt-1 text-sm font-semibold text-slate-400">Offline billing scaffold with shared online/offline invoice sequence.</p>
            </div>
            <span className="rounded-full bg-emerald-950 px-3 py-1 text-xs font-bold text-emerald-300">{invoicePreview}</span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <AdminInput label="Customer Name" value="" onChange={() => undefined} placeholder="Customer / Firm name" />
            <AdminInput label="Contact Number" value="" onChange={() => undefined} placeholder="Phone number" />
            <AdminInput label="GST No. optional" value="" onChange={() => undefined} placeholder="GSTIN" />
            <AdminInput label="Payment Method" value="" onChange={() => undefined} placeholder="Cash / UPI / Card / Bank" />
          </div>
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-800">
            <table className="min-w-[640px] w-full text-left text-sm">
              <thead className="bg-slate-950 text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-3 py-3">Product</th>
                  <th className="px-3 py-3">Qty</th>
                  <th className="px-3 py-3">Discount</th>
                  <th className="px-3 py-3">Tax</th>
                  <th className="px-3 py-3">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr className="text-slate-400">
                  <td className="px-3 py-3">Select product</td>
                  <td className="px-3 py-3">0</td>
                  <td className="px-3 py-3">0%</td>
                  <td className="px-3 py-3">Auto</td>
                  <td className="px-3 py-3">Rs. 0</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {['Save Invoice', 'Print', 'Generate PDF', 'SMS Summary', 'WhatsApp Share'].map((action) => (
              <button key={action} type="button" className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-bold text-white hover:bg-slate-700">
                {action}
              </button>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

function getProductPayload(draft: ProductDraft) {
  return {
    title: draft.title,
    slug: draft.slug,
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
    unit: draft.unit,
    packingType: draft.packingType,
    seoMetaTitle: draft.seoMetaTitle,
    seoMetaDescription: draft.seoMetaDescription,
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
    unit: product.unit || 'Plant',
    seoMetaTitle: product.seoMetaTitle || '',
    seoMetaDescription: product.seoMetaDescription || '',
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
  };
}

function ProductAdminPanel({
  draft,
  onChange,
  onSubmit,
  saving,
  uploadAuthHeaders,
  editing,
  onCancelEdit,
}: {
  draft: ProductDraft;
  onChange: (draft: ProductDraft) => void;
  onSubmit: (event: FormEvent) => void;
  saving: boolean;
  uploadAuthHeaders: Record<string, string>;
  editing: boolean;
  onCancelEdit: () => void;
}) {
  const createSlug = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  const update = (field: keyof ProductDraft, value: string | boolean | ProductImageUpload[]) => {
    const nextDraft = { ...draft, [field]: value };
    if (field === 'title' && !draft.slug) nextDraft.slug = createSlug(String(value));
    onChange(nextDraft);
  };
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');
  const [imageUploading, setImageUploading] = useState(false);
  const [hsnQuery, setHsnQuery] = useState(draft.hsnCode);
  const [hsnSuggestions, setHsnSuggestions] = useState<HsnSuggestion[]>([]);
  const [hsnOpen, setHsnOpen] = useState(false);
  const [skuGenerating, setSkuGenerating] = useState(false);

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
      undefined;
    } finally {
      setSkuGenerating(false);
    }
  };

  useEffect(() => {
    if (draft.sku || !draft.title.trim() || !(draft.productCategory || draft.fruitName).trim() || !draft.unit.trim()) return;
    generateSku();
  }, [draft.title, draft.productCategory, draft.fruitName, draft.unit, draft.sku]);

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
          <h2 className="text-lg font-bold text-white">{editing ? 'Edit Product' : 'Create Product'}</h2>
          <span className="rounded-full bg-emerald-950 px-3 py-1 text-xs font-bold text-emerald-300">{editing ? 'Edit Mode' : 'Product Master'}</span>
        </div>
        <p className="mt-1 text-sm font-semibold text-slate-400">
          Create own-brand product records for inventory, SEO, storefront sync, and billing.
        </p>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {['Basic', 'Tax & Stock', 'SEO', 'Images'].map((tab) => (
          <span key={tab} className="rounded-full bg-slate-950 px-3 py-1 text-xs font-bold text-slate-300">
            {tab}
          </span>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <AdminInput label="Product Name" value={draft.title} onChange={(value) => update('title', value)} placeholder="Avocado Plant" />
        <AdminInput label="Slug" value={draft.slug} onChange={(value) => update('slug', value)} placeholder="avocado-plant" />
        <label className="block text-sm font-bold text-slate-300">
          SKU
          <div className="mt-2 flex gap-2">
            <input
              value={draft.sku}
              onChange={(event) => update('sku', event.target.value.toUpperCase())}
              placeholder="OG-PLT-APPLE-U1-0001"
              className="h-11 min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 text-white outline-none placeholder:text-slate-600 focus:border-emerald-400"
            />
            <button
              type="button"
              onClick={generateSku}
              disabled={skuGenerating}
              className="rounded-lg bg-slate-800 px-3 text-xs font-bold text-white hover:bg-slate-700 disabled:opacity-60"
            >
              {skuGenerating ? '...' : 'Regenerate SKU'}
            </button>
          </div>
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
          Product Category
          <select
            value={draft.productCategory}
            onChange={(event) => update('productCategory', event.target.value)}
            className="mt-2 h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-white outline-none focus:border-emerald-400"
          >
            <option value="">Select category</option>
            {orchardProductCategories.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </label>
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
        <label className="block text-sm font-bold text-slate-300">
          Product Type
          <select
            value={draft.productType}
            onChange={(event) => update('productType', event.target.value)}
            className="mt-2 h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-white outline-none focus:border-emerald-400"
          >
            {['Plant', 'Seeds', 'Tools', 'Fertilizer', 'Equipment', 'Other'].map((type) => (
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
        <AdminInput label="Variety / product line" value={draft.variety} onChange={(value) => update('variety', value)} placeholder="Orchard Growers Premium" />
        <AdminInput label="Location" value={draft.location} onChange={(value) => update('location', value)} placeholder="Orchard Growers" />
        <AdminInput label="Price" value={draft.basePrice} onChange={(value) => update('basePrice', value)} placeholder="999" type="number" />
        <AdminInput label="Discount %" value={draft.discountPercent} onChange={(value) => update('discountPercent', value)} placeholder="0" type="number" />
        <AdminInput label="Pack size" value={draft.packingType} onChange={(value) => update('packingType', value)} placeholder="Plant pack" />
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
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <AdminInput label="SEO Meta Title" value={draft.seoMetaTitle} onChange={(value) => update('seoMetaTitle', value)} placeholder="Buy Avocado Plant Online" />
        <AdminInput label="SEO Meta Description" value={draft.seoMetaDescription} onChange={(value) => update('seoMetaDescription', value)} placeholder="Healthy grafted plants from Orchard Growers." />
      </div>
      <div className="mt-3 flex flex-wrap gap-3">
        <label className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm font-bold text-slate-300">
          <input type="checkbox" checked={draft.featured} onChange={(event) => update('featured', event.target.checked)} />
          Featured Product
        </label>
        <label className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm font-bold text-slate-300">
          <input type="checkbox" checked={draft.active} onChange={(event) => update('active', event.target.checked)} />
          Active
        </label>
      </div>
      <div className="mt-4 rounded-xl border border-dashed border-slate-700 bg-slate-950 p-4">
        <p className="text-sm font-black text-white">Product Images</p>
        <p className="mt-1 text-xs font-semibold text-slate-500">Select at least 5 images from this device. They will upload securely to Cloudinary.</p>
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
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button disabled={saving} className="rounded-lg bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-60">
          {saving ? 'Saving...' : editing ? 'Update Product' : 'Save Product'}
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
}: {
  products: AdminProduct[];
  onEdit: (product: AdminProduct) => void;
  onDelete: (product: AdminProduct) => void;
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
  title = 'eFruitMandi User Information',
  badge = 'Profile, role, account status',
  emptyLabel = 'No eFruitMandi users found.',
}: {
  users: AdminUser[];
  onEdit: (user: AdminUser) => void;
  onStatus: (user: AdminUser, status: string) => void;
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
                <h3 className="truncate text-base font-bold text-white">{user.businessName || user.orchardName || user.name || 'Unnamed user'}</h3>
                <p className="mt-1 text-sm font-semibold text-slate-400">{user.email || 'No email'} | {user.phone || 'No phone'}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
                  <span className="rounded-full bg-slate-900 px-2 py-1 text-slate-300">Role: {user.role || 'not set'}</span>
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
              </div>
            </div>
          </article>
        ))}
        {!users.length && <EmptyState label={emptyLabel} />}
      </div>
    </section>
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

function MetricCard({ label, value }: { label: string; value: number }) {
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <label className="block text-sm font-bold text-slate-300">
      {label}
      <input
        value={value}
        type={type}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-white outline-none placeholder:text-slate-600 focus:border-emerald-400"
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
  const pendingKyc = kycRequests.filter((user) => user.kyc?.status === 'COMPLETED');
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
            </div>
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
        </article>
      ))}
    </RequestSection>
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

function KycRequestCard({
  user,
  onReview,
  onViewFile,
}: {
  user: KycUser;
  onReview: (type: 'kyc', id: string, action: 'APPROVE' | 'REJECT') => void;
  onViewFile: (file: UploadedFile) => void;
}) {
  const kyc = user.kyc || {};
  return (
    <article className="rounded-xl border border-slate-800 bg-slate-950 p-4">
      <RequestHeader
        title={user.businessName || user.orchardName || user.name || 'User'}
        subtitle={`${user.role || 'user'} - ${user.email || user.phone || 'No contact'}`}
        status={kyc.status || 'NOT_SUBMITTED'}
      />
      <div className="mt-4 grid gap-2 text-sm text-slate-300">
        <Info label="Udyan Card No." value={kyc.udyanCardNo} />
        <Info label="Bank A/C No." value={kyc.bankAccountNo} />
        <Info label="IFSC Code" value={kyc.ifscCode} />
        <Info label="Aadhaar Card No." value={kyc.aadhaarCardNo} />
      </div>
      <UploadedFilesPanel
        onViewFile={onViewFile}
        files={[
          { label: 'View Udyan Card Pic/PDF', path: kyc.udyanCardFileUrl },
          { label: 'View Passbook Pic/PDF', path: kyc.passbookFileUrl },
          { label: 'View Aadhaar Card Pic/PDF', path: kyc.aadhaarCardFileUrl },
        ]}
      />
      <ReviewButtons onApprove={() => onReview('kyc', user._id, 'APPROVE')} onReject={() => onReview('kyc', user._id, 'REJECT')} />
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
  return (
    <article className="rounded-xl border border-slate-800 bg-slate-950 p-4">
      <RequestHeader
        title={request.orchardName}
        subtitle={`${request.user?.role || 'user'} - ${request.user?.email || request.phone}`}
        status={request.status}
      />
      <div className="mt-4 grid gap-2 text-sm text-slate-300">
        <Info label="Company / Orchard Name" value={request.orchardName} />
        <Info label="Owner / Contact Person" value={request.ownerName} />
        <Info label="Location" value={request.location} />
        <Info label="Phone" value={request.phone} />
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
            path: request.youtubeVideoId
              ? `https://www.youtube.com/watch?v=${request.youtubeVideoId}`
              : '',
          },
        ]}
      />
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <AdminActionButton label="Edit" onClick={() => onEdit(request)} />
        <AdminActionButton label="Hold" onClick={() => onReview('verification', request._id, 'HOLD')} />
        <AdminActionButton label="Suspend" onClick={() => onReview('verification', request._id, 'SUSPEND')} danger />
        <AdminActionButton label="Terminate" onClick={() => onReview('verification', request._id, 'TERMINATE')} danger />
      </div>
      <ReviewButtons
        onApprove={() => onReview('verification', request._id, 'APPROVE')}
        onReject={() => onReview('verification', request._id, 'REJECT')}
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
  return (
    <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-black text-white">Uploaded Documents / Media</p>
        <span className="rounded-full bg-slate-950 px-2 py-1 text-[10px] font-bold text-slate-400">
          {files.filter((file) => normalizeFileUrl(file.path)).length}/{files.length}
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {files.map((file) => (
          <FileViewButton key={file.label} file={file} onViewFile={onViewFile} />
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
  const href = normalizeFileUrl(file.path);

  if (!href) {
    return (
      <div className="rounded-lg border border-dashed border-slate-700 px-3 py-2 text-sm font-bold text-slate-500">
        {file.label}: Not uploaded
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onViewFile(file)}
      title={file.fileName || file.label}
      className="rounded-lg bg-emerald-600 px-3 py-2 text-center text-sm font-bold text-white hover:bg-emerald-500"
    >
      {file.label}
    </button>
  );
}

function FilePreviewModal({ file, onClose }: { file: UploadedFile; onClose: () => void }) {
  const href = normalizeFileUrl(file.path);
  const name = file.fileName || file.label;
  const isPdf = /\.pdf($|\?)/i.test(href) || /\.pdf$/i.test(name);
  const isImage = /\.(png|jpe?g|webp|gif|bmp|svg)($|\?)/i.test(href) || /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(name);

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
          ) : isPdf ? (
            <iframe title={name} src={href} className="h-[72vh] w-full rounded-lg border border-slate-800 bg-white" />
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
}: {
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <div className="mt-4 flex gap-2">
      <button
        onClick={onApprove}
        className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-500"
      >
        Approve
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
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-3 py-2 text-sm font-bold ${
        danger
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
    efruitmandi: 'efruitDashboard',
    userManagement: 'staffUsers',
    notifications: 'notifications',
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
  if (status === 'IN_AUCTION') return 'QUOTE ENABLED';
  if (status === 'SOLD') return 'INACTIVE';
  return status;
}

function normalizeFileUrl(path?: string) {
  if (!path) return '';
  if (/^https?:\/\//.test(path)) return path;
  return `${FILE_BASE}/${path.replace(/\\/g, '/')}`;
}

function confirmTwice(actionLabel: string) {
  return (
    window.confirm(`Confirm you want to ${actionLabel}.`) &&
    window.confirm(`Final confirmation: ${actionLabel} will be applied now.`)
  );
}

export default App;
