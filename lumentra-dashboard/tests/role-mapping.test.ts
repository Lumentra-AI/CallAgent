import assert from "node:assert/strict";
import test from "node:test";

import { mapTenantRoleToUserRole } from "../lib/auth/roles.ts";

test("mapTenantRoleToUserRole maps owner/admin to dashboard admin", () => {
  assert.equal(mapTenantRoleToUserRole("owner"), "admin");
  assert.equal(mapTenantRoleToUserRole("admin"), "admin");
});

test("mapTenantRoleToUserRole maps member/readonly and unknown roles to staff", () => {
  assert.equal(mapTenantRoleToUserRole("member"), "staff");
  assert.equal(mapTenantRoleToUserRole("readonly"), "staff");
  assert.equal(mapTenantRoleToUserRole("mystery-role"), "staff");
  assert.equal(mapTenantRoleToUserRole(undefined), "staff");
});
