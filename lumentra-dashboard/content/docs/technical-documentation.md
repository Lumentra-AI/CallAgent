# Lumentra -- Technical Documentation

Version: 0.1.0
Last Updated: 2026-03-02

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Technology Stack](#2-technology-stack)
3. [Application Entry Point and Startup](#3-application-entry-point-and-startup)
4. [Middleware Chain](#4-middleware-chain)
5. [Authentication and Authorization](#5-authentication-and-authorization)
6. [Multi-Tenancy and Row Level Security](#6-multi-tenancy-and-row-level-security)
7. [Database Schema](#7-database-schema)
8. [API Reference -- Public Routes](#8-api-reference----public-routes)
9. [API Reference -- User Auth Routes](#9-api-reference----user-auth-routes)
10. [API Reference -- Tenant Auth Routes](#10-api-reference----tenant-auth-routes)
11. [Internal API (Agent-to-API Protocol)](#11-internal-api-agent-to-api-protocol)
12. [Voice Agent Architecture (Python/LiveKit)](#12-voice-agent-architecture-pythonlivekit)
13. [System Prompt Builder and Industry Configs](#13-system-prompt-builder-and-industry-configs)
14. [LLM Integration and Multi-Provider Fallback](#14-llm-integration-and-multi-provider-fallback)
15. [Voice Tool Execution](#15-voice-tool-execution)
16. [Chat Widget and Tools](#16-chat-widget-and-tools)
17. [Post-Call Automation](#17-post-call-automation)
18. [Background Job System](#18-background-job-system)
19. [Services Architecture Deep-Dive](#19-services-architecture-deep-dive)
20. [Encryption and Security](#20-encryption-and-security)
21. [Industry-Specific Pipeline Configuration](#21-industry-specific-pipeline-configuration)
22. [Error Handling Patterns](#22-error-handling-patterns)
23. [Performance Considerations](#23-performance-considerations)
24. [Data Flow Diagrams](#24-data-flow-diagrams)
25. [Environment Variables Reference](#25-environment-variables-reference)

---

## 1. Architecture Overview

Lumentra is a multi-tenant voice AI platform that answers phone calls for businesses 24/7. The system consists of four primary components, a PostgreSQL database, and integrations with external speech, language, and telephony services.

### System Components

```
                                 +------------------+
                                 |  Lumentra        |
    PSTN Call                    |  Dashboard       |
  +----------+     SIP          |  (Next.js 16)    |
  | SignalWire|<----INVITE----->|  Port 3000       |
  | SIP Trunk |     UDP/5060    +--------+---------+
  +-----+----+                           |
        |                                | REST / JSON
        | SIP (forwarded)                | Authorization: Bearer <JWT>
        v                               | X-Tenant-ID: <uuid>
  +-----+----+                           |
  | LiveKit   |                  +-------v---------+
  | SIP Bridge|<---WebRTC-----+ |  Lumentra API    |
  | (v1.8)    |   media       | |  (Hono/Node.js)  |
  +-----+----+               | |  Port 3100       |
        |                    | +-------+-----------+
        | LiveKit Room       |         |
        v                    |         | SQL (pg)
  +-----+----+               |         v
  | LiveKit   |  LiveKit     | +-------+-----------+
  | Agent     |  Agent SDK   | |  Supabase         |
  | (Python)  |  v1.4        | |  PostgreSQL       |
  +-----+----+               | |  (with RLS)       |
        |                    | +-------------------+
        | Internal API       |
        | Bearer token       |
        +--------------------+
```

### Component Responsibilities

| Component           | Language                | Port | Role                               |
| ------------------- | ----------------------- | ---- | ---------------------------------- |
| lumentra-api        | TypeScript (Hono)       | 3100 | REST API, business logic, DB, jobs |
| lumentra-dashboard  | TypeScript (Next.js 16) | 3000 | Admin dashboard, setup wizard      |
| lumentra-agent      | Python (LiveKit v1.4)   | N/A  | Voice calls, STT/LLM/TTS pipeline  |
| Supabase PostgreSQL | SQL                     | 5432 | Data persistence, RLS, auth        |

### Deployment Topology (Production)

- Server: Hetzner CCX13, Ashburn VA (ash-dc1)
- IP: 178.156.205.145
- Coolify (port 8000): manages lumentra-api and lumentra-dashboard containers
- LiveKit stack: separate docker-compose at /opt/livekit/ with network_mode: host
- All LiveKit services (redis, livekit-server, sip, agent) run on host network
- Agent reaches API at http://10.0.1.5:3100 (Coolify internal network IP)

### Network and Ports

| Port        | Protocol | Service                            |
| ----------- | -------- | ---------------------------------- |
| 22          | TCP      | SSH                                |
| 80, 443     | TCP      | HTTP/HTTPS (Coolify reverse proxy) |
| 3100        | TCP      | Lumentra API                       |
| 5060        | UDP      | SIP (LiveKit SIP bridge)           |
| 7880-7881   | TCP      | LiveKit server (HTTP/WebSocket)    |
| 8000        | TCP      | Coolify admin panel                |
| 10000-20000 | UDP      | RTP media (SIP audio)              |
| 50000-60000 | UDP      | WebRTC ICE candidates              |

---

## 2. Technology Stack

### Backend API (lumentra-api)

| Layer           | Technology          | Version |
| --------------- | ------------------- | ------- |
| Runtime         | Node.js             | 22.x    |
| Framework       | Hono                | Latest  |
| HTTP Server     | @hono/node-server   | Latest  |
| Language        | TypeScript          | 5.x     |
| Bundler         | esbuild             | Latest  |
| Database Driver | pg (node-postgres)  | Latest  |
| Validation      | Zod                 | Latest  |
| Scheduling      | node-cron           | Latest  |
| Auth            | Supabase Auth (JWT) | Latest  |

### Voice Agent (lumentra-agent)

| Layer              | Technology                 | Version/Model                |
| ------------------ | -------------------------- | ---------------------------- |
| Framework          | LiveKit Agents SDK         | v1.4                         |
| Language           | Python                     | 3.11+                        |
| STT                | Deepgram Nova-3            | multi-language, smart_format |
| LLM                | OpenAI gpt-4.1-mini        | temperature 0.8              |
| TTS                | Cartesia Sonic-3           | speed 0.95, emotion Content  |
| VAD                | Silero VAD                 | Prewarmed at process start   |
| Turn Detection     | LiveKit Multilingual Model | Latest                       |
| Noise Cancellation | LiveKit BVCTelephony       | Latest                       |
| HTTP Client        | httpx                      | AsyncClient, 10s timeout     |

### Dashboard (lumentra-dashboard)

| Layer     | Technology    |
| --------- | ------------- |
| Framework | Next.js 16    |
| Language  | TypeScript    |
| Styling   | Tailwind CSS  |
| Auth      | Supabase Auth |
| State     | React hooks   |

### External Services

| Service     | Provider                    | Purpose                      |
| ----------- | --------------------------- | ---------------------------- |
| SIP Trunk   | SignalWire                  | PSTN inbound/outbound calls  |
| SIP Bridge  | LiveKit SIP                 | SIP-to-WebRTC conversion     |
| STT         | Deepgram                    | Speech-to-text               |
| LLM (Voice) | OpenAI                      | Voice call intelligence      |
| LLM (Chat)  | Gemini / OpenAI / Groq      | Chat widget (fallback chain) |
| TTS         | Cartesia                    | Text-to-speech               |
| Database    | Supabase                    | PostgreSQL with auth and RLS |
| Calendar    | Google / Outlook / Calendly | OAuth calendar integrations  |

---

## 3. Application Entry Point and Startup

**File:** `lumentra-api/src/index.ts`

The API server follows a strict initialization sequence:

### Startup Sequence

1. **Environment validation** -- Checks for required env vars (DATABASE_URL always; FRONTEND_URL, BACKEND_URL, ENCRYPTION_KEY in production). Missing required vars cause process.exit(1). Missing recommended vars (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) produce warnings.

2. **Database pool initialization** -- Calls initDatabase() to create the pg connection pool (max 20 connections, 30s idle timeout, 5s connection timeout).

3. **Tenant cache initialization** -- Calls initTenantCache() which loads all active tenants into an in-memory Map keyed by phone number and ID. Refreshes every 5 minutes.

4. **Job scheduler start** -- Calls startScheduler() to register all cron jobs (reminders, callbacks, notifications, engagement scores, slot generation, review requests).

5. **HTTP server start** -- Binds to PORT (default 3001) via @hono/node-server.

### Graceful Shutdown

Handles SIGTERM and SIGINT signals:

- Closes the database connection pool via closePool()
- Logs shutdown and exits with code 0

### Middleware Stack (Applied Globally)

All requests pass through these middleware in order:

1. **logger()** -- Hono built-in request logging
2. **timing()** -- Hono built-in Server-Timing header
3. **cors()** -- CORS with dynamic origin validation
4. **rateLimit()** -- Global rate limit: 100 requests per 60 seconds

### CORS Configuration

- Production: Only origins listed in FRONTEND_URL (comma-separated) are allowed
- Development: Any localhost origin on any port is allowed
- Allowed methods: GET, POST, PUT, DELETE, PATCH
- Allowed headers: Content-Type, Authorization, X-Tenant-ID, X-User-ID, X-User-Name
- Credentials: enabled

### Route Registration Order

```
PUBLIC ROUTES (no auth):
  /health              -> healthRoutes
  /api/chat            -> chatRoutes (chat widget, has own CORS)
  /internal            -> internalRoutes (INTERNAL_API_KEY auth)
  /sip/forward         -> inline TwiML handler (SignalWire calls directly)

USER AUTH ROUTES (JWT only, no tenant required):
  /api/setup/*         -> setupRoutes
  /api/tenants         -> tenantsRoutes
  /api/tenants/*       -> tenantsRoutes

TENANT AUTH ROUTES (JWT + X-Tenant-ID required):
  /api/*               -> all other API routes
```

### SIP Forwarding Endpoint

```
POST /sip/forward
```

Public endpoint called by SignalWire to route inbound SIP calls to the LiveKit SIP bridge. Returns TwiML XML that dials the LiveKit SIP bridge address.

**Response:** `application/xml`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Sip>sip:178.156.205.145:5060;transport=udp</Sip>
  </Dial>
</Response>
```

### Root and Error Handlers

```
GET /
```

Returns API metadata:

```json
{
  "name": "Lumentra API",
  "version": "0.1.0",
  "status": "operational"
}
```

**404 Handler:** Returns `{ "error": "Not found" }` with status 404.

**Global Error Handler:** Returns `{ "error": "Internal server error" }` with status 500. In development mode, includes `message` field with the error details.

---

## 4. Middleware Chain

### 4.1 Authentication Middleware

**File:** `lumentra-api/src/middleware/auth.ts`

Three authentication middleware variants are provided:

#### authMiddleware() -- Full Tenant Auth

Used for all `/api/*` routes (except setup and tenants). Requires both a valid JWT and a valid X-Tenant-ID header.

**Process:**

1. Extract `Authorization: Bearer <token>` header
2. Verify JWT against Supabase Auth (`supabase.auth.getUser(token)`)
3. Extract `X-Tenant-ID` header
4. Query `tenant_members` table to verify the user belongs to the tenant with `is_active = TRUE`
5. Set context variables: `tenantId`, `userId`, `userRole`, `userName`
6. Call `next()`

**Error Responses:**

- **401** Missing Authorization header
- **401** Invalid or expired JWT
- **400** Missing X-Tenant-ID header
- **403** User not a member of tenant (Access denied)

**Context Variables Set:**

| Variable | Type          | Description                   |
| -------- | ------------- | ----------------------------- |
| tenantId | string (UUID) | Tenant ID from X-Tenant-ID    |
| userId   | string (UUID) | User ID from JWT              |
| userRole | string        | "owner", "admin", or "member" |
| userName | string        | Display name or email         |

#### userAuthMiddleware() -- User Auth Only

Used for `/api/setup/*` and `/api/tenants*`. Requires a valid JWT but does NOT require X-Tenant-ID.

**Process:**

1. Extract and verify JWT (same as authMiddleware)
2. Set `userId` and `userName` in context
3. Does NOT check tenant membership

#### optionalAuthMiddleware() -- Optional Auth

Attempts authentication but does not fail if missing. Sets context variables if auth succeeds, otherwise proceeds without them.

#### Helper Functions

```typescript
getAuthTenantId(c: Context): string   // Retrieves tenantId from context, throws if missing
getAuthUserId(c: Context): string     // Retrieves userId from context, throws if missing
```

### 4.2 Rate Limiting Middleware

**File:** `lumentra-api/src/middleware/rate-limit.ts`

In-memory sliding window rate limiter with four predefined tiers:

#### Rate Limit Tiers

| Tier       | Requests | Window                | Use Case                    |
| ---------- | -------- | --------------------- | --------------------------- |
| `default`  | 60       | 60 seconds            | Standard API routes         |
| `strict`   | 10       | 60 seconds            | Write operations, mutations |
| `critical` | 5        | 3600 seconds (1 hour) | Phone provisioning, exports |
| `read`     | 120      | 60 seconds            | Read-heavy endpoints        |

#### Key Generation

Rate limit keys are generated from:

- Authenticated: `userId:tenantId` (per-user, per-tenant)
- Unauthenticated: IP address from `X-Forwarded-For` header or connection info

#### Response Headers

All responses include rate limit headers:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1709395200
```

#### Rate Limit Exceeded Response

```
HTTP 429 Too Many Requests

{
  "error": "Too many requests",
  "retryAfter": 45
}
```

The `Retry-After` header is also set with the number of seconds to wait.

#### Global Rate Limit

Applied to all routes in index.ts:

```typescript
app.use("*", rateLimit({ windowMs: 60000, max: 100 }));
```

This is a blanket 100 requests per minute limit in addition to any route-specific limits.

---

## 5. Authentication and Authorization

### 5.1 JWT Authentication

All dashboard API requests are authenticated via Supabase Auth JWTs. The flow:

1. User signs in via Supabase Auth (dashboard login page)
2. Supabase issues a JWT containing the user's UUID
3. Dashboard sends JWT in `Authorization: Bearer <token>` header
4. API middleware verifies JWT by calling `supabase.auth.getUser(token)`
5. If valid, the user's UUID is extracted and used for all subsequent operations

### 5.2 Tenant Membership

After JWT verification, the API checks the `tenant_members` table to confirm:

- The user has a row with `is_active = TRUE` for the requested tenant
- The user's role determines their permissions

#### Roles

| Role     | Permissions                         |
| -------- | ----------------------------------- |
| `owner`  | Full access, delete tenant, billing |
| `admin`  | Full ops, manage settings/members   |
| `member` | Read access, create bookings/calls  |

#### Role Enforcement Example

In the promotions route, only owners and admins can manage promotions:

```typescript
const role = c.get("userRole");
if (role !== "owner" && role !== "admin") {
  return c.json({ error: "Only owners and admins can manage promotions" }, 403);
}
```

### 5.3 Internal API Authentication

The Python voice agent authenticates to the API using a shared secret:

- Header: `Authorization: Bearer <INTERNAL_API_KEY>`
- The INTERNAL_API_KEY is set in both the API and agent environments
- All `/internal/*` routes use the `internalAuth()` middleware
- This is NOT a JWT -- it is a simple bearer token comparison

**Error Responses:**

- **500** INTERNAL_API_KEY not configured on server
- **401** Missing Authorization header
- **403** Invalid API key

### 5.4 New User Auto-Provisioning

When a user signs up via Supabase Auth, a PostgreSQL trigger (`handle_new_user`) automatically:

1. Creates a new tenant with business_name derived from user metadata or email
2. Sets industry to `pending_setup` and setup_completed to FALSE
3. Creates a `tenant_members` row linking the user as `owner`
4. Seeds default notification templates for the tenant

This trigger runs as `SECURITY DEFINER` owned by `postgres` to bypass RLS.

---

## 6. Multi-Tenancy and Row Level Security

### 6.1 Tenant Isolation Strategy

Lumentra uses a shared-database, shared-schema multi-tenancy model. Every data table includes a `tenant_id UUID NOT NULL` column. Isolation is enforced at two levels:

1. **Application level:** All queries include `WHERE tenant_id = $1` conditions
2. **Database level:** PostgreSQL Row Level Security (RLS) policies prevent cross-tenant access

### 6.2 Tenant-Scoped Queries

**File:** `lumentra-api/src/services/database/pool.ts`

The `tenantQuery*` functions enforce tenant isolation at the database connection level:

```
tenantQueryOne(tenantId, sql, params)
tenantQueryAll(tenantId, sql, params)
tenantQueryCount(tenantId, sql, params)
```

These functions:

1. Acquire a connection from the pool
2. Execute `SET LOCAL ROLE app_api` to switch to the application role
3. Execute `SELECT set_config('app.current_tenant_id', $1, true)` to set the tenant context
4. Execute the actual query
5. Release the connection

The `SET LOCAL` ensures the role change is scoped to the current transaction only.

### 6.3 RLS Policy Patterns

Three RLS policy patterns are used across all tables:

#### Pattern 1: Service Role Bypass

Every table has a policy allowing the `service_role` full access:

```sql
CREATE POLICY service_role_all_<table> ON <table>
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
```

#### Pattern 2: Tenant Member Access (Dashboard Users)

Most tables use a tenant_members subquery to verify the current user belongs to the tenant:

```sql
CREATE POLICY <table>_tenant_access ON <table>
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM tenant_members tm
      WHERE tm.tenant_id = <table>.tenant_id
        AND tm.user_id = auth.uid()
        AND tm.is_active = TRUE
    )
  );
```

#### Pattern 3: Session-Based Tenant Access (Internal API)

Some tables use `current_setting('app.current_tenant_id')` for access control when queries come from the internal API:

```sql
CREATE POLICY "Tenants can view own voicemails" ON voicemails
  FOR SELECT
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

### 6.4 Tenant Cache

**File:** `lumentra-api/src/services/database/tenant-cache.ts`

An in-memory cache provides O(1) tenant lookups by phone number, critical for voice call routing:

- **Cache structure:** Two Maps -- one keyed by phone number, one keyed by tenant ID
- **Refresh interval:** Every 5 minutes (full reload from database)
- **Phone normalization:** Strips all non-digit characters, handles +1 prefix
- **SIP URI lookup:** Extracts phone number from `sip:+1XXXXXXXXXX@...` format
- **Fallback:** On cache miss, falls back to direct database query
- **Cache invalidation:** Manual invalidation via `invalidateTenantCache(tenantId)` called after tenant updates

---

## 7. Database Schema

All tables use UUID primary keys (`gen_random_uuid()`), `created_at TIMESTAMPTZ DEFAULT NOW()`, and `updated_at TIMESTAMPTZ DEFAULT NOW()` with automatic trigger updates. Every table has a `tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE` column (except `tenants` and `tenant_members`).

### 7.1 tenants

The core tenant table. One row per business.

| Column                    | Type         | Notes                           |
| ------------------------- | ------------ | ------------------------------- |
| id                        | UUID         | PK, gen_random_uuid()           |
| business_name             | VARCHAR(255) | NOT NULL                        |
| industry                  | VARCHAR(100) | NOT NULL, e.g. hotel, medical   |
| phone_number              | VARCHAR(20)  | NOT NULL UNIQUE                 |
| agent_name                | VARCHAR(100) | Default 'Alex'                  |
| greeting_standard         | TEXT         | NOT NULL, default greeting      |
| greeting_after_hours      | TEXT         | After-hours greeting            |
| greeting_returning        | TEXT         | Returning caller greeting       |
| voice_config              | JSONB        | Default '{}', TTS settings      |
| agent_personality         | JSONB        | Default '{}', tone/verbosity    |
| escalation_enabled        | BOOLEAN      | Default false                   |
| escalation_phone          | VARCHAR(20)  | Human escalation number         |
| escalation_triggers       | JSONB        | Default '[]'                    |
| features                  | JSONB        | Default '{}', feature flags     |
| operating_hours           | JSONB        | Schedule: day, open, close      |
| timezone                  | VARCHAR(50)  | Default 'America/New_York'      |
| is_active                 | BOOLEAN      | Default true                    |
| custom_instructions       | TEXT         | Added to system prompt          |
| questionnaire_answers     | JSONB        | Onboarding responses            |
| contact_email             | TEXT         | Primary contact email           |
| setup_completed           | BOOLEAN      | Default false                   |
| setup_step                | INTEGER      | Default 0, range 0-9            |
| setup_completed_at        | TIMESTAMPTZ  |                                 |
| status                    | TEXT         | Default 'setup'                 |
| location_city             | TEXT         |                                 |
| location_address          | TEXT         |                                 |
| assisted_mode             | BOOLEAN      | Default false                   |
| after_hours_behavior      | TEXT         | Default 'voicemail'             |
| transfer_behavior         | TEXT         | Default 'escalation'            |
| voice_pipeline            | TEXT         | NOT NULL, 'custom' or 'livekit' |
| max_call_duration_seconds | INTEGER      | Default 900, min 120            |
| vapi_phone_number_id      | TEXT         | Legacy Vapi ID                  |
| created_at                | TIMESTAMPTZ  | Default NOW()                   |
| updated_at                | TIMESTAMPTZ  | Default NOW()                   |

**Indexes:**

- `idx_tenants_phone_number` on `(phone_number)` -- UNIQUE
- `idx_tenants_vapi_phone_id` on `(vapi_phone_number_id)` WHERE NOT NULL

### 7.2 tenant_members

Links users to tenants with role-based access.

| Column      | Type        | Notes                            |
| ----------- | ----------- | -------------------------------- |
| id          | UUID        | PK, gen_random_uuid()            |
| tenant_id   | UUID        | NOT NULL, FK tenants(id) CASCADE |
| user_id     | UUID        | NOT NULL, FK auth.users(id)      |
| role        | TEXT        | NOT NULL, owner/admin/member     |
| is_active   | BOOLEAN     | Default true                     |
| invited_by  | UUID        | FK auth.users(id)                |
| invited_at  | TIMESTAMPTZ | Default NOW()                    |
| accepted_at | TIMESTAMPTZ |                                  |
| created_at  | TIMESTAMPTZ | Default NOW()                    |
| updated_at  | TIMESTAMPTZ | Default NOW()                    |

**Indexes:**

- UNIQUE on `(tenant_id, user_id)`
- `idx_tenant_members_user_tenant_active` on `(user_id, tenant_id)` WHERE is_active = TRUE

**RLS Policies:**

- Users can view memberships for tenants they belong to
- Users can manage memberships for tenants where they are owner/admin
- Service role has full access

**Helper Functions:**

- `get_user_tenants(p_user_id UUID)` -- Returns all tenant IDs for a user
- `user_has_tenant_access(p_user_id UUID, p_tenant_id UUID)` -- Boolean check
- `get_user_tenant_role(p_user_id UUID, p_tenant_id UUID)` -- Returns role string

### 7.3 calls

Stores all inbound and outbound call records.

| Column           | Type         | Notes                        |
| ---------------- | ------------ | ---------------------------- |
| id               | UUID         | PK, gen_random_uuid()        |
| tenant_id        | UUID         | NOT NULL, FK                 |
| vapi_call_id     | VARCHAR(100) | External call ID (room name) |
| caller_phone     | VARCHAR(20)  |                              |
| caller_name      | VARCHAR(255) |                              |
| contact_id       | UUID         | FK contacts(id)              |
| direction        | VARCHAR(20)  | Default 'inbound'            |
| status           | VARCHAR(20)  | NOT NULL, default 'ringing'  |
| started_at       | TIMESTAMPTZ  |                              |
| ended_at         | TIMESTAMPTZ  |                              |
| duration_seconds | INTEGER      |                              |
| ended_reason     | TEXT         |                              |
| outcome_type     | VARCHAR(50)  | Default 'inquiry'            |
| outcome_success  | BOOLEAN      | Default true                 |
| transcript       | TEXT         | Full call transcript         |
| summary          | TEXT         | AI-generated summary         |
| sentiment_score  | DECIMAL(3,2) | 0.00 to 1.00                 |
| intents_detected | TEXT[]       | Array of intents             |
| recording_url    | TEXT         |                              |
| cost_cents       | INTEGER      | Estimated call cost          |
| metadata         | JSONB        | Call metrics (latency, etc.) |
| created_at       | TIMESTAMPTZ  | Default NOW()                |
| updated_at       | TIMESTAMPTZ  | Default NOW()                |

**Indexes:**

- `idx_calls_tenant_id` on `(tenant_id)`
- `idx_calls_vapi_call_id` on `(vapi_call_id)`
- `idx_calls_caller_phone` on `(caller_phone)`
- `idx_calls_status` on `(status)`
- `idx_calls_created_at` on `(created_at DESC)`
- `idx_calls_tenant_created` on `(tenant_id, created_at)` -- Dashboard COUNT performance
- `idx_calls_metadata` GIN on `(metadata)` WHERE metadata IS NOT NULL

### 7.4 bookings

Stores appointments, reservations, and orders.

| Column            | Type         | Notes                       |
| ----------------- | ------------ | --------------------------- |
| id                | UUID         | PK, gen_random_uuid()       |
| tenant_id         | UUID         | NOT NULL, FK                |
| customer_name     | VARCHAR(255) | NOT NULL                    |
| customer_phone    | VARCHAR(20)  |                             |
| customer_email    | VARCHAR(255) |                             |
| contact_id        | UUID         | FK contacts(id)             |
| call_id           | UUID         | FK calls(id)                |
| resource_id       | UUID         | FK resources(id)            |
| booking_type      | VARCHAR(100) | Default 'general'           |
| booking_date      | DATE         | NOT NULL                    |
| booking_time      | TIME         | NOT NULL                    |
| duration_minutes  | INTEGER      | Default 60                  |
| party_size        | INTEGER      | For restaurants             |
| status            | VARCHAR(50)  | NOT NULL, default 'pending' |
| confirmation_code | VARCHAR(20)  | 6-char alphanumeric         |
| reminder_sent     | BOOLEAN      | Default false               |
| reminder_sent_at  | TIMESTAMPTZ  |                             |
| notes             | TEXT         |                             |
| source            | VARCHAR(50)  | Default 'manual'            |
| created_at        | TIMESTAMPTZ  | Default NOW()               |
| updated_at        | TIMESTAMPTZ  | Default NOW()               |

**Indexes:**

- `idx_bookings_tenant_id` on `(tenant_id)`
- `idx_bookings_date` on `(booking_date)`
- `idx_bookings_status` on `(status)`
- `idx_bookings_customer_phone` on `(customer_phone)`
- `idx_bookings_confirmation_code` on `(confirmation_code)`
- `idx_bookings_tenant_created` on `(tenant_id, created_at)` -- Dashboard COUNT performance

### 7.5 contacts

Full CRM contact records with engagement tracking.

| Column                   | Type         | Notes                  |
| ------------------------ | ------------ | ---------------------- |
| id                       | UUID         | PK, gen_random_uuid()  |
| tenant_id                | UUID         | NOT NULL, FK           |
| phone                    | VARCHAR(20)  | Original phone number  |
| phone_normalized         | VARCHAR(20)  | Digits only            |
| email                    | VARCHAR(255) |                        |
| name                     | VARCHAR(255) | Full name              |
| first_name               | VARCHAR(100) |                        |
| last_name                | VARCHAR(100) |                        |
| company                  | VARCHAR(255) |                        |
| source                   | VARCHAR(50)  | Default 'manual'       |
| source_details           | JSONB        | Default '{}'           |
| status                   | VARCHAR(50)  | Default 'active'       |
| lead_status              | VARCHAR(50)  | Default 'new'          |
| engagement_score         | INTEGER      | Default 0, range 0-100 |
| engagement_level         | VARCHAR(20)  | cold/warm/hot/vip      |
| tags                     | TEXT[]       | Default '{}'           |
| notes                    | TEXT         |                        |
| custom_fields            | JSONB        | Default '{}'           |
| preferred_contact_method | VARCHAR(20)  | phone, email, sms      |
| preferred_contact_time   | VARCHAR(50)  |                        |
| preferred_language       | VARCHAR(10)  |                        |
| timezone                 | VARCHAR(50)  |                        |
| do_not_call              | BOOLEAN      | Default false          |
| do_not_sms               | BOOLEAN      | Default false          |
| do_not_email             | BOOLEAN      | Default false          |
| marketing_opt_in         | BOOLEAN      | Default false          |
| marketing_opt_in_at      | TIMESTAMPTZ  |                        |
| total_calls              | INTEGER      | Default 0              |
| total_bookings           | INTEGER      | Default 0              |
| total_completed_bookings | INTEGER      | Default 0              |
| total_cancelled_bookings | INTEGER      | Default 0              |
| total_no_shows           | INTEGER      | Default 0              |
| total_sms_sent           | INTEGER      | Default 0              |
| total_emails_sent        | INTEGER      | Default 0              |
| lifetime_value_cents     | INTEGER      | Default 0              |
| first_contact_at         | TIMESTAMPTZ  |                        |
| last_contact_at          | TIMESTAMPTZ  |                        |
| last_call_at             | TIMESTAMPTZ  |                        |
| last_booking_at          | TIMESTAMPTZ  |                        |
| created_at               | TIMESTAMPTZ  | Default NOW()          |
| updated_at               | TIMESTAMPTZ  | Default NOW()          |

**Indexes:**

- UNIQUE on `(tenant_id, phone_normalized)`
- `idx_contacts_tenant_id` on `(tenant_id)`
- `idx_contacts_phone` on `(phone_normalized)`
- `idx_contacts_email` on `(email)`
- `idx_contacts_status` on `(status)`
- GIN on `(tags)` for array overlap queries

**Views:**

- `contact_summary` -- Aggregated contact metrics with booking/call counts

**Functions:**

- `normalize_phone(phone TEXT)` -- Strips non-digit characters, handles +1 prefix
- `update_contact_metrics()` -- Trigger function to update counters on related table changes

### 7.6 contact_notes

Notes attached to contacts by users or the voice agent.

| Column          | Type         | Notes                         |
| --------------- | ------------ | ----------------------------- |
| id              | UUID         | PK, gen_random_uuid()         |
| tenant_id       | UUID         | NOT NULL, FK                  |
| contact_id      | UUID         | NOT NULL, FK contacts CASCADE |
| note_type       | VARCHAR(50)  | Default 'general'             |
| content         | TEXT         | NOT NULL                      |
| call_id         | UUID         | FK calls(id)                  |
| booking_id      | UUID         | FK bookings(id)               |
| is_pinned       | BOOLEAN      | Default false                 |
| is_private      | BOOLEAN      | Default false                 |
| created_by      | VARCHAR(255) | User ID or 'voice_agent'      |
| created_by_name | VARCHAR(255) | Display name                  |
| created_at      | TIMESTAMPTZ  | Default NOW()                 |
| updated_at      | TIMESTAMPTZ  | Default NOW()                 |

### 7.7 contact_activity

Timeline of all contact interactions.

| Column        | Type         | Notes                         |
| ------------- | ------------ | ----------------------------- |
| id            | UUID         | PK, gen_random_uuid()         |
| tenant_id     | UUID         | NOT NULL, FK                  |
| contact_id    | UUID         | NOT NULL, FK contacts CASCADE |
| activity_type | VARCHAR(50)  | NOT NULL, e.g. call, booking  |
| description   | TEXT         |                               |
| metadata      | JSONB        | Default '{}'                  |
| related_id    | UUID         | FK to related record          |
| related_type  | VARCHAR(50)  | Table name of related record  |
| performed_by  | VARCHAR(255) |                               |
| created_at    | TIMESTAMPTZ  | Default NOW()                 |

### 7.8 voicemails

Stores voicemail recordings when the agent cannot handle a call.

| Column                | Type         | Notes                       |
| --------------------- | ------------ | --------------------------- |
| id                    | UUID         | PK, gen_random_uuid()       |
| tenant_id             | UUID         | NOT NULL, FK                |
| call_sid              | VARCHAR(100) | NOT NULL                    |
| caller_phone          | VARCHAR(20)  | NOT NULL                    |
| caller_name           | VARCHAR(255) |                             |
| recording_url         | TEXT         |                             |
| recording_sid         | VARCHAR(100) |                             |
| duration_seconds      | INTEGER      |                             |
| transcript            | TEXT         |                             |
| reason                | VARCHAR(50)  | NOT NULL, e.g. after_hours  |
| status                | VARCHAR(50)  | NOT NULL, default 'pending' |
| notes                 | TEXT         |                             |
| reviewed_by           | VARCHAR(255) |                             |
| reviewed_at           | TIMESTAMPTZ  |                             |
| callback_scheduled_at | TIMESTAMPTZ  |                             |
| created_at            | TIMESTAMPTZ  | Default NOW()               |
| updated_at            | TIMESTAMPTZ  | Default NOW()               |

**Indexes:**

- `idx_voicemails_tenant_id` on `(tenant_id)`
- `idx_voicemails_status` on `(status)`
- `idx_voicemails_caller_phone` on `(caller_phone)`
- `idx_voicemails_created_at` on `(created_at DESC)`
- `idx_voicemails_call_sid` on `(call_sid)`

### 7.9 conversation_logs

Stores structured conversation data for LLM training and fine-tuning.

| Column                | Type         | Notes                   |
| --------------------- | ------------ | ----------------------- |
| id                    | UUID         | PK, gen_random_uuid()   |
| tenant_id             | UUID         | NOT NULL, FK            |
| call_id               | UUID         | FK calls(id) SET NULL   |
| session_id            | TEXT         | NOT NULL                |
| industry              | TEXT         |                         |
| scenario_type         | TEXT         | e.g. booking, inquiry   |
| language              | TEXT         | Default 'en'            |
| messages              | JSONB        | NOT NULL, default '[]'  |
| quality_score         | DECIMAL(3,2) | 0.00 to 1.00            |
| is_complete           | BOOLEAN      | Default false           |
| has_tool_calls        | BOOLEAN      | Default false           |
| has_escalation        | BOOLEAN      | Default false           |
| outcome_success       | BOOLEAN      |                         |
| turn_count            | INTEGER      | Default 0               |
| user_turns            | INTEGER      | Default 0               |
| assistant_turns       | INTEGER      | Default 0               |
| tool_calls_count      | INTEGER      | Default 0               |
| total_tokens_estimate | INTEGER      | Default 0               |
| duration_seconds      | INTEGER      |                         |
| reviewed              | BOOLEAN      | Default false           |
| flagged               | BOOLEAN      | Default false           |
| flag_reason           | TEXT         |                         |
| tags                  | TEXT[]       | Default '{}'            |
| notes                 | TEXT         |                         |
| exported_at           | TIMESTAMPTZ  |                         |
| export_format         | TEXT         | jsonl, sharegpt, alpaca |
| created_at            | TIMESTAMPTZ  | Default NOW()           |
| updated_at            | TIMESTAMPTZ  | Default NOW()           |

**Indexes:**

- `idx_conversation_logs_tenant` on `(tenant_id)`
- `idx_conversation_logs_call` on `(call_id)`
- `idx_conversation_logs_session` on `(session_id)`
- `idx_conversation_logs_scenario` on `(scenario_type)`
- `idx_conversation_logs_quality` on `(quality_score DESC)`
- `idx_conversation_logs_created` on `(created_at DESC)`
- `idx_conversation_logs_reviewed` on `(reviewed)` WHERE reviewed = false
- `idx_conversation_logs_flagged` on `(flagged)` WHERE flagged = true
- GIN on `(messages)` for JSONB search
- GIN on `(tags)` for array search

**Views:**

- `training_data_export` -- Pre-filtered view of high-quality training data (reviewed=true, flagged=false, is_complete=true, quality_score >= 0.7)

### 7.10 resources

Staff members, rooms, equipment, and other bookable resources.

| Column      | Type         | Notes                      |
| ----------- | ------------ | -------------------------- |
| id          | UUID         | PK, gen_random_uuid()      |
| tenant_id   | UUID         | NOT NULL, FK               |
| name        | VARCHAR(255) | NOT NULL                   |
| type        | VARCHAR(50)  | NOT NULL, e.g. staff, room |
| description | TEXT         |                            |
| is_bookable | BOOLEAN      | Default true               |
| is_active   | BOOLEAN      | Default true               |
| sort_order  | INTEGER      | Default 0                  |
| metadata    | JSONB        | Default '{}'               |
| created_at  | TIMESTAMPTZ  | Default NOW()              |
| updated_at  | TIMESTAMPTZ  | Default NOW()              |

### 7.11 availability_templates

Recurring availability patterns for resources.

| Column                | Type         | Notes                    |
| --------------------- | ------------ | ------------------------ |
| id                    | UUID         | PK, gen_random_uuid()    |
| tenant_id             | UUID         | NOT NULL, FK             |
| resource_id           | UUID         | FK resources(id) CASCADE |
| name                  | VARCHAR(255) |                          |
| day_of_week           | INTEGER      | NOT NULL, 0=Sun to 6=Sat |
| start_time            | TIME         | NOT NULL                 |
| end_time              | TIME         | NOT NULL                 |
| slot_duration_minutes | INTEGER      | Default 60               |
| is_active             | BOOLEAN      | Default true             |
| created_at            | TIMESTAMPTZ  | Default NOW()            |

### 7.12 availability_slots

Generated individual time slots for booking.

| Column       | Type        | Notes                         |
| ------------ | ----------- | ----------------------------- |
| id           | UUID        | PK, gen_random_uuid()         |
| tenant_id    | UUID        | NOT NULL, FK                  |
| resource_id  | UUID        | FK resources(id) CASCADE      |
| template_id  | UUID        | FK availability_templates(id) |
| slot_date    | DATE        | NOT NULL                      |
| start_time   | TIME        | NOT NULL                      |
| end_time     | TIME        | NOT NULL                      |
| is_available | BOOLEAN     | Default true                  |
| is_blocked   | BOOLEAN     | Default false, manual block   |
| booking_id   | UUID        | FK bookings(id)               |
| created_at   | TIMESTAMPTZ | Default NOW()                 |

### 7.13 callback_queue

Queue of missed calls needing callbacks.

| Column          | Type        | Notes                    |
| --------------- | ----------- | ------------------------ |
| id              | UUID        | PK, gen_random_uuid()    |
| tenant_id       | UUID        | NOT NULL, FK             |
| phone_number    | VARCHAR(20) | NOT NULL                 |
| call_id         | UUID        | FK calls(id)             |
| priority        | INTEGER     | Default 0, higher=urgent |
| status          | VARCHAR(50) | Default 'pending'        |
| attempts        | INTEGER     | Default 0                |
| max_attempts    | INTEGER     | Default 3                |
| last_attempt_at | TIMESTAMPTZ |                          |
| completed_at    | TIMESTAMPTZ |                          |
| notes           | TEXT        |                          |
| created_at      | TIMESTAMPTZ | Default NOW()            |

### 7.14 notification_templates

Templates for SMS and email notifications.

| Column            | Type         | Notes                               |
| ----------------- | ------------ | ----------------------------------- |
| id                | UUID         | PK, gen_random_uuid()               |
| tenant_id         | UUID         | NOT NULL, FK                        |
| name              | VARCHAR(100) | NOT NULL                            |
| notification_type | VARCHAR(50)  | NOT NULL, e.g. booking_confirm      |
| channel           | VARCHAR(20)  | NOT NULL, sms or email              |
| subject           | TEXT         | Email subject                       |
| body              | TEXT         | NOT NULL, uses {{var}} placeholders |
| is_active         | BOOLEAN      | Default true                        |
| created_at        | TIMESTAMPTZ  | Default NOW()                       |
| updated_at        | TIMESTAMPTZ  | Default NOW()                       |

### 7.15 notifications

Individual notification records (sent and queued).

| Column             | Type         | Notes                         |
| ------------------ | ------------ | ----------------------------- |
| id                 | UUID         | PK, gen_random_uuid()         |
| tenant_id          | UUID         | NOT NULL, FK                  |
| contact_id         | UUID         | FK contacts(id)               |
| booking_id         | UUID         | FK bookings(id)               |
| template_id        | UUID         | FK notification_templates(id) |
| notification_type  | VARCHAR(50)  | NOT NULL                      |
| channel            | VARCHAR(20)  | NOT NULL, sms or email        |
| recipient          | TEXT         | NOT NULL, phone or email      |
| recipient_name     | VARCHAR(255) |                               |
| subject            | TEXT         |                               |
| body               | TEXT         | Rendered body                 |
| status             | VARCHAR(20)  | Default 'pending'             |
| sent_at            | TIMESTAMPTZ  |                               |
| error_message      | TEXT         |                               |
| retry_count        | INTEGER      | Default 0                     |
| template_variables | JSONB        | Default '{}'                  |
| created_at         | TIMESTAMPTZ  | Default NOW()                 |

**Status values:** pending, sent, failed, cancelled

### 7.16 notification_preferences

Per-contact notification opt-in/opt-out preferences.

| Column            | Type        | Notes                 |
| ----------------- | ----------- | --------------------- |
| id                | UUID        | PK, gen_random_uuid() |
| tenant_id         | UUID        | NOT NULL, FK          |
| contact_id        | UUID        | FK contacts(id)       |
| notification_type | VARCHAR(50) | NOT NULL              |
| channel           | VARCHAR(20) | NOT NULL              |
| enabled           | BOOLEAN     | Default true          |
| created_at        | TIMESTAMPTZ | Default NOW()         |
| updated_at        | TIMESTAMPTZ | Default NOW()         |

### 7.17 deals

Sales pipeline deals linked to contacts.

| Column      | Type        | Notes                       |
| ----------- | ----------- | --------------------------- |
| id          | UUID        | PK, gen_random_uuid()       |
| tenant_id   | UUID        | NOT NULL, FK                |
| name        | TEXT        | NOT NULL, deal title        |
| stage       | TEXT        | NOT NULL, industry stage ID |
| value_cents | INTEGER     | Deal monetary value         |
| source      | TEXT        | See source values below     |
| contact_id  | UUID        | FK contacts(id)             |
| call_id     | UUID        | FK calls(id)                |
| notes       | TEXT        |                             |
| closed_at   | TIMESTAMPTZ |                             |
| created_by  | TEXT        | User ID or 'auto'           |
| created_at  | TIMESTAMPTZ | Default NOW()               |
| updated_at  | TIMESTAMPTZ | Default NOW()               |

**Source values:** call, chat, web, manual, auto

**Indexes:**

- `idx_deals_tenant_id` on `(tenant_id)`
- `idx_deals_contact_id` on `(contact_id)`
- `idx_deals_stage` on `(stage)`
- `idx_deals_created_at` on `(created_at DESC)`

### 7.18 tasks

Follow-up tasks and action items.

| Column       | Type        | Notes                     |
| ------------ | ----------- | ------------------------- |
| id           | UUID        | PK, gen_random_uuid()     |
| tenant_id    | UUID        | NOT NULL, FK              |
| title        | TEXT        | NOT NULL                  |
| description  | TEXT        |                           |
| type         | TEXT        | NOT NULL, see types below |
| priority     | TEXT        | Default 'medium'          |
| status       | TEXT        | Default 'pending'         |
| due_date     | DATE        |                           |
| completed_at | TIMESTAMPTZ |                           |
| contact_id   | UUID        | FK contacts(id)           |
| deal_id      | UUID        | FK deals(id)              |
| call_id      | UUID        | FK calls(id)              |
| assigned_to  | UUID        | User ID                   |
| source       | TEXT        | manual or auto            |
| created_by   | TEXT        | User ID or 'auto'         |
| created_at   | TIMESTAMPTZ | Default NOW()             |
| updated_at   | TIMESTAMPTZ | Default NOW()             |

**Task types:** follow_up, call_back, email, meeting, review, custom, plus industry-specific types

**Priority values:** low, medium, high, urgent

**Status values:** pending, in_progress, completed, cancelled

**Indexes:**

- `idx_tasks_tenant_id` on `(tenant_id)`
- `idx_tasks_contact_id` on `(contact_id)`
- `idx_tasks_status` on `(status)`
- `idx_tasks_due_date` on `(due_date)`
- `idx_tasks_created_at` on `(created_at DESC)`

### 7.19 pending_bookings

Booking requests in assisted mode awaiting manual confirmation.

| Column         | Type        | Notes                    |
| -------------- | ----------- | ------------------------ |
| id             | UUID        | PK, uuid_generate_v4()   |
| tenant_id      | UUID        | NOT NULL, FK             |
| call_id        | UUID        | FK calls(id) SET NULL    |
| customer_name  | TEXT        | NOT NULL                 |
| customer_phone | TEXT        | NOT NULL                 |
| customer_email | TEXT        |                          |
| requested_date | DATE        |                          |
| requested_time | TIME        |                          |
| service        | TEXT        |                          |
| notes          | TEXT        |                          |
| status         | TEXT        | Default 'pending', CHECK |
| confirmed_by   | UUID        | FK auth.users(id)        |
| confirmed_at   | TIMESTAMPTZ |                          |
| created_at     | TIMESTAMPTZ | Default NOW()            |

**Status values:** pending, confirmed, rejected

### 7.20 Setup Wizard Tables

#### phone_configurations

| Column            | Type        | Notes                    |
| ----------------- | ----------- | ------------------------ |
| id                | UUID        | PK                       |
| tenant_id         | UUID        | NOT NULL, FK             |
| setup_type        | TEXT        | NOT NULL, CHECK          |
| phone_number      | TEXT        |                          |
| forwarding_number | TEXT        | Number to forward from   |
| sip_uri           | TEXT        | SIP endpoint URI         |
| sip_username      | TEXT        |                          |
| port_request_id   | UUID        | FK port_requests(id)     |
| provider          | TEXT        | signalwire, twilio, etc. |
| provider_id       | TEXT        | External provider ID     |
| status            | TEXT        | Default 'pending'        |
| created_at        | TIMESTAMPTZ | Default NOW()            |
| updated_at        | TIMESTAMPTZ | Default NOW()            |

**Setup types:** new, port, forward, sip

**Status values:** pending, active, failed

**Indexes:**

- `idx_phone_configurations_sip_uri` on `(sip_uri)` WHERE sip_uri IS NOT NULL AND setup_type = 'sip'

#### tenant_capabilities

| Column     | Type        | Notes         |
| ---------- | ----------- | ------------- |
| id         | UUID        | PK            |
| tenant_id  | UUID        | NOT NULL, FK  |
| capability | TEXT        | NOT NULL      |
| enabled    | BOOLEAN     | Default true  |
| config     | JSONB       | Default '{}'  |
| created_at | TIMESTAMPTZ | Default NOW() |

**Capability examples:** appointments, orders, faq

#### tenant_integrations

| Column           | Type        | Notes                   |
| ---------------- | ----------- | ----------------------- |
| id               | UUID        | PK                      |
| tenant_id        | UUID        | NOT NULL, FK            |
| provider         | TEXT        | NOT NULL                |
| access_token     | TEXT        | Encrypted (AES-256-GCM) |
| refresh_token    | TEXT        | Encrypted               |
| token_expires_at | TIMESTAMPTZ |                         |
| calendar_id      | TEXT        |                         |
| status           | TEXT        | Default 'pending'       |
| created_at       | TIMESTAMPTZ | Default NOW()           |
| updated_at       | TIMESTAMPTZ | Default NOW()           |

**Provider values:** google_calendar, outlook, calendly

**Status values:** pending, connected, error

#### escalation_contacts

| Column     | Type        | Notes         |
| ---------- | ----------- | ------------- |
| id         | UUID        | PK            |
| tenant_id  | UUID        | NOT NULL, FK  |
| name       | TEXT        | NOT NULL      |
| phone      | TEXT        | NOT NULL      |
| role       | TEXT        |               |
| priority   | INTEGER     | Default 0     |
| is_active  | BOOLEAN     | Default true  |
| created_at | TIMESTAMPTZ | Default NOW() |

#### tenant_promotions

| Column      | Type        | Notes         |
| ----------- | ----------- | ------------- |
| id          | UUID        | PK            |
| tenant_id   | UUID        | NOT NULL, FK  |
| title       | TEXT        | NOT NULL      |
| description | TEXT        |               |
| is_active   | BOOLEAN     | Default true  |
| start_date  | DATE        |               |
| end_date    | DATE        |               |
| created_at  | TIMESTAMPTZ | Default NOW() |
| updated_at  | TIMESTAMPTZ | Default NOW() |

#### port_requests

| Column          | Type        | Notes                    |
| --------------- | ----------- | ------------------------ |
| id              | UUID        | PK                       |
| tenant_id       | UUID        | NOT NULL, FK             |
| phone_number    | TEXT        | NOT NULL, number to port |
| current_carrier | TEXT        |                          |
| account_number  | TEXT        |                          |
| pin             | TEXT        | Encrypted                |
| status          | TEXT        | Default 'pending'        |
| created_at      | TIMESTAMPTZ | Default NOW()            |
| updated_at      | TIMESTAMPTZ | Default NOW()            |

**Status values:** pending, submitted, approved, completed, rejected

### 7.21 audit_logs

| Column      | Type        | Notes                 |
| ----------- | ----------- | --------------------- |
| id          | UUID        | PK, gen_random_uuid() |
| tenant_id   | UUID        | NOT NULL, FK          |
| user_id     | UUID        |                       |
| action      | TEXT        | NOT NULL              |
| entity_type | TEXT        |                       |
| entity_id   | UUID        |                       |
| details     | JSONB       | Default '{}'          |
| ip_address  | VARCHAR(50) |                       |
| created_at  | TIMESTAMPTZ | Default NOW()         |

**RLS:** Read-only for tenant members (SELECT only policy).

### 7.22 sms_messages

| Column      | Type         | Notes                 |
| ----------- | ------------ | --------------------- |
| id          | UUID         | PK, gen_random_uuid() |
| tenant_id   | UUID         | NOT NULL, FK          |
| call_id     | UUID         | FK calls(id)          |
| direction   | VARCHAR(20)  | Default 'outbound'    |
| from_number | VARCHAR(20)  |                       |
| to_number   | VARCHAR(20)  | NOT NULL              |
| body        | TEXT         | NOT NULL              |
| status      | VARCHAR(20)  | Default 'pending'     |
| external_id | VARCHAR(100) | Provider message ID   |
| created_at  | TIMESTAMPTZ  | Default NOW()         |

**Direction values:** inbound, outbound

### 7.23 Database Functions and Triggers

#### update_updated_at()

Trigger function applied to all tables with `updated_at` column. Automatically sets `updated_at = NOW()` before every UPDATE.

#### handle_new_user()

Trigger on `auth.users` INSERT. Creates a new tenant and tenant_members row when a user signs up. Runs as `SECURITY DEFINER` owned by postgres.

#### seed_tenant_defaults()

Trigger on `tenants` INSERT. Seeds default notification templates for new tenants.

#### normalize_phone(phone TEXT)

SQL function that strips non-digit characters from phone numbers.

#### generate_confirmation_code()

SQL function that generates a 6-character alphanumeric confirmation code.

#### seed_notification_templates(p_tenant_id UUID)

Creates default SMS and email templates for a tenant (booking confirmation, reminders, review requests).

---

## 8. API Reference -- Public Routes

### 8.1 Health Check

**File:** `lumentra-api/src/routes/health.ts`

```
GET /health
```

Returns system health including database status and tenant cache statistics.

**Response 200:**

```json
{
  "status": "ok",
  "timestamp": "2026-03-02T12:00:00.000Z",
  "db": {
    "connected": true,
    "pool": { "total": 20, "idle": 18, "waiting": 0 }
  },
  "tenantCache": {
    "tenants": 5,
    "lastRefreshed": "2026-03-02T11:55:00.000Z"
  }
}
```

```
GET /health/ping
```

Lightweight ping returning `{ "pong": true }`.

### 8.2 Chat Widget

**File:** `lumentra-api/src/routes/chat.ts`

The chat widget is a public, embeddable endpoint with its own CORS policy allowing any origin.

```
POST /api/chat/message
```

Send a message to the chat widget LLM. Uses multi-provider fallback (Gemini -> OpenAI -> Groq).

**Request Body:**

```json
{
  "tenant_id": "uuid",
  "session_id": "string",
  "message": "I'd like to book a table for tonight",
  "marketing_mode": false
}
```

**Response 200:**

```json
{
  "response": "I'd love to help you with a reservation! What time were you thinking?",
  "provider": "gemini",
  "tool_calls": [],
  "session_id": "abc123"
}
```

When `marketing_mode` is true, the system prompt includes tenant promotions for upselling.

```
GET /api/chat/config/:tenantId
```

Returns chat widget configuration for embedding.

**Response 200:**

```json
{
  "business_name": "Grand Plaza Hotel",
  "agent_name": "Alex",
  "greeting": "Hi! How can I help you today?",
  "features": { "bookings": true, "orders": false }
}
```

### 8.3 SIP Forward

```
POST /sip/forward
```

Public TwiML endpoint called by SignalWire. Returns XML that forwards the SIP call to the LiveKit SIP bridge. See Section 3 for details.

---

## 9. API Reference -- User Auth Routes

These routes require a valid JWT (`userAuthMiddleware`) but do NOT require X-Tenant-ID.

### 9.1 Setup Wizard

**File:** `lumentra-api/src/routes/setup.ts`

The setup wizard guides new users through a 9-step onboarding process.

#### Steps

| Step | Name         | Description                        |
| ---- | ------------ | ---------------------------------- |
| 0    | business     | Name and industry selection        |
| 1    | capabilities | Enable features                    |
| 2    | details      | Location, address, instructions    |
| 3    | integrations | Connect calendar providers         |
| 4    | assistant    | Agent name, personality, greetings |
| 5    | phone        | Phone setup (new/port/forward/SIP) |
| 6    | hours        | Operating hours schedule           |
| 7    | escalation   | Escalation contacts and triggers   |
| 8    | review       | Final review and activation        |

```
GET /api/setup/progress
```

Returns the current setup step, completion status, and data for all steps.

**Response 200:**

```json
{
  "current_step": 4,
  "completed": false,
  "tenant_id": "uuid",
  "steps": {
    "business": { "business_name": "My Hotel", "industry": "hotel" },
    "capabilities": { "appointments": true, "orders": false },
    "assistant": {
      "agent_name": "Alex",
      "personality": {
        "tone": "friendly",
        "verbosity": "balanced",
        "empathy": "high"
      }
    }
  }
}
```

```
POST /api/setup/step/:step
```

Save data for a specific step. Validates step-specific fields using Zod schemas.

**Request Body:** Varies by step. Example for step "business":

```json
{
  "business_name": "Grand Plaza Hotel",
  "industry": "hotel"
}
```

**Response 200:**

```json
{
  "success": true,
  "step": "business",
  "next_step": "capabilities"
}
```

```
POST /api/setup/complete
```

Marks setup as complete. Sets `setup_completed = true`, `setup_completed_at = NOW()`, `status = 'active'`. Invalidates tenant cache.

### 9.2 Tenant Management

**File:** `lumentra-api/src/routes/tenants.ts`

```
GET /api/tenants
```

Lists all tenants the authenticated user belongs to (via tenant_members).

**Response 200:**

```json
{
  "tenants": [
    {
      "id": "uuid",
      "business_name": "Grand Plaza Hotel",
      "industry": "hotel",
      "role": "owner",
      "setup_completed": true
    }
  ]
}
```

```
GET /api/tenants/:id
```

Get full tenant details (requires membership).

```
PUT /api/tenants/:id
```

Update tenant settings. Phone number changes trigger normalization and cache invalidation.

```
POST /api/tenants/:id/members
```

Invite a new member. Requires owner or admin role.

**Request Body:**

```json
{
  "email": "user@example.com",
  "role": "member"
}
```

```
DELETE /api/tenants/:id/members/:userId
```

Remove a member. Owners cannot be removed.

---

## 10. API Reference -- Tenant Auth Routes

All routes below require `authMiddleware()` (JWT + X-Tenant-ID header with verified membership).

### 10.1 Calls

**File:** `lumentra-api/src/routes/calls.ts`

```
GET /api/calls
```

List calls with search, filters, and pagination.

**Query Parameters:**

| Parameter    | Type   | Default    |
| ------------ | ------ | ---------- |
| search       | string |            |
| status       | string |            |
| outcome_type | string |            |
| direction    | string |            |
| date_from    | string |            |
| date_to      | string |            |
| limit        | number | 20         |
| offset       | number | 0          |
| sort_by      | string | created_at |
| sort_order   | string | desc       |

- **search:** Searches caller_phone and caller_name
- **status:** Filter by completed, failed, or missed
- **outcome_type:** Filter by booking, inquiry, support, escalation, or hangup
- **direction:** Filter by inbound or outbound
- **date_from / date_to:** ISO date range boundaries
- **limit:** Page size, max 100
- **sort_order:** asc or desc

**Response 200:**

```json
{
  "data": [
    {
      "id": "uuid",
      "caller_phone": "+15551234567",
      "caller_name": "John Smith",
      "direction": "inbound",
      "status": "completed",
      "duration_seconds": 120,
      "outcome_type": "booking",
      "summary": "Guest booked a room for Feb 15-17",
      "sentiment_score": 0.85,
      "created_at": "2026-03-02T10:30:00Z"
    }
  ],
  "total": 150,
  "limit": 20,
  "offset": 0,
  "has_more": true
}
```

```
GET /api/calls/:id
```

Get single call with transcript, linked contact, and linked booking.

```
GET /api/calls/stats
```

Aggregated call statistics for the tenant.

```
GET /api/calls/analytics
```

Time-series analytics with outcome breakdowns and peak hours.

**Query Parameters:** `period` (day, week, month), `date_from`, `date_to`

```
GET /api/calls/recent
```

Returns the 10 most recent calls (shortcut endpoint).

### 10.2 Bookings

**File:** `lumentra-api/src/routes/bookings.ts`

```
GET /api/bookings
```

List bookings with filters. Supports same pagination pattern as calls.

**Query Parameters:** search, status (pending/confirmed/completed/cancelled/no_show), date_from, date_to, booking_type, source, limit, offset, sort_by, sort_order.

```
POST /api/bookings
```

Create a new booking. Validates with Zod schema.

**Request Body:**

```json
{
  "customer_name": "John Smith",
  "customer_phone": "+15551234567",
  "booking_date": "2026-03-15",
  "booking_time": "14:00",
  "booking_type": "reservation",
  "duration_minutes": 60,
  "party_size": 4,
  "notes": "Birthday dinner",
  "resource_id": "uuid"
}
```

**Response 201:**

```json
{
  "id": "uuid",
  "confirmation_code": "AK7P2W",
  "status": "confirmed",
  "booking_date": "2026-03-15",
  "booking_time": "14:00"
}
```

```
PUT /api/bookings/:id
```

Update booking details.

```
POST /api/bookings/:id/confirm
POST /api/bookings/:id/complete
POST /api/bookings/:id/no-show
POST /api/bookings/:id/cancel
```

Status transition endpoints. Each validates that the transition is valid from the current status.

```
POST /api/bookings/:id/reschedule
```

**Request Body:**

```json
{
  "booking_date": "2026-03-16",
  "booking_time": "15:00"
}
```

```
GET /api/bookings/calendar
```

Calendar view of bookings. **Query Parameters:** start_date, end_date. Returns bookings grouped by date.

```
GET /api/bookings/day-summary
```

Summary for a specific day. **Query Parameters:** date. Returns counts by status.

```
GET /api/bookings/upcoming
```

Returns confirmed bookings for the next 7 days.

### 10.3 Contacts (CRM)

**File:** `lumentra-api/src/routes/contacts.ts`

Full CRM contact management with search, import/export, merge, and engagement scoring.

```
GET /api/contacts
```

Search contacts with filters.

**Query Parameters:** search, status (active/inactive/blocked/vip), lead_status (new/contacted/qualified/converted/lost), tags (comma-separated), source, has_bookings (boolean), has_calls (boolean), created_after, created_before, last_contact_after, last_contact_before, limit, offset, sort_by, sort_order.

```
POST /api/contacts
```

Create a new contact.

```
GET /api/contacts/:id
```

Get contact with all fields.

```
PUT /api/contacts/:id
```

Update contact. Supports partial updates.

```
DELETE /api/contacts/:id
```

Soft delete (sets status to inactive).

```
GET /api/contacts/lookup/phone/:phone
```

Lookup contact by phone number. Uses cache for fast response.

```
GET /api/contacts/lookup/email/:email
```

Lookup contact by email.

```
POST /api/contacts/find-or-create
```

Find by phone or create new. Used by voice agent during calls.

**Request Body:**

```json
{
  "phone": "+15551234567",
  "name": "John Smith",
  "source": "call"
}
```

```
POST /api/contacts/:id/tags
```

Add a tag to a contact.

```
DELETE /api/contacts/:id/tags/:tag
```

Remove a tag.

```
GET /api/contacts/:id/notes
```

Get notes for a contact (pinned first, then by date).

```
POST /api/contacts/:id/notes
```

Add a note.

```
GET /api/contacts/:id/history
```

Get activity timeline.

```
POST /api/contacts/import
```

Bulk import contacts from JSON or CSV.

**Request Body:**

```json
{
  "records": [
    {
      "phone": "+15551234567",
      "name": "John",
      "email": "john@example.com",
      "tags": "vip,regular"
    }
  ],
  "options": {
    "skipDuplicates": true,
    "updateExisting": false,
    "source": "import"
  }
}
```

**Response 200:**

```json
{
  "total": 100,
  "created": 85,
  "updated": 0,
  "skipped": 12,
  "errors": [
    { "row": 45, "field": "phone", "message": "Phone number is required" }
  ]
}
```

```
GET /api/contacts/export
```

Export contacts as JSON or CSV. **Query Parameters:** format (json/csv), filters same as GET /api/contacts.

```
POST /api/contacts/merge
```

Merge duplicate contacts.

**Request Body:**

```json
{
  "primary_id": "uuid",
  "secondary_ids": ["uuid1", "uuid2"]
}
```

Merges all calls, bookings, notes, activity, tags, and metrics from secondary contacts into the primary. Soft-deletes secondaries.

```
GET /api/contacts/:id/engagement
```

Get detailed engagement score breakdown with factor contributions.

### 10.4 Deals (Sales Pipeline)

**File:** `lumentra-api/src/routes/deals.ts`

```
GET /api/deals
```

List deals with filters. **Query Parameters:** stage, source, contact_id, limit, offset, sort_by, sort_order.

```
POST /api/deals
```

Create a deal. Stage is validated against the industry-specific pipeline configuration.

```
GET /api/deals/:id
```

Get deal details.

```
PUT /api/deals/:id
```

Update deal.

```
PUT /api/deals/:id/stage
```

Move deal to a new stage. Validates the stage ID exists in the tenant's industry pipeline. Sets `closed_at` when moving to a terminal stage.

**Request Body:**

```json
{
  "stage": "completed"
}
```

```
GET /api/deals/pipeline
```

Returns deals grouped by stage for Kanban board display. Response is keyed by stage ID.

### 10.5 Tasks

**File:** `lumentra-api/src/routes/tasks.ts`

```
GET /api/tasks
```

List tasks. **Query Parameters:** status, priority, type, assigned_to, contact_id, due_before, due_after, limit, offset.

```
POST /api/tasks
```

Create a task. Type is validated against the industry-specific task type list.

```
GET /api/tasks/:id
```

Get task details.

```
PUT /api/tasks/:id
```

Update task.

```
POST /api/tasks/:id/complete
```

Mark task as completed. Sets `completed_at = NOW()`.

```
GET /api/tasks/upcoming
```

Tasks due in the next 7 days.

```
GET /api/tasks/overdue
```

Tasks past due date that are not completed/cancelled.

```
GET /api/tasks/counts
```

Count of tasks by status (pending, in_progress, completed, overdue).

### 10.6 Dashboard

**File:** `lumentra-api/src/routes/dashboard.ts`

```
GET /api/dashboard/metrics
```

Aggregated system metrics for dashboard overview cards.

**Response 200:**

```json
{
  "calls": { "total": 1523, "today": 12, "this_week": 85, "this_month": 342 },
  "bookings": { "total": 890, "today": 5, "this_week": 42, "this_month": 178 },
  "contacts": { "total": 456, "new_this_week": 15 },
  "deals": { "total": 234, "open": 45, "won_this_month": 23 }
}
```

```
GET /api/dashboard/activity
```

Recent activity feed. Returns the latest calls, bookings, and contact events.

```
GET /api/dashboard/stats
```

Aggregated stats by period. **Query Parameters:** period (day/week/month), metric (calls/bookings).

```
GET /api/dashboard/sessions
```

Active call sessions (if any).

### 10.7 Availability

**File:** `lumentra-api/src/routes/availability.ts`

```
GET /api/availability/slots
```

Get available time slots for a date range. **Query Parameters:** start_date, end_date, resource_id.

```
POST /api/availability/check
```

Check if a specific date/time is available.

**Request Body:**

```json
{
  "date": "2026-03-15",
  "time": "14:00",
  "duration_minutes": 60,
  "resource_id": "uuid"
}
```

```
POST /api/availability/slots
```

Create or update availability slots.

```
POST /api/availability/generate
```

Generate slots from operating hours for a date range.

### 10.8 Resources

**File:** `lumentra-api/src/routes/resources.ts`

```
GET /api/resources
```

List resources. **Query Parameters:** type (staff/room/equipment/vehicle/table), is_bookable, is_active.

```
POST /api/resources
```

Create a resource.

```
PUT /api/resources/:id
```

Update resource.

```
DELETE /api/resources/:id
```

Soft delete (sets is_active to false).

```
GET /api/resources/bookable
```

Returns only bookable, active resources.

```
PUT /api/resources/reorder
```

Update sort_order for multiple resources.

**Request Body:**

```json
{
  "order": [
    { "id": "uuid1", "sort_order": 0 },
    { "id": "uuid2", "sort_order": 1 }
  ]
}
```

### 10.9 Voicemails

**File:** `lumentra-api/src/routes/voicemails.ts`

```
GET /api/voicemails
```

List voicemails. **Query Parameters:** status, limit, offset.

```
PUT /api/voicemails/:id/status
```

Update voicemail status. **Request Body:** `{ "status": "reviewed" }`

```
GET /api/voicemails/stats
```

Voicemail statistics by status.

### 10.10 Notifications

**File:** `lumentra-api/src/routes/notifications.ts`

```
GET /api/notifications
```

List notifications. **Query Parameters:** status, channel, notification_type, limit, offset.

```
GET /api/notifications/templates
```

List notification templates.

```
PUT /api/notifications/templates/:id
```

Update a template.

```
GET /api/notifications/preferences/:contactId
```

Get notification preferences for a contact.

```
PUT /api/notifications/preferences/:contactId
```

Update preferences.

```
POST /api/notifications/send
```

Send a notification immediately.

```
POST /api/notifications/preview
```

Preview a notification with variable substitution without sending.

```
POST /api/notifications/process-queue
```

Manually trigger notification queue processing.

### 10.11 Training Data

**File:** `lumentra-api/src/routes/training-data.ts`

```
GET /api/training
```

List conversation logs. **Query Parameters:** scenario_type, reviewed (boolean), flagged (boolean), quality_min, quality_max, has_tool_calls (boolean), limit, offset.

```
PUT /api/training/bulk-review
```

Bulk update review status.

**Request Body:**

```json
{
  "ids": ["uuid1", "uuid2"],
  "reviewed": true,
  "flagged": false
}
```

```
GET /api/training/export
```

Export training data in various formats.

**Query Parameters:**

| Parameter     | Type    | Description                     |
| ------------- | ------- | ------------------------------- |
| format        | string  | jsonl, sharegpt, alpaca, openai |
| quality_min   | number  | Minimum quality score (0.0-1.0) |
| scenario_type | string  | Filter by scenario              |
| reviewed_only | boolean | Only export reviewed data       |

```
GET /api/training/stats
```

Statistics: total logs, reviewed count, flagged count, average quality, scenario breakdown.

### 10.12 Additional Routes

#### Integrations (`/api/integrations`)

**File:** `lumentra-api/src/routes/integrations.ts`

- `GET /api/integrations` -- List connected integrations
- `POST /api/integrations/google/auth` -- Start Google Calendar OAuth flow
- `GET /api/integrations/google/callback` -- OAuth callback handler
- `POST /api/integrations/outlook/auth` -- Start Outlook OAuth flow
- `GET /api/integrations/outlook/callback` -- OAuth callback handler
- `POST /api/integrations/calendly/auth` -- Connect Calendly
- `DELETE /api/integrations/:id` -- Disconnect an integration

OAuth tokens are encrypted with AES-256-GCM before storage.

#### Phone Configuration (`/api/phone`)

**File:** `lumentra-api/src/routes/phone-config.ts`

- `GET /api/phone/config` -- Get current phone configuration
- `POST /api/phone/new` -- Provision a new phone number via SignalWire
- `POST /api/phone/port` -- Submit a number port request
- `POST /api/phone/forward` -- Set up call forwarding from existing number
- `POST /api/phone/sip` -- Configure SIP endpoint
- `GET /api/phone/forwarding-instructions` -- Get carrier-specific forwarding instructions
- `GET /api/phone/sip-status` -- Check SIP endpoint connectivity

Rate limited with `critical` tier (5 requests per hour) for provisioning endpoints.

#### Escalation (`/api/escalation`)

**File:** `lumentra-api/src/routes/escalation.ts`

- `GET /api/escalation/queue` -- List escalation queue entries (with priority and status mapping)
- `GET /api/escalation/contacts` -- List escalation contacts
- `POST /api/escalation/contacts` -- Add escalation contact
- `PUT /api/escalation/contacts/:id` -- Update contact
- `DELETE /api/escalation/contacts/:id` -- Remove contact
- `PUT /api/escalation/contacts/reorder` -- Reorder contacts by priority
- `GET /api/escalation/triggers` -- Get escalation triggers
- `PUT /api/escalation/triggers` -- Update triggers

#### Promotions (`/api/promotions`)

**File:** `lumentra-api/src/routes/promotions.ts`

- `GET /api/promotions` -- List promotions
- `POST /api/promotions` -- Create promotion (owner/admin only)
- `PUT /api/promotions/:id` -- Update promotion
- `DELETE /api/promotions/:id` -- Delete promotion
- `PUT /api/promotions/:id/toggle` -- Toggle active state

#### Capabilities (`/api/capabilities`)

**File:** `lumentra-api/src/routes/capabilities.ts`

- `GET /api/capabilities/options` -- Get industry-specific capability options
- `GET /api/capabilities` -- Get tenant's enabled capabilities
- `PUT /api/capabilities` -- Update capabilities

#### Pending Bookings (`/api/pending-bookings`)

**File:** `lumentra-api/src/routes/pending-bookings.ts`

For assisted mode where bookings need manual confirmation:

- `GET /api/pending-bookings` -- List pending booking requests
- `POST /api/pending-bookings/:id/confirm` -- Confirm and convert to real booking
- `POST /api/pending-bookings/:id/reject` -- Reject request

---

## 11. Internal API (Agent-to-API Protocol)

**File:** `lumentra-api/src/routes/internal.ts`

The internal API enables communication between the Python voice agent and the Node.js API. All routes are prefixed with `/internal` and authenticated via `INTERNAL_API_KEY` bearer token.

### 11.1 Tenant Lookup

```
GET /internal/tenants/by-phone/:phone
```

Called at the start of every inbound call to fetch tenant configuration.

**Response 200:**

```json
{
  "id": "uuid",
  "business_name": "Grand Plaza Hotel",
  "industry": "hotel",
  "agent_name": "Alex",
  "phone_number": "+19458001233",
  "voice_config": {
    "voice_id": "a0e99841-438c-4a64-b679-ae501e7d6091",
    "speed": 0.95,
    "emotion": ["Content"]
  },
  "agent_personality": {
    "tone": "friendly",
    "verbosity": "balanced",
    "empathy": "high"
  },
  "greeting_standard": "Hi, thanks for calling Grand Plaza Hotel! How can I help you?",
  "greeting_after_hours": "Thanks for calling Grand Plaza. We're currently closed...",
  "greeting_returning": "Welcome back! How can I help you today?",
  "timezone": "America/New_York",
  "operating_hours": {
    "schedule": [{ "day": "Monday", "open": "09:00", "close": "17:00" }]
  },
  "escalation_enabled": true,
  "escalation_phone": "+15559876543",
  "escalation_triggers": ["angry", "legal", "complaint"],
  "features": { "bookings": true, "orders": false },
  "voice_pipeline": "livekit",
  "max_call_duration_seconds": 900,
  "system_prompt": "You are Alex, the receptionist at Grand Plaza Hotel..."
}
```

The `system_prompt` field is built server-side by `buildSystemPrompt()` and includes the master voice prompt, industry configuration, personality settings, operating hours, and custom instructions.

### 11.2 Voice Tool Execution

```
POST /internal/voice-tools/:action
```

Routes tool calls from the Python agent to the tool execution engine.

**Supported Actions:** check_availability, create_booking, create_order, transfer_to_human, end_call, log_note

**Request Body:**

```json
{
  "tenant_id": "uuid",
  "call_sid": "room-name-123",
  "caller_phone": "+15551234567",
  "escalation_phone": "+15559876543",
  "args": {
    "date": "2026-03-15",
    "service_type": "reservation"
  }
}
```

**Response 200:**

```json
{
  "result": {
    "available": true,
    "slots": ["09:00", "10:00", "11:00"],
    "message": "We have availability at 9 AM, 10 AM, and 11 AM. Which time works best for you?"
  }
}
```

**Error Response 500:**

```json
{
  "error": "Tool execution failed: Database connection error"
}
```

### 11.3 Call Logging

```
POST /internal/calls/log
```

Saves a call record after the call ends. Also triggers post-call automation.

**Request Body:**

```json
{
  "tenant_id": "uuid",
  "call_sid": "room-name-123",
  "caller_phone": "+15551234567",
  "caller_name": "John Smith",
  "direction": "inbound",
  "status": "completed",
  "started_at": "2026-03-02T10:30:00Z",
  "ended_at": "2026-03-02T10:32:00Z",
  "duration_seconds": 120,
  "ended_reason": "caller_hangup",
  "outcome_type": "booking",
  "outcome_success": true,
  "transcript": "Agent: Hi, thanks for calling...\nCaller: I'd like to book...",
  "summary": "Guest booked a room for March 15-17",
  "sentiment_score": 0.85,
  "intents_detected": ["booking", "room_inquiry"]
}
```

**Processing:**

1. Finds or creates a contact record by caller phone
2. Inserts a row into the `calls` table
3. Maps agent status to DB status (e.g., "transferred" maps to "completed")
4. Triggers post-call automation asynchronously (non-blocking)

**Response 200:**

```json
{
  "success": true,
  "id": "uuid"
}
```

---

## 12. Voice Agent Architecture (Python/LiveKit)

### 12.1 File Structure

```
lumentra-agent/
  agent.py          -- Main entrypoint: LumentraAgent class, AgentServer, entrypoint
  tools.py          -- 6 function tools (check_availability, create_booking, etc.)
  call_logger.py    -- Post-call transcript extraction, outcome detection, API logging
  tenant_config.py  -- Fetches tenant config from internal API
  api_client.py     -- Shared httpx.AsyncClient with auth
  requirements.txt  -- Python dependencies
```

### 12.2 Agent Lifecycle

**File:** `lumentra-agent/agent.py`

1. **Process Prewarm:** `prewarm(proc)` loads the Silero VAD model into `proc.userdata["vad"]` at process start, avoiding cold-start latency on the first call.

2. **Entrypoint:** `@server.rtc_session(agent_name="lumentra-voice-agent")` decorates the `entrypoint()` coroutine. For each inbound SIP call:

   - Connects to the LiveKit room: `await ctx.connect()`
   - Waits for the SIP participant: `await ctx.wait_for_participant()`
   - Extracts dialed number from `participant.attributes["sip.trunkPhoneNumber"]`
   - Extracts caller phone from `participant.attributes["sip.phoneNumber"]`
   - Fetches tenant config from internal API via `get_tenant_by_phone(dialed_number)`
   - If no tenant found, logs error and returns (call drops)

3. **Session Configuration:** Creates an `AgentSession` with:

   - **STT:** Deepgram Nova-3 with multi-language, smart_format, keyterm boosting for business name
   - **LLM:** OpenAI gpt-4.1-mini at temperature 0.8
   - **TTS:** Cartesia Sonic-3 with tenant-specific voice ID, speed 0.95, emotion "Content"
   - **VAD:** Prewarmed Silero model
   - **Turn Detection:** LiveKit MultilingualModel
   - **Conversation Tuning:** preemptive_generation=True, resume_false_interruption=True, false_interruption_timeout=1.5s, min_endpointing_delay=0.8s, max_endpointing_delay=2.5s

4. **Agent Start:** Creates `LumentraAgent` instance and starts the session with noise cancellation (BVCTelephony for SIP audio quality).

5. **Greeting:** `LumentraAgent.on_enter()` generates the initial greeting using the tenant's standard greeting.

### 12.3 Duration Watchdog

The `_duration_watchdog()` coroutine enforces maximum call duration:

| Phase   | Timing               | Action                     |
| ------- | -------------------- | -------------------------- |
| Phase 1 | max_duration - 120s  | Nudge agent to wrap up     |
| Phase 2 | max_duration - 30s   | Warn agent, offer transfer |
| Phase 3 | max_duration (limit) | SIP REFER or room deletion |

- **Phase 3 detail:** Attempts SIP REFER transfer to escalation phone. Falls back to room deletion if transfer fails.

Default max_duration is 900 seconds (15 minutes), minimum 120 seconds (2 minutes).

### 12.4 Tools

**File:** `lumentra-agent/tools.py`

All tools are decorated with `@function_tool` from LiveKit Agents SDK. Each tool calls the internal API via the shared httpx client.

| Tool                 | Description                   |
| -------------------- | ----------------------------- |
| `check_availability` | Check slots for a date        |
| `create_booking`     | Create a confirmed booking    |
| `create_order`       | Create a food order           |
| `transfer_to_human`  | SIP REFER to escalation phone |
| `end_call`           | Delete the LiveKit room       |
| `log_note`           | Log a note to the contact     |

**Tool parameters:**

- **check_availability:** date (YYYY-MM-DD), service_type (optional)
- **create_booking:** customer_name, customer_phone, date, time, service_type, notes
- **create_order:** customer_name, customer_phone, order_type (pickup/delivery), items, delivery_address, special_instructions
- **transfer_to_human:** reason
- **end_call:** reason
- **log_note:** note, note_type

#### SIP Transfer Implementation

`transfer_to_human` finds the SIP participant in the room, constructs a SIP URI (`sip:{phone}@sip.signalwire.com`), and calls `sip_participant.transfer_sip_call(sip_uri)` which sends a SIP REFER.

### 12.5 Call Logger

**File:** `lumentra-agent/call_logger.py`

The `log_call()` function runs during session shutdown:

1. **Transcript Extraction:** Iterates through `session.history` to build a transcript from user speech and agent responses.
2. **Outcome Detection:** Uses regex patterns to detect outcomes from transcript:
   - "booking" if confirmation code or "booked" mentioned
   - "escalation" if transfer occurred
   - "support" if help/issue keywords detected
   - "inquiry" as default
3. **Summary Building:** Constructs a brief summary from the last few exchanges.
4. **API Call:** POSTs to `/internal/calls/log` with all collected data.
5. **Timeout:** Wrapped in `asyncio.wait_for(timeout=5.0)` to not block session teardown.

### 12.6 Tenant Config

**File:** `lumentra-agent/tenant_config.py`

`get_tenant_by_phone(phone)` makes a GET request to `/internal/tenants/by-phone/{phone}`. Returns the full tenant config dict or None if not found. The phone number is URL-encoded.

### 12.7 API Client

**File:** `lumentra-agent/api_client.py`

Creates a singleton `httpx.AsyncClient` with:

- Base URL from `LUMENTRA_API_URL` env var
- `Authorization: Bearer {INTERNAL_API_KEY}` header
- 10-second timeout
- Reused across all tool calls and config fetches

---

## 13. System Prompt Builder and Industry Configs

### 13.1 System Prompt Builder

**File:** `lumentra-api/src/services/gemini/chat.ts` (function: `buildSystemPrompt`)

The system prompt is constructed in layers:

1. **Master Voice Prompt** (immutable, ~490 lines) -- Defines HOW the agent speaks: voice output format, SSML markers, greeting patterns, response length rules, name spelling verification, natural pacing, turn-taking behavior, cultural awareness, tool usage guidelines, error handling patterns, and more. Tenants CANNOT override this layer.

2. **Agent Identity** -- "You are {agentName}, the receptionist at {businessName}."

3. **Personality Configuration** -- Tone (professional/friendly/casual/formal), verbosity (concise/balanced/detailed), empathy (high/medium/low).

4. **Voice Conversation Guidelines** -- Phone-specific rules for natural conversation.

5. **Business Context** -- Industry, business name, today's date, location, timezone.

6. **Operating Hours** -- Schedule with day/open/close times, holidays.

7. **Escalation Info** -- Transfer phone if configured, or "take a message" instruction.

8. **Industry-Specific Sections** -- Critical rules, booking flow, FAQ (from industry config).

9. **Custom Instructions** -- Tenant-provided business-specific knowledge.

10. **Critical Rules** -- Final hard constraints (never say you're AI, keep responses short, etc.).

11. **Call Flow** -- Standard flow: greet, help, confirm, goodbye.

### 13.2 Master Voice Prompt

**File:** `lumentra-api/src/config/master-voice-prompt.ts`

The master voice prompt (~490 lines) covers:

- **Sonic-3 SSML Markers:** `<break>`, `<speed>`, `<spell>`, `[laughter]`, `<emotion>`
- **High-Stakes Accuracy:** Zero tolerance for guessing names, dates, times
- **Greeting Acknowledgment:** How to handle "Hello?" after greeting
- **Response Length:** One sentence when possible, two max
- **Name Spelling Verification:** Always ask to spell, always confirm with `<spell>` tag
- **Natural Pacing:** Filler words sparingly, thinking aloud
- **Phrases to Avoid:** 27 robotic phrases to never use, with natural alternatives
- **Turn-Taking:** Interruption handling, pause tolerance
- **Energy Matching:** Adapt to caller's emotional state
- **Tool Usage:** Announce before calling, don't repeat after result
- **Parameter Conversion:** Natural language to date/time/number formats
- **Confirmation Protocol:** Read back all details with `<speed ratio="0.9"/>`, get explicit "yes"
- **Cultural Awareness:** Accent patience, never comment on accents, always verify

### 13.3 Industry Configurations

**File:** `lumentra-api/src/config/industry-prompts.ts`

Seven fully supported industries with custom terminology, role descriptions, critical rules, booking flows, and FAQs:

| Industry     | Transaction | Customer |
| ------------ | ----------- | -------- |
| medical      | Appointment | Patient  |
| dental       | Appointment | Patient  |
| hotel        | Reservation | Guest    |
| motel        | Reservation | Guest    |
| restaurant   | Reservation | Guest    |
| salon        | Appointment | Client   |
| auto_service | Appointment | Customer |

**Key rules by industry:**

- **medical:** No medical advice, HIPAA compliant, confirm DOB
- **dental:** Emergency same-day slots, no treatment cost quotes
- **hotel:** State tracking, avoid repetition, flexible booking flow
- **motel:** Simple and efficient
- **restaurant:** State tracking, spell name, 15-min hold policy
- **salon:** Service type, preferred stylist, duration
- **auto_service:** Vehicle info, symptoms, estimated duration

Unsupported industries fall back to a generic configuration.

---

## 14. LLM Integration and Multi-Provider Fallback

### 14.1 Voice Calls (Single Provider)

Voice calls use OpenAI gpt-4.1-mini exclusively via the LiveKit Agents SDK. The agent.py configures:

```python
llm = openai.LLM(model="gpt-4.1-mini", temperature=0.8)
```

Cost per voice call: approximately $0.015 with 88% prompt cache hit rate.

### 14.2 Chat Widget (Multi-Provider Fallback)

**File:** `lumentra-api/src/services/llm/multi-provider.ts`

The chat widget uses a three-provider fallback chain: Gemini (primary) -> OpenAI (fallback) -> Groq (fallback).

#### Fallback Logic

1. Check if provider client is initialized (API key configured)
2. Check if provider is available (not rate-limited or in error cooldown)
3. Attempt the call
4. On success, return result with `provider` field
5. On failure, classify error:
   - **Rate limit** (429, "quota", "RESOURCE_EXHAUSTED"): 5-minute cooldown
   - **Other error:** 1-minute cooldown
6. Continue to next provider
7. If all fail, throw `Error("All LLM providers failed")`

#### Provider Configuration

| Provider | Model              | Temperature | Max Tokens |
| -------- | ------------------ | ----------- | ---------- |
| Gemini   | Configured via env | 0.4         | 500        |
| OpenAI   | Configured via env | 0.4         | 500        |
| Groq     | Configured via env | 0.4         | 500        |

#### Schema Conversion

The multi-provider service handles format conversion:

- **Gemini:** Native FunctionDeclaration format, Content/Part format for messages
- **OpenAI/Groq:** Converts Gemini schemas to JSON Schema format, uses ChatCompletionMessageParam format

#### Tool Result Handling

`sendToolResults()` sends tool execution results back to the LLM for the final response. It prefers the original provider but falls back to others if needed.

#### Health Check

`getProviderStatus()` returns the current status of all three providers with their model names, used by the health endpoint.

---
