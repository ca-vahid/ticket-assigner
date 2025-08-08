# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ticket Assigner is an automated ticket assignment system for BGC Engineering's IT service desk. It automatically assigns Freshservice tickets to the most suitable support agents based on skills, workload, location, and availability.

**Current State**: Core implementation complete. Backend services (scoring, eligibility, assignment) and frontend admin UI are built. Azure AD authentication and testing framework pending.

## Commands

### Initial Setup
```bash
# Install dependencies
npm run install:all

# Start development servers
npm run dev         # Start both backend and frontend
npm run dev:backend # Start NestJS backend only  
npm run dev:frontend # Start Next.js frontend only

# Build for production
npm run build

# Run tests
npm run test
npm run test:e2e

# Linting and formatting
npm run lint
npm run format
```

## Architecture

### Tech Stack
- **Backend**: NestJS (TypeScript) - Main assignment service
- **Frontend**: Next.js (React) - Admin/review UI
- **Database**: PostgreSQL - Primary data store
- **Cache**: Redis - Performance optimization
- **Infrastructure**: Azure (Container Apps, Key Vault, Application Insights)

### Core Components

1. **Assignment Service** (`src/assignment/`): Main decision engine that scores and assigns tickets
2. **Eligibility Filter** (`src/eligibility/`): Pre-filters agents based on availability, PTO, location
3. **Scoring Engine** (`src/scoring/`): Calculates suitability scores using weighted algorithm
4. **Sync Service** (`src/sync/`): Synchronizes data from Freshservice, Azure AD, VacationTracker
5. **Admin UI** (`frontend/`): Next.js app for reviewing assignments and providing feedback

### External Integrations
- **Freshservice API**: Ticket data, webhooks, agent information
- **Azure AD**: Authentication, user locations, office information  
- **VacationTracker.io**: PTO and availability data

### Scoring Algorithm
The system uses a weighted scoring formula:
- 30% skill overlap
- 25% level closeness
- 25% load balance
- 10% location fit
- 10% VIP affinity

### Key Data Models
- `agents`: Support agent profiles with skills and availability
- `categories`: Ticket categories mapped to required skills
- `decisions`: Assignment history with scores and feedback
- `settings`: Configurable weights and system parameters

## Development Guidelines

### Project Structure
✅ Backend (`backend/`): NestJS with TypeORM, fully implemented services
✅ Frontend (`frontend/`): Next.js 14 with React, Tailwind CSS, admin UI components
✅ Docker: Complete local development environment with PostgreSQL and Redis
✅ Database: Entity models defined (Agent, Category, Decision, Settings)
⏳ Authentication: Azure AD integration pending
⏳ Testing: Framework setup pending

### API Design
- REST endpoints for CRUD operations
- GraphQL for complex queries
- Webhook endpoints for Freshservice events
- SSO authentication via Azure AD

### Testing Strategy
- Unit tests for scoring algorithm
- Integration tests for API endpoints
- E2E tests for assignment workflow
- Mock external APIs for testing

### Deployment
- Docker containers deployed to Azure Container Apps
- Secrets managed via Azure Key Vault
- Monitoring through Application Insights
- Staging and production environments

## Important Files

- `prd.md`: Product requirements and business goals
- `spec.md`: Technical specification with detailed implementation plans