import path from "node:path";
import { capture, runId, writeAudit } from "./lib/audit.mjs";
import { launchProfile, primaryPage } from "./lib/browser.mjs";
import { assertIdentityMatch } from "./lib/guardrails.mjs";
import { assignedResponsibility, gotoResponsibilities, snapshotResponsibilities } from "./lib/page-model.mjs";

const id = runId();
const role = "Accounts Overseer";
const expectedName = "Jerus Joaquin";
let context;
const checks = {};

try {
  context = await launchProfile({ headless: true });
  const page = await primaryPage(context);
  await gotoResponsibilities(page);
  checks.exactConvention = true;
  checks.responsibilitiesPage = true;

  const unassigned = await snapshotResponsibilities(page);
  if (unassigned.some(item => item.actionText === role)) {
    throw Object.assign(new Error(`${role} is still present among unassigned controls.`), { code: "role-still-unassigned" });
  }
  checks.accountsUnassignedControlAbsent = true;
  if (unassigned.length !== 33) {
    throw Object.assign(new Error(`Expected 33 remaining unassigned controls; found ${unassigned.length}.`), { code: "unexpected-unassigned-count" });
  }
  checks.remainingUnassignedCount = 33;

  const assigned = await assignedResponsibility(page, role);
  if (!assigned) throw Object.assign(new Error(`Assigned ${role} card was not found.`), { code: "assigned-card-missing" });
  assertIdentityMatch(expectedName, assigned.text);
  checks.assignedIdentityMatches = true;

  const assignedSectionCards = await page.evaluate(() => {
    const heading = [...document.querySelectorAll("h2")].find(node => node.textContent.trim() === "Assigned");
    if (!heading) return [];
    return [...document.querySelectorAll("article.card")]
      .filter(card => Boolean(heading.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING))
      .map(card => card.innerText.replace(/\s+/g, " ").trim());
  });
  if (assignedSectionCards.length !== 1 || !assignedSectionCards[0].includes("Accounts Overseer")) {
    throw Object.assign(new Error(`Expected exactly one explicitly assigned responsibility card; found ${assignedSectionCards.length}.`), { code: "unexpected-assigned-cards" });
  }
  checks.noOtherAssignedResponsibility = true;

  const screenshot = await capture(page, id, "verified-final-state");
  const audit = await writeAudit({
    id, mode: "verify", role, expectedName, status: "verified-success", checks, artifacts: [screenshot],
  });
  console.log(`VERIFIED: ${role} is assigned to ${expectedName}; 33 other responsibilities remain unassigned.`);
  console.log(`Audit: ${path.basename(audit)}`);
} catch (error) {
  console.error(`Verification failed [${error.code ?? "unexpected"}]: ${error.message}`);
  await writeAudit({ id, mode: "verify", role, expectedName, status: "stopped", checks, error }).catch(() => {});
  process.exitCode = 1;
} finally {
  if (context) await context.close();
}
