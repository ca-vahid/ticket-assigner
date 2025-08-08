# Ticket Assigner – Product Requirements Document (PRD)

**Document owner:** Vahid Haeri\
**Created:** 2025‑08‑05\
**Version:** 0.1 (draft)

---

## 1  Purpose

Automate the assignment of incoming Freshservice tickets to the most suitable support **group** and **agent**, balancing skill fit, workload, location constraints, and agent availability, while providing a transparent human‑in‑the‑loop feedback loop that continuously refines future decisions.

## 2  Background

- BGC Engineering’s IT service desk handles \~✱TBD✱ tickets/day via Freshservice (email‐to‐ticket).
- Manual triage is time‑consuming and inconsistent.
- Agents are distributed across multiple North American time zones; some tickets require physical presence.
- PTO is tracked in VacationTracker.io; agent metadata (location, time zone) lives in Azure AD.
- Goal: pilot a "Top‑3 suggestion" mode, then switch to full auto‑assignment once accuracy >95 %.

## 3  Goals & Non‑Goals

|    | **Goals**                                         | **Non‑Goals**                                    |
| -- | ------------------------------------------------- | ------------------------------------------------ |
| G1 | Assign every new ticket within ≤15 s of creation. | Handle ticket *resolution* or SLA tracking.      |
| G2 | Balance workload fairly across agents per level.  | Replace Freshservice’s own OOO or time tracking. |
| G3 | Respect onsite vs remote constraints.             | Predict detailed effort hours (v2).              |
| G4 | Provide auditable rationale & versioning.         | Full chatbot interaction with requesters.        |
| G5 | Continuously learn from reassignment feedback.    | *N/A*                                            |

## 4  Stakeholders

- **Product Owner:** Vahid Haeri (IT Manager)
- **Engineering Lead:** ✱TBD✱
- **Support Agents:** 12‑person IT team
- **Dispatchers:** Help‑desk leads
- **Executive Sponsor:** Bryan (CIO)

## 5  Personas & User Stories

1. **Mo (L2 Tech)** – *“I want tickets in my wheelhouse and not 20 in a row.”*
2. **Dispatch Lead** – *“I need to override assignment quickly and capture why.”*
3. **Admin (Vahid)** – *“I want to tweak weights and see accuracy metrics without redeploying code.”*

> Full backlog tracked in Azure Boards – see Appendix A.

## 6  Functional Requirements

### 6.1 Ticket Ingestion

- **FR‑01** Receive ticket payload from Freshservice Workflow Automator (create/update).
- **FR‑02** If *pilot* mode, compute Top‑3 agents and post private note; else auto‑assign.

### 6.2 Data Sync Jobs

|  ID   | Source              | Frequency   | Details                                  |
| ----- | ------------------- | ----------- | ---------------------------------------- |
| FR‑10 | Freshservice Agents | hourly      | id, name, email.                         |
| FR‑11 | Azure AD (Graph)    | hourly      | officeLocation, usageLocation, timeZone. |
| FR‑12 | VacationTracker     | 06:00 local | PTO ranges → pto table.                  |
| FR‑13 | Ticket Categories   | 06:00 UTC   | `ticket_fields/<id>` values.             |

### 6.3 Eligibility & Scoring

- **FR‑20** Filter agents by PTO, level ≥ required\_level, skill match ≥50 %, onsite fit when required.
- **FR‑21** Compute composite score (see §9) and rank agents.

### 6.4 Feedback Loop

- **FR‑30** Webhook on *Agent Changed* captures new agent & reason code (enum).
- **FR‑31** Store in `feedback` table; nightly job adjusts weights via Bayesian update.

### 6.5 User Interface

- **FR‑40** Web App with pages: Dashboard, Agents, Categories, Scoring, VIPs, Settings, Ticket Review.
- **FR‑41** Login via Azure AD SSO (Admin role = IT Admins group).
- **FR‑42** Inline edit of agent skills/levels; bulk CSV import.

### 6.6 Configuration & Extensibility

- **FR‑50** Weights, soft‑caps, auto‑assign toggle editable in UI; persisted in `settings` table.
- **FR‑51** Nearby‑office map managed via JSON editor.
- **FR‑52** Plug‑in scoring factors via TypeScript strategy interface.

## 7  Non‑Functional Requirements

|  ID    | Requirement                   | Target                    |
| ------ | ----------------------------- | ------------------------- |
| NFR‑01 | Latency (ticket → suggestion) | ≤ 15 s  P95               |
| NFR‑02 | Accuracy (Top‑1 accepted)     | ≥ 90 % in pilot           |
| NFR‑03 | Availability                  | 99.5 % monthly            |
| NFR‑04 | Secrets                       | Stored in Azure Key Vault |
| NFR‑05 | Data residency                | Azure Canada Central      |
| NFR‑06 | Audit logs retention          | ≥ 365 days                |

