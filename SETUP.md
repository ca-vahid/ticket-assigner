# Setup Guide for Ticket Assigner

## Prerequisites

- Node.js 18+ and npm
- Docker and Docker Compose
- Freshservice account with admin access
- (Optional) VacationTracker.io account

## Quick Start

### 1. Clone and Install

```bash
# Clone the repository
git clone <repository-url>
cd ticket-assigner

# Install all dependencies
npm run install:all
```

### 2. Configure Environment Variables

#### Required: Freshservice API Configuration

1. **Get your Freshservice API Key:**
   - Log into Freshservice as an admin
   - Navigate to **Admin → Account → API Keys**
   - Click **Generate API Key**
   - Copy the generated key

2. **Get your Freshservice Domain:**
   - Your domain is the subdomain in your Freshservice URL
   - Example: If your URL is `https://bgcengineering.freshservice.com`, your domain is `bgcengineering.freshservice.com`

3. **Create a Webhook Secret:**
   - Generate a random string (you can use: `openssl rand -hex 32`)
   - This will be used to validate webhook requests

4. **Update the .env files:**

Edit `backend/.env`:
```env
FRESHSERVICE_API_KEY=your-actual-api-key-here
FRESHSERVICE_DOMAIN=yourcompany.freshservice.com
FRESHSERVICE_WEBHOOK_SECRET=your-generated-secret
```

#### Optional: VacationTracker.io Configuration

If you want PTO tracking:

1. Log into VacationTracker.io
2. Go to **Settings → API**
3. Generate an API key
4. Copy your Organization ID
5. Update `backend/.env`:
   ```env
   VACATION_TRACKER_API_KEY=your-api-key
   VACATION_TRACKER_ORG_ID=your-org-id
   ```

### 3. Start the Application

```bash
# Start Docker services (PostgreSQL and Redis)
docker-compose up -d

# Run database migrations (first time only)
cd backend
npm run migration:run
cd ..

# Start both backend and frontend
npm run dev
```

The application will be available at:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **API Docs**: http://localhost:3001/api/docs

### 4. Configure Freshservice Webhooks

In Freshservice, set up webhooks to notify the system of new tickets:

1. Go to **Admin → Workflow Automator → New Automator**
2. Create a new rule:
   - **Name**: "Ticket Assignment Webhook"
   - **Event**: When a ticket is created
   - **Action**: Trigger webhook
   - **URL**: `http://your-server:3001/api/webhooks/freshservice/ticket`
   - **Secret**: Use the same secret from your `.env` file

## Testing the System

### 1. Seed Sample Data (Optional)

```bash
cd backend
npm run seed  # This will create sample agents and categories
```

### 2. Test Assignment Flow

1. Create a test ticket in Freshservice
2. The webhook will trigger the assignment system
3. View suggestions in the admin UI at http://localhost:3000/assignments
4. Review and approve/override assignments

## Development Mode Features

When running in development mode:
- Auto-assignment is **disabled** by default (suggestion mode only)
- Debug logging is enabled
- Hot reload is active for both frontend and backend

## Troubleshooting

### Database Connection Issues
```bash
# Check if PostgreSQL is running
docker-compose ps

# View logs
docker-compose logs postgres
```

### Freshservice API Issues
- Verify your API key is valid
- Check the domain is correct (without https://)
- Ensure your Freshservice plan includes API access

### Port Conflicts
If ports 3000, 3001, 5432, or 6379 are in use:
1. Stop conflicting services, or
2. Update port mappings in `docker-compose.yml` and `.env` files

## Production Deployment

For production deployment:
1. Set `NODE_ENV=production` in environment variables
2. Use strong passwords for database
3. Enable SSL/TLS for all connections
4. Set up proper monitoring with Azure Application Insights
5. Configure rate limiting for API endpoints

## Support

For issues or questions:
- Check the logs: `docker-compose logs -f`
- Backend logs: `npm run dev:backend`
- Frontend logs: `npm run dev:frontend`