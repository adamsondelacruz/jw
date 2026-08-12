import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { launchProfile, primaryPage } from "./lib/browser.mjs";
import { RESPONSIBILITIES_URL } from "./lib/config.mjs";
import { assertAllowedUrl, assertEventText, normalizeSpace } from "./lib/guardrails.mjs";

const context = await launchProfile({ headless: false });
try {
  const page = await primaryPage(context);
  await page.goto(RESPONSIBILITIES_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
  console.log("A dedicated Chrome profile is open. Sign in manually and complete MFA if requested.");
  console.log("When the Auckland NS (TG) Responsibilities page is visible, return here.");
  const rl = readline.createInterface({ input: stdin, output: stdout });
  await rl.question("Press Enter to validate and save the session: ");
  rl.close();
  assertAllowedUrl(page.url());
  const body = normalizeSpace(await page.locator("body").innerText());
  assertEventText(body);
  if (!/responsibilities/i.test(body)) throw new Error("Responsibilities page heading was not found.");
  console.log("Authenticated dedicated profile validated successfully.");
} catch (error) {
  console.error(`Login validation failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await context.close();
}

