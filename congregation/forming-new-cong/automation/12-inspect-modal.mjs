import { chromium } from "playwright";

const browser = await chromium.connectOverCDP(process.env.JW_MAIL_CDP_ENDPOINT || "http://127.0.0.1:9225");
const context = browser.contexts()[0];
const page = context.pages().find((candidate) => candidate.url().startsWith("https://mail.jwpub.org/owa/"));
if (!page) throw new Error("No live JWPub Mail page found.");
await page.bringToFront();
const visible = await page.locator('button, [role="button"], [role="dialog"], [role="alertdialog"], [ismodal="true"]')
  .evaluateAll((elements) => elements.filter((element) => element.offsetParent !== null).map((element) => ({
    tag: element.tagName,
    role: element.getAttribute("role") || "",
    aria: element.getAttribute("aria-label") || "",
    title: element.getAttribute("title") || "",
    ismodal: element.getAttribute("ismodal") || "",
    text: (element.textContent || "").replace(/\s+/gu, " ").trim().slice(0, 800),
  })).filter((item) => item.ismodal || item.role === "dialog" || item.role === "alertdialog" || /discard|draft|save|cancel|attachment/i.test(`${item.text} ${item.aria} ${item.title}`)));
console.log(JSON.stringify({ url: page.url(), visible }, null, 2));
if (process.argv.includes("--confirm-discard")) {
  const dialogs = page.locator('[role="alertdialog"][ismodal="true"]');
  const active = [];
  for (let index = 0; index < await dialogs.count(); index += 1) {
    if (await dialogs.nth(index).isVisible()) active.push(dialogs.nth(index));
  }
  if (active.length !== 1 || !(await active[0].innerText()).includes("This message will be deleted.")) {
    throw new Error("Expected one active Discard message confirmation dialog.");
  }
  const confirm = active[0].locator("button").filter({ hasText: /^Discard/u });
  const buttons = [];
  for (let index = 0; index < await confirm.count(); index += 1) {
    if (await confirm.nth(index).isVisible()) buttons.push(confirm.nth(index));
  }
  if (buttons.length !== 1) throw new Error(`Expected one Discard confirmation; found ${buttons.length}.`);
  await buttons[0].click();
  await page.waitForTimeout(800);
  console.log(JSON.stringify({ discarded: true, visibleEditors: await page.getByRole("textbox", { name: "Message body", exact: true }).count() }));
}
process.exit(0);
