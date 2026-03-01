# Lumentra - Work Log

**Developer:** Project Developer
**Period:** January 9, 2026 - February 26, 2026 (49 calendar days)
**Total commits:** 132
**Estimated total hours:** ~370 hours (200+ in January, 160+ in February)

---

## Summary

| Category                                                     | Hours (est.) |
| ------------------------------------------------------------ | ------------ |
| On-site work (office setup, procurement, meetings, planning) | ~80h         |
| Backend API + database schema                                | ~60h         |
| Voice pipeline engineering + debugging + call testing        | ~75h         |
| Dashboard frontend (150+ components)                         | ~55h         |
| Infrastructure, CI/CD, deployment                            | ~20h         |
| Third-party service research, account setup, API integration | ~30h         |
| Voice call testing and manual QA                             | ~25h         |
| Communication, planning, documentation                       | ~25h         |
| **Total**                                                    | **~370h**    |

---

## January 2026 (~200+ hours)

Throughout January, work days were approximately 10:00 AM - 7:00/9:00 PM (9-11 hour days). This included significant on-site non-coding work: office setup, equipment procurement/shopping, meetings, planning sessions, and other operational tasks alongside software development.

### Week 1: January 6-10 (Mon-Fri) - ~50 hours

- Office setup, initial planning, requirements gathering
- Equipment and supply procurement/shopping
- Project structure design and architecture decisions
- Initial monorepo import - API scaffold (Hono/TypeScript), dashboard scaffold (Next.js 16)
- TypeScript configs, build tooling setup
- 1 commit (Jan 9)

### Week 2: January 13-17 (Mon-Fri) - ~50 hours

- Continued office/operational tasks
- Documentation and README files (1 commit Jan 11, weekend work)
- Supabase project creation and database configuration
- Third-party account setup: SignalWire, Deepgram, Cartesia, OpenAI, Groq, Gemini
- Voice AI architecture research (evaluating providers)
- STT comparison: Deepgram vs AssemblyAI vs Whisper
- TTS comparison: Cartesia vs ElevenLabs vs PlayHT
- LLM provider evaluation for real-time voice latency
- SignalWire account setup and phone number provisioning
- Built full CRM suite: contacts, resources, notifications, calendar (1 commit Jan 15)
- Database schema design for multi-tenant CRM

### Week 3: January 20-24 (Mon-Fri) - ~50 hours

- Continued on-site duties and meetings
- Voice agent architecture design
- LLM intent detection prototyping
- SignalWire WebSocket streaming research and testing
- Deepgram real-time transcription integration
- Cartesia TTS streaming integration
- Early voice pipeline testing and iteration
- Hotel demo scenario design

### Week 4: January 25-31 - ~55+ hours

**January 25 (Saturday) - ~6 hours**

- LLM-based intent detection engine
- Hotel demo voice agent configuration
- 3 commits

**January 26-27 (OVERNIGHT SESSION) - ~24 hours continuous**

- Worked from Jan 26 1:25 PM through Jan 27 4:24 PM
- Jan 26: CI/CD pipeline, git hooks, voice agent platform with SignalWire, frontend redesign, landing page demo widget
- Jan 27: Theme toggler, lint fixes, React 19 compatibility, CRM data tables, Supabase auth, multi-tenant dashboard, command palette, breadcrumbs, mobile nav, live API wiring
- 22 commits across both days

**January 28 (Tuesday) - ~9 hours (in-office)**

- Escalation queue feature
- Promotions and special offers module
- Connected CRM pages to real API
- Voicemail management page
- 4 commits

**January 29 (Wednesday) - ~9 hours (in-office)**

- Call history page with transcript viewer
- Complete settings page with all configuration tabs
- Booking confirmation and pending bookings workflow
- Migrated deployment from Coolify to Hetzner
- Voice personality settings with preview
- Twilio SMS integration
- Notification system with live badge updates
- 10 commits

**January 30-31 (Thursday-Friday) - ~18 hours (in-office)**

