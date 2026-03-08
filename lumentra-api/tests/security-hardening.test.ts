import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { Hono } from "hono";
import { getRequestListener } from "@hono/node-server";

import { createApp } from "../src/app.js";
import { internalAuth } from "../src/middleware/internal-auth.js";

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

test("API responses include security headers and preserve explicit health caching", async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";

  const app = createApp();
  const server = createServer(getRequestListener(app.fetch));
  const port = await listen(server);
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const rootResponse = await fetch(`${baseUrl}/`);
    assert.equal(rootResponse.status, 200);
    assert.equal(rootResponse.headers.get("x-content-type-options"), "nosniff");
    assert.equal(rootResponse.headers.get("x-frame-options"), "DENY");
    assert.equal(
      rootResponse.headers.get("strict-transport-security"),
      "max-age=31536000; includeSubDomains",
    );
    assert.equal(
      rootResponse.headers.get("referrer-policy"),
      "strict-origin-when-cross-origin",
    );
    assert.equal(
      rootResponse.headers.get("permissions-policy"),
      "camera=(), microphone=(), geolocation=()",
    );
    assert.equal(
      rootResponse.headers.get("cache-control"),
      "no-store, no-cache, must-revalidate",
    );

    const pingResponse = await fetch(`${baseUrl}/health/ping`);
    assert.equal(pingResponse.status, 200);
    assert.equal(
      pingResponse.headers.get("cache-control"),
      "public, max-age=30",
    );
    assert.equal(
      pingResponse.headers.get("strict-transport-security"),
      "max-age=31536000; includeSubDomains",
    );
    assert.equal(await pingResponse.text(), "pong");
  } finally {
    await close(server);

    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  }
});

test("internal auth middleware rejects missing and invalid keys and allows the correct key", async () => {
  const originalApiKey = process.env.INTERNAL_API_KEY;
  process.env.INTERNAL_API_KEY = "super-secret-key";

  const app = new Hono();
  app.use("*", internalAuth());
  app.get("/protected", (c) => c.json({ ok: true }));

  const server = createServer(getRequestListener(app.fetch));
  const port = await listen(server);
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const missingAuth = await fetch(`${baseUrl}/protected`);
    assert.equal(missingAuth.status, 401);
    assert.deepEqual(await missingAuth.json(), {
      error: "Missing Authorization header",
    });

    const wrongSameLength = await fetch(`${baseUrl}/protected`, {
      headers: {
        Authorization: "Bearer super-secret-kez",
      },
    });
    assert.equal(wrongSameLength.status, 403);
    assert.deepEqual(await wrongSameLength.json(), {
      error: "Invalid API key",
    });

    const wrongDifferentLength = await fetch(`${baseUrl}/protected`, {
      headers: {
        Authorization: "Bearer short",
      },
    });
    assert.equal(wrongDifferentLength.status, 403);
    assert.deepEqual(await wrongDifferentLength.json(), {
      error: "Invalid API key",
    });

    const correctAuth = await fetch(`${baseUrl}/protected`, {
      headers: {
        Authorization: "Bearer super-secret-key",
      },
    });
    assert.equal(correctAuth.status, 200);
    assert.deepEqual(await correctAuth.json(), { ok: true });
  } finally {
    await close(server);

    if (originalApiKey === undefined) {
      delete process.env.INTERNAL_API_KEY;
    } else {
      process.env.INTERNAL_API_KEY = originalApiKey;
    }
  }
});
