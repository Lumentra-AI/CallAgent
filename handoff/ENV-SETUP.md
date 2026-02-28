# Lumentra - Environment Variables and Third-Party Accounts

---

## API Environment Variables (lumentra-api/.env)

### Database (Supabase) - REQUIRED

| Variable                    | Description                  | Where to Get                        |
| --------------------------- | ---------------------------- | ----------------------------------- |
| `SUPABASE_URL`              | Supabase project URL         | Supabase dashboard > Settings > API |
| `SUPABASE_ANON_KEY`         | Public anonymous key         | Supabase dashboard > Settings > API |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin key (server-side only) | Supabase dashboard > Settings > API |

Account needed: https://supabase.com (free tier available)

### LLM Providers

| Variable                   | Description                                                    | Where to Get                           |
| -------------------------- | -------------------------------------------------------------- | -------------------------------------- |
| `OPENAI_API_KEY`           | OpenAI API key (primary voice LLM)                             | https://platform.openai.com/api-keys   |
| `OPENAI_MODEL`             | Model name (default: `gpt-4o-mini`)                            | -                                      |
| `GROQ_API_KEY`             | Groq API key (low-latency fallback)                            | https://console.groq.com/keys          |
| `GROQ_CHAT_MODEL`          | Chat model (default: `llama-3.1-8b-instant`)                   | -                                      |
| `GROQ_TOOL_MODEL`          | Tool-calling model (default: `llama-3.3-70b-versatile`)        | -                                      |
| `GEMINI_API_KEY`           | Google Gemini API key (fallback + chat widget)                 | https://aistudio.google.com/app/apikey |
| `GEMINI_MODEL`             | Model name (default: `gemini-2.5-flash`)                       | -                                      |
| `VOICE_LLM_PROVIDER_ORDER` | Comma-separated fallback order (default: `openai,groq,gemini`) | -                                      |

Accounts needed:

- OpenAI: https://platform.openai.com (paid, required for voice)
- Groq: https://groq.com (free tier available)
- Google AI Studio: https://aistudio.google.com (free tier available)

### Voice Stack - REQUIRED for phone calls

| Variable                | Description                                             | Where to Get                         |
| ----------------------- | ------------------------------------------------------- | ------------------------------------ |
| `DEEPGRAM_API_KEY`      | Deepgram speech-to-text key                             | https://console.deepgram.com         |
| `CARTESIA_API_KEY`      | Cartesia text-to-speech key                             | https://play.cartesia.ai (dashboard) |
| `SIGNALWIRE_PROJECT_ID` | SignalWire project ID                                   | SignalWire dashboard > API           |
| `SIGNALWIRE_API_TOKEN`  | SignalWire API token                                    | SignalWire dashboard > API           |
| `SIGNALWIRE_SPACE_URL`  | SignalWire space URL (e.g., `yourspace.signalwire.com`) | SignalWire dashboard                 |

Accounts needed:

- Deepgram: https://deepgram.com (free credits on signup)
- Cartesia: https://cartesia.ai (requires approval/waitlist)
- SignalWire: https://signalwire.com (paid, provides phone numbers)

### Security Secrets

| Variable                    | Description                                | How to Generate                                  |
| --------------------------- | ------------------------------------------ | ------------------------------------------------ |
| `SIGNALWIRE_WEBHOOK_SECRET` | Validates SignalWire webhooks              | Generate a random string: `openssl rand -hex 32` |
| `STREAM_SIGNING_SECRET`     | Signs WebSocket stream connections         | Generate a random string: `openssl rand -hex 32` |
| `VAPI_WEBHOOK_SECRET`       | Validates Vapi webhooks (if using Vapi)    | Generate a random string: `openssl rand -hex 32` |
| `ENCRYPTION_KEY`            | AES key for encrypting sensitive DB fields | Generate 32+ char string: `openssl rand -hex 32` |

### URLs

| Variable       | Description                           | Notes                                                      |
| -------------- | ------------------------------------- | ---------------------------------------------------------- |
| `BACKEND_URL`  | Public URL where the API is reachable | Must be HTTPS for production. For local dev, use ngrok URL |
| `FRONTEND_URL` | Dashboard URL for CORS                | Default: `http://localhost:3000`                           |
| `PORT`         | API port                              | Default: `3100`                                            |

### Optional Services

| Variable              | Description                     | Where to Get               |
| --------------------- | ------------------------------- | -------------------------- |
| `TWILIO_ACCOUNT_SID`  | Twilio account SID (SMS)        | https://console.twilio.com |
| `TWILIO_AUTH_TOKEN`   | Twilio auth token               | https://console.twilio.com |
| `TWILIO_PHONE_NUMBER` | Twilio sender phone number      | Twilio console             |
| `RESEND_API_KEY`      | Resend email API key            | https://resend.com         |
| `TOGETHER_API_KEY`    | Together AI (fine-tuned models) | https://api.together.xyz   |

---

## Dashboard Environment Variables (lumentra-dashboard/.env)

| Variable                        | Description                                                                      |
| ------------------------------- | -------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL`           | URL of the lumentra-api server (e.g., `http://localhost:3100` or production URL) |
| `NEXT_PUBLIC_SUPABASE_URL`      | Same Supabase URL as API                                                         |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same Supabase anon key as API                                                    |
| `NEXT_PUBLIC_TENANT_ID`         | Default tenant ID (used in some client-side contexts)                            |

---

## Account Setup Checklist

1. **Supabase** - Create project, get URL + keys, run migrations
2. **OpenAI** - Create account, add payment method, generate API key
3. **Deepgram** - Create account, generate API key
4. **Cartesia** - Create account (may need waitlist approval), get API key
5. **SignalWire** - Create account, create space, buy phone number, get project ID + token
6. **Groq** (optional) - Create account, generate API key
7. **Google AI Studio** (optional) - Generate API key for Gemini

---

## SignalWire Phone Number Setup

After getting a SignalWire account:

1. Go to Phone Numbers in SignalWire dashboard
2. Buy a local or toll-free number
3. Click the number to configure
4. Set "When a call comes in" webhook to: `https://YOUR_API_URL/signalwire/voice`
5. Set method to POST
6. Save

The phone number is also stored in the `tenants` table `phone_number` field - the API looks up which tenant to serve based on the called number.