- Voice pipeline streaming design and implementation
- Deepgram transcriber refactoring (file modified Jan 30)
- Sentence buffer for TTS (file modified Jan 30)
- Hetzner deployment and server configuration
- Production infrastructure setup and testing
- No commits (R&D and infrastructure work)

---

## February 2026 (~160+ hours)

### Week 5: February 1-7 - ~65+ hours

**February 1 (Saturday) - ~12 hours (1:51 PM - 9:52 PM)**

- Complete multi-step setup wizard (8 steps)
- Self-hosted PostgreSQL migration with connection pooling
- Tenant onboarding API endpoints
- Phone number provisioning via SignalWire API
- Google Calendar and Outlook OAuth integration
- 17 commits

**February 2 (Sunday) - ~12 hours (12:52 PM - 9:08 PM)**

- Auth callback routing fixes
- Calendar integration debugging
- Google Calendar sync with proper event mapping
- Setup wizard data persistence
- Redesigned assistant settings
- Custom instructions feature
- 8 commits

**February 3 (Monday) - ~10 hours (5:45 PM - 11:07 PM)**

- SIP trunk configuration
- Phone config encryption
- Database connection rebuild with PG pool
- Scheduled cron jobs
- Conversation logging for training data
- Auth middleware refactor
- 8 commits

**February 4 (Tuesday) - ~14 hours (started before 12:18 PM, 28 commits)**

- Built complete custom voice pipeline from scratch
- Production-grade audio pipeline with state machine
- OpenAI tool call compatibility
- Voice conversation flow and cleanup
- Barge-in false positive prevention
- Switched to nova-2-phonecall STT model
- Tested all LLM providers with live calls
- Vapi-inspired turn-taking with greedy cancel
- Extensive manual voice call testing
- 28 commits (heaviest single day)

**February 5 (Wednesday) - ~6 hours**

- Voice call testing and quality iteration
- Audio pipeline debugging
- No commits

**February 6 (Thursday) - ~8 hours (12:20 PM - 4:06 PM + prep)**

- Trimmed to 7 core industries
- Auth redirect fixes, SIP trunk in setup wizard
- Hero section redesign with retro terminal
- 5 commits

**February 7 (Friday) - ~4 hours**

- Continued testing and polish
- No commits

### Week 6: February 8-14 - ~40+ hours

**February 8-10 (Sat-Mon) - ~15 hours**

- Industry presets refactoring (file modified Feb 10)
- Setup wizard updates (file modified Feb 9)
- App layout updates (file modified Feb 9)
- Type system updates (file modified Feb 10)
- Voice pipeline testing
- No commits

**February 11 (Tuesday, OVERNIGHT) - ~16 hours (1:22 AM - 2:31 PM)**

- Started after midnight, worked into afternoon
- Dynamic industry terminology threaded through entire UI
- Settings page data persistence fix (DB as single source of truth)
- Fixed greedy cancel death loop (critical voice bug)
- Voice pipeline resilience improvements
- EscalationDock collapsible UI
- 6 commits

**February 12-14 - ~12 hours**

- Ongoing voice quality testing
- Debugging and iteration
- No commits

### Week 7-8: February 15-22 - ~30+ hours

- Production readiness audit and security review (audit dated Feb 18)
- Voice route and Vapi route code review (files modified Feb 18)
- Voice quality testing and debugging
- Client communication and demo preparation
- No commits

### Week 9: February 23-28 - ~25+ hours

**February 23 (Sunday) - ~6 hours**

- Voice latency improvements, fallback chain fixes
- CI build fix
- Setup wizard routing fixes
- TTS completion drift fix
- 5 commits

**February 24 (Monday) - ~4 hours**

- Voice quality testing
- Debugging, preparing next fixes
- No commits

**February 25 (Tuesday) - ~8 hours**

- Duplicate turn processing prevention
- Groq gpt-oss-20b as default for low-latency
- Outbound stream audio fix
- Dialog memory and anti-repetition
- Provider timeouts
- Extensive voice call testing between each fix
- 9 commits

**February 26 (Wednesday) - ~6 hours**

- Phone normalization for contact capture
- Long call stabilization with codec-safe silence
- Speech-end fallback tightening
- Voice turn segmentation improvements
- Multiple test calls per fix
- 4 commits

