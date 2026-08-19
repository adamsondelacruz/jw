import { chromium } from "playwright";

const browser = await chromium.connectOverCDP("http://127.0.0.1:9225");
try {
  const page = browser.contexts().flatMap((context) => context.pages())
    .find((candidate) => candidate.url().startsWith("https://mail.jwpub.org/owa/"));
  if (!page) throw new Error("No live JWPub Mail page found.");
  await page.bringToFront();
  const result = await page.evaluate(() => [...document.querySelectorAll("button, a, [role=button], input")]
    .map((element) => ({
      tag: element.tagName,
      role: element.getAttribute("role") || "",
      text: element.textContent?.trim().replace(/\s+/g, " ").slice(0, 120) || "",
      aria: element.getAttribute("aria-label") || "",
      title: element.getAttribute("title") || "",
      type: element.getAttribute("type") || "",
      id: element.id || "",
    }))
    .filter((item) => /new|compose|mail|message|send|attach/i.test(`${item.text} ${item.aria} ${item.title}`))
    .slice(0, 100));
  console.log(JSON.stringify(result, null, 2));
} finally { await browser.close(); }
