# eFruitMandi Ecosystem

A unified multi-platform agri-tech ecosystem consisting of:

1. **eFruitMandi.live** - Lot-based fruit auction marketplace
2. **OrchardGrowers.in** - Ecommerce + orchard services platform
3. **Common Admin Panel** - Unified management for both platforms
4. **Shared Backend** - Centralized APIs with business-unit separation

## Architecture

This is a monorepo managed with [Turbo](https://turbo.build/) using the following structure:

```
├── apps/
│   ├── efruitsmandi-frontend/     # Existing eFruitMandi React app
│   ├── orchardgrowers-frontend/   # New OrchardGrowers React app
│   ├── backend/                   # Shared Node.js/Express backend
│   └── admin-panel/              # Unified admin panel
├── packages/
│   ├── shared-types/             # TypeScript interfaces
│   ├── shared-ui/                # Reusable React components
│   ├── shared-utils/             # Utility functions
│   └── shared-config/            # Configuration constants
├── docs/                         # Documentation
├── package.json                  # Root package.json with workspaces
├── turbo.json                    # Turbo configuration
└── .gitignore                    # Git ignore rules
```

## Business Units

The system supports two business units with complete separation:

- **EFRUIT_MANDI**: Fruit auction marketplace
- **ORCHARD_GROWERS**: Ecommerce platform for orchard products and services

All entities include a `business_unit` field for proper data isolation.

## Technology Stack

### Frontend
- **React 19+** with Vite
- **TailwindCSS** for styling
- **React Router** for routing
- **Axios/TanStack Query** for API calls
- **PWA-ready** architecture

### Backend
- **Node.js** with Express.js
- **PostgreSQL** with Drizzle ORM
- **JWT** authentication
- **Role-based access control**
- **REST API** architecture

### Admin Panel
- **React + Vite**
- **TailwindCSS**
- **Advanced tables** with filtering
- **Export functionality**
- **PDF invoice generation**

## Key Features

### Core Features
- 🔐 **Multi-tenant authentication** with business unit separation
- 🛒 **Product catalog** with categories and inventory
- 🔨 **Auction system** for lot-based trading
- 📦 **Order management** with GST compliance
- 🚚 **Delivery tracking** with real-time updates
- 💰 **Billing engine** with GST ledger
- 📊 **Admin dashboard** with analytics

### Advanced Features
- 📱 **PWA support** for mobile experience
- 🔔 **Real-time notifications**
- 📈 **Analytics and reporting**
- 🔍 **Advanced search and filtering**
- 📄 **PDF invoice generation**
- 💳 **Payment gateway integration**

## Development

### Prerequisites
- Node.js 18+
- PostgreSQL
- Git

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd efruitmandi-ecosystem
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Set up database**
   ```bash
   npm run db:migrate
   npm run db:generate
   ```

5. **Start development servers**
   ```bash
   npm run dev
   ```

### Available Scripts

- `npm run dev` - Start all development servers
- `npm run build` - Build all applications
- `npm run start` - Start production servers
- `npm run lint` - Run linting
- `npm run test` - Run tests
- `npm run db:migrate` - Run database migrations
- `npm run db:generate` - Generate database schema

## Database Schema

The system uses PostgreSQL with the following key entities:

- **Users** - Buyers, growers, drivers, admins
- **Products** - Items for sale with inventory tracking
- **Auctions** - Lot-based auction system
- **Orders** - Purchase transactions
- **Deliveries** - Shipping and tracking
- **GST Ledger** - Tax compliance records
- **Inventory** - Stock management

All tables include `business_unit` field for data separation.

## API Architecture

RESTful APIs with the following structure:

```
/api/v1/
├── auth/          # Authentication endpoints
├── users/         # User management
├── products/      # Product catalog
├── auctions/      # Auction system
├── orders/        # Order management
├── deliveries/    # Delivery tracking
└── admin/         # Admin operations
```

## Deployment

The system is designed for cloud deployment with:

- **Frontend**: Static hosting (Vercel, Netlify, etc.)
- **Backend**: Containerized deployment (Docker, Kubernetes)
- **Database**: Managed PostgreSQL (AWS RDS, Azure Database, etc.)
- **File Storage**: Cloud storage (Cloudinary, AWS S3, etc.)

## Contributing

1. Create a feature branch from `main`
2. Make changes following the established patterns
3. Ensure tests pass and linting is clean
4. Submit a pull request with detailed description

## License

This project is proprietary software. All rights reserved.