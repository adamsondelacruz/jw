import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const destination = path.resolve(here, "../templates");
const browser = await chromium.connectOverCDP("http://127.0.0.1:9225");

try {
  const pages = browser.contexts().flatMap((context) => context.pages());
  const page = pages.find((candidate) => candidate.url().startsWith("https://drive.jwpub.org/apps/files/"));
  if (!page) throw new Error("No live authenticated JW Drive Files page found.");

  await page.bringToFront();
  const selectAll = page.getByRole("checkbox", { name: "Toggle selection for all files and folders" });
  if (!(await selectAll.isChecked())) await selectAll.check();
  await page.waitForTimeout(500);
  const buttons = await page.getByRole("button").evaluateAll((elements) =>
    elements.map((element) => ({
      text: element.textContent?.trim() || "",
      label: element.getAttribute("aria-label") || "",
      title: element.getAttribute("title") || "",
      dataCy: element.getAttribute("data-cy") || "",
    }))
  );
  const checkboxes = await page.getByRole("checkbox").evaluateAll((elements) =>
    elements.map((element) => ({ label: element.getAttribute("aria-label") || "", checked: element.checked }))
  );
  console.log(JSON.stringify({ destination, buttons, checkboxes }, null, 2));
} finally {
  await browser.close();
}
