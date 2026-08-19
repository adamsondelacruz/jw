import fs from "node:fs/promises";
import { DATA_FILE } from "./01-config.mjs";

export class GuardrailError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "GuardrailError";
    this.code = code;
  }
}

export function normalizeUrl(raw) {
  let url;
  try { url = new URL(raw); } catch { throw new GuardrailError("invalid-url", `Invalid URL: ${raw}`); }
  if (url.protocol !== "https:") throw new GuardrailError("insecure-url", "Only HTTPS project pages are permitted.");
  url.hash = "";
  return url;
}

export async function loadOnlineManifest() {
  const project = JSON.parse(await fs.readFile(DATA_FILE, "utf8"));
  const online = project.online;
  if (!online || !Array.isArray(online.approved_pages) || !Array.isArray(online.approved_mutations)) {
    throw new GuardrailError("invalid-manifest", "Canonical project data has no valid online manifest.");
  }
  if (online.default_mode !== "dry-run") {
    throw new GuardrailError("unsafe-default", "Online manifest must default to dry-run.");
  }
  return online;
}

export function selectApprovedPage(manifest, key) {
  const matches = manifest.approved_pages.filter(item => item.id === key);
  if (matches.length !== 1) throw new GuardrailError("page-not-approved", `Expected one approved page named ${key}; found ${matches.length}.`);
  if (!matches[0].operations.includes("inspect")) {
    throw new GuardrailError("operation-not-approved", `Read-only inspection is not approved for ${key}.`);
  }
  return { ...matches[0], url: normalizeUrl(matches[0].url).href };
}

export function assertApprovedDestination(actualRaw, approvedRaw) {
  const actual = normalizeUrl(actualRaw);
  if (actual.hostname === "login.jw.org") {
    throw new GuardrailError("unauthenticated", "The shared session was redirected to login.jw.org; complete login and MFA manually.");
  }
  const approved = normalizeUrl(approvedRaw);
  if (actual.origin !== approved.origin || actual.pathname !== approved.pathname) {
    throw new GuardrailError("unexpected-destination", `Expected ${approved.origin}${approved.pathname}; got ${actual.origin}${actual.pathname}.`);
  }
  return true;
}

export function assertReadOnlyArguments(argv) {
  const prohibited = ["--confirm", "--submit", "--send", "--upload", "--assign", "--save"];
  const found = prohibited.find(value => argv.includes(value));
  if (found) throw new GuardrailError("mutation-prohibited", `${found} is prohibited: this project currently has no approved browser mutations.`);
  return "dry-run";
}

export function option(argv, name, fallback = null) {
  const index = argv.indexOf(name);
  if (index === -1) return fallback;
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new GuardrailError("missing-option", `Missing value for ${name}.`);
  return value;
}
