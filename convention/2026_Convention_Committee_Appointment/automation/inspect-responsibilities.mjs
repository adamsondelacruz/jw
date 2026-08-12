import path from "node:path";
import { capture, runId, writeAudit } from "./lib/audit.mjs";
import { launchProfile, primaryPage } from "./lib/browser.mjs";
import { findUniqueResponsibility, gotoResponsibilities, snapshotResponsibilities } from "./lib/page-model.mjs";

const id = runId();
let context;
let page;
let snapshot = [];
try {
  context = await launchProfile({ headless: true });
  page = await primaryPage(context);
  await gotoResponsibilities(page);
  snapshot = await snapshotResponsibilities(page);
  const accounts = findUniqueResponsibility(snapshot, "Accounts Overseer");
  const screenshot = await capture(page, id, "responsibilities-read-only");
  const inventory = snapshot.map(item => ({
    responsibility: item.text,
    state: /\/unassign(?:\/|$)/.test(new URL(item.href).pathname) ? "assigned" : "unassigned",
  }));
  console.log(JSON.stringify({ count: inventory.length, accountsOverseer: { state: accounts.unassigned ? "unassigned" : "assigned" }, inventory }, null, 2));
  const audit = await writeAudit({
    id, mode: "inspect", role: "Accounts Overseer", expectedName: "Jerus Joaquin", status: "read-only-success",
    checks: { exactConvention: true, responsibilitiesPage: true, uniqueAccountsOverseer: true, accountsOverseerUnassigned: accounts.unassigned },
    artifacts: [screenshot],
  });
  console.log(`Audit: ${path.basename(audit)}`);
} catch (error) {
  console.error(`Inspection stopped [${error.code ?? "unexpected"}]: ${error.message}`);
  if (snapshot.length) {
    console.error("Matching controls:");
    for (const item of snapshot.filter(item => /accounts overseer/i.test(item.text))) {
      console.error(JSON.stringify({ text: item.text, actionText: item.actionText, path: new URL(item.href).pathname }));
    }
  }
  await writeAudit({ id, mode: "inspect", role: "Accounts Overseer", expectedName: "Jerus Joaquin", status: "stopped", checks: {}, error }).catch(() => {});
  process.exitCode = 1;
} finally {
  if (context) await context.close();
}
