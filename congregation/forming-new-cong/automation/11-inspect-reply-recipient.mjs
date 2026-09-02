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
const page = context.pages().find((candidate) => candidate.url().startsWith("https://mail.jwpub.org/owa/"));
if (!page) throw new Error("No live JWPub Mail page found.");
await page.bringToFront();

const rows = page.locator('[role="option"]')
  .filter({ hasText: "Application - Tagalog Congregation Ashburton" })
  .filter({ hasText: "Pratt, Ross; Martin, Daniel" })
  .filter({ hasText: "Morning Daniel We met last night as a body to consider the Tagalog COBE." });
const row = await oneVisible(rows, "target conversation");
await row.evaluate((element) => element.click());
await page.waitForTimeout(900);

let messages = page.locator('[aria-label="Expanded Message Contents"]')
  .filter({ hasText: "Martin, Daniel" })
  .filter({ hasText: "11:29 a.m." })
  .filter({ hasText: "Thank you for submitting the S-51 form." });
let message = null;
for (let index = 0; index < await messages.count(); index += 1) {
  if (await messages.nth(index).isVisible()) message = messages.nth(index);
}
if (!message) {
  const collapsed = await oneVisible(page.locator('[aria-label="Collapsed Message Contents"]')
    .filter({ hasText: "Martin, Daniel" })
    .filter({ hasText: "11:29 a.m." })
    .filter({ hasText: "Thank you for submitting the S-51 form." }), "collapsed Daniel message");
  await collapsed.click();
  await page.waitForTimeout(600);
  message = await oneVisible(messages, "expanded Daniel message");
}

const more = await oneVisible(message.getByRole("button", { name: "More Actions", exact: true }), "Daniel More Actions");
await more.click();
const reply = await oneVisible(page.locator('button[role="menuitem"]').filter({ hasText: /^\s*Reply\s*$/u }), "sender-only Reply");
await reply.click();

const editor = await oneVisible(page.getByRole("textbox", { name: "Message body", exact: true }), "reply editor");
const compose = editor.locator('xpath=ancestor::*[.//button[@aria-label="Send"]][1]');
const candidates = await compose.locator("*").evaluateAll((elements) => elements
  .filter((element) => element.offsetParent !== null)
  .filter((element) => /Martin, Daniel/i.test(`${element.textContent || ""} ${element.getAttribute("aria-label") || ""} ${element.getAttribute("title") || ""}`))
  .map((element) => ({
    tag: element.tagName,
    role: element.getAttribute("role") || "",
    text: (element.textContent || "").replace(/\s+/gu, " ").trim().slice(0, 220),
    aria: element.getAttribute("aria-label") || "",
    title: element.getAttribute("title") || "",
    autoid: element.getAttribute("autoid") || "",
    className: typeof element.className === "string" ? element.className : "",
  }))
  .filter((item) => item.text.length < 180 || item.aria || item.title));
console.log(JSON.stringify({ composeText: clean(await compose.innerText()).slice(0, 800), candidates }, null, 2));

const discard = await oneVisible(compose.getByRole("button", { name: "Discard", exact: true }), "Discard button");
await discard.click();
await page.waitForTimeout(500);
for (const button of await page.getByRole("button", { name: /^Discard$/i }).all()) {
  if (await button.isVisible()) await button.click();
}
await page.waitForTimeout(500);
console.log(JSON.stringify({ visibleEditorsAfterDiscard: await page.getByRole("textbox", { name: "Message body", exact: true }).count() }));
process.exit(0);
