# Vapi Phone Number Management API -- Deep Research (2026-03-22)

## Source Summary

- Official docs: https://docs.vapi.ai (phone-calling, free-telephony, phone-numbers/_, api-reference/phone-numbers/_)
- OpenAPI spec: https://api.vapi.ai/api-json
- Python SDK: https://github.com/VapiAI/server-sdk-python
- TypeScript SDK: https://github.com/VapiAI/server-sdk-typescript

---

## 1. Core API Endpoints

All endpoints use base URL `https://api.vapi.ai`.
Auth: `Authorization: Bearer <API_KEY>` header on every request.

| Method | Path                 | Purpose                               |
| ------ | -------------------- | ------------------------------------- |
| POST   | `/phone-number`      | Create (buy or import) a phone number |
| GET    | `/phone-number`      | List all phone numbers                |
| GET    | `/v2/phone-number`   | List with pagination + search         |
| GET    | `/phone-number/{id}` | Get a single phone number             |
| PATCH  | `/phone-number/{id}` | Update a phone number                 |
| DELETE | `/phone-number/{id}` | Delete (release) a phone number       |

There is NO separate "search available numbers" endpoint. You request an area code and Vapi assigns a random number from that pool.

---

## 2. Supported Providers (5 types)

The `provider` field is a discriminator that determines which fields are required:

| Provider    | Value                | Use Case                                                    |
| ----------- | -------------------- | ----------------------------------------------------------- |
| Vapi native | `"vapi"`             | Buy a US number directly from Vapi (free, up to 10/account) |
| Twilio      | `"twilio"`           | Import an existing Twilio number                            |
| Vonage      | `"vonage"`           | Import an existing Vonage number                            |
| Telnyx      | `"telnyx"`           | Import an existing Telnyx number                            |
| BYO SIP     | `"byo-phone-number"` | Bring any SIP trunk number                                  |

---

## 3. Buying a Vapi-Native Number

### POST /phone-number

```json
{
  "provider": "vapi",
  "numberDesiredAreaCode": "415",
  "name": "Tenant Main Line",
  "assistantId": "asst_abc123"
}
```

**Key fields for `provider: "vapi"`:**

| Field                   | Type     | Required | Description                                                                              |
| ----------------------- | -------- | -------- | ---------------------------------------------------------------------------------------- |
| `provider`              | `"vapi"` | Yes      | Must be "vapi"                                                                           |
| `numberDesiredAreaCode` | string   | No       | Preferred US area code (e.g. "415", "212"). Vapi assigns a random number from this pool. |
| `sipUri`                | string   | No       | SIP URI endpoint (format: `sip:user@sip.vapi.ai`)                                        |
| `authentication`        | object   | No       | SIP auth credentials (realm, username, password)                                         |
| `name`                  | string   | No       | Human-readable label                                                                     |
| `assistantId`           | string   | No       | Attach an assistant for inbound calls                                                    |
| `squadId`               | string   | No       | Attach a squad instead                                                                   |
| `workflowId`            | string   | No       | Attach a workflow instead                                                                |
| `server`                | object   | No       | Webhook server for dynamic routing                                                       |
| `fallbackDestination`   | object   | No       | Where to route if assistant unavailable                                                  |
| `hooks`                 | array    | No       | Event hooks (e.g. `call.ringing`)                                                        |

### Response (201 Created)

```json
{
  "id": "pn_abc123",
  "orgId": "org_xyz",
  "provider": "vapi",
  "number": "+14155551234",
  "numberDesiredAreaCode": "415",
  "name": "Tenant Main Line",
  "status": "activating",
  "assistantId": "asst_abc123",
  "createdAt": "2026-03-22T10:00:00.000Z",
  "updatedAt": "2026-03-22T10:00:00.000Z"
}
```

**Status values:** `"active"` | `"activating"` | `"blocked"`

