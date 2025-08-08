# Ticket Assigner

Automated ticket assignment system for BGC Engineering's IT service desk. This system automatically assigns Freshservice tickets to the most suitable support agents based on skills, workload, location, and availability.

## Features

- **Intelligent Assignment**: Uses weighted scoring algorithm to match tickets with agents
- **Load Balancing**: Distributes tickets fairly across team members
- **Skill Matching**: Assigns tickets based on agent expertise and ticket requirements
- **Location Awareness**: Considers agent locations and onsite requirements
- **PTO Integration**: Respects agent availability and vacation schedules
- **Human-in-the-Loop**: Provides top-3 suggestions with override capability
- **Learning System**: Captures feedback to improve assignment accuracy over time

## Tech Stack

- **Backend**: NestJS (TypeScript)
- **Frontend**: Next.js 14 (React, TypeScript)
- **Database**: PostgreSQL
- **Cache**: Redis
- **Authentication**: Azure AD SSO
- **Infrastructure**: Docker, Azure Container Apps
- **External APIs**: Freshservice, Azure AD, VacationTracker.io

## Project Structure

```
ticket-assigner/
├── backend/               # NestJS backend service
│   ├── src/
│   │   ├── assignment/   # Assignment logic
│   │   ├── eligibility/  # Agent eligibility filters
│   │   ├── scoring/      # Scoring engine
│   │   ├── sync/         # Data synchronization
│   │   ├── auth/         # Authentication
│   │   ├── database/     # Database entities & migrations
│   │   └── integrations/ # External API integrations
│   └── test/
├── frontend/             # Next.js admin UI
│   └── src/
│       ├── app/         # App router pages
│       ├── components/  # React components
│       ├── services/    # API services
│       └── hooks/       # Custom React hooks
├── shared/              # Shared types and utilities
└── docker-compose.yml   # Local development setup
```

## Quick Start

### Prerequisites

- Node.js 18+
- Docker and Docker Compose
- PostgreSQL (via Docker)
- Redis (via Docker)

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ticket-assigner
   ```

2. **Install dependencies**
   ```bash
   npm run install:all
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start development environment**
   ```bash
   docker-compose up -d  # Start PostgreSQL and Redis
   npm run dev          # Start both backend and frontend
   ```

   The application will be available at:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001
   - API Documentation: http://localhost:3001/api/docs

### Development Commands

```bash
# Install all dependencies
npm run install:all

# Development
npm run dev              # Run both frontend and backend
npm run dev:backend      # Run backend only
npm run dev:frontend     # Run frontend only

# Docker
npm run docker:up        # Start Docker services
npm run docker:down      # Stop Docker services
npm run docker:logs      # View Docker logs

# Testing
npm run test            # Run all tests
npm run test:backend    # Test backend
npm run test:frontend   # Test frontend
npm run test:e2e        # Run E2E tests

# Building
npm run build           # Build both services
npm run build:backend   # Build backend
npm run build:frontend  # Build frontend

# Linting
npm run lint            # Lint all code
npm run format          # Format all code

# Database
cd backend
npm run migration:generate -- -n MigrationName
npm run migration:run
npm run migration:revert
```

## Configuration

### Environment Variables

See `.env.example` for all available configuration options. Key variables:

- `DATABASE_*`: PostgreSQL connection settings
- `REDIS_*`: Redis connection settings
- `AZURE_AD_*`: Azure Active Directory configuration
- `FRESHSERVICE_*`: Freshservice API credentials
- `VACATION_TRACKER_*`: VacationTracker.io API credentials

### Scoring Weights

The scoring algorithm uses configurable weights (stored in database):

- **Skill Overlap** (30%): Match between agent skills and ticket requirements
- **Level Closeness** (25%): Proximity of agent level to required level
- **Load Balance** (25%): Current workload distribution
- **Location Fit** (10%): Location matching for onsite requirements
- **VIP Affinity** (10%): Priority customer handling

## API Documentation

Once the backend is running, view the interactive API documentation at:
- Swagger UI: http://localhost:3001/api/docs

## Deployment

### Docker Build

```bash
# Build production images
docker build -t ticket-assigner-backend ./backend
docker build -t ticket-assigner-frontend ./frontend
```

### Azure Deployment

The application is designed to run on Azure Container Apps with:
- Azure Database for PostgreSQL
- Azure Cache for Redis
- Azure Key Vault for secrets
- Azure Application Insights for monitoring

## Contributing

1. Create a feature branch from `main`
2. Make your changes with appropriate tests
3. Ensure all tests pass and linting is clean
4. Submit a pull request with clear description

## License

Private - BGC Engineering Internal Use Only