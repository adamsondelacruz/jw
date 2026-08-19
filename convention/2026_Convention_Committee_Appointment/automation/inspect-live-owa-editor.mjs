import { chromium } from "playwright";

const browser = await chromium.connectOverCDP("http://127.0.0.1:9225");
try {
  const page = browser.contexts().flatMap((context) => context.pages())
    .find((candidate) => candidate.url().startsWith("https://mail.jwpub.org/owa/"));
  if (!page) throw new Error("No live JWPub Mail page found.");
  await page.getByRole("button", { name: "New", exact: true }).click();
  await page.waitForTimeout(1000);
  const result = await page.evaluate(() => [...document.querySelectorAll("button, input, textarea, [contenteditable=true], [role=textbox]")]
    .map((element) => ({tag:element.tagName,text:element.textContent?.trim().slice(0,80)||"",aria:element.getAttribute("aria-label")||"",title:element.getAttribute("title")||"",placeholder:element.getAttribute("placeholder")||"",type:element.getAttribute("type")||"",contenteditable:element.getAttribute("contenteditable")||""}))
    .filter((item) => /to|cc|subject|message|send|attach|discard|body/i.test(Object.values(item).join(" "))));
  console.log(JSON.stringify(result, null, 2));
} finally { await browser.close(); }
