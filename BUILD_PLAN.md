# Lumentra Build Plan

> Last Updated: 2026-01-20

## Executive Summary

Lumentra is a white-label AI voice agent platform for handling inbound calls. Core infrastructure complete, CRM fully working, voice agent functional with real tools, and frontend dashboard with calls and analytics pages.

---

## Current Status

### Overall Completion: 92%

| Component          | Status   | Completion |
| ------------------ | -------- | ---------- |
| Database Schema    | Complete | 100%       |
| Backend API        | Complete | 95%        |
| CRM Suite          | Complete | 100%       |
| Voice Agent        | Complete | 95%        |
| Frontend Dashboard | Complete | 90%        |
| DevOps/Deployment  | Partial  | 75%        |

---

## PHASE 1: COMPLETED

### 1.1 Database (100%)

- [x] Multi-tenant schema with RLS
- [x] Tenants table with full configuration
- [x] Calls table with transcripts and outcomes
- [x] Bookings with status workflow
- [x] Contacts with engagement metrics
- [x] Contact notes and activity timeline
- [x] Resources (staff, rooms, equipment)
- [x] Availability templates and slots
- [x] Notification templates and queue
- [x] SMS messages tracking
- [x] Callback queue structure
- [x] Voicemails table
- [x] Indexes and triggers

### 1.2 Backend API (95%)

- [x] Health check endpoint
- [x] Tenants CRUD (`/api/tenants`)
- [x] Bookings full CRUD + workflows (`/api/bookings`)
- [x] Contacts full CRUD + import/export (`/api/contacts`)
- [x] Resources management (`/api/resources`)
- [x] Notifications + templates (`/api/notifications`)
- [x] Dashboard stats (`/api/dashboard`)
- [x] Calls API with search, filters, analytics (`/api/calls`)
- [x] Voicemails API (`/api/voicemails`)
- [x] Vapi webhooks (`/webhooks/vapi`)
- [x] SignalWire voice routes (`/signalwire`)
- [x] CORS configuration
- [x] Tenant caching

### 1.3 CRM Features (100%)

- [x] Contact lifecycle management
- [x] Phone normalization (E.164)
- [x] Tagging system (single/bulk)
- [x] Notes with types and attribution
- [x] Activity timeline
- [x] Import/export (JSON/CSV)
- [x] Contact merge for duplicates
- [x] Lead status tracking
- [x] Engagement score algorithm (6-factor)
- [x] Engagement level classification (cold/warm/hot/vip)
- [x] Booking creation with confirmation codes
- [x] SMS confirmation queuing
- [x] Resource assignment
- [x] Notification templates

### 1.4 Voice Agent (95%)

- [x] Vapi webhook integration
- [x] Custom voice stack (SignalWire + Deepgram + Groq + Cartesia)
- [x] Dynamic assistant configuration
- [x] System prompt builder (concise responses)
- [x] Intent detection (booking, availability, transfer)
- [x] Groq LLM integration (llama-3.3-70b, qwen, llama-3.1-8b)
- [x] Cartesia TTS integration (female voice - Madison)
- [x] Deepgram STT integration
- [x] Tool: `create_booking` (working)
- [x] Tool: `check_availability` (queries real bookings)
- [x] Tool: `transfer_to_human` (SignalWire transfer)
- [x] Tool: `end_call` (working)
- [x] Voicemail fallback system
- [x] Conversation history tracking
- [x] Call session management
- [x] Escalation trigger detection

### 1.5 Frontend Dashboard (90%)

- [x] Main layout with sidebar navigation
- [x] Dashboard page (health, activity log)
- [x] Contacts page (list, detail, form)
- [x] Calendar page (booking calendar)
- [x] Resources page (list, form)
- [x] Notifications page
- [x] Calls page (list, filters, search)
- [x] Call detail panel (transcript, recording, metadata)
- [x] Analytics page (charts, stats, trends)
- [x] Settings pages (all tabs)
- [x] Setup wizard
- [x] Theme toggle (dark/light)
- [x] Error boundary

### 1.6 DevOps (75%)

- [x] TypeScript configuration
- [x] Development scripts (multiple models)
- [x] Start script with ngrok
- [x] Environment configuration
- [x] Supabase integration
- [x] Docker containerization (API + Dashboard)
- [x] docker-compose.yml
- [x] nginx.conf for production
- [x] Production deployment guide (DEPLOYMENT.md)

