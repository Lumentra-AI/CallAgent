# Lumentra Frontend Redesign - Build Plan

## Overview

Redesign the Lumentra frontend for multi-industry front desk workstations with adaptive templates, interactive AI demo on landing page, and human escalation workflow.

---

## Design Decisions

| Decision      | Choice                                                                        |
| ------------- | ----------------------------------------------------------------------------- |
| User Persona  | Front desk employees (clinic, hotel, salon, etc.)                             |
| Adaptability  | Template-based - industry determines layout, no user configuration            |
| Visual Style  | Soft Depth - subtle shadows, rounded corners, warm neutrals, gentle gradients |
| Demo Approach | Floating widget with chat/call toggle + AI-driven visual demonstrations       |
| Setup Flow    | Conversational AI guides setup with animated visual feedback                  |

---

## Tech Stack (Existing)

- Next.js 16 + React 19
- Tailwind CSS 4
- Framer Motion (animations)
- Radix UI + Aceternity UI + Magic UI
- Recharts (data viz)
- Three.js (3D effects)
- Supabase Auth

---

## Architecture

### 1. Industry Template System

```
/templates
  /clinic      → PatientScheduleTemplate
  /hotel       → RoomGridTemplate
  /restaurant  → TableMapTemplate
  /salon       → StylistCalendarTemplate
  /default     → GenericWorkstationTemplate
```

Each template defines:

- Terminology map (contacts→patients, bookings→appointments)
- Primary view layout
- Widget set and positions
- Quick actions
- Color accent

Template selector reads from `tenant.industry` and renders appropriate layout.

### 2. Component Hierarchy

```
AppShell
├── Sidebar (collapsible, industry-aware icons)
├── TopBar (search, notifications, user menu)
└── MainArea
    ├── WorkstationView (industry template)
    │   ├── TodayPanel (schedule/arrivals/reservations)
    │   ├── QuickActions (check-in, book, call)
    │   └── ActivityFeed (live updates)
    └── ContextPanel (slide-in for details)
```

### 3. Escalation Queue System

```
EscalationDock (bottom of screen)
├── QueueBadge (count of waiting calls)
└── QueueDrawer (expandable)
    └── EscalationCard[]
        ├── CallerInfo (name, phone, wait time)
        ├── PriorityIndicator (urgent/normal)
        ├── AISummary (collapsed, expandable)
        └── Actions (take call, callback, dismiss)

EscalationPanel (full context when call taken)
├── ConversationTimeline (AI transcript with timestamps)
├── CallerContext (contact history, past calls)
├── ExtractedIntents (what caller wants)
├── SuggestedActions (AI recommendations)
└── CallControls (mute, transfer, end, notes)
```

### 4. Landing Page Demo Widget

```
LumentraWidget (floating, bottom-right)
├── WidgetToggle (chat/call switch)
├── VoiceSelector (toggle voice styles)
├── ConversationArea
│   ├── MessageBubbles
│   └── VoiceWaveform (when AI speaks)
├── InputArea (text + mic button)
└── DemoOrchestrator (triggers UI demos)

DemoOverlay (fullscreen when AI demonstrates)
├── MockIncomingCall animation
├── MockContactCard animation
├── MockCalendarBooking animation
├── MockDashboardView animation
└── IndustrySimulator (clinic/hotel/etc scenarios)
```

### 5. Setup Flow

```
SetupConversation
├── AIGuide (conversational, animated avatar)
├── SetupCanvas (visual area AI manipulates)
│   ├── IndustryCards (animate in, selectable)
│   ├── BusinessForm (fields appear as AI asks)
│   ├── VoicePreview (sample voices, waveform)
│   └── PhoneConnect (number input, verification)
└── ProgressIndicator (subtle, non-intrusive)
```

---

## Screen Specifications

### Login Screen

- Centered card with soft shadow
- Animated background (subtle particles or gradient shift)
- Logo with gentle glow
- Email/password fields with floating labels
- OAuth buttons (Google, GitHub) with hover effects
- "Talk to Lumentra" mini-widget in corner (demo the product on login page)

### Setup/Onboarding

