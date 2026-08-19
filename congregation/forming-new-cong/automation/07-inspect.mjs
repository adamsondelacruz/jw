import process from "node:process";
import { connectSharedBrowser } from "./03-browser.mjs";
import { assertApprovedDestination, assertReadOnlyArguments, loadOnlineManifest, option, selectApprovedPage } from "./02-guardrails.mjs";
import { capture, runId, writeAudit } from "./04-audit.mjs";

async function main() {
  const argv = process.argv.slice(2);
  assertReadOnlyArguments(argv);
  const key = option(argv, "--page");
  if (!key) throw new Error("Specify an approved project page with --page.");
  const approved = selectApprovedPage(await loadOnlineManifest(), key);
  const id = runId();
  let page;
  try {
    const { context } = await connectSharedBrowser();
    page = await context.newPage();
    await page.goto(approved.url, { waitUntil: "domcontentloaded", timeout: 60_000 });
    assertApprovedDestination(page.url(), approved.url);
    const summary = {
      title: await page.title(),
      url: page.url(),
      links: await page.locator("a[href]").count(),
      forms: await page.locator("form").count(),
      buttons: await page.getByRole("button").count(),
    };
    const artifact = await capture(page, id, key);
    const audit = await writeAudit({
      id, operation: "inspect", pageKey: key, expectedUrl: approved.url, finalUrl: summary.url, title: summary.title,
      checks: ["approved manifest key", "exact destination", "read-only metadata inventory", "private screenshot"],
      artifact, status: "verified",
    });
    console.log(JSON.stringify({ ...summary, mode: "dry-run", artifact, audit }, null, 2));
    await page.close();
  } catch (error) {
    await writeAudit({
      id, operation: "inspect", pageKey: key, expectedUrl: approved.url, finalUrl: page?.url() ?? null,
      title: page ? await page.title().catch(() => null) : null, checks: [], status: "failed", error,
    });
    throw error;
  }
}

main().then(() => process.exit(0)).catch(error => {
  console.error(`Inspection failed [${error.code ?? "unexpected"}]: ${error.message}`);
  process.exit(1);
});
