# Architecture Overview

## System Architecture

The eFruitMandi Ecosystem is built as a monorepo with clear separation of concerns and business units. The architecture follows modern best practices for scalability, maintainability, and developer experience.

## Monorepo Structure

```
efruitmandi-ecosystem/
├── apps/                          # Application code
│   ├── efruitsmandi-frontend/     # eFruitMandi.live React app
│   ├── orchardgrowers-frontend/   # OrchardGrowers.in React app
│   ├── backend/                   # Shared Node.js backend
│   └── admin-panel/              # Unified admin interface
├── packages/                      # Shared packages
│   ├── shared-types/             # TypeScript interfaces
│   ├── shared-ui/                # Reusable React components
│   ├── shared-utils/             # Utility functions
│   └── shared-config/            # Configuration constants
├── docs/                         # Documentation
└── tools/                        # Development tools
```

## Business Unit Separation

The system supports two distinct business units:

### EFRUIT_MANDI
- **Purpose**: Lot-based fruit auction marketplace
- **Users**: Fruit growers, wholesale buyers, auction participants
- **Features**: Auction system, lot management, bidding platform

### ORCHARD_GROWERS
- **Purpose**: Ecommerce platform for orchard products and services
- **Users**: Orchard owners, retail customers, service providers
- **Features**: Product catalog, shopping cart, service bookings

## Technology Stack

### Frontend Applications
- **Framework**: React 19+ with Vite
- **Styling**: TailwindCSS
- **Routing**: React Router v6
- **State Management**: React Context + TanStack Query
- **Forms**: React Hook Form
- **UI Components**: Custom component library (shared-ui)
- **PWA**: Service Worker + Web App Manifest

### Backend API
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM
- **Authentication**: JWT with refresh tokens
- **Validation**: Joi/Zod
- **File Upload**: Multer + Cloudinary
- **Email**: Nodemailer
- **Caching**: Redis (future)

### Admin Panel
- **Framework**: React + Vite
- **UI Library**: Custom components + TailwindCSS
- **Tables**: TanStack Table with filtering/sorting
- **Charts**: Chart.js/Recharts
- **Export**: PDF generation, CSV export
- **Forms**: React Hook Form with validation

## Database Design

### Core Principles
- **Business Unit Isolation**: All tables include `business_unit` field
- **Audit Trail**: Created/updated timestamps on all entities
- **Soft Deletes**: Logical deletion with `deleted_at` field
- **Indexing**: Optimized for common query patterns
- **Constraints**: Foreign key relationships and data integrity

### Key Entities

#### Users
```sql
- id (UUID, PK)
- business_unit (ENUM)
- email (UNIQUE)
- phone (UNIQUE)
- name
- role (ENUM: BUYER, GROWER, DRIVER, ADMIN)
- is_verified (BOOLEAN)
- profile_image (TEXT)
- address (JSONB)
- created_at, updated_at
```

#### Products
```sql
- id (UUID, PK)
- business_unit (ENUM)
- name
- description
- category
- subcategory
- price (DECIMAL)
- unit (ENUM)
- quantity (DECIMAL)
- images (TEXT[])
- grower_id (FK)
- quality_grade (ENUM)
- harvest_date (DATE)
- expiry_date (DATE)
- is_available (BOOLEAN)
- created_at, updated_at
```

#### Auctions
```sql
- id (UUID, PK)
- business_unit (ENUM)
- title
- description
- start_time (TIMESTAMP)
- end_time (TIMESTAMP)
- starting_price (DECIMAL)
- current_price (DECIMAL)
- reserve_price (DECIMAL)
- status (ENUM)
- product_id (FK)
- winner_id (FK)
- created_at, updated_at
```

#### Orders
```sql
- id (UUID, PK)
- business_unit (ENUM)
- buyer_id (FK)
- seller_id (FK)
- items (JSONB)
- total_amount (DECIMAL)
- status (ENUM)
- payment_status (ENUM)
- delivery_address (JSONB)
- delivery_date (DATE)
- gst_amount (DECIMAL)
- discount_amount (DECIMAL)
- created_at, updated_at
```

#### GST Ledger
```sql
- id (UUID, PK)
- business_unit (ENUM)
- transaction_id (UUID)
- transaction_type (ENUM)
- gst_rate (DECIMAL)
- gst_amount (DECIMAL)
- cgst_amount (DECIMAL)
- sgst_amount (DECIMAL)
- igst_amount (DECIMAL)
- taxable_amount (DECIMAL)
- total_amount (DECIMAL)
- party_gst_number (TEXT)
- invoice_number (TEXT)
- invoice_date (DATE)
- created_at
```

## API Design

### RESTful Principles
- **Resource-based URLs**: `/api/v1/products`, `/api/v1/orders`
- **HTTP Methods**: GET, POST, PUT, PATCH, DELETE
- **Status Codes**: Standard HTTP status codes
- **Content-Type**: JSON for requests/responses
- **Versioning**: URL-based versioning (`/api/v1/`)

### Authentication
- **JWT Tokens**: Access tokens (15min) + refresh tokens (7 days)
- **Middleware**: Route protection based on roles
- **Business Unit Context**: Automatic filtering by business unit

### Response Format
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional message",
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### Error Handling
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

## Security Considerations

### Authentication & Authorization
- JWT with proper expiration
- Password hashing with bcrypt
- Role-based access control (RBAC)
- Business unit data isolation

### Data Protection
- Input validation and sanitization
- SQL injection prevention (ORM)
- XSS protection (React)
- CSRF protection (future)

### API Security
- Rate limiting
- CORS configuration
- Helmet.js security headers
- Request logging and monitoring

## Performance Optimization

### Frontend
- Code splitting with React.lazy
- Image optimization and lazy loading
- Service worker caching
- Bundle analysis and optimization

### Backend
- Database query optimization
- Redis caching (future)
- API response compression
- Connection pooling

### Database
- Proper indexing strategy
- Query optimization
- Connection pooling
- Read replicas (future)

## Deployment Strategy

### Development
- Local development with hot reload
- Docker containers for services
- Local PostgreSQL database
- Environment-specific configurations

### Production
- Containerized deployment (Docker)
- Orchestration (Kubernetes/Docker Compose)
- Cloud database (AWS RDS/Azure Database)
- CDN for static assets
- Load balancing and auto-scaling

### CI/CD Pipeline
- Automated testing (unit, integration)
- Code quality checks (linting, formatting)
- Security scanning
- Automated deployment
- Rollback capabilities

## Monitoring & Logging

### Application Monitoring
- Error tracking (Sentry)
- Performance monitoring (New Relic)
- API monitoring (Postman/Insomnia)
- Database monitoring

### Business Metrics
- User engagement analytics
- Transaction volume tracking
- Revenue analytics
- Auction participation metrics

### Logging
- Structured logging with Winston
- Log aggregation (ELK stack)
- Error alerting
- Audit logging for compliance

## Scalability Considerations

### Horizontal Scaling
- Stateless API design
- Database read replicas
- CDN for static content
- Microservices architecture (future)

### Vertical Scaling
- Database optimization
- Caching strategies
- Background job processing
- API rate limiting

### Data Growth
- Database partitioning (future)
- Archive old data
- Data retention policies
- Backup and recovery strategies

## Future Enhancements

### Phase 2 Features
- Real-time notifications (WebSocket/Socket.io)
- AI-powered price prediction
- Advanced analytics dashboard
- Mobile app development
- Multi-language support

### Technical Improvements
- GraphQL API (optional)
- Microservices migration
- Event-driven architecture
- Advanced caching (Redis Cluster)
- Machine learning integration