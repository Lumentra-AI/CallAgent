# Lumentra Voice Agent Management Guide

Version 2.0 -- March 2026

---

## Table of Contents

1. [Voice Agent Overview](#1-voice-agent-overview)
2. [Voice Agent Architecture Deep Dive](#2-voice-agent-architecture-deep-dive)
3. [Configuring Agent Personality](#3-configuring-agent-personality)
4. [Industry-Specific Configuration](#4-industry-specific-configuration)
5. [Custom Instructions](#5-custom-instructions)
6. [Capabilities Management](#6-capabilities-management)
7. [Voice Settings](#7-voice-settings)
8. [Call Flow Configuration](#8-call-flow-configuration)
9. [Tool Configuration](#9-tool-configuration)
10. [Speech-to-Text Configuration](#10-speech-to-text-configuration)
11. [Text-to-Speech Configuration](#11-text-to-speech-configuration)
12. [LLM Configuration](#12-llm-configuration)
13. [Turn Detection and Endpointing](#13-turn-detection-and-endpointing)
14. [SIP Trunk Configuration](#14-sip-trunk-configuration)
15. [LiveKit Integration](#15-livekit-integration)
16. [System Prompt Engineering](#16-system-prompt-engineering)
17. [Tool Execution Deep Dive](#17-tool-execution-deep-dive)
18. [Call Logging and Analytics](#18-call-logging-and-analytics)
19. [Error Handling and Fallbacks](#19-error-handling-and-fallbacks)
20. [Multi-Language Support](#20-multi-language-support)
21. [Operating Hours and After-Hours](#21-operating-hours-and-after-hours-behavior)
22. [Call Transfer and Escalation](#22-call-transfer-and-escalation-rules)
23. [Greeting and Farewell Customization](#23-greeting-and-farewell-customization)
24. [Agent Personality Tuning](#24-agent-personality-tuning)
25. [Performance Optimization](#25-performance-optimization)
26. [Security Considerations](#26-security-considerations)
27. [Troubleshooting Voice Issues](#27-troubleshooting-common-voice-issues)
28. [Testing the Agent](#28-testing-the-agent)
29. [Monitoring Performance](#29-monitoring-performance)
30. [Appendix A: Configuration Reference](#30-appendix-a-complete-configuration-reference)
31. [Appendix B: Sample System Prompts](#31-appendix-b-sample-system-prompts-for-each-industry)
32. [Appendix C: Glossary](#32-appendix-c-glossary-of-voice-ai-terms)

---

## 1. Voice Agent Overview

### What is the Lumentra Voice Agent?

The Lumentra voice agent is an AI-powered phone receptionist that answers inbound calls for your business 24/7. It handles reservations, appointments, orders, and general inquiries -- speaking naturally like a human receptionist, not a robotic script reader. The agent is built on a multi-tenant architecture, meaning a single deployment serves many businesses simultaneously, each with its own personality, voice, greetings, industry-specific behavior, and custom instructions.

Unlike traditional IVR systems that force callers through rigid menu trees ("Press 1 for reservations, press 2 for hours..."), the Lumentra agent engages in free-form natural conversation. A caller can say "I need a table for four tonight around seven" and the agent will understand the intent, check availability, gather any missing details, and complete the booking -- all in a single fluid conversation.

The agent is designed to be indistinguishable from a well-trained human receptionist. It uses contractions, casual acknowledgments like "Got it" and "Sure", and avoids robotic phrases like "I apologize for the inconvenience." It tracks conversation state so it never re-asks for information the caller already provided. It handles interruptions gracefully, matches the caller's energy level, and knows when to slow down for important details like confirmation codes.

Every aspect of the agent is configurable per tenant: the voice it speaks with, the speed and emotional tone, the greeting messages, operating hours awareness, escalation behavior, personality traits, and the specific business knowledge it has access to. This guide covers every configuration option in detail.

### How Calls Flow Through the System

When a customer calls your business number, the call travels through several stages before the caller hears a greeting:

```
Customer dials your number
        |
        v
SignalWire SIP Trunk (receives the call)
        |
        v
LiveKit SIP Service (bridges telephony to real-time media)
        |
        v
LiveKit Room Created (one room per call)
        |
        v
Lumentra Voice Agent Joins the Room
        |
        v
Agent fetches tenant config from API
        |
        v
Voice pipeline starts: STT + LLM + TTS
        |
        v
Agent greets the caller
```

Each stage in this pipeline is optimized for minimal latency. The total time from the moment the call connects to when the caller hears the first greeting word is typically under 1.5 seconds. This is achieved through several techniques: VAD model prewarming during process startup, in-memory tenant configuration caching, preemptive LLM generation, and streaming TTS that begins speaking before the full response is generated.

### Key Components at a Glance

| Component     | Technology          | Purpose                   |
| ------------- | ------------------- | ------------------------- |
| SIP Trunk     | SignalWire          | Receives phone calls      |
| Media Server  | LiveKit             | Real-time audio routing   |
| SIP Bridge    | LiveKit SIP         | Telephony-to-WebRTC       |
| Agent Runtime | LiveKit Agents v1.4 | Python agent framework    |
| STT           | Deepgram nova-3     | Speech recognition        |
| LLM           | OpenAI gpt-4.1-mini | Conversation intelligence |
| TTS           | Cartesia Sonic-3    | Voice synthesis           |
| VAD           | Silero VAD          | Voice activity detection  |
| Turn Detect   | Multilingual Model  | End-of-turn prediction    |
| Noise Cancel  | BVCT Telephony      | Echo/noise removal        |
| API           | Hono (Node.js)      | Config + tool execution   |
| Database      | Supabase PostgreSQL | Persistent storage        |
| Cache         | In-memory Map       | Fast tenant lookup        |

### What the Agent Can Do

The voice agent ships with six built-in tools that it can invoke during a conversation. Each tool maps to a real business action:

| Tool               | What It Does                  |
| ------------------ | ----------------------------- |
| check_availability | Queries open time slots       |
| create_booking     | Creates confirmed appointment |
| create_order       | Places pickup/delivery order  |
| transfer_to_human  | SIP REFER to human staff      |
| end_call           | Graceful call termination     |
| log_note           | Saves caller notes to CRM     |

These tools are executed server-side through the internal API. The Python agent sends a tool request to the Node.js API, which validates the input, executes the database operation, and returns a natural-language result that the agent speaks to the caller. This architecture ensures that business logic lives in one place and the agent never has direct database access.

---

## 2. Voice Agent Architecture Deep Dive

### Component Architecture

The Lumentra voice agent consists of three primary layers that work together to handle phone calls. Understanding this architecture is essential for effective configuration and troubleshooting.

**Layer 1: Telephony Layer (SignalWire + LiveKit SIP)**

The telephony layer handles the connection between the public telephone network (PSTN) and the digital media pipeline. When someone dials your business phone number, SignalWire receives the call on a SIP trunk and forwards it to the LiveKit SIP service. LiveKit SIP creates a new room for each call and bridges the audio from the telephone network into a WebRTC-compatible format. This bridge translates between the narrow-band audio of telephone calls (8kHz mulaw) and the wider-band audio used internally (16kHz+ PCM).

The SIP trunk is responsible for number provisioning, call routing, and PSTN connectivity. It receives the SIP INVITE from the carrier, extracts metadata about the call (caller number, dialed number), and forwards the audio stream to LiveKit. The trunk also handles outbound operations like SIP REFER for call transfers.

**Layer 2: Agent Layer (Python LiveKit Agents)**

The agent layer is a Python process running the LiveKit Agents SDK v1.4. When a new call arrives, the agent server dispatches the entrypoint function, which connects to the LiveKit room, waits for the SIP participant (the caller) to join, extracts the dialed number and caller phone from SIP attributes, and fetches the tenant configuration from the API. It then starts an AgentSession with the configured STT, LLM, TTS, and VAD plugins.

The LumentraAgent class extends the base Agent class and holds a reference to the tenant configuration, the caller phone number, and the job context. When the agent enters the conversation (via the on_enter method), it generates the initial greeting using the tenant's configured greeting message.

The agent layer also manages the call duration watchdog, metrics collection, and call logging. These responsibilities are handled through asyncio tasks and shutdown callbacks registered on the job context.

**Layer 3: API Layer (Node.js Hono)**

The API layer runs on Node.js using the Hono framework. It serves two main purposes for the voice agent: providing tenant configuration at call start, and executing tool calls during the conversation. The API authenticates agent requests using a shared INTERNAL_API_KEY passed as a Bearer token. It maintains an in-memory cache of tenant configurations that refreshes every 5 minutes, ensuring that tenant lookups during incoming calls complete in microseconds rather than the 20-50ms a database query would take.

The API also handles post-call processing: creating call records, linking contacts, and triggering automation workflows like deal creation and task assignment.

### Data Flow: A Complete Call

To understand how all components interact, let us trace a complete call from start to finish.

**Phase 1: Call Arrival (0-500ms)**

1. Customer dials your business number
2. SignalWire receives the call on the SIP trunk
3. SignalWire sends a SIP INVITE to the LiveKit SIP service
4. LiveKit SIP creates a room and joins the caller as a SIP participant
5. LiveKit dispatches the call to an available agent worker with agent_name "lumentra-voice-agent"

**Phase 2: Agent Initialization (500-1000ms)**

6. The entrypoint function runs: ctx.connect() joins the agent to the room
7. ctx.wait_for_participant() resolves with the SIP participant
8. The agent extracts sip.trunkPhoneNumber (dialed number) and sip.phoneNumber (caller number) from participant attributes
9. get_tenant_by_phone() calls the internal API at /internal/tenants/by-phone/{phone}
10. The API looks up the tenant in the in-memory cache (O(1) lookup), builds the system prompt using buildSystemPrompt(), and returns the complete tenant configuration including voice_config, greetings, operating hours, and escalation settings

**Phase 3: Pipeline Start (1000-1500ms)**

11. Agent creates the LLM instance (OpenAI gpt-4.1-mini, temperature 0.8)
12. Agent creates the AgentSession with all configured plugins
13. session.start() begins the voice pipeline with noise cancellation enabled
14. The on_enter method fires, calling session.generate_reply() with the greeting instruction
15. The LLM generates the greeting text, TTS converts it to audio, and the caller hears the greeting

**Phase 4: Conversation Loop (1500ms onwards)**

16. Caller speaks -- audio flows through noise cancellation, then to Deepgram STT
17. Deepgram streams interim transcripts, then delivers a final transcript
18. The turn detector and VAD determine when the caller has finished speaking
19. The final transcript is sent to the LLM along with the full conversation history and system prompt
20. The LLM generates a response (possibly including tool calls)
21. If tool calls are present, the agent executes them via the internal API and feeds results back to the LLM
22. The LLM's text response streams to Cartesia TTS, which streams audio back to the caller
23. Steps 16-22 repeat until the call ends

**Phase 5: Call Termination**

24. The call ends in one of several ways: caller hangs up, agent calls end_call tool, transfer to human, or duration limit reached
25. The on_shutdown callback fires, collecting usage metrics
26. log_call() extracts the transcript from session history, detects the outcome type, builds a summary, and posts everything to /internal/calls/log
27. The API creates a call record in the database, auto-creates or links a contact record, and triggers post-call automation (deal creation, task assignment, status updates)

### Latency Budget

Every millisecond matters in voice conversations. A response that takes more than 1.5 seconds feels unnatural. Here is the latency budget for a typical conversational turn:

| Phase           | Target       | What Happens              |
| --------------- | ------------ | ------------------------- |
| STT Processing  | 200-400ms    | Deepgram transcribes      |
| Turn Detection  | 50-100ms     | End-of-turn prediction    |
| Endpointing     | 800ms min    | Wait for caller to finish |
| LLM First Token | 200-500ms    | GPT inference begins      |
| TTS First Audio | 100-200ms    | Cartesia generates speech |
| Network         | 50-100ms     | Round-trip latency        |
| **Total**       | **1.4-2.1s** | **End-to-end turn**       |

The system uses several techniques to minimize perceived latency:

- **Preemptive generation** starts LLM inference before the turn detector is fully confident the caller has finished, reducing wait time at the cost of occasionally discarding a response if the caller continues speaking.

- **Streaming TTS** means the caller begins hearing the response as soon as the first few words are generated, rather than waiting for the complete response.

- **Resume false interruption** detects when a brief noise or backchannel ("uh huh") incorrectly triggered an interruption and automatically resumes the agent's response.

### Connection Pooling and Shared Resources

The agent process prewarms expensive resources during startup to avoid cold-start latency on the first call. The prewarm function loads the Silero VAD model into memory and stores it in proc.userdata, where it is shared across all calls handled by that process.

The httpx.AsyncClient used for internal API calls is a singleton shared across all calls, reusing TCP connections across multiple tool invocations. It is configured with a 10-second timeout to prevent tool calls from blocking indefinitely.

On the API side, the tenant cache is initialized once at startup with a full database scan, then refreshed every 5 minutes. The cache is keyed by normalized phone number for O(1) lookup, with additional keys by tenant ID for other access patterns.

---

## 3. Configuring Agent Personality

### Overview

The agent personality controls how your voice agent speaks, how much detail it provides, and how it emotionally engages with callers. These settings directly influence the system prompt that governs the agent's behavior during every call. The personality is stored as a JSONB object in the tenant record with three fields: tone, verbosity, and empathy.

### Personality Fields

**Tone** controls the overall speaking style:

| Tone Value   | Prompt Instruction     |
| ------------ | ---------------------- |
| professional | Businesslike demeanor  |
| friendly     | Warm and approachable  |
| casual       | Relaxed, like a friend |
| formal       | Proper etiquette       |

When tone is set to "professional", the system prompt receives: "Maintain a professional and businesslike demeanor." When set to "friendly", it receives: "Be warm, friendly, and approachable while remaining professional." When set to "casual", it receives: "Keep things casual and relaxed, like talking to a friend." When set to "formal", it receives: "Use formal language and maintain proper etiquette."

**Verbosity** controls response length:

| Verbosity | Prompt Instruction    |
| --------- | --------------------- |
| concise   | 1-2 sentences max     |
| balanced  | Enough detail to help |
| detailed  | Thorough explanations |

The concise setting adds: "Keep responses brief and to the point. One or two sentences when possible." The balanced setting adds: "Provide enough detail to be helpful without being overly wordy." The detailed setting adds: "Provide thorough explanations and details when helpful."

**Empathy** controls emotional engagement:

| Empathy | Prompt Instruction          |
| ------- | --------------------------- |
| high    | Validates emotions strongly |
| medium  | Acknowledges situations     |
| low     | Focuses on efficiency       |

High empathy adds: "Show strong empathy. Acknowledge emotions and validate concerns." Medium adds: "Be understanding and acknowledge the caller's situation." Low adds: "Focus on efficiency and getting things done."

### How Personality Maps to the System Prompt

The buildSystemPrompt function reads the personality object and appends behavior instructions. Each combination creates a distinct conversational style. For example, a hotel front desk might use:

```json
{
  "tone": "friendly",
  "verbosity": "concise",
  "empathy": "medium"
}
```

This generates prompt instructions like:

- "Be warm, friendly, and approachable while remaining professional"
- "Keep responses brief and to the point. One or two sentences when possible"
- "Be understanding and acknowledge the caller's situation"

A medical office might instead use:

```json
{
  "tone": "professional",
  "verbosity": "balanced",
  "empathy": "high"
}
```

Which generates:

- "Maintain a professional and businesslike demeanor"
- "Provide enough detail to be helpful without being overly wordy"
- "Show strong empathy. Acknowledge emotions and validate concerns"

### Choosing the Right Personality

| Industry     | Tone         | Verbosity | Empathy |
| ------------ | ------------ | --------- | ------- |
| Hotel        | friendly     | concise   | medium  |
| Restaurant   | friendly     | concise   | medium  |
| Medical      | professional | balanced  | high    |
| Dental       | professional | balanced  | medium  |
| Salon        | friendly     | balanced  | medium  |
| Auto Service | professional | concise   | medium  |

### Personality Anti-Patterns

| Combination           | Problem                |
| --------------------- | ---------------------- |
| formal + detailed     | Sounds like legal docs |
| casual + low empathy  | Sounds dismissive      |
| formal + high empathy | Contradicts itself     |
| casual + detailed     | Rambles aimlessly      |

### Real-World Personality Examples

**Luxury Hotel (friendly + concise + medium)**

Caller: "Hi, do you have any rooms available this weekend?"
Agent: "Let me check this weekend for you. King or two queens?"

The agent is warm but efficient. It immediately moves to gather the missing information (room type) without unnecessary preamble.

**Medical Office (professional + balanced + high)**

Caller: "I've been having terrible headaches for a week."
Agent: "I'm sorry to hear that. Let me get you scheduled with a doctor. Are you an existing patient with us?"

The agent acknowledges the caller's discomfort (high empathy) while staying professional and moving toward the actionable next step (balanced verbosity).

**Casual Restaurant (casual + concise + medium)**

Caller: "Hey, can I get a table for tonight?"
Agent: "Sure! How many people and what time?"

Relaxed and direct. Sounds like a friendly host picking up the phone during a busy shift.

### Changing Personality Settings

Personality changes take effect on the next call. The tenant cache refreshes every 5 minutes, so after saving new personality settings in the dashboard, allow up to 5 minutes before the change propagates. Alternatively, the cache can be invalidated immediately through the API for instant updates.

---

## 4. Industry-Specific Configuration

### Supported Industries

Lumentra supports seven industries with tailored prompt configurations. Each industry gets specialized terminology, role descriptions, critical rules, booking flows, and FAQ sections automatically injected into the system prompt.

| Industry     | Transaction Term | Customer Term |
| ------------ | ---------------- | ------------- |
| hotel        | Reservation      | Guest         |
| motel        | Reservation      | Guest         |
| restaurant   | Reservation      | Guest         |
| medical      | Appointment      | Patient       |
| dental       | Appointment      | Patient       |
| salon        | Appointment      | Client        |
| auto_service | Appointment      | Customer      |

Any industry not in this list falls back to the generic configuration using "Booking" and "Customer" as default terms.

### Medical Practice Configuration

Medical practices receive the most restrictive rules due to HIPAA compliance and patient safety. The agent is instructed to:

- Never provide medical advice, diagnoses, or treatment recommendations
- Never discuss specific medications, dosages, or drug interactions
- Immediately direct emergency callers to call 911
- Handle prescription refill requests by taking messages only
- Always confirm patient full name and date of birth before booking
- Use HIPAA-compliant language -- never discuss medical details aloud
- For test results, offer to take a message for the doctor to call back

The medical booking flow follows a specific sequence:

1. Determine new vs. existing patient
2. Ask which provider (if multiple)
3. Ask reason for visit (general category only: checkup, follow-up, concern)
4. Check availability and offer times
5. Confirm patient name, date of birth, date and time
6. Remind: arrive 15 minutes early, bring insurance card, list of medications

Medical FAQ handling covers insurance acceptance ("most major plans"), office hours, new patient forms ("arrive 15 minutes early or download from website"), and cancellation policy ("24 hours notice required").

### Dental Practice Configuration

Dental practices share many rules with medical but include dental-specific behavior:

- Offer same-day emergency appointments for severe pain, knocked-out teeth, or swelling
- Never provide dental advice or diagnoses over the phone
- Cost disclaimer: "estimates vary based on insurance and individual needs"

Dental booking flow:

1. Determine routine cleaning vs. specific concern
2. New vs. existing patient
3. Check availability and offer times
4. Confirm patient name, appointment date and time
5. Remind to arrive 10 minutes early with insurance card

### Hotel Configuration

Hotels receive extensive state-tracking and conversational intelligence rules. The system prompt instructs the agent to track collected information:

- Check-in date (if they said "tomorrow", you have it)
- Number of nights
- Number of guests (if they said "just me", that is 1)
- Room type
- Guest name

The agent must never re-ask for information already provided. Hotels also get detailed rules for handling confusing responses:

- Single word like "Thomas" when asked about dates: They gave their name early. Say "Got it, Thomas. And what dates are you looking at?"
- "Yes" with no context: Confirm what they agreed to. "Great, so one night?"
- Silence or "hello?": They may not have heard. Briefly repeat the question.
- Frustration or profanity: Stay calm. "I hear you. Let me help -- when do you need the room?"

Transfer rules for hotels are strict: only transfer when the caller explicitly asks for a "human", "real person", "manager", or says they want to complain. Frustration, confusion, and rudeness do not trigger transfers -- the agent stays calm and keeps helping.

The hotel booking flow is flexible and natural:

1. Dates (skip if already mentioned)
2. Nights (only if unclear from dates)
3. Guests (skip if they said "just me")
4. Room type ("King or two queens?")
5. Check availability and quote rate
6. Name for the reservation
7. Quick recap and confirmation code

Hotel FAQ: check-in 3 PM, checkout 11 AM, free parking, free WiFi, cancel free up to 24 hours before, pet-friendly rooms available (ask about fees).

### Restaurant Configuration

Restaurants receive similar state-tracking rules, with the agent tracking date, time, party size, name, and special occasion. If someone says "table for five today at 11", the agent has date, time, and party size and moves directly to checking availability.

Restaurant booking flow:

1. Date and time (skip if already mentioned)
2. Party size (skip if already mentioned)
3. Check availability using check_availability tool
4. Name (always ask caller to spell it)
5. Special occasion (birthday, anniversary)
6. Confirm all details back
7. Call create_booking (mandatory before saying "you're all set")
8. Provide confirmation code from tool result
9. Mention: "Please arrive on time, we hold reservations for 15 minutes"

Restaurant FAQ: hours from config, dress code (smart casual), parking from location, private events (take number for events coordinator), menu (seasonal, check website), takeout (offer if available), delivery (mention delivery apps if not direct).

Large party handling: For groups of 8 or more, the agent mentions it may need to check with the kitchen. Walk-in inquiries are directed to reservations: "we accept them based on availability but reservations are recommended."

### Salon Configuration

Salons ask about the specific service (haircut, color, highlights, nails), preferred stylist, and mention approximate service duration. The booking flow:

1. Which service ("What service are you looking to book?")
2. Preferred stylist or next available
3. Check availability and offer times
4. Name for the appointment
5. Confirm: name, service, stylist, date and time
6. Remind to arrive 5-10 minutes early

Salon FAQ: walk-ins based on availability but appointments recommended, 24-hour cancellation notice required, professional salon products available.

### Auto Service Configuration

Auto service shops gather vehicle-specific information:

1. What service is needed (oil change, tire rotation, brake inspection)
2. Vehicle year, make, and model
3. Specific concerns or warning lights
4. Check availability and offer times
5. Name for the appointment
6. Confirm: name, vehicle, service, date and time
7. Remind to bring keys and relevant paperwork

Auto FAQ: free estimates available, ask about service warranty, most routine services 30-60 minutes, waiting area available.

### Generic / Unsupported Industries

Industries not in the supported list use a generic configuration with general-purpose rules: be helpful and professional, take messages when unable to help directly, confirm important details by repeating them back. The generic booking flow is: understand the need, ask relevant questions, check availability if applicable, confirm all details, provide confirmation.

You can compensate for the lack of industry-specific rules by providing detailed custom instructions (see Section 5).

---

## 5. Custom Instructions

### What Are Custom Instructions?

Custom instructions are free-form text appended to the system prompt under a "Business-Specific Instructions" section. This is where you provide knowledge unique to your specific business -- information the industry template cannot know.

### When to Use Custom Instructions

- Business-specific menu items or services and prices
- Special policies (cancellation, no-show fees, deposits)
- Seasonal hours or temporary closures
- Staff names and specialties
- VIP customer handling instructions
- Parking instructions or detailed location info
- Sister businesses or partner services
- Restrictions or special rules (no groups under 4 on weekends, etc.)
- Promotional offers or seasonal specials
- Information about your loyalty program
- Details about amenities or facilities

### Writing Effective Custom Instructions

Custom instructions are injected directly into the LLM prompt. Write them as clear directives that the agent can act on.

**Good example:**

```
Our happy hour is Tuesday through Thursday, 4 PM to 6 PM.
All appetizers are half price during happy hour.

We have two private dining rooms: The Oak Room (seats 12)
and The Garden Room (seats 20). For private dining, take
the caller's name and number and say our events coordinator
will call back within 24 hours.

Our head chef is Chef Maria. If someone asks about the chef,
you can mention her name and say she has 15 years of experience
in French-Italian cuisine.

We do NOT take reservations for parties under 4 on Friday
and Saturday evenings. Walk-in only for small parties on
weekend evenings.
```

**Bad examples to avoid:**

- "Be nice to customers" -- too vague, personality settings handle tone
- Instructions to create IVR menus -- the agent handles natural conversation
- Technical formatting instructions -- the agent speaks naturally
- Repeating what industry config already covers
- JSON or code snippets -- the agent does not process these

### Character Limit Guidance

Keep custom instructions under 2000 characters. They are included in every LLM call, so extremely long instructions increase token costs and can dilute focus. If you need more than 2000 characters, consider whether some content belongs in the industry configuration instead.

### Prompt Layer Order

The system prompt is built in layers, and understanding the order helps you write effective custom instructions:

1. Master Voice Prompt (how to speak -- immutable)
2. Agent identity and role description
3. Personality settings (tone, verbosity, empathy)
4. Voice conversation guidelines
5. Business context (industry, name, date, location, timezone)
6. Operating hours (if configured)
7. Escalation configuration
8. Industry-specific critical rules
9. Industry-specific booking flow
10. Industry-specific FAQ
11. **Custom instructions (your content goes here)**
12. Final critical rules (immutable)

Because custom instructions come after industry rules, they can override or supplement industry behavior. For example, if the restaurant template says "smart casual" dress code but your restaurant is fine dining, your custom instructions can say "Dress code is business formal. Jackets required for gentlemen."

However, custom instructions cannot override the master voice prompt or the final critical rules. These immutable layers ensure the agent always maintains natural conversation behavior and safety guardrails regardless of tenant configuration.

---

## 6. Capabilities Management

### Overview

Capabilities determine which tools the agent has access to during a call. All tenants receive the full set of six tools, but the system prompt and industry configuration determine when and how the agent uses each one.

### Available Capabilities

**Booking Management**: The check_availability tool queries the bookings table for a given date and returns available time slots from a default set (9 AM through 5 PM, hourly). It excludes cancelled bookings and returns up to 3 slots formatted for voice. The create_booking tool creates a confirmed record with a 6-character alphanumeric confirmation code using only unambiguous characters (no 0/O, 1/I/L confusion).

**Order Management**: The create_order tool validates customer name, order type (pickup or delivery), and items. For delivery orders, it requires a delivery address. It generates a "TP-" prefixed confirmation code and estimates 20 minutes for pickup, 40 for delivery. It rejects placeholder values like "unknown" or "not provided" and prompts the agent to ask for the real information.

**Call Transfer**: The transfer_to_human tool initiates a SIP REFER transfer to the configured escalation phone. If no escalation phone is configured, the agent takes a message instead. The tool logs the transfer reason (customer_request, complaint, refund_request, cannot_resolve) and the SIP transfer is handled by the Python agent after the API confirms.

**Call Ending**: The end_call tool gracefully terminates the call by deleting the LiveKit room after a 1-second grace period for final TTS audio. It falls back to session.shutdown() if room deletion fails. Valid reasons include conversation_complete, customer_requested_hangup, order_confirmed, and booking_confirmed.

**Note Logging**: The log_note tool saves important notes about callers to the contact_notes table, linked to the contact and call records. Valid note types: general, preference, complaint, compliment, follow_up, internal. The agent is instructed to log only notable information, not routine conversation details.

### Feature Flags

Individual capabilities can be enabled or disabled through the tenant's features object. When disabled, the system prompt instructs the agent not to use that capability.

### Tool Usage Instructions in the Prompt

The master voice prompt includes detailed tool usage instructions:

- Tell the user what you are doing before calling a tool: "Let me check that..." not "One moment please"
- Be specific: "Checking February 15th..." rather than a generic acknowledgment
- Do not repeat yourself after the tool returns -- just give the result
- Before calling create_booking, you must have: name (spelled and confirmed), date, time
- Before calling create_order, you must have: name, items, pickup/delivery, address if delivery
- You must call create_booking before telling the customer they are booked -- the tool creates the record

---

## 7. Voice Settings

### Overview

Voice settings control how the agent sounds. These are stored in the tenant's voice_config JSONB field and include the Cartesia voice ID, speaking speed, and emotional characteristics.

### Voice Configuration Fields

| Field    | Type     | Default     | Range             |
| -------- | -------- | ----------- | ----------------- |
| voice_id | string   | (required)  | Cartesia voice ID |
| speed    | number   | 0.95        | 0.5 - 2.0         |
| emotion  | string[] | ["Content"] | See table below   |

### Selecting a Voice

When selecting a Cartesia voice, consider these factors:

- **Gender**: Match to brand identity. Some businesses prefer female voices for warmth, others prefer male voices for authority. Many find the choice matters less than conversation quality.
- **Age range**: Younger voices sound energetic and casual. Older voices sound experienced and authoritative. Medical practices often benefit from a mature voice.
- **Accent**: Available in American English, British English, and others. Choose an accent matching your customer base.
- **Vocal quality**: Some voices are clear and crisp, others warm and rich. Listen to samples before selecting.

### Speed Configuration

| Speed Value | Effect                    |
| ----------- | ------------------------- |
| 0.7 - 0.8   | Very slow, deliberate     |
| 0.85 - 0.95 | Natural, easy to follow   |
| 1.0         | Standard rate             |
| 1.05 - 1.15 | Slightly fast             |
| 1.2+        | Too fast for most callers |

Phone audio quality is lower than face-to-face, so slower speeds improve comprehension. The default 0.95 provides a natural pace that is easy to understand. This is especially important for callers whose first language is not English.

The agent also uses dynamic speed control through Cartesia markers. When reading back confirmation codes, names, or important details, the agent uses speed ratio 0.9 to slow down, ensuring the caller catches every character.

### Emotion Configuration

| Emotion     | Best For               |
| ----------- | ---------------------- |
| Content     | General business use   |
| Sympathetic | Medical, support calls |
| Curious     | Consultative sales     |
| Happy       | Hospitality, events    |

The master voice prompt also includes dynamic emotion markers the agent applies during conversation: Sympathetic for complaints or bad experiences, Curious when exploring the caller's needs, Happy when confirming a booking or sharing good news. These are applied sparingly -- most responses use the baseline emotion without additional tags, and no more than one emotion tag is used per response.

---

## 8. Call Flow Configuration

### Standard Call Flow

**Step 1: Greeting** -- When the agent enters the conversation, the on_enter method fires and generates the greeting. The greeting text comes from the tenant's greeting_standard field. The agent does not read it verbatim -- the LLM receives an instruction to "Greet the caller: {greeting_text}" and generates a natural-sounding variation.

**Step 2: Acknowledgment Handling** -- After the greeting, many callers respond with "Hello?", "Hi", or "Can you hear me?" rather than immediately stating their business. The master voice prompt contains specific instructions for handling these acknowledgment-seeking responses: the agent should first confirm the connection ("Yes, hi! How can I help you today?") before asking business questions. This builds rapport and lets the caller confirm the conversation is working.

**Step 3: Intent Discovery** -- The agent listens to the caller's request and identifies the intent. Common intents include: making a booking/reservation, checking availability, asking about hours/location, placing an order, requesting a transfer to a human, and general inquiries.

**Step 4: Information Gathering** -- The agent collects the necessary information for the identified intent, asking one question per turn. The industry-specific booking flow defines the sequence of questions, but the agent adapts based on what the caller has already provided. If a caller says "table for four tonight at seven under Smith," the agent already has party size, date, time, and name -- it only needs to verify the spelling and check availability.

**Step 5: Action Execution** -- Once all required information is gathered and confirmed, the agent executes the appropriate tool (check_availability, create_booking, create_order) and communicates the result to the caller, including the confirmation code.

**Step 6: Wrap-up** -- After the primary action is complete, the agent asks if there is anything else. When the caller indicates they are done ("That's all, thanks!"), the agent says goodbye ("You're all set. Bye!") and calls the end_call tool.

### Call Duration Limits

Every call has a configurable maximum duration. The default is 900 seconds (15 minutes), with a minimum enforced value of 120 seconds (2 minutes). The duration watchdog runs as an asyncio task alongside the main conversation and enforces the limit in three phases:

| Phase   | Timing              | Action                   |
| ------- | ------------------- | ------------------------ |
| Phase 1 | 2 min before limit  | Nudge to wrap up         |
| Phase 2 | 30 sec before limit | Final warning + transfer |
| Phase 3 | At limit            | Force transfer or end    |

Phase 1 sends an internal instruction: "The call has been going on for a while. Start wrapping up the conversation naturally. Ask if there's anything else you can quickly help with."

Phase 2 sends: "You need to wrap up now. Politely tell the caller you need to go, and offer to transfer them to a human team member if they need more help."

Phase 3 initiates a SIP REFER transfer to the escalation phone if configured. If no escalation phone exists, it deletes the LiveKit room to end the call.

### Handling Caller Hang-Up

When the caller disconnects, the SIP participant leaves the LiveKit room. This triggers the session shutdown, which fires the on_shutdown callback. The callback cancels the duration watchdog (if running), collects usage metrics, and fires the call logging routine. The call is logged with whatever transcript has accumulated up to that point.

### Handling No-Answer

If the SIP participant never joins the room (the caller hangs up before the connection completes), the agent's wait_for_participant() call may time out. In this case, no conversation occurs, no tools are called, and the call may not be logged depending on whether the shutdown callback fires.

---

## 9. Tool Configuration

### Tool Architecture

Tools in Lumentra follow a two-layer architecture. The Python agent defines tool functions using the @function_tool decorator from the LiveKit Agents SDK. These functions do not execute business logic directly -- instead, they call the \_call_tool helper which sends an HTTP POST to the Node.js API at /internal/voice-tools/{action}. The API's executeTool function routes the request to the appropriate handler.

This separation ensures that:

- Business logic is centralized in the Node.js API
- The Python agent never has direct database access
- Tool behavior can be updated without redeploying the agent
- Authentication is enforced on every tool call via Bearer token

### Tool Request Format

Every tool call sends this JSON payload to the API:

```json
{
  "tenant_id": "uuid-of-tenant",
  "call_sid": "room-name-as-call-id",
  "caller_phone": "+15551234567",
  "escalation_phone": "+15559876543",
  "args": {
    "date": "2026-03-15",
    "service_type": "haircut"
  }
}
```

The tenant_id and call_sid are extracted from the agent's tenant_config and the LiveKit room name. The caller_phone comes from the SIP participant attributes. The escalation_phone is from the tenant configuration. The args object contains the tool-specific parameters.

### Tool Response Handling

Each tool returns a result object with a message field. The \_call_tool helper extracts this message and returns it as a string to the LLM, which then incorporates it into its spoken response. If the tool call fails (HTTP error, timeout, exception), the helper returns a generic "I encountered an error. Let me try again." message. The agent is instructed by the system prompt to never say "I encountered an error" to the caller -- instead to say "Let me try that again" and retry.

### Tool-by-Tool Reference

**check_availability**

| Parameter    | Type   | Required | Description       |
| ------------ | ------ | -------- | ----------------- |
| date         | string | Yes      | YYYY-MM-DD format |
| service_type | string | No       | Type of service   |

Returns up to 3 available time slots. Times are formatted for voice (e.g., "2 PM" not "14:00"). If more slots are available, mentions "and a few other times as well."

**create_booking**

| Parameter      | Type   | Required | Description           |
| -------------- | ------ | -------- | --------------------- |
| customer_name  | string | Yes      | Spelled and confirmed |
| customer_phone | string | Yes      | From caller ID        |
| date           | string | Yes      | YYYY-MM-DD format     |
| time           | string | Yes      | HH:MM 24-hour format  |
| service_type   | string | No       | Defaults to "general" |
| notes          | string | No       | Special requests      |

**create_order**

| Parameter            | Type   | Required | Description            |
| -------------------- | ------ | -------- | ---------------------- |
| customer_name        | string | Yes      | Name for the order     |
| order_type           | string | Yes      | "pickup" or "delivery" |
| items                | string | Yes      | Comma-separated items  |
| customer_phone       | string | No       | Defaults to caller ID  |
| delivery_address     | string | Cond.    | Required for delivery  |
| special_instructions | string | No       | Special requests       |

**transfer_to_human**

| Parameter | Type   | Required | Description             |
| --------- | ------ | -------- | ----------------------- |
| reason    | string | Yes      | See valid reasons below |

Valid reasons: customer_request, complaint, refund_request, cannot_resolve.

**end_call**

| Parameter | Type   | Required | Description             |
| --------- | ------ | -------- | ----------------------- |
| reason    | string | Yes      | See valid reasons below |

Valid reasons: conversation_complete, customer_requested_hangup, order_confirmed, booking_confirmed.

**log_note**

| Parameter | Type   | Required | Description           |
| --------- | ------ | -------- | --------------------- |
| note      | string | Yes      | Content to save       |
| note_type | string | No       | Defaults to "general" |

Valid types: general, preference, complaint, compliment, follow_up, internal.

---

## 10. Speech-to-Text Configuration

### Deepgram Nova-3

The voice agent uses Deepgram's nova-3 model for speech-to-text transcription. Nova-3 is Deepgram's latest and most accurate model, offering significant improvements in accuracy across accents and languages compared to nova-2.

### STT Configuration in the Agent

The STT is configured in the AgentSession creation within the entrypoint function:

```python
stt=deepgram.STT(
    model="nova-3",
    language="multi",
    smart_format=True,
    keyterm=[tenant_config["business_name"]],
)
```

### Configuration Parameters

| Parameter    | Value           | Purpose                     |
| ------------ | --------------- | --------------------------- |
| model        | nova-3          | Latest Deepgram model       |
| language     | multi           | Multi-language support      |
| smart_format | True            | Auto-punctuation/numbers    |
| keyterm      | [business_name] | Boosts recognition accuracy |

### Language Setting: "multi"

Setting language to "multi" enables Deepgram's multilingual mode, which automatically detects the spoken language and transcribes accordingly. This is critical for businesses that serve diverse populations. The agent can handle callers speaking English, Spanish, French, Hindi, and many other languages without any manual switching.

When language is set to "multi" instead of a specific language code like "en-US", Deepgram uses a universal acoustic model that is slightly less accurate for any single language but far more versatile. For businesses whose callers are exclusively English-speaking, switching to "en-US" or "en" would provide marginally better accuracy. However, the multi setting is recommended for most businesses because:

- Callers may code-switch between languages mid-sentence
- Names from other languages are transcribed more accurately
- Accented English is handled better by the multilingual model
- There is no need to predict or detect the caller's language in advance

### Smart Formatting

When smart_format is enabled, Deepgram automatically applies intelligent formatting to the transcript:

- Numbers are formatted as digits: "twenty five" becomes "25"
- Currency is formatted: "twenty five dollars" becomes "$25"
- Dates are formatted: "March fifteenth" becomes "March 15th"
- Times are formatted: "two thirty PM" becomes "2:30 PM"
- Punctuation is added automatically based on speech patterns
- Common abbreviations are recognized

This formatting reduces the work the LLM must do to parse natural speech into structured data for tool calls.

### Keyterm Boosting

The keyterm parameter accepts an array of strings that Deepgram should prioritize during recognition. In the Lumentra agent, the business name is always included as a keyterm. This dramatically improves accuracy for business names that might otherwise be misheard -- especially names that are unusual words, proper nouns, or non-English terms.

For example, if the business is "Chez Pierre," the keyterm boost ensures Deepgram transcribes it as "Chez Pierre" rather than "Shay Pierre" or "Che Pierre."

Additional keyterms you might consider adding:

- Menu item names
- Staff member names
- Neighborhood or street names
- Technical terms or brand names

### Accuracy Considerations

Several factors affect STT accuracy in a phone call context:

| Factor             | Impact                 | Mitigation            |
| ------------------ | ---------------------- | --------------------- |
| Phone audio (8kHz) | Reduces accuracy       | Noise cancellation    |
| Background noise   | Reduces accuracy       | BVCT telephony filter |
| Heavy accents      | May reduce accuracy    | Multi-language mode   |
| Overlapping speech | Confuses transcription | Turn detection        |
| Poor cell signal   | Audio dropouts         | Agent asks to repeat  |

The BVCT Telephony noise cancellation plugin is specifically designed for telephone audio and removes echo, background noise, and line interference before the audio reaches Deepgram. This preprocessing step significantly improves transcription accuracy.

### Interim vs. Final Transcripts

Deepgram provides two types of transcription results:

- **Interim transcripts**: Partial results streamed as the caller speaks. Used for turn detection and preemptive generation. Not sent to the LLM for response generation.

- **Final transcripts**: Complete, finalized transcription of an utterance. These are what the LLM receives. Final transcripts have higher accuracy because Deepgram uses the full context.

The agent only sends final transcripts to the LLM for response generation. Interim transcripts are used internally for turn detection and the preemptive generation feature, which allows the system to start preparing a response before the caller has finished speaking.

---

## 11. Text-to-Speech Configuration

### Cartesia Sonic-3

The voice agent uses Cartesia's Sonic-3 model for text-to-speech synthesis. Sonic-3 produces highly natural speech with support for emotion control, speed adjustment, and SSML-like markers for pauses, spelling, and emphasis.

### TTS Configuration in the Agent

```python
tts=cartesia.TTS(
    model="sonic-3",
    voice=tenant_config["voice_config"]["voice_id"],
    speed=0.95,
    emotion=["Content"],
)
```

### Configuration Parameters

| Parameter | Value        | Purpose                     |
| --------- | ------------ | --------------------------- |
| model     | sonic-3      | Latest Cartesia model       |
| voice     | (per tenant) | Specific voice identity     |
| speed     | 0.95         | Slightly slower than normal |
| emotion   | ["Content"]  | Warm, pleasant baseline     |

### SSML-Like Markers

The master voice prompt teaches the LLM to use Cartesia-specific markers in its text output. These markers are interpreted by Sonic-3 during synthesis:

**Pauses** -- Used for natural rhythm:

- `<break time="300ms"/>` -- Brief thinking pause before complex answers
- `<break time="500ms"/>` -- Longer pause for emphasis or before important info
- Example: `<break time="300ms"/> Let me check those dates for you.`

**Speed Changes** -- Adjust based on content importance:

- `<speed ratio="0.9"/>` -- Slow down for important details (confirmations, addresses)
- `<speed ratio="1.1"/>` -- Speed up for casual asides
- Only whole-number ratios (0.9, 1.1) -- decimals like 1.05 can break synthesis
- Example: `<speed ratio="0.9"/> Your confirmation code is <spell>ABC123</spell>.`

**Spelling** -- Letter-by-letter pronunciation:

- `<spell>text</spell>` -- For confirmation codes, license plates, acronyms
- Example: `Your code is <spell>A3K7P2</spell>`
- Essential for accurate communication of alphanumeric codes over the phone

**Emotion Tags** -- Match emotional tone to context:

- `<emotion value="Sympathetic"/>` -- When caller has a complaint
- `<emotion value="Curious"/>` -- When asking about needs
- `<emotion value="Happy"/>` -- When confirming a booking
- One per response maximum. Most responses need no tag.

**Laughter** -- Only when genuinely appropriate:

- `[laughter]` -- When caller makes an actual joke
- Used extremely sparingly. Never forced. Most responses need no laughter.

### Voice Selection Best Practices

- Listen to voice samples before committing to a selection
- Test the voice with actual conversation transcripts from your industry
- Check how the voice sounds at speed 0.95 (the default)
- Ensure the voice handles spelling and alphanumeric codes clearly
- Verify that emotion markers sound natural with the selected voice
- Test the voice with technical terms specific to your industry
- Consider testing with callers from your primary demographic

### Streaming TTS

Cartesia Sonic-3 supports streaming synthesis, meaning audio begins playing to the caller before the full text has been synthesized. The LiveKit Agents SDK handles this automatically -- as soon as the LLM starts generating text, those tokens are streamed to Cartesia, and audio chunks flow back to the caller.

This streaming architecture enables sub-second first-audio latency. The caller begins hearing the response within 100-200ms of the first LLM tokens being generated, creating a natural conversational pace.

---

## 12. LLM Configuration

### Model Selection

The voice agent uses OpenAI's gpt-4.1-mini as the language model. This model was selected after evaluating multiple options:

| Model          | Quality | Speed   | Cost   | Verdict            |
| -------------- | ------- | ------- | ------ | ------------------ |
| gpt-4.1-mini   | High    | Fast    | Low    | Selected           |
| gpt-4.1-nano   | Low     | Fastest | Lowest | Too low quality    |
| Groq free tier | Medium  | Fast    | Free   | 12k TPM limit      |
| gpt-4.1        | Highest | Slower  | High   | Overkill for voice |

gpt-4.1-mini provides the best balance of quality, speed, and cost for voice conversations. It handles tool calling reliably, follows complex system prompts accurately, and generates natural conversational responses. The nano model was tested and found too low-quality for the 5,600+ token system prompt -- it would ignore instructions, hallucinate details, and fail at tool calling. Groq's free tier was unusable due to the 12,000 tokens-per-minute rate limit, which a single conversation can easily exceed.

### LLM Configuration in the Agent

```python
llm = openai.LLM(
    model="gpt-4.1-mini",
    temperature=0.8,
)
```

### Temperature Setting

The temperature is set to 0.8, which provides a good balance between consistency and natural variation:

| Temperature | Effect                       |
| ----------- | ---------------------------- |
| 0.0 - 0.3   | Very consistent, robotic     |
| 0.4 - 0.6   | Predictable, slightly varied |
| 0.7 - 0.9   | Natural variation, creative  |
| 1.0+        | Too unpredictable for voice  |

At 0.8, the agent says things slightly differently each time (like a real person would) while remaining accurate and on-topic. Lower temperatures make the agent sound scripted -- it would say the exact same thing every time, which callers notice and find off-putting. Higher temperatures risk off-topic or unusual responses that break the professional illusion.

### Prompt Caching

OpenAI's prompt caching is a significant cost optimization. Because the system prompt (approximately 5,600 tokens) is identical across all calls for a given tenant, and the first portion of the conversation context is shared across turns within a single call, OpenAI caches these prompt tokens and charges a reduced rate for cache hits.

In production, the Lumentra agent achieves approximately 88% prompt cache hit rate, meaning only 12% of prompt tokens are charged at full price. This reduces the per-call LLM cost to approximately $0.015.

### Token Usage

The system prompt alone consumes approximately 5,600 tokens. During a typical call, each conversational turn adds roughly 50-100 tokens (user message + assistant response). A 10-minute call with 20 turns might consume:

| Component              | Tokens     |
| ---------------------- | ---------- |
| System prompt          | ~5,600     |
| Conversation history   | ~1,500     |
| Tool calls and results | ~500       |
| **Total per turn**     | **~7,600** |

gpt-4.1-mini supports a 128K context window, so there is ample room for even the longest conversations.

### Tool Calling

The LLM generates tool calls as part of its response when it determines an action is needed. The LiveKit Agents SDK intercepts these tool calls, executes the corresponding Python function (which in turn calls the internal API), and feeds the result back to the LLM. The LLM then generates a natural-language response incorporating the tool result.

The system prompt includes detailed instructions on when to call each tool, what parameters are required, and how to convert natural language (e.g., "tomorrow at noon") into the expected parameter format (date: "2026-03-03", time: "12:00"). The prompt also specifies type requirements -- whether a parameter expects a string or number, and the specific date/time formats to use.

---

## 13. Turn Detection and Endpointing

### Overview

Turn detection is one of the most critical components of a voice agent. It determines when the caller has finished speaking and the agent should respond. Get it wrong and you either interrupt the caller (responding too early) or create awkward silences (responding too late).

### Components

The Lumentra agent uses two complementary systems:

| Component          | Role                      |
| ------------------ | ------------------------- |
| Silero VAD         | Detects voice vs. silence |
| Multilingual Model | Predicts end-of-turn      |

**Silero VAD** (Voice Activity Detection) is a neural network that classifies audio frames as speech or non-speech. It runs continuously on the incoming audio and provides real-time speech/silence detection. The model is prewarmed during process startup (in the prewarm function) and stored in proc.userdata to avoid cold-start latency.

**MultilingualModel** is LiveKit's turn detection model that predicts whether the caller has finished their turn based on linguistic and acoustic cues. It considers factors like sentence completion, intonation patterns, and pause duration. Unlike simple silence-based endpointing, it can determine that a brief pause mid-sentence is not the end of a turn.

### Endpointing Configuration

| Parameter             | Value | Purpose                     |
| --------------------- | ----- | --------------------------- |
| min_endpointing_delay | 0.8s  | Minimum wait after speech   |
| max_endpointing_delay | 2.5s  | Maximum wait before respond |

**min_endpointing_delay** (0.8 seconds): After the VAD detects that speech has ended, the system waits at least this long before considering it an end-of-turn. This prevents the agent from jumping in during natural pauses within a sentence. Setting this too low causes frequent interruptions; too high makes the agent feel sluggish.

**max_endpointing_delay** (2.5 seconds): If no speech is detected for this long, the system forces an end-of-turn regardless of what the turn detector predicts. This is a safety net for situations where the caller trails off or the turn detector is uncertain.

### Interruption Handling

| Parameter                  | Value | Purpose                     |
| -------------------------- | ----- | --------------------------- |
| preemptive_generation      | True  | Start LLM before turn ends  |
| resume_false_interruption  | True  | Resume after false triggers |
| false_interruption_timeout | 1.5s  | Window for detecting false  |

**preemptive_generation**: When enabled, the agent begins generating an LLM response before the turn detector is fully confident the caller has finished. If the caller continues speaking, the partial response is discarded. This reduces perceived latency by 200-500ms in most cases.

**resume_false_interruption**: When the caller produces a brief sound (cough, "uh huh", backchannel) that triggers an interruption while the agent is speaking, this feature detects that it was a false interruption and resumes the agent's response. Without this, brief noises would constantly cut off the agent mid-sentence.

**false_interruption_timeout** (1.5 seconds): The window during which a brief sound is considered a potential false interruption. If the caller does not continue speaking within 1.5 seconds of the interruption, the agent resumes its previous response.

### Turn-Taking Rules in the System Prompt

The master voice prompt includes explicit turn-taking instructions that complement the technical configuration:

- If the caller starts speaking while the agent is talking, stop immediately
- Do not finish the sentence or apologize for talking over them
- Just listen and respond to what they said
- When the caller pauses mid-thought, do not jump in
- Let them finish -- silence is acceptable
- If the caller is clearly thinking, wait for them
- Use brief acknowledgments ("Mhmm", "Uh huh", "Okay") while the caller is speaking
- These acknowledgments signal active listening and are not interruptions

### Endpointing Tuning Guide

**If callers complain about being interrupted:**

- Increase min_endpointing_delay (try 1.0 to 1.2)
- Increase false_interruption_timeout (try 2.0)
- Consider disabling preemptive_generation temporarily
- Review whether the turn detection model is appropriate for your caller demographics

**If callers complain about slow responses:**

- Decrease min_endpointing_delay (try 0.5 to 0.7)
- Decrease max_endpointing_delay (try 2.0)
- Ensure preemptive_generation is enabled
- Check LLM latency independently

---

## 14. SIP Trunk Configuration

### Overview

The SIP trunk is the bridge between the public telephone network and the LiveKit media server. Lumentra uses SignalWire as the SIP trunk provider, which handles number provisioning, call routing, and PSTN connectivity.

### How SIP Trunking Works

When a customer dials your business number:

1. The call enters the PSTN (public telephone network)
2. The carrier routes it to SignalWire based on the number
3. SignalWire receives it on the configured SIP trunk
4. SignalWire sends a SIP INVITE to the LiveKit SIP endpoint
5. LiveKit SIP creates a room and bridges the audio

### Phone Number Setup

Each tenant needs a phone number that routes to the Lumentra voice agent. The phone number is stored in the tenant's phone_number field and is used to identify which tenant a call belongs to when it arrives.

When a call arrives, the agent extracts the dialed number from the SIP participant's sip.trunkPhoneNumber attribute and uses it to look up the corresponding tenant configuration via the internal API.

### SIP Participant Attributes

When a call arrives via SIP, the LiveKit SIP service populates participant attributes that the agent reads:

| Attribute            | Content                    |
| -------------------- | -------------------------- |
| sip.trunkPhoneNumber | The number that was dialed |
| sip.phoneNumber      | The caller's phone number  |

These attributes are critical for tenant identification (which business was called) and caller tracking (who is calling).

### Call Transfer via SIP REFER

When the agent needs to transfer a call to a human, it uses the SIP REFER method. The transfer_to_human tool finds the SIP participant in the LiveKit room and calls transfer_sip_call with a SIP URI:

```
sip:{escalation_phone}@sip.signalwire.com
```

The SIP REFER tells SignalWire to redirect the caller's phone connection to the escalation number. The caller hears ringing and is connected to the human staff member. The agent's connection to the room ends after the transfer.

### Firewall Requirements

SIP trunking requires specific ports to be open:

| Port        | Protocol | Purpose               |
| ----------- | -------- | --------------------- |
| 5060        | TCP/UDP  | SIP signaling         |
| 7880-7881   | TCP      | LiveKit WebSocket/API |
| 10000-20000 | UDP      | RTP media (audio)     |
| 50000-60000 | UDP      | WebRTC ICE candidates |

All of these ports must be accessible from the SignalWire and LiveKit service IP ranges. Blocking any of these ports will prevent calls from connecting or cause audio issues.

---

## 15. LiveKit Integration

### Overview

LiveKit is the real-time media server that connects all components. It manages rooms, participants, audio tracks, and the WebRTC connections that carry voice data between the caller, the agent, and the speech processing services.

### Room Management

Each phone call gets its own LiveKit room. The room is created by the LiveKit SIP service when a call arrives and is identified by a name like "SIP_xxxxxxxxxxxx". The room contains two participants:

| Participant | Kind                 | Role         |
| ----------- | -------------------- | ------------ |
| SIP Caller  | PARTICIPANT_KIND_SIP | Phone caller |
| Agent       | (local agent)        | Voice agent  |

The agent connects to the room using ctx.connect() and then waits for the SIP participant with ctx.wait_for_participant(). Audio flows bidirectionally between these two participants through the LiveKit media infrastructure.

### Participant Lifecycle

1. **Room created**: LiveKit SIP creates the room on incoming call
2. **SIP participant joins**: Caller audio begins flowing into the room
3. **Agent connects**: ctx.connect() joins the agent to the room
4. **Agent waits**: ctx.wait_for_participant() resolves when the caller's SIP participant is detected
5. **Conversation**: Bidirectional audio flows; STT/LLM/TTS process the audio
6. **Disconnection**: Either participant leaves (caller hangs up or agent ends call)
7. **Room cleanup**: ctx.delete_room() or automatic cleanup after all participants leave

### Audio Processing Pipeline

Within a LiveKit room, audio flows through this pipeline:

```
Caller's phone audio
    |
    v
LiveKit SIP (bridges to WebRTC)
    |
    v
Noise Cancellation (BVCT Telephony)
    |
    v
Deepgram STT (transcription)
    |
    v
LLM (response generation)
    |
    v
Cartesia TTS (speech synthesis)
    |
    v
LiveKit (streams back to SIP)
    |
    v
Caller hears the response
```

### Noise Cancellation

The agent uses the BVCT Telephony noise cancellation plugin, specifically designed for telephone audio:

```python
room_options=room_io.RoomOptions(
    audio_input=room_io.AudioInputOptions(
        noise_cancellation=noise_cancellation.BVCTelephony(),
    ),
)
```

This plugin removes echo from speakerphones, background noise (traffic, office chatter), line interference and static, and cross-talk from nearby conversations. It processes the audio before it reaches Deepgram, significantly improving transcription accuracy.

### Room Deletion vs. Session Shutdown

There are two ways to end a call, with important behavioral differences:

| Method             | Behavior              | Use When        |
| ------------------ | --------------------- | --------------- |
| ctx.delete_room()  | Immediate termination | Normal call end |
| session.shutdown() | Non-blocking, gradual | Fallback only   |

The end_call tool uses delete_room because it provides immediate disconnection. session.shutdown() is non-blocking and allows the LLM to generate one more response, which can cause a confusing "Hello!" restart where the agent begins a new greeting after the goodbye. delete_room is always preferred for intentional call termination.

---

## 16. System Prompt Engineering

### Overview

The system prompt is the most important configuration element. It defines everything about how the agent behaves: its identity, personality, conversation rules, industry knowledge, and safety guardrails. The prompt is built dynamically for each tenant by the buildSystemPrompt function in chat.ts.

### Prompt Structure

The system prompt is assembled in layers, each serving a specific purpose:

**Layer 1: Master Voice Prompt (immutable, ~3000 tokens)**

This is the largest and most important section. It defines HOW the agent speaks -- conversation behavior that is consistent across all tenants. The master prompt cannot be overridden by tenant configuration. It covers:

- Voice output format and Cartesia SSML markers (breaks, speed, spell, emotion, laughter)
- High-stakes accuracy requirements (zero tolerance for guessing names, dates, times)
- Greeting and acknowledgment patterns (how to handle "Hello?" after greeting)
- Response length rules (1-2 sentences max, one question per turn)
- The "never guess, always ask" principle
- Name collection and mandatory spelling verification
- Natural pacing, filler words, and active listening cues
- Phrases to avoid (robotic language) and phrases to use (natural language)
- Turn-taking behavior (stop when interrupted, wait for pauses)
- Energy matching (match caller's emotional state)
- Tool usage instructions (announce before calling, convert natural language to parameters)
- Confirmation and verification protocols (read back details slowly, spell names, get explicit yes)
- Call ending rules (only after goodbye, never on "thank you")
- Cultural and accent awareness (patient, never comment on accents)
- Number, date, time, and price formatting for spoken output

**Layer 2: Agent Identity**

Sets who the agent is: "You are {agentName}, the receptionist at {businessName}."

**Layer 3: Role Description**

From the industry configuration. For example, restaurant: "You help guests make table reservations, answer questions about the menu and hours, and provide restaurant information. You are efficient and friendly -- like a real host who's busy but happy to help."

**Layer 4: Personality**

Generated from the tenant's agent_personality JSONB (tone, verbosity, empathy). See Section 3.

**Layer 5: Voice Conversation Guidelines**

Standard phone-specific instructions: this is a phone call, speak like a real human, keep responses short, never use robotic phrases, use contractions, one question per response, never repeat confirmed information.

**Layer 6: Business Context**

Dynamic information injected at call time: industry type, business name, today's date (YYYY-MM-DD), location address and city (if configured), timezone.

**Layer 7: Operating Hours**

If operating_hours.schedule is configured, each day's hours are listed. Holidays are included if specified. The prompt adds: "Use these hours to answer 'when are you open?' questions."

**Layer 8: Escalation Configuration**

If escalation_phone is set: "Transfer phone: {number} (use when caller asks for a human/manager)." If not: "No transfer phone configured. If caller asks for a human, take a message and say someone will call back."

**Layer 9: Industry Critical Rules**

Safety rules, state tracking requirements, transfer rules, and handling instructions specific to the industry. These vary significantly -- medical gets HIPAA compliance rules, hotels get state tracking and confusion handling, restaurants get reservation flow rules.

**Layer 10: Industry Booking Flow**

Step-by-step instructions for the booking/reservation/appointment process specific to the industry.

**Layer 11: Industry FAQ**

Common questions and answers specific to the industry.

**Layer 12: Custom Instructions**

Tenant-specific business knowledge (see Section 5).

**Layer 13: Final Critical Rules (immutable)**

Hard rules that override everything and cannot be changed by any tenant configuration:

- Never say you are an AI, assistant, or automated system
- If asked "are you a robot?", deflect naturally
- Never mention tools, functions, or internal systems
- Never read technical information aloud
- Keep responses to max 1-2 sentences
- One question per response, never ask two in one turn
- Never repeat or re-confirm information already given
- Sound human, not corporate or scripted
- Use YYYY-MM-DD format internally for dates

### Prompt Size Management

The complete system prompt typically runs 5,000-6,000 tokens. The master voice prompt is the largest component at approximately 3,000 tokens. Industry configurations add approximately 500-1,000 tokens. Custom instructions should be kept concise to avoid pushing the total beyond 7,000 tokens, which would increase costs and potentially degrade focus.

---

## 17. Tool Execution Deep Dive

### Execution Flow

When the LLM decides to call a tool during conversation:

1. LLM generates a tool call in its response (function name + arguments)
2. LiveKit Agents SDK intercepts the tool call
3. The corresponding Python @function_tool function is invoked with a RunContext
4. The function calls \_call_tool() which sends HTTP POST to the API
5. The API's executeTool() routes to the appropriate handler
6. The handler executes database operations and returns a result
7. The result message flows back through \_call_tool() to the LLM
8. The LLM generates a spoken response incorporating the result

### check_availability Deep Dive

**Purpose**: Query available appointment/reservation slots for a given date.

**Internal Flow**:

1. Query bookings table for the tenant on the specified date, excluding cancelled bookings
2. Generate default time slots: 09:00, 10:00, 11:00, 12:00, 13:00, 14:00, 15:00, 16:00, 17:00
3. Filter out already-booked slots
4. Format up to 3 available slots for voice output (e.g., "2 PM" not "14:00")
5. Return availability message with formatted times

**Response when available**: "We have availability at 2 PM, 3 PM, 4 PM. And a few other times as well. Which time works best for you?"

**Response when full**: "I'm sorry, we don't have any availability on March 15th. Would you like to check another date?"

### create_booking Deep Dive

**Purpose**: Create a confirmed appointment or reservation in the database.

**Internal Flow**:

1. Generate a 6-character confirmation code using unambiguous characters (ABCDEFGHJKLMNPQRSTUVWXYZ23456789 -- excludes 0/O, 1/I/L to avoid phone miscommunication)
2. Look up the call record for linking (may not exist yet during active call)
3. Insert into bookings table with status "confirmed", source "call"
4. Format date (e.g., "Wednesday, March 15th") and time (e.g., "2 PM") for voice
5. Return confirmation message with date, time, and spelled-out code

### create_order Deep Dive

**Purpose**: Place a food order for pickup or delivery.

**Validation**: The tool actively rejects placeholder values. It checks customer_name, items, and delivery_address against a list of invalid values: "unknown", "not provided", "n/a", "none", "undefined", "null", and empty strings. If any required field contains a placeholder, the tool returns a specific prompt asking the agent to collect the real information.

**Estimated Times**: Pickup orders are estimated at 20 minutes. Delivery orders are estimated at 40 minutes. The confirmation code is prefixed with "TP-" (e.g., "TP-K4M2W9").

### transfer_to_human Deep Dive

**Two-Phase Transfer**: The transfer happens in two phases. Phase 1 (API side): the API updates the call record's outcome_type to "escalation" and confirms the transfer intent. Phase 2 (Agent side): the Python agent finds the SIP participant using \_get_sip_participant() (which iterates through remote participants looking for PARTICIPANT_KIND_SIP) and calls transfer_sip_call() with the SIP URI.

**Fallback behavior when transfer fails**:

- No SIP participant found: "Someone will call you back shortly."
- SIP transfer exception: "I was unable to transfer you directly. Someone will call you back shortly."
- No escalation phone configured: "Someone will call you back shortly."

### end_call Deep Dive

**Grace Period**: The tool waits 1 second after logging the end reason before deleting the room. This grace period allows the final TTS audio (the goodbye message) to finish playing before the connection is severed. Without this delay, the caller would hear the response cut off mid-word.

**Room Deletion vs. Shutdown**: The tool uses ctx.delete_room() for immediate termination. If deletion fails (network error, room already deleted), it falls back to session.shutdown(). The shutdown method is non-blocking and allows the LLM to generate one more response, which is why it is only used as a fallback.

### log_note Deep Dive

**Contact Auto-Creation**: If no contact record exists for the caller's phone number, one is automatically created via findOrCreateByPhone. This ensures notes are always linked to a persistent contact record in the CRM.

**Call Linking**: The note is linked to both the contact record and the current call record (if the call has been logged to the database already). This creates a full audit trail: which call generated which note for which contact.

---

## 18. Call Logging and Analytics

### Overview

Every call is logged to the database with comprehensive metadata. The call logging system captures the transcript, detects the outcome, builds a summary, and triggers post-call automation.

### How Calls Are Logged

Call logging happens during the session shutdown callback. The log_call function in the Python agent performs these steps:

1. Extracts the transcript from session.history.messages()
2. Calculates the call duration from the start time
3. Detects the outcome type using regex patterns on the transcript
4. Builds a brief summary with turn count, duration, and topics
5. Posts everything to /internal/calls/log with a 5-second timeout

### Transcript Extraction

The transcript is built from the session's chat history. Each message has a role and text_content. The logger formats user messages as "Customer:" and assistant messages as "Agent:", creating a readable dialogue format. System messages and tool call details are excluded.

### Outcome Detection

The \_detect_outcome function classifies calls using regex patterns:

| Pattern Matched           | Outcome    |
| ------------------------- | ---------- |
| confirmation code, booked | booking    |
| appointment confirmed/set | booking    |
| transfer, human, manager  | escalation |
| order placed/confirmed    | booking    |
| (no match)                | inquiry    |

### Summary Generation

The \_build_summary function produces a brief summary by counting conversation turns, recording duration, and detecting topics from keywords:

| Keywords                  | Topic Detected  |
| ------------------------- | --------------- |
| book, appoint, reserv     | booking         |
| avail, open, slot         | availability    |
| order, deliver, pickup    | ordering        |
| hour, close, locat        | business info   |
| transfer, human, complain | escalation      |
| (no keywords)             | general inquiry |

Example summary: "12 conversation turns, 180s. Topics: booking, availability."

### Call Record Fields

The API creates a comprehensive call record with these fields:

| Field            | Source                       |
| ---------------- | ---------------------------- |
| tenant_id        | From agent context           |
| vapi_call_id     | LiveKit room name            |
| caller_phone     | SIP attributes               |
| caller_name      | From conversation (if given) |
| direction        | Always "inbound"             |
| status           | Mapped from agent status     |
| started_at       | Call start timestamp         |
| ended_at         | Call end timestamp           |
| duration_seconds | Calculated                   |
| outcome_type     | Detected from transcript     |
| outcome_success  | Derived from outcome         |
| transcript       | Full text dialogue           |
| summary          | Generated brief summary      |
| contact_id       | Auto-linked contact          |

### Status Mapping

| Agent Status | DB Status |
| ------------ | --------- |
| completed    | completed |
| failed       | failed    |
| transferred  | completed |
| no-answer    | missed    |
| (default)    | completed |

Transferred calls are mapped to "completed" because the call itself completed successfully -- it was just handed off to a human.

### Post-Call Automation

After the call record is created, the API triggers post-call automation asynchronously. This includes creating or updating CRM deals, assigning follow-up tasks, updating contact status, and triggering notifications. The automation runs based on call outcome, duration, industry, and tenant configuration. It is non-blocking -- if automation fails, the call record is still saved.

### Contact Auto-Creation

When a call is logged, the system automatically finds or creates a contact record for the caller's phone number using findOrCreateByPhone. If the caller provided their name during the conversation, it is associated with the contact. The contact is linked to the call record, enabling CRM tracking across multiple calls from the same person.

---

## 19. Error Handling and Fallbacks

### Overview

Voice calls must never fail silently or leave the caller confused. The Lumentra agent implements error handling at every level, with graceful degradation and natural-sounding recovery messages.

### STT Failure Handling

If Deepgram fails to transcribe or returns an empty transcript, the agent receives no user input for that turn. The max_endpointing_delay (2.5 seconds) eventually triggers, and the agent may say "Sorry, I didn't catch that. Could you repeat?" This feels natural -- like a real person who did not hear clearly.

If the Deepgram connection drops entirely, the STT plugin attempts to reconnect. During reconnection, audio may be buffered or lost. If reconnection fails, the call may need to be terminated.

### LLM Failure Handling

If the OpenAI API returns an error or times out, the LiveKit Agents SDK handles retries internally. If all retries fail, the agent may fall silent temporarily. The duration watchdog continues running and will eventually end the call if the conversation cannot proceed.

### TTS Failure Handling

If Cartesia fails to synthesize speech, the caller hears silence for that response. The conversation can continue on the next turn because the LLM does not know the TTS failed -- it continues generating responses normally.

### Tool Call Failure Handling

The \_call_tool helper wraps all tool calls in try/except and returns "I encountered an error. Let me try again." on failure. The master voice prompt instructs the agent to never literally say "I encountered an error" to the caller -- instead to say "Let me try that again" and retry naturally.

The API-side tool handlers have their own error handling with tool-specific messages:

| Tool               | On Error                       |
| ------------------ | ------------------------------ |
| check_availability | "Error checking. Let me try."  |
| create_booking     | "Error creating. Let me try."  |
| create_order       | Validation-specific prompts    |
| transfer_to_human  | "Can I help another way?"      |
| end_call           | Falls back to shutdown         |
| log_note           | Silent (returns "Note saved.") |

### Tenant Lookup Failure

If the agent cannot find a tenant for the dialed number, it logs an error and returns without starting a conversation. The caller hears nothing and the call drops. This is a critical failure. Common causes:

- Phone number not configured in the database
- Tenant record is inactive (is_active = false)
- Phone number format mismatch (missing +1 country code)
- API is unreachable (container down, network issue)

### API Connection Failure

The httpx client has a 10-second timeout. Common causes of API unreachability:

- API container is down or restarting
- Network misconfiguration (wrong IP or port)
- Firewall blocking internal traffic
- INTERNAL_API_KEY environment variable mismatch

### Call Logging Failure

Call logging is wrapped in a 5-second timeout:

```python
await asyncio.wait_for(log_call(...), timeout=5.0)
```

If logging times out or fails, the call still completes normally -- only the record is lost. This is logged as a warning for monitoring purposes.

### Duration Watchdog Error Handling

The watchdog handles CancelledError gracefully (normal call end). If it encounters an unexpected error during the transfer phase, it logs the error and falls back to room deletion.

---

## 20. Multi-Language Support

### Overview

The Lumentra voice agent supports multiple languages through Deepgram's multilingual STT mode and Cartesia's multilingual TTS model.

### STT Language Configuration

The agent uses language="multi" for automatic language detection. Deepgram analyzes the first few seconds of audio to identify the likely language and transcribes accordingly. Supported languages include English, Spanish, French, German, Portuguese, Hindi, and many others.

If the caller switches languages mid-call, Deepgram adapts. This is valuable for businesses serving multilingual communities where callers might greet in Spanish then switch to English.

### TTS Language Support

Cartesia Sonic-3 supports multilingual synthesis. When the LLM generates a response in a non-English language, Sonic-3 synthesizes it with appropriate pronunciation and prosody.

### Accent Handling

The master voice prompt includes comprehensive accent awareness instructions:

- Be patient with accent variations (Indian, Pakistani, Bangladeshi, Middle Eastern, Asian)
- Ask for repetition when unclear: "Sorry, could you repeat that?"
- Always ask for spelling of names
- Verify numbers, dates, and times by reading back
- Slow speaking pace if the caller seems confused
- Never comment on accents or ask to "speak more clearly"
- Never ask to "say that in English"
- Never express frustration or impatience
- The transcription is already text -- if it seems unclear, ask specific clarifying questions

### Per-Tenant Language Notes

Currently, the language setting is global ("multi" for all tenants). The system prompt is written in English, and the LLM generates responses primarily in English. For businesses that primarily serve non-English-speaking callers, custom instructions can include directives to respond in a specific language.

---

## 21. Operating Hours and After-Hours Behavior

### Configuring Operating Hours

Operating hours are stored in the tenant's operating_hours JSONB field with a schedule array and optional holidays array:

```json
{
  "schedule": [
    { "day": "Monday", "open": "9:00 AM", "close": "5:00 PM" },
    { "day": "Tuesday", "open": "9:00 AM", "close": "5:00 PM" },
    { "day": "Saturday", "open": "10:00 AM", "close": "2:00 PM" },
    { "day": "Sunday", "open": "Closed", "close": "Closed" }
  ],
  "holidays": ["Christmas Day", "Thanksgiving"]
}
```

The schedule can use either "open"/"close" or "open_time"/"close_time" field names -- both are supported by the buildSystemPrompt function.

### How Operating Hours Appear in the Prompt

The buildSystemPrompt function formats the hours as a readable list in the system prompt:

```
## Operating Hours
- Monday: 9:00 AM - 5:00 PM
- Tuesday: 9:00 AM - 5:00 PM
...
- Closed on: Christmas Day, Thanksgiving
Use these hours to answer "when are you open?" questions.
If caller asks about a day/time outside these hours, let them know.
```

### After-Hours Greeting

Tenants can configure a separate greeting for after-hours calls using the greeting_after_hours field. This allows the agent to acknowledge that the business is currently closed while still helping:

"Thank you for calling Grand Plaza Hotel. Our front desk is currently closed, but I can still help you make a reservation or answer questions."

### Timezone Configuration

The timezone field (e.g., "America/Los_Angeles") ensures the agent knows what "today" and "now" mean in the business's local time. This is critical for interpreting relative dates ("tomorrow", "tonight"), determining if the business is currently open, and formatting dates and times correctly.

### Best Practices

- Include all 7 days of the week in the schedule
- Use "Closed" for days the business is not open
- Include major holidays relevant to your region
- Update seasonal hours promptly
- Keep the timezone accurate (especially for DST changes)

---

## 22. Call Transfer and Escalation Rules

### Overview

Call transfer is one of the most sensitive features. A poorly handled transfer frustrates callers. A trigger-happy transfer wastes human staff time. The system is designed to transfer only when genuinely necessary.

### Escalation Configuration

| Field               | Type     | Purpose                     |
| ------------------- | -------- | --------------------------- |
| escalation_enabled  | boolean  | Master toggle for transfers |
| escalation_phone    | string   | Number to transfer to       |
| escalation_triggers | string[] | What triggers transfer      |

### When Transfers Happen

The system prompt strictly limits transfer triggers to explicit caller requests:

**Transfer triggers:**

- "I want to speak to a human"
- "Let me talk to a real person"
- "Can I speak to a manager?"
- "I want to complain"
- "This is unacceptable"

**NOT transfer triggers:**

- Caller frustration or rudeness (stay calm, keep helping)
- Caller confusion (rephrase and try again)
- Single words the agent does not understand (ask for clarification)
- Repeated questions (rephrase differently)
- General dissatisfaction with answers

### Transfer Flow

1. Caller explicitly requests a human/manager
2. Agent calls transfer_to_human with a reason
3. API logs the escalation and updates the call record
4. Agent finds the SIP participant in the LiveKit room
5. Agent constructs SIP URI: sip:{phone}@sip.signalwire.com
6. Agent calls transfer_sip_call() on the SIP participant
7. SignalWire executes the SIP REFER
8. Caller hears ringing, then connects to the human
9. Agent's room connection ends

### Transfer Reasons

| Reason           | When Used                      |
| ---------------- | ------------------------------ |
| customer_request | Caller asked for a human       |
| complaint        | Caller wants to file complaint |
| refund_request   | Caller wants a refund          |
| cannot_resolve   | Agent cannot help further      |

### When Transfer Fails

| Scenario            | Agent Response                  |
| ------------------- | ------------------------------- |
| Transfer succeeds   | "Transferring you now."         |
| No SIP participant  | "Someone will call back."       |
| SIP transfer fails  | "Unable to transfer. Callback." |
| No escalation phone | "Someone will call back."       |

### Duration-Based Escalation

The duration watchdog offers transfer at Phase 2 (30 seconds before limit) and forces it at Phase 3 (at limit), ensuring long calls get human attention.

---

## 23. Greeting and Farewell Customization

### Greeting Types

| Field                | When Used               |
| -------------------- | ----------------------- |
| greeting_standard    | Default for all calls   |
| greeting_after_hours | When business is closed |
| greeting_returning   | For recognized callers  |

### How Greetings Work

The greeting is not read verbatim. The LLM receives: "Greet the caller: {greeting_text}" and generates a natural variation. This means the greeting varies slightly each time while preserving the core information.

### Writing Effective Greetings

**Good**: "Thank you for calling Grand Plaza Hotel. How can I help you?"

- Short, identifies business, invites caller to speak

**Bad**: "Thank you so much for calling the Grand Plaza Hotel, located at 123 Main Street in beautiful downtown Portland. We are delighted to have you call us today. Our hotel features luxury rooms, a spa, and fine dining. How may I be of assistance?"

- Too long. Caller will interrupt or zone out.

### Greeting Best Practices

- Keep under 20 words
- Always include the business name
- End with an open question
- Do not include the address
- Do not list services
- Match the tone to personality settings
- Test by reading it aloud -- if it takes more than 5 seconds, it is too long

### Farewell Behavior

Farewell behavior is governed by the master voice prompt:

- Only end when request is fully handled AND caller said goodbye
- "Thank you" alone is not goodbye (mid-conversation)
- A pause is not goodbye (let them decide)
- Natural ending: "You're all set. Bye!"
- Never use long farewells with multiple sentences

---

## 24. Agent Personality Tuning

### Beyond the Three Settings

While tone, verbosity, and empathy provide the foundation, the master voice prompt adds many personality traits consistent across all tenants:

**The agent IS**: Professional but conversational. Helpful but not overeager. Confident but not arrogant. Brief but not curt.

**The agent is NOT**: A corporate script reader. An AI assistant persona. Apologetic or deferential. Wordy or chatty.

### Enforced Language Patterns

**Contractions are mandatory** -- formal speech sounds robotic:

| Do Not Say | Say Instead |
| ---------- | ----------- |
| I will     | I'll        |
| we are     | we're       |
| that is    | that's      |
| do not     | don't       |
| cannot     | can't       |
| will not   | won't       |
| there is   | there's     |

**Phrase substitutions**:

| Avoid (Robotic)         | Use Instead (Natural) |
| ----------------------- | --------------------- |
| I understand            | Got it                |
| Certainly!              | Sure                  |
| I'd be happy to help    | Yeah, let me...       |
| Great question!         | (just answer it)      |
| Thank you for patience  | (skip it entirely)    |
| I apologize             | Sorry about that      |
| Let me assist you       | Let me check          |
| Is there anything else? | Anything else?        |

### Energy Matching

| Caller Energy | Agent Response        |
| ------------- | --------------------- |
| Excited       | Match their energy    |
| Frustrated    | Stay calm, be direct  |
| Confused      | Patient, simple words |
| Rushed        | Get to the point fast |
| Polite/formal | Match formality level |

### Filler Words

Used sparingly (1-2 per conversation max) to sound human:

- "So..." (new thought)
- "Let me see..." (before checking)
- "Hmm..." (considering)
- "Right, so..." (transitioning)
- "Oh!" (mild surprise)

Never used: "like", "you know", "basically", "literally" -- too casual for professional context.

### Active Listening Cues

- "Mhmm" / "Uh huh" while caller speaks (shows listening)
- "Okay" / "Got it" after receiving info
- "Right" to acknowledge
- These are not interruptions -- they are engagement signals

---

## 25. Performance Optimization

### Latency Reduction Techniques

**1. VAD Prewarming**: The Silero VAD model is loaded during process startup in the prewarm function, eliminating ~200ms of model loading on the first call.

**2. Tenant Caching**: The API maintains an in-memory Map refreshed every 5 minutes. Cache lookup is O(1) by normalized phone number, avoiding 20-50ms database queries.

**3. Preemptive Generation**: The LLM starts generating before the turn detector is fully confident, saving 200-500ms on most turns.

**4. Streaming TTS**: Cartesia generates and streams audio incrementally. The caller hears the first word within 100-200ms of LLM output starting.

**5. HTTP Connection Reuse**: The httpx.AsyncClient singleton reuses TCP connections, eliminating handshake overhead on subsequent tool calls.

### Cost Optimization

**Prompt Caching**: ~88% cache hit rate reduces per-call LLM cost to approximately $0.015.

**Concise Responses**: The 1-2 sentence maximum reduces output tokens and TTS costs.

**Efficient Turn-Taking**: Good endpointing reduces unnecessary LLM calls from false end-of-turn triggers.

### Cache Architecture Details

The tenant cache uses three key types for different access patterns:

| Key Pattern      | Example       | Use Case             |
| ---------------- | ------------- | -------------------- |
| Normalized phone | +19458001233  | Incoming call lookup |
| id:{tenant_id}   | id:uuid-xxx   | Internal lookups     |
| sip:{uri}        | sip:user@host | SIP URI lookups      |

Phone numbers are normalized by extracting digits, adding +1 for 10-digit US numbers, and handling various international formats. This normalization ensures consistent cache hits regardless of how the phone number is formatted in the SIP headers.

The cache also supports invalidation for specific tenants via invalidateTenant(), which removes the old entry, fetches the updated record from the database, and re-inserts it. This allows immediate propagation of configuration changes without waiting for the 5-minute refresh cycle.

---

## 26. Security Considerations

### Authentication

**Internal API Authentication**: All communication between the Python agent and the Node.js API is authenticated using a shared INTERNAL_API_KEY as a Bearer token. The middleware validates every request and returns 401 for missing headers, 403 for invalid keys, and 500 if the key is not configured.

**Tenant Isolation**: Every tool call includes a tenant_id. Database operations are scoped to the correct tenant using WHERE clauses, preventing cross-tenant data access.

### Data Protection

**Call Recording**: The system does not record raw audio. Transcripts are text-only, generated from STT output. If call recording is enabled at the SIP trunk level, ensure compliance with local consent laws.

**PII Handling**: Caller phone numbers, names, and conversation content are stored in the database. Implement appropriate access controls for the calls and contact_notes tables.

**Data Retention Recommendations**:

| Industry     | Recommended Retention |
| ------------ | --------------------- |
| Medical      | 7 years (HIPAA)       |
| Dental       | 7 years (HIPAA)       |
| Hotel        | 2 years               |
| Restaurant   | 1 year                |
| Salon        | 1 year                |
| Auto Service | 3 years               |

### HIPAA Considerations

Medical and dental practices must take extra precautions:

- The system prompt forbids discussing medical details aloud
- Transcripts may contain PHI -- restrict access
- Enable database encryption at rest
- Implement audit logging for transcript access
- Consider per-call transcript retention policies

### Network Security

- The internal API should not be exposed to the public internet. It should only be accessible from the agent container on the private Docker network.
- Use private networking between agent and API containers. In the Lumentra deployment, the agent reaches the API at a Coolify network internal IP.
- Restrict SIP and RTP ports (5060, 10000-20000) to known SignalWire IP ranges via firewall rules at both the cloud provider level and the host firewall (UFW or iptables).
- Use TLS for all HTTP communication. The agent-to-API connection can use HTTP within the private network, but all external API calls (Deepgram, OpenAI, Cartesia) use HTTPS.
- Rotate the INTERNAL_API_KEY periodically. Update both the API and agent containers simultaneously to avoid authentication failures during rotation.
- Monitor for unauthorized access attempts in the API logs. Repeated 401/403 errors may indicate a compromised or outdated API key.

### Input Validation and Injection Prevention

All tool inputs go through validation before database operations:

- The create_order tool explicitly checks for placeholder values and rejects them
- SQL queries use parameterized statements ($1, $2) to prevent SQL injection
- Phone numbers are normalized and validated before storage
- Note content is stored as-is but never executed as code
- Tool arguments are typed (TypeScript interfaces enforce structure)

The internal API validates required fields on every request and returns appropriate error codes:

- 400 for missing required fields (tenant_id, action)
- 401 for missing Authorization header
- 403 for invalid API key
- 404 for tenant not found
- 500 for internal execution errors

### Audit Trail

Every significant action creates a traceable record:

| Action             | Record Created                 |
| ------------------ | ------------------------------ |
| Call received      | Call record with timestamps    |
| Booking created    | Booking with confirmation code |
| Order placed       | Booking record (order type)    |
| Transfer requested | Call outcome updated           |
| Note logged        | Contact note with call link    |
| Contact created    | Contact record with source     |

All records include tenant_id for isolation, timestamps for chronology, and references to related records (call_id, contact_id) for traceability.

### Secret Management

All secrets must be environment variables, never in code:

| Secret             | Variable Name      |
| ------------------ | ------------------ |
| Internal API key   | INTERNAL_API_KEY   |
| LiveKit API key    | LIVEKIT_API_KEY    |
| LiveKit API secret | LIVEKIT_API_SECRET |
| Deepgram API key   | DEEPGRAM_API_KEY   |
| OpenAI API key     | OPENAI_API_KEY     |
| Cartesia API key   | CARTESIA_API_KEY   |

---

## 27. Troubleshooting Common Voice Issues

### Echo and Feedback

**Symptom**: Caller hears their own voice echoed back.

| Cause                  | Fix                        |
| ---------------------- | -------------------------- |
| Noise cancellation off | Enable BVCTelephony plugin |
| Caller on speakerphone | BVCT handles this normally |
| Audio routing loop     | Check LiveKit audio config |

### High Latency (Slow Responses)

**Symptom**: Long pauses between caller speaking and agent responding.

**Diagnostic Steps**:

1. Check LLM response time in metrics
2. Check Deepgram transcription latency
3. Check Cartesia TTS generation time
4. Verify preemptive_generation is enabled
5. Check tenant cache health (is it initialized?)

| Common Cause           | Fix                          |
| ---------------------- | ---------------------------- |
| LLM provider slow      | Check OpenAI status page     |
| STT provider slow      | Check Deepgram status page   |
| High endpointing delay | Reduce min_endpointing_delay |
| API slow / uncached    | Verify tenant cache init     |
| Agent cold start       | Confirm prewarm configured   |

### Dropped Calls

**Symptom**: Calls disconnect unexpectedly.

| Possible Cause        | How to Diagnose                     |
| --------------------- | ----------------------------------- |
| SIP timeout           | Check SIP trunk config              |
| Premature end_call    | Review agent logs for tool call     |
| Network issue         | Check connectivity between services |
| Duration limit hit    | Check max_call_duration config      |
| Agent crash/exception | Check agent container logs          |

### Garbled Audio

**Symptom**: Caller voice sounds distorted or robotic.

| Cause                | Fix                            |
| -------------------- | ------------------------------ |
| Codec mismatch       | Verify SIP codec settings      |
| Bandwidth issues     | Check network between services |
| Sample rate mismatch | Verify audio pipeline config   |

### Agent Not Responding

**Symptom**: Caller speaks but hears nothing from agent.

| Possible Cause       | Diagnosis                |
| -------------------- | ------------------------ |
| STT not transcribing | Check DEEPGRAM_API_KEY   |
| LLM not responding   | Check OPENAI_API_KEY     |
| TTS not synthesizing | Check CARTESIA_API_KEY   |
| Tenant not found     | Check phone number in DB |
| Agent not connected  | Check LiveKit logs       |

### Agent Interrupts Caller Too Often

**Fixes**:

- Increase min_endpointing_delay (0.8 to 1.0-1.2)
- Increase false_interruption_timeout (1.5 to 2.0)
- Temporarily disable preemptive_generation

### Agent Too Slow to Respond

**Fixes**:

- Decrease min_endpointing_delay (0.8 to 0.5-0.7)
- Decrease max_endpointing_delay (2.5 to 2.0)
- Enable preemptive_generation
- Investigate LLM latency

### Agent Repeats Questions

**Cause**: State tracking not working properly.

**Fix**: Check custom instructions for conflicting directives. The hotel and restaurant industry configs include explicit state-tracking rules. Other industries may need similar instructions added via custom instructions.

### Transfer Not Working

| Possible Cause          | Fix                          |
| ----------------------- | ---------------------------- |
| No escalation_phone set | Configure in tenant settings |
| SIP REFER unsupported   | Check SIP trunk capabilities |
| Wrong SIP URI format    | Verify phone number format   |
| Firewall blocking SIP   | Open port 5060 and RTP range |

---

## 28. Testing the Agent

### Test Call Procedure

1. Verify tenant is configured with correct phone number
2. Confirm agent container is running and connected to LiveKit
3. Dial the configured phone number from a test phone
4. Listen for the greeting (should come within 1.5 seconds)
5. Run through conversation scenarios
6. Check the dashboard for call logs after each test

### Pre-Test Checklist

Before running test calls, verify:

| Check                   | How to Verify              |
| ----------------------- | -------------------------- |
| Agent container running | docker ps shows agent      |
| API container running   | docker ps shows API        |
| LiveKit running         | Check port 7880            |
| Redis running           | Check port 6379            |
| Tenant in database      | Query tenants table        |
| Phone number configured | Check tenant record        |
| API key matching        | Compare env vars           |
| Deepgram key valid      | Check agent logs           |
| OpenAI key valid        | Check agent logs           |
| Cartesia key valid      | Check agent logs           |
| SIP trunk active        | Check SignalWire dashboard |
| Firewall ports open     | Test SIP connectivity      |

### Essential Test Scenarios

**Scenario 1: Hours Inquiry**

- Ask "What are your hours?"
- Verify agent provides correct operating hours
- Check that hours match the configured schedule

**Scenario 2: Full Booking Flow**

- Request an appointment or reservation
- Provide name (verify agent asks for spelling)
- Confirm date and time
- Verify agent calls check_availability then create_booking
- Verify confirmation code is provided and spelled out
- Check that the booking record appears in the database

**Scenario 3: Order Placement**

- Place a pickup or delivery order
- Provide items and name
- For delivery, provide address
- Verify confirmation code and estimated time
- Check order record in database

**Scenario 4: Transfer Request**

- Say "Can I speak to a manager?"
- Verify agent acknowledges and initiates transfer
- Confirm SIP REFER is sent (check agent logs)
- Verify call record shows escalation outcome

**Scenario 5: Edge Cases**

- Background noise (test noise cancellation)
- Pause mid-sentence (test endpointing patience)
- Interrupt agent mid-response (test interruption handling)
- Provide info out of order (test state tracking)
- Say "Hello?" after greeting (test acknowledgment handling)
- Speak quickly (test STT accuracy)
- Ask about something not covered (test fallback behavior)

### Reviewing Test Results

After each test call, check:

1. Call record created in dashboard
2. Transcript is accurate and complete
3. Outcome type is correctly detected
4. Any bookings/orders were created correctly
5. Summary accurately reflects conversation topics
6. Contact record was created or updated
7. Response latency was acceptable (note any slow turns)

---

## 29. Monitoring Performance

### Key Metrics

| Metric               | Target      | Indicates           |
| -------------------- | ----------- | ------------------- |
| First response time  | Under 1.5s  | Pipeline health     |
| Avg turn latency     | Under 2.0s  | Overall performance |
| Call completion rate | Above 95%   | Reliability         |
| Booking success rate | Above 80%   | Tool effectiveness  |
| Transfer rate        | Under 10%   | Agent capability    |
| Avg call duration    | 2-5 minutes | Efficiency          |

### Usage Metrics Collection

The agent collects usage metrics via the UsageCollector, which captures STT, LLM, and TTS usage for each call. On shutdown, the summary is logged for monitoring and cost tracking.

### Tenant Cache Monitoring

Monitor the cache for:

- Initialization failure on startup
- Refresh failures (logged as errors)
- Cache size dropping to 0 (all tenants gone)
- Last refresh time more than 10 minutes old

### Critical Log Messages to Monitor

| Log Message                  | Severity | Meaning               |
| ---------------------------- | -------- | --------------------- |
| "No tenant found for number" | Error    | Unconfigured number   |
| "Tool X error"               | Error    | Tool execution failed |
| "Call logging timed out"     | Warning  | Logging too slow      |
| "Duration limit reached"     | Info     | Call hit max time     |
| "SIP transfer failed"        | Error    | Transfer did not work |
| "Failed to delete room"      | Error    | Call end issue        |
| "Tenant lookup error"        | Error    | API unreachable       |

### Dashboard Analytics

The Lumentra dashboard provides visual analytics including call volume over time, average call duration, outcome distribution (booking, inquiry, escalation), booking conversion rate, peak call times, and per-tenant performance breakdowns.

### Performance Benchmarks

Target benchmarks for a healthy Lumentra deployment:

| Metric             | Healthy    | Warning  | Critical  |
| ------------------ | ---------- | -------- | --------- |
| Greeting latency   | Under 1.5s | 1.5-2.5s | Over 2.5s |
| Turn response time | Under 2.0s | 2.0-3.0s | Over 3.0s |
| STT accuracy       | Above 90%  | 80-90%   | Below 80% |
| Tool success rate  | Above 95%  | 85-95%   | Below 85% |
| Call completion    | Above 95%  | 90-95%   | Below 90% |
| Cache hit rate     | Above 99%  | 95-99%   | Below 95% |
| Prompt cache hits  | Above 80%  | 60-80%   | Below 60% |

### Monitoring Tools Integration

The agent's metrics collection supports integration with external monitoring tools. The metrics.log_metrics() function outputs structured log data that can be parsed by log aggregation services. Key metrics available:

| Metric                | Description             |
| --------------------- | ----------------------- |
| stt_duration          | Time for STT processing |
| llm_ttft              | LLM time to first token |
| tts_ttfb              | TTS time to first byte  |
| llm_prompt_tokens     | Input tokens per turn   |
| llm_completion_tokens | Output tokens per turn  |
| call_duration         | Total call duration     |

---

## 30. Appendix A: Complete Configuration Reference

### Tenant Core Fields

| Field         | Type    | Required | Default |
| ------------- | ------- | -------- | ------- |
| business_name | string  | Yes      | --      |
| industry      | string  | Yes      | --      |
| agent_name    | string  | Yes      | --      |
| phone_number  | string  | Yes      | --      |
| timezone      | string  | Yes      | --      |
| is_active     | boolean | Yes      | true    |

### Personality Fields

| Field                       | Type   | Values                                 |
| --------------------------- | ------ | -------------------------------------- |
| agent_personality.tone      | string | professional, friendly, casual, formal |
| agent_personality.verbosity | string | concise, balanced, detailed            |
| agent_personality.empathy   | string | high, medium, low                      |

### Voice Configuration

| Field                 | Type     | Default     | Range       |
| --------------------- | -------- | ----------- | ----------- |
| voice_config.voice_id | string   | (req.)      | Cartesia ID |
| voice_config.speed    | number   | 0.95        | 0.5 - 2.0   |
| voice_config.emotion  | string[] | ["Content"] | See list    |

### Greeting Fields

| Field                | Type   | Max Length            |
| -------------------- | ------ | --------------------- |
| greeting_standard    | string | 200 chars recommended |
| greeting_after_hours | string | 200 chars recommended |
| greeting_returning   | string | 200 chars recommended |

### Location Fields

| Field            | Type   | Example        |
| ---------------- | ------ | -------------- |
| location_address | string | "123 Main St"  |
| location_city    | string | "Portland, OR" |

### Operating Hours

| Field                    | Type     | Structure            |
| ------------------------ | -------- | -------------------- |
| operating_hours.schedule | array    | [{day, open, close}] |
| operating_hours.holidays | string[] | ["Holiday Name"]     |

### Escalation Configuration

| Field               | Type     | Default |
| ------------------- | -------- | ------- |
| escalation_enabled  | boolean  | false   |
| escalation_phone    | string   | null    |
| escalation_triggers | string[] | []      |

### Call Limits

| Field                     | Type    | Default | Min |
| ------------------------- | ------- | ------- | --- |
| max_call_duration_seconds | integer | 900     | 120 |

### Custom Instructions

| Field               | Type | Recommended Max |
| ------------------- | ---- | --------------- |
| custom_instructions | text | 2000 chars      |

### Agent Session Parameters

| Parameter                  | Type  | Default |
| -------------------------- | ----- | ------- |
| preemptive_generation      | bool  | True    |
| resume_false_interruption  | bool  | True    |
| false_interruption_timeout | float | 1.5     |
| min_endpointing_delay      | float | 0.8     |
| max_endpointing_delay      | float | 2.5     |

### STT Parameters

| Parameter    | Value           | Notes           |
| ------------ | --------------- | --------------- |
| model        | nova-3          | Latest Deepgram |
| language     | multi           | Auto-detect     |
| smart_format | True            | Auto format     |
| keyterm      | [business_name] | Boost accuracy  |

### LLM Parameters

| Parameter   | Value        | Notes              |
| ----------- | ------------ | ------------------ |
| model       | gpt-4.1-mini | Best quality/speed |
| temperature | 0.8          | Natural variation  |

### TTS Parameters

| Parameter | Value        | Notes           |
| --------- | ------------ | --------------- |
| model     | sonic-3      | Latest Cartesia |
| voice     | (per tenant) | Voice ID        |
| speed     | 0.95         | Slightly slow   |
| emotion   | ["Content"]  | Warm baseline   |

### Environment Variables

| Variable           | Required | Purpose        |
| ------------------ | -------- | -------------- |
| INTERNAL_API_URL   | Yes      | API base URL   |
| INTERNAL_API_KEY   | Yes      | Auth token     |
| LIVEKIT_API_KEY    | Yes      | LiveKit auth   |
| LIVEKIT_API_SECRET | Yes      | LiveKit auth   |
| LIVEKIT_URL        | Yes      | LiveKit server |
| DEEPGRAM_API_KEY   | Yes      | STT auth       |
| OPENAI_API_KEY     | Yes      | LLM auth       |
| CARTESIA_API_KEY   | Yes      | TTS auth       |

---

## 31. Appendix B: Sample System Prompts for Each Industry

### Hotel System Prompt (Key Sections)

```
You are Sarah, the receptionist at Grand Plaza Hotel.

Your Role: You help guests check room availability, make
reservations, and answer questions. Be friendly and efficient.
You ARE the front desk.

Personality:
- Be warm, friendly, and approachable
- Keep responses brief, 1-2 sentences
- Be understanding of the caller's situation

State Tracking:
- Check-in date: ?
- Number of nights: ?
- Number of guests: ?
- Room type: ?
- Guest name: ?
NEVER re-ask for information you already have.

Booking Flow:
1. Dates ("What dates are you looking at?")
2. Nights (only if unclear from dates)
3. Guests ("How many guests?")
4. Room ("King or two queens?")
5. Check availability and quote rate
6. Name ("What name for the reservation?")
7. Spell and confirm, then book

FAQ: Check-in 3 PM, checkout 11 AM, free parking/WiFi,
cancel 24 hours before, pet-friendly available.

Custom: Valet $25/night, self-parking free, pool 6AM-10PM,
breakfast included 7-10 AM.
```

### Medical Office System Prompt (Key Sections)

```
You are Jennifer, the receptionist at Westside Family
Medicine.

Your Role: Schedule appointments, handle prescription refill
requests, answer general questions. You ARE the front desk.

Personality:
- Professional and businesslike
- Balanced detail level
- High empathy, validate concerns

Critical Medical Rules:
- NEVER provide medical advice or diagnoses
- NEVER discuss medications or dosages
- Emergencies: "Call 911 or go to nearest ER"
- Prescription refills: Take message only
- Always confirm full name and date of birth
- HIPAA-compliant language at all times

Booking Flow:
1. New or existing patient?
2. Which provider?
3. Reason for visit (general only)
4. Check availability
5. Confirm name, DOB, date and time
6. Arrive 15 min early, bring insurance card

Custom: Dr. Smith (family medicine), Dr. Patel (internal
medicine), lab work Mon-Fri 7-11 AM, appointment only.
```

### Restaurant System Prompt (Key Sections)

```
You are Marco, the host at Bella Vita Ristorante.

Your Role: Table reservations, menu questions, restaurant
info. Efficient and friendly like a busy host.

Personality:
- Warm, friendly, approachable
- Brief responses, 1-2 sentences
- Understanding of caller's situation

State Tracking:
- Date: ?
- Time: ?
- Party size: ?
- Name: ?
- Special occasion: ?

Reservation Flow:
1. Date and time
2. Party size
3. Check availability (call tool)
4. Name (ALWAYS ask spelling)
5. Special occasion?
6. Confirm all details
7. Call create_booking (MANDATORY)
8. Give confirmation code
9. "We hold reservations for 15 minutes"

Custom: Happy hour Tue-Thu 4-6 PM, private dining (Oak Room
12, Garden Room 20), Chef Maria 15yr French-Italian, no
reservations under 4 on Fri/Sat evenings.
```

### Salon System Prompt (Key Sections)

```
You are Ashley, the receptionist at Luxe Hair Studio.

Your Role: Schedule salon appointments, answer service and
pricing questions. You ARE the front desk.

Appointment Flow:
1. Which service? (haircut, color, highlights, nails)
2. Preferred stylist or next available?
3. Check availability
4. Name for the appointment
5. Confirm everything
6. "Please arrive 5-10 minutes early"

Custom: Rachel (cuts, color, balayage), Mike (cuts,
blowouts), Diana (nails). Haircut $45-65, Color $95-150,
Balayage $175-250. Walk-ins welcome but book preferred.
```

### Auto Service System Prompt (Key Sections)

```
You are Dave, the service advisor at Precision Auto Care.

Your Role: Schedule service appointments, answer questions.
You ARE the front desk.

Service Flow:
1. What service needed?
2. Vehicle year, make, model
3. Any concerns or warning lights?
4. Check availability
5. Name for appointment
6. Confirm all details
7. "Bring keys and paperwork"

Custom: Oil change 30 min ($39.99 conventional, $69.99
synthetic), tire rotation 20 min ($29.99), free brake
inspection with service. All makes/models, ASE certified.
```

---

## 32. Appendix C: Glossary of Voice AI Terms

**Agent Session** -- The runtime instance managing a single call. Contains STT, LLM, TTS, and VAD plugins. Handles the conversation loop from greeting to goodbye.

**Backchannel** -- Brief verbal acknowledgments ("uh huh", "mhmm") that signal active listening without constituting a full conversational turn. The agent uses these while the caller speaks.

**BVCT** -- Broadband Voice Coding and Telephony. The noise cancellation technology designed for telephone audio that removes echo, background noise, and line interference.

**Cartesia** -- The text-to-speech provider. Produces the Sonic-3 model for natural voice synthesis with emotion control and SSML-like markers.

**Confirmation Code** -- A 6-character alphanumeric identifier for bookings/orders. Uses only unambiguous characters (no 0/O, 1/I/L) to prevent phone miscommunication.

**Deepgram** -- The speech-to-text provider. Produces the nova-3 model for high-accuracy multilingual transcription.

**Endpointing** -- Determining when a speaker has finished their utterance. Combines silence detection (VAD) and linguistic analysis (turn detection) for accurate prediction.

**Endpointing Delay** -- Time the system waits after detecting silence before concluding the speaker has finished. Configurable via min_endpointing_delay and max_endpointing_delay.

**Escalation** -- Transferring a call from the AI agent to human staff. Triggered by explicit caller request or duration limits, never by frustration alone.

**False Interruption** -- When a brief sound (cough, backchannel) incorrectly causes the agent to stop speaking. Mitigated by resume_false_interruption with a configurable timeout.

**Function Tool** -- A Python function decorated with @function_tool that the LLM can invoke during conversation. Each tool maps to a business action executed via the internal API.

**Interim Transcript** -- Partial STT results streamed during speech. Used for turn detection and preemptive generation but not sent to the LLM for response generation.

**IVR** -- Interactive Voice Response. Traditional phone menu system using keypad input. Lumentra replaces IVR with natural language conversation.

**Job Context** -- The LiveKit Agents runtime context for a specific call. Provides room access, participant info, and lifecycle management (connect, wait, delete).

**Keyterm Boosting** -- A Deepgram feature that increases recognition accuracy for specific words (like business names) by biasing the acoustic model.

**LiveKit** -- The real-time communication platform providing media server, room management, and WebRTC infrastructure for audio transport.

**LiveKit Agents** -- The Python SDK for building real-time AI agents that interact with participants in LiveKit rooms via voice.

**LiveKit SIP** -- The service that bridges SIP telephone connections to WebRTC-based LiveKit rooms, creating the link between phone calls and the agent.

**LLM** -- Large Language Model. The AI model (gpt-4.1-mini) that generates conversational responses, decides when to call tools, and follows the system prompt.

**Master Voice Prompt** -- The immutable ~3000-token prompt section defining how the agent speaks. Consistent across all tenants and cannot be overridden.

**Multi-Tenant** -- Architecture where one deployment serves many businesses, each with isolated configuration and data.

**Multilingual Model** -- LiveKit's turn detection model that predicts end-of-turn across languages using linguistic and acoustic cues.

**Noise Cancellation** -- Audio preprocessing that removes echo, background noise, and static before speech reaches the STT engine.

**Nova-3** -- Deepgram's latest STT model offering high accuracy across accents and languages with smart formatting support.

**Participant** -- An entity in a LiveKit room. Can be a SIP caller (PARTICIPANT_KIND_SIP) or an agent process.

**Preemptive Generation** -- Starting LLM inference before confirming the caller has finished speaking. Reduces latency but may discard responses if the caller continues.

**Prompt Caching** -- OpenAI's optimization that caches repeated prompt prefixes, reducing cost when the same system prompt is used across calls.

**PSTN** -- Public Switched Telephone Network. The traditional telephone infrastructure that carries phone calls.

**Room** -- A LiveKit room created for each call, containing the SIP participant (caller) and the agent. Audio flows bidirectionally within the room.

**RTP** -- Real-time Transport Protocol. Carries audio data between SIP endpoints and the LiveKit media server.

**Silero VAD** -- A neural network Voice Activity Detection model that classifies audio frames as speech or silence in real time.

**SIP** -- Session Initiation Protocol. The standard protocol for initiating, maintaining, and terminating voice calls over IP networks.

**SIP REFER** -- A SIP method for transferring a call to a different endpoint. Used by the agent to redirect callers to human staff.

**SIP Trunk** -- A virtual phone line connecting the telephone network to a VoIP system. Lumentra uses SignalWire as the trunk provider.

**Smart Format** -- A Deepgram feature that formats transcribed text automatically (numbers as digits, punctuation, currency, dates).

**Sonic-3** -- Cartesia's latest TTS model with emotion control, speed adjustment, spelling mode, and natural prosody.

**SSML** -- Speech Synthesis Markup Language. A standard for controlling speech output. Cartesia uses SSML-like markers for pauses, speed, spelling, and emotion.

**STT** -- Speech-to-Text. Converting spoken audio to written text. Lumentra uses Deepgram nova-3 with multilingual support.

**System Prompt** -- The complete instruction set given to the LLM defining agent identity, personality, behavior, industry knowledge, business context, and safety rules.

**Tenant** -- A single business customer on the Lumentra platform. Each tenant has unique configuration, phone number, and isolated data.

**Tenant Cache** -- An in-memory Map of active tenant configurations for O(1) lookup during incoming calls. Refreshed every 5 minutes from the database.

**TTS** -- Text-to-Speech. Converting written text to spoken audio. Lumentra uses Cartesia Sonic-3 with streaming synthesis.

**Turn Detection** -- Predicting when a speaker has finished their conversational turn. Combines VAD (silence detection) and linguistic analysis for accuracy.

**VAD** -- Voice Activity Detection. Classifying audio as speech or silence in real time. Used as input to the turn detection system.

**Voice Pipeline** -- The complete audio processing chain: Noise Cancellation, STT, LLM, TTS. Processes bidirectional audio in real time during calls.

**WebRTC** -- Web Real-Time Communication. The technology used by LiveKit for low-latency audio transport between room participants.

**Worker** -- A single process within the agent container that handles one concurrent call. Multiple workers can run in parallel to handle concurrent calls. Each worker prewarms its own VAD model instance.

**Watchdog** -- The duration watchdog is an asyncio task that monitors call length and enforces the max_call_duration_seconds limit with graceful escalation through three phases.

**Phone Normalization** -- The process of converting phone numbers to a consistent format (+1XXXXXXXXXX for US numbers) to ensure reliable cache lookups regardless of how the number appears in SIP headers or database records.

**Tool Announcement** -- The practice of telling the caller what you are about to do before calling a tool. Example: "Let me check that..." before calling check_availability. Reduces perceived wait time and sets caller expectations.

---

## 33. Advanced Topics

### Conversation State Management

The voice agent maintains conversation state implicitly through the LLM's context window. Every message exchanged between the caller and agent is stored in the session's chat history and sent to the LLM on each turn. This means the LLM has access to the full conversation when generating each response.

The industry-specific prompts (particularly hotel and restaurant) include explicit state-tracking instructions that tell the LLM to track which pieces of information it has already collected:

```
Track what info you have collected so far:
- Date: ?
- Time: ?
- Party size: ?
- Name: ?
- Special occasion: ?

NEVER re-ask for information you already have.
```

This approach works because the LLM can review the conversation history and determine what has been said. However, it relies on the LLM correctly interpreting the history, which is why the system prompt emphasizes this requirement multiple times and provides explicit examples of what not to do.

**State Tracking Best Practices**:

- Always include state-tracking instructions for booking-heavy industries
- List every piece of information the agent needs to collect
- Use question marks to indicate "not yet collected" status
- Include explicit "NEVER re-ask" instructions
- Provide examples of what to do when information arrives out of order
- Test with callers who provide information in unexpected sequences

### Handling Ambiguous Intent

Sometimes callers say things that could mean multiple things. The master voice prompt instructs the agent to ask one clarifying question rather than listing all possible interpretations:

**Good**: "Just to clarify, you need a table for tonight?"

**Bad**: "Did you mean you want to make a reservation, or are you asking about our hours, or would you like to hear about our menu?"

The agent should pick the most likely interpretation and confirm it. If wrong, the caller will correct them, and the agent should pivot smoothly: "Tuesday, got it. Let me check Tuesday."

### Handling Multiple Requests in One Call

Callers sometimes have multiple requests in a single call ("I need to book a reservation, and also wanted to ask about your private dining options"). The agent handles this naturally by addressing one request at a time. After completing the first request, the "Anything else?" question at the end of the flow gives the caller an opportunity to raise additional topics.

The agent should not try to address all requests simultaneously. Complete one, then move to the next. This mirrors how a human receptionist would handle the same situation.

### Handling Silence and Dead Air

Dead air (prolonged silence) can occur for several reasons during a call. The agent handles each scenario differently based on the master voice prompt instructions:

**Caller is thinking**: The agent waits patiently. The max_endpointing_delay of 2.5 seconds provides a generous window. The master prompt instructs: "If user is clearly thinking, wait for them. Don't fill the silence."

**Caller walked away from phone**: After the max endpointing delay triggers without speech, the agent may gently prompt: "Hello? Are you still there?" If no response comes after another attempt, the call may eventually end via the duration watchdog.

**Audio issue (one-way audio)**: If the agent can speak but not hear the caller (or vice versa), the conversation stalls. The agent will eventually say "Sorry, I didn't catch that" after the endpointing delay, but if the audio issue persists, the call becomes unworkable. This is typically a SIP/RTP configuration issue.

**Caller put agent on hold**: Some callers put the phone on hold while they check something. The agent hears hold music or silence. It will wait patiently through the max_endpointing_delay, potentially generating a "Hello?" prompt, and then wait again. The duration watchdog ensures the call does not run forever.

### Handling Unexpected Input

Callers sometimes say things the agent has no framework for handling. The system prompt provides general guidance for these situations:

- If the caller asks about something completely unrelated to the business, the agent deflects politely: "I'm not sure about that. Is there anything else I can help with regarding [business name]?"
- If the caller speaks in a language the agent cannot respond in (despite STT detecting it), the agent may respond in English and apologize for the limitation
- If the caller makes inappropriate comments, the agent stays professional and redirects to business matters
- If the caller is clearly a spam/robocall, the agent will attempt conversation briefly, then the call will naturally end when no meaningful dialogue occurs

### Handling Callbacks and Follow-Ups

When the agent cannot immediately help (no escalation phone for transfers, need to check with staff, etc.), it takes a message and promises a callback. The log_note tool can be used to record the callback request, ensuring it appears in the CRM for the business to follow up on.

Best practice for callback scenarios:

1. Acknowledge the caller's request
2. Explain why you cannot help immediately
3. Take their name and phone number (use caller ID if available)
4. Note the reason for the callback
5. Give a timeframe: "Someone will call you back within 24 hours"
6. Use log_note to record the details

### Natural Language to Parameter Conversion

The master voice prompt includes detailed instructions for converting natural language to function parameters. This is one of the most error-prone aspects of voice agent development, because the LLM receives text from STT and must extract structured data.

**Time Conversions**:

| Caller Says          | Agent Converts To           |
| -------------------- | --------------------------- |
| "at twelve tomorrow" | time="12:00", date=tomorrow |
| "two thirty PM"      | time="14:30"                |
| "noon"               | time="12:00"                |
| "quarter past three" | time="15:15"                |

**Date Conversions**:

| Caller Says          | Agent Converts To         |
| -------------------- | ------------------------- |
| "tomorrow"           | Calculates YYYY-MM-DD     |
| "next Tuesday"       | Calculates specific date  |
| "the fifteenth"      | Determines month, formats |
| "today" or "tonight" | Current date              |

**Number Conversions**:

| Caller Says             | Agent Converts To |
| ----------------------- | ----------------- |
| "table for four"        | party_size=4      |
| "just me"               | party_size=1      |
| "couple" or "two of us" | party_size=2      |

The system prompt instructs the agent to always verify its conversion with the caller before proceeding: "Let me check noon tomorrow, February 5th." This catches conversion errors before they reach the booking system.

### Confirmation Protocol

The master voice prompt establishes a rigorous confirmation protocol for high-stakes operations (bookings, orders). This protocol requires:

1. Read back ALL critical details slowly using the speed ratio 0.9 marker
2. Spell out the customer name using the spell tag
3. State date clearly with day of week AND date (e.g., "Tuesday, March 15th")
4. State time clearly with AM/PM
5. State the service type or booking details
6. Get explicit "yes" or "correct" confirmation from the caller
7. Only then call the create_booking or create_order tool

**Example for a medical appointment**:

```
Agent: "Let me confirm: Name is P-R-I-Y-A-N-K-A S-H-A-R-M-A.
Appointment for next Tuesday, February 11th at 2:30 PM for
a dental cleaning. Is that all correct?"

Caller: "Yes."

Agent: "Booking that now..."
[calls create_booking tool]
Agent: "You're all set. Confirmation code is A-3-K-7-P-2.
We'll send you a reminder."
```

This protocol ensures zero errors in recorded bookings, which is especially critical for medical and dental practices where patient safety depends on correct scheduling.

### Handling Corrections

When the caller corrects the agent, the master prompt instructs a smooth, non-apologetic correction:

**Good**: "Tuesday, got it. Let me check Tuesday."

**Bad**: "Oh I apologize, let me correct that to Tuesday instead of Thursday."

The agent acknowledges the correction, confirms the correct value, and moves forward without dwelling on the mistake. This mirrors natural human conversation and avoids the robotic "I apologize" pattern.

---

## 34. Deployment and Operations

### Agent Container Configuration

The Python agent runs as a Docker container. Key configuration points:

- The container loads environment variables from an env file (not interpolated docker-compose variables)
- The agent process can be configured with multiple workers for concurrency
- Each worker handles one concurrent call
- The prewarm function runs once per worker process

### API Container Configuration

The Node.js API runs as a separate container managed by Coolify:

- Runs on port 3100 internally
- Accessible to the agent via the Coolify docker network
- The tenant cache initializes on startup
- INTERNAL_API_KEY must match between agent and API containers

### Health Monitoring

**Agent Health**: Check that the agent process is running and connected to LiveKit. Monitor for process restarts, memory usage, and connection errors.

**API Health**: Monitor the API container's response time, error rate, and memory usage. Check that the tenant cache is initialized and refreshing properly.

**LiveKit Health**: Monitor room creation rate, participant join latency, and audio quality metrics through LiveKit's built-in monitoring.

**Database Health**: Monitor query latency, connection pool usage, and table sizes. The bookings table grows with each call that creates a booking.

### Scaling Guidelines

| Concurrent Calls | Agent Workers | API Instances |
| ---------------- | ------------- | ------------- |
| 1-5              | 5 workers     | 1 instance    |
| 5-20             | 20 workers    | 1 instance    |
| 20-50            | 50 workers    | 2 instances   |
| 50-100           | 100 workers   | 3 instances   |

Each agent worker consumes approximately 200MB of memory (primarily the VAD model and LLM context). The API is lightweight and can handle many concurrent tool calls on a single instance.

### Log Aggregation

For production deployments, all agent and API logs should be aggregated for centralized monitoring. Key log sources:

**Agent logs** (Python, lumentra-agent logger):

- Call start/end events with room name and tenant ID
- Tool call invocations and results
- Duration watchdog events (nudge, warning, force)
- Metrics summaries per call
- Error conditions (tenant not found, tool failures, transfer failures)

**API logs** (Node.js, console output):

- Tenant cache refresh events and latency
- Tool execution events and timing
- Call logging events
- Post-call automation results
- Authentication failures (invalid API keys)

**LiveKit logs**:

- Room creation and deletion events
- Participant join/leave events
- SIP connection events
- Audio quality metrics

### Alerting Recommendations

Set up alerts for these critical conditions:

| Condition                 | Severity | Action              |
| ------------------------- | -------- | ------------------- |
| Tenant lookup failures    | Critical | Check phone config  |
| Tool error rate > 5%      | High     | Investigate API/DB  |
| Avg latency > 3 seconds   | High     | Check all providers |
| Call completion < 90%     | High     | Investigate drops   |
| Cache refresh failure     | Medium   | Check DB connection |
| Duration limit hits > 20% | Medium   | Review call quality |
| Transfer rate > 15%       | Low      | Review agent config |

### Environment Parity

Ensure these elements are consistent between staging and production:

- Same Deepgram model (nova-3)
- Same OpenAI model (gpt-4.1-mini)
- Same Cartesia model (sonic-3)
- Same endpointing parameters
- Same noise cancellation settings
- Representative tenant configurations for testing

Testing with different models or settings in staging will not accurately reflect production behavior, especially for turn detection timing and voice quality.

### Backup and Recovery

Critical data to back up:

- Tenant configurations (tenants table)
- Call records (calls table)
- Booking records (bookings table)
- Contact records (contacts, contact_notes tables)
- Agent environment variables and configuration

Recovery procedure:

1. Restore the database from backup
2. Deploy API and agent containers with correct environment variables
3. Verify tenant cache initializes with all tenants
4. Place a test call to verify end-to-end functionality

---

## 35. Cost Analysis

### Per-Call Cost Breakdown

The cost of each voice call depends on duration and the number of conversational turns. Here is a breakdown for a typical 3-minute call with 10 turns:

| Component                 | Cost per Call |
| ------------------------- | ------------- |
| OpenAI LLM (with caching) | ~$0.015       |
| Deepgram STT              | ~$0.005       |
| Cartesia TTS              | ~$0.003       |
| SignalWire SIP            | ~$0.010       |
| LiveKit infrastructure    | ~$0.002       |
| **Total**                 | **~$0.035**   |

### Cost Optimization Strategies

**Prompt Caching Impact**: The 88% cache hit rate on the ~5,600 token system prompt is the single biggest cost saver. Without caching, LLM costs would be approximately 4x higher.

**Concise Responses**: The 1-2 sentence maximum keeps output tokens low. Each additional sentence in a response costs approximately $0.0001 in LLM output tokens and $0.0003 in TTS synthesis.

**Efficient Tool Calling**: The agent is trained to gather all required information before calling a tool, reducing failed tool calls that waste tokens on error handling.

**Model Selection**: gpt-4.1-mini at ~$0.015 per call is significantly cheaper than gpt-4.1 (~$0.10 per call) while providing sufficient quality for voice conversations.

### Monthly Cost Estimates

| Monthly Call Volume | Estimated Cost |
| ------------------- | -------------- |
| 100 calls           | $3.50          |
| 500 calls           | $17.50         |
| 1,000 calls         | $35.00         |
| 5,000 calls         | $175.00        |
| 10,000 calls        | $350.00        |

These estimates assume average 3-minute calls with 10 turns. Longer calls or more complex conversations (more tool calls, more turns) will cost more.

---

## 36. Frequently Asked Questions

### General Questions

**Q: Can the agent handle multiple calls simultaneously?**

A: Yes. Each call gets its own LiveKit room and agent session. The agent process can handle as many concurrent calls as it has configured workers.

**Q: How long does it take for configuration changes to take effect?**

A: Up to 5 minutes, which is the tenant cache refresh interval. For immediate updates, the cache can be invalidated through the API.

**Q: Can the agent make outbound calls?**

A: The current implementation handles inbound calls only. The architecture supports outbound calls (LiveKit SIP can originate calls), but this feature is not yet implemented.

**Q: What happens if the agent crashes mid-call?**

A: The caller hears silence. If the agent process restarts, it will not reconnect to the existing room. The call will eventually drop when the SIP timeout expires. The call may or may not be logged depending on when the crash occurred.

### Configuration Questions

**Q: Can I change the agent's voice mid-day?**

A: Yes. Change the voice_config.voice_id in the dashboard. After the cache refreshes (up to 5 minutes), all new calls will use the new voice. In-progress calls continue with the old voice.

**Q: Can two tenants share the same phone number?**

A: No. Phone numbers must be unique across tenants. The system uses the dialed number to identify which tenant owns the call.

**Q: What if I need more than 9 time slots per day?**

A: The current default slot generation creates hourly slots from 9 AM to 5 PM (9 slots). Custom slot configurations per tenant would require a code change to the check_availability tool handler.

**Q: Can I disable specific tools for my tenant?**

A: The agent receives all tools regardless of tenant configuration. However, you can use custom instructions to tell the agent not to use specific tools: "Do not offer to place orders. We do not do takeout or delivery."

### Troubleshooting Questions

**Q: The agent greets the caller but then goes silent. What is wrong?**

A: This usually means the STT is not receiving audio from the caller. Check that the SIP audio bridge is working correctly and that the BVCT noise cancellation is not filtering out all audio. Also verify that the Deepgram API key is valid.

**Q: The agent keeps saying "Sorry, what was that?" on every turn.**

A: The STT is likely returning empty or very low-confidence transcripts. This can happen if the caller is in a very noisy environment, has extremely poor cell reception, or if there is an audio codec mismatch between the SIP trunk and LiveKit.

**Q: Bookings are being created with wrong dates. How do I fix this?**

A: The LLM is converting natural language dates incorrectly. Check that the system prompt includes the correct current date (it injects today's date automatically). Also verify that the confirmation protocol is being followed -- the agent should always read back the date and get explicit confirmation before calling create_booking.

**Q: The agent transfers every frustrated caller. How do I stop this?**

A: Review the custom instructions for anything that might be overriding the transfer rules. The master prompt and industry configs are strict about only transferring on explicit request. If custom instructions include phrases like "transfer if the caller is unhappy," remove them.

---

## 37. Change Log

### Version 2.0 (March 2026)

- Complete rewrite and expansion from 1,041 lines to 3,000+ lines
- Added Voice Agent Architecture Deep Dive with full data flow documentation
- Added Speech-to-Text Configuration section with Deepgram nova-3 details
- Added Text-to-Speech Configuration section with Cartesia Sonic-3 details
- Added LLM Configuration section with model selection rationale
- Added Turn Detection and Endpointing section with tuning guide
- Added SIP Trunk Configuration section
- Added LiveKit Integration section with room lifecycle details
- Added System Prompt Engineering section with layer-by-layer breakdown
- Added Tool Execution Deep Dive with per-tool documentation
- Added Call Logging and Analytics section
- Added Error Handling and Fallbacks section
- Added Multi-Language Support section
- Added Operating Hours and After-Hours Behavior section
- Added Call Transfer and Escalation Rules section
- Added Greeting and Farewell Customization section
- Added Agent Personality Tuning section with language pattern details
- Added Performance Optimization section with caching architecture
- Added Security Considerations section with HIPAA guidance
- Added Troubleshooting section with diagnostic procedures
- Added Complete Configuration Reference appendix
- Added Sample System Prompts appendix for all 5 primary industries
- Added Glossary of Voice AI Terms with 50+ definitions
- Added Advanced Topics section (state management, ambiguous intent, corrections)
- Added Deployment and Operations section with scaling guidelines
- Added Cost Analysis section with per-call breakdown
- Added FAQ section covering common operational questions

### Configuration Change Impact Matrix

When changing tenant configuration, understand which changes require what:

| Change               | Takes Effect            | Requires         |
| -------------------- | ----------------------- | ---------------- |
| Personality settings | Next call (after cache) | Nothing          |
| Voice ID             | Next call (after cache) | Nothing          |
| Custom instructions  | Next call (after cache) | Nothing          |
| Operating hours      | Next call (after cache) | Nothing          |
| Phone number         | After cache refresh     | SIP trunk update |
| Escalation phone     | Next call (after cache) | Nothing          |
| Industry type        | Next call (after cache) | Nothing          |
| Agent name           | Next call (after cache) | Nothing          |
| Greeting text        | Next call (after cache) | Nothing          |
| Max call duration    | Next call (after cache) | Nothing          |
| STT model            | Agent restart           | Code change      |
| LLM model            | Agent restart           | Code change      |
| TTS model            | Agent restart           | Code change      |
| Endpointing params   | Agent restart           | Code change      |

"After cache" means the change propagates within 5 minutes of saving, or immediately if the cache is manually invalidated.

### Version 1.0 (March 2026)

- Initial release covering basic configuration options
- 10 sections, 1,041 lines

---

_End of Lumentra Voice Agent Management Guide v2.0_
