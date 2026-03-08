import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { getRequestListener } from "@hono/node-server";

import { createApp } from "../src/app.js";

async function listen(
  server: ReturnType<typeof createServer>,
): Promise<number> {
  await new Promise<void>((resolve, reject) => {
    server.listen(0, "127.0.0.1", (error?: Error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

  const address = server.address() as AddressInfo | null;
  if (!address) {
    throw new Error("Server address unavailable");
  }

  return address.port;
}

async function close(server: ReturnType<typeof createServer>): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

test("POST /sip/forward enforces webhook auth and SIP-specific rate limiting", async () => {
  const originalEnv = {
    SIGNALWIRE_WEBHOOK_SECRET: process.env.SIGNALWIRE_WEBHOOK_SECRET,
    LIVEKIT_SIP_HOST: process.env.LIVEKIT_SIP_HOST,
    LIVEKIT_SIP_PORT: process.env.LIVEKIT_SIP_PORT,
    NODE_ENV: process.env.NODE_ENV,
  };

  process.env.SIGNALWIRE_WEBHOOK_SECRET = "test-sip-secret";
  process.env.LIVEKIT_SIP_HOST = "sip.internal.example";
  process.env.LIVEKIT_SIP_PORT = "5090";
  process.env.NODE_ENV = "test";

  const app = createApp();
  const server = createServer(getRequestListener(app.fetch));
  const port = await listen(server);
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const missingSecret = await fetch(`${baseUrl}/sip/forward`, {
      method: "POST",
      headers: {
        "X-Forwarded-For": "198.51.100.10",
      },
    });

    assert.equal(missingSecret.status, 403);
    assert.deepEqual(await missingSecret.json(), {
      error: "Invalid webhook signature",
    });

    const wrongSecret = await fetch(
      `${baseUrl}/sip/forward?webhook_secret=wrong-secret`,
      {
        method: "POST",
        headers: {
          "X-Forwarded-For": "198.51.100.11",
        },
      },
    );

    assert.equal(wrongSecret.status, 403);
    assert.deepEqual(await wrongSecret.json(), {
      error: "Invalid webhook signature",
    });

    const validSecret = await fetch(
      `${baseUrl}/sip/forward?webhook_secret=test-sip-secret`,
      {
        method: "POST",
        headers: {
          "X-Forwarded-For": "198.51.100.12",
        },
      },
    );

    assert.equal(validSecret.status, 200);
    assert.ok(
      validSecret.headers.get("content-type")?.includes("application/xml"),
    );

    const twiml = await validSecret.text();
    assert.match(
      twiml,
      /<Sip>sip:sip\.internal\.example:5090;transport=udp<\/Sip>/,
    );

    for (let attempt = 1; attempt <= 30; attempt++) {
      const response = await fetch(
        `${baseUrl}/sip/forward?webhook_secret=test-sip-secret`,
        {
          method: "POST",
          headers: {
            "X-Forwarded-For": "198.51.100.30",
          },
        },
      );

      assert.equal(
        response.status,
        200,
        `request ${attempt} should be allowed`,
      );
    }

    const rateLimited = await fetch(
      `${baseUrl}/sip/forward?webhook_secret=test-sip-secret`,
      {
        method: "POST",
        headers: {
          "X-Forwarded-For": "198.51.100.30",
        },
      },
    );

    assert.equal(rateLimited.status, 429);
    assert.equal(rateLimited.headers.get("x-ratelimit-limit"), "30");
    assert.equal(rateLimited.headers.get("x-ratelimit-remaining"), "0");
    assert.ok(Number(rateLimited.headers.get("retry-after")) > 0);
    assert.deepEqual(await rateLimited.json(), {
      error: "Too Many Requests",
      message: "Too many SIP forwarding requests, please try again later.",
      retryAfter: Number(rateLimited.headers.get("retry-after")),
    });
  } finally {
    await close(server);

    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
});
