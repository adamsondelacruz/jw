import path from "node:path";
import { capture, runId, writeAudit } from "./lib/audit.mjs";
import { launchProfile, primaryPage } from "./lib/browser.mjs";
import { assertIdentityMatch, normalizeSpace } from "./lib/guardrails.mjs";
import {
  confirmationSummary, findPerson, gotoResponsibilities, submitConfirmation,
} from "./lib/page-model.mjs";

const id = runId();
let context;
let page;
const checks = {};
const artifacts = [];

async function roleCard(role) {
  const card = page.locator("article.card", { has: page.getByRole("heading", { name: role, exact: true }) });
  const count = await card.count();
  if (count < 1) throw new Error(`Expected an assigned ${role} card; found none.`);
  const texts = [...new Set((await card.allInnerTexts()).map(normalizeSpace))];
  if (texts.length !== 1) throw new Error(`Expected one live ${role} identity; found ${texts.length}.`);
  return card.first();
}

async function assertLiveRole(role, expectedNames) {
  const text = normalizeSpace(await (await roleCard(role)).innerText());
  for (const name of expectedNames) assertIdentityMatch(name, text);
  return text;
}

async function assignmentHref(role) {
  const hrefs = await page.getByRole("link", { name: role, exact: true }).evaluateAll(links =>
    [...new Set(links.map(link => link.href).filter(href => /\/assign(?:\/|$)/.test(href)))],
  );
  if (hrefs.length !== 1) throw new Error(`Expected one unassigned ${role} link; found ${hrefs.length}.`);
  return hrefs[0];
}