- Full screen conversational interface
- AI avatar with voice waveform when speaking
- Visual canvas that AI manipulates to show options
- Smooth transitions between steps
- No explicit "steps" - feels like a conversation
- Skip option for power users (goes to manual form)

### Main Workstation (per industry)

**Common elements:**

- Collapsible sidebar (icons when collapsed, labels when expanded)
- Global search (Cmd+K) with smart filtering
- Notification bell with badge
- User avatar dropdown

**Clinic Template:**

- Today's appointments timeline (vertical)
- Current patient card (who's being seen)
- Waiting room count
- Quick book widget
- Doctor availability strip

**Hotel Template:**

- Room grid (floor by floor or status groups)
- Today's arrivals/departures lists
- VIP alerts banner
- Quick check-in widget
- Housekeeping status

**Default Template:**

- Today's schedule list
- Contact quick search
- Recent activity feed
- Quick actions grid
- Stats summary cards

### Profile & Settings

**Profile tab:**

- Avatar upload with crop
- Personal info form
- Notification preferences
- Theme toggle (light/dark/system)
- Language selector

**Settings tabs:**

- Agent: AI personality, greeting, escalation rules
- Voice: TTS voice selection with preview
- Business: Hours, services, resources
- Integrations: Phone, calendar, CRM sync
- Billing: Plan, usage, invoices

### Escalation Queue

- Dock at bottom, shows count badge
- Expands to show queue cards
- Each card: caller name, wait time, priority, 1-line AI summary
- Click card → full escalation panel slides in
- Panel shows complete AI conversation summary
- Suggested responses based on caller intent
- One-click actions: take over, schedule callback, transfer, resolve

---

## Animation Specs

| Element          | Animation                 | Library           |
| ---------------- | ------------------------- | ----------------- |
| Page transitions | Fade + slight slide       | Framer Motion     |
| Card hover       | Lift + shadow increase    | Tailwind + Framer |
| Sidebar collapse | Width + icon morph        | Framer Motion     |
| Voice waveform   | Real-time audio viz       | Canvas API        |
| AI speaking      | Pulsing glow + waveform   | Framer + Canvas   |
| Demo overlays    | Fade in + scale           | Framer Motion     |
| Incoming call    | Slide + pulse             | Framer Motion     |
| Success states   | Confetti or checkmark pop | Framer Motion     |
| Loading states   | Skeleton shimmer          | Magic UI shimmer  |

---

## Data Flow (Frontend)

### Mock Data Strategy (Backend-less)

Create `/lib/mock/` with:

- `mockContacts.ts` - sample contacts per industry
- `mockCalls.ts` - sample call logs with transcripts
- `mockEscalations.ts` - sample escalation queue
- `mockSchedule.ts` - today's bookings/appointments
- `mockDemoScenarios.ts` - scripted AI demo sequences

Use feature flag `USE_MOCK_DATA` to toggle between mock and real API.

### State Management

```
/context
  AuthContext      - user session, tenant
  IndustryContext  - current industry, terminology
  WorkstationContext - today's data, quick actions
  EscalationContext - queue state, active call
  DemoContext      - demo mode, current scenario
```

### API Hooks (prep for backend)

```
/hooks
  useContacts()     - CRUD contacts
  useCalls()        - call history
  useEscalations()  - queue management
  useSchedule()     - today's bookings
  useDemoChat()     - landing page AI chat
  useDemoCall()     - landing page AI call (WebRTC)
```

---

## File Structure

```
/lumentra-dashboard
  /app
    /(auth)
      /login        → redesigned login
      /signup       → redesigned signup
      /setup        → new conversational setup
    /(dashboard)
      /workstation  → new main view (replaces /dashboard)
      /escalations  → escalation queue view
      /contacts     → keep, restyle
      /calls        → keep, restyle
      /settings     → redesigned settings
      /profile      → redesigned profile
    /(marketing)
      /page.tsx     → landing with demo widget

  /components
    /templates
      /clinic       → clinic workstation template
      /hotel        → hotel workstation template
      /restaurant   → restaurant template
      /salon        → salon template
      /default      → fallback template
    /workstation
      /TodayPanel.tsx
      /QuickActions.tsx
      /ActivityFeed.tsx
      /ContextPanel.tsx
    /escalation
      /EscalationDock.tsx
      /EscalationCard.tsx
      /EscalationPanel.tsx
      /AISummary.tsx
    /demo
      /LumentraWidget.tsx
      /VoiceWaveform.tsx
      /DemoOrchestrator.tsx
      /DemoOverlay.tsx
      /IndustrySimulator.tsx
    /setup
      /SetupConversation.tsx
      /AIGuide.tsx
      /SetupCanvas.tsx
    /shell
      /AppShell.tsx
      /Sidebar.tsx
      /TopBar.tsx
      /CommandPalette.tsx
    /ui           → existing, extend as needed
    /aceternity   → existing
    /magicui      → existing

  /lib
    /mock         → mock data generators
    /templates    → template configs
    /terminology  → industry term maps

  /hooks          → data fetching hooks

  /context        → state providers
```

---

## Progress Tracker

### Phase 1: Foundation

- [ ] Design system setup (colors, typography, spacing for Soft Depth)
- [ ] AppShell component (sidebar, topbar, main area)
- [ ] Command palette (Cmd+K search)
- [ ] Template system architecture
- [ ] Mock data layer

### Phase 2: Landing & Demo

- [ ] Landing page redesign
- [ ] LumentraWidget (chat mode)
- [ ] VoiceWaveform component
- [ ] LumentraWidget (call mode with WebRTC prep)
- [ ] DemoOrchestrator (triggers UI animations)
- [ ] DemoOverlay screens (mock incoming call, booking, etc.)
- [ ] IndustrySimulator scenarios

### Phase 3: Auth & Setup

- [ ] Login screen redesign
- [ ] Signup screen redesign
- [ ] SetupConversation flow
- [ ] AIGuide component
- [ ] SetupCanvas with animated reveals

### Phase 4: Workstation

- [ ] Default workstation template
- [ ] Clinic template
- [ ] Hotel template
- [ ] TodayPanel component
- [ ] QuickActions component
- [ ] ActivityFeed component
- [ ] ContextPanel (slide-in details)

### Phase 5: Escalation System

- [ ] EscalationDock component
- [ ] EscalationCard component
- [ ] EscalationPanel (full context view)
- [ ] AISummary component
- [ ] Queue state management

### Phase 6: Settings & Profile

- [ ] Profile page redesign
- [ ] Settings tabs redesign
- [ ] Voice preview component
- [ ] Theme system refinement

### Phase 7: Polish

- [ ] Animation tuning
- [ ] Responsive design (tablet, mobile considerations)
- [ ] Accessibility audit
- [ ] Performance optimization
- [ ] Dark mode refinement

---

## Dependencies to Add

```
@radix-ui/react-command    - command palette
@radix-ui/react-collapsible - sidebar
react-use-measure          - responsive animations
usehooks-ts                - utility hooks
class-variance-authority   - already have, ensure updated
```

---

## Design Tokens

```css
/* Soft Depth palette */
--bg-primary: #fafafa (light) / #1a1a1a (dark) --bg-secondary: #f5f5f5 / #242424
  --bg-elevated: #ffffff / #2a2a2a --border: #e5e5e5 / #333333 --shadow-soft: 0
  2px 8px rgba(0, 0, 0, 0.04) --shadow-medium: 0 4px 16px rgba(0, 0, 0, 0.08)
  --radius-sm: 8px --radius-md: 12px --radius-lg: 16px /* Industry accents */
  --clinic-accent: #10b981 (green) --hotel-accent: #8b5cf6 (purple)
  --restaurant-accent: #f59e0b (amber) --salon-accent: #ec4899 (pink)
  --default-accent: #3b82f6 (blue);
```

---

## Notes

- All screens must work without backend initially (mock data)
- AI chat/call on landing uses existing `/api/chat` endpoint
- WebRTC for browser-based calling needs research (SignalWire browser SDK or Twilio Client)
- Escalation queue will need WebSocket for real-time updates (future backend work)
- Keep existing CRM pages (contacts, calls, analytics) but restyle to match new design system