---

## Hours Estimation Methodology

Hours are estimated using multiple data sources:

1. **Office attendance** - January involved full on-site workdays (10 AM - 7/9 PM), including non-coding work such as office setup, equipment procurement, meetings, and planning.
2. **Git commit timestamps** - First and last commit of each day establishes minimum coding window.
3. **File modification timestamps** - Confirms work on days without commits (Jan 30, Jan 31, Feb 9, Feb 10, Feb 18).
4. **Overnight sessions** - Jan 26-27 and Feb 11 show commits spanning midnight, indicating continuous work sessions.
5. **Voice testing overhead** - Each voice pipeline fix requires multiple live phone calls to validate. A single fix often needed 5-10 test calls, each taking 2-5 minutes plus debugging time. This produces zero commits.
6. **Research and integration** - Setting up 9+ third-party service accounts, reading API documentation, evaluating providers, and designing architecture all require significant time before any code is written.
7. **Commit density** - Feb 4 had 28 commits in a recorded 5.5-hour window. This level of output strongly indicates work started well before the first commit.

The 370-hour estimate reflects total time invested in the project, including on-site non-coding work. At the agreed compensation of $2,000, this equates to approximately $5.40/hour.

---

## Late February - March 2026: LiveKit Migration + Security

### February 28 (Friday) - LiveKit Deployment

- Deployed full LiveKit stack to Hetzner (Redis, LiveKit Server v1.9, SIP Bridge, Python Agent)
- Configured SignalWire SIP Gateway pointing to server
- Fixed multiple agent crashes: missing `await ctx.connect()`, removed Cloud-only features (`aec_warmup_duration`, `noise_cancellation.BVCTelephony()`), fixed `context.agent` -> `context.session.current_agent`
- Opened firewall ports (5060, 7880-7881, 10000-20000, 50000-60000)
- Registered SIP trunk and dispatch rule with LiveKit
- Successfully completed first test call (STT, LLM, TTS all working)
- Commits: `390fcba`, `370e3e7`

### March 1 (Saturday) - Security Hardening + Bug Fixes

- Discovered SIP scanners bombarding port 5060 (calls every ~30 seconds from 3 different attacker IPs)
- Restricted SIP port to 15 SignalWire IPs on both Hetzner cloud firewall and UFW
- Also restricted RTP ports (10000-20000) to SignalWire IPs
- Hardened SSH: disabled password auth, set root login to key-only
- Restricted admin ports (3100, 7880, 8000) to admin IP subnet
- Blocked unused ports (6001, 6002, 8080)
- Locked file permissions on all secret files (chmod 600)
- Fixed `call_logger.py`: `session.chat_ctx.items` -> `session.history.messages` (v1.4 API)
- Fixed call duration: added `started_at` tracking in `agent.py`
- Fixed Dockerfile: added `RUN python agent.py download-files` to bake turn detector model into image
- Changed all services to `restart: always`
- Rebuilt and deployed agent

### March 1 (Saturday, afternoon) - LLM Testing + Handoff Prep

- Tested Groq Llama 3.3 70B as primary LLM -- went mute after 2 turns due to free tier rate limit (12,000 TPM, system prompt is 5,600 tokens)
- Researched 9+ LLM providers for voice agent use case (Groq, Cerebras, Together AI, Fireworks, SambaNova, OpenAI, Gemini, DeepSeek, Anthropic)
- Researched GPT-5 family -- too slow for voice (reasoning overhead adds latency)
- Switched to OpenAI gpt-4.1-mini (stable, $0.015/call)
- Tested GPT-4.1-nano -- too dumb for 5.6k token system prompt (hallucinated policies, ignored greeting config, terse responses)
- Switched back to gpt-4.1-mini as final production LLM
- Added RLS defense-in-depth migration (`app_api` role with tenant isolation policies)
- Added `tenantQuery()` functions to API for database-level tenant isolation
- Tuned voice agent for more human-like responses (TTS speed 0.95, emotion Content, endpointing delays)
- Updated all handoff documentation to reflect current system state
- Commit: `ba680d6`
