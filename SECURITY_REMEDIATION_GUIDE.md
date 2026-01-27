# Security Remediation Implementation Guide

## Step-by-Step Fixes for Lumentra Platform

---

## Phase 1: Critical - JWT Authentication (Weeks 1-2)

### Step 1.1: Install Required Packages

```bash
cd lumentra-api

npm install @hono/jwt jsonwebtoken bcrypt
npm install -D @types/jsonwebtoken
```

### Step 1.2: Create JWT Service

**File:** `/home/oneknight/Work/callagent/lumentra-api/src/services/auth/jwt-service.ts`

```typescript
import { sign, verify } from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;

if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
  throw new Error("JWT_SECRET and JWT_REFRESH_SECRET must be configured");
}

export interface TokenPayload {
  sub: string; // user ID
  tenant_id: string; // tenant ID
  email: string;
  role?: string;
  iat: number;
  exp: number;
}

export function generateAccessToken(
  payload: Omit<TokenPayload, "iat" | "exp">,
): string {
  return sign(
    { ...payload },
    JWT_SECRET,
    { expiresIn: "1h" }, // 1 hour expiration
  );
}

export function generateRefreshToken(userId: string, tenantId: string): string {
  return sign(
    { sub: userId, tenant_id: tenantId, type: "refresh" },
    JWT_REFRESH_SECRET,
    { expiresIn: "7d" }, // 7 days expiration
  );
}

export function verifyAccessToken(token: string): TokenPayload {
  try {
    return verify(token, JWT_SECRET) as TokenPayload;
  } catch (err) {
    throw new Error("Invalid or expired access token");
  }
}

export function verifyRefreshToken(token: string): {
  sub: string;
  tenant_id: string;
} {
  try {
    return verify(token, JWT_REFRESH_SECRET) as {
      sub: string;
      tenant_id: string;
    };
  } catch (err) {
    throw new Error("Invalid or expired refresh token");
  }
}

export async function hashPassword(password: string): Promise<string> {
  const bcrypt = await import("bcrypt");
  return bcrypt.hash(password, 12);
}

export async function comparePassword(
  password: string,
  hash: string,
): Promise<boolean> {
  const bcrypt = await import("bcrypt");
  return bcrypt.compare(password, hash);
}
```

### Step 1.3: Create Authentication Middleware

**File:** `/home/oneknight/Work/callagent/lumentra-api/src/middleware/auth.ts`

```typescript
import { Context, Next } from "hono";
import { verifyAccessToken } from "../services/auth/jwt-service.js";

export interface AuthContext {
  userId: string;
  tenantId: string;
  email: string;
}

declare global {
  namespace HonoRequest {
    interface HonoRequest {
      auth?: AuthContext;
    }
  }
}

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Missing or invalid Authorization header" }, 401);
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyAccessToken(token);

    // Verify tenant_id matches request header (defense in depth)
    const requestedTenantId = c.req.header("X-Tenant-ID");
    if (requestedTenantId && requestedTenantId !== payload.tenant_id) {
      return c.json({ error: "Tenant ID mismatch" }, 403);
    }

    // Store in context for downstream use
    c.set("userId", payload.sub);
    c.set("tenantId", payload.tenant_id);
    c.set("userEmail", payload.email);

    await next();
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Authentication failed";
    return c.json({ error: message }, 401);
  }
}

// Optional: Stricter middleware that REQUIRES X-Tenant-ID header match
export async function strictTenantMiddleware(c: Context, next: Next) {
  const tenantId = c.get("tenantId");
  const requestedTenantId = c.req.header("X-Tenant-ID");

  if (!requestedTenantId) {
    return c.json({ error: "X-Tenant-ID header required" }, 400);
  }

  if (tenantId !== requestedTenantId) {
    return c.json({ error: "Unauthorized tenant access" }, 403);
  }

  await next();
}

// Role-based access control
export function requireRole(...allowedRoles: string[]) {
  return async (c: Context, next: Next) => {
    const userRole = c.get("userRole") || "user";

    if (!allowedRoles.includes(userRole)) {
      return c.json({ error: "Insufficient permissions" }, 403);
    }

    await next();
  };
}
```

### Step 1.4: Create Authentication Routes

**File:** `/home/oneknight/Work/callagent/lumentra-api/src/routes/auth.ts`