async function assignAt(href, role, email, expectedName) {
  await page.goto(href, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForFunction(() => /find person/i.test(document.body?.innerText ?? ""), null, { timeout: 20_000 });
  const result = await findPerson(page, email);
  assertIdentityMatch(expectedName, result);
  const summary = await confirmationSummary(page);
  assertIdentityMatch(expectedName, summary);
  if (!summary.toLowerCase().includes(role.toLowerCase())) throw new Error(`Confirmation did not show ${role}.`);
  const submission = await submitConfirmation(page);
  if (submission.failures.length || submission.responses.some(response => response.status >= 400)) {
    throw new Error(`${role} assignment request failed.`);
  }
  checks[`assigned:${role}:${email}`] = submission.responses;
}

async function removeSingleRole(role, expectedName) {
  const card = await roleCard(role);
  const href = await card.getByRole("link", { name: "View More", exact: true }).first().getAttribute("href");
  if (!href) throw new Error(`${role} detail link was not found.`);
  await page.goto(new URL(href, page.url()).href, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3_000);
  const body = normalizeSpace(await page.locator("body").innerText());
  assertIdentityMatch(expectedName, body);
  const remove = page.getByRole("button", { name: "Remove Person", exact: true });
  if (await remove.count() !== 1) throw new Error(`Expected one removal control for ${role}.`);
  await remove.click();
  const dialog = page.locator('[role="dialog"]', { hasText: "Confirm Removal" });
  await dialog.waitFor({ state: "attached", timeout: 10_000 });
  assertIdentityMatch(expectedName, normalizeSpace(await dialog.innerText()));
  await dialog.getByRole("button", { name: "Remove", exact: true }).evaluate(button => button.click());
  await page.waitForTimeout(2_000);
  checks[`removed:${role}:${expectedName}`] = true;
}

async function removeAssistant(role, email, expectedName) {
  const card = await roleCard(role);
  const href = await card.getByRole("link", { name: "View More", exact: true }).first().getAttribute("href");
  if (!href) throw new Error(`${role} detail link was not found.`);
  await page.goto(new URL(href, page.url()).href, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3_000);
  const row = page.locator("li", { hasText: email });
  if (await row.count() !== 1) throw new Error(`Expected one ${role} row for ${email}.`);
  assertIdentityMatch(expectedName, normalizeSpace(await row.innerText()));
  await row.getByRole("button", { name: "Remove Person", exact: true }).click();
  const dialog = page.locator('[role="dialog"]', { hasText: "Confirm Removal" });
  await dialog.waitFor({ state: "attached", timeout: 10_000 });
  assertIdentityMatch(expectedName, normalizeSpace(await dialog.innerText()));
  await dialog.getByRole("button", { name: "Remove", exact: true }).evaluate(button => button.click());
  await page.waitForTimeout(2_000);
  checks[`removed:${role}:${email}`] = true;
}

try {
  context = await launchProfile({ headless: true });
  page = await primaryPage(context);
  await gotoResponsibilities(page);

  await assertLiveRole("Audio/Video Overseer", ["Kent Morata"]);
  await assertLiveRole("Audio/Video Overseer Assistant(s)", ["Joel Dela Cruz", "Fernando Martinez"]);
  const programAlreadyAssigned = await page.getByRole("heading", { name: "Program Overseer Assistant", exact: true }).count() > 0;
  const programHref = programAlreadyAssigned ? null : await assignmentHref("Program Overseer Assistant");
  checks.initialStateVerified = true;
  artifacts.push(await capture(page, id, "before-program-av-reorganisation"));

  if (programHref) {
    await assignAt(programHref, "Program Overseer Assistant", "MorataKent13@jwpub.org", "Kent Morata");
    await gotoResponsibilities(page);
  }
  await assertLiveRole("Program Overseer Assistant", ["Kent Morata"]);

  await removeSingleRole("Audio/Video Overseer", "Kent Morata");
  await gotoResponsibilities(page);
  const avOverseerHref = await assignmentHref("Audio/Video Overseer");

  await removeAssistant("Audio/Video Overseer Assistant(s)", "23FernandoM@jwpub.org", "Fernando Martinez");
  await gotoResponsibilities(page);
  await assertLiveRole("Audio/Video Overseer Assistant(s)", ["Joel Dela Cruz"]);

  await assignAt(avOverseerHref, "Audio/Video Overseer", "23FernandoM@jwpub.org", "Fernando Martinez");
  await gotoResponsibilities(page);
  const avAssistantCard = await roleCard("Audio/Video Overseer Assistant(s)");
  const assistantDetailHref = await avAssistantCard.getByRole("link", { name: "View More", exact: true }).first().getAttribute("href");
  await page.goto(new URL(assistantDetailHref, page.url()).href, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2_000);
  const addAssistantHref = await page.getByRole("link", { name: "Select Person", exact: true }).getAttribute("href");
  if (!addAssistantHref) throw new Error("AV assistant Select Person link was not found.");
  await assignAt(new URL(addAssistantHref, page.url()).href, "Audio/Video Overseer Assistant(s)", "GEORGEINTIC4@jwpub.org", "George Intic");

  await gotoResponsibilities(page);
  await assertLiveRole("Program Overseer Assistant", ["Kent Morata"]);
  await assertLiveRole("Audio/Video Overseer", ["Fernando Martinez"]);
  await assertLiveRole("Audio/Video Overseer Assistant(s)", ["Joel Dela Cruz", "George Intic"]);
  checks.finalStateVerified = true;
  artifacts.push(await capture(page, id, "after-program-av-reorganisation"));

  const audit = await writeAudit({
    id, mode: "confirmed-reorganisation", role: "Program and Audio/Video",
    expectedName: "Kent Morata; Fernando Martinez; George Intic",
    status: "verified-success", checks, artifacts,
  });
  console.log("REORGANISED AND VERIFIED: Kent is Program Overseer Assistant; Fernando is AV Overseer; Joel and George are AV assistants.");
  console.log(`Audit: ${path.basename(audit)}`);
} catch (error) {
  console.error(`Program/AV reorganisation stopped: ${error.message}`);
  await writeAudit({ id, mode: "confirmed-reorganisation", role: "Program and Audio/Video", status: "stopped", checks, artifacts, error }).catch(() => {});
  process.exitCode = 1;
} finally {
  if (context) await context.close();
}