**Important:** After creation, status is `"activating"` for a couple of minutes. Calls will NOT work during this period. Must poll GET `/phone-number/{id}` until status = `"active"`.

### Constraints

- **US only** -- free Vapi numbers are restricted to US national use
- **10 free numbers per account** (per "wallet")
- **No specific number selection** -- you get a random number in the requested area code
- **No area code listing endpoint** -- you request and hope it's available
- **Activation delay** -- takes ~1-2 minutes after creation

---

## 4. Importing a Twilio Number

### POST /phone-number

```json
{
  "provider": "twilio",
  "number": "+14155551234",
  "twilioAccountSid": "AC...",
  "twilioAuthToken": "auth_token_here",
  "name": "Twilio Import",
  "assistantId": "asst_abc123",
  "smsEnabled": true
}
```

**Key fields for `provider: "twilio"`:**

| Field                 | Type       | Required | Description                                          |
| --------------------- | ---------- | -------- | ---------------------------------------------------- |
| `provider`            | `"twilio"` | Yes      | Must be "twilio"                                     |
| `number`              | string     | Yes      | E.164 phone number from Twilio                       |
| `twilioAccountSid`    | string     | Yes      | Twilio Account SID                                   |
| `twilioAuthToken`     | string     | No\*     | Auth token (one auth method required)                |
| `twilioApiKey`        | string     | No\*     | API key (alternative auth)                           |
| `twilioApiSecret`     | string     | No\*     | API secret (paired with key)                         |
| `smsEnabled`          | boolean    | No       | Enable inbound SMS handling (default: true, US only) |
| `name`                | string     | No       | Human-readable label                                 |
| `assistantId`         | string     | No       | Attach assistant                                     |
| `server`              | object     | No       | Webhook server                                       |
| `fallbackDestination` | object     | No       | Fallback routing                                     |
| `hooks`               | array      | No       | Event hooks                                          |

\*Auth: Provide either `twilioAuthToken` OR `twilioApiKey` + `twilioApiSecret`.

When `smsEnabled: true`, Vapi takes over the Twilio messaging webhook automatically.

---

## 5. Importing a Vonage Number

### POST /phone-number

```json
{
  "provider": "vonage",
  "number": "+14155551234",
  "credentialId": "cred_vonage_abc",
  "name": "Vonage Line",
  "assistantId": "asst_abc123"
}
```

**Key fields for `provider: "vonage"`:**

| Field                                 | Type       | Required | Description                                      |
| ------------------------------------- | ---------- | -------- | ------------------------------------------------ |
| `provider`                            | `"vonage"` | Yes      | Must be "vonage"                                 |
| `number`                              | string     | Yes      | E.164 phone number                               |
| `credentialId`                        | string     | Yes      | Vonage credential ID (created in Vapi dashboard) |
| `name`, `assistantId`, `server`, etc. | --         | No       | Same common fields                               |

---

## 6. Importing a Telnyx Number

### POST /phone-number

```json
{
  "provider": "telnyx",
  "number": "+14155551234",
  "credentialId": "cred_telnyx_abc",
  "name": "Telnyx Line",
  "assistantId": "asst_abc123"
}
```

**Key fields for `provider: "telnyx"`:**

| Field                                 | Type       | Required | Description                                      |
| ------------------------------------- | ---------- | -------- | ------------------------------------------------ |
| `provider`                            | `"telnyx"` | Yes      | Must be "telnyx"                                 |
| `number`                              | string     | Yes      | E.164 phone number                               |
| `credentialId`                        | string     | Yes      | Telnyx credential ID (created in Vapi dashboard) |
| `name`, `assistantId`, `server`, etc. | --         | No       | Same common fields                               |

**Telnyx outbound requirement:** Must create an Outbound Voice Profile in Telnyx portal and register Vapi as a connection, or outbound calling will not work.

---

## 7. BYO SIP Trunk Number

### POST /phone-number

