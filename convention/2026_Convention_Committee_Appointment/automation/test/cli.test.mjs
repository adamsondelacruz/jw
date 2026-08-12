import test from "node:test";
import assert from "node:assert/strict";
import { assignmentFromArgs } from "../lib/cli.mjs";

test("approved manifest supplies the single default trial mapping", async () => {
  const result = await assignmentFromArgs(["--dry-run"]);
  assert.equal(result.role, "Accounts Overseer");
  assert.equal(result.expectedName, "Jerus Joaquin");
  assert.match(result.email, /@jwpub\.org$/i);
  assert.equal(result.mode, "dry-run");
});

test("argument overrides must match the approved mapping", async () => {
  await assert.rejects(() => assignmentFromArgs(["--role", "Installation Overseer"]), { code: "role-not-allowed" });
  await assert.rejects(() => assignmentFromArgs(["--email", "someone@jwpub.org"]), { code: "email-not-approved" });
  await assert.rejects(() => assignmentFromArgs(["--expected-name", "Someone Else"]), { code: "name-not-approved" });
});
