import assert from "node:assert/strict";
import test from "node:test";

import { buildAuthCallbackUrl } from "../lib/supabase/auth-redirect.ts";
import {
  getAuthenticatedRedirectPath,
  isProtectedRoutePath,
  shouldRedirectUnverifiedUser,
} from "../lib/supabase/route-access.ts";

test("protected route detection matches dashboard and setup sections only", () => {
  assert.equal(isProtectedRoutePath("/dashboard"), true);
  assert.equal(isProtectedRoutePath("/setup/assistant"), true);
  assert.equal(isProtectedRoutePath("/settings/team"), true);
  assert.equal(isProtectedRoutePath("/verify-email"), false);
  assert.equal(isProtectedRoutePath("/pricing"), false);
});

test("unverified users are redirected off protected and auth routes but allowed on verification paths", () => {
  assert.equal(shouldRedirectUnverifiedUser("/dashboard"), true);
  assert.equal(shouldRedirectUnverifiedUser("/setup/business"), true);
  assert.equal(shouldRedirectUnverifiedUser("/login"), true);
  assert.equal(shouldRedirectUnverifiedUser("/signup"), true);
  assert.equal(shouldRedirectUnverifiedUser("/verify-email"), false);
  assert.equal(shouldRedirectUnverifiedUser("/auth/callback"), false);
  assert.equal(shouldRedirectUnverifiedUser("/"), false);
});

test("authenticated redirect stays on setup until membership and setup completion exist", () => {
  assert.equal(
    getAuthenticatedRedirectPath({
      hasMembership: false,
      isSetupComplete: false,
    }),
    "/setup",
  );
  assert.equal(
    getAuthenticatedRedirectPath({
      hasMembership: true,
      isSetupComplete: false,
    }),
    "/setup",
  );
  assert.equal(
    getAuthenticatedRedirectPath({
      hasMembership: true,
      isSetupComplete: true,
    }),
    "/dashboard",
  );
});

test("auth callback builder preserves configured callback URLs and sets the next destination", () => {
  const originalRedirectUrl = process.env.NEXT_PUBLIC_AUTH_REDIRECT_URL;
  process.env.NEXT_PUBLIC_AUTH_REDIRECT_URL =
    "https://app.example.com/auth/callback?source=email";

  try {
    assert.equal(
      buildAuthCallbackUrl("https://ignored.example.com"),
      "https://app.example.com/auth/callback?source=email&next=%2Fsetup",
    );
    assert.equal(
      buildAuthCallbackUrl("https://ignored.example.com", "/dashboard"),
      "https://app.example.com/auth/callback?source=email&next=%2Fdashboard",
    );
  } finally {
    if (originalRedirectUrl === undefined) {
      delete process.env.NEXT_PUBLIC_AUTH_REDIRECT_URL;
    } else {
      process.env.NEXT_PUBLIC_AUTH_REDIRECT_URL = originalRedirectUrl;
    }
  }
});