```json
{
  "provider": "byo-phone-number",
  "number": "+14155551234",
  "credentialId": "cred_sip_abc",
  "numberE164CheckEnabled": false,
  "name": "SIP Trunk Line"
}
```

**Key fields for `provider: "byo-phone-number"`:**

| Field                       | Type                 | Required | Description                                          |
| --------------------------- | -------------------- | -------- | ---------------------------------------------------- |
| `provider`                  | `"byo-phone-number"` | Yes      | Must be "byo-phone-number"                           |
| `number`                    | string               | Yes      | Phone number or SIP extension                        |
| `credentialId`              | string               | Yes      | SIP trunk credential ID                              |
| `numberE164CheckEnabled`    | boolean              | No       | Default true. Set false for non-E164 SIP extensions. |
| `name`, `assistantId`, etc. | --                   | No       | Same common fields                                   |

---

## 8. Listing Phone Numbers

### GET /phone-number (v1)

```
GET /phone-number?limit=100&createdAtGt=2026-01-01T00:00:00Z
```

**Query parameters:**

| Param                  | Type     | Default | Description                  |
| ---------------------- | -------- | ------- | ---------------------------- |
| `limit`                | number   | 100     | Max items to return          |
| `createdAtGt`          | datetime | --      | Filter: created after        |
| `createdAtLt`          | datetime | --      | Filter: created before       |
| `createdAtGe`          | datetime | --      | Filter: created at or after  |
| `createdAtLe`          | datetime | --      | Filter: created at or before |
| `updatedAtGt/Lt/Ge/Le` | datetime | --      | Same for updatedAt           |

Returns: `Array<PhoneNumberObject>`

### GET /v2/phone-number (v2, paginated + search)

```
GET /v2/phone-number?search=415&page=1&limit=20&sortOrder=DESC
```

**Additional query parameters (v2 only):**

| Param       | Type   | Description                                                  |
| ----------- | ------ | ------------------------------------------------------------ |
| `search`    | string | Partial match (case-insensitive) on name, number, or SIP URI |
| `page`      | number | Page number                                                  |
| `sortOrder` | string | ASC or DESC                                                  |

---

## 9. Getting a Single Number

### GET /phone-number/{id}

Returns the full phone number object with all provider-specific fields.

---

## 10. Updating a Number (Attach Assistant, Configure Forwarding)

### PATCH /phone-number/{id}

```json
{
  "assistantId": "asst_new_one",
  "name": "Updated Name",
  "fallbackDestination": {
    "type": "number",
    "number": "+15551234567",
    "callerId": "+14155551234"
  },
  "hooks": [
    {
      "on": "call.ringing",
      "do": [
        {
          "type": "say",
          "exact": "Please hold while we connect you."
        }
      ]
    }
  ]
}
```

**Updatable fields:**

| Field                    | Description                                                      |
| ------------------------ | ---------------------------------------------------------------- |
| `assistantId`            | Change which assistant handles inbound calls                     |
| `squadId`                | Assign a squad instead                                           |
| `workflowId`             | Assign a workflow instead                                        |
| `name`                   | Update display name                                              |
| `number`                 | Update the number (provider-specific)                            |
| `server`                 | Change webhook destination                                       |
| `fallbackDestination`    | Set transfer destination if assistant unavailable (phone or SIP) |
| `hooks`                  | Configure call event hooks                                       |
| Provider-specific fields | Twilio creds, Telnyx credentialId, etc.                          |

**Routing priority:** `assistantId` > `squadId` > `workflowId` > `server` (assistant-request webhook) > hang up with error.

If no assistant/squad/workflow is set but a `server` URL is configured, Vapi sends an `assistant-request` webhook to dynamically determine which assistant to use (useful for multi-tenant routing).

---

## 11. Deleting (Releasing) a Number

### DELETE /phone-number/{id}

Returns the deleted phone number object (200 OK).

