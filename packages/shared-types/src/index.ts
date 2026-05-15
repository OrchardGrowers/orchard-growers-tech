// Common types shared across all applications
export type BusinessUnit = 'EFRUIT_MANDI' | 'ORCHARD_GROWERS';

export interface BaseEntity {
  id: string;
  created_at: Date;
  updated_at: Date;
  business_unit: BusinessUnit;
}

export interface User extends BaseEntity {
  email: string;
  phone?: string;
  name: string;
  role: UserRole;
  is_verified: boolean;
  profile_image?: string;
  address?: Address;
}

export type UserRole = 'BUYER' | 'GROWER' | 'DRIVER' | 'ADMIN';

export interface Address {
  street: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

export interface Product extends BaseEntity {
  name: string;
  description: string;
  category: string;
  subcategory?: string;
  price: number;
  unit: string;
  quantity: number;
  images: string[];
  grower_id: string;
  quality_grade?: string;
  harvest_date?: Date;
  expiry_date?: Date;
  is_available: boolean;
}

export interface Auction extends BaseEntity {
  title: string;
  description: string;
  start_time: Date;
  end_time: Date;
  starting_price: number;
  current_price: number;
  reserve_price?: number;
  status: AuctionStatus;
  product_id: string;
  winner_id?: string;
  bids: Bid[];
}

export type AuctionStatus = 'DRAFT' | 'ACTIVE' | 'ENDED' | 'CANCELLED';

export interface Bid extends BaseEntity {
  auction_id: string;
  bidder_id: string;
  amount: number;
  bid_time: Date;
}

export interface Order extends BaseEntity {
  buyer_id: string;
  seller_id: string;
  items: OrderItem[];
  total_amount: number;
  status: OrderStatus;
  payment_status: PaymentStatus;
  delivery_address: Address;
  delivery_date?: Date;
  gst_amount: number;
  discount_amount: number;
}

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';

export interface OrderItem {
  product_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface Delivery extends BaseEntity {
  order_id: string;
  driver_id: string;
  status: DeliveryStatus;
  pickup_location: Address;
  delivery_location: Address;
  estimated_delivery: Date;
  actual_delivery?: Date;
  tracking_updates: TrackingUpdate[];
}

export type DeliveryStatus = 'ASSIGNED' | 'PICKED_UP' | 'IN_TRANSIT' | 'DELIVERED' | 'FAILED';

export interface TrackingUpdate {
  timestamp: Date;
  status: string;
  location?: Address;
  notes?: string;
}

export interface GSTLedger extends BaseEntity {
  transaction_id: string;
  transaction_type: GSTTransactionType;
  gst_rate: number;
  gst_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  taxable_amount: number;
  total_amount: number;
  party_gst_number?: string;
  invoice_number?: string;
  invoice_date?: Date;
}

export type GSTTransactionType = 'SALE' | 'PURCHASE' | 'INPUT_CREDIT' | 'OUTPUT_CREDIT';

export interface Inventory extends BaseEntity {
  product_id: string;
  quantity_available: number;
  quantity_reserved: number;
  quantity_sold: number;
  warehouse_location?: string;
  batch_number?: string;
  expiry_date?: Date;
  last_updated: Date;
}

export interface Notification extends BaseEntity {
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  is_read: boolean;
  read_at?: Date;
  action_url?: string;
}

export type NotificationType = 'AUCTION_WIN' | 'ORDER_UPDATE' | 'PAYMENT' | 'DELIVERY' | 'SYSTEM';

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  pagination?: PaginationInfo;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// Form types
export interface LoginForm {
  email: string;
  password: string;
}

export interface RegisterForm {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  role: UserRole;
  address: Address;
}

export interface ProductForm {
  name: string;
  description: string;
  category: string;
  subcategory?: string;
  price: number;
  unit: string;
  quantity: number;
  images: File[];
  quality_grade?: string;
  harvest_date?: Date;
  expiry_date?: Date;
}

// Filter types
export interface ProductFilters {
  category?: string;
  subcategory?: string;
  minPrice?: number;
  maxPrice?: number;
  quality_grade?: string;
  location?: string;
  radius?: number;
}

export interface AuctionFilters {
  status?: AuctionStatus;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  startDate?: Date;
  endDate?: Date;
}

// Dashboard types
export interface DashboardStats {
  totalUsers: number;
  totalProducts: number;
  totalOrders: number;
  totalRevenue: number;
  activeAuctions: number;
  pendingDeliveries: number;
}

export interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string;
    borderColor?: string;
  }[];
}