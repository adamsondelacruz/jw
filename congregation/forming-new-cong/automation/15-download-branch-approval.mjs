import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";

const CDP = process.env.JW_MAIL_CDP_ENDPOINT || "http://127.0.0.1:9225";
const PROJECT_ROOT = path.resolve("..");
const TARGET = path.join(PROJECT_ROOT, "27-AUS2824311_1.pdf");

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
if (!page) throw new Error("No authenticated JWPub Mail page is open.");
await page.bringToFront();
if ((await page.title()) !== "Mail - 1delaCruzAdamson@jwpub.org") throw new Error(`Unexpected mailbox: ${await page.title()}`);

const inbox = (await visible(page.locator('[role="treeitem"]:has(span[title="Inbox"])')))[0];
if (!inbox) throw new Error("Inbox folder was not found.");
await inbox.click();
await page.waitForTimeout(1_200);
const rows = [];
for (const row of await visible(page.locator('[role="option"]'))) {
  if (clean(await row.innerText()).startsWith("SRV-Preaching Needs Desk Approval of New Congregation ")) rows.push(row);
}
if (rows.length !== 1) throw new Error(`Expected one branch approval row; found ${rows.length}.`);
await rows[0].evaluate((element) => element.click());
await page.waitForTimeout(1_000);

const titles = await visible(page.locator('[title="AUS2824311_1.pdf"]'));
if (!titles.length) throw new Error("The expected approval-letter attachment was not found.");
let link = null;
for (const title of titles) {
  const candidate = title.locator('xpath=ancestor::a[contains(@href,"GetFileAttachment")][1]');
  if (await candidate.count()) { link = candidate; break; }
}
if (!link) throw new Error("The approval-letter download link was not found.");
const href = await link.getAttribute("href");
if (!href) throw new Error("The approval-letter download link is empty.");
const url = new URL(href, "https://mail.jwpub.org/owa/");
if (url.protocol !== "https:" || url.hostname !== "mail.jwpub.org" || !/GetFileAttachment/i.test(url.pathname + url.search)) {
  throw new Error("Unexpected attachment download destination.");
}
const response = await context.request.get(url.href, { timeout: 60_000 });
if (!response.ok()) throw new Error(`Approval-letter download failed with HTTP ${response.status()}.`);
const data = await response.body();
if (data.length < 1_000 || data.subarray(0, 5).toString("ascii") !== "%PDF-") throw new Error("Downloaded attachment is not a valid PDF.");
const digest = crypto.createHash("sha256").update(data).digest("hex");
try {
  const existing = await fs.readFile(TARGET);
  const existingDigest = crypto.createHash("sha256").update(existing).digest("hex");
  if (existingDigest !== digest) throw new Error("The target approval-letter path already contains different content.");
  console.log(JSON.stringify({ status: "already-present", path: TARGET, bytes: data.length, sha256: digest }, null, 2));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  await fs.writeFile(TARGET, data, { mode: 0o644, flag: "wx" });
  console.log(JSON.stringify({ status: "downloaded", path: TARGET, bytes: data.length, sha256: digest }, null, 2));
}
process.exit(0);
