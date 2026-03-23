/**
 * Twilio Phone Number Management
 * Handles searching, buying, and releasing phone numbers via Twilio REST API
 */

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_BASE = "https://api.twilio.com/2010-04-01";

function twilioHeaders(): Record<string, string> {
  const encoded = Buffer.from(`${TWILIO_SID}:${TWILIO_AUTH}`).toString(
    "base64",
  );
  return {
    Authorization: `Basic ${encoded}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };
}

export interface TwilioNumber {
  sid: string;
  number: string;
  friendlyName: string;
  locality?: string;
  region?: string;
}

/**
 * Search available US local numbers by area code
 */
export async function searchAvailableNumbers(
  areaCode: string,
  limit = 10,
): Promise<TwilioNumber[]> {
  const url = `${TWILIO_BASE}/Accounts/${TWILIO_SID}/AvailablePhoneNumbers/US/Local.json?AreaCode=${areaCode}&PageSize=${limit}&VoiceEnabled=true&SmsEnabled=true`;
  const res = await fetch(url, { headers: twilioHeaders() });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Twilio search failed: ${err}`);
  }

  const data = (await res.json()) as any;
  return (data.available_phone_numbers || []).map((n: any) => ({
    sid: "",
    number: n.phone_number,
    friendlyName: n.friendly_name,
    locality: n.locality,
    region: n.region,
  }));
}

/**
 * Purchase a phone number
 */
export async function buyNumber(phoneNumber: string): Promise<TwilioNumber> {
  const url = `${TWILIO_BASE}/Accounts/${TWILIO_SID}/IncomingPhoneNumbers.json`;
  const body = new URLSearchParams({ PhoneNumber: phoneNumber });
  const res = await fetch(url, {
    method: "POST",
    headers: twilioHeaders(),
    body,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Twilio buy failed: ${err}`);
  }

  const data = (await res.json()) as any;
  return {
    sid: data.sid,
    number: data.phone_number,
    friendlyName: data.friendly_name,
  };
}

/**
 * Release (delete) a phone number
 */
export async function releaseNumber(sid: string): Promise<void> {
  const url = `${TWILIO_BASE}/Accounts/${TWILIO_SID}/IncomingPhoneNumbers/${sid}.json`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: twilioHeaders(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Twilio release failed: ${err}`);
  }
}

export const twilioConfigured = !!(TWILIO_SID && TWILIO_AUTH);
