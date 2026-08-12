import { launchProfile, primaryPage } from "./lib/browser.mjs";
import { gotoResponsibilities } from "./lib/page-model.mjs";

let context;
let page;
try {
  context = await launchProfile({ headless: true });
  page = await primaryPage(context);
  await gotoResponsibilities(page);
  console.log(`Authenticated Responsibilities page accessible: ${page.url()}`);
} catch (error) {
  console.error(`Session check failed [${error.code ?? "unexpected"}]: ${error.message}`);
  if (page) {
    const diagnostic = String(await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ").trim().slice(0, 240);
    console.error(`Current URL: ${page.url()}`);
    console.error(`Page title: ${await page.title().catch(() => "(unavailable)")}`);
    console.error(`Page text: ${diagnostic || "(empty)"}`);
  }
  console.error("Run npm run login to establish or refresh the dedicated session.");
  process.exitCode = 1;
} finally {
  if (context) await context.close();
}
