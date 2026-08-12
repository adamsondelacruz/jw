import fs from "node:fs/promises";
import { ASSIGNMENTS_FILE } from "./config.mjs";
import { GuardrailError, assertAllowedRole, normalizeSpace, parseMode } from "./guardrails.mjs";

function option(argv, name) {
  const index = argv.indexOf(name);
  if (index < 0) return undefined;
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new GuardrailError("missing-option-value", `${name} requires a value.`);
  return value;
}

export async function loadApprovedAssignments() {
  const parsed = JSON.parse(await fs.readFile(ASSIGNMENTS_FILE, "utf8"));
  if (![1, 2].includes(parsed.schemaVersion) || !Array.isArray(parsed.assignments)) {
    throw new GuardrailError("invalid-manifest", "Approved assignment manifest has an unsupported format.");
  }
  return parsed;
}

export async function assignmentFromArgs(argv = process.argv.slice(2)) {
  const manifest = await loadApprovedAssignments();
  const requestedRole = assertAllowedRole(option(argv, "--role") ?? "Accounts Overseer");
  const approved = manifest.assignments.filter(item => normalizeSpace(item.role) === requestedRole);
  if (approved.length !== 1) throw new GuardrailError("manifest-ambiguity", `Single-assignment CLI requires exactly one approved mapping for ${requestedRole}; found ${approved.length}.`);
  const record = approved[0];
  const suppliedEmail = option(argv, "--email");
  const suppliedName = option(argv, "--expected-name");
  if (suppliedEmail && suppliedEmail.toLowerCase() !== String(record.email).toLowerCase()) {
    throw new GuardrailError("email-not-approved", "Supplied jwpub email differs from the approved manifest.");
  }
  if (suppliedName && normalizeSpace(suppliedName).toLowerCase() !== normalizeSpace(record.expectedName).toLowerCase()) {
    throw new GuardrailError("name-not-approved", "Supplied expected name differs from the approved manifest.");
  }
  if (!/@jwpub\.org$/i.test(record.email)) throw new GuardrailError("invalid-email", "Approved account is not a jwpub.org address.");
  return { ...record, role: requestedRole, mode: parseMode(argv) };
}
