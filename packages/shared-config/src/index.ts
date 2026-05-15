// Application configuration constants
export const APP_CONFIG = {
  NAME: 'eFruitMandi Ecosystem',
  VERSION: '1.0.0',
  DESCRIPTION: 'Unified multi-platform agri-tech ecosystem',
} as const;

// Business units
export const BUSINESS_UNITS = {
  EFRUIT_MANDI: 'EFRUIT_MANDI',
  ORCHARD_GROWERS: 'ORCHARD_GROWERS',
} as const;

// User roles
export const USER_ROLES = {
  BUYER: 'BUYER',
  GROWER: 'GROWER',
  DRIVER: 'DRIVER',
  ADMIN: 'ADMIN',
} as const;

// Order statuses
export const ORDER_STATUSES = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  PROCESSING: 'PROCESSING',
  SHIPPED: 'SHIPPED',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
} as const;

// Payment statuses
export const PAYMENT_STATUSES = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
} as const;

// Auction statuses
export const AUCTION_STATUSES = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  ENDED: 'ENDED',
  CANCELLED: 'CANCELLED',
} as const;

// Delivery statuses
export const DELIVERY_STATUSES = {
  ASSIGNED: 'ASSIGNED',
  PICKED_UP: 'PICKED_UP',
  IN_TRANSIT: 'IN_TRANSIT',
  DELIVERED: 'DELIVERED',
  FAILED: 'FAILED',
} as const;

// GST rates by category
export const GST_RATES = {
  FRUITS_VEGETABLES: 0, // Exempted
  PROCESSED_FOOD: 5,
  AGRICULTURAL_PRODUCTS: 5,
  FERTILIZERS: 5,
  PESTICIDES: 12,
  MACHINERY: 18,
  PACKAGING: 18,
  TRANSPORT: 18,
} as const;

// Product categories
export const PRODUCT_CATEGORIES = {
  FRUITS: 'Fruits',
  VEGETABLES: 'Vegetables',
  GRAINS: 'Grains',
  SPICES: 'Spices',
  NUTS: 'Nuts',
  PROCESSED_FOOD: 'Processed Food',
  FERTILIZERS: 'Fertilizers',
  PESTICIDES: 'Pesticides',
  SEEDS: 'Seeds',
  TOOLS: 'Tools & Equipment',
  PACKAGING: 'Packaging Materials',
} as const;

// Quality grades
export const QUALITY_GRADES = {
  PREMIUM: 'Premium',
  GRADE_A: 'Grade A',
  GRADE_B: 'Grade B',
  GRADE_C: 'Grade C',
  STANDARD: 'Standard',
} as const;

// Units of measurement
export const UNITS = {
  KG: 'kg',
  GRAM: 'g',
  TONNE: 'tonne',
  QUINTAL: 'quintal',
  LITER: 'liter',
  MILLILITER: 'ml',
  PIECE: 'piece',
  DOZEN: 'dozen',
  BUNDLE: 'bundle',
  BOX: 'box',
  CRATE: 'crate',
} as const;

// File upload limits
export const UPLOAD_LIMITS = {
  PROFILE_IMAGE: {
    MAX_SIZE: 5 * 1024 * 1024, // 5MB
    ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  },
  PRODUCT_IMAGE: {
    MAX_SIZE: 10 * 1024 * 1024, // 10MB
    ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
    MAX_FILES: 5,
  },
  VERIFICATION_DOC: {
    MAX_SIZE: 10 * 1024 * 1024, // 10MB
    ALLOWED_TYPES: ['application/pdf', 'image/jpeg', 'image/png'],
    MAX_FILES: 3,
  },
} as const;

// Pagination defaults
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

// Auction settings
export const AUCTION_CONFIG = {
  MIN_DURATION_HOURS: 1,
  MAX_DURATION_HOURS: 168, // 7 days
  EXTENSION_TIME_MINUTES: 5,
  MIN_BID_INCREMENT_PERCENT: 5,
  AUTO_EXTENSION_MINUTES: 5,
} as const;

// Notification types
export const NOTIFICATION_TYPES = {
  AUCTION_WIN: 'AUCTION_WIN',
  ORDER_UPDATE: 'ORDER_UPDATE',
  PAYMENT: 'PAYMENT',
  DELIVERY: 'DELIVERY',
  SYSTEM: 'SYSTEM',
} as const;

// API endpoints (relative paths)
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
    VERIFY: '/auth/verify',
    FORGOT_PASSWORD: '/auth/forgot-password',
    RESET_PASSWORD: '/auth/reset-password',
  },
  USERS: {
    PROFILE: '/users/profile',
    UPDATE_PROFILE: '/users/profile',
    UPLOAD_AVATAR: '/users/avatar',
    CHANGE_PASSWORD: '/users/change-password',
  },
  PRODUCTS: {
    LIST: '/products',
    CREATE: '/products',
    DETAIL: '/products/:id',
    UPDATE: '/products/:id',
    DELETE: '/products/:id',
    UPLOAD_IMAGES: '/products/:id/images',
  },
  AUCTIONS: {
    LIST: '/auctions',
    CREATE: '/auctions',
    DETAIL: '/auctions/:id',
    BID: '/auctions/:id/bid',
    END: '/auctions/:id/end',
  },
  ORDERS: {
    LIST: '/orders',
    CREATE: '/orders',
    DETAIL: '/orders/:id',
    UPDATE_STATUS: '/orders/:id/status',
    CANCEL: '/orders/:id/cancel',
  },
  DELIVERY: {
    LIST: '/deliveries',
    ASSIGN: '/deliveries/assign',
    UPDATE_STATUS: '/deliveries/:id/status',
    TRACKING: '/deliveries/:id/tracking',
  },
  ADMIN: {
    DASHBOARD: '/admin/dashboard',
    USERS: '/admin/users',
    PRODUCTS: '/admin/products',
    ORDERS: '/admin/orders',
    AUCTIONS: '/admin/auctions',
    REPORTS: '/admin/reports',
    GST_LEDGER: '/admin/gst-ledger',
  },
} as const;

// Environment variables validation
export const REQUIRED_ENV_VARS = [
  'NODE_ENV',
  'PORT',
  'DATABASE_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'EMAIL_SERVICE',
  'EMAIL_USER',
  'EMAIL_PASS',
  'PAYMENT_GATEWAY_KEY',
  'PAYMENT_GATEWAY_SECRET',
] as const;

// Feature flags
export const FEATURES = {
  AUCTIONS: true,
  DELIVERY_TRACKING: true,
  GST_COMPLIANCE: true,
  MULTI_BUSINESS_UNIT: true,
  REAL_TIME_NOTIFICATIONS: true,
  ADVANCED_ANALYTICS: false, // Coming soon
  AI_PRICE_PREDICTION: false, // Coming soon
} as const;