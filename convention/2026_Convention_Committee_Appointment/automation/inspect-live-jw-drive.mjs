import { chromium } from "playwright";

const browser = await chromium.connectOverCDP("http://127.0.0.1:9225");

try {
  const pages = browser.contexts().flatMap((context) => context.pages());
  const page = pages.find((candidate) => candidate.url().startsWith("https://drive.jwpub.org/apps/files/"));
  if (!page) throw new Error("No live JW Drive Files page found.");

  const result = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('tr[data-id], [data-cy-files-list-row], .files-list__row')];
    const items = rows.map((row) => {
      const nameElement = row.querySelector('[data-file], .nametext, [data-cy-files-list-row-name], .files-list__row-name');
      const name = nameElement?.getAttribute("data-file") || nameElement?.textContent?.trim() || "";
      const size = row.querySelector('.filesize, [data-cy-files-list-row-size], .files-list__row-size')?.textContent?.trim() || "";
      const modified = row.querySelector('.date, [data-cy-files-list-row-mtime], .files-list__row-mtime')?.textContent?.trim() || "";
      return { name, size, modified, id: row.getAttribute("data-id") || "" };
    }).filter((item) => item.name);

    return {
      title: document.title,
      url: location.href,
      itemCount: items.length,
      items,
      visibleText: (document.body?.innerText || "").slice(0, 5000),
    };
  });

  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
