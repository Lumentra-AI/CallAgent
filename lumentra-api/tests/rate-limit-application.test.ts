import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { Hono } from "hono";
import { getRequestListener } from "@hono/node-server";

import { rateLimit, tenantRateLimit } from "../src/middleware/index.js";
import { bookingsRoutes } from "../src/routes/bookings.js";
import { dashboardRoutes } from "../src/routes/dashboard.js";
import { phoneConfigRoutes } from "../src/routes/phone-config.js";

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

function fakeAuthApp(): Hono {
  const app = new Hono();

  app.use("/api/*", async (c, next) => {
    c.set("auth", {
      user: {} as never,
      userId: c.req.header("X-User-ID") || "user-1",
      tenantId: c.req.header("X-Tenant-ID") || "tenant-a",
      role: "owner",
    });

    await next();
  });

  app.use(
    "/api/*",
    rateLimit({
      prefix: "global",
      windowMs: 60000,
      max: 300,
    }),
  );
  app.use("/api/*", tenantRateLimit(300, "tenant-api"));

  return app;
}

test("strict and read buckets stay isolated on mounted routes", async () => {
  const app = fakeAuthApp();
  app.route("/api/bookings", bookingsRoutes);
  app.route("/api/dashboard", dashboardRoutes);

  const server = createServer(getRequestListener(app.fetch));
  const port = await listen(server);
  const baseUrl = `http://127.0.0.1:${port}`;
  const headers = {
    "Content-Type": "application/json",
    "X-User-ID": "user-1",
    "X-Tenant-ID": "tenant-a",
  };

  try {
    for (let attempt = 1; attempt <= 10; attempt++) {
      const response = await fetch(`${baseUrl}/api/bookings`, {
        method: "POST",
        headers,
        body: "{}",
      });

      assert.equal(
        response.status,
        400,
        `booking request ${attempt} should stay below the strict limiter`,
      );
      assert.equal(response.headers.get("x-ratelimit-limit"), "10");
    }

    const eleventhBooking = await fetch(`${baseUrl}/api/bookings`, {
      method: "POST",
      headers,
      body: "{}",
    });
    assert.equal(eleventhBooking.status, 429);
    assert.equal(eleventhBooking.headers.get("x-ratelimit-limit"), "10");

    const firstDashboard = await fetch(`${baseUrl}/api/dashboard/activity`, {
      headers,
    });
    assert.equal(firstDashboard.status, 200);
    assert.equal(firstDashboard.headers.get("x-ratelimit-limit"), "120");

    for (let attempt = 2; attempt <= 120; attempt++) {
      const response = await fetch(`${baseUrl}/api/dashboard/activity`, {
        headers,
      });

      assert.equal(
        response.status,
        200,
        `dashboard read ${attempt} should stay in the read bucket`,
      );
    }

    const readLimitHit = await fetch(`${baseUrl}/api/dashboard/activity`, {
      headers,
    });
    assert.equal(readLimitHit.status, 429);
    assert.equal(readLimitHit.headers.get("x-ratelimit-limit"), "120");

    const bookingStillLimited = await fetch(`${baseUrl}/api/bookings`, {
      method: "POST",
      headers,
      body: "{}",
    });
    assert.equal(bookingStillLimited.status, 429);
    assert.equal(bookingStillLimited.headers.get("x-ratelimit-limit"), "10");

    const bookingOtherTenantStillLimited = await fetch(
      `${baseUrl}/api/bookings`,
      {
        method: "POST",
        headers: {
          ...headers,
          "X-Tenant-ID": "tenant-b",
        },
        body: "{}",
      },
    );
    assert.equal(bookingOtherTenantStillLimited.status, 429);
    assert.equal(
      bookingOtherTenantStillLimited.headers.get("x-ratelimit-limit"),
      "10",
    );
  } finally {
    await close(server);
  }
});