---

## PHASE 2: COMPLETED

### 2.1 Voice Agent - Critical Fixes

| Task                                            | Status |
| ----------------------------------------------- | ------ |
| Fix `check_availability` tool - query real data | DONE   |
| Implement `transfer_call` tool                  | DONE   |
| Improve prompt for concise responses            | DONE   |
| Fix voice gender (female voice)                 | DONE   |

### 2.2 Backend API - Gaps

| Task                                    | Status |
| --------------------------------------- | ------ |
| Calls API - list call history           | DONE   |
| Calls API - get call details/transcript | DONE   |
| Calls API - analytics endpoint          | DONE   |
| Voicemails API                          | DONE   |

### 2.3 Frontend - Missing Pages

| Task                                     | Status |
| ---------------------------------------- | ------ |
| Calls page - call history list           | DONE   |
| Calls page - call detail with transcript | DONE   |
| Analytics page - charts and stats        | DONE   |

---

## PHASE 3: IN PROGRESS

### 3.1 Voice Agent Enhancements

| Task                          | Priority | Effort | Status |
| ----------------------------- | -------- | ------ | ------ |
| Voicemail fallback system     | MEDIUM   | 8h     | DONE   |
| Sentiment analysis processing | LOW      | 4h     | TODO   |
| Multi-language support        | LOW      | 6h     | TODO   |
| Custom voice per tenant       | LOW      | 2h     | TODO   |
| A/B testing for greetings     | LOW      | 4h     | TODO   |

### 3.2 CRM Enhancements

| Task                          | Priority | Effort | Status |
| ----------------------------- | -------- | ------ | ------ |
| Engagement score algorithm    | MEDIUM   | 4h     | DONE   |
| Duplicate detection on import | LOW      | 3h     | TODO   |
| Contact segments/lists        | LOW      | 6h     | TODO   |
| Marketing automation          | LOW      | 12h    | TODO   |
| Review request integration    | LOW      | 4h     | TODO   |

### 3.3 Frontend Enhancements

| Task                           | Priority | Effort | Status |
| ------------------------------ | -------- | ------ | ------ |
| Analytics - conversion funnels | MEDIUM   | 6h     | DONE   |
| Analytics - call volume trends | MEDIUM   | 4h     | DONE   |
| Real-time call monitoring      | LOW      | 8h     | TODO   |
| Mobile responsive improvements | LOW      | 4h     | TODO   |
| Bulk actions UI                | LOW      | 4h     | TODO   |

### 3.4 DevOps & Infrastructure

| Task                            | Priority | Effort | Status |
| ------------------------------- | -------- | ------ | ------ |
| Docker containerization         | MEDIUM   | 4h     | DONE   |
| CI/CD pipeline (GitHub Actions) | MEDIUM   | 6h     | TODO   |
| Production deployment guide     | MEDIUM   | 2h     | DONE   |
| Monitoring/alerting setup       | MEDIUM   | 4h     | TODO   |
| Load testing                    | LOW      | 4h     | TODO   |
| Backup/recovery procedures      | LOW      | 3h     | TODO   |

---

## PHASE 4: FUTURE (Post-MVP)

### 4.1 Advanced Features

- [ ] Outbound campaign calling
- [ ] IVR menu builder
- [ ] Call queuing system
- [ ] Agent dashboard (for human agents)
- [ ] Call whisper/barge for supervisors
- [ ] Custom integrations API
- [ ] Zapier/webhook integrations
- [ ] White-label customization portal

### 4.2 Analytics & Reporting

- [ ] Custom report builder
- [ ] Scheduled report delivery
- [ ] Revenue attribution
- [ ] Customer journey mapping
- [ ] Predictive analytics

### 4.3 Enterprise Features

- [ ] SSO/SAML authentication
- [ ] Role-based access control
- [ ] Audit log viewer
- [ ] Data retention policies
- [ ] HIPAA compliance mode
- [ ] Multi-region deployment

---

## Remaining Work Summary

### MEDIUM Priority (Recommended Next)

