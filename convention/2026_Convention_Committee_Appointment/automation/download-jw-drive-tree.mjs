import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const output = path.resolve(here, "../templates-jw-drive.zip");
const browser = await chromium.connectOverCDP("http://127.0.0.1:9225");

try {
  const page = browser.contexts().flatMap((context) => context.pages())
    .find((candidate) => candidate.url().startsWith("https://drive.jwpub.org/apps/files/"));
  if (!page) throw new Error("No live JW Drive page found.");

  const selected = page.getByRole("checkbox", { name: "Toggle selection for all files and folders" });
  if (!(await selected.isChecked())) await selected.check({ timeout: 10_000, force: true });
  await page.waitForTimeout(500);

  const downloadButton = page.getByRole("button", { name: /download/i }).first();
  const downloadLink = page.getByRole("link", { name: /download/i }).first();
  const trigger = await downloadButton.count() ? downloadButton : downloadLink;
  if (!(await trigger.count())) {
    const labels = await page.locator("button, a").evaluateAll((elements) => elements.map((element) => ({
      text: element.textContent?.trim() || "",
      aria: element.getAttribute("aria-label") || "",
      title: element.getAttribute("title") || "",
    })).filter((item) => /download/i.test(`${item.text} ${item.aria} ${item.title}`)));
    throw new Error(`No download action found. Candidates: ${JSON.stringify(labels)}`);
  }

  const downloadPromise = page.waitForEvent("download", { timeout: 30_000 });
  await trigger.click();
  const download = await downloadPromise;
  await download.saveAs(output);
  console.log(JSON.stringify({ output, suggestedFilename: download.suggestedFilename() }, null, 2));
} finally {
  await browser.close();
}
