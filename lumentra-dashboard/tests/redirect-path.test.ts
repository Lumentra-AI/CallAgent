import assert from "node:assert/strict";
import test from "node:test";

import { getSafeRedirectPath } from "../lib/security/redirect.ts";

test("getSafeRedirectPath allows internal relative paths", () => {
  assert.equal(getSafeRedirectPath("/dashboard"), "/dashboard");
  assert.equal(
    getSafeRedirectPath("/setup/integrations?success=true#done"),
    "/setup/integrations?success=true#done",
  );
});

test("getSafeRedirectPath falls back for missing or invalid redirect targets", () => {
  assert.equal(getSafeRedirectPath(null), "/setup");
  assert.equal(getSafeRedirectPath("https://evil.com"), "/setup");
  assert.equal(getSafeRedirectPath("//evil.com"), "/setup");
  assert.equal(getSafeRedirectPath("javascript:alert(1)"), "/setup");
  assert.equal(
    getSafeRedirectPath("/auth/callback?next=https://evil.com"),
    "/setup",
  );
  assert.equal(getSafeRedirectPath("/safe\\evil"), "/setup");
});
