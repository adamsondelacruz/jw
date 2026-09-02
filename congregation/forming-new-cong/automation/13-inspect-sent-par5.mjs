import { chromium } from "playwright";

function clean(value) {
  return (value || "").replace(/\u00a0/g, " ").replace(/\s+/gu, " ").trim();
}

async function oneVisible(locator, label) {
  const matches = [];
  for (let index = 0; index < await locator.count(); index += 1) {
    if (await locator.nth(index).isVisible()) matches.push(locator.nth(index));
  }
  if (matches.length !== 1) throw new Error(`Expected one visible ${label}; found ${matches.length}.`);
  return matches[0];
}

const browser = await chromium.connectOverCDP(process.env.JW_MAIL_CDP_ENDPOINT || "http://127.0.0.1:9225");
const context = browser.contexts()[0];
const page = await context.newPage();
await page.goto("https://mail.jwpub.org/owa/#path=/mail", { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForTimeout(3500);

const sentFolders = page.locator('[role="treeitem"]:has(span[title="Sent Items"])');
let sent = null;
for (let index = 0; index < await sentFolders.count(); index += 1) {
  if (await sentFolders.nth(index).isVisible()) { sent = sentFolders.nth(index); break; }
}
if (!sent) throw new Error("No visible Sent Items folder found.");
await sent.click();
await page.waitForTimeout(1800);
const rows = page.locator('[role="option"]')
  .filter({ hasText: /Application - Tagalog Congregation Ashburton/i })
  .filter({ hasText: /Martin, Daniel/i });
const visibleRows = [];
for (let index = 0; index < await rows.count(); index += 1) {
  if (await rows.nth(index).isVisible()) visibleRows.push(rows.nth(index));
}
if (!visibleRows.length) throw new Error("No matching Sent Items row found.");
const rowSummaries = [];
for (const row of visibleRows) rowSummaries.push(clean(await row.innerText()));
await visibleRows[0].evaluate((element) => element.click());
await page.waitForTimeout(5000);

const attachmentCards = await page.locator('[autoid="_ay_2"]').evaluateAll((cards) => cards
  .map((card) => ({
    visible: card.offsetParent !== null,
    text: (card.textContent || "").replace(/\s+/gu, " ").trim(),
    titles: [...card.querySelectorAll("[title]")].map((item) => item.getAttribute("title")).filter(Boolean),
    links: [...card.querySelectorAll("a")].map((item) => ({ text: (item.textContent || "").trim(), hasDownloadHref: /GetFileAttachment/i.test(item.getAttribute("href") || ""), title: item.getAttribute("title") || "" })),
    images: [...card.querySelectorAll("img")].map((item) => ({ alt: item.getAttribute("alt") || "", title: item.getAttribute("title") || "", hasSource: Boolean(item.getAttribute("src")) })),
  })));
const body = clean(await page.locator("body").innerText());
const pageHtml = await page.locator("body").innerHTML();
const expected = [
  "S-29-Ashburton-Tagalog-signed.pdf",
  "S-5_E.pdf",
  "M-202-Ashburton-Tagalog-signed.pdf",
  "S-36_E 2.pdf",
  "S-6-Ashburton-Tagalog-signed.pdf",
  "S-6-ashburton-territory.png",
  "S-6-ashburton-territory-2.png",
];
const fileEvidence = {};
for (const name of expected) {
  fileEvidence[name] = await page.locator("*").evaluateAll((elements, expectedName) => elements
    .filter((element) => (element.textContent || "").replace(/\s+/gu, " ").trim() === expectedName)
    .slice(0, 8)
    .map((element) => {
      const chain = [];
      let current = element;
      for (let depth = 0; current && depth < 5; depth += 1, current = current.parentElement) {
        chain.push({
          tag: current.tagName,
          visible: current.offsetParent !== null,
          role: current.getAttribute("role") || "",
          title: current.getAttribute("title") || "",
          autoid: current.getAttribute("autoid") || "",
          text: (current.textContent || "").replace(/\s+/gu, " ").trim().slice(0, 180),
          hasDownloadHref: Boolean(current.querySelector('a[href*="GetFileAttachment"]')),
          imageCount: current.querySelectorAll("img").length,
        });
      }
      return chain;
    }), name);
}
console.log(JSON.stringify({
  title: await page.title(),
  url: page.url(),
  rowSummaries,
  expectedInBody: Object.fromEntries(expected.map((name) => [name, body.includes(name)])),
  expectedInHtml: Object.fromEntries(expected.map((name) => [name, pageHtml.includes(name)])),
  visibleImages: await page.locator("img").evaluateAll((images) => images.filter((image) => image.offsetParent !== null).map((image) => ({
    alt: image.getAttribute("alt") || "",
    title: image.getAttribute("title") || "",
    hasSource: Boolean(image.getAttribute("src")),
    parentText: (image.parentElement?.textContent || "").replace(/\s+/gu, " ").trim().slice(0, 160),
  })).filter((item) => item.alt || item.title || item.parentText)),
  fileEvidence,
  attachmentCards,
}, null, 2));
await page.close();
process.exit(0);
