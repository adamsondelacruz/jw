import { ALLOWED_HOSTS, CONVENTION_ID, EVENT_LABEL, INITIAL_ALLOWED_ROLES } from "./config.mjs";

export class GuardrailError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "GuardrailError";
    this.code = code;
  }
}

export function normalizeSpace(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function normalizeIdentity(value) {
  return normalizeSpace(value).toLocaleLowerCase("en-NZ").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function assertAllowedUrl(rawUrl, { allowLogin = false, requireResponsibilities = true } = {}) {
  let url;
  try { url = new URL(rawUrl); } catch { throw new GuardrailError("invalid-url", `Invalid page URL: ${rawUrl}`); }
  if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.hostname)) {
    throw new GuardrailError("disallowed-host", `Refusing page outside the JW Hub allowlist: ${url.origin}`);
  }
  if (url.hostname === "login.jw.org") {
    if (allowLogin) return { kind: "login", url };
    throw new GuardrailError("unauthenticated", "JW Hub session is not authenticated; run npm run login.");
  }
  if (!url.pathname.includes(`/conventions/${CONVENTION_ID}/`)) {
    throw new GuardrailError("wrong-convention", `Expected convention ${CONVENTION_ID}; got ${url.pathname}`);
  }
  if (requireResponsibilities && !/\/responsibilities(?:\/|$)/.test(url.pathname)) {
    throw new GuardrailError("wrong-section", `Expected the Responsibilities section; got ${url.pathname}`);
  }
  return { kind: "responsibilities", url };
}

export function assertEventText(text) {
  const actual = normalizeIdentity(text);
  const expected = normalizeIdentity(EVENT_LABEL);
  if (!actual.includes(expected)) {
    throw new GuardrailError("wrong-event-label", `Expected page to identify ${EVENT_LABEL}.`);
  }
}

export function assertAllowedRole(role) {
  const clean = normalizeSpace(role);
  if (!INITIAL_ALLOWED_ROLES.has(clean)) {
    throw new GuardrailError("role-not-allowed", `Role is not present in the reviewed chart-to-Hub allowlist: ${clean || "(empty)"}.`);
  }
  return clean;
}

export function assertIdentityMatch(expectedName, returnedText) {
  const expected = normalizeIdentity(expectedName);
  const returned = normalizeIdentity(returnedText);
  const expectedParts = expected.split(" ").filter(Boolean);
  if (!expected || !returned || !expectedParts.every(part => returned.includes(part))) {
    throw new GuardrailError("identity-mismatch", `Returned person does not match expected name “${normalizeSpace(expectedName)}”.`);
  }
  return true;
}

export function parseMode(argv) {
  const confirm = argv.includes("--confirm");
  const dryRun = argv.includes("--dry-run") || !confirm;
  if (confirm && argv.includes("--dry-run")) {
    throw new GuardrailError("conflicting-mode", "Choose either --dry-run or --confirm, not both.");
  }
  return confirm ? "confirm" : dryRun ? "dry-run" : "dry-run";
}
