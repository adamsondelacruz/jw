import { chromium } from "playwright";

const browser = await chromium.connectOverCDP(process.env.JW_MAIL_CDP_ENDPOINT || "http://127.0.0.1:9225");
const context = browser.contexts()[0];
if (!context) throw new Error("No authenticated JWPub browser context is available.");
const page = context.pages().find((candidate) => candidate.url() === "https://mail.jwpub.org/owa/#path=/mail")
  ?? context.pages().find((candidate) => candidate.url().startsWith("https://mail.jwpub.org/owa/"));
if (!page) throw new Error("No live JWPub Mail page found.");
await page.bringToFront();
const rows = [];
for (const row of await page.locator('[role="option"]').all()) {
  if (!await row.isVisible()) continue;
  const text = (await row.innerText()).replace(/\s+/gu, " ").trim();
  if (/martin|application|tagalog|congregation/i.test(text)) rows.push(text);
}
const targetRows = page.locator('[role="option"]').filter({ hasText: "Application - Tagalog Congregation Ashburton" });
for (const row of await targetRows.all()) {
  if (await row.isVisible()) {
    await row.evaluate((element) => element.click());
    await page.waitForTimeout(900);
    break;
  }
}
let messages = page.locator('[aria-label="Expanded Message Contents"]')
  .filter({ hasText: "Martin, Daniel" })
  .filter({ hasText: "11:29 a.m." })
  .filter({ hasText: "Thank you for submitting the S-51 form." });
let expandedVisible = false;
for (const message of await messages.all()) if (await message.isVisible()) expandedVisible = true;
if (!expandedVisible) {
  const collapsed = page.locator('[aria-label="Collapsed Message Contents"]')
    .filter({ hasText: "Martin, Daniel" })
    .filter({ hasText: "11:29 a.m." })
    .filter({ hasText: "Thank you for submitting the S-51 form." });
  for (const message of await collapsed.all()) {
    if (await message.isVisible()) {
      await message.click();
      await page.waitForTimeout(700);
      break;
    }
  }
  messages = page.locator('[aria-label="Expanded Message Contents"]')
    .filter({ hasText: "Martin, Daniel" })
    .filter({ hasText: "11:29 a.m." })
    .filter({ hasText: "Thank you for submitting the S-51 form." });
}
const messageDetails = [];
for (const message of await messages.all()) {
  if (!await message.isVisible()) continue;
  messageDetails.push({
    text: (await message.innerText()).replace(/\s+/gu, " ").trim().slice(0, 1200),
    controls: await message.locator('button, a, [role="button"]').evaluateAll((elements) => elements.map((element) => ({
      tag: element.tagName,
      text: element.textContent?.replace(/\s+/gu, " ").trim().slice(0, 120) || "",
      aria: element.getAttribute("aria-label") || "",
      title: element.getAttribute("title") || "",
      visible: element.offsetParent !== null,
    })).filter((item) => item.text || item.aria || item.title)),
  });
}
const continueButtons = page.getByRole("button", { name: "Continue editing", exact: true });
for (const button of await continueButtons.all()) {
  if (await button.isVisible()) {
    await button.click();
    await page.waitForTimeout(500);
    break;
  }
}
const draftEditors = [];
for (const editor of await page.getByRole("textbox", { name: "Message body", exact: true }).all()) {
  if (!await editor.isVisible()) continue;
  const compose = editor.locator('xpath=ancestor::*[.//button[@aria-label="Send"]][1]');
  draftEditors.push({
    body: (await editor.innerText()).replace(/\s+/gu, " ").trim().slice(0, 2000),
    compose: (await compose.innerText()).replace(/\s+/gu, " ").trim().slice(0, 2500),
    attachments: await compose.locator('[autoid="_ay_2"] [title]').evaluateAll((elements) => elements.map((element) => element.getAttribute("title")).filter(Boolean)),
  });
}
const visibleDraftCards = [];
for (const card of await page.locator('[aria-label="Message Contents"]').filter({ hasText: "[Draft] This message hasn't been sent." }).all()) {
  if (!await card.isVisible()) continue;
  visibleDraftCards.push({
    text: (await card.innerText()).replace(/\s+/gu, " ").trim().slice(0, 2500),
    controls: await card.locator('button, [role="button"]').evaluateAll((elements) => elements
      .filter((element) => element.offsetParent !== null)
      .map((element) => ({ text: element.textContent?.replace(/\s+/gu, " ").trim() || "", aria: element.getAttribute("aria-label") || "", title: element.getAttribute("title") || "" }))),
  });
}
const draftMarkers = [];
for (const marker of await page.getByText("[Draft] This message hasn't been sent.", { exact: true }).all()) {
  if (!await marker.isVisible()) continue;
  draftMarkers.push(await marker.evaluate((element) => {
    const chain = [];
    let current = element;
    for (let depth = 0; current && depth < 8; depth += 1, current = current.parentElement) {
      chain.push({
        tag: current.tagName,
        role: current.getAttribute("role") || "",
        aria: current.getAttribute("aria-label") || "",
        autoid: current.getAttribute("autoid") || "",
        className: typeof current.className === "string" ? current.className : "",
        text: (current.textContent || "").replace(/\s+/gu, " ").trim().slice(0, 1000),
        controls: [...current.querySelectorAll("button, [role='button']")]
          .filter((item) => item.offsetParent !== null)
          .map((item) => ({ text: (item.textContent || "").replace(/\s+/gu, " ").trim(), aria: item.getAttribute("aria-label") || "", title: item.getAttribute("title") || "" })),
      });
    }
    return chain;
  }));
}
let replyMenuItems = [];
const visibleMessages = [];
for (const message of await messages.all()) if (await message.isVisible()) visibleMessages.push(message);
if (visibleMessages.length === 1) {
  const scopedMoreActions = [];
  for (const button of await visibleMessages[0].getByRole("button", { name: "More Actions", exact: true }).all()) {
    if (await button.isVisible()) scopedMoreActions.push(button);
  }
  if (scopedMoreActions.length === 1) {
    await scopedMoreActions[0].click();
    await page.waitForTimeout(200);
    replyMenuItems = await page.locator('[role="menuitem"]').evaluateAll((elements) => elements
      .filter((element) => element.offsetParent !== null)
      .map((element) => ({
        text: element.textContent?.replace(/\s+/gu, " ").trim() || "",
        aria: element.getAttribute("aria-label") || "",
        id: element.id || "",
        parent: element.parentElement?.getAttribute("role") || "",
        menuText: element.closest('[role="menu"]')?.textContent?.replace(/\s+/gu, " ").trim() || "",
        rect: { x: element.getBoundingClientRect().x, y: element.getBoundingClientRect().y },
      })));
    await page.keyboard.press("Escape");
  }
}
console.log(JSON.stringify({ title: await page.title(), url: page.url(), draftEditors, visibleDraftCards, draftMarkers }, null, 2));
