import process from "node:process";
import { chromium } from "playwright";

const CDP = process.env.JW_MAIL_CDP_ENDPOINT || "http://127.0.0.1:9225";

function clean(value) {
  return (value || "").replace(/\u00a0/g, " ").replace(/\s+/gu, " ").trim();
}

async function visible(locator) {
  const values = [];
  for (let index = 0; index < await locator.count(); index += 1) {
    if (await locator.nth(index).isVisible()) values.push(locator.nth(index));
  }
  return values;
}

const browser = await chromium.connectOverCDP(CDP, { timeout: 10_000 });
const context = browser.contexts()[0];
if (!context) throw new Error("No authenticated browser context is available.");
let page = context.pages().find((candidate) => candidate.url().startsWith("https://mail.jwpub.org/owa/"));
if (!page) {
  page = await context.newPage();
  await page.goto("https://mail.jwpub.org/owa/#path=/mail", { waitUntil: "domcontentloaded", timeout: 60_000 });
}
await page.bringToFront();
await page.waitForTimeout(3_000);
if (!page.url().startsWith("https://mail.jwpub.org/owa/")) throw new Error(`Unexpected mail destination: ${page.url()}`);
if ((await page.title()) !== "Mail - 1delaCruzAdamson@jwpub.org") throw new Error(`Unexpected mailbox: ${await page.title()}`);

const inboxFolders = await visible(page.locator('[role="treeitem"]:has(span[title="Inbox"])'));
if (!inboxFolders.length) throw new Error("Inbox folder was not found.");
await inboxFolders[0].click();
await page.waitForTimeout(1_500);

const candidates = [];
const rows = await visible(page.locator('[role="option"]'));
for (const row of rows) {
  const text = clean(await row.innerText());
  if (/ashburton|tagalog|congregation|approved|approval|branch|service department|2\/09|02\/09|yesterday/i.test(text)) {
    candidates.push(text);
  }
}
if (process.argv.includes("--open")) {
  const matches = [];
  for (const row of rows) {
    const text = clean(await row.innerText());
    if (text.startsWith("SRV-Preaching Needs Desk Approval of New Congregation ")) matches.push(row);
  }
  if (matches.length !== 1) throw new Error(`Expected one branch approval row; found ${matches.length}.`);
  await matches[0].evaluate((element) => element.click());
  await page.waitForTimeout(1_300);
  const messageContainers = [];
  for (const selector of ['[aria-label="Expanded Message Contents"]', '[aria-label="Message Contents"]']) {
    for (const item of await visible(page.locator(selector))) {
      const text = clean(await item.innerText());
      if (/SRV-Preaching Needs Desk|Please find attached a letter for your attention/i.test(text)) messageContainers.push(item);
    }
    if (messageContainers.length) break;
  }
  const message = messageContainers[messageContainers.length - 1] || page.locator("body");
  const attachmentCards = await message.locator('[autoid="_ay_2"], [role="link"]')
    .evaluateAll((elements) => elements.filter((element) => element.offsetParent !== null).map((element) => ({
      text: (element.textContent || "").replace(/\u00a0/g, " ").replace(/\s+/gu, " ").trim(),
      titles: [...element.querySelectorAll("[title]")].map((child) => child.getAttribute("title")).filter(Boolean),
      hasDownload: Boolean(element.matches('a[href*="GetFileAttachment"]') || element.querySelector('a[href*="GetFileAttachment"]')),
    })).filter((item) => item.hasDownload || /\.pdf\b/i.test(item.text)));
  console.log(JSON.stringify({
    mode: "read-only-open",
    account: await page.title(),
    url: page.url(),
    message: clean(await message.innerText()),
    attachmentCards,
  }, null, 2));
  process.exit(0);
}
console.log(JSON.stringify({
  mode: "read-only",
  account: await page.title(),
  url: page.url(),
  candidates,
}, null, 2));
process.exit(0);
