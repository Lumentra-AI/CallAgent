// SignalWire Client Setup
// Telephony provider (Twilio-compatible API, 50% cheaper)

const SIGNALWIRE_PROJECT_ID = process.env.SIGNALWIRE_PROJECT_ID;
const SIGNALWIRE_API_TOKEN = process.env.SIGNALWIRE_API_TOKEN;
const SIGNALWIRE_SPACE_URL = process.env.SIGNALWIRE_SPACE_URL;
const SIGNALWIRE_PHONE_NUMBER = process.env.SIGNALWIRE_PHONE_NUMBER;

if (!SIGNALWIRE_PROJECT_ID || !SIGNALWIRE_API_TOKEN || !SIGNALWIRE_SPACE_URL) {
  console.warn("[SIGNALWIRE] Warning: SignalWire credentials not fully set");
}

export const signalwireConfig = {
  projectId: SIGNALWIRE_PROJECT_ID,
  apiToken: SIGNALWIRE_API_TOKEN,
  spaceUrl: SIGNALWIRE_SPACE_URL,
  phoneNumber: SIGNALWIRE_PHONE_NUMBER,
};

// SignalWire REST API base URL
export const signalwireApiUrl = SIGNALWIRE_SPACE_URL
  ? `https://${SIGNALWIRE_SPACE_URL}/api/laml/2010-04-01/Accounts/${SIGNALWIRE_PROJECT_ID}`
  : null;

// Generate SWML (SignalWire Markup Language) for incoming calls
export function generateStreamXml(websocketUrl: string): string {
  // SignalWire uses TwiML-compatible XML
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${websocketUrl}">
      <Parameter name="source" value="lumentra"/>
    </Stream>
  </Connect>
</Response>`;
}

// Generate SWML for playing audio while connecting
export function generateConnectingXml(
  websocketUrl: string,
  greeting?: string,
): string {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>`;

  if (greeting) {
    xml += `
  <Say voice="Polly.Joanna">${greeting}</Say>`;
  }

  xml += `
  <Connect>
    <Stream url="${websocketUrl}">
      <Parameter name="source" value="lumentra"/>
    </Stream>
  </Connect>
</Response>`;

  return xml;
}

// Transfer call to a phone number
export function generateTransferXml(phoneNumber: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Transferring you now. Please hold.</Say>
  <Dial>${phoneNumber}</Dial>
</Response>`;
}