For Vapi-native numbers, the number is released back to the pool.
For imported numbers (Twilio/Vonage/Telnyx/BYO), the number is unlinked from Vapi but remains in your provider account.

---

## 12. Phone Number Hooks

Currently one event type: `call.ringing`

**Supported actions:**

| Action     | Description                                                                   |
| ---------- | ----------------------------------------------------------------------------- |
| `say`      | Play a message to the caller (`{ "type": "say", "exact": "text" }`)           |
| `transfer` | Route to phone number or SIP (`{ "type": "transfer", "destination": {...} }`) |

**Transfer destination types:**

- Phone: `{ "type": "number", "number": "+15551234567", "callerId": "+14155551234" }`
- SIP: `{ "type": "sip", "sipUri": "sip:user@domain.com" }`

Use case: disable inbound calling by transferring or playing a rejection message on ring.

---

## 13. Outbound Calls (Using a Number)

### POST /call

```json
{
  "phoneNumberId": "pn_abc123",
  "assistantId": "asst_abc123",
  "customer": {
    "number": "+15559876543"
  }
}
```

The `phoneNumberId` controls which number appears as caller ID. The assistant handles the conversation.

---

## 14. Dynamic Routing (Multi-Tenant Pattern)

For multi-tenant use, leave `assistantId` null on the phone number and set a `server` URL:

```json
{
  "provider": "vapi",
  "numberDesiredAreaCode": "415",
  "server": {
    "url": "https://api.yourdomain.com/vapi/webhook"
  }
}
```

When a call comes in, Vapi sends an `assistant-request` webhook to your server:

```json
{
  "message": {
    "type": "assistant-request",
    "phoneNumber": { "id": "pn_abc123", "number": "+14155551234" },
    "call": { "id": "call_xyz", "customer": { "number": "+15559876543" } }
  }
}
```

Your server responds with the assistant config:

```json
{
  "assistantId": "asst_tenant_specific"
}
```

Or inline:

```json
{
  "assistant": {
    "model": { "provider": "openai", "model": "gpt-4o" },
    "firstMessage": "Hello, thanks for calling Acme Corp...",
    "voice": { "provider": "cartesia", "voiceId": "..." }
  }
}
```

This is the primary pattern for per-tenant assistant routing without needing separate numbers per assistant.

---

## 15. Number Porting

**Vapi does not support direct number porting.** There is no porting endpoint or process documented.

Workaround paths:

1. Port your number to Twilio/Telnyx/Vonage first, then import into Vapi
2. Use BYO SIP trunk: keep number with current carrier, route SIP to Vapi
3. Use SIP trunk integration (Twilio SIP, Telnyx SIP, Plivo SIP, Zadarma SIP)

SIP trunk IPs for Twilio integration: `44.229.228.186` and `44.238.177.138`

---

## 16. Pricing

### Vapi-Native Numbers

- **Cost: Free** (up to 10 per account)
- US only
- No monthly hosting fee documented
- Per-minute telephony: Vapi charges "at-cost" for provider pass-through (STT, LLM, TTS). Telephony per-minute rates are NOT published in docs.

### BYO Numbers (Twilio, Vonage, Telnyx, SIP)

- No Vapi charge for the number itself
- You pay your provider directly for the number + telephony minutes
- When you bring your own provider keys, "you won't be charged when using that provider through Vapi. Instead, you'll be charged directly by the provider"
- Vapi still charges for their orchestration/platform fee (not publicly documented)

### What Vapi Charges At-Cost

- STT (Deepgram, etc.)
- LLM (OpenAI, etc.)
- TTS (Cartesia, ElevenLabs, etc.)

### What Is NOT Clearly Priced

- Per-minute telephony markup for Vapi-native numbers
- Platform/orchestration fee
- Overage costs beyond 10 free numbers
- Enterprise pricing (contact sales)

---

## 17. International Number Support

