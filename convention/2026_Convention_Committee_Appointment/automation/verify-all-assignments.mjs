import fs from "node:fs/promises";
import path from "node:path";
import { capture, runId, writeBatchAudit } from "./lib/audit.mjs";
import { launchProfile, primaryPage } from "./lib/browser.mjs";
import { ASSIGNMENTS_FILE, CONVENTION_ID } from "./lib/config.mjs";
import { assertIdentityMatch, normalizeSpace } from "./lib/guardrails.mjs";
import { assignedResponsibility, gotoResponsibilities } from "./lib/page-model.mjs";

const id = runId();
const manifest = JSON.parse(await fs.readFile(ASSIGNMENTS_FILE, "utf8"));
if (manifest.schemaVersion !== 2 || manifest.conventionId !== CONVENTION_ID) throw new Error("Reviewed manifest is invalid.");
const results = [];
let context;

try {
  context = await launchProfile({ headless: true });
  const page = await primaryPage(context);
  await gotoResponsibilities(page);

  for (const item of manifest.assignments) {
    const card = await assignedResponsibility(page, item.role, item.section);
    if (!card) throw Object.assign(new Error(`Assigned card missing for ${item.role}.`), { code: "assigned-card-missing" });
    assertIdentityMatch(item.expectedName, card.text);
    results.push({ role: item.role, chartName: item.chartName, expectedName: item.expectedName, status: "live-verified" });
  }

  const ordinaryAssigned = await page.evaluate(() => {
    const clean = value => String(value ?? "").replace(/\s+/g, " ").trim();
    const assignedHeading = [...document.querySelectorAll("h2")].find(node => clean(node.innerText) === "Assigned");
    if (!assignedHeading) return [];
    return [...document.querySelectorAll("article.card")]
      .filter(card => Boolean(assignedHeading.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING))
      .map(card => ({ role: clean(card.querySelector("h3")?.innerText), text: clean(card.innerText) }));
  });
  const expectedOrdinaryRoles = new Set(manifest.assignments.map(item => item.role));
  const actualRoles = new Set(ordinaryAssigned.map(item => item.role));
  const unexpected = [...actualRoles].filter(role => !expectedOrdinaryRoles.has(role));
  const missing = [...expectedOrdinaryRoles].filter(role => !actualRoles.has(role));
  if (unexpected.length || missing.length) {
    throw Object.assign(new Error(`Assigned-role reconciliation failed; unexpected=${unexpected.join(",") || "none"}; missing=${missing.join(",") || "none"}.`), { code: "assigned-role-set-mismatch" });
  }

  const screenshot = await capture(page, id, "all-assignments-verified");
  const audit = await writeBatchAudit({
    id, mode: "verify-all", status: "live-verified", results,
    exclusions: manifest.exclusions,
  });
  console.log(`VERIFIED ALL: ${results.length} chart mappings match live JW Hub; no unexpected ordinary assigned role exists.`);
  console.log(`Evidence: ${path.basename(screenshot)}`);
  console.log(`Audit: ${path.basename(audit)}`);
} catch (error) {
  console.error(`Full verification stopped [${error.code ?? "unexpected"}]: ${error.message}`);
  await writeBatchAudit({ id, mode: "verify-all", status: "stopped", results, exclusions: manifest.exclusions, error }).catch(() => {});
  process.exitCode = 1;
} finally {
  if (context) await context.close();
}