| Task                      | Effort  |
| ------------------------- | ------- |
| CI/CD pipeline            | 6h      |
| Monitoring/alerting setup | 4h      |
| **Subtotal**              | **10h** |

### LOW Priority (Nice to Have)

| Task                          | Effort  |
| ----------------------------- | ------- |
| Sentiment analysis            | 4h      |
| Multi-language support        | 6h      |
| Custom voice per tenant       | 2h      |
| A/B testing for greetings     | 4h      |
| Duplicate detection on import | 3h      |
| Contact segments/lists        | 6h      |
| Marketing automation          | 12h     |
| Review request integration    | 4h      |
| Real-time call monitoring     | 8h      |
| Mobile responsive             | 4h      |
| Bulk actions UI               | 4h      |
| Load testing                  | 4h      |
| Backup/recovery               | 3h      |
| **Subtotal**                  | **64h** |

### Total Remaining: ~74 hours

---

## Quick Reference

### Start Development

```bash
cd lumentra-api && ./start.sh
```

### Available Models

```bash
./start.sh           # llama-3.3-70b (default, recommended)
./start.sh llama     # llama-3.1-8b (fast, basic)
./start.sh qwen      # qwen3-32b
```

### Docker Deployment

```bash
docker-compose up -d
```

### Key Files

| Purpose            | File                                       |
| ------------------ | ------------------------------------------ |
| System prompt      | `src/services/groq/chat.ts`                |
| Voice tools        | `src/services/groq/tools.ts`               |
| Intent detection   | `src/services/voice/intent-detector.ts`    |
| Voicemail service  | `src/services/voice/voicemail.ts`          |
| Engagement scoring | `src/services/crm/engagement-score.ts`     |
| Tenant config      | `src/routes/tenants.ts`                    |
| Calls API          | `src/routes/calls.ts`                      |
| Analytics hook     | `lumentra-dashboard/hooks/useAnalytics.ts` |

### Test Endpoints

```bash
# Health check
curl http://localhost:3100/health

# List tenants
curl http://localhost:3100/api/tenants

# Dashboard stats
curl -H "X-Tenant-ID: YOUR_ID" http://localhost:3100/api/dashboard/stats

# Call analytics
curl http://localhost:3100/api/calls/analytics/YOUR_TENANT_ID?days=30

# Voicemails
curl -H "X-Tenant-ID: YOUR_ID" http://localhost:3100/api/voicemails

# Contact engagement
curl http://localhost:3100/api/contacts/CONTACT_ID/engagement
```

---

## Dependencies & Services

| Service    | Purpose             | Status                 |
| ---------- | ------------------- | ---------------------- |
| SignalWire | Phone number, calls | Active                 |
| Groq       | LLM inference       | Active                 |
| Deepgram   | Speech-to-text      | Active                 |
| Cartesia   | Text-to-speech      | Active                 |
| Supabase   | Database            | Active                 |
| ngrok      | Local tunnel        | Active (static domain) |

---

## Files Created/Modified in Recent Sessions

### New Files

- `lumentra-api/src/services/voice/voicemail.ts`
- `lumentra-api/src/routes/voicemails.ts`
- `lumentra-api/src/services/crm/engagement-score.ts`
- `lumentra-api/migrations/005_voicemails.sql`
- `lumentra-dashboard/hooks/useCalls.ts`
- `lumentra-dashboard/hooks/useAnalytics.ts`
- `lumentra-dashboard/components/crm/calls/CallsPage.tsx`
- `lumentra-dashboard/components/crm/calls/CallDetail.tsx`
- `lumentra-dashboard/components/crm/analytics/AnalyticsPage.tsx`
- `docker-compose.yml`
- `nginx.conf`
- `DEPLOYMENT.md`
- `lumentra-api/Dockerfile`
- `lumentra-dashboard/Dockerfile`

### Modified Files

- `lumentra-api/src/index.ts` (added voicemail routes)
- `lumentra-api/src/routes/calls.ts` (added analytics endpoint)
- `lumentra-api/src/services/contacts/contact-service.ts` (enhanced engagement scoring)
- `lumentra-api/src/routes/contacts.ts` (added engagement endpoint)
- `lumentra-dashboard/app/page.tsx` (CallsView, AnalyticsView)
- `lumentra-dashboard/next.config.ts` (standalone output)
