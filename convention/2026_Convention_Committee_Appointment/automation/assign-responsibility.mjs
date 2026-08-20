import path from "node:path";
import { assignmentFromArgs } from "./lib/cli.mjs";
import { capture, runId, writeAudit } from "./lib/audit.mjs";
import { launchProfile, primaryPage } from "./lib/browser.mjs";
import { assertIdentityMatch } from "./lib/guardrails.mjs";
import {
  assignedResponsibility, confirmationSummary, diffSnapshots, findPerson, findUniqueResponsibility, gotoResponsibilities,
  openAssignment, snapshotResponsibilities, submitConfirmation,
} from "./lib/page-model.mjs";

const id = runId();
let assignment;
let context;
let page;
const checks = {};
const artifacts = [];

try {
  assignment = await assignmentFromArgs();
  context = await launchProfile({ headless: true });
  page = await primaryPage(context);

  await gotoResponsibilities(page);
  checks.exactConvention = true;
  checks.responsibilitiesPage = true;
  const before = await snapshotResponsibilities(page);
  const target = findUniqueResponsibility(before, assignment.role, assignment.section);
  checks.uniqueRole = true;
  checks.roleUnassigned = target.unassigned;
  if (!target.unassigned) throw Object.assign(new Error(`${assignment.role} is already assigned; replacement is prohibited.`), { code: "already-assigned" });
  artifacts.push(await capture(page, id, "before"));

  await openAssignment(page, target, assignment.role);
  checks.correctAssignmentPage = true;
  const resultText = await findPerson(page, assignment.email);
  checks.personSearchCompleted = true;
  assertIdentityMatch(assignment.expectedName, resultText);
  checks.identityMatches = true;
  const confirmText = await confirmationSummary(page);
  assertIdentityMatch(assignment.expectedName, confirmText);
  if (!confirmText.toLowerCase().includes(assignment.role.toLowerCase())) {
    throw Object.assign(new Error("Confirmation page does not show the expected responsibility."), { code: "confirmation-role-mismatch" });
  }
  checks.confirmationMatches = true;
  artifacts.push(await capture(page, id, "person-found"));

  if (assignment.mode === "dry-run") {
    const audit = await writeAudit({ id, mode: "dry-run", role: assignment.role, expectedName: assignment.expectedName, status: "ready-for-confirmation", checks, artifacts });
    console.log(`DRY RUN PASSED: ${assignment.role} matched ${assignment.expectedName}. No assignment was submitted.`);
    console.log(`Audit: ${path.basename(audit)}`);
    process.exitCode = 0;
  } else {
    checks.explicitConfirmMode = true;
    const submission = await submitConfirmation(page);
    checks.submittedOnce = true;
    checks.submissionResponses = submission.responses;
    checks.submissionFailures = submission.failures;
    artifacts.push(await capture(page, id, "submitted-response"));
    if (submission.failures.length || submission.responses.some(response => response.status >= 400)) {
      throw Object.assign(new Error("JW Hub submission request failed; see audit response metadata."), { code: "submission-request-failed" });
    }
    await gotoResponsibilities(page);
    const after = await snapshotResponsibilities(page);
    const assigned = await assignedResponsibility(page, assignment.role, assignment.section);
    if (!assigned) {
      throw Object.assign(new Error("Fresh Responsibilities page did not show the expected assigned person."), { code: "post-state-mismatch" });
    }
    assertIdentityMatch(assignment.expectedName, assigned.text);
    checks.persistedAfterReload = true;
    const changes = diffSnapshots(before, after);
    if (changes.removed.length !== 1 || changes.added.length !== 0 || changes.removed[0].actionText !== assignment.role) {
      throw Object.assign(new Error(`Expected only the ${assignment.role} unassigned control to disappear; observed ${changes.removed.length} removed and ${changes.added.length} added controls.`), { code: "unexpected-scope-change" });
    }
    checks.exactlyOneResponsibilityChanged = true;
    artifacts.push(await capture(page, id, "after"));
    const audit = await writeAudit({ id, mode: "confirm", role: assignment.role, expectedName: assignment.expectedName, status: "verified-success", checks, artifacts });
    console.log(`CONFIRMED AND VERIFIED: ${assignment.role} is assigned to ${assignment.expectedName}.`);
    console.log(`Audit: ${path.basename(audit)}`);
  }
} catch (error) {
  console.error(`Assignment stopped [${error.code ?? "unexpected"}]: ${error.message}`);
  if (page) {
    const failureText = String(await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ").trim().slice(0, 500);
    console.error(`Failure page: ${page.url()}`);
    console.error(`Failure summary: ${failureText || "(empty)"}`);
    artifacts.push(await capture(page, id, "stopped").catch(() => null));
  }
  const retainedArtifacts = artifacts.filter(Boolean);
  await writeAudit({
    id, mode: assignment?.mode ?? "argument-validation", role: assignment?.role ?? "Accounts Overseer",
    expectedName: assignment?.expectedName ?? "Jerus Joaquin", status: "stopped", checks, artifacts: retainedArtifacts, error,
  }).catch(auditError => console.error(`Could not write audit: ${auditError.message}`));
  process.exitCode = 1;
} finally {
  if (context) await context.close();
}