- **Vapi-native numbers: US only**
- International: Must import from Twilio, Vonage, Telnyx, or use BYO SIP
- No free international numbers
- International calling supported via imported numbers
- SMS: US Twilio numbers only

---

## 18. Phone Number Limits

| Limit                         | Value                                                   |
| ----------------------------- | ------------------------------------------------------- |
| Free Vapi numbers per account | 10                                                      |
| Imported numbers              | Not documented (likely unlimited)                       |
| Concurrent calls              | Not documented for free tier; "unlimited" on enterprise |
| Rate limits                   | Standard API rate limits apply                          |

---

## 19. SIP Integration (Alternative to Number Import)

Vapi supports SIP-based calling without importing numbers:

**SIP URI format:** `sip:username@sip.vapi.ai`

**Supported SIP providers (documented):**

- Twilio Elastic SIP Trunk
- Telnyx SIP
- Zadarma SIP
- Plivo SIP

No SIP registration or authentication required for basic inbound.

**Template variables via SIP headers:** Pass custom context as `x-variable_name: value` headers.

---

## 20. SDK Methods Summary

### TypeScript SDK

```typescript
import { VapiClient } from "@vapi-ai/server-sdk";
const client = new VapiClient({ token: "YOUR_API_KEY" });

// Buy a Vapi number
const number = await client.phoneNumbers.create({
  provider: "vapi",
  numberDesiredAreaCode: "415",
  name: "Tenant Line",
  assistantId: "asst_abc123",
});

// Import a Twilio number
const twilioNum = await client.phoneNumbers.create({
  provider: "twilio",
  number: "+14155551234",
  twilioAccountSid: "AC...",
  twilioAuthToken: "token",
  assistantId: "asst_abc123",
});

// List all numbers
const numbers = await client.phoneNumbers.list();

// List with pagination + search (v2)
const page = await client.phoneNumbers.phoneNumberControllerFindAllPaginated({
  search: "415",
  page: 1,
  limit: 20,
});

// Get one
const num = await client.phoneNumbers.get({ id: "pn_abc123" });

// Update (attach assistant)
const updated = await client.phoneNumbers.update({
  id: "pn_abc123",
  body: { assistantId: "asst_new" },
});

// Delete
await client.phoneNumbers.delete({ id: "pn_abc123" });
```

### Python SDK

```python
from vapi import Vapi

client = Vapi(token="YOUR_API_KEY")

# Buy a Vapi number
number = client.phone_numbers.create(
    request={"provider": "vapi", "number_desired_area_code": "415", "name": "Tenant Line"}
)

# Import Twilio number
twilio_num = client.phone_numbers.create(
    request={
        "provider": "twilio",
        "number": "+14155551234",
        "twilio_account_sid": "AC...",
        "twilio_auth_token": "token",
    }
)

# List
numbers = client.phone_numbers.list()

# Search (v2 paginated)
page = client.phone_numbers.phone_number_controller_find_all_paginated(
    search="415", page=1, limit=20
)

# Get
num = client.phone_numbers.get(id="pn_abc123")

# Update
updated = client.phone_numbers.update(
    id="pn_abc123", request={"assistant_id": "asst_new"}
)

# Delete
client.phone_numbers.delete(id="pn_abc123")
```

### cURL Examples

