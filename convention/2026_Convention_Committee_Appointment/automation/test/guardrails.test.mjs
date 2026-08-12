import test from "node:test";
import assert from "node:assert/strict";
import {
  assertAllowedRole, assertAllowedUrl, assertEventText, assertIdentityMatch, normalizeIdentity, parseMode,
} from "../lib/guardrails.mjs";
import { CONVENTION_ID } from "../lib/config.mjs";

const base = `https://hub.jw.org/convention-information/en/conventions/${CONVENTION_ID}/responsibilities`;

test("allows only the exact convention responsibilities path", () => {
  assert.equal(assertAllowedUrl(base).kind, "responsibilities");
  assert.throws(() => assertAllowedUrl("https://example.com/"), { code: "disallowed-host" });
  assert.throws(() => assertAllowedUrl("https://hub.jw.org/convention-information/en/conventions/wrong/responsibilities"), { code: "wrong-convention" });
  assert.throws(() => assertAllowedUrl(`https://hub.jw.org/convention-information/en/conventions/${CONVENTION_ID}/overview`), { code: "wrong-section" });
});

test("login redirects fail unless explicitly permitted", () => {
  assert.throws(() => assertAllowedUrl("https://login.jw.org/"), { code: "unauthenticated" });
  assert.equal(assertAllowedUrl("https://login.jw.org/", { allowLogin: true }).kind, "login");
});

test("role allowlist contains only reviewed chart-to-Hub responsibilities", () => {
  assert.equal(assertAllowedRole(" Accounts Overseer "), "Accounts Overseer");
  assert.equal(assertAllowedRole("Attendant Overseer"), "Attendant Overseer");
  assert.throws(() => assertAllowedRole("Installation Overseer"), { code: "role-not-allowed" });
});

test("event text must identify the exact event", () => {
  assert.doesNotThrow(() => assertEventText("Auckland NS (TG) - 2026 Responsibilities"));
  assert.doesNotThrow(() => assertEventText("AUCKLAND NS (TG) — 2026 Responsibilities"));
  assert.throws(() => assertEventText("Auckland English - 2026"), { code: "wrong-event-label" });
});

test("identity matching tolerates order and punctuation but requires every expected token", () => {
  assert.equal(normalizeIdentity("Joaquin, Jerus"), "joaquin jerus");
  assert.equal(assertIdentityMatch("Jerus Joaquin", "Confirm person: Joaquin, Jerus — Auckland"), true);
  assert.throws(() => assertIdentityMatch("Jerus Joaquin", "Jerus Mercado"), { code: "identity-mismatch" });
});

test("dry run is default and confirm is explicit", () => {
  assert.equal(parseMode([]), "dry-run");
  assert.equal(parseMode(["--dry-run"]), "dry-run");
  assert.equal(parseMode(["--confirm"]), "confirm");
  assert.throws(() => parseMode(["--dry-run", "--confirm"]), { code: "conflicting-mode" });
});
