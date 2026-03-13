import { SipClient } from "livekit-server-sdk";
import { ListUpdate } from "@livekit/protocol";

let sipClient: SipClient | null = null;

function getClient(): SipClient | null {
  if (sipClient) return sipClient;

  const url = process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!url || !apiKey || !apiSecret) {
    console.warn(
      "[LIVEKIT] Missing LIVEKIT_URL, LIVEKIT_API_KEY, or LIVEKIT_API_SECRET — SIP trunk sync disabled",
    );
    return null;
  }

  sipClient = new SipClient(url, apiKey, apiSecret);
  return sipClient;
}

function getTrunkId(): string | null {
  const id = process.env.LIVEKIT_SIP_TRUNK_ID;
  if (!id) {
    console.warn(
      "[LIVEKIT] LIVEKIT_SIP_TRUNK_ID not set — SIP trunk sync disabled",
    );
    return null;
  }
  return id;
}

/**
 * Add a phone number to the LiveKit SIP inbound trunk.
 * Called after successful phone provisioning so the agent can identify the dialed number.
 */
export async function addNumberToSipTrunk(
  phoneNumber: string,
): Promise<boolean> {
  const client = getClient();
  const trunkId = getTrunkId();
  if (!client || !trunkId) return false;

  try {
    await client.updateSipInboundTrunkFields(trunkId, {
      numbers: new ListUpdate({ add: [phoneNumber] }),
    });
    console.log(`[LIVEKIT] Added ${phoneNumber} to SIP trunk ${trunkId}`);
    return true;
  } catch (err) {
    console.error(`[LIVEKIT] Failed to add ${phoneNumber} to SIP trunk:`, err);
    return false;
  }
}

/**
 * Remove a phone number from the LiveKit SIP inbound trunk.
 * Called when releasing a number so the trunk stays clean.
 */
export async function removeNumberFromSipTrunk(
  phoneNumber: string,
): Promise<boolean> {
  const client = getClient();
  const trunkId = getTrunkId();
  if (!client || !trunkId) return false;

  try {
    await client.updateSipInboundTrunkFields(trunkId, {
      numbers: new ListUpdate({ remove: [phoneNumber] }),
    });
    console.log(`[LIVEKIT] Removed ${phoneNumber} from SIP trunk ${trunkId}`);
    return true;
  } catch (err) {
    console.error(
      `[LIVEKIT] Failed to remove ${phoneNumber} from SIP trunk:`,
      err,
    );
    return false;
  }
}
