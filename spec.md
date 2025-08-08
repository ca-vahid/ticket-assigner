# Ticket Assigner – Product Specification

**Document owner:** Vahid Haeri  
**Authors:** Vahid Haeri, Engineering Lead ✱TBD✱  
**Created:** 2025‑08‑05  
**Version:** 0.1 (draft)

> **Relationship to PRD** – This specification expands the PRD (prd.md) with implementation‑level detail sufficient for engineering, QA, DevOps, and security reviews. All identifiers and terminology follow the PRD unless noted.

---

## 1 Scope
Design, build, deploy, and operate an automated ticket‐assignment platform that receives Freshservice ticket events and assigns the most appropriate agent, with an initial *Top‑3 suggestion* pilot and a full *auto‑assign* General Availability (GA) mode. The system integrates with Azure AD, VacationTracker, and Freshservice APIs, and exposes an Admin + Review UI.

## 2 Glossary
| Term | Definition |
|------|------------|
|**Assignment Service (AS)**|NestJS micro‑service performing decision logic.|
|**Decision Version**|Semantic string (e.g., `2025.08.0`) stamped on every decision record.|
|**Eligibility Filter**|Pre‑decision logic that removes ineligible agents (PTO, level mismatch, etc.).|
|**Scoring Engine**|Algorithm computing a numeric suitability score per agent.|
|**Pilot Mode**|System posts Top‑3 suggestion note; human selects final assignee.|
|**GA Mode**|System PATCHes `responder_id` directly in Freshservice.|

## 3 User Roles
| Role | Authentication | Permissions |
|------|----------------|-------------|
|**Admin**|Azure AD SSO – group `IT‑Admins`|Full CRUD on all entities, weights, settings, VIP list, nearby map; toggle GA.|
|**Dispatcher**|Azure AD SSO – group `IT‑Dispatch`|Access Assignment Review UI; override assignments; view metrics (read‑only).|
|**Agent**|Azure AD SSO – group `IT‑Team`|View personal stats/dashboard.|

## 4 System Architecture (Detailed)
```
+-------------------------------+             +-----------------------------+
| Freshservice (SaaS)          |             | VacationTracker (SaaS)      |
|  • Tickets API               |             |  • Public REST API          |
|  • Webhooks                  |             +-------------+---------------+
|  • Automation placeholders   |                           |
+-------------+----------------+                           | Sync (FR-12)
              | Webhook (FR-01)                             v
              v                                            [Azure]
+-------------+----------------+            +--------------+----------------+
| Assignment Service (NestJS)  | <---Auth-- | Azure AD Graph API            |
|  • Eligibility Filter        |            |  • Users, locations, TZ       |
|  • Scoring Engine            |            +--------------+----------------+
|  • Decision Controller       |                          ^
|  • Sync Scheduler            |                          | Sync (FR-11)
+-------------+----------------+                          |
              | REST/GQL                        +---------+----------+
              v                                 | Admin / Review UI |
+-------------+----------------+               |  (Next.js)        |
| Postgres Flexible Server      |<-------------+-------------------+
|  • agents, categories, etc.   |
|  • decisions, feedback        |
+--------------------------------+
```
- **Runtime environment:** Azure Container Apps (ACA) with autoscale: min 3, max 6 replicas.
- **Secrets:** Azure Key Vault Managed Identity.
- **Observability:** Azure Application Insights (backend) + Log Analytics (container stdout).

## 5 External Interfaces
### 5.1 Freshservice
| Function | Method | Route | Notes |
|----------|--------|-------|-------|
|Ticket list|GET|`/api/v2/tickets/{id}`|Used to fetch enriched fields not included in webhook.|
|Agent list|GET|`/api/v2/agents?page=`|Synced hourly (FR‑10).|
|Update ticket|PUT|`/api/v2/tickets/{id}`|Set `group_id`, `responder_id`, custom fields.|
|Private note|POST|`/api/v2/tickets/{id}/notes`|HTML with Top‑3, rationale.|
|Webhook create|UI|Automation rule|Event `onTicketCreate`, payload *Full Ticket JSON*.

**Rate limits** – 100 req/min. AS maintains client‑side limiter (token bucket, 90 req/min).

### 5.2 Azure AD Graph
*Endpoint:* `https://graph.microsoft.com/v1.0/users/{email}`  
*Scopes:* `User.Read.All`.  
*Fields:* `officeLocation`, `city`, `usageLocation`, `mail`, `displayName`, `employeeType`, `outlook.timeZone`.

### 5.3 VacationTracker
*Endpoint:* `GET /public/api/v1/time-offs?from={ISO}&to={ISO}`  
*Auth:* Bearer API key in Key Vault.  
*Rate limit:* 1000/day (well below sync).  
*Sync schedule:* 06:00 local + on‑demand cache miss.

