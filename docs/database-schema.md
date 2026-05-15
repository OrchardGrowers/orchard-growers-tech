# Database Schema

This document describes the PostgreSQL database schema for the eFruitMandi Ecosystem.

## Overview

The database is designed with the following principles:

- **Business Unit Isolation**: All tables include a `business_unit` field
- **Audit Trail**: Created/updated timestamps
- **Data Integrity**: Foreign key constraints and validations
- **Performance**: Proper indexing strategy
- **Scalability**: Normalized design with JSON fields for flexibility

## Core Tables

### users

Stores user information for all business units.

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_unit VARCHAR(20) NOT NULL CHECK (business_unit IN ('EFRUIT_MANDI', 'ORCHARD_GROWERS')),
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(15) UNIQUE,
  name VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('BUYER', 'GROWER', 'DRIVER', 'ADMIN')),
  is_verified BOOLEAN DEFAULT FALSE,
  profile_image TEXT,
  address JSONB,
  email_verified_at TIMESTAMP,
  phone_verified_at TIMESTAMP,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

-- Indexes
CREATE INDEX idx_users_business_unit ON users(business_unit);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_business_unit_role ON users(business_unit, role);
```

### products

Product catalog with inventory tracking.

```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_unit VARCHAR(20) NOT NULL CHECK (business_unit IN ('EFRUIT_MANDI', 'ORCHARD_GROWERS')),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) NOT NULL,
  subcategory VARCHAR(100),
  price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
  unit VARCHAR(20) NOT NULL,
  quantity DECIMAL(10,2) NOT NULL CHECK (quantity >= 0),
  images TEXT[],
  grower_id UUID REFERENCES users(id) ON DELETE CASCADE,
  quality_grade VARCHAR(20) CHECK (quality_grade IN ('PREMIUM', 'GRADE_A', 'GRADE_B', 'GRADE_C', 'STANDARD')),
  harvest_date DATE,
  expiry_date DATE,
  is_available BOOLEAN DEFAULT TRUE,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

-- Indexes
CREATE INDEX idx_products_business_unit ON products(business_unit);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_grower_id ON products(grower_id);
CREATE INDEX idx_products_business_unit_category ON products(business_unit, category);
CREATE INDEX idx_products_price ON products(price);
CREATE INDEX idx_products_available ON products(is_available);
```

### auctions

Auction system for lot-based trading.

```sql
CREATE TABLE auctions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_unit VARCHAR(20) NOT NULL CHECK (business_unit IN ('EFRUIT_MANDI', 'ORCHARD_GROWERS')),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  starting_price DECIMAL(10,2) NOT NULL CHECK (starting_price >= 0),
  current_price DECIMAL(10,2),
  reserve_price DECIMAL(10,2),
  status VARCHAR(20) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ACTIVE', 'ENDED', 'CANCELLED')),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  winner_id UUID REFERENCES users(id),
  bids_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP,

  CONSTRAINT valid_auction_times CHECK (end_time > start_time),
  CONSTRAINT valid_reserve_price CHECK (reserve_price >= starting_price)
);

-- Indexes
CREATE INDEX idx_auctions_business_unit ON auctions(business_unit);
CREATE INDEX idx_auctions_status ON auctions(status);
CREATE INDEX idx_auctions_product_id ON auctions(product_id);
CREATE INDEX idx_auctions_start_time ON auctions(start_time);
CREATE INDEX idx_auctions_end_time ON auctions(end_time);
CREATE INDEX idx_auctions_business_unit_status ON auctions(business_unit, status);
```

### bids

Auction bidding records.

```sql
CREATE TABLE bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  bidder_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  bid_time TIMESTAMP DEFAULT NOW(),
  is_winning BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(auction_id, bidder_id, bid_time)
);

