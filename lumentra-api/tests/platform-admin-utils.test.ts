import assert from "node:assert/strict";
import test from "node:test";

import {
  isPlatformAdminEmail,
  parsePlatformAdminEmails,
} from "../src/utils/platform-admin.js";

test("parsePlatformAdminEmails normalizes whitespace and casing", () => {
  const emails = parsePlatformAdminEmails(
    " Admin@Example.com,ops@example.com , , Support@Example.com ",
  );

  assert.deepEqual([...emails].sort(), [
    "admin@example.com",
    "ops@example.com",
    "support@example.com",
  ]);
});

test("isPlatformAdminEmail matches allowlisted emails case-insensitively", () => {
  assert.equal(
    isPlatformAdminEmail(
      "ADMIN@example.com",
      "admin@example.com,ops@example.com",
    ),
    true,
  );
  assert.equal(
    isPlatformAdminEmail(
      "viewer@example.com",
      "admin@example.com,ops@example.com",
    ),
    false,
  );
  assert.equal(isPlatformAdminEmail(null, "admin@example.com"), false);
});
