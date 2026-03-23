// Vapi API Client
// Handles communication with Vapi's REST API

const VAPI_API_KEY = process.env.VAPI_API_KEY;
const VAPI_BASE_URL = "https://api.vapi.ai";

if (!VAPI_API_KEY) {
  console.warn("[VAPI] Warning: VAPI_API_KEY not set");
}

export interface VapiPhoneNumber {
  id: string;
  number: string;
  provider: string;
  assistantId?: string;
}

export interface VapiCall {
  id: string;
  status: string;
  phoneNumberId?: string;
  customerId?: string;
  assistantId?: string;
  transcript?: string;
  recordingUrl?: string;
  endedReason?: string;
  cost?: number;
  startedAt?: string;
  endedAt?: string;
}

// Headers for Vapi API requests
function getHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${VAPI_API_KEY}`,
    "Content-Type": "application/json",
  };
}

// List phone numbers
export async function listPhoneNumbers(): Promise<VapiPhoneNumber[]> {
  const response = await fetch(`${VAPI_BASE_URL}/phone-number`, {
    headers: getHeaders(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to list phone numbers: ${error}`);
  }

  return response.json() as Promise<VapiPhoneNumber[]>;
}

// Get a specific phone number
export async function getPhoneNumber(id: string): Promise<VapiPhoneNumber> {
  const response = await fetch(`${VAPI_BASE_URL}/phone-number/${id}`, {
    headers: getHeaders(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get phone number: ${error}`);
  }

  return response.json() as Promise<VapiPhoneNumber>;
}

// Update phone number assistant
export async function updatePhoneNumberAssistant(
  phoneNumberId: string,
  assistantId: string | null,
): Promise<VapiPhoneNumber> {
  const response = await fetch(
    `${VAPI_BASE_URL}/phone-number/${phoneNumberId}`,
    {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify({ assistantId }),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to update phone number: ${error}`);
  }

  return response.json() as Promise<VapiPhoneNumber>;
}

// Get a call by ID
export async function getCall(callId: string): Promise<VapiCall> {
  const response = await fetch(`${VAPI_BASE_URL}/call/${callId}`, {
    headers: getHeaders(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get call: ${error}`);
  }

  return response.json() as Promise<VapiCall>;
}

// Create an outbound call
export async function createOutboundCall(params: {
  phoneNumberId: string;
  customer: { number: string; name?: string };
  assistantId?: string;
  assistant?: Record<string, unknown>;
}): Promise<VapiCall> {
  const response = await fetch(`${VAPI_BASE_URL}/call/phone`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create outbound call: ${error}`);
  }

  return response.json() as Promise<VapiCall>;
}

// End a call
export async function endCall(callId: string): Promise<void> {
  const response = await fetch(`${VAPI_BASE_URL}/call/${callId}/hang`, {
    method: "POST",
    headers: getHeaders(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to end call: ${error}`);
  }
}

// Transfer a call
export async function transferCall(
  callId: string,
  destination: { type: "number"; number: string; message?: string },
): Promise<void> {
  const response = await fetch(`${VAPI_BASE_URL}/call/${callId}/transfer`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ destination }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to transfer call: ${error}`);
  }
}

// Import a Twilio number into Vapi for voice AI handling
export async function importTwilioNumber(params: {
  number: string;
  name?: string;
  serverUrl?: string;
}): Promise<VapiPhoneNumber> {
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioAuth = process.env.TWILIO_AUTH_TOKEN;

  if (!twilioSid || !twilioAuth) {
    throw new Error("TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required");
  }

  const body: Record<string, unknown> = {
    provider: "twilio",
    number: params.number,
    twilioAccountSid: twilioSid,
    twilioAuthToken: twilioAuth,
    name: params.name || `Lumentra - ${params.number}`,
  };

  // Set server URL for dynamic assistant-request routing (no pre-assigned assistant)
  if (params.serverUrl) {
    body.server = { url: `${params.serverUrl}/webhooks/vapi` };
  }

  const response = await fetch(`${VAPI_BASE_URL}/phone-number`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to import Twilio number to Vapi: ${error}`);
  }

  return response.json() as Promise<VapiPhoneNumber>;
}

// Delete (unlink) a phone number from Vapi
export async function deletePhoneNumber(id: string): Promise<void> {
  const response = await fetch(`${VAPI_BASE_URL}/phone-number/${id}`, {
    method: "DELETE",
    headers: getHeaders(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to delete phone number from Vapi: ${error}`);
  }
}

export const vapiApiKey = VAPI_API_KEY;
