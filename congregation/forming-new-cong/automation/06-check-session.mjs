import process from "node:process";
import { connectSharedBrowser } from "./03-browser.mjs";
import { assertApprovedDestination, assertReadOnlyArguments, loadOnlineManifest, option, selectApprovedPage } from "./02-guardrails.mjs";
import { runId, writeAudit } from "./04-audit.mjs";

async function main() {
  const argv = process.argv.slice(2);
  assertReadOnlyArguments(argv);
  const key = option(argv, "--page", "jw-docs-shared");
  const approved = selectApprovedPage(await loadOnlineManifest(), key);
  const id = runId();
  let page;
  try {
    const { context } = await connectSharedBrowser();
    page = await context.newPage();
    await page.goto(approved.url, { waitUntil: "domcontentloaded", timeout: 60_000 });
    assertApprovedDestination(page.url(), approved.url);
    const title = await page.title();
    const audit = await writeAudit({
      id, operation: "check-session", pageKey: key, expectedUrl: approved.url, finalUrl: page.url(), title,
      checks: ["shared CDP connection", "approved manifest key", "HTTPS host and exact path", "no login redirect"], status: "verified",
    });
    console.log(`Authenticated approved page accessible: ${page.url()}`);
    console.log(`Private audit: ${audit}`);
    await page.close();
  } catch (error) {
    await writeAudit({
      id, operation: "check-session", pageKey: key, expectedUrl: approved.url, finalUrl: page?.url() ?? null,
      title: page ? await page.title().catch(() => null) : null, checks: [], status: "failed", error,
    });
    throw error;
  }
}

main().then(() => process.exit(0)).catch(error => {
  console.error(`Session check failed [${error.code ?? "unexpected"}]: ${error.message}`);
  process.exit(1);
});
