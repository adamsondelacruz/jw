import fs from "node:fs/promises";
import path from "node:path";
import { runId, writeBatchAudit } from "./lib/audit.mjs";
import { launchProfile, primaryPage } from "./lib/browser.mjs";
import { ASSIGNMENTS_FILE, CONVENTION_ID } from "./lib/config.mjs";
import { assertAllowedRole, assertIdentityMatch, parseMode } from "./lib/guardrails.mjs";
import {
  assignedResponsibility, confirmationSummary, findPerson, findUniqueResponsibility,
  gotoResponsibilities, openAssignment, snapshotResponsibilities, submitConfirmation,
} from "./lib/page-model.mjs";

const id = runId();
const mode = parseMode(process.argv.slice(2));
const manifest = JSON.parse(await fs.readFile(ASSIGNMENTS_FILE, "utf8"));
if (manifest.schemaVersion !== 2 || manifest.conventionId !== CONVENTION_ID) throw new Error("Reviewed sync manifest is invalid.");
const results = [];
let context;
const MULTI_PERSON_ROLES = new Set([
  "Attendant Overseer Assistant(s)",
  "First Aid Overseer Assistant(s)",
  "Parking Overseer Assistant(s)",
  "Audio/Video Overseer Assistant(s)",
  "Cleaning Overseer Assistant(s)",
]);

function numericOption(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  const value = Number.parseInt(process.argv[index + 1], 10);
  if (!Number.isInteger(value) || value < 0) throw new Error(`${name} requires a non-negative integer.`);
  return value;
}

const from = numericOption("--from", 0);
const limit = numericOption("--limit", manifest.assignments.length);
const selected = manifest.assignments.slice(from, from + limit);

function publicRecord(item, status, detail = undefined) {
  return { role: item.role, chartName: item.chartName, expectedName: item.expectedName, status, ...(detail ? { detail } : {}) };
}

try {
  context = await launchProfile({ headless: true });
  const page = await primaryPage(context);

  for (const [offset, item] of selected.entries()) {
    assertAllowedRole(item.role);
    process.stdout.write(`${mode === "confirm" ? "Sync" : "Dry run"} ${from + offset + 1}/${manifest.assignments.length}: ${item.role} → ${item.chartName}… `);
    await gotoResponsibilities(page);

    const assigned = await assignedResponsibility(page, item.role, item.section);
    if (assigned) {
      try {
        assertIdentityMatch(item.expectedName, assigned.text);
        results.push(publicRecord(item, "already-synced"));
        console.log("already synced");
        continue;
      } catch {
        if (MULTI_PERSON_ROLES.has(item.role)) {
          // The role already contains another approved assistant; continue to its add-person control.
        } else {
        results.push(publicRecord(item, "occupied-by-other", assigned.text));
        console.log("STOP: occupied by another person");
        throw Object.assign(new Error(`${item.role} is already occupied by a different person.`), { code: "occupied-by-other" });
        }
      }
    }

    const snapshot = await snapshotResponsibilities(page);
    const responsibility = findUniqueResponsibility(snapshot, item.role, item.section);
    await openAssignment(page, responsibility, item.role);
    const resultText = await findPerson(page, item.email);
    assertIdentityMatch(item.expectedName, resultText);
    const summary = await confirmationSummary(page);
    assertIdentityMatch(item.expectedName, summary);
    if (!summary.toLowerCase().includes(item.role.toLowerCase())) {
      throw Object.assign(new Error(`Confirmation does not show ${item.role}.`), { code: "confirmation-role-mismatch" });
    }
    results.push(publicRecord(item, "dry-run-passed"));
    if (mode === "dry-run") {
      console.log("passed");
      continue;
    }

    const submission = await submitConfirmation(page);
    if (submission.failures.length || submission.responses.some(response => response.status >= 400)) {
      throw Object.assign(new Error("JW Hub Save request failed."), { code: "submission-request-failed" });
    }
    let verified = false;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await gotoResponsibilities(page);
      const assignedAfter = await assignedResponsibility(page, item.role, item.section);
      if (assignedAfter) {
        try { assertIdentityMatch(item.expectedName, assignedAfter.text); verified = true; break; } catch {}
      }
      await page.waitForTimeout(2_000);
    }
    if (!verified) throw Object.assign(new Error(`Saved ${item.role}, but ${item.expectedName} did not appear after repeated fresh loads.`), { code: "post-state-mismatch" });
    results[results.length - 1] = publicRecord(item, "synced-and-verified");
    console.log("synced and verified");
  }

  const status = mode === "dry-run" ? "dry-run-passed" : "sync-verified";
  const audit = await writeBatchAudit({ id, mode, status, results, exclusions: manifest.exclusions });
  console.log(mode === "dry-run"
    ? `All ${results.length} selected mappings passed or were already synced. No Save button was pressed.`
    : `All ${results.length} selected mappings are synced and verified.`);
  console.log(`Audit: ${path.basename(audit)}`);
} catch (error) {
  console.error(`\nSync stopped [${error.code ?? "unexpected"}]: ${error.message}`);
  if (context) {
    const page = context.pages()[0];
    if (page) {
      const summary = String(await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ").trim().slice(0, 700);
      console.error(`Failure page: ${page.url()}`);
      console.error(`Failure summary: ${summary || "(empty)"}`);
    }
  }
  const audit = await writeBatchAudit({ id, mode, status: "stopped", results, exclusions: manifest.exclusions, error }).catch(() => null);
  if (audit) console.error(`Audit: ${path.basename(audit)}`);
  process.exitCode = 1;
} finally {
  if (context) await context.close();
}
