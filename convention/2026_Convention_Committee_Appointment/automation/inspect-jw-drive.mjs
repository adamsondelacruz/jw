import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const profile = path.join(here, ".jw-drive-profile");
const folderUrl = process.argv[2];

if (!folderUrl?.startsWith("https://drive.jwpub.org/")) {
  throw new Error("Supply a https://drive.jwpub.org/ folder URL.");
}

const context = await chromium.launchPersistentContext(profile, {
  executablePath: "/usr/bin/google-chrome",
  headless: true,
  viewport: { width: 1440, height: 1000 },
});

try {
  const page = context.pages()[0] || await context.newPage();
  await page.goto(folderUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(4_000);

  const state = await page.evaluate(() => {
    const body = document.body?.innerText || "";
    const candidates = [
      ...document.querySelectorAll(
        'tr[data-id] [data-file], tr[data-id] .nametext, [data-cy-files-list-row-name], .files-list__row-name'
      ),
    ]
      .map((element) => element.getAttribute("data-file") || element.textContent?.trim())
      .filter(Boolean);
    return {
      title: document.title,
      url: location.href,
      appearsLoggedOut: /current user is not logged in|log in|sign in/i.test(body.slice(0, 2000)),
      items: [...new Set(candidates)],
      bodyPreview: body.slice(0, 3000),
    };
  });

  console.log(JSON.stringify(state, null, 2));
} finally {
  await context.close();
}