test("tenant rate limiting isolates tenants with the same user", async () => {
  const app = new Hono();
  app.use("/api/*", async (c, next) => {
    c.set("auth", {
      user: {} as never,
      userId: "user-1",
      tenantId: c.req.header("X-Tenant-ID") || "",
      role: "owner",
    });

    await next();
  });
  app.use("/api/*", tenantRateLimit(2, "tenant-test"));
  app.get("/api/ping", (c) =>
    c.json({
      tenantId: c.get("auth").tenantId,
    }),
  );

  const server = createServer(getRequestListener(app.fetch));
  const port = await listen(server);
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const tenantAHeaders = { "X-Tenant-ID": "tenant-a" };
    const tenantBHeaders = { "X-Tenant-ID": "tenant-b" };

    assert.equal(
      (await fetch(`${baseUrl}/api/ping`, { headers: tenantAHeaders })).status,
      200,
    );
    assert.equal(
      (await fetch(`${baseUrl}/api/ping`, { headers: tenantAHeaders })).status,
      200,
    );

    const tenantAThird = await fetch(`${baseUrl}/api/ping`, {
      headers: tenantAHeaders,
    });
    assert.equal(tenantAThird.status, 429);
    assert.equal(tenantAThird.headers.get("x-ratelimit-limit"), "2");

    const tenantBFirst = await fetch(`${baseUrl}/api/ping`, {
      headers: tenantBHeaders,
    });
    assert.equal(tenantBFirst.status, 200);
    assert.deepEqual(await tenantBFirst.json(), { tenantId: "tenant-b" });
  } finally {
    await close(server);
  }
});

test("critical phone provisioning limiter applies before handler side effects", async () => {
  const app = fakeAuthApp();
  app.route("/api/phone", phoneConfigRoutes);

  const server = createServer(getRequestListener(app.fetch));
  const port = await listen(server);
  const baseUrl = `http://127.0.0.1:${port}`;
  const headers = {
    "Content-Type": "application/json",
    "X-User-ID": "user-2",
    "X-Tenant-ID": "tenant-z",
  };

  try {
    for (let attempt = 1; attempt <= 5; attempt++) {
      const response = await fetch(`${baseUrl}/api/phone/provision`, {
        method: "POST",
        headers,
        body: "{}",
      });

      assert.equal(
        response.status,
        400,
        `phone provision request ${attempt} should fail validation before side effects`,
      );
      assert.equal(response.headers.get("x-ratelimit-limit"), "5");
    }

    const sixthProvision = await fetch(`${baseUrl}/api/phone/provision`, {
      method: "POST",
      headers,
      body: "{}",
    });
    assert.equal(sixthProvision.status, 429);
    assert.equal(sixthProvision.headers.get("x-ratelimit-limit"), "5");
  } finally {
    await close(server);
  }
});

test("setup limiter applies on user-auth routes without tenant auth", async () => {
  const app = new Hono();
  app.use("/api/setup/*", async (c, next) => {
    c.set("auth", {
      user: {} as never,
      userId: c.req.header("X-User-ID") || "setup-user",
      tenantId: "",
      role: "",
    });

    await next();
  });
  app.use(
    "/api/setup/*",
    rateLimit({
      prefix: "setup",
      windowMs: 60000,
      max: 20,
    }),
  );
  app.get("/api/setup/progress", (c) => c.json({ ok: true }));

  const server = createServer(getRequestListener(app.fetch));
  const port = await listen(server);
  const baseUrl = `http://127.0.0.1:${port}`;
  const headers = { "X-User-ID": "setup-user" };

  try {
    for (let attempt = 1; attempt <= 20; attempt++) {
      const response = await fetch(`${baseUrl}/api/setup/progress`, {
        headers,
      });
      assert.equal(
        response.status,
        200,
        `setup request ${attempt} should stay below the setup limiter`,
      );
      assert.equal(response.headers.get("x-ratelimit-limit"), "20");
    }

    const twentyFirst = await fetch(`${baseUrl}/api/setup/progress`, {
      headers,
    });
    assert.equal(twentyFirst.status, 429);
    assert.equal(twentyFirst.headers.get("x-ratelimit-limit"), "20");
  } finally {
    await close(server);
  }
});
