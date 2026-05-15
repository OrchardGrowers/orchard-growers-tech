# Development Setup Guide

This guide will help you set up the eFruitMandi Ecosystem development environment.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js 18+** - [Download from nodejs.org](https://nodejs.org/)
- **PostgreSQL 14+** - [Download from postgresql.org](https://postgresql.org/)
- **Git** - [Download from git-scm.com](https://git-scm.com/)
- **VS Code** (recommended) with extensions:
  - ES7+ React/Redux/React-Native snippets
  - Prettier - Code formatter
  - ESLint
  - TypeScript Importer

## Project Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd efruitmandi-ecosystem
```

### 2. Install Dependencies

```bash
npm install
```

This will install dependencies for all workspaces using npm workspaces.

### 3. Environment Configuration

Create environment files for each application:

#### Backend (.env)
```bash
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/efruitmandi_db"

# JWT
JWT_SECRET="your-super-secret-jwt-key-here"
JWT_REFRESH_SECRET="your-refresh-token-secret-here"

# Cloudinary (File Upload)
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"

# Email Service
EMAIL_SERVICE="gmail"
EMAIL_USER="your-email@gmail.com"
EMAIL_PASS="your-app-password"

# Payment Gateway (Razorpay/Stripe)
PAYMENT_GATEWAY_KEY="your-payment-key"
PAYMENT_GATEWAY_SECRET="your-payment-secret"

# Application
NODE_ENV="development"
PORT=5000

# Frontend URLs
EFRUITMANDI_FRONTEND_URL="http://localhost:3000"
ORCHARDGROWERS_FRONTEND_URL="http://localhost:3001"
ADMIN_PANEL_URL="http://localhost:3002"
```

#### eFruitMandi Frontend (.env)
```bash
REACT_APP_API_URL="http://localhost:5000/api/v1"
REACT_APP_BUSINESS_UNIT="EFRUIT_MANDI"
REACT_APP_APP_NAME="eFruitMandi"
```

#### OrchardGrowers Frontend (.env)
```bash
REACT_APP_API_URL="http://localhost:5000/api/v1"
REACT_APP_BUSINESS_UNIT="ORCHARD_GROWERS"
REACT_APP_APP_NAME="OrchardGrowers"
```

#### Admin Panel (.env)
```bash
REACT_APP_API_URL="http://localhost:5000/api/v1"
REACT_APP_APP_NAME="Admin Panel"
```

### 4. Database Setup

#### Create Database
```bash
createdb efruitmandi_db
```

#### Run Migrations
```bash
npm run db:migrate
```

#### Generate Schema Types
```bash
npm run db:generate
```

### 5. Build Shared Packages

```bash
# Build all shared packages
npm run build --workspace=@efruitmandi/shared-types
npm run build --workspace=@efruitmandi/shared-utils
npm run build --workspace=@efruitmandi/shared-config
npm run build --workspace=@efruitmandi/shared-ui
```

## Development Workflow

### Starting Development Servers

#### Option 1: Start All Services
```bash
npm run dev
```

This uses Turbo to start all development servers in parallel.

#### Option 2: Start Individual Services

**Backend:**
```bash
cd apps/backend
npm run dev
```

**eFruitMandi Frontend:**
```bash
cd apps/efruitsmandi-frontend
npm run dev
```

**OrchardGrowers Frontend:**
```bash
cd apps/orchardgrowers-frontend
npm run dev
```

**Admin Panel:**
```bash
cd apps/admin-panel
npm run dev
```

### Available Ports

- **Backend API**: http://localhost:5000
- **eFruitMandi Frontend**: http://localhost:3000
- **OrchardGrowers Frontend**: http://localhost:3001
- **Admin Panel**: http://localhost:3002

## Development Commands

### Building
```bash
# Build all applications
npm run build

# Build specific application
npm run build --workspace=efruitsmandi-frontend
```

### Testing
```bash
# Run all tests
npm run test

# Run tests for specific workspace
npm run test --workspace=backend
```

### Linting
```bash
# Lint all workspaces
npm run lint

# Fix linting issues
npm run lint:fix
```

### Database Operations
```bash
# Generate migration
npm run db:generate

# Run migrations
npm run db:migrate

# Create new migration
npm run db:create-migration -- migration_name
```

## Code Quality

### Pre-commit Hooks

The project uses Husky for git hooks. Before committing:

1. **ESLint**: Code linting
2. **Prettier**: Code formatting
3. **TypeScript**: Type checking
4. **Tests**: Unit tests

### Code Style

- **TypeScript**: Strict mode enabled
- **ESLint**: Airbnb config with React rules
- **Prettier**: Consistent formatting
- **Naming**: camelCase for variables/functions, PascalCase for components/types

## Debugging

### Backend Debugging

1. **VS Code Launch Configuration**:
```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Backend",
  "program": "${workspaceFolder}/apps/backend/src/server.js",
  "env": {
    "NODE_ENV": "development"
  }
}
```

2. **Console Logging**: Use the logger utility from shared-utils
3. **Database Queries**: Enable query logging in development

### Frontend Debugging

1. **React DevTools**: Install browser extension
2. **Redux DevTools**: For state debugging
3. **Network Tab**: Monitor API calls
4. **Console**: Use console.log with proper formatting

## Testing Strategy

### Unit Tests
- **Frontend**: Jest + React Testing Library
- **Backend**: Jest + Supertest
- **Shared Packages**: Jest

### Integration Tests
- API endpoint testing
- Database integration tests
- End-to-end user flows

### Test Commands
```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm run test -- specific.test.js
```

## API Documentation

### Swagger/OpenAPI

API documentation is available at:
- **Development**: http://localhost:5000/api-docs
- **Production**: https://api.efruitmandi.live/api-docs

### Postman Collection

Import the Postman collection from `docs/postman_collection.json`

## Deployment

### Local Production Build

```bash
# Build all applications
npm run build

# Start production servers
npm run start
```

### Docker Deployment

```bash
# Build Docker images
docker-compose build

# Start services
docker-compose up -d
```

## Troubleshooting

### Common Issues

#### Port Conflicts
```bash
# Check what's using ports
netstat -tulpn | grep :3000
netstat -tulpn | grep :5000

# Kill process using port
kill -9 <PID>
```

#### Database Connection Issues
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Restart PostgreSQL
sudo systemctl restart postgresql

# Check database exists
psql -l
```

#### Node Modules Issues
```bash
# Clear node_modules and reinstall
rm -rf node_modules
npm install

# Clear npm cache
npm cache clean --force
```

#### Build Issues
```bash
# Clear build cache
npm run clean

# Rebuild shared packages
npm run build:shared

# Check TypeScript errors
npm run type-check
```

### Getting Help

1. **Check Documentation**: Look in `docs/` folder
2. **GitHub Issues**: Search existing issues
3. **Team Communication**: Ask in development channel
4. **Code Review**: Request help from team members

## Performance Monitoring

### Development Tools

- **Lighthouse**: Performance auditing
- **React DevTools Profiler**: Component performance
- **Chrome DevTools**: Network and memory analysis
- **Database Query Analyzer**: Query performance

### Production Monitoring

- **Application Metrics**: Response times, error rates
- **Database Metrics**: Query performance, connection pools
- **Infrastructure**: CPU, memory, disk usage
- **User Experience**: Core Web Vitals

## Security Checklist

### Development
- [ ] Environment variables properly configured
- [ ] No secrets committed to version control
- [ ] Input validation implemented
- [ ] Authentication middleware applied
- [ ] CORS properly configured

### Production
- [ ] HTTPS enabled
- [ ] Security headers configured
- [ ] Rate limiting implemented
- [ ] Database credentials secured
- [ ] File upload restrictions in place