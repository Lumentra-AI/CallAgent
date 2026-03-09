# Lumentra - Deployment Guide

---

## Local Development

### Prerequisites

- Node.js 22+
- npm
- A Supabase project (free tier works)
- ngrok or similar tunnel for voice webhook testing

### Running the API

```bash
cd lumentra-api
cp .env.example .env
# Fill in all env vars (see ENV-SETUP.md)
npm install
npm run dev
# Runs on http://localhost:3100
```

### Running the Dashboard

```bash
cd lumentra-dashboard
cp .env.example .env
# Fill in NEXT_PUBLIC_API_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
npm install
npm run dev
# Runs on http://localhost:3000
```

### Testing Voice Calls Locally

Voice calls require the API to be publicly reachable (SignalWire sends webhooks):

```bash
# Option 1: ngrok
ngrok http 3100

# Then set BACKEND_URL in lumentra-api/.env to the ngrok URL
# And configure SignalWire phone number webhook to point to:
#   https://your-ngrok-url.ngrok-free.app/signalwire/voice
```

---

## Production Deployment

### Voice Agent (LiveKit stack -- deployed separately from API/Dashboard)

The voice agent runs on the same Hetzner server but is NOT managed by Coolify. It has its own docker-compose at `/opt/livekit/`.

**Server:** `ssh -i ~/.ssh/id_ed25519 root@178.156.205.145`

**File layout on server:**

```text
/opt/livekit/
  docker-compose.yml          # redis, livekit, sip, agent services
  .env                        # All API keys (Deepgram, OpenAI, Cartesia, etc.)
  config/
    livekit.yaml              # LiveKit server config + API key/secret
    sip.yaml                  # SIP bridge config
  agent/
    agent.py                  # Copied from lumentra-agent/
    tools.py
    call_logger.py
    tenant_config.py
    api_client.py
    Dockerfile
```

**Deploying agent changes:**

```bash
# 1. Edit files locally in lumentra-agent/
# 2. Copy to server
scp -i ~/.ssh/id_ed25519 lumentra-agent/*.py lumentra-agent/Dockerfile root@178.156.205.145:/opt/livekit/agent/

# 3. Rebuild and restart agent only
ssh -i ~/.ssh/id_ed25519 root@178.156.205.145 "cd /opt/livekit && docker compose up -d --build agent"

# 4. Check logs
ssh -i ~/.ssh/id_ed25519 root@178.156.205.145 "cd /opt/livekit && docker compose logs agent --tail=50"

# 5. Watch logs in real-time during a test call
ssh -i ~/.ssh/id_ed25519 root@178.156.205.145 "cd /opt/livekit && docker compose logs agent -f"
```

**Restarting the full LiveKit stack:**

```bash
ssh -i ~/.ssh/id_ed25519 root@178.156.205.145 "cd /opt/livekit && docker compose down && docker compose up -d"
```

**Key details:**

- All services use `network_mode: host` (required for SIP/RTP)
- Agent env vars loaded via `env_file: .env` (NOT `${VAR}` interpolation -- breaks over SSH)
- Agent reaches lumentra-api at `http://10.0.1.5:3100` (Coolify docker network IP)
- If Coolify redeploys API on a different network, update `INTERNAL_API_URL` in `.env`
- GitHub Actions workflow (`.github/workflows/deploy-agent.yml`) auto-deploys on push to `lumentra-agent/`

**LiveKit IDs (needed if recreating SIP config):**

- API key: `replace-with-livekit-api-key`
- SIP trunk ID: `ST_SUJtKjT9TEgv` (+19458001233)
- Dispatch rule ID: `SDR_2bZEobprwRXq` (routes to `lumentra-voice-agent`, room prefix `call-`)

---

### API + Dashboard (Coolify)

API and Dashboard are deployed via Coolify on the same server (port 8000). Coolify auto-deploys on push to `main`.

### Option 1: Docker Compose (recommended for simple deploys)