## 6 Data Model (DDL 1.0)
Full SQL migrations in `/src/migrations/*`. Key tables already outlined in PRD; below are additional indices and enumerations.
```sql
-- ENUMS
CREATE TYPE reason_code AS ENUM ('WRONG_SKILL','OVERLOADED','VIP_CONTINUITY','ON_SITE','OTHER');

-- INDICES
CREATE INDEX idx_agents_location       ON agents(location);
CREATE INDEX idx_decisions_version     ON decisions(version);
CREATE INDEX idx_feedback_reason       ON feedback(reason_code);
```

## 7 Algorithms
### 7.1 Eligibility Filter
```typescript
function isEligible(agent, ticket, today): boolean {
  if (!agent.active) return false;
  if (ptoCache.isOnPTO(agent.id, today)) return false;
  if (agent.level < ticket.requiredLevel) return false;
  if (intersection(agent.skills, ticket.requiredSkills).length / ticket.requiredSkills.length < 0.5) return false;
  if (ticket.onsiteRequired && !isOnsiteCapable(agent, ticket)) return false;
  return true;
}
```
### 7.2 Scoring Engine (v1)
See Appendix B of PRD. Implementation lives in `/src/scoring/weightedScore.ts` and is unit‑tested with `jest` (>90 % branch coverage).

## 8 API Specification (Internal)
### 8.1 Decision Controller
```
POST /api/decide
Headers: X-FS-Signature: sha256=...
Body: Freshservice ticket JSON
Response: 200 OK
{
  "ticketId": 45678,
  "top3": [
    {"agent": {"id": 123, "name": "Mo"}, "score": 0.82},
    ...
  ],
  "version": "2025.08.0"
}
```
### 8.2 Admin GraphQL
```graphql
# Mutations
mutation setWeights($input: [WeightInput!]!) {
  saveWeights(input: $input) { timestamp }
}
mutation addSkill($agentId:ID!, $skill:String!){ addSkill(agentId:$agentId,skill:$skill) }

# Queries
query dashboard {
  metrics { acceptanceRate reassignmentRate meanLatency }
}
```

## 9 UI Specification
### 9.1 Assignment Review Page `/ticket/{id}`
- **Header**: Ticket subject, category badge, priority chip.  
- **Left panel**: Ticket details.  
- **Right panel**: Cards – *Top Choice* (highlighted) + others (#2, #3). Card fields: avatar, level badge, skills chips, current open tickets, computed score with bar.
- **Actions**: “Assign” (blue), “Override…” dropdown (show all eligible), reason‑code select (mandatory if override).  
- **Audit trail**: Table of prior agent changes + reasons.

### 9.2 Admin – Scoring
- Sliders for each weight (0–1 step 0.05).  
- Display real‑time donut of weight distribution.  
- “Save → Publish” triggers `settings.version++` → rollout.

## 10 Security Requirements
1. **Transport**: HTTPS TLS 1.2+.  
2. **Secrets**: Azure Key Vault; Pod managed identity pulls on start.  
3. **RBAC**: JWT (Azure AD) bearer tokens; middleware verifies group claim.  
4. **Audit**: All mutating endpoints log `userId`, `ip`, `action`, `diff` to `audit_log` table.

## 11 Performance Requirements
| Metric | Target | Test | Tool |
|--------|--------|------|------|
|Decision latency (P95)|≤15 s|Load test 50 rps|k6|
|Throughput|500 tickets/hr sustained|Load test|k6|
|DB CPU|< 70 % under peak|Azure metrics|N/A|

## 12 Testing Strategy
- **Unit**: ≥90 % lines on scoring, eligibility, connectors.  
- **Contract**: Mock Freshservice webhooks; verify note HTML.  
- **E2E**: Docker‑Compose with cypress hitting UI + stubs.  
- **Load**: k6 script simulating 5 k tickets in 1 hr.  
- **Security**: Snyk scan in CI and OWASP ZAP baseline.

## 13 Deployment & Rollback
1. **Tag** `vX.Y.Z` → GitHub Actions → build images → push to ACR.  
2. `az containerapp update` – **blue/green** slot; warm new revision; flip traffic.  
3. Rollback: one‑click in ACA to previous revision.

## 14 Monitoring & Alerts
| Signal | Threshold | Action |
|--------|-----------|--------|
|Latency P95|>20 s 5 min|PagerDuty Critical – on‑call.|
|Acceptance Rate|<85 % over 4 hr|Email to Vahid.|
|FS API 4xx|>2 %|Slack #it‑alerts.|

## 15 Open Issues
See PRD §15. In addition:
- **OIDC vs SAML** for Freshservice side app? Pending Freshservice limitation review.
- **Agent daily_cap dynamic?** Explore EWMA of effort (backlog).

---

_End of specification_