```typescript
import { Hono } from "hono";
import { z } from "zod";
import { getSupabase } from "../services/database/client.js";
import {
  generateAccessToken,
  generateRefreshToken,
  hashPassword,
  comparePassword,
  verifyRefreshToken,
} from "../services/auth/jwt-service.js";

export const authRoutes = new Hono();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1),
  company: z.string().optional(),
});

const refreshSchema = z.object({
  refresh_token: z.string(),
});

/**
 * POST /auth/register
 * Register a new user and tenant
 */
authRoutes.post("/register", async (c) => {
  const body = await c.req.json();

  try {
    const validated = registerSchema.parse(body);
    const db = getSupabase();

    // Check if user exists
    const { data: existingUser } = await db
      .from("users")
      .select("id")
      .eq("email", validated.email)
      .single();

    if (existingUser) {
      return c.json({ error: "User already exists" }, 409);
    }

    // Create tenant first
    const { data: tenant, error: tenantError } = await db
      .from("tenants")
      .insert([
        {
          name: validated.company || validated.name,
          subscription_tier: "free",
        },
      ])
      .select("id")
      .single();

    if (tenantError || !tenant) {
      throw new Error("Failed to create tenant");
    }

    // Hash password
    const hashedPassword = await hashPassword(validated.password);

    // Create user
    const { data: user, error: userError } = await db
      .from("users")
      .insert([
        {
          email: validated.email,
          password_hash: hashedPassword,
          name: validated.name,
          tenant_id: tenant.id,
          role: "admin",
        },
      ])
      .select("id, email, tenant_id, name")
      .single();

    if (userError || !user) {
      throw new Error("Failed to create user");
    }

    // Generate tokens
    const accessToken = generateAccessToken({
      sub: user.id,
      tenant_id: user.tenant_id,
      email: user.email,
    });

    const refreshToken = generateRefreshToken(user.id, user.tenant_id);

    return c.json(
      {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          tenant_id: user.tenant_id,
        },
        tokens: {
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_in: 3600,
        },
      },
      201,
    );
  } catch (err) {
    const message =
      err instanceof z.ZodError
        ? err.errors.map((e) => e.message).join(", ")
        : err instanceof Error
          ? err.message
          : "Registration failed";

    return c.json({ error: message }, 400);
  }
});

/**
 * POST /auth/login
 * Login with email and password
 */
authRoutes.post("/login", async (c) => {
  const body = await c.req.json();

  try {
    const validated = loginSchema.parse(body);
    const db = getSupabase();

    // Find user
    const { data: user, error } = await db
      .from("users")
      .select("id, email, password_hash, tenant_id, name")
      .eq("email", validated.email)
      .single();

    if (error || !user) {
      return c.json({ error: "Invalid credentials" }, 401);
    }

    // Verify password
    const passwordValid = await comparePassword(
      validated.password,
      user.password_hash,
    );

    if (!passwordValid) {
      return c.json({ error: "Invalid credentials" }, 401);
    }

    // Generate tokens
    const accessToken = generateAccessToken({
      sub: user.id,
      tenant_id: user.tenant_id,
      email: user.email,
    });

    const refreshToken = generateRefreshToken(user.id, user.tenant_id);

    return c.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        tenant_id: user.tenant_id,
      },
      tokens: {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: 3600,
      },
    });
  } catch (err) {
    const message =
      err instanceof z.ZodError
        ? err.errors.map((e) => e.message).join(", ")
        : "Login failed";

    return c.json({ error: message }, 400);
  }
});

/**
 * POST /auth/refresh
 * Refresh access token using refresh token
 */
authRoutes.post("/refresh", async (c) => {
  const body = await c.req.json();

  try {
    const validated = refreshSchema.parse(body);
    const payload = verifyRefreshToken(validated.refresh_token);

    const accessToken = generateAccessToken({
      sub: payload.sub,
      tenant_id: payload.tenant_id,
      email: "unknown", // Fetch from DB if needed
    });

    return c.json({
      access_token: accessToken,
      expires_in: 3600,
    });
  } catch (err) {
    return c.json({ error: "Invalid refresh token" }, 401);
  }
});
```

### Step 1.5: Update Main Index File

**File:** `/home/oneknight/Work/callagent/lumentra-api/src/index.ts`

Replace the imports and middleware section:

```typescript
import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { timing } from "hono/timing";
import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "http";
import type { Server } from "http";

// Import authentication
import { authMiddleware } from "./middleware/auth.js";
import { authRoutes } from "./routes/auth.js";

// ... rest of imports

const app = new Hono();

// Security Headers Middleware
app.use("*", (c, next) => {
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("X-XSS-Protection", "1; mode=block");
  c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  c.header(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';",
  );
  return next();
});

// Logging and Timing
app.use("*", logger());
app.use("*", timing());

// CORS - Restrictive whitelist
const allowedOrigins = [
  "https://app.lumentra.io",
  "https://dashboard.lumentra.io",
];

if (process.env.NODE_ENV === "development") {
  allowedOrigins.push("http://localhost:3000", "http://localhost:3100");
}

app.use(
  "*",
  cors({
    origin: allowedOrigins,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-Tenant-ID"],
    credentials: true,
  }),
);

// Public routes (no auth required)
app.route("/health", healthRoutes);
app.route("/auth", authRoutes);

// Protected routes (auth required)
app.use("/api/*", authMiddleware);
app.route("/api/calls", callsRoutes);
app.route("/api/contacts", contactsRoutes);
app.route("/api/bookings", bookingsRoutes);
// ... rest of routes
```

### Step 1.6: Update Environment Variables

**Add to `.env`:**

```
JWT_SECRET=your-super-secret-key-min-32-chars-xxxxxxxxxxxxx
JWT_REFRESH_SECRET=your-refresh-secret-min-32-chars-xxxxxxxxx
```

Generate secure secrets:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Phase 2: High Priority - Rate Limiting & Headers (Weeks 2-3)

### Step 2.1: Install Rate Limiting Package

```bash
npm install @hono/rate-limit
```

### Step 2.2: Create Rate Limiting Middleware

**File:** `/home/oneknight/Work/callagent/lumentra-api/src/middleware/rate-limit.ts`

```typescript
import { Context, Next } from "hono";
import { RateLimiter } from "@hono/rate-limit";

// In-memory store for demo (use Redis in production)
interface RateLimitStore {
  [key: string]: { count: number; resetTime: number };
}

const store: RateLimitStore = {};

function getClientIp(c: Context): string {
  return (
    c.req.header("x-forwarded-for")?.split(",")[0].trim() ||
    c.req.header("x-real-ip") ||
    "unknown"
  );
}

export function createRateLimiter(
  windowMs: number,
  maxRequests: number,
  keyGenerator: (c: Context) => string = getClientIp,
) {
  return async (c: Context, next: Next) => {
    const key = keyGenerator(c);
    const now = Date.now();

    if (!store[key]) {
      store[key] = { count: 0, resetTime: now + windowMs };
    }

    const record = store[key];

    if (now > record.resetTime) {
      record.count = 0;
      record.resetTime = now + windowMs;
    }

    record.count++;

    // Add rate limit headers
    c.header("X-RateLimit-Limit", maxRequests.toString());
    c.header(
      "X-RateLimit-Remaining",
      Math.max(0, maxRequests - record.count).toString(),
    );
    c.header("X-RateLimit-Reset", record.resetTime.toString());

    if (record.count > maxRequests) {
      return c.json(
        {
          error: "Too many requests. Please try again later.",
          retryAfter: Math.ceil((record.resetTime - now) / 1000),
        },
        429,
      );
    }

    await next();
  };
}

// Preset rate limiters
export const globalRateLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  100, // 100 requests per window
  (c) => getClientIp(c),
);

export const apiRateLimiter = createRateLimiter(
  1 * 60 * 1000, // 1 minute
  30, // 30 requests per minute
  (c) => `${getClientIp(c)}:${c.get("userId")}`,
);

export const strictRateLimiter = createRateLimiter(
  1 * 60 * 1000, // 1 minute
  5, // 5 requests per minute (for sensitive operations)
  (c) => `${getClientIp(c)}:${c.get("userId")}`,
);
```

### Step 2.3: Apply Rate Limiting

**Update `src/index.ts`:**

```typescript
import { globalRateLimiter, apiRateLimiter } from "./middleware/rate-limit.js";

// Apply global rate limiter
app.use("*", globalRateLimiter);

// Apply stricter API rate limit to protected routes
app.use("/api/*", apiRateLimiter);
```

---

## Phase 3: Data Isolation - Row-Level Security (Weeks 3-4)

### Step 3.1: Database Schema Updates

**File:** Create migration `/home/oneknight/Work/callagent/lumentra-api/migrations/008_rls_policies.sql`