```bash
# From project root
cp .env.example .env
# Fill in all production values

docker compose up -d
# API on port 3100, Dashboard on port 3000

# With nginx reverse proxy:
docker compose --profile production up -d
# Serves on port 80/443
```

The `docker-compose.yml` defines three services:

- `api` - Lumentra API (builds from `lumentra-api/Dockerfile`)
- `dashboard` - Next.js dashboard (builds from `lumentra-dashboard/Dockerfile`)
- `nginx` - Reverse proxy (production profile only)

### Option 2: Separate Deployments

**API** can be deployed to any Node.js host:

```bash
cd lumentra-api
npm run build          # Outputs to dist/index.js
npm run start          # Or: node dist/index.js
```

**Dashboard** can be deployed to Vercel, Railway, or any Next.js host:

```bash
cd lumentra-dashboard
npm run build
npm run start
```

### Option 3: Cloud Run / Fly.io

Config files exist for both:

- `lumentra-api/cloudrun-service.yaml` - Google Cloud Run config
- `lumentra-api/fly.toml` - Fly.io config
- `lumentra-api/deploy-cloudrun.sh` - Cloud Run deploy script

---

## Database Setup

The database is hosted on Supabase. Migrations are in `lumentra-api/migrations/`.

### Running Migrations

Migrations should be applied in order through the Supabase SQL editor or `psql`:

```
lumentra-api/migrations/
  001_initial.sql
  002_crm_schema.sql
  003_seed_test_data.sql       # Test data only - skip for production
  004_seed_simple.sql          # Test data only - skip for production
  005_voicemails.sql
  006_pizza_demo.sql           # Demo data only - skip for production
  007_conversation_logs.sql
  007_llm_function_helpers.sql
  008_hotel_demo.sql           # Demo data only - skip for production
  009_auth_tenant_members.sql
  010_custom_instructions.sql
  011_auth_user_trigger.sql
  011_responses.sql
  012_fixes_and_improvements.sql
  013_setup_wizard_tables.sql
  014_pending_bookings.sql
  015_vapi_phone_number_id.sql
  016_sip_trunk_support.sql
  017_call_metadata_and_indexes.sql
```

For a fresh production database, use the consolidated schema instead:

```
infrastructure/init-scripts/
  001-tables.sql               # All tables
  002-indexes.sql              # All indexes
  003-functions.sql            # Database functions
```

---

## CI/CD

GitHub Actions workflow in `.github/workflows/ci.yml`:

- Runs on push to `main` and `feature/*` branches
- API: type check + build
- Dashboard: type check + lint + build
- Security scan

---

## Infrastructure Files

```
infrastructure/
  docker-compose.infrastructure.yml   # Infrastructure-level compose
  .env.example                        # Infrastructure env template
  init-scripts/                       # Consolidated DB schema

hetzner/
  DEPLOYMENT-GUIDE.md                 # Hetzner-specific deployment notes

nginx.conf                            # Nginx reverse proxy config
dev.sh                                # Local dev helper script
```

---

## SignalWire Configuration (SIP Trunk)

SignalWire connects to LiveKit via SIP (not webhooks). The current setup uses a SignalWire SIP Gateway:

1. Buy a phone number in SignalWire dashboard
2. Create a SIP Gateway pointing to your server IP on port 5060
3. Assign the phone number to the SIP Gateway
4. Register the SIP trunk in LiveKit (`lk sip create-inbound-trunk`)
5. Create a dispatch rule to route `call-*` rooms to `lumentra-voice-agent`

The phone number (+19458001233) is already configured and working. Only redo these steps if changing phone numbers or servers.

**If calls stop connecting:** SignalWire IPs are dynamic. Re-resolve and update firewall:

```bash
dig sip.signalwire.com  # get current IPs
# Update both Hetzner cloud firewall and UFW on server
```

---

## Health Check

The API exposes `GET /health` which returns service status. Docker Compose uses this for container health monitoring.
