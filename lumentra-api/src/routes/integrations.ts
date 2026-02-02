import { Hono } from "hono";
import { getSupabase } from "../services/database/client.js";
import { getAuthUserId } from "../middleware/index.js";
import type { IntegrationProvider } from "../types/database.js";

export const integrationsRoutes = new Hono();

// In-memory OAuth state storage (in production, use Redis)
const oauthStates = new Map<
  string,
  { tenantId: string; provider: string; expiresAt: number }
>();

// Clean up expired states periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of oauthStates.entries()) {
    if (value.expiresAt < now) {
      oauthStates.delete(key);
    }
  }
}, 60000); // Every minute

// OAuth provider configurations
const OAUTH_CONFIGS: Record<
  string,
  {
    authUrl: string;
    tokenUrl: string;
    scopes: string;
    clientIdEnv: string;
    clientSecretEnv: string;
  }
> = {
  google_calendar: {
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: "https://www.googleapis.com/auth/calendar",
    clientIdEnv: "GOOGLE_CLIENT_ID",
    clientSecretEnv: "GOOGLE_CLIENT_SECRET",
  },
  outlook: {
    authUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    scopes: "https://graph.microsoft.com/Calendars.ReadWrite offline_access",
    clientIdEnv: "MICROSOFT_CLIENT_ID",
    clientSecretEnv: "MICROSOFT_CLIENT_SECRET",
  },
  calendly: {
    authUrl: "https://auth.calendly.com/oauth/authorize",
    tokenUrl: "https://auth.calendly.com/oauth/token",
    scopes: "default",
    clientIdEnv: "CALENDLY_CLIENT_ID",
    clientSecretEnv: "CALENDLY_CLIENT_SECRET",
  },
};

function generateState(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * GET /api/integrations
 * Returns tenant's connected integrations
 */
integrationsRoutes.get("/", async (c) => {
  const userId = getAuthUserId(c);
  const db = getSupabase();

  // Get tenant
  const { data: membership } = await db
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (!membership) {
    return c.json({ integrations: [] });
  }

  const { data: integrations, error } = await db
    .from("tenant_integrations")
    .select("id, provider, status, external_account_id, created_at, updated_at")
    .eq("tenant_id", membership.tenant_id);

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({ integrations: integrations || [] });
});

/**
 * GET /api/integrations/providers
 * Returns available integration providers
 */
integrationsRoutes.get("/providers", async (c) => {
  const providers = [
    {
      id: "google_calendar",
      name: "Google Calendar",
      icon: "google",
      description: "Sync appointments with Google Calendar",
      configured: !!process.env.GOOGLE_CLIENT_ID,
    },
    {
      id: "outlook",
      name: "Microsoft Outlook",
      icon: "microsoft",
      description: "Sync appointments with Outlook Calendar",
      configured: !!process.env.MICROSOFT_CLIENT_ID,
    },
    {
      id: "calendly",
      name: "Calendly",
      icon: "calendly",
      description: "Connect your Calendly scheduling",
      configured: !!process.env.CALENDLY_CLIENT_ID,
    },
    {
      id: "acuity",
      name: "Acuity Scheduling",
      icon: "calendar",
      description: "Connect your Acuity scheduling",
      configured: false, // Not yet implemented
    },
    {
      id: "square",
      name: "Square Appointments",
      icon: "square",
      description: "Sync with Square Appointments",
      configured: false, // Not yet implemented
    },
  ];

  return c.json({ providers });
});

/**
 * GET /api/integrations/:provider/authorize
 * Initiates OAuth flow - returns authorization URL
 */
integrationsRoutes.get("/:provider/authorize", async (c) => {
  const provider = c.req.param("provider") as IntegrationProvider;
  const userId = getAuthUserId(c);
  const db = getSupabase();

  // Validate provider
  const config = OAUTH_CONFIGS[provider];
  if (!config) {
    return c.json({ error: "Unsupported provider" }, 400);
  }

  // Check if OAuth is configured
  const clientId = process.env[config.clientIdEnv];
  if (!clientId) {
    return c.json(
      { error: `${provider} integration not configured on server` },
      400,
    );
  }

  // Get tenant
  const { data: membership } = await db
    .from("tenant_members")
    .select("tenant_id, role")
    .eq("user_id", userId)
    .eq("is_active", true)
    .in("role", ["owner", "admin"])
    .maybeSingle();

  if (!membership) {
    return c.json({ error: "Forbidden" }, 403);
  }

  // Generate state parameter
  const state = generateState();

  // Store state with tenant ID (expires in 10 minutes)
  oauthStates.set(state, {
    tenantId: membership.tenant_id,
    provider,
    expiresAt: Date.now() + 10 * 60 * 1000,
  });

  // Build redirect URI
  const backendUrl = process.env.BACKEND_URL || "http://localhost:3100";
  const redirectUri = `${backendUrl}/api/integrations/${provider}/callback`;

  // Build authorization URL
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: config.scopes,
    state,
    access_type: "offline", // For refresh token (Google)
    prompt: "consent", // Force consent to get refresh token
  });

  const authUrl = `${config.authUrl}?${params.toString()}`;

  return c.json({ authUrl });
});