-- Indexes
CREATE INDEX idx_bids_auction_id ON bids(auction_id);
CREATE INDEX idx_bids_bidder_id ON bids(bidder_id);
CREATE INDEX idx_bids_bid_time ON bids(bid_time);
CREATE INDEX idx_bids_auction_bid_time ON bids(auction_id, bid_time DESC);
```

### orders

Purchase order management.

```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_unit VARCHAR(20) NOT NULL CHECK (business_unit IN ('EFRUIT_MANDI', 'ORCHARD_GROWERS')),
  order_number VARCHAR(50) UNIQUE NOT NULL,
  buyer_id UUID NOT NULL REFERENCES users(id),
  seller_id UUID REFERENCES users(id),
  items JSONB NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL CHECK (total_amount >= 0),
  status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED')),
  payment_status VARCHAR(20) DEFAULT 'PENDING' CHECK (payment_status IN ('PENDING', 'PAID', 'FAILED', 'REFUNDED')),
  payment_method VARCHAR(50),
  payment_id VARCHAR(255),
  delivery_address JSONB NOT NULL,
  delivery_date DATE,
  gst_amount DECIMAL(10,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

-- Indexes
CREATE INDEX idx_orders_business_unit ON orders(business_unit);
CREATE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_orders_buyer_id ON orders(buyer_id);
CREATE INDEX idx_orders_seller_id ON orders(seller_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);
CREATE INDEX idx_orders_created_at ON orders(created_at);
```

### deliveries

Delivery and logistics tracking.

```sql
CREATE TABLE deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID UNIQUE NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'ASSIGNED' CHECK (status IN ('ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'FAILED')),
  pickup_location JSONB,
  delivery_location JSONB,
  estimated_delivery TIMESTAMP,
  actual_delivery TIMESTAMP,
  tracking_number VARCHAR(100) UNIQUE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_deliveries_order_id ON deliveries(order_id);
CREATE INDEX idx_deliveries_driver_id ON deliveries(driver_id);
CREATE INDEX idx_deliveries_status ON deliveries(status);
CREATE INDEX idx_deliveries_tracking_number ON deliveries(tracking_number);
```

### gst_ledger

GST compliance and tax ledger.

```sql
CREATE TABLE gst_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_unit VARCHAR(20) NOT NULL CHECK (business_unit IN ('EFRUIT_MANDI', 'ORCHARD_GROWERS')),
  transaction_id UUID NOT NULL,
  transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('SALE', 'PURCHASE', 'INPUT_CREDIT', 'OUTPUT_CREDIT')),
  gst_rate DECIMAL(5,2) NOT NULL CHECK (gst_rate >= 0 AND gst_rate <= 100),
  gst_amount DECIMAL(10,2) NOT NULL,
  cgst_amount DECIMAL(10,2) DEFAULT 0,
  sgst_amount DECIMAL(10,2) DEFAULT 0,
  igst_amount DECIMAL(10,2) DEFAULT 0,
  taxable_amount DECIMAL(10,2) NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  party_gst_number VARCHAR(15),
  party_name VARCHAR(255),
  invoice_number VARCHAR(50),
  invoice_date DATE,
  hsn_code VARCHAR(10),
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_gst_ledger_business_unit ON gst_ledger(business_unit);
CREATE INDEX idx_gst_ledger_transaction_id ON gst_ledger(transaction_id);
CREATE INDEX idx_gst_ledger_transaction_type ON gst_ledger(transaction_type);
CREATE INDEX idx_gst_ledger_invoice_date ON gst_ledger(invoice_date);
CREATE INDEX idx_gst_ledger_party_gst ON gst_ledger(party_gst_number);
```

### inventory

Stock and inventory management.

```sql
CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity_available DECIMAL(10,2) NOT NULL DEFAULT 0,
  quantity_reserved DECIMAL(10,2) NOT NULL DEFAULT 0,
  quantity_sold DECIMAL(10,2) NOT NULL DEFAULT 0,
  warehouse_location VARCHAR(100),
  batch_number VARCHAR(50),
  expiry_date DATE,
  last_updated TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT valid_quantities CHECK (
    quantity_available >= 0 AND
    quantity_reserved >= 0 AND
    quantity_sold >= 0
  )
);

-- Indexes
CREATE INDEX idx_inventory_product_id ON inventory(product_id);
CREATE INDEX idx_inventory_expiry_date ON inventory(expiry_date);
CREATE INDEX idx_inventory_batch_number ON inventory(batch_number);
```

### notifications

User notification system.

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('AUCTION_WIN', 'ORDER_UPDATE', 'PAYMENT', 'DELIVERY', 'SYSTEM')),
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP,
  action_url TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);
```

### verification_requests

User verification system.

```sql
CREATE TABLE verification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_type VARCHAR(20) NOT NULL CHECK (request_type IN ('GROWER', 'DRIVER', 'BUYER')),
  status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED')),
  documents JSONB,
  reviewer_id UUID REFERENCES users(id),
  review_notes TEXT,
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_verification_requests_user_id ON verification_requests(user_id);
CREATE INDEX idx_verification_requests_status ON verification_requests(status);
CREATE INDEX idx_verification_requests_request_type ON verification_requests(request_type);
```

## Supporting Tables

### categories

Product category management.

```sql
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_unit VARCHAR(20) NOT NULL CHECK (business_unit IN ('EFRUIT_MANDI', 'ORCHARD_GROWERS')),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES categories(id),
  image_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(business_unit, name)
);

-- Indexes
CREATE INDEX idx_categories_business_unit ON categories(business_unit);
CREATE INDEX idx_categories_parent_id ON categories(parent_id);
CREATE INDEX idx_categories_is_active ON categories(is_active);
```

### user_sessions

User session management.

```sql
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_token VARCHAR(255) UNIQUE NOT NULL,
  refresh_token VARCHAR(255) UNIQUE NOT NULL,
  ip_address INET,
  user_agent TEXT,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT valid_session CHECK (expires_at > created_at)
);

-- Indexes
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_session_token ON user_sessions(session_token);
CREATE INDEX idx_user_sessions_refresh_token ON user_sessions(refresh_token);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);
```

## Views

### active_auctions

View for currently active auctions.

```sql
CREATE VIEW active_auctions AS
SELECT
  a.*,
  p.name as product_name,
  p.images[1] as product_image,
  u.name as grower_name,
  EXTRACT(EPOCH FROM (a.end_time - NOW())) / 60 as minutes_remaining
FROM auctions a
JOIN products p ON a.product_id = p.id
JOIN users u ON p.grower_id = u.id
WHERE a.status = 'ACTIVE'
  AND a.end_time > NOW()
  AND p.is_available = true;
```

### order_summary

View for order summaries with user details.

```sql
CREATE VIEW order_summary AS
SELECT
  o.*,
  b.name as buyer_name,
  b.email as buyer_email,
  s.name as seller_name,
  s.email as seller_email,
  d.status as delivery_status,
  d.tracking_number
FROM orders o
LEFT JOIN users b ON o.buyer_id = b.id
LEFT JOIN users s ON o.seller_id = s.id
LEFT JOIN deliveries d ON o.id = d.order_id;
```

## Functions and Triggers

### update_updated_at_column

Trigger function to automatically update updated_at timestamp.

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';
```

### update_auction_current_price

Function to update auction current price when new bid is placed.

```sql
CREATE OR REPLACE FUNCTION update_auction_current_price()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE auctions
  SET current_price = NEW.amount,
      updated_at = NOW()
  WHERE id = NEW.auction_id;

  -- Mark previous winning bids as not winning
  UPDATE bids
  SET is_winning = FALSE
  WHERE auction_id = NEW.auction_id AND id != NEW.id;

  -- Mark new bid as winning
  NEW.is_winning = TRUE;

  RETURN NEW;
END;
$$ language 'plpgsql';
```

### Triggers

```sql
-- Auto-update updated_at for all tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update auction price on new bid
CREATE TRIGGER update_auction_price_on_bid AFTER INSERT ON bids FOR EACH ROW EXECUTE FUNCTION update_auction_current_price();
```

## Data Migration Strategy

### Version Control

Database schema changes are managed through migration files:

```
migrations/
├── 001_initial_schema.sql
├── 002_add_gst_ledger.sql
├── 003_add_inventory_tracking.sql
└── 004_add_notification_system.sql
```

### Migration Commands

```bash
# Create new migration
npm run db:create-migration migration_name

# Run pending migrations
npm run db:migrate

# Rollback last migration
npm run db:rollback
```

## Performance Considerations

### Indexing Strategy

- **Primary Keys**: UUID with default indexes
- **Foreign Keys**: Automatic indexes on referenced columns
- **Common Queries**: Composite indexes for frequently filtered columns
- **Time-based**: Indexes on timestamp columns for time-range queries
- **Text Search**: GIN indexes on JSONB fields

### Query Optimization

- **Pagination**: Use LIMIT/OFFSET with ordered queries
- **Joins**: Prefer INNER JOINs, avoid complex subqueries
- **Aggregations**: Use appropriate indexes for GROUP BY operations
- **JSON Operations**: Use containment operators (@>, <@) with GIN indexes

### Partitioning Strategy (Future)

For high-volume tables like orders and gst_ledger:

```sql
-- Partition by month for orders
CREATE TABLE orders_y2024m01 PARTITION OF orders
  FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- Partition by business_unit and quarter for gst_ledger
CREATE TABLE gst_ledger_efruit_mandi_q1 PARTITION OF gst_ledger
  FOR VALUES IN ('EFRUIT_MANDI') FROM ('2024-01-01') TO ('2024-04-01');
```

## Backup and Recovery

### Backup Strategy

- **Daily Full Backups**: Complete database backup
- **Hourly Incremental**: WAL-based incremental backups
- **Point-in-Time Recovery**: Ability to restore to any point in time

### Backup Commands

```bash
# Full backup
pg_dump efruitmandi_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore from backup
psql efruitmandi_db < backup_file.sql
```

## Security

### Row Level Security (RLS)

Enable RLS for business unit isolation:

```sql
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY users_business_unit_policy ON users
  USING (business_unit = current_setting('app.business_unit'));

CREATE POLICY products_business_unit_policy ON products
  USING (business_unit = current_setting('app.business_unit'));
```

### Data Encryption

- **Passwords**: bcrypt hashing
- **Sensitive Data**: AES encryption for PII
- **Connection**: SSL/TLS encryption required

## Monitoring

### Key Metrics

- **Performance**: Query execution time, connection count
- **Business**: Order volume, auction participation, revenue
- **System**: Disk usage, memory consumption, backup status

### Monitoring Queries

```sql
-- Slow queries
SELECT query, total_time, calls, mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- Table sizes
SELECT schemaname, tablename,
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```