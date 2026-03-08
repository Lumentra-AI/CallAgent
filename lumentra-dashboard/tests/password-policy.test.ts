import test from "node:test";
import assert from "node:assert/strict";

import {
  getPasswordRequirements,
  validatePassword,
} from "../lib/utils/password.ts";

test("strong passwords satisfy every requirement", () => {
  const validation = validatePassword("ValidP@ss1");

  assert.equal(validation.valid, true);
  assert.deepEqual(validation.errors, []);
  assert.ok(validation.requirements.every((requirement) => requirement.met));
});

test("common passwords are rejected even when they meet basic length", () => {
  const validation = validatePassword("Password123!");

  assert.equal(validation.valid, false);
  assert.ok(validation.errors.includes("Not a common password"));
});

test("weak passwords report specific missing requirements", () => {
  const requirements = getPasswordRequirements("abcdefghij");

  assert.equal(
    requirements.find((requirement) => requirement.id === "length")?.met,
    true,
  );
  assert.equal(
    requirements.find((requirement) => requirement.id === "uppercase")?.met,
    false,
  );
  assert.equal(
    requirements.find((requirement) => requirement.id === "number")?.met,
    false,
  );
  assert.equal(
    requirements.find((requirement) => requirement.id === "special")?.met,
    false,
  );
});