```sql
-- Enable RLS on all tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;

-- Tenant Isolation Policy for Users
CREATE POLICY users_tenant_isolation
ON users
FOR SELECT
USING (
  tenant_id = (
    SELECT tenant_id FROM users WHERE id = auth.uid()
  )
);

-- Tenant Isolation Policy for Calls
CREATE POLICY calls_tenant_isolation
ON calls
FOR SELECT
USING (
  tenant_id = (
    SELECT tenant_id FROM users WHERE id = auth.uid()
  )
);

CREATE POLICY calls_insert
ON calls
FOR INSERT
WITH CHECK (
  tenant_id = (
    SELECT tenant_id FROM users WHERE id = auth.uid()
  )
);

-- Similar policies for other tables...
```

### Step 3.2: Switch to Anon Key

**Update `src/services/database/client.ts`:**

```typescript
export function getSupabase(): SupabaseClient {
  if (!supabase) {
    const supabaseUrl = process.env.SUPABASE_URL;
    // Use ANON_KEY to enforce RLS policies
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
    }

    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      db: {
        schema: "public",
      },
      global: {
        headers: {
          // This will be set per-request via createUserClient
        },
      },
    });
  }

  return supabase;
}

// NEW: Create client with user context
export function createSupabaseClientWithUser(userId: string): SupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_ANON_KEY!;

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${createUserJWT(userId)}`,
      },
    },
  });
}

function createUserJWT(userId: string): string {
  // Create short-lived JWT for Supabase auth
  // This ensures RLS policies use the correct user context
  const payload = {
    sub: userId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  };

  return sign(payload, process.env.SUPABASE_JWT_SECRET!);
}
```

---

## Phase 4: Comprehensive Testing (Week 4+)

### Step 4.1: Security Test Suite

**File:** `/home/oneknight/Work/callagent/lumentra-api/src/__tests__/security.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { serve } from "@hono/node-server";
import app from "../index";
import { generateAccessToken } from "../services/auth/jwt-service";

describe("Security Tests", () => {
  let server: any;
  const baseUrl = "http://localhost:3001";
  let validToken: string;
  let tenantId: string;

  beforeAll(async () => {
    server = serve({ fetch: app.fetch, port: 3001 });

    // Generate valid token for testing
    validToken = generateAccessToken({
      sub: "test-user-123",
      tenant_id: "test-tenant-456",
      email: "test@example.com",
    });

    tenantId = "test-tenant-456";
  });

  afterAll(async () => {
    server.close();
  });

  describe("Authentication", () => {
    it("should reject requests without Authorization header", async () => {
      const response = await fetch(`${baseUrl}/api/contacts`, {
        headers: { "X-Tenant-ID": tenantId },
      });

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe("Missing or invalid Authorization header");
    });

    it("should reject requests with invalid token", async () => {
      const response = await fetch(`${baseUrl}/api/contacts`, {
        headers: {
          Authorization: "Bearer invalid.token.here",
          "X-Tenant-ID": tenantId,
        },
      });

      expect(response.status).toBe(401);
    });

    it("should accept valid token", async () => {
      const response = await fetch(`${baseUrl}/api/contacts`, {
        headers: {
          Authorization: `Bearer ${validToken}`,
          "X-Tenant-ID": tenantId,
        },
      });

      // Might be 200 or 500 depending on DB state, but NOT 401
      expect([200, 500]).toContain(response.status);
    });
  });

  describe("Multi-Tenant Isolation", () => {
    it("should reject tenant ID mismatch", async () => {
      const response = await fetch(`${baseUrl}/api/contacts`, {
        headers: {
          Authorization: `Bearer ${validToken}`,
          "X-Tenant-ID": "different-tenant-999",
        },
      });

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toContain("Tenant");
    });

    it("should accept matching tenant ID", async () => {
      const response = await fetch(`${baseUrl}/api/contacts`, {
        headers: {
          Authorization: `Bearer ${validToken}`,
          "X-Tenant-ID": tenantId,
        },
      });

      expect([200, 500]).toContain(response.status); // Not 403
    });
  });

  describe("Rate Limiting", () => {
    it("should enforce rate limits", async () => {
      const promises = [];

      // Make 50 requests rapidly
      for (let i = 0; i < 50; i++) {
        promises.push(
          fetch(`${baseUrl}/api/contacts`, {
            headers: {
              Authorization: `Bearer ${validToken}`,
              "X-Tenant-ID": tenantId,
            },
          }),
        );
      }

      const responses = await Promise.all(promises);
      const tooManyRequests = responses.filter((r) => r.status === 429);

      expect(tooManyRequests.length).toBeGreaterThan(0);
    });
  });

  describe("CORS", () => {
    it("should reject requests from unauthorized origins", async () => {
      const response = await fetch(`${baseUrl}/api/contacts`, {
        headers: {
          Authorization: `Bearer ${validToken}`,
          "X-Tenant-ID": tenantId,
          Origin: "https://evil.com",
        },
      });

      // Should be rejected due to CORS
      expect(response.status).toBe(403);
    });
  });

  describe("Security Headers", () => {
    it("should include required security headers", async () => {
      const response = await fetch(`${baseUrl}/health`);

      expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
      expect(response.headers.get("X-Frame-Options")).toBe("DENY");
      expect(response.headers.get("Strict-Transport-Security")).toBeTruthy();
    });
  });
});
```

### Step 4.2: Run Tests

```bash
npm install -D jest @jest/globals @types/jest ts-jest