```bash
# Buy a Vapi number
curl -X POST https://api.vapi.ai/phone-number \
  -H "Authorization: Bearer $VAPI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "vapi",
    "numberDesiredAreaCode": "415",
    "name": "Tenant Main Line",
    "assistantId": "asst_abc123"
  }'

# Import Twilio number
curl -X POST https://api.vapi.ai/phone-number \
  -H "Authorization: Bearer $VAPI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "twilio",
    "number": "+14155551234",
    "twilioAccountSid": "AC...",
    "twilioAuthToken": "...",
    "assistantId": "asst_abc123"
  }'

# List all numbers
curl https://api.vapi.ai/phone-number \
  -H "Authorization: Bearer $VAPI_API_KEY"

# Search numbers (v2)
curl "https://api.vapi.ai/v2/phone-number?search=415&limit=20" \
  -H "Authorization: Bearer $VAPI_API_KEY"

# Get one number
curl https://api.vapi.ai/phone-number/pn_abc123 \
  -H "Authorization: Bearer $VAPI_API_KEY"

# Update (attach assistant)
curl -X PATCH https://api.vapi.ai/phone-number/pn_abc123 \
  -H "Authorization: Bearer $VAPI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"assistantId": "asst_new"}'

# Delete number
curl -X DELETE https://api.vapi.ai/phone-number/pn_abc123 \
  -H "Authorization: Bearer $VAPI_API_KEY"
```

---

## 21. Multi-Tenant Provisioning Pattern (Lumentra-Relevant)

For a platform like Lumentra provisioning numbers per tenant:

**Option A: Vapi-Native Numbers (simple, limited)**

1. `POST /phone-number` with `provider: "vapi"` + tenant's preferred area code
2. Store the returned `id` and `number` in your tenant's phone_configurations table
3. Set `assistantId` or use `server` webhook for dynamic assistant routing
4. Limit: 10 free numbers per Vapi account (would need multiple accounts or enterprise plan for scale)

**Option B: BYO Twilio (scalable, full control)**

1. Buy number via Twilio API first (full area code search, number selection)
2. `POST /phone-number` with `provider: "twilio"` + credentials
3. Store mapping in your DB
4. You control the number lifecycle, porting, and costs

**Option C: BYO SIP Trunk (most flexible)**

1. Keep numbers with any carrier (SignalWire, Twilio, Telnyx, etc.)
2. Route SIP to Vapi using `provider: "byo-phone-number"` + SIP credential
3. Full control over telephony costs and number management
4. Set `numberE164CheckEnabled: false` for non-standard SIP extensions

**Recommendation for scale:** Option B or C. Vapi-native numbers are good for MVP/demos but the 10-number limit and US-only restriction make them unsuitable for production multi-tenant platforms.

---

## 22. Key Gaps and Limitations

1. **No available number search** -- Cannot browse available numbers by area code before buying. Request and get random assignment.
2. **No number porting** -- Must port to Twilio/Telnyx first, then import.
3. **10 free number cap** -- Hard limit per account for Vapi-native numbers.
4. **US only for native numbers** -- International requires BYO provider.
5. **No batch operations** -- One number per API call.
6. **Pricing opaque** -- Per-minute telephony costs and platform fees not publicly documented.
7. **No number reservation** -- Cannot reserve or hold a number before purchase.
8. **SMS limited** -- Only US Twilio numbers with smsEnabled flag.
9. **Activation delay** -- 1-2 minutes before new numbers accept calls.
10. **No toll-free native support** -- Not documented for Vapi-native; available via BYO.

---

## 23. Comparison: Vapi vs Lumentra's Current Stack (SignalWire + LiveKit)

| Feature                | Vapi                       | Lumentra Current (SignalWire + LiveKit) |
| ---------------------- | -------------------------- | --------------------------------------- |
| Number purchase API    | Yes (limited)              | Yes (SignalWire full catalog)           |
| Area code search       | Request only               | Full search + filtering                 |
| International          | BYO only                   | SignalWire native                       |
| Number porting         | No (BYO workaround)        | SignalWire supports porting             |
| Per-number cost        | Free (10 cap) then unclear | ~$2/mo SignalWire                       |
| Per-minute telephony   | Undisclosed                | ~$0.01/min SignalWire                   |
| SIP trunk support      | Yes (BYO)                  | Yes (native LiveKit SIP)                |
| Multi-tenant routing   | assistant-request webhook  | /sip/forward webhook                    |
| Voice pipeline control | Vapi managed               | Full control (STT/LLM/TTS)              |
| Self-hosted option     | No                         | Yes                                     |
