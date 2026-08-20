import path from "node:path";
import { capture, runId, writeAudit } from "./lib/audit.mjs";
import { launchProfile, primaryPage } from "./lib/browser.mjs";
import { assertIdentityMatch, normalizeSpace } from "./lib/guardrails.mjs";
import {
  confirmationSummary, findPerson, findUniqueResponsibility, gotoResponsibilities,
  openAssignment, snapshotResponsibilities, submitConfirmation,
} from "./lib/page-model.mjs";

const id = runId();
const role = "Attendant Overseer";
const formerName = "Ron Mariano";
const replacementName = "Louie Joy Vea";
const replacementEmail = "LVea12@jwpub.org";
let context;
let page;
const checks = {};
const artifacts = [];

async function roleTexts(roleName) {
  return page.evaluate((wanted) => {
    const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
    return [...document.querySelectorAll("article.card")]
      .filter((card) => clean(card.querySelector("h3")?.innerText) === wanted)
      .map((card) => clean(card.innerText));
  }, roleName);
}

async function assertLiveRole(roleName, expectedName) {
  const texts = [...new Set(await roleTexts(roleName))];
  if (texts.length !== 1) throw new Error(`Expected one live ${roleName} identity; found ${texts.length}.`);
  assertIdentityMatch(expectedName, texts[0]);
  return texts[0];
}

try {
  context = await launchProfile({ headless: true });
  page = await primaryPage(context);
  await gotoResponsibilities(page);

  await assertLiveRole(role, formerName);
  checks.formerAttendantMatches = true;
  await assertLiveRole("Convention Committee Coordinator Assistant", formerName);
  checks.ronCoordinatorAssistantPersisted = true;
  await assertLiveRole("Baptism Overseer Assistant(s)", replacementName);
  checks.louieBaptismAssistantPersistedBefore = true;
  await assertLiveRole("First Aid Overseer", "Xavier Serio");
  checks.xavierSpellingVerified = true;
  artifacts.push(await capture(page, id, "before-attendant-replacement"));

  const attendantCard = page.locator("article.card", { has: page.getByRole("heading", { name: role, exact: true }) });
  const detailHref = await attendantCard.getByRole("link", { name: "View More", exact: true }).first().getAttribute("href");
  if (!detailHref) throw new Error("Attendant Overseer detail link was not found.");
  await page.goto(new URL(detailHref, page.url()).href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => /Remove Person/i.test(document.body?.innerText ?? ""), null, { timeout: 20_000 });
  // The detail view is client-rendered; allow its modal event binding to finish.
  await page.waitForTimeout(4_000);
  const detailText = normalizeSpace(await page.locator("body").innerText());
  assertIdentityMatch(formerName, detailText);
  if (!detailText.includes(role)) throw new Error("Attendant detail page did not show the expected role.");
  checks.removalTargetMatches = true;

  await page.getByRole("button", { name: "Remove Person", exact: true }).click();
  const dialog = page.locator('[role="dialog"]', { hasText: "Confirm Removal" });
  await dialog.waitFor({ state: "attached", timeout: 10_000 });
  const dialogText = normalizeSpace(await dialog.innerText());
  assertIdentityMatch(formerName, dialogText);
  if (!dialogText.includes(role)) throw new Error("Removal confirmation did not show Attendant Overseer.");
  checks.removalConfirmationMatches = true;
  const confirmRemove = dialog.getByRole("button", { name: "Remove", exact: true });
  if (await confirmRemove.count() !== 1) throw new Error("Expected one Remove confirmation control.");
  // JW Hub gives the headless modal a zero-height container even though it is
  // active and accessible. Invoke the already-verified control's native click.
  await confirmRemove.evaluate((button) => button.click());
  await page.waitForTimeout(2_000);

  await gotoResponsibilities(page);
  const afterRemoval = await snapshotResponsibilities(page);
  const unassigned = findUniqueResponsibility(afterRemoval, role, "Not Assigned");
  if (!unassigned.unassigned) throw new Error("Attendant Overseer was not unassigned after removal.");
  checks.ronRemovedFromAttendant = true;

  await openAssignment(page, unassigned, role);
  const resultText = await findPerson(page, replacementEmail);
  assertIdentityMatch(replacementName, resultText);
  checks.louieSearchMatches = true;
  const summary = await confirmationSummary(page);
  assertIdentityMatch(replacementName, summary);
  if (!summary.toLowerCase().includes(role.toLowerCase())) throw new Error("Assignment confirmation did not show Attendant Overseer.");
  checks.assignmentConfirmationMatches = true;
  artifacts.push(await capture(page, id, "louie-confirmation"));

  const submission = await submitConfirmation(page);
  checks.assignmentSubmissionResponses = submission.responses;
  checks.assignmentSubmissionFailures = submission.failures;
  if (submission.failures.length || submission.responses.some((response) => response.status >= 400)) {
    throw new Error("Louie assignment request failed.");
  }

  await gotoResponsibilities(page);
  await assertLiveRole(role, replacementName);
  checks.louieAttendantPersisted = true;
  await assertLiveRole("Convention Committee Coordinator Assistant", formerName);
  checks.ronCoordinatorAssistantPersistedAfter = true;
  await assertLiveRole("Baptism Overseer Assistant(s)", replacementName);
  checks.louieBaptismAssistantPersistedAfter = true;
  await assertLiveRole("First Aid Overseer", "Xavier Serio");
  checks.xavierSpellingStillVerified = true;
  artifacts.push(await capture(page, id, "after-attendant-replacement"));

  const audit = await writeAudit({
    id, mode: "confirmed-replacement", role, expectedName: replacementName,
    status: "verified-success", checks, artifacts,
  });
  console.log(`REPLACED AND VERIFIED: ${role} is assigned to ${replacementName}; Ron Mariano remains Coordinator Assistant; Louie remains Baptism Overseer Assistant.`);
  console.log(`Audit: ${path.basename(audit)}`);
} catch (error) {
  console.error(`Attendant replacement stopped: ${error.message}`);
  await writeAudit({
    id, mode: "confirmed-replacement", role, expectedName: replacementName,
    status: "stopped", checks, artifacts, error,
  }).catch(() => {});
  process.exitCode = 1;
} finally {
  if (context) await context.close();
}
