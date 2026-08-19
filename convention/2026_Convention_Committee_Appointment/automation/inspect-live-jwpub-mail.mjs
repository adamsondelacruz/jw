import { chromium } from "playwright";

const browser = await chromium.connectOverCDP("http://127.0.0.1:9225");

try {
  const context = browser.contexts()[0];
  if (!context) throw new Error("No live dedicated browser context found.");
  const page = await context.newPage();
  await page.goto("https://mail.jwpub.org/owa/#path=/mail", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.waitForTimeout(5_000);
  const state = await page.evaluate(() => ({
    title: document.title,
    url: location.href,
    text: (document.body?.innerText || "").slice(0, 2500),
    composeControls: [...document.querySelectorAll("button, a")]
      .map((element) => `${element.getAttribute("aria-label") || ""} ${element.textContent || ""}`.trim())
      .filter((value) => /new message|compose|new mail/i.test(value))
      .slice(0, 10),
  }));
  console.log(JSON.stringify(state, null, 2));
} finally {
  await browser.close();
}