# Add to package.json
"scripts": {
  "test:security": "jest --testPathPattern=security",
  "test": "jest"
}

npm run test:security
```

---

## Environment Configuration Checklist

### Required Environment Variables

```bash
# Copy this to your .env file and fill in actual values

# ============ AUTHENTICATION ============
JWT_SECRET=<generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
JWT_REFRESH_SECRET=<generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
SUPABASE_JWT_SECRET=<from Supabase project settings>

# ============ DATABASE ============
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=<from Supabase - NOT the service role key>
SUPABASE_SERVICE_ROLE_KEY=<REMOVE FROM PRODUCTION - only for migrations>

# ============ AI/LLM SERVICES ============
GEMINI_API_KEY=<your-key>
GROQ_API_KEY=<your-key>
DEEPGRAM_API_KEY=<your-key>
CARTESIA_API_KEY=<your-key>

# ============ EXTERNAL SERVICES ============
SIGNALWIRE_PROJECT_ID=<your-id>
SIGNALWIRE_API_TOKEN=<your-token>
SIGNALWIRE_PHONE_NUMBER=+1xxxxxxxxxx
TWILIO_ACCOUNT_SID=<your-sid>
TWILIO_AUTH_TOKEN=<your-token>
TWILIO_PHONE_NUMBER=+1xxxxxxxxxx
RESEND_API_KEY=<your-key>
STRIPE_SECRET_KEY=<your-key>
STRIPE_WEBHOOK_SECRET=<your-webhook-secret>

# ============ DEPLOYMENT ============
PORT=3100
NODE_ENV=production
BACKEND_URL=https://api.lumentra.io
FRONTEND_URL=https://app.lumentra.io
```

---

## Deployment Verification Checklist

Before deploying to production:

- [ ] All Phase 1 items implemented (JWT auth, tenant isolation)
- [ ] Rate limiting configured
- [ ] Security headers middleware active
- [ ] CORS whitelist properly configured
- [ ] Environment variables set correctly (NO service role key in prod)
- [ ] Database RLS policies enabled
- [ ] Error logging configured (Sentry/DataDog)
- [ ] Audit logging implemented
- [ ] HTTPS enabled with valid certificates
- [ ] Security tests passing
- [ ] Code review completed by security team
- [ ] Penetration testing performed on staging

---

## Post-Deployment Monitoring

### Daily Checks

```bash
# Monitor failed authentication attempts
tail -f logs/app.log | grep "401\|403"

# Check for rate limit violations
tail -f logs/app.log | grep "429"

# Monitor database errors
tail -f logs/db.log | grep "ERROR"
```

### Weekly Security Review

- [ ] Analyze authentication failure patterns
- [ ] Review audit logs for anomalies
- [ ] Check dependency vulnerability updates
- [ ] Review access control decisions

### Monthly Comprehensive Audit

- [ ] Full security test suite
- [ ] Log analysis and correlation
- [ ] Penetration test (quarterly minimum)
- [ ] Dependency and vulnerability scan

---

## Questions During Implementation

If you encounter issues during implementation:

1. **JWT Secret Generation Issues:**

   - Use Node.js: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   - Ensure secrets are 32+ characters

2. **Database Connection Issues:**

   - Verify SUPABASE_ANON_KEY is correct
   - Check RLS policies are enabled
   - Test connection with curl

3. **Rate Limiting Not Working:**

   - Ensure middleware is applied BEFORE routes
   - Check client IP detection (X-Forwarded-For header)
   - In production, use Redis store instead of in-memory

4. **CORS Errors:**
   - Verify frontend URL is in allowedOrigins array
   - Check browser console for exact error
   - Ensure preflight OPTIONS requests are handled

---

**Implementation Timeline:** 2-4 weeks for full remediation
**Estimated Effort:** 40-60 developer hours
**Risk Level After Fixes:** LOW (with ongoing monitoring)
