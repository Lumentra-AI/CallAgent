import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { Hono } from "hono";
import { getRequestListener } from "@hono/node-server";

import {
  EMAIL_VERIFICATION_REQUIRED_MESSAGE,
  requireVerifiedEmail,
  setupRoutes,
} from "../src/routes/setup.js";

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

function withFakeAuth(app: Hono, emailConfirmedAt: string | null): Hono {
  app.use("/api/setup/*", async (c, next) => {
    c.set("auth", {
      user: {
        id: "user-1",
        email: "owner@example.com",
        email_confirmed_at: emailConfirmedAt,
      } as never,
      userId: "user-1",
      tenantId: "",
      role: "owner",
    });

    await next();
  });

  return app;
}

test("setup routes reject unverified users before any handler work runs", async () => {
  const app = withFakeAuth(new Hono(), null);
  app.route("/api/setup", setupRoutes);

  const server = createServer(getRequestListener(app.fetch));
  const port = await listen(server);
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const response = await fetch(`${baseUrl}/api/setup/progress`);
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), {
      error: EMAIL_VERIFICATION_REQUIRED_MESSAGE,
    });
  } finally {
    await close(server);
  }
});

test("verified users can pass the email verification guard", async () => {
  const app = withFakeAuth(new Hono(), "2026-03-08T12:00:00.000Z");
  app.use("/api/setup/*", requireVerifiedEmail());
  app.get("/api/setup/progress", (c) => c.json({ ok: true }));

  const server = createServer(getRequestListener(app.fetch));
  const port = await listen(server);
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const response = await fetch(`${baseUrl}/api/setup/progress`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
  } finally {
    await close(server);
  }
});