## 8  System Architecture

```
Freshservice → Webhook → NestJS API →   ┐
                                        │  Postgres (Azure Database for PostgreSQL Flexible Server)
Azure AD ────────►  Sync job  ───────────┤
VacationTracker ─►  Sync job  ───────────┤
                                        │  Redis (Azure Cache) – PTO cache, agent load
Admin UI (Next.js) ← REST/GraphQL  ──────┘
```

- Containerized via Docker; orchestrated in **Azure Container Apps**.
- Stateless API; scale‑out to 3 replicas.

## 9  Scoring Algorithm (v1)

```
score = 0.30 × skill_overlap
      + 0.25 × level_closeness
      + 0.25 × load_penalty
      + 0.10 × location_fit
      + 0.10 × vip_affinity
```

See Appendix B for exact formulae.

## 10  Data Model (DDL excerpt)

```sql
CREATE TABLE agents (
  id           INT PRIMARY KEY,
  name         TEXT,
  email        TEXT,
  level        SMALLINT,
  location     TEXT,
  tz           TEXT,
  skills       TEXT[],
  daily_cap    SMALLINT DEFAULT 15,
  active       BOOLEAN DEFAULT TRUE,
  last_synced  TIMESTAMP
);
-- See §10 full schema.
```

## 11  API Contracts

### 11.1 Ticket Decision (internal REST)

`POST /decide`\
Payload: Freshservice ticket JSON.\
Response: `{ ticket_id, top3: [{agent_id,score}], version }`

### 11.2 Admin GraphQL (examples)

```graphql
mutation updateWeights($input: WeightInput!) { saveWeights(input:$input) }
query ticket($id:ID!){ ticket(id:$id){ top3 {agent {name} score} features } }
```

## 12  Deployment & Ops

- **CI/CD** via GitHub Actions → Azure Container Registry → Azure Container Apps.
- **Migrations**: run on startup via TypeORM.
- **Monitoring**: Azure Application Insights (request rate, exceptions, custom metrics: accuracy, latency).

## 13  Metrics & KPIs

| Metric                | Formula                          | Goal        |
| --------------------- | -------------------------------- | ----------- |
| Top‑1 Acceptance Rate | accepted / decisions             | ≥ 90 %      |
| Mean Time‑to‑Assign   | decided\_at – ticket.created\_at | ≤ 15 s      |
| Reassignment Rate     | reassigned / decisions           | ≤ 5 %       |
| Load Balance Std‑Dev  | σ(tickets\_per\_agent)           | ↓ over time |

## 14  Timeline

| Sprint         | Length | Deliverables                                                     |
| -------------- | ------ | ---------------------------------------------------------------- |
| S1 Rules MVP   | 2 wks  | Webhook ingest, eligibility, note w/ Top‑3, agent/category sync. |
| S2 Fairness    | 2 wks  | Load cap, onsite flag, Admin UI (Agents, Categories).            |
| S3 Learning    | 3 wks  | Feedback capture, weight tuning, accuracy dashboard.             |
| S4 GA & Deploy | 2 wks  | Auto‑assign toggle, Azure CAC deploy, runbook.                   |

## 15  Open Questions

1. **Categories mapping** – await CSV ★(Item A).
2. **Initial skills taxonomy** – await list ★(B).
3. **VIP roster source** – spreadsheet or FS field? ★(C).
4. **Nearby‑office map** – confirm JSON ★(D).
5. **VacationTracker API sample** – needed for connector ★(E).
6. **Azure resource group/region** – confirm ★(F).

## 16  Risks & Mitigations

| Risk                                    | Impact              | Mitigation                                 |
| --------------------------------------- | ------------------- | ------------------------------------------ |
| Incorrect onsite detection              | Delayed resolutions | Run shadow mode + manual flag before GA.   |
| Over‑weighting skills causing imbalance | Agent burnout       | Monitor load std‑dev; tune weights weekly. |
| API limits (Freshservice 100 req/min)   | Rate‑limit errors   | Batch ticket lookups; local cache.         |

---

### Appendix A  Backlog (condensed)

> See Azure Boards – project "Ticket Assigner".

### Appendix B  Formula Details

```text
skill_overlap = |agent.skills ∩ ticket.req_skills| / |ticket.req_skills|
level_closeness = 1 – 0.5·max(0, agent.level – ticket.level)
load_penalty = 1 – min(1, tickets_today / daily_cap)
location_fit = {1, 0.6, 0.3}  // same, nearby, remote
vip_affinity = 1 if agent in vip_pool else 0
```

---

*End of document*

