import { chromium } from "playwright";

const subject = process.argv.slice(2).join(" ");
if (!subject) throw new Error("Supply the exact subject to check.");
const browser = await chromium.connectOverCDP("http://127.0.0.1:9225");
try {
  const page = browser.contexts().flatMap((context) => context.pages())
    .find((candidate) => candidate.url().startsWith("https://mail.jwpub.org/owa/"));
  if (!page) throw new Error("No live JWPub Mail page found.");
  const sentFolder = page.getByText("Sent Items", { exact: true });
  const visible = [];
  for (let i = 0; i < await sentFolder.count(); i++) if (await sentFolder.nth(i).isVisible()) visible.push(sentFolder.nth(i));
  if (!visible.length) throw new Error("No visible Sent Items folder found.");
  await visible[0].click();
  await page.waitForTimeout(1800);
  const matches = await page.getByText(subject, { exact: true }).count();
  const body = await page.locator("body").innerText();
  console.log(JSON.stringify({ subject, matches, notification: (body.match(/[^\n]*(?:sent|send)[^\n]*/gi) || []).slice(0, 20) }, null, 2));
} finally { await browser.close(); }