/**
 * GET /api/integrations/:provider/callback
 * Handles OAuth callback
 */
integrationsRoutes.get("/:provider/callback", async (c) => {
  const provider = c.req.param("provider") as IntegrationProvider;
  const code = c.req.query("code");
  const state = c.req.query("state");
  const error = c.req.query("error");

  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  const redirectBase = `${frontendUrl}/setup/integrations`;

  // Handle OAuth errors
  if (error) {
    return c.redirect(`${redirectBase}?error=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return c.redirect(`${redirectBase}?error=missing_params`);
  }

  // Verify state
  const stateData = oauthStates.get(state);
  if (!stateData || stateData.expiresAt < Date.now()) {
    oauthStates.delete(state);
    return c.redirect(`${redirectBase}?error=invalid_state`);
  }

  // Remove used state
  oauthStates.delete(state);

  // Get OAuth config
  const config = OAUTH_CONFIGS[provider];
  if (!config) {
    return c.redirect(`${redirectBase}?error=unsupported_provider`);
  }

  const clientId = process.env[config.clientIdEnv];
  const clientSecret = process.env[config.clientSecretEnv];

  if (!clientId || !clientSecret) {
    return c.redirect(`${redirectBase}?error=server_config_error`);
  }

  try {
    // Exchange code for tokens
    const backendUrl = process.env.BACKEND_URL || "http://localhost:3100";
    const redirectUri = `${backendUrl}/api/integrations/${provider}/callback`;

    const tokenResponse = await fetch(config.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error(
        `[OAUTH] Token exchange failed for ${provider}:`,
        errorText,
      );
      return c.redirect(`${redirectBase}?error=token_exchange_failed`);
    }

    const tokens = (await tokenResponse.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };

    // Get user info / external account ID
    let externalAccountId = null;
    try {
      if (provider === "google_calendar") {
        const userInfo = await fetch(
          "https://www.googleapis.com/oauth2/v2/userinfo",
          {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
          },
        );
        if (userInfo.ok) {
          const user = (await userInfo.json()) as { email?: string };
          externalAccountId = user.email;
        }
      } else if (provider === "outlook") {
        const userInfo = await fetch("https://graph.microsoft.com/v1.0/me", {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        if (userInfo.ok) {
          const user = (await userInfo.json()) as {
            userPrincipalName?: string;
          };
          externalAccountId = user.userPrincipalName;
        }
      }
    } catch (e) {
      console.error(`[OAUTH] Failed to get user info for ${provider}:`, e);
    }

    // Calculate token expiration
    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null;

    // Store integration in database
    const db = getSupabase();

    // Upsert integration
    const { error: dbError } = await db.from("tenant_integrations").upsert(
      {
        tenant_id: stateData.tenantId,
        provider,
        access_token: tokens.access_token, // TODO: Encrypt in production
        refresh_token: tokens.refresh_token || null,
        token_expires_at: expiresAt,
        scopes: config.scopes,
        external_account_id: externalAccountId,
        status: "active",
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "tenant_id,provider",
      },
    );

    if (dbError) {
      console.error(`[OAUTH] Database error for ${provider}:`, dbError);
      return c.redirect(`${redirectBase}?error=database_error`);
    }

    return c.redirect(`${redirectBase}?success=true&provider=${provider}`);
  } catch (e) {
    console.error(`[OAUTH] Error during callback for ${provider}:`, e);
    return c.redirect(`${redirectBase}?error=server_error`);
  }
});

/**
 * DELETE /api/integrations/:id
 * Disconnects an integration
 */
integrationsRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const userId = getAuthUserId(c);
  const db = getSupabase();

  // Get tenant membership
  const { data: membership } = await db
    .from("tenant_members")
    .select("tenant_id, role")
    .eq("user_id", userId)
    .eq("is_active", true)
    .in("role", ["owner", "admin"])
    .maybeSingle();

  if (!membership) {
    return c.json({ error: "Forbidden" }, 403);
  }

  // Verify integration belongs to tenant
  const { data: integration } = await db
    .from("tenant_integrations")
    .select("id, tenant_id, provider")
    .eq("id", id)
    .single();

  if (!integration || integration.tenant_id !== membership.tenant_id) {
    return c.json({ error: "Integration not found" }, 404);
  }

  // Delete integration
  const { error } = await db.from("tenant_integrations").delete().eq("id", id);

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({ success: true });
});

/**
 * POST /api/integrations/:id/refresh
 * Refreshes an integration's access token
 */
integrationsRoutes.post("/:id/refresh", async (c) => {
  const id = c.req.param("id");
  const userId = getAuthUserId(c);
  const db = getSupabase();

  // Get tenant membership
  const { data: membership } = await db
    .from("tenant_members")
    .select("tenant_id, role")
    .eq("user_id", userId)
    .eq("is_active", true)
    .in("role", ["owner", "admin"])
    .maybeSingle();

  if (!membership) {
    return c.json({ error: "Forbidden" }, 403);
  }

  // Get integration
  const { data: integration } = await db
    .from("tenant_integrations")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", membership.tenant_id)
    .single();

  if (!integration) {
    return c.json({ error: "Integration not found" }, 404);
  }

  if (!integration.refresh_token) {
    return c.json({ error: "No refresh token available" }, 400);
  }

  // Get OAuth config
  const config = OAUTH_CONFIGS[integration.provider];
  if (!config) {
    return c.json({ error: "Unsupported provider" }, 400);
  }

  const clientId = process.env[config.clientIdEnv];
  const clientSecret = process.env[config.clientSecretEnv];

  if (!clientId || !clientSecret) {
    return c.json({ error: "Server configuration error" }, 500);
  }

  try {
    // Refresh token
    const tokenResponse = await fetch(config.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: integration.refresh_token,
        grant_type: "refresh_token",
      }),
    });

    if (!tokenResponse.ok) {
      // Token refresh failed - mark integration as expired
      await db
        .from("tenant_integrations")
        .update({
          status: "expired",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      return c.json({ error: "Token refresh failed", status: "expired" }, 400);
    }

    const tokens = (await tokenResponse.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };

    // Update integration
    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null;

    await db
      .from("tenant_integrations")
      .update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || integration.refresh_token,
        token_expires_at: expiresAt,
        status: "active",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    return c.json({ success: true, status: "active" });
  } catch (e) {
    console.error(`[OAUTH] Token refresh error:`, e);
    return c.json({ error: "Server error" }, 500);
  }
});
