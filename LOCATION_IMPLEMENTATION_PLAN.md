# Location Management Implementation Plan

## Overview
This document outlines the comprehensive implementation plan for proper location management in the Ticket Assigner system. The goal is to replace mock location data with real location information from Freshservice and use it effectively in eligibility filtering and scoring.

## Current State
- Locations are stored as `Location-${id}` (mock data)
- No actual location details from Freshservice
- Hardcoded locations in UI (Vancouver, Toronto, Montreal, Calgary)
- No location-based scoring or filtering

## Implementation Phases

### Phase 1: Database & Entity Setup ✅
**Status**: Completed

1. Created `Location` entity with comprehensive fields:
   - Freshservice ID mapping
   - Full address details (address, city, state, country, postal code)
   - Timezone information
   - Geographic coordinates (latitude/longitude for distance calculations)
   - Office metadata (hours, capacity, support types)

2. Update `Agent` entity to have proper location relationship:
   ```typescript
   @ManyToOne(() => Location, location => location.agents)
   @JoinColumn({ name: 'location_id' })
   location?: Location;
   ```

### Phase 2: Freshservice Integration
**Status**: In Progress

1. **Location Sync Service** ✅
   - Fetch all locations from Freshservice API
   - Map location data to our entity structure
   - Handle timezone mapping
   - Determine support types (onsite/remote/hybrid)

2. **Update Agent Sync** (TODO)
   - Modify `sync-agents.command.ts` to:
     - Fetch location details when syncing agents
     - Create location relationship instead of string
     - Handle remote workers specially

3. **Add Scheduled Sync** (TODO)
   - Daily location sync (locations change less frequently)
   - Update agent locations during agent sync

### Phase 3: API Endpoints
**Status**: TODO

Create location management endpoints:

```typescript
// locations.controller.ts
@Get() getAllLocations()
@Get(':id') getLocation()
@Post('sync') syncLocations()
@Put(':id') updateLocation()
@Get(':id/agents') getLocationAgents()
@Get('stats') getLocationStatistics()
```

### Phase 4: Eligibility Integration
**Status**: TODO

1. **Location-based Eligibility Rules**:
   - Same location preference
   - Timezone compatibility
   - Remote vs onsite requirements
   - Cross-location assignments

2. **Configuration Options**:
   ```typescript
   interface LocationEligibilityConfig {
     enableLocationMatching: boolean;
     strictLocationMatching: boolean;
     allowCrossLocation: boolean;
     allowRemoteAgents: boolean;
     preferredLocations: string[];
     maxTimezoneHoursDifference: number;
     onsiteRequiredCategories: string[];
   }
   ```

3. **Eligibility Service Updates**:
   - Filter agents by location compatibility
   - Consider timezone for urgent tickets
   - Handle after-hours coverage

### Phase 5: Scoring System Integration
**Status**: TODO

1. **Location Scoring Factors**:
   ```typescript
   interface LocationScore {
     sameLocation: number;      // 1.0 if same, 0.0 if different
     timezoneOffset: number;     // 0-1 based on timezone difference
     isRemote: number;          // Bonus/penalty for remote agents
     distanceScore: number;      // Based on geographic distance
     officeHoursMatch: number;   // If within office hours
   }
   ```

2. **Scoring Weights**:
   - Location match: 10% of total score
   - Can be configured per organization

3. **Special Cases**:
   - VIP tickets might require same location
   - Hardware issues require onsite presence
   - Remote-only tickets for remote agents

### Phase 6: UI Implementation
**Status**: TODO

1. **Update Eligibility Page**:
   - Show real locations from database
   - Location distribution charts with actual data
   - Configure location preferences per office
   - Set office hours and coverage

2. **Agent Management**:
   - Display agent's actual location
   - Allow location updates
   - Show timezone information
   - Remote worker indicator

3. **Assignment Review**:
   - Show location match in scoring breakdown
   - Highlight cross-location assignments
   - Display timezone differences

## Database Migrations

```sql
-- Create locations table
CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  freshservice_id VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  address VARCHAR(500),
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(100),
  postal_code VARCHAR(20),
  timezone VARCHAR(50) NOT NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  is_active BOOLEAN DEFAULT true,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Update agents table
ALTER TABLE agents 
ADD COLUMN location_id UUID REFERENCES locations(id),
ADD COLUMN is_remote BOOLEAN DEFAULT false;

-- Create indexes
CREATE INDEX idx_locations_freshservice_id ON locations(freshservice_id);
CREATE INDEX idx_locations_city ON locations(city);
CREATE INDEX idx_agents_location ON agents(location_id);
```

## API Integration Examples

### Freshservice Location API
```typescript
// Get all locations
GET /api/v2/locations

// Response
{
  "locations": [
    {
      "id": 123,
      "name": "Vancouver Office",
      "address": "123 Main St",
      "city": "Vancouver",
      "state_name": "British Columbia",
      "country_name": "Canada",
      "zip_code": "V6B 1A1",
      "time_zone": "America/Vancouver",
      "primary_contact_name": "John Doe",
      "contact_phone": "+1-604-555-0123"
    }
  ]
}
```

### Location Matching Logic
```typescript
function calculateLocationScore(
  agent: Agent,
  ticket: Ticket,
  config: LocationEligibilityConfig
): number {
  // Same location = perfect score
  if (agent.location?.id === ticket.requesterLocation?.id) {
    return 1.0;
  }

  // Remote agent handling
  if (agent.isRemote && config.allowRemoteAgents) {
    return 0.7; // Slightly lower but still good
  }

  // Cross-location handling
  if (config.allowCrossLocation) {
    // Calculate based on timezone difference
    const hoursDiff = Math.abs(
      getTimezoneOffset(agent.location.timezone) - 
      getTimezoneOffset(ticket.requesterLocation.timezone)
    );
    
    if (hoursDiff <= config.maxTimezoneHoursDifference) {
      return Math.max(0.3, 1.0 - (hoursDiff * 0.1));
    }
  }

  return 0.0; // No location match
}
```

## Testing Strategy

1. **Unit Tests**:
   - Location sync service
   - Location scoring calculations
   - Timezone handling

2. **Integration Tests**:
   - Freshservice API mocking
   - Location-based eligibility filtering
   - Cross-location assignments

3. **E2E Tests**:
   - Complete assignment flow with location matching
   - UI configuration changes
   - Location statistics accuracy

## Rollout Plan

1. **Week 1**: Database setup and migrations
2. **Week 2**: Freshservice integration and sync
3. **Week 3**: API endpoints and services
4. **Week 4**: Eligibility integration
5. **Week 5**: Scoring system updates
6. **Week 6**: UI implementation
7. **Week 7**: Testing and refinement
8. **Week 8**: Production deployment

## Success Metrics

- 100% of agents have valid location data
- Location-based scoring improves assignment accuracy by 15%
- Reduce cross-timezone assignments by 30%
- Improve local support response time by 20%

## Configuration Examples

```json
{
  "eligibility": {
    "location": {
      "enabled": true,
      "weight": 0.15,
      "rules": {
        "preferSameLocation": true,
        "allowCrossLocation": true,
        "maxTimezoneHours": 3,
        "remoteAgentPenalty": 0.1,
        "requireOnsiteFor": ["hardware", "network", "printer"]
      }
    }
  }
}
```

## Next Steps

1. Review and approve this implementation plan
2. Create database migration scripts
3. Update agent sync to use new location entity
4. Implement location sync service
5. Update eligibility service
6. Update scoring system
7. Update UI components
8. Test thoroughly
9. Deploy to staging
10. Monitor and refine